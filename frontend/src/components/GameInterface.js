import React, { useState, useEffect } from 'react';
import socketService from '../services/socketService';
import { sortCards, getCardDisplayName } from '../utils/cardUtils';
import './GameInterface.css';

const GameInterface = ({ room }) => {
  const [myCards, setMyCards] = useState([]);
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [myPosition, setMyPosition] = useState(-1);
  const [gameMessage, setGameMessage] = useState('');

  useEffect(() => {
    const socket = socketService.getSocket();
    
    // 监听发牌事件
    socket.on('cardsDealt', (data) => {
      const { cards, playerPosition, gameState } = data;
      const sorted = sortCards(cards);
      setMyCards(sorted);
      setMyPosition(playerPosition);
      setGameState(gameState);
      setGameMessage('📋 发牌完成！查看你的手牌，准备亮主');
      setSelectedCardIds(prev => prev.filter(id => sorted.some(c => c.id === id)));
    });

    // 监听亮主事件
    socket.on('trumpDeclared', (data) => {
      setGameState(data.gameState);
      // 只有亮主的人按新主色排序，其他人不变
      if (myCards.length > 0 && myPosition === data.gameState?.trumpPlayer) {
        setMyCards(sortCards(myCards, gameState?.currentLevel, data.trumpSuit));
      }
    });

    // 监听出牌事件
    socket.on('cardsPlayed', (data) => {
      setGameMessage(`🃏 ${data.playerName} 出牌`);
      setGameState(data.gameState);
    });

    // 监听手牌更新
    socket.on('handUpdated', (data) => {
      const sorted = sortCards(data.cards);
      setMyCards(sorted);
      setGameState(data.gameState);
      setSelectedCardIds(prev => prev.filter(id => sorted.some(c => c.id === id)));
    });

    // 监听错误
    socket.on('trumpError', (error) => {
      setGameMessage(`❌ 亮主失败: ${error}`);
    });

    socket.on('playError', (error) => {
      setGameMessage(`❌ 出牌失败: ${error}`);
    });

    return () => {
      socket.off('cardsDealt');
      socket.off('trumpDeclared');
      socket.off('cardsPlayed');
      socket.off('handUpdated');
      socket.off('trumpError');
      socket.off('playError');
    };
  }, [myCards, gameState]);

  // 选择/取消选择卡牌
  const toggleCardSelection = (cardId) => {
    setSelectedCardIds(prev => prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]);
  };

  // 亮主操作
  const handleDeclareTrump = () => {
    if (selectedCardIds.length === 0) {
      setGameMessage('❌ 请选择要亮的牌');
      return;
    }
    const idSet = new Set(selectedCardIds);
    const selectedCardObjects = myCards.filter(c => idSet.has(c.id));
    socketService.emit('declareTrump', {
      roomId: room.id,
      cards: selectedCardObjects
    });
    setSelectedCardIds([]);
  };

  // 出牌操作
  const handlePlayCards = () => {
    if (selectedCardIds.length === 0) {
      setGameMessage('❌ 请选择要出的牌');
      return;
    }
    
    // 直接发送牌的ID，而不是索引
    socketService.emit('playCards', {
      roomId: room.id,
      cardIds: selectedCardIds
    });
    setSelectedCardIds([]);
  };

  // 获取游戏阶段描述
  const getPhaseDescription = () => {
    if (!gameState) return '等待游戏开始...';
    
    switch (gameState.gamePhase) {
      case 'bidding': return '亮主阶段 - 选择牌进行亮主';
      case 'playing': return '出牌阶段 - 选择牌进行出牌';
      case 'finished': return '游戏结束';
      default: return '未知阶段';
    }
  };

  return (
    <div className="game-interface">
      {gameMessage && (
        <div className="game-message">
          {gameMessage}
        </div>
      )}

      <div className="game-info">
        <div className="phase-info">
          <strong>当前阶段:</strong> {getPhaseDescription()}
        </div>
        {myPosition >= 0 && (
          <div className="player-info">
            <strong>我的位置:</strong> {myPosition + 1} 号位
          </div>
        )}
        {gameState?.trumpSuit && (
          <div className="trump-info">
            <strong>主牌:</strong> {gameState.trumpSuit}
          </div>
        )}
      </div>

      {myCards.length > 0 && (
        <div className="my-hand">
          <div className="hand-header">
            <h4>我的手牌 ({myCards.length}张)</h4>
            <div className="hand-actions">
              {selectedCardIds.length > 0 && (
                <>
                  <span className="selected-count">
                    已选择 {selectedCardIds.length} 张牌
                  </span>
                  {gameState?.gamePhase === 'bidding' && (
                    <button 
                      onClick={handleDeclareTrump}
                      className="btn btn-primary btn-small"
                    >
                      亮主
                    </button>
                  )}
                  {gameState?.gamePhase === 'playing' && (
                    <button 
                      onClick={handlePlayCards}
                      className="btn btn-success btn-small"
                    >
                      出牌
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedCardIds([])}
                    className="btn btn-secondary btn-small"
                  >
                    取消选择
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="cards-container">
            {myCards.map((card, index) => (
              <div
                key={card.id}
                className={`game-card ${selectedCardIds.includes(card.id) ? 'selected' : ''}`}
                onClick={() => toggleCardSelection(card.id)}
              >
                <div className="card-content">
                  {getCardDisplayName(card)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {myCards.length === 0 && gameState && (
        <div className="waiting-cards">
          <p>⏳ 等待发牌...</p>
        </div>
      )}
    </div>
  );
};

export default GameInterface;
