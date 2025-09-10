const Card = require('./Card');

class ShandongUpgradeGame {
  constructor(players, debugMode = false, presetCards = null) {
    this.players = players;
    this.currentLevel = 2; // 当前级别
    this.trumpSuit = null; // 主牌花色
    this.trumpPlayer = null; // 亮主玩家
    this.trumpRank = null; // 主牌级别
    this.counterTrumpPlayer = null; // 反主玩家
    this.counterTrumpEndTime = null; // 反主结束时间
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
    
    // 调试模式
    this.debugMode = debugMode;
    this.presetCards = presetCards;
    
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
    
    // 如果是调试模式且有预设手牌，使用预设手牌
    if (this.debugMode && this.presetCards) {
      console.log('🎯 调试模式：使用预设手牌');
      for (let i = 0; i < this.players.length; i++) {
        if (this.presetCards[i]) {
          this.players[i].receiveCards(this.presetCards[i]);
        } else {
          // 如果没有预设手牌，使用随机发牌
          const playerCards = this.deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
          this.players[i].receiveCards(playerCards);
        }
      }
    } else {
      // 正常发牌
      for (let i = 0; i < this.players.length; i++) {
        const playerCards = this.deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
        this.players[i].receiveCards(playerCards);
      }
    }
    
    // 剩余4张作为底牌
    this.bottomCards = this.deck.slice(this.players.length * cardsPerPlayer);
    
    // 发牌阶段，允许亮主
    this.gamePhase = 'dealing';
  }

  // 亮主 (山东升级：需要一王带一对)
  declareTrump(playerId, cards) {
    // 允许在发牌阶段和亮主阶段亮主
    if (this.gamePhase !== 'bidding' && this.gamePhase !== 'dealing') {
      return { success: false, message: '不在亮主阶段' };
    }

    // 检查是否已经有人亮主
    if (this.trumpSuit !== null) {
      return { success: false, message: '已经有人亮主了' };
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
    this.trumpPlayer = playerId;
    this.dealer = playerId;
    
    // 设置反主时间窗口
    this.setCounterTrumpWindow();
    
    // 标记为庄家
    this.players.forEach((p, index) => {
      p.setDealer(index === playerId);
    });

    // 亮主后进入出牌阶段
    this.gamePhase = 'bidding';
    this.currentTurn = playerId; // 庄家先出牌

    console.log(`玩家 ${player.name} 亮主成功: ${trumpSuit} ${pairRank}`);

    return { 
      success: true, 
      trumpSuit: trumpSuit,
      trumpRank: pairRank,
      dealer: playerId,
      counterTrumpEndTime: this.counterTrumpEndTime
    };
  }

  // 设置反主时间窗口
  setCounterTrumpWindow() {
    // 如果是在发牌阶段亮主，反主时间到发牌结束+10秒
    // 如果是在发牌结束后亮主，反主时间从亮主开始+10秒
    const now = Date.now();
    this.counterTrumpEndTime = now + 10000; // 10秒后结束反主
    console.log(`设置反主时间窗口，结束时间: ${new Date(this.counterTrumpEndTime).toLocaleTimeString()}`);
  }

  // 反主 (用一对王反主)
  counterTrump(playerId, cards) {
    // 检查是否在反主时间窗口内
    if (this.counterTrumpEndTime && Date.now() > this.counterTrumpEndTime) {
      return { success: false, message: '反主时间已过' };
    }

    // 检查是否已经有人反主
    if (this.counterTrumpPlayer !== null) {
      return { success: false, message: '已经有人反主了' };
    }

    const player = this.players[playerId];
    if (!player) {
      return { success: false, message: '玩家不存在' };
    }

    // 反主规则: 必须是一对王（大王对或小王对）加上一对牌
    if (cards.length !== 4) {
      return { success: false, message: '反主需要选择4张牌（一对王+一对牌）' };
    }

    // 检查是否有王牌
    const jokers = cards.filter(card => card.suit === 'joker');
    const normalCards = cards.filter(card => card.suit !== 'joker');

    if (jokers.length !== 2) {
      return { success: false, message: '反主必须包含一对王牌' };
    }

    if (normalCards.length !== 2) {
      return { success: false, message: '反主必须包含一对普通牌' };
    }

    // 检查王牌是否是一对（相同等级的王）
    const [joker1, joker2] = jokers;
    if (joker1.rank !== joker2.rank) {
      return { success: false, message: '王牌必须是一对相同的王' };
    }

    // 检查普通牌是否是一对（相同点数）
    const [normal1, normal2] = normalCards;
    if (normal1.rank !== normal2.rank) {
      return { success: false, message: '普通牌必须是一对（相同点数）' };
    }

    // 检查玩家是否确实拥有这些牌
    const playerCardIds = player.cards.map(c => c.id);
    const hasAllCards = cards.every(card => 
      playerCardIds.includes(card.id)
    );

    if (!hasAllCards) {
      return { success: false, message: '你没有这些牌' };
    }

    // 反主成功
    this.counterTrumpPlayer = playerId;
    this.trumpPlayer = playerId;
    this.dealer = playerId;
    
    // 重新设置反主时间窗口（反主后还可以再反主）
    this.setCounterTrumpWindow();
    
    // 更新庄家标记
    this.players.forEach((p, index) => {
      p.setDealer(index === playerId);
    });

    console.log(`玩家 ${player.name} 反主成功: 一对${joker1.rank === 'big' ? '大王' : '小王'} + 一对${normal1.rank}`);

    return { 
      success: true, 
      counterTrumpRank: joker1.rank,
      counterTrumpPair: normal1.rank,
      newDealer: playerId,
      counterTrumpEndTime: this.counterTrumpEndTime
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
      trumpRank: this.trumpRank,
      trumpPlayer: this.trumpPlayer,
      counterTrumpPlayer: this.counterTrumpPlayer,
      counterTrumpEndTime: this.counterTrumpEndTime,
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
