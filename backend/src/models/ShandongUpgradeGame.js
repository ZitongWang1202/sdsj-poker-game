const Card = require('./Card');

class ShandongUpgradeGame {
  constructor(players, debugMode = false, presetCards = null) {
    this.players = players;
    this.currentLevel = 2; // 当前级别
    this.trumpSuit = null; // 主牌花色
    this.trumpPlayer = null; // 亮主玩家
    this.firstTrumpPlayer = null; // 最先叫主的玩家（用于粘主交换）
    this.trumpRank = null; // 主牌级别
    this.counterTrumpPlayer = null; // 反主玩家
    this.counterTrumpEndTime = null; // 反主结束时间
    this.declareEndTime = null; // 发牌结束后10s的叫主截止
    this.stickEndTime = null; // 粘主阶段截止
    this.deck = [];
    this.bottomCards = []; // 底牌 (4张)
    this.currentRound = 0;
    this.currentTurn = 0; // 当前出牌玩家
    this.dealer = 0; // 庄家位置
    this.gamePhase = 'dealing'; // dealing, bidding, countering, sticking, playing, finished
    this.roundCards = []; // 当前轮次的出牌
    this.lastWinner = 0; // 上一轮获胜者
    this.dealingEndTime = null; // 发牌结束时间（由服务端动画结束时设置）
    this._timers = {
      declareTimer: null,
      counterTimer: null,
      stickTimer: null
    };
    this._pendingCounterUntilDealingEnd = false;
    this._pendingStickAfterDealing = false;
    this.stickInterrupted = false;
    
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
    
    // 进入发牌动画阶段，允许亮主，但不启动10秒窗口，等待动画结束再启动
    this.gamePhase = 'dealing';
  }

  // 亮主 (山东升级：需要一王带一对)
  declareTrump(playerId, cards) {
    // 允许在发牌动画过程中(dealing)和叫主阶段(bidding)亮主
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
    if (this.firstTrumpPlayer === null) {
      this.firstTrumpPlayer = playerId;
    }
    this.dealer = playerId;
    
    // 设置反主时间窗口（区分发牌中/发牌后）
    const declaredDuringDealing = this.gamePhase === 'dealing';
    this.setCounterTrumpWindow(declaredDuringDealing);
    // 有人亮主后，叫主等待计时器无效
    this._clearTimer('declareTimer');
    
    // 标记为庄家
    this.players.forEach((p, index) => {
      p.setDealer(index === playerId);
    });

    // 亮主后进入反主阶段
    this.gamePhase = 'countering';
    this.currentTurn = playerId; // 庄家最终会先出牌

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
  setCounterTrumpWindow(declaredDuringDealing = false) {
    // 规则：
    // - 若在发牌阶段亮主：反主时间 = 发牌结束时间 + 10s（需要有dealingEndTime）
    // - 若在发牌结束后亮主：反主时间 = 亮主时刻 + 10s
    const now = Date.now();
    if (declaredDuringDealing) {
      if (this.dealingEndTime) {
        this.counterTrumpEndTime = this.dealingEndTime + 10000;
        this._armCounterTimer();
      } else {
        // 先标记，待发牌动画结束后再设置准确截止时间
        this._pendingCounterUntilDealingEnd = true;
        this.counterTrumpEndTime = null;
        this._clearTimer('counterTimer');
      }
    } else {
      this.counterTrumpEndTime = now + 10000;
      this._armCounterTimer();
    }
    console.log(`设置反主时间窗口，结束时间: ${this.counterTrumpEndTime ? new Date(this.counterTrumpEndTime).toLocaleTimeString() : '待发牌结束确定'}`);
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

    // 检查叫主者不能反主
    if (playerId === this.firstTrumpPlayer) {
      return { success: false, message: '叫主者不能反主' };
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

    // 反主成功，更新主牌信息
    this.counterTrumpPlayer = playerId;
    this.trumpPlayer = playerId;
    this.dealer = playerId;
    
    // 反主后，主牌花色和级别由反主者的普通牌对决定
    this.trumpSuit = normal1.suit === normal2.suit ? normal1.suit : 'mixed';
    this.trumpRank = normal1.rank;
    
    // 一人反主之后其他人不能再反主
    this._clearTimer('counterTimer');
    
    // 如果是在发牌阶段反主，则等待发牌结束后再进入粘主阶段
    if (this.gamePhase === 'dealing' || this.dealingEndTime === null) {
      // 标记需要在发牌结束后进入粘主阶段
      this._pendingStickAfterDealing = true;
      console.log('发牌阶段反主成功，等待发牌结束后进入粘主阶段');
    } else {
      // 发牌已结束，直接进入粘主阶段
      this._enterStickPhase();
    }
    
    // 更新庄家标记
    this.players.forEach((p, index) => {
      p.setDealer(index === playerId);
    });

    console.log(`玩家 ${player.name} 反主成功: 一对${joker1.rank === 'big' ? '大王' : '小王'} + 一对${normal1.rank}，新主牌: ${this.trumpSuit} ${this.trumpRank}`);

    return { 
      success: true, 
      counterTrumpRank: joker1.rank,
      counterTrumpPair: normal1.rank,
      newDealer: playerId,
      counterTrumpEndTime: this.counterTrumpEndTime
    };
  }

  // 开始粘主（停止倒计时）
  startSticking(playerId) {
    if (this.gamePhase !== 'sticking') {
      return { success: false, message: '不在粘主阶段' };
    }

    // 参与限制检查（与stickTrump相同）
    const forbiddenPlayer = (this.counterTrumpPlayer === null) ? this.trumpPlayer : this.counterTrumpPlayer;
    if (playerId === forbiddenPlayer) {
      return { success: false, message: '当前身份不可参与粘主' };
    }

    // 标记粘主被中断，停止自动结束倒计时
    this.stickInterrupted = true;
    this._clearTimer('stickTimer');
    console.log(`玩家 ${playerId} 开始粘主，停止倒计时`);
    
    return { success: true };
  }

  // 粘主（5张：一张王 + 同花色相邻点数的两对，例如♥77♥88）并进行交换
  stickTrump(playerId, stickCards, giveBackCards) {
    if (this.gamePhase !== 'sticking') {
      return { success: false, message: '不在粘主阶段' };
    }

    // 参与限制：
    // - 若无人反主，则叫主者不可粘主，其他三人可粘主
    // - 若已反主，则反主者不可粘主，原叫主者可粘主，另外两人也可
    const forbiddenPlayer = (this.counterTrumpPlayer === null) ? this.trumpPlayer : this.counterTrumpPlayer;
    if (playerId === forbiddenPlayer) {
      return { success: false, message: '当前身份不可参与粘主' };
    }

    const player = this.players[playerId];
    const originalDeclarer = this.firstTrumpPlayer;
    if (originalDeclarer === null) {
      return { success: false, message: '无原始叫主者，无法粘主' };
    }
    const declarerPlayer = this.players[originalDeclarer];

    // 校验stickCards：必须恰好5张，其中1张王 + 4张同花色，组成两对且点数相邻
    if (!Array.isArray(stickCards) || stickCards.length !== 5) {
      return { success: false, message: '粘主需选择5张牌（1王+两对同花色相邻）' };
    }
    const jokers = stickCards.filter(c => c.suit === 'joker');
    const normals = stickCards.filter(c => c.suit !== 'joker');
    if (jokers.length !== 1 || normals.length !== 4) {
      return { success: false, message: '粘主需1张王与4张普通牌' };
    }
    const suits = new Set(normals.map(c => c.suit));
    if (suits.size !== 1) {
      return { success: false, message: '两对普通牌必须同花色' };
    }
    // 检查是否两对且点数相邻，例如 77 与 88
    const byRank = normals.reduce((m, c) => { m[c.rank] = (m[c.rank] || 0) + 1; return m; }, {});
    const pairRanks = Object.keys(byRank).filter(r => byRank[r] === 2);
    if (pairRanks.length !== 2) {
      return { success: false, message: '普通牌必须构成两对' };
    }
    const toNumeric = (r) => {
      const map = { 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
      return typeof r === 'number' ? r : map[r] || 0;
    };
    const r1 = toNumeric(pairRanks[0]);
    const r2 = toNumeric(pairRanks[1]);
    if (Math.abs(r1 - r2) !== 1) {
      return { success: false, message: '两对点数必须相邻' };
    }
    // 校验玩家是否拥有这5张牌
    const playerCardIds = new Set(player.cards.map(c => c.id));
    if (!stickCards.every(c => playerCardIds.has(c.id))) {
      return { success: false, message: '你没有这些粘主牌' };
    }

    // giveBackCards：3张，1张级牌或常主 + 2张与原叫主者对子同花色的牌
    if (!Array.isArray(giveBackCards) || giveBackCards.length !== 3) {
      return { success: false, message: '需给出3张回馈牌（1张级/常主 + 2张同花色）' };
    }
    // 原叫主者的主牌花色（不是粘主者的联对花色）
    const originalTrumpSuit = this.trumpSuit;
    const giveBackIds = new Set(giveBackCards.map(c => c.id));
    if (!giveBackCards.every(c => playerCardIds.has(c.id))) {
      return { success: false, message: '你没有这些回馈牌' };
    }
    const isLevelOrPermanent = (card) => {
      if (card.suit === 'joker') return false;
      if ([2, 3, 5].includes(card.rank)) return true; // 常主
      return card.rank === this.currentLevel; // 级牌
    };
    const levelOrPermanentCount = giveBackCards.filter(isLevelOrPermanent).length;
    const sameSuitCount = giveBackCards.filter(c => c.suit === originalTrumpSuit).length;
    if (levelOrPermanentCount !== 1 || sameSuitCount !== 2) {
      return { success: false, message: `回馈牌需1张级/常主 + 2张与原叫主者对子同花色(${originalTrumpSuit})` };
    }

    // 从原叫主者处收取：1张王 + 1对（尽量与联对点数较低的那对同点数；若没有，则任意一对）
    const declarerCards = declarerPlayer.cards;
    const takeFromDeclarer = [];
    // 取一张王
    const declarerJokerIndex = declarerCards.findIndex(c => c.suit === 'joker');
    if (declarerJokerIndex === -1) {
      return { success: false, message: '原叫主者没有王，无法完成粘主交换' };
    }
    takeFromDeclarer.push(declarerCards[declarerJokerIndex]);
    // 取一对
    const targetLowRank = Math.min(r1, r2);
    const ranksGrouped = declarerCards.reduce((m, c) => { const k = `${c.suit}_${c.rank}`; m[k] = (m[k] || []); m[k].push(c); return m; }, {});
    let pickedPairKey = null;
    // 优先同花色同点数targetLowRank（使用粘主者的联对花色）
    const normalsSuit = normals[0].suit; // 粘主者的联对花色，用于匹配原叫主者的对子
    const preferredKey = `${normalsSuit}_${Object.keys(byRank).find(r => toNumeric(r) === targetLowRank)}`;
    if (ranksGrouped[preferredKey] && ranksGrouped[preferredKey].length >= 2) {
      pickedPairKey = preferredKey;
    } else {
      // 任意存在的一对
      for (const [k, arr] of Object.entries(ranksGrouped)) {
        if (arr.length >= 2 && k !== 'joker_small' && k !== 'joker_big') { pickedPairKey = k; break; }
      }
    }
    if (!pickedPairKey) {
      return { success: false, message: '原叫主者没有可用的一对，无法粘主' };
    }
    const pairToTake = ranksGrouped[pickedPairKey].slice(0, 2);
    takeFromDeclarer.push(...pairToTake);

    // 执行交换
    // 1) 从粘主玩家移除giveBackCards（回馈牌，注意：stickCards不移除，因为粘主成功后保留）
    const removeFrom = (arr, cards) => {
      const ids = new Set(cards.map(c => c.id));
      for (let i = arr.length - 1; i >= 0; i--) {
        if (ids.has(arr[i].id)) arr.splice(i, 1);
      }
    };
    removeFrom(player.cards, giveBackCards); // 只移除回馈牌
    // 2) 从原叫主者移除被拿走的王+对子
    removeFrom(declarerPlayer.cards, takeFromDeclarer);
    // 3) 粘主玩家得到：从原叫主者处拿到的王+对子
    player.cards.push(...takeFromDeclarer);
    // 4) 原叫主者得到：粘主玩家给出的回馈牌（3张）
    declarerPlayer.cards.push(...giveBackCards);

    // 粘主成功后停止计时器并进入出牌阶段
    this._clearTimer('stickTimer');
    this.gamePhase = 'playing';
    this.currentTurn = this.dealer;
    console.log('粘主成功，进入出牌阶段');

    return {
      success: true,
      takenFromDeclarer: takeFromDeclarer,
      givenToDeclarer: giveBackCards,
      stickEndTime: this.stickEndTime
    };
  }

  // ===== 内部计时与阶段控制 =====
  _armDeclareTimer() {
    this._clearTimer('declareTimer');
    const ms = Math.max(0, (this.declareEndTime || 0) - Date.now());
    this._timers.declareTimer = setTimeout(() => {
      // 如果截止时仍无人亮主，则结束游戏
      if (this.trumpSuit === null) {
        this.gamePhase = 'finished';
        console.log('叫主阶段无人亮主，游戏结束');
      }
    }, ms);
  }

  _armCounterTimer() {
    this._clearTimer('counterTimer');
    const ms = Math.max(0, (this.counterTrumpEndTime || 0) - Date.now());
    this._timers.counterTimer = setTimeout(() => {
      // 反主期结束后，若无人反主，进入粘主阶段
      if (this.gamePhase === 'countering' && this.counterTrumpPlayer === null) {
        this._enterStickPhase();
        // 通知服务器广播粘主阶段开始
        this._onStickPhaseEntered && this._onStickPhaseEntered();
      }
    }, ms);
  }

  _enterStickPhase() {
    // 粘主阶段10s
    this.gamePhase = 'sticking';
    this.stickEndTime = Date.now() + 10000;
    this.stickInterrupted = false; // 标记粘主是否被中断（有人开始粘主）
    this._armStickTimer();
    console.log(`进入粘主阶段，截止时间: ${new Date(this.stickEndTime).toLocaleTimeString()}`);
  }

  _armStickTimer() {
    this._clearTimer('stickTimer');
    const ms = Math.max(0, (this.stickEndTime || 0) - Date.now());
    this._timers.stickTimer = setTimeout(() => {
      // 只有在粘主未被中断的情况下才自动结束
      if (!this.stickInterrupted && this.gamePhase === 'sticking') {
        // 粘主期结束后进入正式出牌阶段
        this.gamePhase = 'playing';
        // 开始出牌由庄家先
        this.currentTurn = this.dealer;
        console.log('粘主阶段结束，进入出牌阶段');
      }
    }, ms);
  }

  _clearTimer(name) {
    if (this._timers[name]) {
      clearTimeout(this._timers[name]);
      this._timers[name] = null;
    }
  }

  _clearAllPhaseTimers() {
    this._clearTimer('declareTimer');
    this._clearTimer('counterTimer');
    this._clearTimer('stickTimer');
  }

  // 由服务端在发牌动画完成时调用：开启10秒叫主窗口
  onDealingCompleted() {
    this.dealingEndTime = Date.now();
    // 若尚无人亮主，进入叫主阶段并开启10秒窗口
    if (this.trumpSuit === null && this.gamePhase === 'dealing') {
      this.gamePhase = 'bidding';
      this.declareEndTime = this.dealingEndTime + 10000;
      this._armDeclareTimer();
      console.log(`发牌动画结束，开始10秒亮主窗口，截止: ${new Date(this.declareEndTime).toLocaleTimeString()}`);
    }
    // 若发牌中已亮主且无人反主，统一设定反主截止=发牌结束+10s
    if (this.trumpSuit !== null && this.counterTrumpPlayer === null) {
      if (this._pendingCounterUntilDealingEnd || this.gamePhase === 'countering') {
        this.counterTrumpEndTime = this.dealingEndTime + 10000;
        this._armCounterTimer();
        this._pendingCounterUntilDealingEnd = false;
        console.log(`发牌结束，更新反主截止为: ${new Date(this.counterTrumpEndTime).toLocaleTimeString()}`);
      }
    }
    
    // 若在发牌阶段已经反主，现在发牌结束，进入粘主阶段
    if (this._pendingStickAfterDealing && this.counterTrumpPlayer !== null) {
      this._pendingStickAfterDealing = false;
      this._enterStickPhase();
      // 通知服务器广播粘主阶段开始
      this._onStickPhaseEntered && this._onStickPhaseEntered();
      console.log('发牌结束后进入粘主阶段（因为发牌期间已反主）');
    }
  }

  // 扣底 (由庄家对门扣底)
  discardBottom(playerId, cardIndices) {
    if (this.gamePhase !== 'bidding' && this.gamePhase !== 'countering' && this.gamePhase !== 'sticking') return false;
    
    const player = this.players[playerId];
    const discardedCards = player.playCards(cardIndices);
    
    // 将底牌给玩家，玩家扣掉相同数量的牌
    player.receiveCards([...player.cards, ...this.bottomCards]);
    this.bottomCards = discardedCards;
    
    this._clearAllPhaseTimers();
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
      firstTrumpPlayer: this.firstTrumpPlayer,
      counterTrumpPlayer: this.counterTrumpPlayer,
      counterTrumpEndTime: this.counterTrumpEndTime,
      declareEndTime: this.declareEndTime,
      stickEndTime: this.stickEndTime,
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
