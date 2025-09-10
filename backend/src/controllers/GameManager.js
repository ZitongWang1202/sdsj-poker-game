const Room = require('../models/Room');
const Player = require('../models/Player');
const ShandongUpgradeGame = require('../models/ShandongUpgradeGame');

class GameManager {
  constructor() {
    this.rooms = new Map();
    this.players = new Map();
  }

  // 创建房间
  createRoom(socketId, playerName) {
    const roomId = this.generateRoomId();
    const player = new Player(socketId, playerName, 0); // 0表示房主
    const room = new Room(roomId, player);
    
    this.rooms.set(roomId, room);
    this.players.set(socketId, { roomId, player });
    
    return room;
  }

  // 加入房间
  joinRoom(roomId, socketId, playerName) {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return { success: false, message: '房间不存在' };
    }
    
    if (room.players.length >= 4) {
      return { success: false, message: '房间已满' };
    }
    
    if (room.gameStarted) {
      return { success: false, message: '游戏已开始' };
    }

    const player = new Player(socketId, playerName, room.players.length);
    room.addPlayer(player);
    this.players.set(socketId, { roomId, player });
    
    return { success: true, room };
  }

  // 开始游戏
  startGame(roomId, debugMode = false, presetCards = null) {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length !== 4) {
      return false;
    }

    const game = new ShandongUpgradeGame(room.players, debugMode, presetCards);
    room.startGame(game);
    
    return true;
  }

  // 获取可用房间列表
  getAvailableRooms() {
    const availableRooms = [];
    
    for (const [id, room] of this.rooms) {
      if (!room.gameStarted && room.players.length < 4) {
        availableRooms.push({
          id: room.id,
          name: room.name,
          players: room.players.length,
          maxPlayers: 4,
          hostName: room.players[0]?.name || 'Unknown'
        });
      }
    }
    
    return availableRooms;
  }

  // 移除玩家
  removePlayer(socketId) {
    const playerInfo = this.players.get(socketId);
    if (!playerInfo) return;

    const { roomId } = playerInfo;
    const room = this.rooms.get(roomId);
    
    if (room) {
      room.removePlayer(socketId);
      
      // 如果房间空了，删除房间
      if (room.players.length === 0) {
        this.rooms.delete(roomId);
      }
    }
    
    this.players.delete(socketId);
  }

  // 获取房间
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  // 获取玩家信息
  getPlayerInfo(socketId) {
    return this.players.get(socketId);
  }

  // 生成房间ID
  generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

module.exports = GameManager;
