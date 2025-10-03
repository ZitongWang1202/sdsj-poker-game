const Card = require('./Card');

// 牌型识别和验证工具函数
class CardTypeValidator {
  static isCardTrump(card, currentLevel = 2, trumpSuit = null) {
    // 统一点数字段为字符串，避免数值/字符串比较导致误判
    const rankStr = String(card.rank);
    const levelStr = String(currentLevel);

    // 大小王总是主牌
    if (card.suit === 'joker') return true;

    // 级牌总是主牌
    if (rankStr === levelStr) return true;

    // 山东升级：2,3,5为常主
    if (['2', '3', '5'].includes(rankStr)) return true;

    // 主花色的牌
    if (card.suit === trumpSuit) return true;

    return false;
  }

  static getCardValue(card, currentLevel = 2, trumpSuit = null) {
    // 大王和小王
    if (card.suit === 'joker') {
      return card.rank === 'small' ? 998 : 999;
    }
    
    // 统一点数字段为字符串
    const rankStrGV = String(card.rank);
    const levelStrGV = String(currentLevel);

    // 级牌的特殊处理
    if (rankStrGV === levelStrGV) {
      if (card.suit === trumpSuit) {
        return 997; // 主级牌
      } else {
        return 996; // 副级牌
      }
    }
    
    // 常主牌的处理：2,3,5
    const permanentTrumps = ['2', '3', '5'];
    if (permanentTrumps.includes(rankStrGV) && rankStrGV !== levelStrGV) {
      if (card.suit === trumpSuit) {
        // 主牌中的常主
        if (rankStrGV === '5') return 995;
        if (rankStrGV === '3') return 993;
        if (rankStrGV === '2') return 991;
      } else {
        // 副牌中的常主
        if (rankStrGV === '5') return 994;
        if (rankStrGV === '3') return 992;
        if (rankStrGV === '2') return 990;
      }
    }
    
    // 其他牌的基础值（按升级规则：A>K>Q>J>10>9>8>7>6>4，相邻牌差值为1）
    const rankValues = {
      'A': 914, 'K': 913, 'Q': 912, 'J': 911, 
      10: 910, 9: 909, 8: 908, 7: 907, 6: 906, 4: 904
    };
    
    const baseValue = rankValues[rankStrGV] || 0;
    
    // 如果是主花色但不是级牌也不是常主的普通牌
    if (card.suit === trumpSuit && !permanentTrumps.includes(rankStrGV) && rankStrGV !== levelStrGV) {
      // 主花色普通牌的权重应该低于所有特殊主牌，但高于副牌
      // 特殊主牌权重: 大王999, 小王998, 主级牌997, 副级牌996, 常主995-990
      // 主花色普通牌权重范围: 980-989（保持连续性）
      const trumpNormalRankValues = {
        'A': 989, 'K': 988, 'Q': 987, 'J': 986, 
        10: 985, 9: 984, 8: 983, 7: 982, 6: 981, 4: 980
      };
      return trumpNormalRankValues[rankStrGV] || 980;
    }
    
    return baseValue;
  }

  static identifyCardType(cards, currentLevel = 2, trumpSuit = null) {
    if (!cards || cards.length === 0) {
      return { type: 'invalid', message: '没有选择牌' };
    }

    // 单张
    if (cards.length === 1) {
      return {
        type: 'single',
        name: '单张',
        cards: cards,
        message: `单张`
      };
    }

    // 对子
    if (cards.length === 2) {
      const result = this.identifyPair(cards, currentLevel, trumpSuit);
      if (result.valid) {
        return {
          type: 'pair',
          name: '对子',
          cards: cards,
          message: `对子`
        };
      }
    }

    // 连对（拖拉机）
    if (cards.length >= 4 && cards.length % 2 === 0) {
      const consecutivePairs = this.identifyConsecutivePairs(cards, currentLevel, trumpSuit);
      if (consecutivePairs.valid) {
        return {
          type: 'consecutive_pairs',
          name: '连对',
          cards: cards,
          message: `${consecutivePairs.pairCount}连对`
        };
      }
    }

    // 闪/震（四张不同花色的主牌）
    if (cards.length >= 4) {
      const flash = this.identifyFlash(cards, currentLevel, trumpSuit);
      if (flash.valid) {
        return {
          type: flash.type,
          name: flash.name,
          cards: cards,
          message: flash.message
        };
      }
    }

    // 雨（顺子）
    if (cards.length >= 5) {
      const straight = this.identifyStraight(cards, currentLevel, trumpSuit);
      if (straight.valid) {
        return {
          type: 'straight',
          name: '雨',
          cards: cards,
          message: `${cards.length}张雨`
        };
      }
    }

    // 甩牌验证
    const mixedValidation = this.validateMixed(cards, currentLevel, trumpSuit);
    if (mixedValidation.valid) {
      return {
        type: 'mixed',
        name: '甩牌',
        cards: cards,
        message: `${cards.length}张甩牌`
      };
    } else {
      return {
        type: 'invalid',
        name: '无效牌型',
        cards: cards,
        message: mixedValidation.message
      };
    }
  }

  static identifyPair(cards, currentLevel = 2, trumpSuit = null) {
    if (cards.length !== 2) return { valid: false };
    
    const [card1, card2] = cards;
    
    // 检查是否相同点数
    if (card1.rank === card2.rank) {
      return { 
        valid: true, 
        rank: card1.rank,
        isTrumpPair: this.isCardTrump(card1, currentLevel, trumpSuit)
      };
    }
    
    return { valid: false };
  }

  // 获取用于连续性检查的牌值（专门用于连对和顺子判定）
  static getSequentialValue(card, currentLevel = 2, trumpSuit = null) {
    // 先判断是否为主牌
    const isTrump = this.isCardTrump(card, currentLevel, trumpSuit);
    
    // 主牌按照升级规则排序：大王 > 小王 > 主级牌 > 副级牌 > 常主（5>3>2）> 主花色普通牌
    if (isTrump) {
      // 大小王
      if (card.suit === 'joker') {
        return card.rank === 'small' ? 1000 : 1001;
      }
      
      // 级牌
      if (card.rank === currentLevel) {
        if (card.suit === trumpSuit) {
          return 999; // 主级牌
        } else {
          return 998; // 副级牌
        }
      }
      
      // 常主牌（2,3,5）- 使用非连续数值，防止形成连对
      const permanentTrumps = ['2', '3', '5'];
      if (permanentTrumps.includes(card.rank)) {
        if (card.suit === trumpSuit) {
          // 主花色常主 - 使用大间隔的数值，确保不连续
          if (card.rank === '5') return 950;  // 间隔50
          if (card.rank === '3') return 900;  // 间隔50
          if (card.rank === '2') return 850;  // 间隔50
        } else {
          // 副花色常主 - 同样使用大间隔
          if (card.rank === '5') return 800;
          if (card.rank === '3') return 750;
          if (card.rank === '2') return 700;
        }
      }
      
      // 主花色普通牌 - 使用连续的数值
      if (card.suit === trumpSuit) {
        const trumpRankOrder = ['A', 'K', 'Q', 'J', 10, 9, 8, 7, 6, 4];
        const index = trumpRankOrder.indexOf(card.rank);
        if (index !== -1) {
          return 991 - index; // 从991开始递减，保持连续性
        }
      }
      
      // 不应该到这里，但防御性编程
      return 980;
    } else {
      // 副牌：使用基础的连续序列，排除常主和级牌
      const isLevelCard = card.rank === currentLevel;
      const isPermanentTrump = [2, 3, 5].includes(card.rank);
      
      // 级牌和常主不能作为副牌参与连对
      if (isLevelCard || isPermanentTrump) {
        return -1; // 特殊标记，表示无法参与副牌连对
      }
      
      // B2规则：副牌按自然连续序列（包含5），但5本身被标记为常主且已在上方返回-1
      // 因此6与4之间存在断点（缺少5）将不视为连续
      const suitRankOrder = ['A', 'K', 'Q', 'J', 10, 9, 8, 7, 6, 5, 4];
      const index = suitRankOrder.indexOf(card.rank);
      if (index !== -1) {
        return 100 + (suitRankOrder.length - 1 - index); // 从100开始递增，保持连续性
      }
      
      return 0;
    }
  }

  static identifyConsecutivePairs(cards, currentLevel = 2, trumpSuit = null) {
    console.log(`🔍 连对识别 - 输入牌: ${cards.map(c => `${c.suit}_${c.rank}`).join(', ')}`);
    
    if (cards.length < 4 || cards.length % 2 !== 0) {
      console.log(`❌ 连对识别失败 - 牌数不符合要求 (需要>=4张且为偶数)`);
      return { valid: false };
    }

    // 按点数分组
    const rankGroups = {};
    for (const card of cards) {
      const rank = card.rank;
      if (!rankGroups[rank]) {
        rankGroups[rank] = [];
      }
      rankGroups[rank].push(card);
    }

    console.log(`🔍 分组结果:`, Object.entries(rankGroups).map(([rank, cards]) => `${rank}: ${cards.length}张`).join(', '));

    // 检查每个点数是否都恰好有2张牌（形成对子）
    const pairs = [];
    for (const [rank, cardsOfRank] of Object.entries(rankGroups)) {
      if (cardsOfRank.length !== 2) {
        console.log(`❌ 连对识别失败 - ${rank}有${cardsOfRank.length}张牌，不是对子`);
        return { valid: false }; // 必须恰好2张才能形成对子
      }
      
      const [card1, card2] = cardsOfRank;
      
      // 检查花色是否匹配（对子必须同花色，除了王牌）
      if (card1.suit !== card2.suit) {
        // 王牌的特殊处理：大王对大王，小王对小王
        if (card1.suit === 'joker' && card2.suit === 'joker' && card1.rank === card2.rank) {
          // 王对王，允许
        } else {
          console.log(`❌ 连对识别失败 - ${rank}的两张牌花色不同 (${card1.suit} vs ${card2.suit})`);
          return { valid: false };
        }
      }
      
      const firstCard = cardsOfRank[0];
      const isTrumpPair = this.isCardTrump(firstCard, currentLevel, trumpSuit);
      const sequentialValue = this.getSequentialValue(firstCard, currentLevel, trumpSuit);
      
      // 检查是否有无效的牌值（例如副牌中的常主）
      if (sequentialValue === -1) {
        console.log(`❌ 连对识别失败 - ${rank}不能参与当前花色的连对`);
        return { valid: false };
      }
      
      pairs.push({
        rank: rank,
        value: sequentialValue,
        isTrump: isTrumpPair
      });
      
      console.log(`✅ 对子: ${rank}, 连续值: ${sequentialValue}, 主牌: ${isTrumpPair}`);
    }

    // 检查对子数量是否正确
    if (pairs.length !== cards.length / 2) {
      console.log(`❌ 连对识别失败 - 对子数量不正确: ${pairs.length} vs ${cards.length / 2}`);
      return { valid: false };
    }

    // 检查主副牌是否混合
    const firstPairIsTrump = pairs[0].isTrump;
    if (!pairs.every(p => p.isTrump === firstPairIsTrump)) {
      console.log(`❌ 连对识别失败 - 主副牌混合`);
      return { valid: false };
    }

    // 检查连对中所有牌是否为同一花色（除了王牌）
    const allSuits = new Set(cards.map(card => card.suit));
    if (allSuits.size > 1) {
      // 如果有多种花色，只有全部是王牌才允许
      const hasNonJoker = cards.some(card => card.suit !== 'joker');
      if (hasNonJoker) {
        console.log(`❌ 连对识别失败 - 连对中包含多种花色`);
        return { valid: false };
      }
    }

    // 检查是否连续
    pairs.sort((a, b) => a.value - b.value);
    console.log(`🔍 排序后的对子:`, pairs.map(p => `${p.rank}(${p.value})`).join(' → '));
    
    for (let i = 1; i < pairs.length; i++) {
      const diff = pairs[i].value - pairs[i-1].value;
      console.log(`🔍 连续性检查: ${pairs[i-1].rank}(${pairs[i-1].value}) → ${pairs[i].rank}(${pairs[i].value}), 差值: ${diff}`);
      
      if (diff !== 1) {
        console.log(`❌ 连对识别失败 - 牌值不连续: 差值${diff}`);
        return { valid: false };
      }
    }

    console.log(`✅ 连对识别成功!`);
    return { 
      valid: true, 
      pairCount: pairs.length,
      isTrump: pairs[0].isTrump
    };
  }

  static identifyFlash(cards, currentLevel = 2, trumpSuit = null) {
    // 必须都是主牌
    const trumpCards = cards.filter(card => this.isCardTrump(card, currentLevel, trumpSuit));
    if (trumpCards.length !== cards.length) {
      return { valid: false };
    }

    // 检查是否四张不同花色
    if (cards.length >= 4) {
      const suits = new Set(cards.map(card => card.suit));
      const ranks = new Set(cards.map(card => card.rank));
      
      // 四张相同点数，四种不同花色
      if (ranks.size === 1 && suits.size === 4) {
        // 仅允许由 级牌 或 常主(2/3/5) 构成
        const rankStr = String(cards[0].rank);
        const levelStr = String(currentLevel);
        const allowed = rankStr === levelStr || ['2','3','5'].includes(rankStr);
        if (!allowed) {
          return { valid: false };
        }
        if (cards.length === 4) {
          return {
            valid: true,
            type: 'flash',
            name: '闪',
            message: `闪`
          };
        } else {
          return {
            valid: true,
            type: 'thunder',
            name: '震',
            message: `震`
          };
        }
      }
    }

    return { valid: false };
  }

  static identifyStraight(cards, currentLevel = 2, trumpSuit = null) {
    if (!cards || cards.length < 5) return { valid: false };

    // 1) 必须同一花色，且不能包含王
    const suit = cards[0].suit;
    if (suit === 'joker') return { valid: false };
    if (!cards.every(card => card.suit === suit && card.suit !== 'joker')) {
      return { valid: false };
    }

    // 2) 雨可为副牌或主花色，但不能包含当前级牌，也不能包含常主2/3/5
    const levelStr = String(currentLevel);
    const forbiddenRanks = new Set(['2','3','5', levelStr]);
    if (cards.some(c => forbiddenRanks.has(String(c.rank)))) {
      return { valid: false };
    }

    // 3) 若为副牌花色：不得包含任何会被判为主的牌（安全网）
    const isTrumpSuit = trumpSuit && suit === trumpSuit;
    if (!isTrumpSuit) {
      const hasTrumpCard = cards.some(card => this.isCardTrump(card, currentLevel, trumpSuit));
      if (hasTrumpCard) return { valid: false };
    }

    // 4) 计算秩序并检查“覆盖连续区间”。允许重复（两幅牌），但所有牌值必须落在该连续区间内
    const order = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];
    const toIdx = (r) => order.indexOf(r);
    const idxs = cards.map(c => toIdx(c.rank)).filter(i => i >= 0);
    if (idxs.length !== cards.length) return { valid: false };

    const unique = [...new Set(idxs)].sort((a, b) => a - b);
    if (unique.length < 5) return { valid: false };
    for (let i = 1; i < unique.length; i++) {
      if (unique[i] !== unique[i - 1] + 1) return { valid: false };
    }

    const minIdx = unique[0];
    const maxIdx = unique[unique.length - 1];
    if (!idxs.every(i => i >= minIdx && i <= maxIdx)) return { valid: false };

    return { valid: true };
  }

  // 验证甩牌规则
  static validateMixed(cards, currentLevel = 2, trumpSuit = null) {
    if (!cards || cards.length === 0) {
      return { valid: false, message: '没有选择牌' };
    }

    // 检查主副牌是否混合
    const trumpCards = cards.filter(card => this.isCardTrump(card, currentLevel, trumpSuit));
    const nonTrumpCards = cards.filter(card => !this.isCardTrump(card, currentLevel, trumpSuit));
    
    if (trumpCards.length > 0 && nonTrumpCards.length > 0) {
      return { valid: false, message: '甩牌不能混合主副牌' };
    }

    // 如果全部是主牌，则认为花色一致（主牌视为同一花色）
    if (trumpCards.length === cards.length) {
      return { valid: true };
    }

    // 如果全部是副牌，检查花色是否一致
    if (nonTrumpCards.length === cards.length) {
      const allSuits = new Set(cards.map(card => card.suit));
      if (allSuits.size > 1) {
        return { valid: false, message: '甩牌不能混合花色' };
      }
    }

    return { valid: true };
  }
}

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
    this.gamePhase = 'dealing'; // dealing, bidding, countering, sticking, bottom, playing, finished
    this.bottomPlayer = null; // 摸底玩家
    this.lastRoundWinner = null; // 上一把获胜方（0或2表示坐庄方，1或3表示挑战方）
    this.isFirstRound = true; // 是否第一局
    this.idleScore = 0; // 闲家得分
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
      
      // 首先从deck中移除所有预设牌，避免重复发牌
      const allPresetCards = [];
      for (let i = 0; i < this.presetCards.length; i++) {
        if (this.presetCards[i]) {
          allPresetCards.push(...this.presetCards[i]);
        }
      }
      
      // 从deck中移除预设牌
      this.deck = this.deck.filter(deckCard => {
        return !allPresetCards.some(presetCard => presetCard.id === deckCard.id);
      });
      
      console.log(`🔍 预设发牌：从deck中移除了${allPresetCards.length}张预设牌，剩余${this.deck.length}张牌`);
      
      // 给每个玩家发牌
      for (let i = 0; i < this.players.length; i++) {
        let playerCards = [];
        
        // 首先添加预设牌
        if (this.presetCards[i]) {
          playerCards.push(...this.presetCards[i]);
          console.log(`👤 玩家${i}收到${this.presetCards[i].length}张预设牌`);
        }
        
        // 如果预设牌不足26张，从剩余deck中补充
        const needMoreCards = cardsPerPlayer - playerCards.length;
        if (needMoreCards > 0) {
          const additionalCards = this.deck.splice(0, needMoreCards);
          playerCards.push(...additionalCards);
          console.log(`👤 玩家${i}从剩余牌中补充${additionalCards.length}张牌`);
        }
        
        this.players[i].receiveCards(playerCards);
        
        // 验证牌的唯一性
        const cardIds = playerCards.map(c => c.id);
        const uniqueIds = [...new Set(cardIds)];
        if (cardIds.length !== uniqueIds.length) {
          console.error(`❌ 玩家${i}发牌后仍有重复牌！`);
        } else {
          console.log(`✅ 玩家${i}发牌无重复，共${cardIds.length}张牌`);
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
    this.bottomCards = this.deck.slice(0, 4);
    
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

    // 亮主后的游戏阶段处理
    if (declaredDuringDealing) {
      // 发牌期间亮主：保持dealing状态，等发牌结束后再进入countering
      // gamePhase保持为'dealing'
      console.log('发牌期间亮主，保持dealing状态直到发牌结束');
    } else {
      // 发牌结束后亮主：直接进入反主阶段
      this.gamePhase = 'countering';
      console.log('发牌结束后亮主，直接进入countering状态');
    }
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

    // 粘主成功后停止计时器并进入摸底阶段
    this._clearTimer('stickTimer');
    this._enterBottomPhase();
    console.log('粘主成功，进入摸底阶段');

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
        // 粘主期结束后进入摸底阶段
        this._enterBottomPhase();
        console.log('粘主阶段结束，进入摸底阶段');
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
    // 若发牌中已亮主，现在发牌结束，进入反主阶段
    if (this.trumpSuit !== null && this.gamePhase === 'dealing') {
      this.gamePhase = 'countering';
      console.log('发牌结束，发牌期间已亮主，现在进入countering状态');
      
      // 设定反主截止时间并启动计时器
      if (this.counterTrumpPlayer === null) {
        this.counterTrumpEndTime = this.dealingEndTime + 10000;
        this._armCounterTimer();
        console.log(`发牌结束，更新反主截止为: ${new Date(this.counterTrumpEndTime).toLocaleTimeString()}`);
      }
    }
    
    // 处理其他情况（保持原有逻辑）
    if (this.trumpSuit !== null && this.counterTrumpPlayer === null && this.gamePhase === 'countering') {
      if (this._pendingCounterUntilDealingEnd) {
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

  // 出牌（根据牌ID）
  playCardsByIds(playerId, cardIds) {
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

    if (cardIds.length === 0) {
      return { success: false, message: '必须选择至少一张牌' };
    }

    // 根据ID查找要出的牌
    const cardsToPlay = [];
    const cardIndicesToRemove = [];
    
    for (const cardId of cardIds) {
      const cardIndex = player.cards.findIndex(card => card.id === cardId);
      if (cardIndex === -1) {
        return { success: false, message: `牌不存在: ${cardId}` };
      }
      cardsToPlay.push(player.cards[cardIndex]);
      cardIndicesToRemove.push(cardIndex);
    }

    // 验证出牌合法性
    const validation = this.validatePlayCards(playerId, cardsToPlay);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    // 检查是否需要强制出牌
    let finalCardsToPlay = cardsToPlay;
    let finalCardType = validation.cardType;
    
    if (validation.forcedCards) {
      // 强制出牌：需要从玩家手牌中找到对应的牌
      finalCardsToPlay = this.findCardsInHand(player, validation.forcedCards);
      if (!finalCardsToPlay) {
        return { success: false, message: '无法找到强制出牌的牌' };
      }
      finalCardType = validation.forcedCardType;
    }

    // 从玩家手牌中移除选中的牌
    const playedCards = player.playCardsByIds(cardIds);
    
    this.roundCards.push({
      playerId,
      cards: playedCards,
      playerName: player.name,
      cardType: finalCardType
    });
    
    // 下一个玩家
    this.currentTurn = (this.currentTurn + 1) % 4;
    
    // 如果一轮结束
    if (this.roundCards.length === 4) {
      const finalResult = this.evaluateRound();
      
      // 如果游戏结束，返回最终结果
      if (finalResult) {
        return { 
          success: true, 
          cards: playedCards,
          cardType: validation.cardType,
          nextPlayer: this.currentTurn,
          finalResult: finalResult
        };
      }
    }
    
    return { 
      success: true, 
      cards: playedCards,
      cardType: validation.cardType,
      nextPlayer: this.currentTurn 
    };
  }

  // 出牌（根据索引，保留向后兼容性）
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

    // 获取要出的牌
    const cardsToPlay = cardIndices.map(index => player.cards[index]).filter(card => card);
    if (cardsToPlay.length !== cardIndices.length) {
      return { success: false, message: '选中的牌无效' };
    }

    // 验证出牌合法性
    const validation = this.validatePlayCards(playerId, cardsToPlay);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    const playedCards = player.playCards(cardIndices);
    
    this.roundCards.push({
      playerId,
      cards: playedCards,
      playerName: player.name,
      cardType: validation.cardType
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
      cardType: validation.cardType,
      nextPlayer: this.currentTurn 
    };
  }

  // 验证出牌是否合法
  validatePlayCards(playerId, cardsToPlay) {
    // 识别牌型
    const cardType = CardTypeValidator.identifyCardType(cardsToPlay, this.currentLevel, this.trumpSuit);
    
    // 如果是第一个出牌的玩家（lead player）
    if (this.roundCards.length === 0) {
      // lead玩家可以出任何有效牌型
      if (cardType.type === 'invalid') {
        return { valid: false, message: '无效的牌型' };
      }
      
      // 如果是甩牌（mixed），需要立即判定是否会被否定
      if (cardType.type === 'mixed') {
        const mixedValidation = this.judgeLeadMixedAndForce(cardsToPlay, playerId);
        if (mixedValidation.shouldForce) {
          return {
            valid: true,
            cardType: mixedValidation.forcedCardType,
            isLead: true,
            forcedCards: mixedValidation.forcedCards,
            message: `甩牌被否定，强制出${mixedValidation.forcedCardType.name}`
          };
        }
      }
      
      return { 
        valid: true, 
        cardType: cardType,
        isLead: true 
      };
    }
    
    // 跟牌验证
    const leadCard = this.roundCards[0];
    const validation = this.validateFollowCards(cardsToPlay, leadCard, cardType);
    
    return {
      valid: validation.valid,
      message: validation.message,
      cardType: cardType,
      isLead: false
    };
  }

  // 验证跟牌规则
  validateFollowCards(cardsToPlay, leadCard, cardType) {
    const leadCardType = leadCard.cardType;
    
    // 必须出相同数量的牌
    if (cardsToPlay.length !== leadCard.cards.length) {
      return { 
        valid: false, 
        message: `必须出${leadCard.cards.length}张牌` 
      };
    }
    
    // 花色跟牌规则
    const leadSuit = this.getLeadSuit(leadCard.cards);
    const playerId = this.currentTurn; // 当前出牌玩家
    const hasLeadSuit = this.playerHasLeadSuit(playerId, leadSuit);
    
    // 如果有对应花色，检查是否有足够的牌跟牌
    if (hasLeadSuit) {
      const availableCards = this.getPlayerCardsOfSuit(playerId, leadSuit);
      
      // 如果该花色的牌数够出牌，必须跟花色
      if (availableCards.length >= cardsToPlay.length) {
        if (!this.isFollowingSuit(cardsToPlay, leadSuit)) {
          return { 
            valid: false, 
            message: `有${this.getSuitName(leadSuit)}必须跟牌` 
          };
        }
      }
      // 如果该花色的牌数不够，允许垫牌（混合花色出牌）
    }
    
    // 牌型匹配规则
    const typeMatch = this.validateCardTypeMatch(
      cardType, 
      leadCardType, 
      hasLeadSuit, 
      playerId, 
      cardsToPlay, 
      leadCard
    );
    if (!typeMatch.valid) {
      return typeMatch;
    }
    
    return { valid: true };
  }

  // 获取lead花色
  getLeadSuit(leadCards) {
    const firstCard = leadCards[0];
    if (CardTypeValidator.isCardTrump(firstCard, this.currentLevel, this.trumpSuit)) {
      return 'trump'; // 主牌
    }
    return firstCard.suit;
  }

  // 检查玩家是否有对应花色
  playerHasLeadSuit(playerId, leadSuit) {
    const player = this.players[playerId];
    if (!player) return false;
    
    if (leadSuit === 'trump') {
      // 检查是否有主牌
      return player.cards.some(card => 
        CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
      );
    } else {
      // 检查是否有对应花色的副牌
      return player.cards.some(card => 
        card.suit === leadSuit && 
        !CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
      );
    }
  }

  // 检查是否跟了对应花色
  isFollowingSuit(cards, leadSuit) {
    if (leadSuit === 'trump') {
      return cards.every(card => 
        CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
      );
    }
    // 非主花色时，需要是对应花色且不是主牌（排除常主/级牌/王/主花色）
    return cards.every(card => 
      card.suit === leadSuit && 
      !CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
    );
  }

  // 获取玩家在指定花色上的所有牌
  getPlayerCardsOfSuit(playerId, leadSuit) {
    const player = this.players[playerId];
    if (!player) return [];
    
    if (leadSuit === 'trump') {
      // 返回所有主牌
      return player.cards.filter(card => 
        CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
      );
    } else {
      // 返回对应花色的副牌
      return player.cards.filter(card => 
        card.suit === leadSuit && 
        !CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
      );
    }
  }

  // 验证牌型匹配
  validateCardTypeMatch(followType, leadType, hasLeadSuit, playerId, cardsToPlay, leadCard) {
    // 获取玩家在对应花色上的牌
    const leadSuit = this.getLeadSuit(leadCard.cards);
    const availableCards = this.getPlayerCardsOfSuit(playerId, leadSuit);
    
    // 重新判断是否有足够的对应花色牌进行强制跟牌检查
    const hasEnoughLeadSuit = hasLeadSuit && availableCards.length >= cardsToPlay.length;
    
    // 如果有足够的对应花色，需要检查强制跟牌规则
    if (hasEnoughLeadSuit) {
      // 检查强制跟牌规则
      const player = this.players[playerId];
      const mandatoryFollow = this.checkMandatoryFollow(
        leadCard, 
        cardsToPlay, 
        availableCards, 
        leadSuit,
        player.cards // 传入全部手牌用于检查对子
      );
      
      if (!mandatoryFollow.valid) {
        return mandatoryFollow;
      }
      
      // 如果强制跟牌验证通过，则跟牌合法（不需要检查牌型匹配）
      return { valid: true };
    }
    
    // 没有足够对应花色：允许垫牌。这里不再前置限制“主杀必须同型同量”，
    // 是否能赢交由 compareCards 中的 isQualifiedTrumpKill 判断。
    // 因此无论出副牌还是任意主牌组合，这里都放行。
    return { valid: true };
  }

  // 获取跟牌优先级
  getFollowPriority(leadType) {
    const priorities = {
      'single': ['single'],
      'pair': ['pair', 'single'],
      'consecutive_pairs': ['consecutive_pairs', 'pair', 'single'],
      'flash': ['flash', 'single'],
      'thunder': ['thunder', 'single'],
      'straight': ['straight', 'single'],
      'mixed': ['mixed']
    };
    
    return priorities[leadType] || ['single'];
  }

  // 获取花色名称
  getSuitName(suit) {
    const names = {
      'spades': '黑桃',
      'hearts': '红桃',
      'diamonds': '方块',
      'clubs': '梅花',
      'trump': '主牌'
    };
    return names[suit] || suit;
  }

  // 检查强制跟牌规则
  checkMandatoryFollow(leadCard, cardsToPlay, availableCards, leadSuit, allPlayerCards) {
    const leadType = leadCard.cardType.type;
    const leadCount = leadCard.cards.length;
    
    // 如果玩家出牌数量不够，直接失败
    if (cardsToPlay.length !== leadCount) {
      return { 
        valid: false, 
        message: `必须出${leadCount}张牌` 
      };
    }
    
    // 按牌力排序可用牌（从大到小）
    const sortedAvailable = this.sortCardsByValue(availableCards);
    
    // 根据领出牌型检查强制规则
    switch (leadType) {
      case 'single':
        return this.checkMandatorySingle(cardsToPlay, sortedAvailable);
        
      case 'pair':
        return this.checkMandatoryPair(cardsToPlay, sortedAvailable, allPlayerCards, leadSuit);
        
      case 'consecutive_pairs':
        const pairCount = leadCount / 2;
        return this.checkMandatoryConsecutivePairs(cardsToPlay, sortedAvailable, pairCount);
        
      case 'straight':
        return this.checkMandatoryStraight(cardsToPlay, sortedAvailable, leadCount);
        
      case 'flash':
      case 'thunder':
        return this.checkMandatoryFlashThunder(cardsToPlay, sortedAvailable, leadCount);
        
      case 'mixed':
        return this.checkMandatoryMixed(cardsToPlay, sortedAvailable, leadCard);
        
      default:
        // 其他牌型使用基本规则
        return { valid: true };
    }
  }

  // 按牌力排序（从大到小）
  sortCardsByValue(cards) {
    return [...cards].sort((a, b) => 
      CardTypeValidator.getCardValue(b, this.currentLevel, this.trumpSuit) - 
      CardTypeValidator.getCardValue(a, this.currentLevel, this.trumpSuit)
    );
  }

  // 检查强制单张跟牌
  checkMandatorySingle(cardsToPlay, sortedAvailable) {
    if (cardsToPlay.length !== 1) {
      return { valid: false, message: '必须出一张牌' };
    }
    
    // 单张跟牌：有同花色时可以出任意同花色单张
    const playedCard = cardsToPlay[0];
    
    // 检查出的牌是否在可用牌中
    const isValidCard = sortedAvailable.some(card => card.id === playedCard.id);
    
    if (!isValidCard) {
      return { 
        valid: false, 
        message: '必须出对应花色的牌' 
      };
    }
    
    return { valid: true };
  }

  // 检查强制对子跟牌
  checkMandatoryPair(cardsToPlay, sortedAvailable, allPlayerCards, leadSuit) {
    if (cardsToPlay.length !== 2) {
      return { valid: false, message: '必须出两张牌' };
    }
    
    // 在全部手牌中检查是否有领出花色的对子
    const leadSuitPairs = this.findLeadSuitPairs(allPlayerCards, leadSuit);
    
    if (leadSuitPairs.length > 0) {
      // 有对子，必须出对子
      const playedPair = this.identifyPlayedPair(cardsToPlay);
      if (!playedPair.valid) {
        return { 
          valid: false, 
          message: '有对子必须出对子' 
        };
      }
      return { valid: true };
    } else {
      // 没有对子，必须出两张最大的单张
      const sortedPlayed = this.sortCardsByValue(cardsToPlay);
      const expectedCards = sortedAvailable.slice(0, 2);
      
      if (!this.cardsMatch(sortedPlayed, expectedCards)) {
        return { 
          valid: false, 
          message: `必须出两张最大的牌: ${expectedCards.map(c => this.getCardDisplayName(c)).join(', ')}` 
        };
      }
      return { valid: true };
    }
  }

  // 检查强制连对跟牌
  checkMandatoryConsecutivePairs(cardsToPlay, sortedAvailable, requiredPairCount) {
    const pairs = this.findPairs(sortedAvailable);
    const availablePairCount = pairs.length;
    
    if (availablePairCount >= requiredPairCount) {
      // 有足够的对子，可以选择出哪些对子
      const playedPairs = this.identifyPlayedPairs(cardsToPlay);
      if (playedPairs.length !== requiredPairCount) {
        return { 
          valid: false, 
          message: `必须出${requiredPairCount}对` 
        };
      }
      return { valid: true };
    } else if (availablePairCount > 0) {
      // 有部分对子，必须出所有对子 + 最大的单张补全
      const playedPairs = this.identifyPlayedPairs(cardsToPlay);
      if (playedPairs.length !== availablePairCount) {
        return { 
          valid: false, 
          message: `必须出所有${availablePairCount}对，剩余用最大单张补全` 
        };
      }
      
      // 检查剩余单张是否是最大的
      const remainingCount = requiredPairCount * 2 - availablePairCount * 2;
      const usedInPairs = new Set(pairs.flat().map(c => c.id));
      const remainingCards = sortedAvailable.filter(c => !usedInPairs.has(c.id));
      const expectedRemaining = remainingCards.slice(0, remainingCount);
      
      const playedSingles = cardsToPlay.filter(c => 
        !pairs.flat().some(p => p.id === c.id)
      );
      
      if (!this.cardsMatch(this.sortCardsByValue(playedSingles), expectedRemaining)) {
        return { 
          valid: false, 
          message: `剩余必须用最大的单张补全: ${expectedRemaining.map(c => this.getCardDisplayName(c)).join(', ')}` 
        };
      }
      return { valid: true };
    } else {
      // 没有对子，必须出最大的单张
      const expectedCards = sortedAvailable.slice(0, requiredPairCount * 2);
      const sortedPlayed = this.sortCardsByValue(cardsToPlay);
      
      if (!this.cardsMatch(sortedPlayed, expectedCards)) {
        return { 
          valid: false, 
          message: `必须出最大的${requiredPairCount * 2}张牌: ${expectedCards.map(c => this.getCardDisplayName(c)).join(', ')}` 
        };
      }
      return { valid: true };
    }
  }

  // 检查强制顺子跟牌
  checkMandatoryStraight(cardsToPlay, sortedAvailable, requiredCount) {
    // 检查是否有足够的顺子
    const straightCards = this.findStraightCards(sortedAvailable, requiredCount);
    
    if (straightCards.length >= requiredCount) {
      // 有足够的顺子牌，可以选择出哪些
      const playedStraight = this.identifyPlayedStraight(cardsToPlay);
      if (!playedStraight.valid) {
        return { 
          valid: false, 
          message: '有顺子必须出顺子' 
        };
      }
      return { valid: true };
    } else {
      // 没有足够的顺子，必须出最大的单张
      const expectedCards = sortedAvailable.slice(0, requiredCount);
      const sortedPlayed = this.sortCardsByValue(cardsToPlay);
      
      if (!this.cardsMatch(sortedPlayed, expectedCards)) {
        return { 
          valid: false, 
          message: `必须出最大的${requiredCount}张牌: ${expectedCards.map(c => this.getCardDisplayName(c)).join(', ')}` 
        };
      }
      return { valid: true };
    }
  }

  // 检查强制闪/震跟牌
  checkMandatoryFlashThunder(cardsToPlay, sortedAvailable, requiredCount) {
    // 检查是否有足够的同点数不同花色主牌
    const flashCards = this.findFlashCards(sortedAvailable, requiredCount);
    
    if (flashCards.length >= requiredCount) {
      // 有足够的闪/震牌，可以选择出哪些
      const playedFlash = this.identifyPlayedFlash(cardsToPlay);
      if (!playedFlash.valid) {
        return { 
          valid: false, 
          message: '有闪/震必须出闪/震' 
        };
      }
      return { valid: true };
    } else {
      // 没有足够的闪/震，必须出最大的单张
      const expectedCards = sortedAvailable.slice(0, requiredCount);
      const sortedPlayed = this.sortCardsByValue(cardsToPlay);
      
      if (!this.cardsMatch(sortedPlayed, expectedCards)) {
        return { 
          valid: false, 
          message: `必须出最大的${requiredCount}张牌: ${expectedCards.map(c => this.getCardDisplayName(c)).join(', ')}` 
        };
      }
      return { valid: true };
    }
  }

  // 检查强制甩牌跟牌
  checkMandatoryMixed(cardsToPlay, sortedAvailable, leadCard) {
    // 分析领出甩牌的组成
    const leadAnalysis = this.analyzeMixedCards(leadCard.cards);
    
    // 分析跟牌者的牌
    const availableAnalysis = this.analyzeMixedCards(sortedAvailable);
    
    // 构建强制出牌组合
    const mandatoryCombo = this.buildMandatoryMixedCombo(leadAnalysis, availableAnalysis, sortedAvailable);
    
    // 验证玩家出牌是否符合强制要求
    const playedAnalysis = this.analyzeMixedCards(cardsToPlay);
    
    if (!this.validateMixedCombo(playedAnalysis, mandatoryCombo)) {
      return {
        valid: false,
        message: `甩牌必须按要求出牌: ${mandatoryCombo.description}`
      };
    }
    
    return { valid: true };
  }

  // 找到所有对子
  findPairs(cards) {
    const pairs = [];
    const used = new Set();
    
    // 找到所有可能的对子（避免重复）
    for (let i = 0; i < cards.length - 1; i++) {
      if (used.has(i)) continue;
      
      for (let j = i + 1; j < cards.length; j++) {
        if (used.has(j)) continue;
        
        const card1 = cards[i];
        const card2 = cards[j];
        
        // 检查是否为对子（同点数同花色，或王对王）
        if (card1.rank === card2.rank) {
          if (card1.suit === card2.suit) {
            // 同花色对子
            pairs.push([card1, card2]);
            used.add(i);
            used.add(j);
            break; // 找到对子后跳出内层循环
          } else if (card1.suit === 'joker' && card2.suit === 'joker' && card1.rank === card2.rank) {
            // 王对王
            pairs.push([card1, card2]);
            used.add(i);
            used.add(j);
            break; // 找到对子后跳出内层循环
          }
        }
      }
    }
    
    return pairs;
  }

  // 找领出花色的对子
  findLeadSuitPairs(allPlayerCards, leadSuit) {
    const pairs = [];
    const used = new Set();
    
    // 先筛选出领出花色的牌
    const leadSuitCards = this.getPlayerCardsOfSuitFromCards(allPlayerCards, leadSuit);
    
    for (let i = 0; i < leadSuitCards.length - 1; i++) {
      if (used.has(i)) continue;
      
      for (let j = i + 1; j < leadSuitCards.length; j++) {
        if (used.has(j)) continue;
        
        const card1 = leadSuitCards[i];
        const card2 = leadSuitCards[j];
        
        if (card1.rank === card2.rank && card1.suit === card2.suit) {
          pairs.push([card1, card2]);
          used.add(i);
          used.add(j);
          break;
        }
      }
    }
    
    return pairs;
  }

  // 从给定牌组中获取指定花色的牌
  getPlayerCardsOfSuitFromCards(cards, leadSuit) {
    if (leadSuit === 'trump') {
      return cards.filter(card => 
        CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
      );
    } else {
      return cards.filter(card => 
        card.suit === leadSuit && 
        !CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
      );
    }
  }

  // 识别玩家出的对子
  identifyPlayedPair(cardsToPlay) {
    if (cardsToPlay.length !== 2) {
      return { valid: false };
    }
    
    const [card1, card2] = cardsToPlay;
    
    // 检查是否为对子（同点数同花色，或王对王）
    if (card1.rank === card2.rank) {
      if (card1.suit === card2.suit) {
        return { valid: true };
      }
      // 王牌特殊处理
      if (card1.suit === 'joker' && card2.suit === 'joker' && card1.rank === card2.rank) {
        return { valid: true };
      }
    }
    
    return { valid: false };
  }

  // 识别玩家出的所有对子
  identifyPlayedPairs(cardsToPlay) {
    const pairs = [];
    const used = new Set();
    
    for (let i = 0; i < cardsToPlay.length - 1; i++) {
      if (used.has(i)) continue;
      
      for (let j = i + 1; j < cardsToPlay.length; j++) {
        if (used.has(j)) continue;
        
        const card1 = cardsToPlay[i];
        const card2 = cardsToPlay[j];
        
        // 检查是否为对子
        if (card1.rank === card2.rank) {
          if (card1.suit === card2.suit || 
              (card1.suit === 'joker' && card2.suit === 'joker' && card1.rank === card2.rank)) {
            pairs.push([card1, card2]);
            used.add(i);
            used.add(j);
            break;
          }
        }
      }
    }
    
    return pairs;
  }

  // 检查两组牌是否匹配
  cardsMatch(cards1, cards2) {
    if (cards1.length !== cards2.length) return false;
    
    const ids1 = cards1.map(c => c.id).sort();
    const ids2 = cards2.map(c => c.id).sort();
    
    return ids1.every((id, index) => id === ids2[index]);
  }

  // 获取牌的显示名称
  getCardDisplayName(card) {
    const suits = {
      'spades': '♠',
      'hearts': '♥', 
      'diamonds': '♦',
      'clubs': '♣',
      'joker': ''
    };
    
    const ranks = {
      'small': '小王',
      'big': '大王'
    };
    
    if (card.suit === 'joker') {
      return ranks[card.rank] || card.rank;
    }
    
    return `${suits[card.suit] || card.suit}${card.rank}`;
  }

  // 找到可能的顺子牌
  findStraightCards(cards, requiredCount) {
    // 顺子必须是副牌且连续
    const suitGroups = {};
    
    // 按花色分组非主牌
    for (const card of cards) {
      if (!CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)) {
        if (!suitGroups[card.suit]) {
          suitGroups[card.suit] = [];
        }
        suitGroups[card.suit].push(card);
      }
    }
    
    // 检查每个花色是否有足够的连续牌
    for (const [suit, suitCards] of Object.entries(suitGroups)) {
      if (suitCards.length >= requiredCount) {
        // 检查是否有连续的牌
        const consecutiveCards = this.findConsecutiveCards(suitCards, requiredCount);
        if (consecutiveCards.length >= requiredCount) {
          return consecutiveCards;
        }
      }
    }
    
    return [];
  }

  // 找到闪/震牌
  findFlashCards(cards, requiredCount) {
    // 只有主牌才能闪/震
    const trumpCards = cards.filter(card => 
      CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
    );
    
    // 按点数分组
    const rankGroups = {};
    for (const card of trumpCards) {
      if (!rankGroups[card.rank]) {
        rankGroups[card.rank] = [];
      }
      rankGroups[card.rank].push(card);
    }
    
    // 找到有足够牌数的点数
    for (const [rank, cardsOfRank] of Object.entries(rankGroups)) {
      if (cardsOfRank.length >= requiredCount) {
        return cardsOfRank.slice(0, requiredCount);
      }
    }
    
    return [];
  }

  // 识别顺子
  identifyPlayedStraight(cardsToPlay) {
    // 简化版：检查是否全为同花色副牌且连续
    if (cardsToPlay.length < 5) {
      return { valid: false };
    }
    
    const firstCard = cardsToPlay[0];
    const suit = firstCard.suit;
    
    // 检查是否全为同花色副牌
    for (const card of cardsToPlay) {
      if (card.suit !== suit || CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)) {
        return { valid: false };
      }
    }
    
    // 检查是否连续
    const consecutive = this.findConsecutiveCards(cardsToPlay, cardsToPlay.length);
    return { valid: consecutive.length === cardsToPlay.length };
  }

  // 识别闪/震
  identifyPlayedFlash(cardsToPlay) {
    if (cardsToPlay.length < 4) {
      return { valid: false };
    }
    
    // 检查是否全为主牌且同点数
    const firstCard = cardsToPlay[0];
    const rank = firstCard.rank;
    
    for (const card of cardsToPlay) {
      if (card.rank !== rank || !CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)) {
        return { valid: false };
      }
    }
    
    return { valid: true };
  }

  // 找到连续的牌
  findConsecutiveCards(cards, requiredCount) {
    // 按顺序值排序
    const sorted = [...cards].sort((a, b) => 
      CardTypeValidator.getSequentialValue(a, this.currentLevel, this.trumpSuit) - 
      CardTypeValidator.getSequentialValue(b, this.currentLevel, this.trumpSuit)
    );
    
    // 找连续序列
    for (let i = 0; i <= sorted.length - requiredCount; i++) {
      let consecutive = [sorted[i]];
      
      for (let j = i + 1; j < sorted.length && consecutive.length < requiredCount; j++) {
        const currentValue = CardTypeValidator.getSequentialValue(sorted[j], this.currentLevel, this.trumpSuit);
        const lastValue = CardTypeValidator.getSequentialValue(consecutive[consecutive.length - 1], this.currentLevel, this.trumpSuit);
        
        if (currentValue === lastValue + 1) {
          consecutive.push(sorted[j]);
        } else {
          break;
        }
      }
      
      if (consecutive.length >= requiredCount) {
        return consecutive;
      }
    }
    
    return [];
  }

  // 分析甩牌组成
  analyzeMixedCards(cards) {
    const analysis = {
      singles: [],
      pairs: [],
      // 高阶单位能力（用于优先匹配与降阶）
      capabilities: {
        consecutivePairsPairs: 0, // 最长可组成的连对“对数”
        straightCount: 0,         // 最长可组成的顺子“张数”（>=5）
        flashThunderCount: 0      // 同点数主牌可用张数（>=4）
      },
      totalCount: cards.length
    };
    
    const used = new Set();
    
    // 1) 先找对子
    for (let i = 0; i < cards.length - 1; i++) {
      if (used.has(i)) continue;
      for (let j = i + 1; j < cards.length; j++) {
        if (used.has(j)) continue;
        if (cards[i].rank === cards[j].rank && cards[i].suit === cards[j].suit) {
          analysis.pairs.push([cards[i], cards[j]]);
          used.add(i);
          used.add(j);
          break;
        }
      }
    }
    
    // 2) 剩余的都是单张
    for (let i = 0; i < cards.length; i++) {
      if (!used.has(i)) {
        analysis.singles.push(cards[i]);
      }
    }
    
    // 3) 能力评估 - 连对（对数）
    try {
      const pairs = analysis.pairs.map(p => p[0]); // 用每对的第一张代表该点数
      // 基于顺序值寻找最长连续长度
      const values = pairs.map(c => CardTypeValidator.getSequentialValue(c, this.currentLevel, this.trumpSuit))
                         .filter(v => v > 0)
                         .sort((a,b) => a - b);
      let best = 0, curr = 0, prev = null;
      for (const v of values) {
        if (prev === null || v === prev + 1) {
          curr += 1;
        } else if (v === prev) {
          // 同点数的重复对，不延长连续链
        } else {
          best = Math.max(best, curr);
          curr = 1;
        }
        prev = v;
      }
      best = Math.max(best, curr);
      analysis.capabilities.consecutivePairsPairs = Math.max(best, 0);
    } catch (e) {
      analysis.capabilities.consecutivePairsPairs = 0;
    }
    
    // 4) 能力评估 - 顺子（张数）
    try {
      // 顺子只在副牌或主花色同花情况下成立，这里近似：寻找最长连续（>=5）
      const maxLen = Math.min(cards.length, 12);
      let bestStraight = 0;
      for (let len = 12; len >= 5; len--) {
        const seq = this.findConsecutiveCards(cards, len);
        if (seq.length >= len) { bestStraight = len; break; }
      }
      analysis.capabilities.straightCount = bestStraight;
    } catch (e) {
      analysis.capabilities.straightCount = 0;
    }
    
    // 5) 能力评估 - 闪/震（同点数主牌跨花色）
    try {
      const trumpOnly = cards.filter(c => CardTypeValidator.isCardTrump(c, this.currentLevel, this.trumpSuit));
      const byRank = trumpOnly.reduce((m, c) => { const k = String(c.rank); (m[k] = m[k] || 0); m[k]++; return m; }, {});
      let maxSameRankTrump = 0;
      for (const cnt of Object.values(byRank)) {
        if (cnt >= 4) maxSameRankTrump = Math.max(maxSameRankTrump, cnt);
      }
      analysis.capabilities.flashThunderCount = maxSameRankTrump; // 4为闪，>4为震
    } catch (e) {
      analysis.capabilities.flashThunderCount = 0;
    }
    
    return analysis;
  }

  // 构建强制甩牌组合
  buildMandatoryMixedCombo(leadAnalysis, availableAnalysis, sortedAvailable) {
    const mandatoryCombo = {
      pairs: [],
      singlesForPairs: [],     // 补对所需最大单张
      singlesFlexibleCount: 0, // 对应首家单张单位 + 高阶单位降阶后的单张
      description: ""
    };
    
    // 1) 计算首家“高阶单位”的需求（按优先级：闪/震 -> 顺子 -> 连对）
    let reqFlashCards = leadAnalysis.capabilities.flashThunderCount || 0;
    let reqStraightCards = leadAnalysis.capabilities.straightCount || 0;
    let reqConsecPairs = leadAnalysis.capabilities.consecutivePairsPairs || 0; // 对数
    
    // 2) 计算可用“高阶单位”能力
    const haveFlashCards = availableAnalysis.capabilities.flashThunderCount || 0;
    const haveStraightCards = availableAnalysis.capabilities.straightCount || 0;
    const haveConsecPairs = availableAnalysis.capabilities.consecutivePairsPairs || 0;
    
    // 3) 高阶单位优先匹配
    const usedFlash = Math.min(reqFlashCards, haveFlashCards);
    const usedStraight = Math.min(reqStraightCards, haveStraightCards);
    const usedConsecPairs = Math.min(reqConsecPairs, haveConsecPairs);
    
    // 4) 不足部分进行“降阶”：
    //    - 闪/震 & 顺子：缺口张数全部用“最大单张”补齐（不再按张数折算对子）
    //    - 连对：缺口先用对子补，若对子不足，再用“最大单张”按2张/对补齐
    let deficitFlashCards = Math.max(0, reqFlashCards - usedFlash);
    let deficitStraightCards = Math.max(0, reqStraightCards - usedStraight);
    let deficitConsecPairs = Math.max(0, reqConsecPairs - usedConsecPairs);
    
    let requiredPairs = leadAnalysis.pairs.length + deficitConsecPairs; // 连对缺口折算为对子需求
    let requiredSingles = leadAnalysis.singles.length; // 首家“单张单位”只计数量（任意单张）
    
    // 闪/震+顺子的缺口：全部转化为“必须用最大单张”补齐
    const highSinglesNeeded = deficitFlashCards + deficitStraightCards;
    
    // 5) 使用可用对子满足 requiredPairs
    const availablePairs = availableAnalysis.pairs.length;
    if (availablePairs > 0) {
      const takePairs = Math.min(availablePairs, requiredPairs);
      mandatoryCombo.pairs = availableAnalysis.pairs.slice(0, takePairs);
    }
    
    // 6) 计算对子缺口并与高阶缺口一起用“最大单张”补齐
    const missingPairs = Math.max(0, requiredPairs - mandatoryCombo.pairs.length);
    const usedInPairs = new Set(mandatoryCombo.pairs.flat().map(c => c.id));
    const remainingCards = sortedAvailable.filter(c => !usedInPairs.has(c.id));
    const singlesNeededForPairs = missingPairs * 2;
    const totalMustSingles = highSinglesNeeded + singlesNeededForPairs;
    mandatoryCombo.singlesForPairs = remainingCards.slice(0, totalMustSingles);
    
    // 7) 记录“对应首家单张单位”的数量需求（不限定具体牌，任意单张即可）
    mandatoryCombo.singlesFlexibleCount = requiredSingles;
    
    // 8) 描述文本
    const parts = [];
    if (mandatoryCombo.pairs.length > 0) parts.push(`${mandatoryCombo.pairs.length}对`);
    if (mandatoryCombo.singlesForPairs.length > 0) parts.push(`${mandatoryCombo.singlesForPairs.length}张补对最大单张`);
    if (mandatoryCombo.singlesFlexibleCount > 0) parts.push(`${mandatoryCombo.singlesFlexibleCount}张任意单张`);
    mandatoryCombo.description = parts.join(" + ");
    
    return mandatoryCombo;
  }

  // 验证甩牌组合
  validateMixedCombo(playedAnalysis, mandatoryCombo) {
    // 检查对子数量
    if (playedAnalysis.pairs.length !== mandatoryCombo.pairs.length) {
      return false;
    }
    
    // 检查“用于补对的最大单张”是否全部包含在出的单张里
    if (mandatoryCombo.singlesForPairs.length > 0) {
      const mustSingles = new Set(mandatoryCombo.singlesForPairs.map(c => c.id));
      const playedSinglesSet = new Set(playedAnalysis.singles.map(c => c.id));
      for (const id of mustSingles) {
        if (!playedSinglesSet.has(id)) return false;
      }
    }
    
    // 检查总单张数量是否满足（= 补对所需张数 + 领出单张单位数量）
    const requiredSinglesTotal = (mandatoryCombo.singlesForPairs?.length || 0) + (mandatoryCombo.singlesFlexibleCount || 0);
    if (playedAnalysis.singles.length !== requiredSinglesTotal) {
      return false;
    }
    
    return true;
  }

  // 评估当前轮次
  evaluateRound() {
    console.log('🎯 评估轮次:', this.roundCards.map(rc => `${rc.playerName}: ${rc.cardType.name}`));
    
    const winner = this.findRoundWinner();
    this.lastWinner = winner;
    this.currentTurn = winner; // 获胜者下一轮首发
    
    // 计算得分
    const points = this.calculateRoundPoints();
    
    // 获胜玩家所在队伍获得分数
    const winnerTeam = winner % 2; // 0,2为一队；1,3为一队
    const trumpTeam = this.trumpPlayer % 2;
    
    // 检查是否是最后一手牌
    const isLastRound = this.isLastRound();
    
    if (isLastRound) {
      // 最后一手牌特殊处理
      this.handleLastRound(winner, points, winnerTeam, trumpTeam);
    } else {
      // 普通轮次处理
      if (winnerTeam !== trumpTeam) {
        // 闲家获得分数
        console.log(`🏆 闲家队伍获得 ${points} 分`);
        this.idleScore = (this.idleScore || 0) + points;
      } else {
        // 庄家队伍获得分数（不需要特殊记录）
        console.log(`🏆 庄家队伍获得 ${points} 分`);
      }
    }
    
    // 准备下一轮
    this.roundCards = [];
    this.currentRound++;
    
    console.log(`🎯 第${this.currentRound}轮结束，获胜者: 玩家${winner}，得分: ${points}，下一轮由玩家${winner}首发`);
    
    // 检查游戏是否结束
    if (this.isGameFinished()) {
      this.gamePhase = 'finished';
      const finalResult = this.calculateFinalResults();
      // 返回最终结果以便服务端处理
      return finalResult;
    }
  }

  // 找出轮次获胜者
  findRoundWinner() {
    if (this.roundCards.length !== 4) {
      return this.roundCards[0].playerId; // 默认第一个玩家
    }

    const leadCard = this.roundCards[0];
    const leadSuit = this.getLeadSuit(leadCard.cards);
    let winner = leadCard;

    // 比较每张牌，找出最大的
    for (let i = 1; i < this.roundCards.length; i++) {
      const currentCard = this.roundCards[i];
      if (this.compareCards(currentCard, winner, leadSuit)) {
        winner = currentCard;
      }
    }

    return winner.playerId;
  }

  // 比较两手牌，返回true如果card1更大
  compareCards(card1, card2, leadSuit) {
    // 引入“合格主杀”概念：当领出为副牌时，只有与领出牌型相同且数量相同的主牌才视为杀牌
    const leadType = this.roundCards[0].cardType; // 当前轮的领出牌型

    const card1QualifiedTrump = this.isQualifiedTrumpKill(card1, leadType);
    const card2QualifiedTrump = this.isQualifiedTrumpKill(card2, leadType);

    // 合格主杀 优先于任何副牌
    if (card1QualifiedTrump && !card2QualifiedTrump) return true;
    if (!card1QualifiedTrump && card2QualifiedTrump) return false;

    // 两者都是合格主杀：按主牌比较规则
    if (card1QualifiedTrump && card2QualifiedTrump) {
      return this.compareTrumpCards(card1, card2);
    }

    // 否则，两者都不是合格主杀（包括纯副牌、无效主牌组合、垫牌）按副牌/花色规则比较
    return this.compareSuitCards(card1, card2, leadSuit);
  }

  // 判断是否为“合格主杀”：
  // 1) 全是主牌；2) 与领出牌型相同；3) 数量相同。
  isQualifiedTrumpKill(cardGroup, leadType) {
    // 领出为主牌时，不适用“主杀”概念；直接按原有主牌比较
    const leadIsTrump = leadType && leadType.cards && leadType.cards.length > 0 &&
      this.isCardGroupTrump(leadType.cards);
    if (leadIsTrump) {
      return this.isCardGroupTrump(cardGroup.cards);
    }

    // 领出为副牌时，必须满足“合格主杀”条件
    const isGroupTrump = this.isCardGroupTrump(cardGroup.cards);
    if (!isGroupTrump) return false;

    // 数量一致
    if (!leadType || cardGroup.cards.length !== this.roundCards[0].cards.length) return false;

    // 牌型一致
    return cardGroup.cardType && leadType.type === cardGroup.cardType.type;
  }

  // 检查一组牌是否都是主牌
  isCardGroupTrump(cards) {
    return cards.every(card => 
      CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
    );
  }

  // 比较主牌
  compareTrumpCards(card1, card2) {
    // 首先比较牌型优先级
    const type1Priority = this.getCardTypePriority(card1.cardType.type);
    const type2Priority = this.getCardTypePriority(card2.cardType.type);
    
    if (type1Priority !== type2Priority) {
      return type1Priority > type2Priority;
    }

    // 相同牌型
    // 混合甩牌（mixed）时，仅比较“最高优先单位”即可：
    // - 优先比较对子最大值
    // - 若双方无对子或对子相等，再比较单张最大值
    // - 若仍相等，回退到整体最大牌值
    if (card1.cardType.type === 'mixed') {
      const a = this.analyzeMixedCards(card1.cards);
      const b = this.analyzeMixedCards(card2.cards);

      // 计算混合牌的“最高优先单位”及其强度
      const getHighestUnitScore = (analysis) => {
        // 1) 闪/震：按可用张数比较（>4 为震，4 为闪）
        if ((analysis.capabilities?.flashThunderCount || 0) > 0) {
          return { category: 'flash_thunder', score: analysis.capabilities.flashThunderCount };
        }
        // 2) 顺子：按最长顺子张数比较
        if ((analysis.capabilities?.straightCount || 0) >= 5) {
          return { category: 'straight', score: analysis.capabilities.straightCount };
        }
        // 3) 连对：按可组成的连续对数比较
        if ((analysis.capabilities?.consecutivePairsPairs || 0) > 0) {
          return { category: 'consecutive_pairs', score: analysis.capabilities.consecutivePairsPairs };
        }
        // 4) 对子：按最大对子牌力比较
        if (analysis.pairs && analysis.pairs.length > 0) {
          const flat = analysis.pairs.flat();
          const maxPair = Math.max(...flat.map(c => CardTypeValidator.getCardValue(c, this.currentLevel, this.trumpSuit)));
          return { category: 'pair', score: maxPair };
        }
        // 5) 单张：按最大单张牌力比较
        if (analysis.singles && analysis.singles.length > 0) {
          const maxSingle = Math.max(...analysis.singles.map(c => CardTypeValidator.getCardValue(c, this.currentLevel, this.trumpSuit)));
          return { category: 'single', score: maxSingle };
        }
        return { category: 'none', score: -1 };
      };

      const aTop = getHighestUnitScore(a);
      const bTop = getHighestUnitScore(b);

      // 按“最高优先单位”比较：只看该单位的强度，a>b 才算更大；相等或更小，维持原更大者
      if (aTop.category !== 'none' && bTop.category !== 'none') {
        // 理论上主杀/超杀需“同型同量”，因此最高单位类别应一致；若不一致，视为不更大
        if (aTop.category !== bTop.category) {
          return false;
        }
        // 同一类别，仅比较分数；分数相等则视为不更大
        if (aTop.score !== bTop.score) {
          return aTop.score > bTop.score;
        }
        // 分数也相等：不更大
        return false;
      }

      // 回退策略：比较整体最大牌值（极端安全网）
      const maxValue1Fallback = Math.max(...card1.cards.map(card => 
        CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)
      ));
      const maxValue2Fallback = Math.max(...card2.cards.map(card => 
        CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)
      ));
      return maxValue1Fallback > maxValue2Fallback;
    }

    // 非混合场景：保持原有最大牌比较
    const maxValue1 = Math.max(...card1.cards.map(card => 
      CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)
    ));
    const maxValue2 = Math.max(...card2.cards.map(card => 
      CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)
    ));

    return maxValue1 > maxValue2;
  }

  // 比较副牌（只有跟对应花色的才能比较）
  compareSuitCards(card1, card2, leadSuit) {
    const card1FollowsLead = this.followsLeadSuit(card1.cards, leadSuit);
    const card2FollowsLead = this.followsLeadSuit(card2.cards, leadSuit);

    // 只有跟牌的才能获胜
    if (card1FollowsLead && !card2FollowsLead) return true;
    if (!card1FollowsLead && card2FollowsLead) return false;
    if (!card1FollowsLead && !card2FollowsLead) return false; // 都不跟牌，原来的大

    // 都跟牌，比较牌型和大小
    const type1Priority = this.getCardTypePriority(card1.cardType.type);
    const type2Priority = this.getCardTypePriority(card2.cardType.type);
    
    if (type1Priority !== type2Priority) {
      return type1Priority > type2Priority;
    }

    // 相同牌型，比较最大牌的大小
    const maxValue1 = Math.max(...card1.cards.map(card => 
      CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)
    ));
    const maxValue2 = Math.max(...card2.cards.map(card => 
      CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)
    ));

    return maxValue1 > maxValue2;
  }

  // 检查是否跟了首发花色
  followsLeadSuit(cards, leadSuit) {
    if (leadSuit === 'trump') {
      return cards.every(card => 
        CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
      );
    } else {
      return cards.every(card => 
        card.suit === leadSuit && 
        !CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
      );
    }
  }

  // 获取牌型优先级
  getCardTypePriority(cardType) {
    const priorities = {
      'thunder': 7,    // 震
      'flash': 6,      // 闪
      'straight': 5,   // 雨
      'consecutive_pairs': 4, // 连对
      'pair': 3,       // 对子
      'single': 2,     // 单张
      'mixed': 1       // 甩牌
    };
    return priorities[cardType] || 0;
  }

  // 计算轮次得分
  calculateRoundPoints() {
    let points = 0;
    
    for (const roundCard of this.roundCards) {
      for (const card of roundCard.cards) {
        // 5分牌值5分，10和K值10分
        if (card.rank === '5') points += 5;
        if (card.rank === 10 || card.rank === 'K') points += 10;
      }
    }
    
    return points;
  }

  // 检查是否是最后一轮
  isLastRound() {
    // 最后一轮的标志是所有玩家都没有手牌了（刚刚出完最后一手牌）
    return this.players.every(p => p.cards.length === 0);
  }

  // 处理最后一手牌的特殊逻辑
  handleLastRound(winner, points, winnerTeam, trumpTeam) {
    console.log('🎯 最后一手牌处理');
    
    // 计算底牌中的分数
    const bottomPoints = this.calculateBottomPoints();
    console.log(`💰 底牌中的分数: ${bottomPoints}`);
    
    // 先处理当前轮次的分数
    if (winnerTeam !== trumpTeam) {
      // 闲家获得当前轮次分数
      console.log(`🏆 闲家队伍获得轮次分数 ${points} 分`);
      this.idleScore = (this.idleScore || 0) + points;
    } else {
      console.log(`🏆 庄家队伍获得轮次分数 ${points} 分`);
    }
    
    // 处理底牌分数
    if (winnerTeam !== trumpTeam) {
      // 闲家大，闲家额外获得底牌分数
      console.log(`🎉 闲家最后一手大，获得底牌分数 ${bottomPoints} 分`);
      this.idleScore += bottomPoints;
    } else {
      // 庄家大，闲家失去底牌分数
      console.log(`😔 庄家最后一手大，闲家失去底牌分数 ${bottomPoints} 分`);
      this.idleScore = Math.max(0, this.idleScore - bottomPoints);
    }
    
    console.log(`📊 最终闲家得分: ${this.idleScore}`);
  }

  // 计算底牌中的分数
  calculateBottomPoints() {
    let points = 0;
    
    for (const card of this.bottomCards) {
      // 5分牌值5分，10和K值10分
      if (card.rank === '5') points += 5;
      if (card.rank === 10 || card.rank === 'K') points += 10;
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
    console.log('🎯 游戏结束，计算最终结果...');
    console.log(`📊 闲家最终得分: ${this.idleScore}`);
    
    const result = this.calculateUpgradeResult(this.idleScore);
    
    console.log('🎪 升级结果:', result);
    
    // 触发游戏结束事件，返回结果
    return {
      gamePhase: 'finished',
      idleScore: this.idleScore,
      upgradeResult: result,
      currentLevel: this.currentLevel,
      trumpPlayer: this.trumpPlayer,
      dealer: this.dealer
    };
  }

  // 根据闲家得分计算升级结果
  calculateUpgradeResult(idleScore) {
    let levelChange = 0;
    let newDealer = this.dealer;
    let status = '';
    let description = '';
    
    if (idleScore < 0) {
      // 闲家负分
      if (idleScore >= -5) {
        levelChange = 4;
        status = 'dealer_upgrade_4';
        description = '庄家升四级';
      } else {
        levelChange = 4;
        status = 'dealer_upgrade_4';
        description = '庄家升四级';
      }
    } else if (idleScore === 0) {
      levelChange = 3;
      status = 'dealer_upgrade_3';
      description = '庄家升三级';
    } else if (idleScore >= 5 && idleScore <= 35) {
      levelChange = 2;
      status = 'dealer_upgrade_2';
      description = '庄家升二级';
    } else if (idleScore >= 40 && idleScore <= 75) {
      levelChange = 1;
      status = 'dealer_upgrade_1';
      description = '庄家升一级';
    } else if (idleScore >= 80 && idleScore <= 115) {
      levelChange = 0;
      status = 'idle_take_over';
      description = '闲家上台';
      newDealer = this.getIdleTeamNextDealer();
    } else if (idleScore >= 120 && idleScore <= 155) {
      levelChange = 1;
      status = 'idle_take_over_upgrade_1';
      description = '闲家上台并升一级';
      newDealer = this.getIdleTeamNextDealer();
    } else if (idleScore >= 160 && idleScore <= 195) {
      levelChange = 2;
      status = 'idle_take_over_upgrade_2';
      description = '闲家上台并升两级';
      newDealer = this.getIdleTeamNextDealer();
    } else if (idleScore >= 200) {
      levelChange = 3;
      status = 'idle_take_over_upgrade_3';
      description = '闲家上台并升三级';
      newDealer = this.getIdleTeamNextDealer();
    }
    
    // 计算新的级别
    let newLevel = this.currentLevel;
    const levelOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const currentIndex = levelOrder.indexOf(this.currentLevel.toString());
    
    if (status.includes('dealer')) {
      // 庄家升级，正常升级
      const newIndex = Math.min(currentIndex + levelChange, levelOrder.length - 1);
      newLevel = levelOrder[newIndex];
      // 庄家过庄，下一局由庄家对门坐庄
      newDealer = (this.dealer + 2) % 4;
    } else {
      // 闲家上台，闲家升级
      if (levelChange > 0) {
        const newIndex = Math.min(currentIndex + levelChange, levelOrder.length - 1);
        newLevel = levelOrder[newIndex];
      }
      // 新庄家已在上面计算
    }
    
    return {
      status,
      description,
      levelChange,
      newLevel,
      newDealer,
      currentDealer: this.dealer,
      idleScore: this.idleScore,
      isGameWon: newLevel === 'A' && (status.includes('dealer') || status.includes('idle'))
    };
  }

  // 获取闲家队伍的下一个庄家
  getIdleTeamNextDealer() {
    // 闲家队伍是非亮主玩家的队伍
    const trumpTeam = this.trumpPlayer % 2;
    const idleTeam = 1 - trumpTeam;
    
    // 找到闲家队伍中庄家的下家
    // 如果当前庄家是队伍0，下家就是队伍1的第一个玩家
    // 如果当前庄家是队伍1，下家就是队伍0的第一个玩家
    let newDealer;
    if (idleTeam === 0) {
      // 闲家队伍是0,2，选择庄家下家
      newDealer = (this.dealer + 1) % 4;
      if (newDealer % 2 !== 0) {
        newDealer = (newDealer + 1) % 4;
      }
    } else {
      // 闲家队伍是1,3，选择庄家下家
      newDealer = (this.dealer + 1) % 4;
      if (newDealer % 2 !== 1) {
        newDealer = (newDealer + 1) % 4;
      }
    }
    
    return newDealer;
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
      bottomPlayer: this.bottomPlayer,
      idleScore: this.idleScore,
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

  // 进入摸底阶段
  _enterBottomPhase() {
    this.gamePhase = 'bottom';
    this.bottomPlayer = this._determineBottomPlayer();
    
    // 给摸底玩家添加底牌
    const bottomPlayerObj = this.players[this.bottomPlayer];
    bottomPlayerObj.cards.push(...this.bottomCards);
    
    console.log(`进入摸底阶段，摸底玩家: 玩家${this.bottomPlayer}(${bottomPlayerObj.name})`);
    
    // 触发摸底阶段开始回调
    if (this._onBottomPhaseEntered) {
      this._onBottomPhaseEntered();
    }
  }

  // 确定摸底玩家
  _determineBottomPlayer() {
    const trumpPlayerId = this.counterTrumpPlayer !== null ? this.counterTrumpPlayer : this.trumpPlayer;
    
    if (this.isFirstRound) {
      // 第一局：叫主或反主的人的对家摸底
      return (trumpPlayerId + 2) % 4;
    } else {
      // 不是第一局：需要根据上一把胜负情况决定
      const trumpPlayerTeam = trumpPlayerId % 2; // 0,2为一队；1,3为一队
      const lastWinnerTeam = this.lastRoundWinner % 2;
      
      if (trumpPlayerTeam === lastWinnerTeam) {
        // 上一把胜者一方有人叫主/反主：仍然是对家摸底
        return (trumpPlayerId + 2) % 4;
      } else {
        // 上一把败者一方有人叫主/反主：叫主/反主者的下家摸底
        return (trumpPlayerId + 1) % 4;
      }
    }
  }

  // 摸底操作（选择4张牌扣底）
  handleBottomCards(playerId, selectedCardIds) {
    if (this.gamePhase !== 'bottom') {
      return { success: false, message: '不在摸底阶段' };
    }
    
    if (playerId !== this.bottomPlayer) {
      return { success: false, message: '只有摸底玩家可以进行摸底' };
    }
    
    if (selectedCardIds.length !== 4) {
      return { success: false, message: '必须选择4张牌扣底' };
    }
    
    const player = this.players[playerId];
    const selectedCards = [];
    
    // 验证选中的牌是否都在玩家手中
    for (const cardId of selectedCardIds) {
      const cardIndex = player.cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) {
        return { success: false, message: '选中的牌不在手牌中' };
      }
      selectedCards.push(player.cards[cardIndex]);
    }
    
    // 从玩家手牌中移除选中的牌
    for (const card of selectedCards) {
      const index = player.cards.findIndex(c => c.id === card.id);
      if (index !== -1) {
        player.cards.splice(index, 1);
      }
    }
    
    // 更新底牌
    this.bottomCards = selectedCards;
    
    // 进入出牌阶段
    this.gamePhase = 'playing';
    this.currentTurn = this.bottomPlayer; // 摸底玩家最先出牌
    
    console.log(`玩家${playerId}(${player.name})摸底完成，进入出牌阶段，由玩家${this.bottomPlayer}先出牌`);
    
    return { 
      success: true, 
      message: '摸底完成',
      newBottomCards: selectedCards
    };
  }

  // 判定首家甩牌是否会被否定，如果被否定则返回强制出牌
  judgeLeadMixedAndForce(cardsToPlay, playerId) {
    // 分析甩牌中的各类单位
    const units = this.analyzeMixedCards(cardsToPlay, this.currentLevel, this.trumpSuit);
    
    // 按优先级检查各类单位是否会被否定
    const priorityOrder = ['thunder', 'flash', 'straight', 'consecutivePairs', 'pair', 'single'];
    
    for (const unitType of priorityOrder) {
      if (units[unitType] && units[unitType].length > 0) {
        // 找到该类单位中的最小单位
        const minUnit = this.findMinUnit(units[unitType], unitType);
        if (minUnit && this.canBeBeatenByOthers(minUnit, unitType, playerId)) {
          // 该类单位被否定，返回强制出该最小单位
          const forcedCardType = CardTypeValidator.identifyCardType(minUnit, this.currentLevel, this.trumpSuit);
          return {
            shouldForce: true,
            forcedCards: minUnit,
            forcedCardType: forcedCardType
          };
        }
      }
    }
    
    // 甩牌成功，不需要强制
    return { shouldForce: false };
  }

  // 找到同类单位中的最小单位
  findMinUnit(units, unitType) {
    if (!units || units.length === 0) return null;
    
    switch (unitType) {
      case 'thunder':
      case 'flash':
        // 闪/震：按张数最少，张数相同时按最大牌值最小
        return units.reduce((min, unit) => {
          if (unit.length < min.length) return unit;
          if (unit.length === min.length) {
            const maxValue1 = Math.max(...unit.map(card => CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)));
            const maxValue2 = Math.max(...min.map(card => CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)));
            return maxValue1 < maxValue2 ? unit : min;
          }
          return min;
        });
        
      case 'straight':
        // 顺子：按长度最短，长度相同时按最大牌值最小
        return units.reduce((min, unit) => {
          if (unit.length < min.length) return unit;
          if (unit.length === min.length) {
            const maxValue1 = Math.max(...unit.map(card => CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)));
            const maxValue2 = Math.max(...min.map(card => CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)));
            return maxValue1 < maxValue2 ? unit : min;
          }
          return min;
        });
        
      case 'consecutivePairs':
        // 连对：按对数最少，对数相同时按最大牌值最小
        return units.reduce((min, unit) => {
          const pairCount1 = unit.length / 2;
          const pairCount2 = min.length / 2;
          if (pairCount1 < pairCount2) return unit;
          if (pairCount1 === pairCount2) {
            const maxValue1 = Math.max(...unit.map(card => CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)));
            const maxValue2 = Math.max(...min.map(card => CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)));
            return maxValue1 < maxValue2 ? unit : min;
          }
          return min;
        });
        
      case 'pair':
        // 对子：按牌值最小
        return units.reduce((min, unit) => {
          const value1 = CardTypeValidator.getCardValue(unit[0], this.currentLevel, this.trumpSuit);
          const value2 = CardTypeValidator.getCardValue(min[0], this.currentLevel, this.trumpSuit);
          return value1 < value2 ? unit : min;
        });
        
      case 'single':
        // 单张：按牌值最小
        return units.reduce((min, unit) => {
          const value1 = CardTypeValidator.getCardValue(unit[0], this.currentLevel, this.trumpSuit);
          const value2 = CardTypeValidator.getCardValue(min[0], this.currentLevel, this.trumpSuit);
          return value1 < value2 ? unit : min;
        });
        
      default:
        return units[0];
    }
  }

  // 检查指定单位是否会被其他玩家压过
  canBeBeatenByOthers(unit, unitType, playerId) {
    // 获取其他三家玩家的手牌
    const otherPlayers = this.players.filter(p => p.id !== playerId);
    
    for (const player of otherPlayers) {
      if (this.canPlayerBeatUnit(player, unit, unitType)) {
        return true;
      }
    }
    
    return false;
  }

  // 检查单个玩家是否能压过指定单位
  canPlayerBeatUnit(player, unit, unitType) {
    const playerCards = player.cards;
    
    switch (unitType) {
      case 'thunder':
      case 'flash':
        return this.canBeatThunderOrFlash(playerCards, unit);
        
      case 'straight':
        return this.canBeatStraight(playerCards, unit);
        
      case 'consecutivePairs':
        return this.canBeatConsecutivePairs(playerCards, unit);
        
      case 'pair':
        return this.canBeatPair(playerCards, unit);
        
      case 'single':
        return this.canBeatSingle(playerCards, unit);
        
      default:
        return false;
    }
  }

  // 检查是否能压过闪/震
  canBeatThunderOrFlash(playerCards, unit) {
    const unitLength = unit.length;
    const unitMaxValue = Math.max(...unit.map(card => CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)));
    
    // 检查玩家是否有更长的闪/震
    const playerThunderFlash = this.findThunderOrFlash(playerCards, unitLength + 1);
    if (playerThunderFlash) return true;
    
    // 检查玩家是否有相同长度但更大的闪/震
    const playerSameLength = this.findThunderOrFlash(playerCards, unitLength);
    if (playerSameLength) {
      const playerMaxValue = Math.max(...playerSameLength.map(card => CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)));
      return playerMaxValue > unitMaxValue;
    }
    
    return false;
  }

  // 检查是否能压过顺子
  canBeatStraight(playerCards, unit) {
    const unitLength = unit.length;
    const unitMaxValue = Math.max(...unit.map(card => CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)));
    
    // 检查玩家是否有更长的顺子
    const playerStraight = this.findStraight(playerCards, unitLength + 1);
    if (playerStraight) return true;
    
    // 检查玩家是否有相同长度但更大的顺子
    const playerSameLength = this.findStraight(playerCards, unitLength);
    if (playerSameLength) {
      const playerMaxValue = Math.max(...playerSameLength.map(card => CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)));
      return playerMaxValue > unitMaxValue;
    }
    
    return false;
  }

  // 检查是否能压过连对
  canBeatConsecutivePairs(playerCards, unit) {
    const unitPairCount = unit.length / 2;
    const unitMaxValue = Math.max(...unit.map(card => CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)));
    
    // 检查玩家是否有更多对数的连对
    const playerConsecutivePairs = this.findConsecutivePairs(playerCards, unitPairCount + 1);
    if (playerConsecutivePairs) return true;
    
    // 检查玩家是否有相同对数但更大的连对
    const playerSameCount = this.findConsecutivePairs(playerCards, unitPairCount);
    if (playerSameCount) {
      const playerMaxValue = Math.max(...playerSameCount.map(card => CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)));
      return playerMaxValue > unitMaxValue;
    }
    
    return false;
  }

  // 检查是否能压过对子
  canBeatPair(playerCards, unit) {
    const unitValue = CardTypeValidator.getCardValue(unit[0], this.currentLevel, this.trumpSuit);
    
    // 检查玩家是否有更大的对子
    const playerPairs = this.findPairs(playerCards);
    for (const pair of playerPairs) {
      const pairValue = CardTypeValidator.getCardValue(pair[0], this.currentLevel, this.trumpSuit);
      if (pairValue > unitValue) return true;
    }
    
    return false;
  }

  // 检查是否能压过单张
  canBeatSingle(playerCards, unit) {
    const unitValue = CardTypeValidator.getCardValue(unit[0], this.currentLevel, this.trumpSuit);
    
    // 检查玩家是否有更大的单张
    for (const card of playerCards) {
      const cardValue = CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit);
      if (cardValue > unitValue) return true;
    }
    
    return false;
  }

  // 辅助函数：查找闪/震
  findThunderOrFlash(playerCards, minLength) {
    // 尝试所有可能的闪/震组合
    for (let length = minLength; length <= playerCards.length; length++) {
      const combinations = this.getCombinations(playerCards, length);
      for (const combo of combinations) {
        const thunderResult = CardTypeValidator.identifyThunder(combo, this.currentLevel, this.trumpSuit);
        if (thunderResult.valid) {
          return combo;
        }
        const flashResult = CardTypeValidator.identifyFlash(combo, this.currentLevel, this.trumpSuit);
        if (flashResult.valid) {
          return combo;
        }
      }
    }
    return null;
  }

  // 辅助函数：查找顺子
  findStraight(playerCards, minLength) {
    // 尝试所有可能的顺子组合
    for (let length = minLength; length <= playerCards.length; length++) {
      const combinations = this.getCombinations(playerCards, length);
      for (const combo of combinations) {
        const straightResult = CardTypeValidator.identifyStraight(combo, this.currentLevel, this.trumpSuit);
        if (straightResult.valid) {
          return combo;
        }
      }
    }
    return null;
  }

  // 辅助函数：查找连对
  findConsecutivePairs(playerCards, minPairCount) {
    // 尝试所有可能的连对组合
    for (let pairCount = minPairCount; pairCount <= Math.floor(playerCards.length / 2); pairCount++) {
      const combinations = this.getCombinations(playerCards, pairCount * 2);
      for (const combo of combinations) {
        const consecutivePairsResult = CardTypeValidator.identifyConsecutivePairs(combo, this.currentLevel, this.trumpSuit);
        if (consecutivePairsResult.valid) {
          return combo;
        }
      }
    }
    return null;
  }

  // 辅助函数：生成指定长度的所有组合
  getCombinations(arr, length) {
    if (length === 0) return [[]];
    if (length > arr.length) return [];
    
    const combinations = [];
    
    function backtrack(start, current) {
      if (current.length === length) {
        combinations.push([...current]);
        return;
      }
      
      for (let i = start; i < arr.length; i++) {
        current.push(arr[i]);
        backtrack(i + 1, current);
        current.pop();
      }
    }
    
    backtrack(0, []);
    return combinations;
  }

  // 辅助函数：查找对子
  findPairs(playerCards) {
    const pairs = [];
    const cardCount = {};
    
    // 统计每张牌的数量
    for (const card of playerCards) {
      const key = `${card.suit}-${card.rank}`;
      cardCount[key] = (cardCount[key] || 0) + 1;
    }
    
    // 找出对子
    for (const card of playerCards) {
      const key = `${card.suit}-${card.rank}`;
      if (cardCount[key] >= 2) {
        const pair = [card, card];
        if (!pairs.some(existingPair => 
          existingPair[0].suit === pair[0].suit && existingPair[0].rank === pair[0].rank
        )) {
          pairs.push(pair);
        }
      }
    }
    
    return pairs;
  }

  // 辅助函数：在玩家手牌中查找指定的牌组合
  findCardsInHand(player, targetCards) {
    const playerCards = [...player.cards];
    const foundCards = [];
    
    for (const targetCard of targetCards) {
      const cardIndex = playerCards.findIndex(card => 
        card.suit === targetCard.suit && card.rank === targetCard.rank
      );
      
      if (cardIndex === -1) {
        return null; // 找不到对应的牌
      }
      
      foundCards.push(playerCards[cardIndex]);
      playerCards.splice(cardIndex, 1); // 移除已找到的牌，避免重复
    }
    
    return foundCards;
  }
}

module.exports = ShandongUpgradeGame;
