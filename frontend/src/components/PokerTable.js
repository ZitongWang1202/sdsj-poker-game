import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import { sortCards, getCardDisplayName, identifyCardType } from '../utils/cardUtils';
import { validateFollowCards } from '../utils/followValidation';
import HandCards from './HandCards';
import { getCardBackPath, getCardImagePath } from '../utils/cardAssets';
import './PokerTable.css';

const PokerTable = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [myCards, setMyCards] = useState([]);
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [myPosition, setMyPosition] = useState(-1);
  const [gameMessage, setGameMessage] = useState('');
  const [playedCards, setPlayedCards] = useState([]); // 桌面上的牌
  const [room, setRoom] = useState(null); // 房间信息
  const [trumpCountdown, setTrumpCountdown] = useState(null);
  const [counterTrumpCountdown, setCounterTrumpCountdown] = useState(null);
  const [stickCountdown, setStickCountdown] = useState(null);
  const [stickOptions, setStickOptions] = useState([]); // 可粘主的牌型选项
  const [stickExchange, setStickExchange] = useState(null); // 粘主交换界面
  const [selectedExchangeCards, setSelectedExchangeCards] = useState([]); // 选中的交换牌
  const [waitingNext, setWaitingNext] = useState(false); // 是否在等待下一局
  const [nextReadyCount, setNextReadyCount] = useState(0); // 已就绪人数

  // 监听游戏状态变化，重新计算粘主选项
  useEffect(() => {
    console.log('🔄 useEffect触发 - 游戏阶段:', gameState?.gamePhase, '手牌长度:', myCards.length, '我的位置:', myPosition);
    if (gameState?.gamePhase === 'sticking' && myCards.length > 0 && myPosition !== -1) {
      console.log('🔄 游戏状态变化，重新计算粘主选项');
      const options = calculateStickOptions(myCards, gameState);
      setStickOptions(options);
    }
  }, [gameState?.gamePhase, myCards, myPosition]);


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


      // 处理发牌开始事件
      socketService.on('dealingStarted', (data) => {
        console.log('🎴 发牌开始:', data);
        setGameState(data.gameState);
        setGameMessage('🎴 发牌开始，可以开始选择亮主牌');
        setWaitingNext(false);
        setNextReadyCount(0);
      }, 'PokerTable');

      // 处理逐张发牌动画
      socketService.on('cardDealt', (data) => {
        console.log('🃏 收到单张发牌事件:', data);
        const { toPlayer, totalDealt, totalCards, playerCardIndex, totalPlayerCards } = data;
        
        // 显示整体发牌进度
        setGameMessage(`🎴 发牌中... 第${totalDealt}/${totalCards}张`);
        
        // TODO: 添加发牌动画效果
      }, 'PokerTable');

      // 处理收到的牌
      socketService.on('cardReceived', (data) => {
        console.log('🃏 收到我的牌:', data);
        const { card, totalReceived, totalPlayerCards } = data;
        
        // 逐张添加到手牌
        setMyCards(prev => {
          const newCards = sortCards([...prev, card], gameState?.currentLevel || 2, gameState?.trumpSuit);
          // 维持基于ID的选择
          setSelectedCardIds(sel => sel.filter(id => newCards.some(c => c.id === id)));
          return newCards;
        });
        
        // 个人收牌记录（不更新主要进度消息，避免与全局进度冲突）
        console.log(`👤 个人收牌进度: ${totalReceived}/${totalPlayerCards}`);
        
        // 不在这里显示发牌完成，等待 cardsDealt 事件统一处理
      }, 'PokerTable');

      // 处理最终发牌完成（兼容旧版本）
      socketService.on('cardsDealt', (data) => {
        console.log('🃏 收到发牌完成事件:', data);
        const { cards, playerPosition, gameState, dealingComplete } = data;
        
        if (dealingComplete) {
          // 确保手牌完整（防止网络丢包）
          const sorted = sortCards(cards, gameState?.currentLevel || 2, gameState?.trumpSuit);
          setMyCards(sorted);
          setMyPosition(playerPosition);
          setGameState(gameState);
          // 不显示"发牌完成"消息，避免与"发牌结束"消息冗余
          setSelectedCardIds(prev => prev.filter(id => sorted.some(c => c.id === id)));
          
          // 不在这里启动倒计时，等待 biddingStarted 事件统一处理
        }
      }, 'PokerTable');

      // 监听发牌完成/叫主开始事件
      socketService.on('biddingStarted', (data) => {
        console.log('🎺 发牌完成，叫主阶段开始:', data);
        setGameState(data.gameState);
        setWaitingNext(false);
        setNextReadyCount(0);
        
        // 根据游戏状态显示不同的消息
        if (data.gameState.trumpSuit) {
          // 已有人亮主，进入反主阶段
          setGameMessage('📋 发牌结束！进入反主阶段');
        } else {
          // 无人亮主，可以开始亮主
          setGameMessage('📋 发牌结束！可以开始亮主');
        }
        
        // 如果已经有人亮主，启动反主倒计时
        if (data.gameState.trumpSuit && data.gameState.counterTrumpEndTime) {
          const now = Date.now();
          const timeLeft = Math.max(0, Math.ceil((data.gameState.counterTrumpEndTime - now) / 1000));
          if (timeLeft > 0) {
            setCounterTrumpCountdown(timeLeft);
            const countdownInterval = setInterval(() => {
              setCounterTrumpCountdown(prev => {
                if (prev <= 1) {
                  clearInterval(countdownInterval);
                  setGameMessage('⏰ 反主时间结束，游戏继续');
                  return null;
                }
                return prev - 1;
              });
            }, 1000);
          }
        } else if (!data.gameState.trumpSuit && data.declareEndTime) {
          // 如果没有人亮主，启动亮主倒计时
          const now = Date.now();
          const timeLeft = Math.max(0, Math.ceil((data.declareEndTime - now) / 1000));
          if (timeLeft > 0) {
            setTrumpCountdown(timeLeft);
            const countdownInterval = setInterval(() => {
              setTrumpCountdown(prev => {
                if (prev <= 1) {
                  clearInterval(countdownInterval);
                  // 不在前端显示时间结束消息，等待服务器权威通知
                  return null;
                }
                return prev - 1;
              });
            }, 1000);
          }
        }
      }, 'PokerTable');

      socketService.on('trumpDeclared', (data) => {
        console.log('🎺 收到亮主事件:', data);
        setGameMessage(`🎺 ${data.playerName} 亮主: ${data.trumpSuit}`);
        setGameState(data.gameState);
        setTrumpCountdown(null); // 清除倒计时
        
        // 启动反主倒计时
        if (data.counterTrumpEndTime) {
          const now = Date.now();
          const timeLeft = Math.max(0, Math.ceil((data.counterTrumpEndTime - now) / 1000));
          if (timeLeft > 0) {
            setCounterTrumpCountdown(timeLeft);
            const countdownInterval = setInterval(() => {
              setCounterTrumpCountdown(prev => {
                if (prev <= 1) {
                  clearInterval(countdownInterval);
                  setGameMessage('⏰ 反主时间结束，游戏继续');
                  return null;
                }
                return prev - 1;
              });
            }, 1000);
          }
        }
        
        // 重新排序手牌（根据主牌）
        if (myCards.length > 0) {
          setMyCards(prev => {
            const currentLevel = data.gameState?.currentLevel || gameState?.currentLevel || 2;
            const sorted = sortCards(prev, currentLevel, data.trumpSuit);
            setSelectedCardIds(sel => sel.filter(id => sorted.some(c => c.id === id)));
            return sorted;
          });
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
          
          // 如果是轮次结束，显示等待信息
          if (newPlayed.length === 4) {
            setGameMessage('🎯 轮次完成，正在判定获胜者...');
          }
          
          return newPlayed;
        });
      }, 'PokerTable');

      socketService.on('roundComplete', (data) => {
        console.log('🏆 收到轮次结束事件:', data);
        setGameMessage(`🏆 ${data.winnerName} 获胜！`);
        setGameState(data.gameState);
      }, 'PokerTable');

      socketService.on('newRoundStarted', (data) => {
        console.log('🔄 新轮次开始:', data);
        setGameMessage(`🔄 新轮次开始，${data.currentTurn === myPosition ? '你' : `玩家${data.currentTurn + 1}`}先出牌`);
        setPlayedCards([]); // 清空桌面
        setGameState(data.gameState);
        setWaitingNext(false);
        setNextReadyCount(0);
      }, 'PokerTable');

      // 本局游戏结束
      socketService.on('gameFinished', (data) => {
        console.log('🎉 收到本局结束事件:', data);
        const fr = data.finalResult;
        const desc = fr?.description || '本局结束';
        const levelInfo = fr?.newLevel ? ` 新级别：${fr.newLevel}` : '';
        setGameMessage(`🎉 ${desc}${levelInfo}`);
        setGameState(data.gameState);
        setPlayedCards([]);
        setSelectedCardIds([]);
      }, 'PokerTable');

      // 进入“等待下一局”阶段
      socketService.on('readyForNextGame', (data) => {
        console.log('⏸ 等待下一局，就绪请求:', data);
        setGameMessage('⏸ 本局结束，等待所有玩家点击“开始下一局”');
        setNextReadyCount(0);
        setWaitingNext(true);
      }, 'PokerTable');

      // 就绪进度
      socketService.on('nextGameReadyProgress', ({ count }) => {
        setNextReadyCount(count || 0);
      }, 'PokerTable');

      // 被拒绝开始（人数不足或错误）
      socketService.on('startNextGameRejected', ({ reason }) => {
        setGameMessage(`⚠️ 无法开始下一局：${reason}`);
      }, 'PokerTable');

      socketService.on('handUpdated', (data) => {
        console.log('✋ 手牌更新:', data);
        console.log('✋ 更新前手牌数量:', myCards.length, '更新后手牌数量:', data.cards?.length);
        console.log('✋ 当前游戏状态:', data.gameState);
        
        // 先更新游戏状态，再排序手牌
        setGameState(data.gameState);
        
        // 使用最新的游戏状态进行排序
        const currentLevel = data.gameState?.currentLevel || gameState?.currentLevel || 2;
        const trumpSuit = data.gameState?.trumpSuit || gameState?.trumpSuit;
        
        console.log('✋ 排序参数:', { currentLevel, trumpSuit });
        console.log('✋ 原始手牌前5张:', data.cards?.slice(0, 5));
        
        // 确保cards是有效的数组
        if (!data.cards || !Array.isArray(data.cards)) {
          console.error('❌ 手牌数据无效:', data.cards);
          return;
        }
        
        const sorted = sortCards(data.cards, currentLevel, trumpSuit);
        console.log('✋ 排序后手牌:', sorted.length, '张');
        console.log('✋ 排序后前5张:', sorted.slice(0, 5));
        setMyCards(sorted);
        setSelectedCardIds(prev => prev.filter(id => sorted.some(c => c.id === id)));
        
        // 如果在粘主阶段，重新计算粘主选项
        if (data.gameState?.gamePhase === 'sticking') {
          setTimeout(() => {
            console.log('🔄 手牌更新，重新计算粘主选项');
            console.log('🔄 当前myPosition:', myPosition, '手牌长度:', sorted.length);
            const options = calculateStickOptions(sorted, data.gameState);
            setStickOptions(options);
          }, 200);
        }
      }, 'PokerTable');

      socketService.on('trumpError', (error) => {
        console.log('❌ 亮主错误:', error);
        setGameMessage(`❌ 亮主失败: ${error}`);
      }, 'PokerTable');

      socketService.on('biddingTimeout', (data) => {
        console.log('⏰ 亮主时间结束:', data);
        setGameMessage('⏰ 亮主时间结束，游戏结束（待修改）');
        setGameState(data.gameState);
        setTrumpCountdown(null);
      }, 'PokerTable');

      // 处理反主事件
      socketService.on('counterTrumpDeclared', (data) => {
        console.log('🔄 收到反主事件:', data);
        setGameMessage(`🔄 ${data.playerName} 反主成功: 一对${data.counterTrumpRank === 'big' ? '大王' : '小王'} + 一对${data.counterTrumpPair}`);
        setGameState(data.gameState);
        setCounterTrumpCountdown(null); // 清除反主倒计时
      }, 'PokerTable');

      socketService.on('counterTrumpError', (error) => {
        console.log('❌ 反主错误:', error);
        setGameMessage(`❌ 反主失败: ${error}`);
      }, 'PokerTable');

      // 监听粘主阶段开始
      socketService.on('stickingStarted', (data) => {
        console.log('📌 粘主阶段开始:', data);
        setGameMessage('📌 粘主阶段开始，有王连对的玩家可以粘主');
        setGameState(data.gameState);
        setStickCountdown(10);
        setStickOptions([]);
        setStickExchange(null);
        setSelectedExchangeCards([]);
        
        // 延迟计算可粘主的牌型选项，确保状态已更新
        setTimeout(() => {
          console.log('🔍 延迟计算粘主选项，当前手牌长度:', myCards.length);
          console.log('🔍 当前手牌:', myCards);
          console.log('🔍 游戏状态:', data.gameState);
          console.log('🔍 我的位置:', myPosition);
          
          // 如果手牌为空或位置未设置，跳过计算
          if (myCards.length === 0 || myPosition === -1) {
            console.log('❌ 手牌为空或位置未设置，跳过粘主选项计算');
            return;
          }
          
          const options = calculateStickOptions(myCards, data.gameState);
          console.log('🔍 计算出的粘主选项:', options);
          setStickOptions(options);
        }, 500);
        
        // 启动粘主倒计时
        const countdownInterval = setInterval(() => {
          setStickCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              setGameMessage('⏰ 粘主时间结束，等待摸底玩家选择扣底牌');
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }, 'PokerTable');

      // 监听粘主成功
      socketService.on('trumpSticked', (data) => {
        console.log('📌 粘主成功:', data);
        setGameMessage(`📌 ${data.playerName} 粘主成功！`);
        setGameState(data.gameState);
        setStickCountdown(null);
        setStickOptions([]);
        setStickExchange(null);
        setSelectedExchangeCards([]);
        setSelectedCardIds([]); // 清空选中的牌
      }, 'PokerTable');

      socketService.on('stickTrumpError', (error) => {
        console.log('❌ 粘主错误:', error);
        setGameMessage(`❌ 粘主失败: ${error}`);
      }, 'PokerTable');

      // 监听粘主倒计时停止
      socketService.on('stickingCountdownStopped', (data) => {
        console.log('📌 粘主倒计时停止:', data);
        setGameMessage(data.message);
        // 不更新游戏状态，保持当前的粘主交换界面
      }, 'PokerTable');

      // 监听游戏阶段变化
      socketService.on('gamePhaseChanged', (data) => {
        console.log('🔄 游戏阶段变化:', data);
        setGameState(data.gameState);
        if (data.phase === 'playing') {
          setStickCountdown(null);
          setStickOptions([]);
          setStickExchange(null);
          setSelectedExchangeCards([]);
          setSelectedCardIds([]);
        }
      }, 'PokerTable');

      socketService.on('playError', (error) => {
        console.log('❌ 出牌错误:', error);
        setGameMessage(`❌ 出牌失败: ${error}`);
      }, 'PokerTable');

      // 监听摸底阶段开始
      socketService.on('bottomPhaseStarted', (data) => {
        console.log('🃏 摸底阶段开始:', data);
        setGameState(data.gameState);
        const bottomPlayerName = data.bottomPlayerName || `玩家${data.bottomPlayer + 1}`;
        
        // 根据是否是摸底玩家显示不同信息
        if (myPosition === data.bottomPlayer) {
          setGameMessage(`🃏 摸底阶段开始，请选择4张牌扣底`);
        } else {
          setGameMessage(`🃏 摸底阶段开始，等待 ${bottomPlayerName} 摸底`);
        }
        
        // 清除粘主相关状态
        setStickCountdown(null);
        setStickOptions([]);
        setStickExchange(null);
        setSelectedExchangeCards([]);
      }, 'PokerTable');

      // 监听摸底完成
      socketService.on('bottomCardsHandled', (data) => {
        console.log('✅ 摸底完成:', data);
        setGameState(data.gameState);
        setGameMessage(`✅ ${data.playerName} 摸底完成，进入出牌阶段`);
        setSelectedCardIds([]); // 清空选中的牌
      }, 'PokerTable');

      // 监听摸底错误
      socketService.on('bottomCardsError', (error) => {
        console.log('❌ 摸底错误:', error);
        setGameMessage(`❌ 摸底失败: ${error}`);
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
  const toggleCardSelection = (cardId) => {
    // 如果在粘主交换模式
    if (stickExchange) {
      if (selectedExchangeCards.includes(cardId)) {
        setSelectedExchangeCards(prev => prev.filter(id => id !== cardId));
      } else if (selectedExchangeCards.length < 3) {
        setSelectedExchangeCards(prev => [...prev, cardId]);
      }
      return;
    }
    
    setSelectedCardIds(prev => {
      const newSelection = prev.includes(cardId) 
        ? prev.filter(i => i !== cardId)
        : [...prev, cardId];
      
      // 实时验证选择的牌
      if (newSelection.length > 0) {
        // 检查是否在反主阶段
        if (gameState?.trumpPlayer !== null && gameState?.trumpPlayer !== undefined && 
            (gameState?.counterTrumpEndTime && Date.now() <= gameState.counterTrumpEndTime) &&
            (gameState?.counterTrumpPlayer === null || gameState?.counterTrumpPlayer === undefined)) {
          // 反主阶段
          const validation = validateCounterTrumpCards(newSelection);
          if (newSelection.length === 4) {
            setGameMessage(validation.valid 
              ? `✅ ${validation.message}` 
              : `❌ ${validation.message}`
            );
          } else if (newSelection.length > 4) {
            setGameMessage('❌ 反主最多只能选择4张牌');
          } else {
            // 不显示牌型要求提示，保持当前的发牌进度消息
          }
        } else if (gameState?.gamePhase === 'bidding' || gameState?.gamePhase === 'dealing' || trumpCountdown !== null) {
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
            // 不显示牌型要求提示，保持当前的发牌进度消息
          }
        } else if (gameState?.gamePhase === 'playing') {
          // 出牌阶段
          const validation = validatePlayCards(newSelection);
          setGameMessage(validation.valid 
            ? `✅ ${validation.cardType.message}` 
            : `🔄 已选择${newSelection.length}张牌`
          );
        } else if (gameState?.gamePhase === 'bottom') {
          // 摸底阶段
          if (myPosition === gameState?.bottomPlayer) {
            if (newSelection.length === 4) {
              setGameMessage('✅ 可以确认摸底');
            } else if (newSelection.length > 4) {
              setGameMessage('❌ 摸底最多只能选择4张牌');
            } else {
              setGameMessage(`🔄 已选择${newSelection.length}张牌，摸底需要选择4张牌`);
            }
          } else {
            setGameMessage('❌ 只有摸底玩家可以选择牌');
          }
        }
      }
      
      return newSelection;
    });
  };

  // 验证亮主牌型(一王带一对)
  const validateTrumpCards = (selectedIds) => {
    // 检查是否已经有人亮主
    if (gameState?.trumpPlayer !== null && gameState?.trumpPlayer !== undefined) {
      return { valid: false, message: '已经有人亮主了' };
    }
    
    if (selectedIds.length !== 3) {
      return { valid: false, message: '亮主需要选择3张牌(一王带一对)' };
    }

    const idSet = new Set(selectedIds);
    const selectedCardObjects = myCards.filter(c => idSet.has(c.id));
    
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

  // 验证反主牌型(一对王+一对牌)
  const validateCounterTrumpCards = (selectedIds) => {
    // 检查是否在反主时间窗口内：若没有下发截止时间（发牌中亮主的过渡期），允许；若有并已过期，则禁止
    if (gameState?.counterTrumpEndTime && Date.now() > gameState.counterTrumpEndTime) {
      return { valid: false, message: '反主时间已过' };
    }
    // 检查是否已经有人反主
    if (gameState?.counterTrumpPlayer !== null && gameState?.counterTrumpPlayer !== undefined) {
      return { valid: false, message: '已经有人反主了' };
    }
    
    if (selectedIds.length !== 4) {
      return { valid: false, message: '反主需要选择4张牌（一对王+一对牌）' };
    }

    const idSet = new Set(selectedIds);
    const selectedCardObjects = myCards.filter(c => idSet.has(c.id));
    
    // 检查是否有王牌和普通牌
    const jokers = selectedCardObjects.filter(card => card && card.suit === 'joker');
    const normalCards = selectedCardObjects.filter(card => card && card.suit !== 'joker');

    if (jokers.length !== 2) {
      return { valid: false, message: '反主必须包含一对王牌' };
    }

    if (normalCards.length !== 2) {
      return { valid: false, message: '反主必须包含一对普通牌' };
    }

    // 检查王牌是否是一对（相同等级的王）
    const [joker1, joker2] = jokers;
    if (joker1.rank !== joker2.rank) {
      return { valid: false, message: '王牌必须是一对相同的王' };
    }

    // 检查普通牌是否是一对（相同点数）
    const [normal1, normal2] = normalCards;
    if (normal1.rank !== normal2.rank) {
      return { valid: false, message: '普通牌必须是一对（相同点数）' };
    }

    return { 
      valid: true, 
      message: `可以反主: 一对${joker1.rank === 'big' ? '大王' : '小王'} + 一对${normal1.rank}`,
      counterTrumpRank: joker1.rank,
      counterTrumpPair: normal1.rank
    };
  };

  // 反主操作
  const handleCounterTrump = () => {
    console.log('🔄 前端反主请求:', {
      selectedCardIds,
      myCards: myCards.length,
      gameState: gameState?.gamePhase,
      myPosition,
      roomId
    });
    
    const validation = validateCounterTrumpCards(selectedCardIds);
    
    if (!validation.valid) {
      setGameMessage(`❌ ${validation.message}`);
      return;
    }

    // 不显示瞬时的"准备反主"消息，避免消息闪烁

    const idSet = new Set(selectedCardIds);
    const selectedCardObjects = myCards.filter(c => idSet.has(c.id));
    console.log('🔄 发送反主请求:', {
      roomId: roomId,
      cards: selectedCardObjects
    });
    
    socketService.emit('counterTrump', {
      roomId: roomId,
      cards: selectedCardObjects
    });
    setSelectedCardIds([]);
  };

  // 亮主操作
  const handleDeclareTrump = () => {
    console.log('🎺 前端亮主请求:', {
      selectedCardIds,
      myCards: myCards.length,
      gameState: gameState?.gamePhase,
      myPosition,
      roomId
    });
    
    const validation = validateTrumpCards(selectedCardIds);
    
    if (!validation.valid) {
      setGameMessage(`❌ ${validation.message}`);
      return;
    }

    // 不显示瞬时的"准备亮主"消息，避免消息闪烁

    const idSet = new Set(selectedCardIds);
    const selectedCardObjects = myCards.filter(c => idSet.has(c.id));
    console.log('🎺 发送亮主请求:', {
      roomId: roomId,
      cards: selectedCardObjects
    });
    
    socketService.emit('declareTrump', {
      roomId: roomId,
      cards: selectedCardObjects
    });
    setSelectedCardIds([]);
  };

  // 验证并识别出牌牌型
  const validatePlayCards = (selectedIds) => {
    if (selectedIds.length === 0) {
      return { valid: false, message: '请选择要出的牌' };
    }

    const idSet = new Set(selectedIds);
    const selectedCardObjects = myCards.filter(c => idSet.has(c.id));
    const rawType = identifyCardType(
      selectedCardObjects,
      gameState?.currentLevel || 2,
      gameState?.trumpSuit
    );

    // 如果是跟牌场景，优先用“跟牌规则”判断是否允许垫牌
    if (playedCards.length > 0) {
      const followValidation = validateFollowCards(
        selectedCardObjects,
        playedCards[0], // 领出牌
        myCards,
        gameState?.currentLevel || 2,
        gameState?.trumpSuit
      );

      if (!followValidation.valid) {
        return {
          valid: false,
          cardType: rawType,
          message: followValidation.message
        };
      }

      // 跟牌校验通过：允许“无牌可跟时的垫牌”，不因牌型未知而拦截
      const safeType = rawType.type === 'invalid'
        ? { type: 'follow', name: '跟牌', cards: selectedCardObjects, message: '跟牌' }
        : rawType;

      return {
        valid: true,
        cardType: safeType,
        message: safeType.message
      };
    }

    // 首家出牌仍需要是有效牌型
    if (rawType.type === 'invalid') {
      return {
        valid: false,
        cardType: rawType,
        message: rawType.message
      };
    }

    return {
      valid: true,
      cardType: rawType,
      message: rawType.message
    };
  };

  // 出牌操作
  const handlePlayCards = () => {
    const validation = validatePlayCards(selectedCardIds);
    
    if (!validation.valid) {
      setGameMessage(`❌ ${validation.message}`);
      return;
    }

    // 不显示瞬时的"准备出牌"消息，避免消息闪烁

    // 直接发送牌的ID，而不是索引
    socketService.emit('playCards', {
      roomId: roomId,
      cardIds: selectedCardIds
    });
    setSelectedCardIds([]);
  };

  // 计算可粘主的牌型选项
  const calculateStickOptions = (cards, gameState) => {
    console.log('🔍 计算粘主选项 - 游戏阶段:', gameState?.gamePhase, '我的位置:', myPosition);
    console.log('🔍 我的手牌:', cards);
    
    if (!gameState || gameState.gamePhase !== 'sticking') {
      console.log('❌ 不在粘主阶段');
      return [];
    }
    
    // 检查是否可以粘主（不是叫主者或反主者）
    const forbiddenPlayer = gameState.counterTrumpPlayer !== null ? gameState.counterTrumpPlayer : gameState.firstTrumpPlayer;
    console.log('🔍 禁止粘主的玩家:', forbiddenPlayer, '我的位置:', myPosition);
    
    if (myPosition === forbiddenPlayer) {
      console.log('❌ 我是叫主者或反主者，不能粘主');
      return [];
    }
    
    const options = [];
    
    // 查找所有王
    const jokers = cards.filter(c => c.suit === 'joker');
    console.log('🔍 找到的王:', jokers);
    
    // 查找所有连对（同花色相邻点数）
    const pairsBySuit = {};
    cards.forEach(card => {
      if (card.suit !== 'joker') {
        if (!pairsBySuit[card.suit]) pairsBySuit[card.suit] = {};
        if (!pairsBySuit[card.suit][card.rank]) pairsBySuit[card.suit][card.rank] = [];
        pairsBySuit[card.suit][card.rank].push(card);
      }
    });
    
    console.log('🔍 按花色分组的对子:', pairsBySuit);
    
    // 为每个王和每个花色的连对组合创建选项
    jokers.forEach(joker => {
      Object.keys(pairsBySuit).forEach(suit => {
        const ranks = Object.keys(pairsBySuit[suit]).filter(rank => pairsBySuit[suit][rank].length >= 2);
        console.log(`🔍 ${suit}花色的对子:`, ranks);
        
        // 查找相邻的连对
        for (let i = 0; i < ranks.length - 1; i++) {
          const rank1 = ranks[i];
          const rank2 = ranks[i + 1];
          const numeric1 = getNumericRank(rank1);
          const numeric2 = getNumericRank(rank2);
          
          console.log(`🔍 检查连对: ${rank1}(${numeric1}) 和 ${rank2}(${numeric2}), 差值: ${Math.abs(numeric1 - numeric2)}`);
          
          if (Math.abs(numeric1 - numeric2) === 1) {
            const pair1 = pairsBySuit[suit][rank1].slice(0, 2);
            const pair2 = pairsBySuit[suit][rank2].slice(0, 2);
            
            const option = {
              joker: joker,
              pairs: [...pair1, ...pair2],
              suit: suit,
              ranks: [rank1, rank2],
              displayName: `${joker.rank === 'big' ? '大王' : '小王'}${suit}${rank1}${rank2}`
            };
            
            console.log('✅ 找到粘主选项:', option);
            options.push(option);
          }
        }
      });
    });
    
    console.log('🔍 最终粘主选项:', options);
    return options;
  };

  // 获取牌的数字值用于排序
  const getNumericRank = (rank) => {
    const map = { 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    return typeof rank === 'number' ? rank : map[rank] || 0;
  };

  // 处理粘主按钮点击
  const handleStickTrump = (option) => {
    console.log('🎯 点击粘主按钮:', option);
    
    // 先发送开始粘主请求，停止后端倒计时
    socketService.emit('startSticking', {
      roomId: roomId
    });
    
    const exchangeData = {
      option: option,
      declarerCards: [] // 这里需要从服务器获取原叫主者的牌
    };
    console.log('🎯 设置粘主交换数据:', exchangeData);
    
    setStickExchange(exchangeData);
    setSelectedExchangeCards([]);
    setStickCountdown(null); // 停止前端倒计时显示
    setStickOptions([]); // 隐藏粘主按钮
    setGameMessage(`📌 请选择3张交换牌：1张级/常主 + 2张${option.suit}花色牌`);
    
    console.log('🎯 粘主交换状态已设置:', {
      stickExchange: exchangeData,
      selectedExchangeCards: [],
      gameMessage: `📌 请选择3张交换牌：1张级/常主 + 2张${option.suit}花色牌`
    });
  };

  // 验证粘主交换牌
  const validateStickExchangeCards = (selectedIds) => {
    if (!stickExchange || selectedIds.length !== 3) {
      return { valid: false, message: '需要选择3张牌' };
    }
    
    const { option } = stickExchange;
    const selectedCards = myCards.filter(card => selectedIds.includes(card.id));
    
    console.log('🔍 验证粘主交换牌:', {
      selectedCards: selectedCards.map(c => `${c.suit}_${c.rank}`),
      gameState: gameState,
      currentLevel: gameState?.currentLevel,
      trumpSuit: gameState?.trumpSuit
    });
    
    // 验证交换牌：1张级牌或常主 + 2张与原叫主者对子同花色的牌
    const levelOrPermanent = selectedCards.filter(card => 
      card.suit !== 'joker' && ([2, 3, 5].includes(card.rank) || card.rank === gameState?.currentLevel)
    );
    
    // 原叫主者的主牌花色（玩家0用红桃7叫主，所以需要红桃牌）
    const originalTrumpSuit = gameState?.trumpSuit; // 应该是hearts
    const sameSuitAsOriginalTrump = selectedCards.filter(card => card.suit === originalTrumpSuit);
    
    console.log('🔍 验证结果:', {
      levelOrPermanent: levelOrPermanent.length,
      originalTrumpSuit,
      sameSuitAsOriginalTrump: sameSuitAsOriginalTrump.length,
      levelOrPermanentCards: levelOrPermanent.map(c => `${c.suit}_${c.rank}`),
      sameSuitCards: sameSuitAsOriginalTrump.map(c => `${c.suit}_${c.rank}`)
    });
    
    if (levelOrPermanent.length !== 1) {
      return { valid: false, message: '需要1张级牌或常主' };
    }
    
    if (sameSuitAsOriginalTrump.length !== 2) {
      return { valid: false, message: `需要2张${originalTrumpSuit}花色牌` };
    }
    
    return { valid: true, message: '交换牌有效' };
  };

  // 处理粘主交换
  const handleStickExchange = () => {
    if (selectedExchangeCards.length !== 3) {
      return;
    }
    
    const validation = validateStickExchangeCards(selectedExchangeCards);
    if (!validation.valid) {
      setGameMessage(`❌ ${validation.message}`);
      return;
    }
    
    const { option } = stickExchange;
    const stickCards = [option.joker, ...option.pairs];
    // 将选中的交换牌ID转换为完整的牌对象
    const giveBackCards = selectedExchangeCards.map(cardId => 
      myCards.find(card => card.id === cardId)
    ).filter(card => card !== undefined);
    
    console.log('🎯 发送粘主请求:', {
      selectedExchangeCardIds: selectedExchangeCards,
      giveBackCards: giveBackCards.map(c => `${c.suit}_${c.rank}_${c.deckNumber}`),
      stickCards: stickCards.map(c => `${c.suit}_${c.rank}_${c.deckNumber}`),
      myCardsCount: myCards.length
    });
    
    socketService.emit('stickTrump', {
      roomId: roomId,
      stickCards: stickCards,
      giveBackCards: giveBackCards
    });
    
    setStickExchange(null);
    setSelectedExchangeCards([]);
  };

  // 摸底操作
  const handleBottomCards = () => {
    if (selectedCardIds.length !== 4) {
      setGameMessage('❌ 必须选择4张牌扣底');
      return;
    }

    if (gameState?.gamePhase !== 'bottom') {
      setGameMessage('❌ 不在摸底阶段');
      return;
    }

    if (myPosition !== gameState?.bottomPlayer) {
      setGameMessage('❌ 只有摸底玩家可以进行摸底');
      return;
    }

    console.log('🃏 发送摸底请求:', {
      selectedCardIds,
      myCardsCount: myCards.length
    });

    socketService.emit('handleBottomCards', {
      roomId: roomId,
      selectedCardIds: selectedCardIds
    });

    setSelectedCardIds([]);
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

    // 发牌阶段
    if (gameState.gamePhase === 'dealing') {
      if (gameState.trumpPlayer !== null && gameState.trumpPlayer !== undefined) {
        return '发牌阶段-反主阶段';
      } else {
        return '发牌阶段-亮主阶段';
      }
    }
    
    // 发牌结束后
    if (gameState.gamePhase === 'bidding') {
      if (gameState.trumpPlayer !== null && gameState.trumpPlayer !== undefined) {
        return '反主阶段';
      } else {
        return '亮主阶段';
      }
    }
    
    // 其他阶段
    switch (gameState.gamePhase) {
      case 'countering': return '反主阶段';
      case 'sticking': return '粘主阶段';
      case 'bottom': return '摸底阶段';
      case 'playing': return '出牌阶段';
      case 'finished': return '游戏结束';
      default: return '未知阶段';
    }
  };

  // 判断当前玩家是否是闲家
  const isIdlePlayer = () => {
    if (!gameState || gameState.trumpPlayer === null || gameState.trumpPlayer === undefined) {
      return false;
    }
    
    // 庄家队伍：亮主玩家 % 2
    const trumpTeam = gameState.trumpPlayer % 2;
    // 闲家队伍：1 - trumpTeam
    const idleTeam = 1 - trumpTeam;
    
    // 当前玩家所在队伍：myPosition % 2
    const myTeam = myPosition % 2;
    
    // 如果我的队伍和闲家队伍相同，则我是闲家
    return myTeam === idleTeam;
  };

  // 获取当前回合显示文本
  const getCurrentTurnText = () => {
    if (!gameState) return null;
    
    // 亮主阶段：所有玩家都可以操作
    if ((gameState.gamePhase === 'dealing' || gameState.gamePhase === 'bidding') && 
        (gameState.trumpPlayer === null || gameState.trumpPlayer === undefined)) {
      return '你可以操作';
    }
    
    // 反主阶段：除了亮主的玩家，其他玩家可以操作
    if ((gameState.gamePhase === 'dealing' || gameState.gamePhase === 'bidding' || gameState.gamePhase === 'countering') &&
        (gameState.trumpPlayer !== null && gameState.trumpPlayer !== undefined) &&
        (gameState.counterTrumpPlayer === null || gameState.counterTrumpPlayer === undefined)) {
      // 如果我是亮主者，显示"等待其他玩家反主"
      if (myPosition === gameState.firstTrumpPlayer) {
        return '等待其他玩家反主';
      }
      return '你可以操作';
    }
    
    // 粘主阶段：除了叫主者或反主者，其他玩家可以操作
    if (gameState.gamePhase === 'sticking') {
      const forbiddenPlayer = gameState.counterTrumpPlayer !== null ? gameState.counterTrumpPlayer : gameState.firstTrumpPlayer;
      if (myPosition === forbiddenPlayer) {
        return '等待其他玩家粘主';
      }
      return '你可以操作';
    }
    
    // 摸底阶段：显示摸底玩家
    if (gameState.gamePhase === 'bottom') {
      if (gameState.bottomPlayer !== null && gameState.bottomPlayer !== undefined) {
        return `玩家${gameState.bottomPlayer + 1}${gameState.bottomPlayer === myPosition ? '（你）' : ''}`;
      }
    }
    
    // 出牌阶段：显示当前回合玩家
    if (gameState.gamePhase === 'playing') {
      if (gameState.currentTurn !== undefined) {
        return `玩家${gameState.currentTurn + 1}${gameState.currentTurn === myPosition ? '（你）' : ''}`;
      }
    }
    
    return null;
  };

  // 判断某个玩家是否应该显示🎯图标（可以操作）
  const shouldShowTurnIndicator = (playerIndex) => {
    if (!gameState || playerIndex === undefined) return false;
    
    // 亮主阶段：所有玩家都显示🎯
    if ((gameState.gamePhase === 'dealing' || gameState.gamePhase === 'bidding') && 
        (gameState.trumpPlayer === null || gameState.trumpPlayer === undefined)) {
      return true;
    }
    
    // 反主阶段：除了亮主者，其他玩家显示🎯
    if ((gameState.gamePhase === 'dealing' || gameState.gamePhase === 'bidding' || gameState.gamePhase === 'countering') &&
        (gameState.trumpPlayer !== null && gameState.trumpPlayer !== undefined) &&
        (gameState.counterTrumpPlayer === null || gameState.counterTrumpPlayer === undefined)) {
      return playerIndex !== gameState.firstTrumpPlayer;
    }
    
    // 粘主阶段：除了叫主者/反主者，其他玩家显示🎯
    if (gameState.gamePhase === 'sticking') {
      const forbiddenPlayer = gameState.counterTrumpPlayer !== null ? gameState.counterTrumpPlayer : gameState.firstTrumpPlayer;
      return playerIndex !== forbiddenPlayer;
    }
    
    // 摸底阶段：只有摸底玩家显示🎯
    if (gameState.gamePhase === 'bottom') {
      return gameState.bottomPlayer === playerIndex;
    }
    
    // 出牌阶段：只有当前回合玩家显示🎯
    if (gameState.gamePhase === 'playing') {
      return gameState.currentTurn === playerIndex;
    }
    
    return false;
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
              {gameState?.trumpPlayer !== null && gameState?.trumpPlayer !== undefined && (
                <span className="trump-player-info">
                  🎺 亮主玩家: {room?.players?.[gameState.trumpPlayer]?.name || `玩家${gameState.trumpPlayer + 1}`}
                  {gameState.trumpRank && ` (${gameState.trumpRank})`}
                </span>
              )}
               {gameState?.idleScore !== undefined && (
                 <span className="idle-score-info">
                   💰 闲家得分{isIdlePlayer() ? '（你）' : ''}: {gameState.idleScore}
                 </span>
               )}
              {trumpCountdown !== null && gameState?.gamePhase === 'bidding' && (
                <span className="countdown-info">
                  ⏰ 亮主倒计时: {trumpCountdown}秒
                </span>
              )}
              {counterTrumpCountdown !== null && gameState?.gamePhase === 'countering' && (
                <span className="countdown-info">
                  🔄 反主倒计时: {counterTrumpCountdown}秒
                </span>
              )}
              {stickCountdown !== null && gameState?.gamePhase === 'sticking' && (
                <span className="countdown-info">
                  📌 粘主倒计时: {stickCountdown}秒
                </span>
              )}
               {getCurrentTurnText() && (
                 <span className="turn-info">
                   当前回合: {getCurrentTurnText()}
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
                   {shouldShowTurnIndicator(playerIndex) && (
                     <span className="current-turn-indicator">🎯</span>
                   )}
                 </div>
                <HandCards
                  cards={cardBacks}
                  selectedCards={[]}
                  onCardClick={() => {}} // 其他玩家的牌不可点击
                  isMyTurn={false}
                  position={position}
                  canSelect={false} // 其他玩家不能选牌
                />
              </div>
            );
          })}



          {/* 我的手牌区域 */}
          <div className="my-hand-area">
            <div className="hand-controls">
              {/* 粘主选项按钮 */}
              {stickOptions.length > 0 && !stickExchange && gameState?.gamePhase === 'sticking' && (
                <div className="stick-options-inline">
                  {stickOptions.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleStickTrump(option)}
                      className="btn btn-primary"
                    >
                      {option.displayName}
                    </button>
                  ))}
                </div>
              )}

              {/* 粘主交换状态显示 */}
              {stickExchange && (
                <div className="stick-exchange-info" style={{ backgroundColor: '#e3f2fd', padding: '10px', margin: '10px 0', borderRadius: '5px' }}>
                  <h4>🔄 粘主交换模式</h4>
                  <p>请选择3张交换牌：1张级牌或常主 + 2张{gameState?.trumpSuit === 'hearts' ? '红桃' : gameState?.trumpSuit}牌</p>
                  <p>当前已选择：{selectedExchangeCards.length}/3 张</p>
                </div>
              )}

              {(selectedCardIds.length > 0 || (stickExchange && selectedExchangeCards.length > 0)) && (
                <div className="action-buttons">
                  <span className="selected-count">
                    已选择 {stickExchange ? selectedExchangeCards.length : selectedCardIds.length} 张
                    {stickExchange ? ' (交换牌)' : ''}
                  </span>
                  {/* 亮主按钮 */}
                  {(gameState?.gamePhase === 'bidding' || gameState?.gamePhase === 'dealing' || trumpCountdown !== null) && 
                   (gameState?.trumpPlayer === null || gameState?.trumpPlayer === undefined) && (
                    <button 
                      onClick={() => {
                        console.log('🎺 亮主按钮点击:', {
                          gamePhase: gameState?.gamePhase,
                          trumpCountdown,
                          selectedCards: selectedCardIds.length,
                          myPosition
                        });
                        handleDeclareTrump();
                      }}
                      className={`action-btn trump-btn ${
                        validateTrumpCards(selectedCardIds).valid ? 'valid' : 'invalid'
                      }`}
                      disabled={!validateTrumpCards(selectedCardIds).valid}
                    >
                      {selectedCardIds.length === 3 
                        ? (validateTrumpCards(selectedCardIds).valid ? '✅ 亮主' : '❌ 无效牌型')
                        : '亮主 (一王带一对)'
                      }
                    </button>
                  )}
                  
                  {/* 反主按钮 */}
                  {gameState?.trumpPlayer !== null && gameState?.trumpPlayer !== undefined && 
                   // 若有截止时间则要求未过期；若暂无截止时间(发牌中亮主，待发牌结束确定)，也允许反主
                   ((gameState?.counterTrumpEndTime ? Date.now() <= gameState.counterTrumpEndTime : true)) &&
                   (gameState?.counterTrumpPlayer === null || gameState?.counterTrumpPlayer === undefined) && (
                    <button 
                      onClick={() => {
                        console.log('🔄 反主按钮点击:', {
                          gamePhase: gameState?.gamePhase,
                          counterTrumpEndTime: gameState?.counterTrumpEndTime,
                          selectedCards: selectedCardIds.length,
                          myPosition
                        });
                        handleCounterTrump();
                      }}
                      className={`action-btn counter-trump-btn ${
                        validateCounterTrumpCards(selectedCardIds).valid ? 'valid' : 'invalid'
                      }`}
                      disabled={!validateCounterTrumpCards(selectedCardIds).valid}
                    >
                      {selectedCardIds.length === 4 
                        ? (validateCounterTrumpCards(selectedCardIds).valid ? '✅ 反主' : '❌ 无效牌型')
                        : '反主 (一对王+一对牌)'
                      }
                    </button>
                  )}
                  
                  {/* 粘主确认按钮 */}
                  {/* {console.log('🔍 粘主确认按钮渲染检查:', {
                    stickExchange: stickExchange,
                    selectedExchangeCards: selectedExchangeCards,
                    selectedExchangeCardsLength: selectedExchangeCards.length
                  })} */}
                  {stickExchange && (
                    <button
                      onClick={handleStickExchange}
                      className={`action-btn stick-confirm-btn ${
                        selectedExchangeCards.length === 3 && validateStickExchangeCards(selectedExchangeCards).valid ? 'valid' : 'invalid'
                      }`}
                      disabled={selectedExchangeCards.length !== 3 || !validateStickExchangeCards(selectedExchangeCards).valid}
                      style={{ backgroundColor: '#4CAF50', color: 'white', margin: '5px', padding: '10px' }} // 强制样式确保可见
                    >
                      {selectedExchangeCards.length === 3 
                        ? (validateStickExchangeCards(selectedExchangeCards).valid ? '✅ 确认粘主' : '❌ 无效牌型')
                        : `粘主 (${selectedExchangeCards.length}/3)`
                      }
                    </button>
                  )}
                  
                  {/* 摸底按钮 */}
                  {gameState?.gamePhase === 'bottom' && myPosition === gameState?.bottomPlayer && (
                    <button 
                      onClick={handleBottomCards} 
                      className={`action-btn bottom-btn ${
                        selectedCardIds.length === 4 ? 'valid' : 'invalid'
                      }`}
                      disabled={selectedCardIds.length !== 4}
                    >
                      {selectedCardIds.length === 4 
                        ? '✅ 确认摸底 (扣4张底牌)' 
                        : `摸底 (${selectedCardIds.length}/4)`
                      }
                    </button>
                  )}
                  
                  {gameState?.gamePhase === 'playing' && (
                    <button 
                      onClick={handlePlayCards} 
                      className={`action-btn play-btn ${
                        validatePlayCards(selectedCardIds).valid ? 'valid' : 'invalid'
                      }`}
                      disabled={!validatePlayCards(selectedCardIds).valid}
                    >
                      {selectedCardIds.length > 0 
                        ? (validatePlayCards(selectedCardIds).valid 
                          ? `✅ 出牌 (${validatePlayCards(selectedCardIds).cardType.name})` 
                          : '❌ 无效牌型')
                        : '出牌'
                      }
                    </button>
                  )}
                  <button onClick={() => setSelectedCardIds([])} className="action-btn cancel-btn">
                    取消选择
                  </button>
                </div>
              )}
            </div>

            {/* 使用新的HandCards组件显示我的手牌 */}
            <HandCards
              key={`hand-${myCards.length}-${gameState?.gamePhase || 'none'}`}
              cards={myCards}
              selectedCardIds={stickExchange ? selectedExchangeCards : selectedCardIds}
              onCardClick={toggleCardSelection}
              isMyTurn={gameState?.currentTurn === myPosition}
              position="bottom"
              canSelect={
                // 亮主阶段
                ((gameState?.gamePhase === 'bidding' || gameState?.gamePhase === 'dealing' || trumpCountdown !== null) && 
                 (gameState?.trumpPlayer === null || gameState?.trumpPlayer === undefined)) ||
                // 反主阶段（叫主者不能反主）
                (gameState?.gamePhase === 'countering' &&
                 (gameState?.trumpPlayer !== null && gameState?.trumpPlayer !== undefined) &&
                 ((gameState?.counterTrumpEndTime ? Date.now() <= gameState.counterTrumpEndTime : true)) &&
                 (gameState?.counterTrumpPlayer === null || gameState?.counterTrumpPlayer === undefined) &&
                 (gameState?.firstTrumpPlayer !== myPosition)) ||
                // 粘主交换阶段（可以选择交换牌）
                (stickExchange !== null) ||
                // 摸底阶段（只有摸底玩家可以选牌）
                (gameState?.gamePhase === 'bottom' && myPosition === gameState?.bottomPlayer) ||
                // 出牌阶段（轮到自己时可以选牌）
                (gameState?.gamePhase === 'playing' && gameState?.currentTurn === myPosition)
              }
            />

      {waitingNext && (
        <div className="next-game-panel" style={{marginTop: '12px'}}>
          <button
            className="action-btn"
            onClick={() => {
              socketService.emit('readyNext', { roomId });
            }}
            style={{ marginRight: 8 }}
          >
            我已准备好
          </button>
          <button
            className="action-btn"
            onClick={() => {
              socketService.emit('startNextGame', { roomId });
            }}
          >
            开始下一局 ({nextReadyCount}/4)
          </button>
        </div>
      )}
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
