import React, { useState, useEffect } from 'react';
import socketService from '../services/socketService';
import { sortCards, getCardDisplayName } from '../utils/cardUtils';
import './GameTable.css';

const GameTable = ({ room, onLeaveRoom }) => {
  const [myCards, setMyCards] = useState([]);
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [myPosition, setMyPosition] = useState(-1);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const socket = socketService.getSocket();
    
    // 监听发牌事件
    socket.on('cardsDealt', (data) => {
      const { cards, playerPosition, gameState } = data;
      const sorted = sortCards(cards);
      setMyCards(sorted);
      setMyPosition(playerPosition);
      setGameState(gameState);
      setMessage('📋 发牌完成！查看你的手牌，准备亮主');
      // 维持基于ID的选择
      setSelectedCardIds(prev => prev.filter(id => sorted.some(c => c.id === id)));
    });

    // 监听游戏状态更新
    socket.on('gameStarted', (data) => {
      setMessage(data.message);
    });

    // 监听亮主事件
    socket.on('trumpDeclared', (data) => {
      setMessage(`🎺 ${data.playerName} 亮主: ${data.trumpSuit}`);
      // 重新排序手牌（根据主牌）
      if (myCards.length > 0) {
        setMyCards(sortCards(myCards, gameState?.currentLevel, data.trumpSuit));
      }
    });

    // 监听出牌事件
    socket.on('cardsPlayed', (data) => {
      setMessage(`🃏 ${data.playerName} 出牌`);
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
      setMessage(`❌ 亮主失败: ${error}`);
    });

    socket.on('playError', (error) => {
      setMessage(`❌ 出牌失败: ${error}`);
    });

    return () => {
      socket.off('cardsDealt');
      socket.off('gameStarted');
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
      setMessage('❌ 请选择要亮的牌');
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
      setMessage('❌ 请选择要出的牌');
      return;
    }
    // 将选中ID映射为当前排序中的索引
    const idSet = new Set(selectedCardIds);
    const cardIndices = myCards
      .map((c, idx) => ({ id: c.id, idx }))
      .filter(x => idSet.has(x.id))
      .map(x => x.idx);

    socketService.emit('playCards', {
      roomId: room.id,
      cardIndices
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
    <div className="game-table">
      <div className="game-header">
        <h2>🎮 游戏桌 - 房间: {room.id}</h2>
        <button onClick={onLeaveRoom} className="btn btn-secondary btn-small">
          离开房间
        </button>
      </div>

      {message && (
        <div className="game-message">
          {message}
        </div>
      )}

      <div className="game-info">
        <div className="phase-info">
          <strong>当前阶段:</strong> {getPhaseDescription()}
        </div>
        <div className="player-info">
          <strong>我的位置:</strong> {myPosition + 1} 号位
        </div>
        {gameState?.trumpSuit && (
          <div className="trump-info">
            <strong>主牌:</strong> {gameState.trumpSuit}
          </div>
        )}
      </div>

      <div className="players-status">
        <h3>玩家状态</h3>
        <div className="players-grid">
          {room.players.map((player, index) => (
            <div 
              key={player.socketId} 
              className={`player-status ${index === myPosition ? 'my-player' : ''}`}
            >
              <div className="player-name">{player.name}</div>
              <div className="player-position">位置 {index + 1}</div>
              <div className="player-cards">手牌: {player.cardCount || 26}张</div>
              {player.isDealer && <div className="dealer-badge">庄家</div>}
            </div>
          ))}
        </div>
      </div>

      {myCards.length > 0 && (
        <div className="my-hand">
          <div className="hand-header">
            <h3>我的手牌 ({myCards.length}张)</h3>
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
                className={`card ${selectedCardIds.includes(card.id) ? 'selected' : ''}`}
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

      {myCards.length === 0 && (
        <div className="waiting-cards">
          <p>⏳ 等待发牌...</p>
        </div>
      )}
    </div>
  );
};

export default GameTable;
