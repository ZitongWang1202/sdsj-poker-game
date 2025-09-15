const Room = require('../models/Room');
const Player = require('../models/Player');
const ShandongUpgradeGame = require('../models/ShandongUpgradeGame');
const Card = require('../models/Card');

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

    // 若房间为测试模式但未提供预设，则生成默认预设
    if (room.isTestRoom) {
      debugMode = true;
      if (!presetCards) {
        presetCards = this.generateTestPresets();
        room.presetCards = presetCards;
      }
    }

    const game = new ShandongUpgradeGame(room.players, debugMode, presetCards);
    room.startGame(game);
    
    return true;
  }

  // 生成测试用的固定发牌（示例：玩家0有一王+一对♥7，玩家1有一对王+一对8，便于亮主/反主测试）
  generateTestPresets() {
    const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
    const ranks = [2,3,4,5,6,7,8,9,10,'J','Q','K','A'];

    // 构造两副完整牌
    const deck = [];
    for (let d = 0; d < 2; d++) {
      for (const s of suits) {
        for (const r of ranks) deck.push(new Card(s, r, d));
      }
      deck.push(new Card('joker','small', d));
      deck.push(new Card('joker','big', d));
    }

    // 洗牌的确定性：这里不洗，使用固定顺序，后续按需要抽取
    const take = (predicate, count) => {
      const res = [];
      for (let i = deck.length - 1; i >= 0 && res.length < count; i--) {
        if (predicate(deck[i])) res.push(deck.splice(i,1)[0]);
      }
      return res;
    };

    const p0 = [];
    const p1 = [];
    const p2 = [];
    const p3 = [];

    // 玩家0：一张王（大王）+ ♥7♥7
    p0.push(...take(c => c.suit==='joker' && c.rank==='big', 1));
    p0.push(...take(c => c.suit==='hearts' && c.rank===7, 2));

    // 玩家1：一对王（小王对）+ 任意一对8（优先♠8♠8）
    p1.push(...take(c => c.suit==='joker' && c.rank==='small', 2));
    const eightPair = take(c => c.suit==='spades' && c.rank===8, 2);
    if (eightPair.length < 2) p1.push(...take(c => c.rank===8, 2 - eightPair.length));
    else p1.push(...eightPair);

    // 玩家2：一张大王 + ♠J♠J + ♠Q♠Q（用于测试粘主）+ 级牌7和黑桃牌用于回馈 + 红桃牌
    p2.push(...take(c => c.suit==='joker' && c.rank==='big', 1));
    p2.push(...take(c => c.suit==='spades' && c.rank==='J', 2));
    p2.push(...take(c => c.suit==='spades' && c.rank==='Q', 2));
    // 粘主回馈牌：1张级牌7 + 2张黑桃牌（按规则必须是联对同花色）
    p2.push(...take(c => c.rank === 7, 1)); // 级牌7（任意花色）
    p2.push(...take(c => c.suit==='spades' && c.rank !== 'J' && c.rank !== 'Q', 4)); // 4张其他黑桃牌（确保有足够选择）
    // 额外添加红桃牌（如果需要）
    p2.push(...take(c => c.suit==='hearts', 3)); // 3张红桃牌

    // 玩家3：一张小王 + ♥9♥9 + ♥10♥10（用于测试粘主）
    p3.push(...take(c => c.suit==='joker' && c.rank==='small', 1));
    p3.push(...take(c => c.suit==='hearts' && c.rank===9, 2));
    p3.push(...take(c => c.suit==='hearts' && c.rank===10, 2));

    // 填满各自到26张
    const fillTo = (arr, n) => { while (arr.length < n && deck.length) arr.push(deck.pop()); };
    fillTo(p0, 26); fillTo(p1, 26); fillTo(p2, 26); fillTo(p3, 26);

    return [p0, p1, p2, p3];
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
