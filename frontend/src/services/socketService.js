import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';
    this.isConnecting = false;
    this.eventListeners = new Map(); // 跟踪事件监听器
  }

  // 连接到服务器 - 确保只有一个连接
  connect() {
    // 如果已经连接，直接返回
    if (this.socket && this.socket.connected) {
      console.log('♻️ 复用现有连接');
      return this.socket;
    }

    // 如果正在连接，直接返回当前socket实例
    if (this.isConnecting && this.socket) {
      console.log('⏳ 连接进行中，返回当前实例...');
      return this.socket;
    }

    // 重置连接状态
    this.isConnecting = true;
    console.log('🔗 创建新的Socket连接...');

    // 清理旧连接
    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
      this.socket = null;
    }

    console.log('🔧 Socket.io配置:', {
      serverUrl: this.serverUrl,
      userAgent: navigator.userAgent.slice(0, 50)
    });

    this.socket = io(this.serverUrl, {
      transports: ['polling'], // 先只用polling
      timeout: 20000,
      autoConnect: true,
      reconnection: false, // 暂时禁用自动重连
      forceNew: true
    });

    console.log('📦 Socket实例已创建:', this.socket);

    this.socket.on('connect', () => {
      console.log('✅ Socket连接成功:', this.socket.id);
      this.isConnecting = false;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket断开连接:', reason);
      this.isConnecting = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 Socket连接错误:', error);
      console.error('🔧 错误详情:', {
        message: error.message,
        description: error.description,
        context: error.context,
        type: error.type,
        url: this.serverUrl
      });
      this.isConnecting = false;
    });

    // 添加连接超时检测
    setTimeout(() => {
      if (this.isConnecting && (!this.socket || !this.socket.connected)) {
        console.error('⏰ Socket连接超时，重置状态');
        this.isConnecting = false;
        // 不清空socket，让其继续尝试连接
      }
    }, 10000);

    return this.socket;
  }


  // 断开连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // 确保连接后发送事件
  emit(event, data) {
    const socket = this.getSocket();
    if (socket && socket.connected) {
      console.log('📤 发送事件:', event, data);
      socket.emit(event, data);
    } else {
      console.warn('⚠️ Socket未连接，无法发送事件:', event);
    }
  }

  // 安全的事件监听 - 带组件标识
  on(event, callback, componentId = 'unknown') {
    const socket = this.getSocket();
    if (socket) {
      console.log(`👂 组件 ${componentId} 监听事件:`, event);
      
      // 记录监听器
      if (!this.eventListeners.has(componentId)) {
        this.eventListeners.set(componentId, new Set());
      }
      this.eventListeners.get(componentId).add(event);
      
      socket.on(event, callback);
    }
  }

  // 移除特定组件的所有事件监听
  offComponent(componentId) {
    const socket = this.getSocket();
    if (socket && this.eventListeners.has(componentId)) {
      const events = this.eventListeners.get(componentId);
      console.log(`🧹 清理组件 ${componentId} 的事件监听:`, Array.from(events));
      
      events.forEach(event => {
        socket.removeAllListeners(event);
      });
      
      this.eventListeners.delete(componentId);
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

  createTestRoom(playerName) {
    this.emit('createTestRoom', playerName);
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
    // 如果正在连接或socket存在，直接返回
    if (this.isConnecting || this.socket) {
      return this.socket;
    }
    
    // 只有在完全没有socket且不在连接中时才重新连接
    console.log('🔄 Socket不存在，创建新连接...');
    return this.connect();
  }

  // 获取socket ID
  getSocketId() {
    return this.socket ? this.socket.id : null;
  }
}

// 创建单例
const socketService = new SocketService();
export default socketService;
