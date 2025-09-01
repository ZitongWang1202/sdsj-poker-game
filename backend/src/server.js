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

// Socket.io连接处理
io.on('connection', (socket) => {
  console.log(`玩家连接: ${socket.id}`);

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
        
        // 发牌给每个玩家
        setTimeout(() => {
          const room = gameManager.getRoom(roomId);
          if (room && room.game) {
            room.players.forEach((player, index) => {
              const playerSocket = io.sockets.sockets.get(player.socketId);
              if (playerSocket) {
                playerSocket.emit('cardsDealt', {
                  cards: player.cards,
                  playerPosition: index,
                  gameState: room.game.getGameState()
                });
              }
            });
          }
        }, 1000); // 1秒后发牌
        
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
