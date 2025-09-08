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
      
      return;
    }
    
    // 计算当前应该发给哪个玩家
    const playerIndex = currentCardIndex % room.players.length;
    const playerCardIndex = Math.floor(currentCardIndex / room.players.length);
    const player = room.players[playerIndex];
    
    if (player && playerCardIndex < player.cards.length) {
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
    }
    
    currentCardIndex++;
  }, 1000); // 每秒发一张牌
}

// Socket.io连接处理
io.on('connection', (socket) => {
  console.log('✅ 新客户端连接成功:', socket.id);
  console.log('🔗 连接来源:', socket.handshake.address);
  console.log('🌐 User-Agent:', socket.handshake.headers['user-agent']?.slice(0, 50));

  // 创建房间
  socket.on('createRoom', (playerName) => {
    const room = gameManager.createRoom(socket.id, playerName);
    socket.join(room.id);
    socket.emit('roomCreated', room);
    console.log(`房间创建: ${room.id}, 玩家: ${playerName}`);
  });

  // 加入房间
  socket.on('joinRoom', (data) => {
    const { roomId, playerName } = data;
    const result = gameManager.joinRoom(roomId, socket.id, playerName);
    
    if (result.success) {
      socket.join(roomId);
      socket.emit('joinedRoom', result.room);
      socket.to(roomId).emit('playerJoined', result.room);
      console.log(`玩家 ${playerName} 加入房间 ${roomId}`);
      
      // 如果房间人满，开始游戏
      if (result.room.players.length === 4) {
        gameManager.startGame(roomId);
        
        // 通知游戏开始
        io.to(roomId).emit('gameStarted', {
          message: '🎮 游戏开始！正在发牌...',
          room: result.room
        });
        
        // 开始逐张发牌动画
        setTimeout(() => {
          startDealingAnimation(io, roomId, gameManager);
        }, 2000); // 延长到2秒，确保前端准备好
        
        console.log(`房间 ${roomId} 游戏开始，已发牌`);
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
      socket.emit('roomInfo', room);
    }
  });

  // 亮主
  socket.on('declareTrump', (data) => {
    const { roomId, cards } = data;
    const playerInfo = gameManager.getPlayerInfo(socket.id);
    
    if (!playerInfo) {
      socket.emit('trumpError', '玩家信息不存在');
      return;
    }
    
    const room = gameManager.getRoom(roomId);
    if (!room || !room.game) {
      socket.emit('trumpError', '房间或游戏不存在');
      return;
    }
    
    const result = room.game.declareTrump(playerInfo.player.position, cards);
    if (result.success) {
      // 通知所有玩家亮主成功
      io.to(roomId).emit('trumpDeclared', {
        playerName: playerInfo.player.name,
        playerId: playerInfo.player.position,
        trumpSuit: result.trumpSuit,
        trumpRank: result.trumpRank,
        gameState: room.game.getGameState()
      });
      console.log(`玩家 ${playerInfo.player.name} 亮主成功: ${result.trumpSuit}`);
    } else {
      socket.emit('trumpError', result.message);
    }
  });

  // 出牌
  socket.on('playCards', (data) => {
    const { roomId, cardIndices } = data;
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
    
    const result = room.game.playCards(playerInfo.player.position, cardIndices);
    if (result.success) {
      // 通知所有玩家出牌
      io.to(roomId).emit('cardsPlayed', {
        playerName: playerInfo.player.name,
        playerId: playerInfo.player.position,
        cards: result.cards,
        gameState: room.game.getGameState()
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
    } else {
      socket.emit('playError', result.message);
    }
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
});
