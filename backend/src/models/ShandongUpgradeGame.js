const Card = require('./Card');

class ShandongUpgradeGame {
  constructor(players) {
    this.players = players;
    this.currentLevel = 2; // 当前级别
    this.trumpSuit = null; // 主牌花色
    this.deck = [];
    this.bottomCards = []; // 底牌 (4张)
    this.currentRound = 0;
    this.currentTurn = 0; // 当前出牌玩家
    this.dealer = 0; // 庄家位置
    this.gamePhase = 'dealing'; // dealing, bidding, playing, finished
    this.roundCards = []; // 当前轮次的出牌
    this.lastWinner = 0; // 上一轮获胜者
    
    // 山东升级特色：2,3,5为常主
    this.permanentTrumps = [2, 3, 5];
    
    this.initializeGame();
  }

  // 初始化游戏
  initializeGame() {
    this.createDeck();
    this.shuffleDeck();
    this.dealCards();
  }

  // 创建双副牌
  createDeck() {
    this.deck = [];
    const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
    const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];
    
    // 创建两副牌
    for (let deckNum = 0; deckNum < 2; deckNum++) {
      // 普通牌
      for (const suit of suits) {
        for (const rank of ranks) {
          this.deck.push(new Card(suit, rank, deckNum));
        }
      }
      
      // 大小王
      this.deck.push(new Card('joker', 'small', deckNum));
      this.deck.push(new Card('joker', 'big', deckNum));
    }
  }

  // 洗牌
  shuffleDeck() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  // 发牌 (每人26张，留4张底牌)
  dealCards() {
    const cardsPerPlayer = 26;
    
    // 给每个玩家发牌
    for (let i = 0; i < this.players.length; i++) {
      const playerCards = this.deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
      this.players[i].receiveCards(playerCards);
    }
    
    // 剩余4张作为底牌
    this.bottomCards = this.deck.slice(this.players.length * cardsPerPlayer);
    
    this.gamePhase = 'bidding';
  }

  // 亮主 (山东升级：需要一王带一对)
  declareTrump(playerId, cards) {
    if (this.gamePhase !== 'bidding') {
      return { success: false, message: '不在亮主阶段' };
    }

    const player = this.players[playerId];
    if (!player) {
      return { success: false, message: '玩家不存在' };
    }

    // 山东升级亮主规则: 一王带一对
    if (cards.length !== 3) {
      return { success: false, message: '亮主需要选择3张牌(一王带一对)' };
    }

    // 检查是否有王牌
    const jokers = cards.filter(card => card.suit === 'joker');
    const normalCards = cards.filter(card => card.suit !== 'joker');

    if (jokers.length !== 1) {
      return { success: false, message: '需要恰好一张王牌' };
    }

    if (normalCards.length !== 2) {
      return { success: false, message: '需要恰好两张普通牌' };
    }

    // 检查是否为一对
    const [card1, card2] = normalCards;
    if (card1.rank !== card2.rank) {
      return { success: false, message: '两张普通牌必须是一对(相同点数)' };
    }

    // 检查玩家是否确实拥有这些牌
    const playerCardIds = player.cards.map(c => c.id);
    const hasAllCards = cards.every(card => 
      playerCardIds.includes(card.id)
    );

    if (!hasAllCards) {
      return { success: false, message: '你没有这些牌' };
    }

    // 确定主牌花色和级别
    const pairRank = card1.rank;
    let trumpSuit = null;
    
    // 如果对子是级牌，则花色为主花色
    if (pairRank === this.currentLevel) {
      trumpSuit = card1.suit === card2.suit ? card1.suit : 'mixed';
    } else {
      trumpSuit = card1.suit === card2.suit ? card1.suit : 'mixed';
    }

    // 设置主牌信息
    this.trumpSuit = trumpSuit;
    this.trumpRank = pairRank;
    this.dealer = playerId;
    
    // 标记为庄家
    this.players.forEach((p, index) => {
      p.setDealer(index === playerId);
    });

    // 简化流程：亮主后直接进入出牌阶段
    this.gamePhase = 'playing';
    this.currentTurn = playerId; // 庄家先出牌

    console.log(`玩家 ${player.name} 亮主成功: ${trumpSuit} ${pairRank}`);

    return { 
      success: true, 
      trumpSuit: trumpSuit,
      trumpRank: pairRank,
      dealer: playerId
    };
  }

  // 扣底 (由庄家对门扣底)
  discardBottom(playerId, cardIndices) {
    if (this.gamePhase !== 'bidding') return false;
    
    const player = this.players[playerId];
    const discardedCards = player.playCards(cardIndices);
    
    // 将底牌给玩家，玩家扣掉相同数量的牌
    player.receiveCards([...player.cards, ...this.bottomCards]);
    this.bottomCards = discardedCards;
    
    this.gamePhase = 'playing';
    return true;
  }

  // 出牌
  playCards(playerId, cardIndices) {
    if (this.gamePhase !== 'playing') {
      return { success: false, message: '不在出牌阶段' };
    }
    
    if (playerId !== this.currentTurn) {
      return { success: false, message: '不是你的回合' };
    }
    
    const player = this.players[playerId];
    if (!player) {
      return { success: false, message: '玩家不存在' };
    }

    if (cardIndices.length === 0) {
      return { success: false, message: '必须选择至少一张牌' };
    }

    // 验证出牌是否合法（简化版，后续可扩展复杂规则）
    const isValidPlay = this.validateCardPlay(player, cardIndices);
    if (!isValidPlay.valid) {
      return { success: false, message: isValidPlay.message };
    }

    const playedCards = player.playCards(cardIndices);
    
    this.roundCards.push({
      playerId,
      cards: playedCards,
      playerName: player.name
    });
    
    // 下一个玩家
    this.currentTurn = (this.currentTurn + 1) % 4;
    
    // 如果一轮结束
    if (this.roundCards.length === 4) {
      this.evaluateRound();
    }
    
    return { 
      success: true, 
      cards: playedCards,
      nextPlayer: this.currentTurn 
    };
  }

  // 验证出牌是否合法
  validateCardPlay(player, cardIndices) {
    // 检查索引是否有效
    for (const index of cardIndices) {
      if (index < 0 || index >= player.cards.length) {
        return { valid: false, message: '无效的牌索引' };
      }
    }

    // 基础验证通过
    // TODO: 添加更复杂的山东升级规则验证
    // 比如：跟牌规则、花色要求、主杀规则等
    
    return { valid: true };
  }

  // 评估当前轮次
  evaluateRound() {
    // TODO: 实现山东升级的出牌规则判断
    // 包括：单张、对子、连对、闪(四张不同花色主牌)、雨(顺子)等
    
    const winner = this.findRoundWinner();
    this.lastWinner = winner;
    this.currentTurn = winner;
    
    // 计算得分
    const points = this.calculateRoundPoints();
    this.players[winner].addScore(points);
    
    // 准备下一轮
    this.roundCards = [];
    this.currentRound++;
    
    // 检查游戏是否结束
    if (this.isGameFinished()) {
      this.gamePhase = 'finished';
      this.calculateFinalResults();
    }
  }

  // 找出轮次获胜者
  findRoundWinner() {
    // TODO: 实现复杂的牌型比较逻辑
    // 暂时返回第一个玩家
    return this.roundCards[0].playerId;
  }

  // 计算轮次得分
  calculateRoundPoints() {
    let points = 0;
    
    for (const roundCard of this.roundCards) {
      for (const card of roundCard.cards) {
        // 5分牌值5分，10和K值10分
        if (card.rank === 5) points += 5;
        if (card.rank === 10 || card.rank === 'K') points += 10;
      }
    }
    
    return points;
  }

  // 检查游戏是否结束
  isGameFinished() {
    // 检查是否所有牌都出完
    return this.players.every(p => p.cards.length === 0);
  }

  // 计算最终结果
  calculateFinalResults() {
    // TODO: 实现升级规则
    // 根据闲家得分决定升级情况
    console.log('游戏结束，计算最终结果...');
  }

  // 获取游戏状态
  getGameState() {
    return {
      currentLevel: this.currentLevel,
      trumpSuit: this.trumpSuit,
      gamePhase: this.gamePhase,
      currentTurn: this.currentTurn,
      dealer: this.dealer,
      currentRound: this.currentRound,
      roundCards: this.roundCards,
      players: this.players.map(p => p.getStatus())
    };
  }

  // 获取玩家视角的游戏状态
  getPlayerGameState(playerId) {
    const gameState = this.getGameState();
    gameState.playerCards = this.players[playerId].cards;
    return gameState;
  }
}

module.exports = ShandongUpgradeGame;
