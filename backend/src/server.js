const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// CORS配置
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

app.use(express.json());

// Socket.io配置
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 游戏状态管理
const GameManager = require('./controllers/GameManager');
const ShandongUpgradeGame = require('./models/ShandongUpgradeGame');
const gameManager = new GameManager();

// 逐张发牌动画函数
function startDealingAnimation(io, roomId, gameManager) {
  console.log(`⏰ 开始逐张发牌动画 - 房间: ${roomId}`);
  const room = gameManager.getRoom(roomId);
  
  if (!room || !room.game) {
    console.log(`❌ 房间 ${roomId} 或游戏实例不存在`);
    return;
  }

  console.log(`🎴 房间 ${roomId} 游戏实例存在，开始逐张发牌`);
  console.log(`👥 房间内玩家数量: ${room.players.length}`);
  
  // 发送发牌开始事件，让前端知道可以开始亮主
  io.to(roomId).emit('dealingStarted', {
    gameState: room.game.getGameState()
  });
  
  // 创建发牌序列：真正一张一张发牌
  const totalCardsPerPlayer = 26; // 每人26张牌
  const totalCards = totalCardsPerPlayer * room.players.length; // 总共104张牌
  let currentCardIndex = 0;
  
  const dealInterval = setInterval(() => {
    if (currentCardIndex >= totalCards) {
      // 发牌完成
      clearInterval(dealInterval);
      console.log(`🎉 发牌完成 - 房间: ${roomId}`);
      
      // 发送发牌完成事件
      room.players.forEach((player, index) => {
        const playerSocket = io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
          const dealData = {
            cards: player.cards,
            playerPosition: index,
            gameState: room.game.getGameState(),
            dealingComplete: true
          };
          console.log(`📤 发送最终cardsDealt事件给 ${player.name}`);
          playerSocket.emit('cardsDealt', dealData);
        }
      });
      
      // 通知模型“发牌动画完成”，再读取状态
      if (room && room.game && typeof room.game.onDealingCompleted === 'function') {
        room.game.onDealingCompleted();
      }
      const gsAfterDeal = room.game.getGameState();
      io.to(roomId).emit('biddingStarted', {
        gameState: gsAfterDeal,
        declareEndTime: gsAfterDeal.declareEndTime
      });

      // 在叫主截止时刻，若仍无人亮主且游戏被模型置为finished，则广播超时/结束
      const msToDeclareEnd = Math.max(0, (gsAfterDeal.declareEndTime || 0) - Date.now());
      setTimeout(() => {
        const snap = room?.game?.getGameState?.() || null;
        if (snap && !snap.trumpSuit && snap.gamePhase === 'finished') {
          io.to(roomId).emit('biddingTimeout', { gameState: snap });
        }
      }, msToDeclareEnd + 10);
      
      return;
    }
    
    // 计算当前应该发给哪个玩家
    const playerIndex = currentCardIndex % room.players.length;
    const playerCardIndex = Math.floor(currentCardIndex / room.players.length);
    const player = room.players[playerIndex];
    
    // 确保玩家存在且还有牌要发
    if (!player) {
      console.log(`❌ 玩家不存在 - 索引: ${playerIndex}`);
      currentCardIndex++;
      return;
    }
    
    if (playerCardIndex >= player.cards.length) {
      console.log(`❌ 玩家 ${player.name} 已发完所有牌 - 索引: ${playerCardIndex}/${player.cards.length}`);
      currentCardIndex++;
      return;
    }
    
    const card = player.cards[playerCardIndex];
    
    // 发送单张牌事件给所有玩家（用于动画效果）
    io.to(roomId).emit('cardDealt', {
      toPlayer: playerIndex,
      cardIndex: playerCardIndex,
      totalDealt: currentCardIndex + 1,
      totalCards: totalCards,
      playerCardIndex: playerCardIndex + 1,
      totalPlayerCards: totalCardsPerPlayer
    });
    
    // 只给目标玩家发送实际牌面信息
    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (playerSocket) {
      playerSocket.emit('cardReceived', {
        card: card,
        cardIndex: playerCardIndex,
        totalReceived: playerCardIndex + 1,
        totalPlayerCards: totalCardsPerPlayer
      });
    }
    
    console.log(`🃏 第${currentCardIndex + 1}张牌：给玩家 ${player.name} 发第${playerCardIndex + 1}张牌`);
    
    currentCardIndex++;
  }, 200); // 每0.2秒发一张牌
}

// Socket.io连接处理
io.on('connection', (socket) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ 新客户端连接成功:', socket.id);
    console.log('🔗 连接来源:', socket.handshake.address);
    console.log('🌐 User-Agent:', socket.handshake.headers['user-agent']?.slice(0, 50));
  }

  // 创建房间
  socket.on('createRoom', (playerName) => {
    const room = gameManager.createRoom(socket.id, playerName);
    socket.join(room.id);
    socket.emit('roomCreated', room.getStatus());
    console.log(`房间创建: ${room.id}, 玩家: ${playerName}`);
  });

  // 创建测试房间（固定发牌）
  socket.on('createTestRoom', (playerName) => {
    const room = gameManager.createRoom(socket.id, playerName);
    // 标记为测试房间
    room.isTestRoom = true;
    room.name = `${playerName}的测试房间`;
    socket.join(room.id);
    socket.emit('roomCreated', room.getStatus());
    console.log(`测试房间创建: ${room.id}, 玩家: ${playerName}`);
  });

  // 加入房间
  socket.on('joinRoom', (data) => {
    const { roomId, playerName } = data;
    const result = gameManager.joinRoom(roomId, socket.id, playerName);
    
    if (result.success) {
      socket.join(roomId);
      socket.emit('joinedRoom', result.room.getStatus());
      socket.to(roomId).emit('playerJoined', result.room.getStatus());
      console.log(`玩家 ${playerName} 加入房间 ${roomId}`);
      
      // 如果游戏已经开始或存在进行中的游戏，向新加入的玩家发送手牌/状态快照，避免错过发牌事件
      try {
        const room = gameManager.getRoom(roomId);
        if (room && room.game) {
          const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
          if (playerIndex !== -1) {
            const playerSocket = io.sockets.sockets.get(socket.id);
            if (playerSocket) {
              const snapshot = {
                cards: room.players[playerIndex].cards,
                playerPosition: playerIndex,
                gameState: room.game.getGameState(),
                dealingComplete: true
              };
              console.log(`📤 向新加入玩家发送手牌快照: ${playerName}, 牌数=${snapshot.cards?.length}`);
              playerSocket.emit('cardsDealt', snapshot);
            }
          }
        }
      } catch (e) {
        console.warn('发送加入快照失败:', e);
      }

      // 如果房间人满，等待玩家准备
      if (result.room.players.length === 4) {
        const room = gameManager.getRoom(roomId);
        
        // 初始化准备系统
        room.initialGameReady = new Set();
        room.isWaitingInitialReady = true;
        
        // 通知所有玩家：房间人满，等待准备（在 gameStarted 中携带准备信息）
        io.to(roomId).emit('gameStarted', {
          message: '🎮 房间已满！',
          room: result.room.getStatus(),
          waitingInitialReady: true  // 标记需要等待准备
        });
        
        // 延迟发送 waitingInitialReady，确保 PokerTable 已经挂载
        setTimeout(() => {
          io.to(roomId).emit('waitingInitialReady', {
            message: '等待所有玩家点击"准备"按钮开始游戏'
          });
        }, 2000);
        
        console.log(`房间 ${roomId} 人满，等待玩家准备`);
      }
    } else {
      socket.emit('joinError', result.message);
    }
  });

  // 获取房间列表
  socket.on('getRooms', () => {
    const rooms = gameManager.getAvailableRooms();
    socket.emit('roomsList', rooms);
  });

  // 获取房间信息
  socket.on('getRoomInfo', (roomId) => {
    const room = gameManager.getRoom(roomId);
    if (room) {
      socket.emit('roomInfo', room.getStatus());
    }
  });

  // 亮主
  socket.on('declareTrump', (data) => {
    const { roomId, cards } = data;
    console.log(`🎺 收到亮主请求 - Socket ID: ${socket.id}, 房间: ${roomId}, 牌数: ${cards.length}`);
    
    const playerInfo = gameManager.getPlayerInfo(socket.id);
    console.log(`🎺 玩家信息:`, playerInfo);
    
    if (!playerInfo) {
      console.log(`❌ 玩家信息不存在 - Socket ID: ${socket.id}`);
      socket.emit('trumpError', '玩家信息不存在');
      return;
    }
    
    const room = gameManager.getRoom(roomId);
    if (!room || !room.game) {
      console.log(`❌ 房间或游戏不存在 - 房间: ${roomId}`);
      socket.emit('trumpError', '房间或游戏不存在');
      return;
    }
    
    console.log(`🎺 游戏状态:`, room.game.getGameState());
    console.log(`🎺 玩家位置: ${playerInfo.player.position}, 玩家名称: ${playerInfo.player.name}`);
    
    const result = room.game.declareTrump(playerInfo.player.position, cards);
    console.log(`🎺 亮主结果:`, result);
    
    if (result.success) {
      // 清除亮主倒计时
      // 已改为模型内部计时，这里无需房间层倒计时
      
      // 通知所有玩家亮主成功
      io.to(roomId).emit('trumpDeclared', {
        playerName: playerInfo.player.name,
        playerId: playerInfo.player.position,
        trumpSuit: result.trumpSuit,
        trumpRank: result.trumpRank,
        gameState: room.game.getGameState()
      });
      console.log(`✅ 玩家 ${playerInfo.player.name} 亮主成功: ${result.trumpSuit}`);

      // 广播进入反主阶段及截止时间
      io.to(roomId).emit('counteringStarted', {
        counterTrumpEndTime: room.game.getGameState().counterTrumpEndTime,
        gameState: room.game.getGameState()
      });
    } else {
      console.log(`❌ 玩家 ${playerInfo.player.name} 亮主失败: ${result.message}`);
      socket.emit('trumpError', result.message);
    }
  });

  // 反主
  socket.on('counterTrump', (data) => {
    const { roomId, cards } = data;
    console.log(`🔄 收到反主请求 - Socket ID: ${socket.id}, 房间: ${roomId}, 牌数: ${cards.length}`);
    
    const playerInfo = gameManager.getPlayerInfo(socket.id);
    console.log(`🔄 玩家信息:`, playerInfo);
    
    if (!playerInfo) {
      console.log(`❌ 玩家信息不存在 - Socket ID: ${socket.id}`);
      socket.emit('counterTrumpError', '玩家信息不存在');
      return;
    }
    
    const room = gameManager.getRoom(roomId);
    if (!room || !room.game) {
      console.log(`❌ 房间或游戏不存在 - 房间: ${roomId}`);
      socket.emit('counterTrumpError', '房间或游戏不存在');
      return;
    }
    
    console.log(`🔄 游戏状态:`, room.game.getGameState());
    console.log(`🔄 玩家位置: ${playerInfo.player.position}, 玩家名称: ${playerInfo.player.name}`);
    
    const result = room.game.counterTrump(playerInfo.player.position, cards);
    console.log(`🔄 反主结果:`, result);
    
    if (result.success) {
      // 通知所有玩家反主成功
      io.to(roomId).emit('counterTrumpDeclared', {
        playerName: playerInfo.player.name,
        playerId: playerInfo.player.position,
        counterTrumpRank: result.counterTrumpRank,
        counterTrumpPair: result.counterTrumpPair,
        newDealer: result.newDealer,
        gameState: room.game.getGameState()
      });
      console.log(`✅ 玩家 ${playerInfo.player.name} 反主成功: 一对${result.counterTrumpRank === 'big' ? '大王' : '小王'} + 一对${result.counterTrumpPair}`);

      // 反主成功后直接进入粘主阶段（模型已切换），广播粘主开始与截止时间
      io.to(roomId).emit('stickingStarted', {
        stickEndTime: room.game.getGameState().stickEndTime,
        gameState: room.game.getGameState()
      });
    } else {
      console.log(`❌ 玩家 ${playerInfo.player.name} 反主失败: ${result.message}`);
      socket.emit('counterTrumpError', result.message);
    }
  });

  // 开始粘主（停止倒计时）
  socket.on('startSticking', (data) => {
    const { roomId } = data;
    console.log(`📌 收到开始粘主请求 - Socket ID: ${socket.id}, 房间: ${roomId}`);

    const playerInfo = gameManager.getPlayerInfo(socket.id);
    if (!playerInfo) {
      socket.emit('startStickingError', '玩家信息不存在');
      return;
    }

    const room = gameManager.getRoom(roomId);
    if (!room || !room.game) {
      socket.emit('startStickingError', '房间或游戏不存在');
      return;
    }

    const result = room.game.startSticking(playerInfo.player.position);
    if (result.success) {
      // 通知所有玩家粘主倒计时停止（使用新的事件名）
      io.to(roomId).emit('stickingCountdownStopped', {
        playerName: playerInfo.player.name,
        playerId: playerInfo.player.position,
        message: `${playerInfo.player.name} 开始粘主，倒计时停止`
      });
      console.log(`玩家 ${playerInfo.player.name} 开始粘主，倒计时停止`);
    } else {
      socket.emit('startStickingError', result.message);
    }
  });

  // 粘主（1王+同花相邻两对），并与原叫主者交换
  socket.on('stickTrump', (data) => {
    const { roomId, stickCards, giveBackCards } = data;
    console.log(`📌 收到粘主请求 - Socket ID: ${socket.id}, 房间: ${roomId}, 粘主牌: ${stickCards?.length}, 回馈牌: ${giveBackCards?.length}`);

    const playerInfo = gameManager.getPlayerInfo(socket.id);
    if (!playerInfo) {
      socket.emit('stickTrumpError', '玩家信息不存在');
      return;
    }

    const room = gameManager.getRoom(roomId);
    if (!room || !room.game) {
      socket.emit('stickTrumpError', '房间或游戏不存在');
      return;
    }

    const result = room.game.stickTrump(playerInfo.player.position, stickCards, giveBackCards);
    if (result.success) {
      // 通知所有玩家粘主交换完成
      io.to(roomId).emit('trumpSticked', {
        playerName: playerInfo.player.name,
        playerId: playerInfo.player.position,
        takenFromDeclarer: result.takenFromDeclarer,
        givenToDeclarer: result.givenToDeclarer,
        gameState: room.game.getGameState()
      });

      // 向双方同步手牌更新
      const declarerId = room.game.getGameState().firstTrumpPlayer;
      const declarer = room.players[declarerId];
      const playerSocket = io.sockets.sockets.get(playerInfo.player.socketId);
      const declarerSocket = declarer ? io.sockets.sockets.get(declarer.socketId) : null;
      if (playerSocket) {
        playerSocket.emit('handUpdated', {
          cards: playerInfo.player.cards,
          gameState: room.game.getGameState()
        });
      }
      if (declarerSocket) {
        declarerSocket.emit('handUpdated', {
          cards: declarer.cards,
          gameState: room.game.getGameState()
        });
      }

      // 广播游戏进入出牌阶段
      io.to(roomId).emit('gamePhaseChanged', {
        phase: 'playing',
        gameState: room.game.getGameState()
      });
    } else {
      socket.emit('stickTrumpError', result.message);
    }
  });

  // 出牌
  socket.on('playCards', (data) => {
    const { roomId, cardIds } = data;
    const playerInfo = gameManager.getPlayerInfo(socket.id);
    
    if (!playerInfo) {
      socket.emit('playError', '玩家信息不存在');
      return;
    }
    
    const room = gameManager.getRoom(roomId);
    if (!room || !room.game) {
      socket.emit('playError', '房间或游戏不存在');
      return;
    }
    
    // 检查是否轮次即将结束（这是第4个玩家出牌）
    const wasRoundComplete = (room.game.roundCards.length === 3);
    
    const result = room.game.playCardsByIds(playerInfo.player.position, cardIds);
    if (result.success) {
      // 通知所有玩家出牌
      io.to(roomId).emit('cardsPlayed', {
        playerName: playerInfo.player.name,
        playerId: playerInfo.player.position,
        cards: result.cards,
        gameState: room.game.getGameState(),
        message: result.message
      });
      
      // 更新玩家手牌
      const playerSocket = io.sockets.sockets.get(playerInfo.player.socketId);
      if (playerSocket) {
        playerSocket.emit('handUpdated', {
          cards: playerInfo.player.cards,
          gameState: room.game.getGameState()
        });
      }
      
      console.log(`玩家 ${playerInfo.player.name} 出牌: ${result.cards.length}张`);
      
      // 如果刚刚完成了一轮（第4个玩家出牌）
      if (wasRoundComplete) {
        console.log('🎯 轮次已完成，准备发送轮次结束通知');
        
        // 延迟一点时间显示轮次结束信息，让玩家看到最后的出牌
        setTimeout(() => {
          // 获取轮次获胜者信息（evaluateRound已经在playCardsByIds中调用了）
          const roundWinner = room.game.lastWinner;
          const winnerPlayer = room.players[roundWinner];
          const gameState = room.game.getGameState();
          
          // 通知轮次结束
          io.to(roomId).emit('roundComplete', {
            winner: roundWinner,
            winnerName: winnerPlayer ? winnerPlayer.name : `玩家${roundWinner + 1}`,
            gameState: gameState
          });
          
          console.log(`🏆 轮次结束，获胜者: ${winnerPlayer ? winnerPlayer.name : `玩家${roundWinner + 1}`}`);
          
          // 如果游戏没有结束，准备下一轮
          if (gameState.gamePhase !== 'finished') {
            // 再延迟一点清空桌面，准备下一轮
            setTimeout(() => {
              io.to(roomId).emit('newRoundStarted', {
                currentTurn: room.game.currentTurn,
                gameState: room.game.getGameState()
              });
            }, 2000);
          } else {
            // 游戏结束，延迟发送最终结果
            setTimeout(() => {
              io.to(roomId).emit('gameFinished', {
                finalResult: result.finalResult || room.game.calculateFinalResults(),
                gameState: gameState
              });
            }, 3000);
            // 进入等待下一局：向所有客户端广播readyForNextGame
            setTimeout(() => {
              const r = gameManager.getRoom(roomId);
              if (!r || !r.game) return;
              r.nextGameReady = new Set();
              r.nextGameContext = (result.finalResult || r.game.calculateFinalResults());
              io.to(roomId).emit('readyForNextGame', { finalResult: r.nextGameContext });
            }, 5000);
          }
        }, 1000);
      }
    } else {
      socket.emit('playError', result.message);
    }
  });

  // 摸底
  socket.on('handleBottomCards', (data) => {
    const { roomId, selectedCardIds } = data;
    console.log(`🃏 收到摸底请求 - Socket ID: ${socket.id}, 房间: ${roomId}, 选中牌数: ${selectedCardIds?.length}`);
    
    const playerInfo = gameManager.getPlayerInfo(socket.id);
    if (!playerInfo) {
      socket.emit('bottomCardsError', '玩家信息不存在');
      return;
    }
    
    const room = gameManager.getRoom(roomId);
    if (!room || !room.game) {
      socket.emit('bottomCardsError', '房间或游戏不存在');
      return;
    }
    
    const result = room.game.handleBottomCards(playerInfo.player.position, selectedCardIds);
    if (result.success) {
      // 通知所有玩家摸底完成
      io.to(roomId).emit('bottomCardsHandled', {
        playerName: playerInfo.player.name,
        playerId: playerInfo.player.position,
        gameState: room.game.getGameState(),
        message: '摸底完成，进入出牌阶段'
      });
      
      // 更新摸底玩家的手牌
      const playerSocket = io.sockets.sockets.get(playerInfo.player.socketId);
      if (playerSocket) {
        playerSocket.emit('handUpdated', {
          cards: playerInfo.player.cards,
          gameState: room.game.getGameState()
        });
      }
      
      console.log(`✅ 玩家 ${playerInfo.player.name} 摸底完成`);
    } else {
      console.log(`❌ 玩家 ${playerInfo.player.name} 摸底失败: ${result.message}`);
      socket.emit('bottomCardsError', result.message);
    }
  });

  // 客户端：初始准备（第一次开始游戏）
  socket.on('readyInitial', (data) => {
    const { roomId } = data || {};
    const playerInfo = gameManager.getPlayerInfo(socket.id);
    if (!playerInfo) return;
    const room = gameManager.getRoom(roomId);
    if (!room) return;
    if (!room.initialGameReady) room.initialGameReady = new Set();
    room.initialGameReady.add(playerInfo.player.position);
    // 广播当前就绪人数和玩家列表
    const count = room.initialGameReady.size;
    const readyPlayers = Array.from(room.initialGameReady);
    io.to(roomId).emit('initialGameReadyProgress', { count, readyPlayers });
    console.log(`玩家 ${playerInfo.player.name} 已准备，当前 ${count}/4`);
  });

  // 客户端：取消初始准备
  socket.on('cancelReadyInitial', (data) => {
    const { roomId } = data || {};
    const playerInfo = gameManager.getPlayerInfo(socket.id);
    if (!playerInfo) return;
    const room = gameManager.getRoom(roomId);
    if (!room) return;
    if (!room.initialGameReady) room.initialGameReady = new Set();
    room.initialGameReady.delete(playerInfo.player.position);
    // 广播当前就绪人数和玩家列表
    const count = room.initialGameReady.size;
    const readyPlayers = Array.from(room.initialGameReady);
    io.to(roomId).emit('initialGameReadyProgress', { count, readyPlayers });
    console.log(`玩家 ${playerInfo.player.name} 取消准备，当前 ${count}/4`);
  });

  // 客户端：我已准备好开始下一局
  socket.on('readyNext', (data) => {
    const { roomId } = data || {};
    const playerInfo = gameManager.getPlayerInfo(socket.id);
    if (!playerInfo) return;
    const room = gameManager.getRoom(roomId);
    if (!room) return;
    if (!room.nextGameReady) room.nextGameReady = new Set();
    room.nextGameReady.add(playerInfo.player.position);
    // 广播当前就绪人数和玩家列表
    const count = room.nextGameReady.size;
    const readyPlayers = Array.from(room.nextGameReady);
    io.to(roomId).emit('nextGameReadyProgress', { count, readyPlayers });
  });

  // 客户端：取消准备下一局
  socket.on('cancelReadyNext', (data) => {
    const { roomId } = data || {};
    const playerInfo = gameManager.getPlayerInfo(socket.id);
    if (!playerInfo) return;
    const room = gameManager.getRoom(roomId);
    if (!room) return;
    if (!room.nextGameReady) room.nextGameReady = new Set();
    room.nextGameReady.delete(playerInfo.player.position);
    // 广播当前就绪人数和玩家列表
    const count = room.nextGameReady.size;
    const readyPlayers = Array.from(room.nextGameReady);
    io.to(roomId).emit('nextGameReadyProgress', { count, readyPlayers });
  });

  // 客户端：发起开始初始游戏（需要4人都ready）
  socket.on('startInitialGame', (data) => {
    const { roomId } = data || {};
    const room = gameManager.getRoom(roomId);
    if (!room) return;
    // 需要4人全部就绪
    if (!room.initialGameReady || room.initialGameReady.size < 4) {
      io.to(roomId).emit('startInitialGameRejected', { reason: '需要四名玩家全部就绪' });
      return;
    }
    try {
      // 测试房间则用固定发牌
      if (room.isTestRoom) {
        const presets = gameManager.generateTestPresets();
        gameManager.startGame(roomId, true, presets);
      } else {
        gameManager.startGame(roomId);
      }
      
      // 设置粘主阶段进入回调
      if (room && room.game) {
        room.game._onStickPhaseEntered = () => {
          io.to(roomId).emit('stickingStarted', {
            stickEndTime: room.game.getGameState().stickEndTime,
            gameState: room.game.getGameState()
          });
        };
        
        // 无人叫主：首局回调 -> 广播提示并重新启动发牌动画
        room.game._onNoBidFirstRound = () => {
          io.to(roomId).emit('noBidFirstRound', {
            message: '⏰ 无人叫主，重新发牌',
            gameState: room.game.getGameState()
          });
          setTimeout(() => startDealingAnimation(io, roomId, gameManager), 3000);
        };

        // 无人叫主：非首局回调 -> 广播新级别/新庄家并重新启动发牌动画
        room.game._onNoBidLaterRound = ({ newLevel, newDealer }) => {
          io.to(roomId).emit('noBidLaterRound', {
            message: '⏰ 无人叫主，闲家升三级并坐庄，重新发牌',
            newLevel,
            newDealer,
            gameState: room.game.getGameState()
          });
          setTimeout(() => startDealingAnimation(io, roomId, gameManager), 3000);
        };

        // 设置摸底阶段进入回调
        room.game._onBottomPhaseEntered = () => {
          const gameState = room.game.getGameState();
          const bottomPlayer = room.players[gameState.bottomPlayer];
          
          // 广播摸底阶段开始
          io.to(roomId).emit('bottomPhaseStarted', {
            bottomPlayer: gameState.bottomPlayer,
            bottomPlayerName: bottomPlayer?.name,
            gameState: gameState
          });
          
          // 更新摸底玩家的手牌（因为添加了4张底牌）
          if (bottomPlayer) {
            const playerSocket = io.sockets.sockets.get(bottomPlayer.socketId);
            if (playerSocket) {
              playerSocket.emit('handUpdated', {
                cards: bottomPlayer.cards,
                gameState: gameState
              });
            }
          }
        };
      }
      
      // 清空准备标记
      room.initialGameReady = new Set();
      room.isWaitingInitialReady = false;
      
      // 通知游戏真正开始
      io.to(roomId).emit('gameReallyStarted', {
        message: '🎮 游戏开始！正在发牌...'
      });
      
      // 开始逐张发牌动画
      setTimeout(() => {
        startDealingAnimation(io, roomId, gameManager);
      }, 1000);
      
      console.log(`房间 ${roomId} 游戏开始，已发牌`);
    } catch (e) {
      console.error('startInitialGame 失败:', e);
      io.to(roomId).emit('startInitialGameRejected', { reason: '服务器内部错误' });
    }
  });

  // 客户端：发起开始下一局（需要4人都ready）
  socket.on('startNextGame', (data) => {
    const { roomId } = data || {};
    const room = gameManager.getRoom(roomId);
    if (!room) return;
    // 需要4人全部就绪
    if (!room.nextGameReady || room.nextGameReady.size < 4) {
      io.to(roomId).emit('startNextGameRejected', { reason: '需要四名玩家全部就绪' });
      return;
    }
    try {
      const finalRes = room.nextGameContext;
      const nextGame = new ShandongUpgradeGame(room.players, !!room.isTestRoom, room.presetCards || null);
      if (finalRes?.newLevel) nextGame.currentLevel = finalRes.newLevel;
      if (typeof finalRes?.newDealer === 'number') nextGame.dealer = finalRes.newDealer;
      nextGame.isFirstRound = false;
      room.game = nextGame;
      room.gameStarted = true;
      // 注册无人叫主回调（用于下一局）
      room.game._onNoBidFirstRound = () => {
        io.to(roomId).emit('noBidFirstRound', {
          message: '⏰ 无人叫主，重新发牌',
          gameState: room.game.getGameState()
        });
        setTimeout(() => startDealingAnimation(io, roomId, gameManager), 3000);
      };
      room.game._onNoBidLaterRound = ({ newLevel, newDealer }) => {
        io.to(roomId).emit('noBidLaterRound', {
          message: '⏰ 无人叫主，闲家升三级并坐庄，重新发牌',
          newLevel,
          newDealer,
          gameState: room.game.getGameState()
        });
        setTimeout(() => startDealingAnimation(io, roomId, gameManager), 3000);
      };
      // 清空等待集合
      room.nextGameReady = new Set();
      // 广播进入发牌动画
      startDealingAnimation(io, roomId, gameManager);
    } catch (e) {
      console.error('startNextGame 失败:', e);
      io.to(roomId).emit('startNextGameRejected', { reason: '服务器内部错误' });
    }
  });

  // 离开房间
  socket.on('leaveRoom', (data) => {
    const { roomId } = data;
    const playerInfo = gameManager.getPlayerInfo(socket.id);
    
    if (!playerInfo) {
      console.log(`❌ 玩家离开房间失败: 玩家信息不存在 ${socket.id}`);
      return;
    }
    
    const room = gameManager.getRoom(roomId);
    if (!room) {
      console.log(`❌ 玩家离开房间失败: 房间不存在 ${roomId}`);
      return;
    }
    
    const playerName = playerInfo.player.name;
    
    // 让玩家离开Socket.io房间
    socket.leave(roomId);
    
    // 从房间中移除玩家
    gameManager.removePlayer(socket.id);
    
    // 检查房间是否还存在（如果是最后一个玩家，房间已被删除）
    const updatedRoom = gameManager.getRoom(roomId);
    if (updatedRoom) {
      // 通知房间内其他玩家
      socket.to(roomId).emit('playerLeft', {
        playerName: playerName,
        room: updatedRoom.getStatus(),
        message: `玩家 ${playerName} 离开了房间`
      });
      console.log(`✅ 玩家 ${playerName} 离开房间 ${roomId}，房间还有 ${updatedRoom.players.length} 人`);
    } else {
      console.log(`🏠 房间 ${roomId} 已解散（最后一个玩家 ${playerName} 离开）`);
    }
    
    // 向离开的玩家确认
    socket.emit('leftRoom', {
      message: '已成功离开房间'
    });
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log(`玩家断开连接: ${socket.id}`);
    gameManager.removePlayer(socket.id);
  });
});

// 基础路由
app.get('/', (req, res) => {
  res.json({ 
    message: '山东升级扑克游戏服务器运行中', 
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
  console.log(`🎮 山东升级扑克游戏服务器已启动`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
});
