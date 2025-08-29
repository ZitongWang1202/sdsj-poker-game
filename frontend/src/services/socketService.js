import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';
  }

  // 连接到服务器
  connect() {
    if (!this.socket) {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling']
      });
      
      this.socket.on('connect', () => {
        console.log('✅ 已连接到服务器');
      });
      
      this.socket.on('disconnect', () => {
        console.log('❌ 与服务器断开连接');
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('🔌 连接错误:', error);
      });
    }
    
    return this.socket;
  }

  // 断开连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // 发送事件
  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  // 监听事件
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // 移除事件监听
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // 房间相关方法
  createRoom(playerName) {
    this.emit('createRoom', playerName);
  }

  joinRoom(roomId, playerName) {
    this.emit('joinRoom', { roomId, playerName });
  }

  getRooms() {
    this.emit('getRooms');
  }

  // 游戏相关方法
  playCards(cardIndices) {
    this.emit('playCards', cardIndices);
  }

  declareTrump(cards) {
    this.emit('declareTrump', cards);
  }

  // 获取socket实例
  getSocket() {
    return this.socket;
  }
}

// 创建单例
const socketService = new SocketService();
export default socketService;
