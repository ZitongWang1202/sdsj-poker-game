class Room {
  constructor(id, hostPlayer) {
    this.id = id;
    this.name = `${hostPlayer.name}的房间`;
    this.players = [hostPlayer];
    this.maxPlayers = 4;
    this.gameStarted = false;
    this.game = null;
    this.createdAt = new Date();
    // 测试房间相关元数据
    this.isTestRoom = false;
    this.presetCards = null;
    this.presetType = null;
  }

  // 添加玩家
  addPlayer(player) {
    if (this.players.length >= this.maxPlayers) {
      throw new Error('房间已满');
    }
    
    if (this.gameStarted) {
      throw new Error('游戏已开始');
    }

    this.players.push(player);
  }

  // 移除玩家
  removePlayer(socketId) {
    const index = this.players.findIndex(p => p.socketId === socketId);
    if (index !== -1) {
      this.players.splice(index, 1);
      
      // 重新分配位置
      this.players.forEach((player, i) => {
        player.position = i;
      });
    }
  }

  // 开始游戏
  startGame(game) {
    if (this.players.length !== 4) {
      throw new Error('需要4名玩家才能开始游戏');
    }
    
    this.gameStarted = true;
    this.game = game;
  }

  // 获取玩家
  getPlayer(socketId) {
    return this.players.find(p => p.socketId === socketId);
  }

  // 获取房间状态
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      players: this.players.map(p => p.getStatus()),
      maxPlayers: this.maxPlayers,
      gameStarted: this.gameStarted,
      createdAt: this.createdAt
    };
  }

  // 检查是否可以开始游戏
  canStartGame() {
    return this.players.length === this.maxPlayers && !this.gameStarted;
  }

  // 广播消息给房间内所有玩家
  broadcast(event, data, excludeSocketId = null) {
    return this.players
      .filter(p => p.socketId !== excludeSocketId)
      .map(p => ({ socketId: p.socketId, event, data }));
  }
}

module.exports = Room;
