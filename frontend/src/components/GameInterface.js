import React, { useState, useEffect } from 'react';
import socketService from '../services/socketService';
import { sortCards, getCardDisplayName } from '../utils/cardUtils';
import './GameInterface.css';

const GameInterface = ({ room }) => {
  const [myCards, setMyCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [myPosition, setMyPosition] = useState(-1);
  const [gameMessage, setGameMessage] = useState('');

  useEffect(() => {
    const socket = socketService.getSocket();
    
    // 监听发牌事件
    socket.on('cardsDealt', (data) => {
      const { cards, playerPosition, gameState } = data;
      setMyCards(sortCards(cards));
      setMyPosition(playerPosition);
      setGameState(gameState);
      setGameMessage('📋 发牌完成！查看你的手牌，准备亮主');
    });

    // 监听亮主事件
    socket.on('trumpDeclared', (data) => {
      setGameMessage(`🎺 ${data.playerName} 亮主: ${data.trumpSuit}`);
      setGameState(data.gameState);
      // 重新排序手牌（根据主牌）
      if (myCards.length > 0) {
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
      setMyCards(sortCards(data.cards));
      setGameState(data.gameState);
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
  const toggleCardSelection = (cardIndex) => {
    setSelectedCards(prev => {
      if (prev.includes(cardIndex)) {
        return prev.filter(i => i !== cardIndex);
      } else {
        return [...prev, cardIndex];
      }
    });
  };

  // 亮主操作
  const handleDeclareTrump = () => {
    if (selectedCards.length === 0) {
      setGameMessage('❌ 请选择要亮的牌');
      return;
    }

    const selectedCardObjects = selectedCards.map(index => myCards[index]);
    socketService.emit('declareTrump', {
      roomId: room.id,
      cards: selectedCardObjects
    });
    setSelectedCards([]);
  };

  // 出牌操作
  const handlePlayCards = () => {
    if (selectedCards.length === 0) {
      setGameMessage('❌ 请选择要出的牌');
      return;
    }

    socketService.emit('playCards', {
      roomId: room.id,
      cardIndices: selectedCards
    });
    setSelectedCards([]);
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
              {selectedCards.length > 0 && (
                <>
                  <span className="selected-count">
                    已选择 {selectedCards.length} 张牌
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
                    onClick={() => setSelectedCards([])}
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
                className={`game-card ${selectedCards.includes(index) ? 'selected' : ''}`}
                onClick={() => toggleCardSelection(index)}
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
