class Player {
  constructor(socketId, name, position) {
    this.socketId = socketId;
    this.name = name;
    this.position = position; // 0-3，玩家位置
    this.cards = []; // 手牌
    this.score = 0; // 当前得分
    this.level = 2; // 当前级别，从2开始
    this.isDealer = false; // 是否为庄家
    this.isConnected = true;
    this.joinTime = new Date();
  }

  // 接受牌
  receiveCards(cards) {
    this.cards = cards;
  }

  // 出牌（根据牌ID）
  playCardsByIds(cardIds) {
    const playedCards = [];
    
    for (const cardId of cardIds) {
      const cardIndex = this.cards.findIndex(card => card.id === cardId);
      if (cardIndex !== -1) {
        playedCards.push(this.cards.splice(cardIndex, 1)[0]);
      }
    }
    
    return playedCards;
  }

  // 出牌（根据索引，保留向后兼容性）
  playCards(cardIndices) {
    const playedCards = [];
    // 按照索引从大到小排序，避免删除时索引错位
    cardIndices.sort((a, b) => b - a);
    
    for (const index of cardIndices) {
      if (index >= 0 && index < this.cards.length) {
        playedCards.unshift(this.cards.splice(index, 1)[0]);
      }
    }
    
    return playedCards;
  }

  // 添加得分
  addScore(points) {
    this.score += points;
  }

  // 升级
  levelUp(levels = 1) {
    this.level += levels;
  }

  // 设置为庄家
  setDealer(isDealer) {
    this.isDealer = isDealer;
  }

  // 获取玩家状态
  getStatus() {
    return {
      socketId: this.socketId,
      name: this.name,
      position: this.position,
      cardCount: this.cards.length,
      score: this.score,
      level: this.level,
      isDealer: this.isDealer,
      isConnected: this.isConnected
    };
  }

  // 获取完整信息（包括手牌，仅发给玩家自己）
  getFullInfo() {
    return {
      ...this.getStatus(),
      cards: this.cards
    };
  }
}

module.exports = Player;
