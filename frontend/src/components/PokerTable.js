import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import { sortCards, getCardDisplayName, identifyCardType } from '../utils/cardUtils';
import HandCards from './HandCards';
import { getCardBackPath, getCardImagePath } from '../utils/cardAssets';
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
        
        // 计算我的位置（如果还没有设置）
        if (myPosition === -1 && roomData.players) {
          const myPlayerIndex = roomData.players.findIndex(p => p.socketId === socketService.getSocketId());
          if (myPlayerIndex !== -1) {
            console.log('🎯 从房间信息计算我的位置:', myPlayerIndex);
            setMyPosition(myPlayerIndex);
          }
        }
      }, 'PokerTable');

      // 处理逐张发牌动画
      socketService.on('cardDealt', (data) => {
        console.log('🃏 收到单张发牌事件:', data);
        const { toPlayer, totalDealt, totalCards, playerCardIndex, totalPlayerCards } = data;
        setGameMessage(`🎴 发牌中... 第${totalDealt}/${totalCards}张 (每人${totalPlayerCards}张)`);
        
        // TODO: 添加发牌动画效果
      }, 'PokerTable');

      // 处理收到的牌
      socketService.on('cardReceived', (data) => {
        console.log('🃏 收到我的牌:', data);
        const { card, totalReceived, totalPlayerCards } = data;
        
        // 逐张添加到手牌
        setMyCards(prev => {
          const newCards = [...prev, card];
          return sortCards(newCards);
        });
        
        // 更新发牌进度消息
        setGameMessage(`🎴 发牌中... 您已收到 ${totalReceived}/${totalPlayerCards} 张牌`);
        
        if (totalReceived === totalPlayerCards) {
          setGameMessage('📋 发牌完成！查看你的手牌，准备亮主');
        }
      }, 'PokerTable');

      // 处理最终发牌完成（兼容旧版本）
      socketService.on('cardsDealt', (data) => {
        console.log('🃏 收到发牌完成事件:', data);
        const { cards, playerPosition, gameState, dealingComplete } = data;
        
        if (dealingComplete) {
          // 确保手牌完整（防止网络丢包）
          setMyCards(sortCards(cards));
          setMyPosition(playerPosition);
          setGameState(gameState);
          setGameMessage('📋 发牌完成！查看你的手牌，准备亮主');
        }
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
        setPlayedCards(prev => {
          const newPlayed = [...prev, {
            playerId: data.playerId,
            playerName: data.playerName,
            cards: data.cards
          }];
          
          // 如果是轮次结束，显示获胜者
          if (newPlayed.length === 4) {
            // 显示轮次完成
            setGameMessage('🎯 轮次完成，等待判定获胜者...');
          }
          
          return newPlayed;
        });
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

      socketService.on('roundEnded', (data) => {
        console.log('🏆 轮次结束:', data);
        const winnerName = room?.players?.[data.winner]?.name || `玩家${data.winner + 1}`;
        setGameMessage(`🏆 ${winnerName} 获得这一轮! 得分: ${data.points}`);
        
        // 延迟清理桌面
        setTimeout(() => {
          setPlayedCards([]);
          setGameMessage('🔄 开始下一轮出牌');
        }, 3000);
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
      const newSelection = prev.includes(cardIndex) 
        ? prev.filter(i => i !== cardIndex)
        : [...prev, cardIndex];
      
      // 实时验证选择的牌
      if (newSelection.length > 0) {
        if (gameState?.gamePhase === 'bidding') {
          // 亮主阶段
          const validation = validateTrumpCards(newSelection);
          if (newSelection.length === 3) {
            setGameMessage(validation.valid 
              ? `✅ ${validation.message}` 
              : `❌ ${validation.message}`
            );
          } else if (newSelection.length > 3) {
            setGameMessage('❌ 最多只能选择3张牌');
          } else {
            setGameMessage(`🔄 已选择${newSelection.length}张牌，需要一王带一对(共3张)`);
          }
        } else if (gameState?.gamePhase === 'playing') {
          // 出牌阶段
          const validation = validatePlayCards(newSelection);
          setGameMessage(validation.valid 
            ? `✅ ${validation.cardType.message}` 
            : `🔄 已选择${newSelection.length}张牌`
          );
        }
      }
      
      return newSelection;
    });
  };

  // 验证亮主牌型(一王带一对)
  const validateTrumpCards = (selectedCards) => {
    if (selectedCards.length !== 3) {
      return { valid: false, message: '亮主需要选择3张牌(一王带一对)' };
    }

    const selectedCardObjects = selectedCards.map(index => myCards[index]);
    
    // 分类：王牌和普通牌
    const jokers = selectedCardObjects.filter(card => card.suit === 'joker');
    const normalCards = selectedCardObjects.filter(card => card.suit !== 'joker');

    if (jokers.length !== 1) {
      return { valid: false, message: '需要恰好一张王牌(大王或小王)' };
    }

    if (normalCards.length !== 2) {
      return { valid: false, message: '需要恰好两张普通牌' };
    }

    // 检查是否为一对
    const [card1, card2] = normalCards;
    if (card1.rank !== card2.rank) {
      return { valid: false, message: '两张普通牌必须是一对(相同点数)' };
    }

    return { 
      valid: true, 
      message: `可以亮主: ${card1.rank}${card1.suit === card2.suit ? card1.suit : '混合花色'}`,
      joker: jokers[0],
      pair: normalCards,
      trumpSuit: card1.suit === card2.suit ? card1.suit : 'mixed',
      trumpRank: card1.rank
    };
  };

  // 亮主操作
  const handleDeclareTrump = () => {
    const validation = validateTrumpCards(selectedCards);
    
    if (!validation.valid) {
      setGameMessage(`❌ ${validation.message}`);
      return;
    }

    // 显示亮主预览
    setGameMessage(`🎺 准备亮主: ${validation.message}`);

    const selectedCardObjects = selectedCards.map(index => myCards[index]);
    socketService.emit('declareTrump', {
      roomId: roomId,
      cards: selectedCardObjects
    });
    setSelectedCards([]);
  };

  // 验证并识别出牌牌型
  const validatePlayCards = (selectedCards) => {
    if (selectedCards.length === 0) {
      return { valid: false, message: '请选择要出的牌' };
    }

    const selectedCardObjects = selectedCards.map(index => myCards[index]);
    const cardType = identifyCardType(
      selectedCardObjects, 
      gameState?.currentLevel || 2, 
      gameState?.trumpSuit
    );

    return {
      valid: cardType.type !== 'invalid',
      cardType: cardType,
      message: cardType.message
    };
  };

  // 出牌操作
  const handlePlayCards = () => {
    const validation = validatePlayCards(selectedCards);
    
    if (!validation.valid) {
      setGameMessage(`❌ ${validation.message}`);
      return;
    }

    // 显示出牌预览
    setGameMessage(`🃏 准备出牌: ${validation.cardType.message}`);

    socketService.emit('playCards', {
      roomId: roomId,
      cardIndices: selectedCards
    });
    setSelectedCards([]);
  };

  // 获取玩家位置样式
  const getPlayerPosition = (index) => {
    // 如果myPosition还没有设置，返回默认值
    if (myPosition === -1 || myPosition === undefined) {
      console.warn('getPlayerPosition: myPosition 还没有设置，使用默认位置');
      return 'left';
    }
    
    // 其他玩家的位置：左、上、右（跳过底部，底部是我自己）
    const positions = ['left', 'top', 'right'];
    const relativeIndex = (index - myPosition + 4) % 4;
    
    // 跳过自己的位置（relativeIndex === 0 是自己）
    if (relativeIndex === 0) {
      console.warn('getPlayerPosition: 试图获取自己的位置，这不应该发生', {
        index, 
        myPosition, 
        relativeIndex
      });
      return 'left'; // 默认返回左侧，但这是一个错误情况
    }
    
    // 将其他玩家映射到左、上、右位置
    return positions[relativeIndex - 1];
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
              <span className="level-info">
                当前级牌: {gameState?.currentLevel || 2}
              </span>
              <span className="trump-info">
                当前主色: {gameState?.trumpSuit || 'null'}
              </span>
              {gameState?.currentTurn !== undefined && (
                <span className="turn-info">
                  当前回合: 玩家{gameState.currentTurn + 1}
                </span>
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

          {/* 中央出牌区域 */}
          <div className="center-area">
            <div className="played-cards">
              {playedCards.map((play, index) => {
                // 获取玩家相对位置
                const playerIndex = room?.players?.findIndex(p => p.name === play.playerName) || 0;
                
                // 如果是自己的牌，使用bottom位置，否则调用getPlayerPosition
                let position;
                if (playerIndex === myPosition) {
                  position = 'bottom';
                } else {
                  position = getPlayerPosition(playerIndex);
                }
                
                return (
                  <div key={index} className={`played-card-group position-${position}`}>
                    <div className="player-label">{play.playerName}</div>
                    <div className="cards-group">
                      {play.cards.map((card, cardIndex) => (
                        <div key={cardIndex} className="played-card">
                          <img 
                            src={getCardImagePath(card)} 
                            alt={getCardDisplayName(card)}
                            className="played-card-image"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* 回合信息 */}
            {playedCards.length > 0 && (
              <div className="round-info">
                第 {gameState?.currentRound || 1} 轮 - {playedCards.length}/4 人已出牌
              </div>
            )}
          </div>

          {/* 其他玩家手牌 - 直接渲染每个玩家 */}
          {room && room.players && myPosition !== -1 && room.players.filter((_, index) => index !== myPosition).map((player) => {
            const playerIndex = room.players.findIndex(p => p.socketId === player.socketId);
            const position = getPlayerPosition(playerIndex);
            
            // 为其他玩家创建虚拟的卡牌背面
            const cardBacks = Array.from({ length: player.cards?.length || 0 }, (_, i) => ({
              suit: 'BACK',
              rank: 'BACK',
              id: `back-${playerIndex}-${i}`
            }));

            return (
              <div key={player.socketId} className={`other-player-hand ${position}`}>
                <div className="player-info">
                  <span className="player-name">{player.name}</span>
                  {gameState?.currentTurn === playerIndex && (
                    <span className="current-turn-indicator">🎯</span>
                  )}
                </div>
                <HandCards
                  cards={cardBacks}
                  selectedCards={[]}
                  onCardClick={() => {}} // 其他玩家的牌不可点击
                  isMyTurn={false}
                  position={position}
                />
              </div>
            );
          })}

          {/* 我的手牌区域 */}
          <div className="my-hand-area">
            <div className="hand-controls">
              {selectedCards.length > 0 && (
                <div className="action-buttons">
                  <span className="selected-count">已选择 {selectedCards.length} 张</span>
                  {gameState?.gamePhase === 'bidding' && (
                    <button 
                      onClick={handleDeclareTrump} 
                      className={`action-btn trump-btn ${
                        validateTrumpCards(selectedCards).valid ? 'valid' : 'invalid'
                      }`}
                      disabled={!validateTrumpCards(selectedCards).valid}
                    >
                      {selectedCards.length === 3 
                        ? (validateTrumpCards(selectedCards).valid ? '✅ 亮主' : '❌ 无效牌型')
                        : '亮主 (一王带一对)'
                      }
                    </button>
                  )}
                  {gameState?.gamePhase === 'playing' && (
                    <button 
                      onClick={handlePlayCards} 
                      className={`action-btn play-btn ${
                        validatePlayCards(selectedCards).valid ? 'valid' : 'invalid'
                      }`}
                      disabled={!validatePlayCards(selectedCards).valid}
                    >
                      {selectedCards.length > 0 
                        ? (validatePlayCards(selectedCards).valid 
                          ? `✅ 出牌 (${validatePlayCards(selectedCards).cardType.name})` 
                          : '❌ 无效牌型')
                        : '出牌'
                      }
                    </button>
                  )}
                  <button onClick={() => setSelectedCards([])} className="action-btn cancel-btn">
                    取消选择
                  </button>
                </div>
              )}
            </div>

            {/* 使用新的HandCards组件显示我的手牌 */}
            <HandCards
              cards={myCards}
              selectedCards={selectedCards}
              onCardClick={toggleCardSelection}
              isMyTurn={gameState?.currentTurn === myPosition}
              position="bottom"
            />
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
