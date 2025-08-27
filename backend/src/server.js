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
        io.to(roomId).emit('gameStarted', result.room);
        console.log(`房间 ${roomId} 游戏开始`);
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
