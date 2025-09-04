import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import { sortCards, getCardDisplayName } from '../utils/cardUtils';
import './PokerTable.css';

const PokerTable = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [myCards, setMyCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [myPosition, setMyPosition] = useState(-1);
  const [gameMessage, setGameMessage] = useState('');
  const [playedCards, setPlayedCards] = useState([]); // 桌面上的牌
  const [room, setRoom] = useState(null); // 房间信息

  useEffect(() => {
    console.log('🎮 PokerTable组件挂载 - roomId:', roomId);
    
    // 清理之前的事件监听
    socketService.offComponent('PokerTable');
    
    // 确保Socket连接
    const initSocket = async () => {
      let socket = socketService.connect();
      
      // 如果是Promise，等待连接完成
      if (socket instanceof Promise) {
        socket = await socket;
      }
      
      if (!socket) {
        console.error('❌ 无法建立Socket连接');
        setGameMessage('❌ 连接服务器失败，请刷新页面重试');
        return;
      }
      
      console.log('🔗 PokerTable Socket状态:', socket.connected);
      
      // 等待连接完成后再设置监听器
      if (!socket.connected) {
        socket.once('connect', () => {
          setupEventListeners(socket);
        });
      } else {
        setupEventListeners(socket);
      }
    };
    
        const setupEventListeners = (socket) => {
      console.log('🎯 设置PokerTable事件监听器');
      
      // 获取房间信息
      socket.emit('getRoomInfo', roomId);
      
      // 使用新的事件监听方法
      socketService.on('roomInfo', (roomData) => {
        console.log('📝 收到房间信息:', roomData);
        setRoom(roomData);
      }, 'PokerTable');

      socketService.on('cardsDealt', (data) => {
        console.log('🃏 收到发牌事件:', data);
        const { cards, playerPosition, gameState } = data;
        setMyCards(sortCards(cards));
        setMyPosition(playerPosition);
        setGameState(gameState);
        setGameMessage('📋 发牌完成！查看你的手牌，准备亮主');
      }, 'PokerTable');

      socketService.on('trumpDeclared', (data) => {
        console.log('🎺 收到亮主事件:', data);
        setGameMessage(`🎺 ${data.playerName} 亮主: ${data.trumpSuit}`);
        setGameState(data.gameState);
        // 重新排序手牌（根据主牌）
        if (myCards.length > 0) {
          setMyCards(sortCards(myCards, gameState?.currentLevel, data.trumpSuit));
        }
      }, 'PokerTable');

      socketService.on('cardsPlayed', (data) => {
        console.log('🎮 收到出牌事件:', data);
        setGameMessage(`🃏 ${data.playerName} 出牌`);
        setGameState(data.gameState);
        // 更新桌面显示的牌
        setPlayedCards(prev => [...prev, {
          playerId: data.playerId,
          playerName: data.playerName,
          cards: data.cards
        }]);
      }, 'PokerTable');

      socketService.on('handUpdated', (data) => {
        console.log('✋ 手牌更新:', data);
        setMyCards(sortCards(data.cards));
        setGameState(data.gameState);
      }, 'PokerTable');

      socketService.on('trumpError', (error) => {
        console.log('❌ 亮主错误:', error);
        setGameMessage(`❌ 亮主失败: ${error}`);
      }, 'PokerTable');

      socketService.on('playError', (error) => {
        console.log('❌ 出牌错误:', error);
        setGameMessage(`❌ 出牌失败: ${error}`);
      }, 'PokerTable');
    };
    
    initSocket();
    
    // 清理函数
    return () => {
      console.log('🧹 PokerTable组件卸载，清理事件监听');
      socketService.offComponent('PokerTable');
    };
  }, [roomId]);

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
    if (selectedCards.length !== 3) {
      setGameMessage('❌ 亮主需要选择3张牌(一王带一对)');
      return;
    }

    const selectedCardObjects = selectedCards.map(index => myCards[index]);
    socketService.emit('declareTrump', {
      roomId: roomId,
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
      roomId: roomId,
      cardIndices: selectedCards
    });
    setSelectedCards([]);
  };

  // 获取玩家位置样式
  const getPlayerPosition = (index) => {
    const positions = ['bottom', 'left', 'top', 'right'];
    const relativeIndex = (index - myPosition + 4) % 4;
    return positions[relativeIndex];
  };

  // 获取游戏阶段描述
  const getPhaseDescription = () => {
    if (!gameState) return '等待游戏开始...';

    switch (gameState.gamePhase) {
      case 'bidding': return '亮主阶段';
      case 'playing': return '出牌阶段';
      case 'finished': return '游戏结束';
      default: return '未知阶段';
    }
  };

  return (
    <div className="poker-table">
      {/* 添加加载检查 */}
      {!room ? (
        <div className="loading-room">
          <div className="game-message">
            🔄 正在加载房间信息...
          </div>
        </div>
      ) : (
        <>
          {/* 游戏头部信息 */}
          <div className="game-header">
            <div className="game-info">
              <span className="room-info">房间: {roomId}</span>
              <span className="phase-info">{getPhaseDescription()}</span>
              {gameState?.trumpSuit && (
                <span className="trump-info">主牌: {gameState.trumpSuit}</span>
              )}
            </div>
            <button onClick={() => navigate('/')} className="leave-btn">
              离开游戏
            </button>
          </div>

          {/* 游戏消息 */}
          {gameMessage && (
            <div className="game-message">
              {gameMessage}
            </div>
          )}

          {/* 扑克桌面 */}
          <div className="table-container">
            {/* 其他玩家位置 */}
            {room.players.map((player, index) => {
              if (index === myPosition) return null;
              const position = getPlayerPosition(index);

              return (
                <div key={player.socketId} className={`player-area player-${position}`}>
                  <div className="player-info">
                    <div className="player-name">{player.name}</div>
                    <div className="player-cards-count">{player.cardCount || 26}张</div>
                    {player.isDealer && <div className="dealer-badge">庄</div>}
                  </div>
                  <div className="player-cards-back">
                    {/* 显示背面卡牌 */}
                    {Array.from({ length: Math.min(player.cardCount || 26, 13) }, (_, i) => (
                      <div key={i} className="card-back"></div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* 中央出牌区域 */}
            <div className="center-area">
              <div className="played-cards">
                {playedCards.map((play, index) => (
                  <div key={index} className="played-card-group">
                    <div className="player-label">{play.playerName}</div>
                    <div className="cards-group">
                      {play.cards.map((card, cardIndex) => (
                        <div key={cardIndex} className="played-card">
                          {getCardDisplayName(card)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 我的手牌区域 */}
          <div className="my-hand-area">
            <div className="hand-controls">
              {selectedCards.length > 0 && (
                <div className="action-buttons">
                  <span className="selected-count">已选择 {selectedCards.length} 张</span>
                  {gameState?.gamePhase === 'bidding' && (
                    <button onClick={handleDeclareTrump} className="action-btn trump-btn">
                      亮主 (需要一王带一对)
                    </button>
                  )}
                  {gameState?.gamePhase === 'playing' && (
                    <button onClick={handlePlayCards} className="action-btn play-btn">
                      出牌
                    </button>
                  )}
                  <button onClick={() => setSelectedCards([])} className="action-btn cancel-btn">
                    取消选择
                  </button>
                </div>
              )}
            </div>

            <div className="my-hand">
              {myCards.map((card, index) => (
                <div
                  key={card.id}
                  className={`hand-card ${selectedCards.includes(index) ? 'selected' : ''}`}
                  onClick={() => toggleCardSelection(index)}
                >
                  <div className="card-content">
                    {getCardDisplayName(card)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {myCards.length === 0 && (
            <div className="waiting-cards">
              <p>⏳ 等待发牌...</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PokerTable;
