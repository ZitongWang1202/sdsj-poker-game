// 扑克牌工具函数

// 判断是否为主牌
export const isCardTrump = (card, currentLevel = 2, trumpSuit = null) => {
  // 大小王总是主牌
  if (card.suit === 'joker') return true;
  
  // 级牌总是主牌
  const rankStr = String(card.rank);
  const levelStr = String(currentLevel);
  if (rankStr === levelStr) return true;
  
  // 山东升级：2,3,5为常主（但如果级牌是2,3,5之一，则该级牌优先级最高）
  const permanentTrumps = ['2', '3', '5'].filter(r => r !== levelStr);
  if (permanentTrumps.includes(rankStr)) return true;
  
  // 主花色的牌（如果已确定主花色）
  if (card.suit === trumpSuit) return true;
  
  return false;
};

// 获取牌的数值（新排序规则）
export const getCardValue = (card, currentLevel = 2, trumpSuit = null) => {
  // 大王和小王
  if (card.suit === 'joker') {
    return card.rank === 'small' ? 998 : 999; // 小王998，大王999
  }
  
  // 级牌的特殊处理
  const rankStr = String(card.rank);
  const levelStr = String(currentLevel);
  if (rankStr === levelStr) {
    if (!trumpSuit) {
      // 没有主花色时，级牌按花色排序，权重应该低于王但高于常主
      const suitWeight = getSuitWeight(card.suit, trumpSuit);
      return 996 - suitWeight; // 红桃2=996, 黑桃2=995, 方块2=994, 梅花2=993
    }
    
    if (card.suit === trumpSuit) {
      return 997; // 主级牌
    } else {
      return 996; // 副级牌
    }
  }
  
  // 常主牌的处理：2,3,5（但排除当前级牌）
  const permanentTrumps = ['2', '3', '5'].filter(r => r !== levelStr);
  if (permanentTrumps.includes(rankStr)) {
    if (!trumpSuit) {
      // 没有主花色时，常主牌(2,3,5)仍在主牌区域，但按花色排序
      const suitWeight = getSuitWeight(card.suit, trumpSuit);
      let baseValue;
      if (rankStr === '5') baseValue = 992; // 5的基础权重
      else if (rankStr === '3') baseValue = 988; // 3的基础权重  
      else if (rankStr === '2') baseValue = 984; // 2的基础权重
      
      return baseValue - suitWeight; // 按花色细分：红桃>黑桃>方块>梅花
    }
    
    if (card.suit === trumpSuit) {
      // 主牌中的常主（按5>3>2的顺序）
      if (rankStr === '5') return 995;
      if (rankStr === '3') return 993;
      if (rankStr === '2') return 991;
    } else {
      // 副牌中的常主（按5>3>2的顺序）
      if (rankStr === '5') return 994;
      if (rankStr === '3') return 992;
      if (rankStr === '2') return 990;
    }
  }
  
  // 其他牌的基础值（A>K>Q>J>10>9>8>7>6>4）
  const rankValues = {
    'A': 900, 'K': 890, 'Q': 880, 'J': 870, 
    10: 860, 9: 850, 8: 840, 7: 830, 6: 820, 4: 810
  };
  
  const baseValue = rankValues[card.rank] || 0;
  
  // 如果是主花色但不是级牌也不是常主的普通牌
  if (card.suit === trumpSuit && !permanentTrumps.includes(rankStr) && rankStr !== levelStr) {
    // 主花色普通牌的权重应该低于所有特殊主牌，但高于副牌
    // 特殊主牌权重: 大王999, 小王998, 主级牌997, 副级牌996, 常主995-990
    // 主花色普通牌权重范围: 980-989
    const trumpNormalRankValues = {
      'A': 989, 'K': 988, 'Q': 987, 'J': 986, 
      10: 985, 9: 984, 8: 983, 7: 982, 6: 981, 4: 980
    };
    return trumpNormalRankValues[card.rank] || 980;
  }
  
  return baseValue; // 副牌基础值
};

// 花色排序逻辑（循环数组版）
const getSuitWeight = (suit, trumpSuit) => {
  // 默认花色顺序：红桃(0) 黑桃(1) 方块(2) 梅花(3)
  const defaultSuitOrder = ['hearts', 'spades', 'diamonds', 'clubs'];
  
  // 如果没有主花色，按默认顺序
  if (!trumpSuit) {
    return defaultSuitOrder.indexOf(suit);
  }
  
  // 找到主花色在原数组中的位置
  const trumpIndex = defaultSuitOrder.indexOf(trumpSuit);
  
  if (trumpIndex === -1) {
    // 如果主花色不在数组中，按默认顺序
    return defaultSuitOrder.indexOf(suit);
  }
  
  // 创建循环排列：从主花色开始，按原数组循环顺序排列
  const suitIndex = defaultSuitOrder.indexOf(suit);
  
  if (suitIndex === -1) {
    return 999; // 未知花色排在最后
  }
  
  // 计算相对于主花色的循环位置
  // 例如：主色是方块(2)，则排列为 方块(2)→梅花(3)→红桃(0)→黑桃(1)
  // 方块的权重是0，梅花的权重是1，红桃的权重是2，黑桃的权重是3
  let weight;
  if (suitIndex >= trumpIndex) {
    weight = suitIndex - trumpIndex; // 主花色及其后面的花色
  } else {
    weight = (defaultSuitOrder.length - trumpIndex) + suitIndex; // 循环到前面的花色
  }
  
  return weight;
};

// 排序手牌（新规则：主牌在左，副牌在右）
export const sortCards = (cards, currentLevel = 2, trumpSuit = null) => {
  return [...cards].sort((a, b) => {
    const aIsTrump = isCardTrump(a, currentLevel, trumpSuit);
    const bIsTrump = isCardTrump(b, currentLevel, trumpSuit);
    
    // 主牌在左（较小值），副牌在右（较大值）
    if (aIsTrump && !bIsTrump) return -1;
    if (!aIsTrump && bIsTrump) return 1;
    
    if (aIsTrump && bIsTrump) {
      // 都是主牌，按牌力从大到小排序（大王>小王>主级牌>副级牌...）
      return getCardValue(b, currentLevel, trumpSuit) - getCardValue(a, currentLevel, trumpSuit);
    } else {
      // 都是副牌，先按花色权重，再按牌力从大到小
      const aSuitWeight = getSuitWeight(a.suit, trumpSuit);
      const bSuitWeight = getSuitWeight(b.suit, trumpSuit);
      
      if (aSuitWeight !== bSuitWeight) {
        return aSuitWeight - bSuitWeight;
      }
      
      // 同花色内按牌力从大到小排序
      return getCardValue(b, currentLevel, trumpSuit) - getCardValue(a, currentLevel, trumpSuit);
    }
  });
};

// 获取牌的中文显示名称
export const getCardDisplayName = (card) => {
  if (!card) return '';
  
  if (card.suit === 'joker') {
    return card.rank === 'small' ? '小王' : '大王';
  }
  
  const suitNames = {
    'spades': '♠',
    'hearts': '♥',
    'diamonds': '♦',
    'clubs': '♣'
  };
  
  const rankNames = {
    'J': 'J',
    'Q': 'Q', 
    'K': 'K',
    'A': 'A'
  };
  
  const suitSymbol = suitNames[card.suit];
  const rankDisplay = rankNames[card.rank] || card.rank;
  
  return `${suitSymbol}${rankDisplay}`;
};

// 创建简单的扑克牌表示（用于测试）
export const createCard = (suit, rank, deckNumber = 0) => {
  return {
    suit,
    rank,
    deckNumber,
    id: `${suit}_${rank}_${deckNumber}`,
    displayName: getCardDisplayName({ suit, rank })
  };
};

// 创建一副完整的牌
export const createDeck = () => {
  const deck = [];
  const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
  const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];
  
  // 创建两副牌
  for (let deckNum = 0; deckNum < 2; deckNum++) {
    // 普通牌
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(createCard(suit, rank, deckNum));
      }
    }
    
    // 大小王
    deck.push(createCard('joker', 'small', deckNum));
    deck.push(createCard('joker', 'big', deckNum));
  }
  
  return deck;
};

// 山东升级牌型识别

// 识别牌型
export const identifyCardType = (cards, currentLevel = 2, trumpSuit = null) => {
  if (!cards || cards.length === 0) {
    return { type: 'invalid', message: '没有选择牌' };
  }

  const sortedCards = sortCards(cards, currentLevel, trumpSuit);
  
  // 单张
  if (cards.length === 1) {
    return {
      type: 'single',
      name: '单张',
      cards: sortedCards,
      message: `单张 ${getCardDisplayName(sortedCards[0])}`
    };
  }

  // 对子
  if (cards.length === 2) {
    const result = identifyPair(sortedCards, currentLevel, trumpSuit);
    if (result.valid) {
      return {
        type: 'pair',
        name: '对子',
        cards: sortedCards,
        message: `对子 ${getCardDisplayName(sortedCards[0])}`
      };
    }
  }

  // 连对（拖拉机）
  if (cards.length >= 4 && cards.length % 2 === 0) {
    const consecutivePairs = identifyConsecutivePairs(sortedCards, currentLevel, trumpSuit);
    if (consecutivePairs.valid) {
      return {
        type: 'consecutive_pairs',
        name: '连对',
        cards: sortedCards,
        message: `${consecutivePairs.pairCount}连对`
      };
    }
  }

  // 闪/震（四张不同花色的主牌）
  if (cards.length >= 4) {
    const flash = identifyFlash(sortedCards, currentLevel, trumpSuit);
    if (flash.valid) {
      return {
        type: flash.type,
        name: flash.name,
        cards: sortedCards,
        message: flash.message
      };
    }
  }

  // 雨（顺子）
  if (cards.length >= 5) {
    const straight = identifyStraight(sortedCards, currentLevel, trumpSuit);
    if (straight.valid) {
      return {
        type: 'straight',
        name: '雨',
        cards: sortedCards,
        message: `${cards.length}张雨`
      };
    }
  }

  // 甩牌验证
  const mixedValidation = validateMixed(sortedCards, currentLevel, trumpSuit);
  if (mixedValidation.valid) {
    return {
      type: 'mixed',
      name: '甩牌',
      cards: sortedCards,
      message: `${cards.length}张甩牌`
    };
  } else {
    return {
      type: 'invalid',
      name: '无效牌型',
      cards: sortedCards,
      message: mixedValidation.message
    };
  }
};

// 识别对子
export const identifyPair = (cards, currentLevel = 2, trumpSuit = null) => {
  if (cards.length !== 2) return { valid: false };
  
  const [card1, card2] = cards;
  
  // 检查是否相同点数
  if (card1.rank === card2.rank) {
    // 王的特殊处理：大王对大王，小王对小王
    if (card1.suit === 'joker' && card2.suit === 'joker') {
      return { 
        valid: true, 
        rank: card1.rank,
        isTrumpPair: true
      };
    }
    
    // 对于非王牌，必须是相同花色才能组成对子
    if (card1.suit === card2.suit) {
      return { 
        valid: true, 
        rank: card1.rank,
        isTrumpPair: isCardTrump(card1, currentLevel, trumpSuit)
      };
    }
    
    // 相同点数但不同花色，不能组成对子
    return { valid: false };
  }
  
  return { valid: false };
};

// 获取用于连续性检查的牌值（专门用于连对和顺子判定）
export const getSequentialValue = (card, currentLevel = 2, trumpSuit = null) => {
  // 先判断是否为主牌
  const isTrump = isCardTrump(card, currentLevel, trumpSuit);
  
  // 主牌按照升级规则排序：大王 > 小王 > 主级牌 > 副级牌 > 常主（5>3>2）> 主花色普通牌
  if (isTrump) {
    // 大小王
    if (card.suit === 'joker') {
      return card.rank === 'small' ? 1000 : 1001;
    }
    
    // 级牌
    const rankStr = String(card.rank);
    const levelStr = String(currentLevel);
    if (rankStr === levelStr) {
      if (card.suit === trumpSuit) {
        return 999; // 主级牌
      } else {
        return 998; // 副级牌
      }
    }
    
    // 常主牌（2,3,5）- 使用非连续数值，防止形成连对
    const permanentTrumps = ['2', '3', '5'];
    if (permanentTrumps.includes(rankStr)) {
      if (card.suit === trumpSuit) {
        // 主花色常主 - 使用大间隔的数值，确保不连续
        if (rankStr === '5') return 950;  // 间隔50
        if (rankStr === '3') return 900;  // 间隔50
        if (rankStr === '2') return 850;  // 间隔50
      } else {
        // 副花色常主 - 同样使用大间隔
        if (rankStr === '5') return 800;
        if (rankStr === '3') return 750;
        if (rankStr === '2') return 700;
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
    const isPermanentTrump = ['2', '3', '5'].includes(card.rank);
    
    // 级牌和常主不能作为副牌参与连对
    if (isLevelCard || isPermanentTrump) {
      return -1; // 特殊标记，表示无法参与副牌连对
    }
    
  // B2规则：副牌自然连续包含5，但5已作为常主在上方直接返回-1
  const suitRankOrder = ['A', 'K', 'Q', 'J', 10, 9, 8, 7, 6, 5, 4];
    const index = suitRankOrder.indexOf(card.rank);
    if (index !== -1) {
      return 100 + (suitRankOrder.length - 1 - index); // 从100开始递增，保持连续性
    }
    
    return 0;
  }
};

// 识别连对
export const identifyConsecutivePairs = (cards, currentLevel = 2, trumpSuit = null) => {
  if (cards.length < 4 || cards.length % 2 !== 0) return { valid: false };

  // 特殊检查：两张小王两张大王的连对
  if (cards.length === 4) {
    const jokerCards = cards.filter(card => card.suit === 'joker');
    if (jokerCards.length === 4) {
      const smallJokers = jokerCards.filter(card => card.rank === 'small');
      const bigJokers = jokerCards.filter(card => card.rank === 'big');
      
      if (smallJokers.length === 2 && bigJokers.length === 2) {
        return { 
          valid: true, 
          pairCount: 2,
          isTrump: true
        };
      }
    }
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

  // 检查每个点数是否都恰好有2张牌（形成对子）
  const pairs = [];
  for (const [rank, cardsOfRank] of Object.entries(rankGroups)) {
    if (cardsOfRank.length !== 2) {
      return { valid: false }; // 必须恰好2张才能形成对子
    }
    
    const [card1, card2] = cardsOfRank;
    
    // 检查花色是否匹配（对子必须同花色，除了王牌）
    if (card1.suit !== card2.suit) {
      // 王牌的特殊处理：大王对大王，小王对小王
      if (card1.suit === 'joker' && card2.suit === 'joker' && card1.rank === card2.rank) {
        // 王对王，允许
      } else {
        return { valid: false };
      }
    }
    
    const firstCard = cardsOfRank[0];
    const isTrumpPair = isCardTrump(firstCard, currentLevel, trumpSuit);
    const sequentialValue = getSequentialValue(firstCard, currentLevel, trumpSuit);
    
    // 检查是否有无效的牌值（例如副牌中的常主）
    if (sequentialValue === -1) {
      return { valid: false };
    }
    
    pairs.push({
      rank: rank,
      value: sequentialValue,
      isTrump: isTrumpPair
    });
  }

  // 检查对子数量是否正确
  if (pairs.length !== cards.length / 2) {
    return { valid: false };
  }

  // 检查主副牌是否混合
  const firstPairIsTrump = pairs[0].isTrump;
  if (!pairs.every(p => p.isTrump === firstPairIsTrump)) {
    return { valid: false };
  }

  // 检查连对中所有牌是否为同一花色（除了王牌）
  const allSuits = new Set(cards.map(card => card.suit));
  if (allSuits.size > 1) {
    // 如果有多种花色，只有全部是王牌才允许
    const hasNonJoker = cards.some(card => card.suit !== 'joker');
    if (hasNonJoker) {
      return { valid: false };
    }
  }

  // 检查是否连续
  pairs.sort((a, b) => a.value - b.value);
  
  for (let i = 1; i < pairs.length; i++) {
    const diff = pairs[i].value - pairs[i-1].value;
    
    if (diff !== 1) {
      return { valid: false };
    }
  }

  return { 
    valid: true, 
    pairCount: pairs.length,
    isTrump: pairs[0].isTrump
  };
};

// 识别闪/震
export const identifyFlash = (cards, currentLevel = 2, trumpSuit = null) => {
  // 必须都是主牌
  const trumpCards = cards.filter(card => isCardTrump(card, currentLevel, trumpSuit));
  if (trumpCards.length !== cards.length) {
    return { valid: false };
  }

  // 检查是否四张不同花色
  if (cards.length >= 4) {
    const ranks = new Set(cards.map(card => card.rank));
    
    // 四张相同点数
    if (ranks.size === 1) {
      // 仅允许 级牌 或 常主(2/3/5)，不允许王
      const rankStr = String(cards[0].rank);
      const levelStr = String(currentLevel);
      const allowed = rankStr === levelStr || ['2','3','5'].includes(rankStr);
      if (!allowed) return { valid: false };
      
      // 检查是否四种不同花色（排除王，只考虑普通花色）
      const suits = new Set(cards.map(card => card.suit));
      
      // 必须四种不同花色，且不能包含王
      if (suits.size === 4 && !suits.has('joker')) {
        if (cards.length === 4) {
          return {
            valid: true,
            type: 'flash',
            name: '闪',
            message: `${getCardDisplayName(cards[0])}闪`
          };
        } else {
          return {
            valid: true,
            type: 'thunder',
            name: '震',
            message: `${getCardDisplayName(cards[0])}震`
          };
        }
      }
    }
  }

  return { valid: false };
};

// 识别雨（顺子）
export const identifyStraight = (cards, currentLevel = 2, trumpSuit = null) => {
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

  // 3) 若为副花色：不得包含任何会被判为主的牌（安全网）
  const isTrumpSuit = trumpSuit && suit === trumpSuit;
  if (!isTrumpSuit) {
    const hasTrumpCard = cards.some(card => isCardTrump(card, currentLevel, trumpSuit));
    if (hasTrumpCard) return { valid: false };
  }

  // 4) 计算秩序并检查覆盖连续区间，允许重复
  const order = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];
  const toIdx = (r) => order.indexOf(r);
  const idxs = cards.map(c => toIdx(c.rank)).filter(i => i >= 0);
  if (idxs.length !== cards.length) return { valid: false };

  // 获取所有唯一的牌点索引
  const unique = [...new Set(idxs)].sort((a, b) => a - b);
  
  // 检查是否有至少5个不同的牌点
  if (unique.length < 5) return { valid: false };
  
  // 检查牌点是否连续
  for (let i = 1; i < unique.length; i++) {
    if (unique[i] !== unique[i - 1] + 1) return { valid: false };
  }

  // 检查所有牌都在连续区间内（允许重复）
  const minIdx = unique[0];
  const maxIdx = unique[unique.length - 1];
  if (!idxs.every(i => i >= minIdx && i <= maxIdx)) return { valid: false };

  return { valid: true };
};

// 验证甩牌规则
export const validateMixed = (cards, currentLevel = 2, trumpSuit = null) => {
  if (!cards || cards.length === 0) {
    return { valid: false, message: '没有选择牌' };
  }

  // 检查主副牌是否混合
  const trumpCards = cards.filter(card => isCardTrump(card, currentLevel, trumpSuit));
  const nonTrumpCards = cards.filter(card => !isCardTrump(card, currentLevel, trumpSuit));
  
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
    
    // 额外检查：如果是副牌且≥5张，检查是否可能是雨（顺子）
    if (cards.length >= 5) {
      // 如果可能是雨，则不应该识别为甩牌
      const levelStr = String(currentLevel);
      const forbiddenRanks = new Set(['2','3','5', levelStr]);
      const hasForbiddenRanks = cards.some(c => forbiddenRanks.has(String(c.rank)));
      
      if (!hasForbiddenRanks) {
        // 检查是否连续（简化版检查）
        const order = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];
        const toIdx = (r) => order.indexOf(r);
        const idxs = cards.map(c => toIdx(c.rank)).filter(i => i >= 0);
        
        if (idxs.length === cards.length) {
          const unique = [...new Set(idxs)].sort((a, b) => a - b);
          if (unique.length >= 5) {
            // 检查是否连续
            let isConsecutive = true;
            for (let i = 1; i < unique.length; i++) {
              if (unique[i] !== unique[i - 1] + 1) {
                isConsecutive = false;
                break;
              }
            }
            
            if (isConsecutive) {
              // 这可能是雨，不应该识别为甩牌
              return { valid: false, message: '可能是雨（顺子），请检查牌型识别' };
            }
          }
        }
      }
    }
  }

  return { valid: true };
};
