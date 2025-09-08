// 扑克牌工具函数

// 判断是否为主牌
export const isCardTrump = (card, currentLevel = 2, trumpSuit = null) => {
  // 大小王总是主牌
  if (card.suit === 'joker') return true;
  
  // 级牌总是主牌
  if (card.rank === currentLevel) return true;
  
  // 山东升级：2,3,5为常主（无论是否确定主花色）
  if ([2, 3, 5].includes(card.rank)) return true;
  
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
  if (card.rank === currentLevel) {
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
  
  // 常主牌的处理：2,3,5
  const permanentTrumps = [2, 3, 5];
  if (permanentTrumps.includes(card.rank) && card.rank !== currentLevel) {
    if (!trumpSuit) {
      // 没有主花色时，常主牌(2,3,5)仍在主牌区域，但按花色排序
      const suitWeight = getSuitWeight(card.suit, trumpSuit);
      let baseValue;
      if (card.rank === 5) baseValue = 992; // 5的基础权重
      else if (card.rank === 3) baseValue = 988; // 3的基础权重  
      else if (card.rank === 2) baseValue = 984; // 2的基础权重
      
      return baseValue - suitWeight; // 按花色细分：红桃>黑桃>方块>梅花
    }
    
    if (card.suit === trumpSuit) {
      // 主牌中的常主（按5>3>2的顺序）
      if (card.rank === 5) return 995;
      if (card.rank === 3) return 993;
      if (card.rank === 2) return 991;
    } else {
      // 副牌中的常主（按5>3>2的顺序）
      if (card.rank === 5) return 994;
      if (card.rank === 3) return 992;
      if (card.rank === 2) return 990;
    }
  }
  
  // 其他牌的基础值（A>K>Q>J>10>9>8>7>6>4）
  const rankValues = {
    'A': 900, 'K': 890, 'Q': 880, 'J': 870, 
    10: 860, 9: 850, 8: 840, 7: 830, 6: 820, 4: 810
  };
  
  const baseValue = rankValues[card.rank] || 0;
  
  // 如果是主牌但不是常主，加权重
  if (card.suit === trumpSuit && !permanentTrumps.includes(card.rank) && card.rank !== currentLevel) {
    return baseValue + 100; // 主牌加100
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

  // 甩牌
  return {
    type: 'mixed',
    name: '甩牌',
    cards: sortedCards,
    message: `${cards.length}张甩牌`
  };
};

// 识别对子
export const identifyPair = (cards, currentLevel = 2, trumpSuit = null) => {
  if (cards.length !== 2) return { valid: false };
  
  const [card1, card2] = cards;
  
  // 检查是否相同点数
  if (card1.rank === card2.rank) {
    return { 
      valid: true, 
      rank: card1.rank,
      isTrumpPair: isCardTrump(card1, currentLevel, trumpSuit)
    };
  }
  
  return { valid: false };
};

// 识别连对
export const identifyConsecutivePairs = (cards, currentLevel = 2, trumpSuit = null) => {
  if (cards.length < 4 || cards.length % 2 !== 0) return { valid: false };

  const pairs = [];
  for (let i = 0; i < cards.length; i += 2) {
    const pairResult = identifyPair([cards[i], cards[i + 1]], currentLevel, trumpSuit);
    if (!pairResult.valid) {
      return { valid: false };
    }
    pairs.push({
      rank: pairResult.rank,
      value: getCardValue(cards[i], currentLevel, trumpSuit),
      isTrump: pairResult.isTrumpPair
    });
  }

  // 检查是否连续
  pairs.sort((a, b) => a.value - b.value);
  
  for (let i = 1; i < pairs.length; i++) {
    if (pairs[i].value !== pairs[i-1].value + 1) {
      return { valid: false };
    }
    // 主副牌不能混合组成连对
    if (pairs[i].isTrump !== pairs[i-1].isTrump) {
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
    const suits = new Set(cards.map(card => card.suit));
    const ranks = new Set(cards.map(card => card.rank));
    
    // 四张相同点数，四种不同花色
    if (ranks.size === 1 && suits.size === 4) {
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

  return { valid: false };
};

// 识别雨（顺子）
export const identifyStraight = (cards, currentLevel = 2, trumpSuit = null) => {
  if (cards.length < 5) return { valid: false };

  // 必须是同一花色
  const suit = cards[0].suit;
  if (!cards.every(card => card.suit === suit)) {
    return { valid: false };
  }

  // 不能是主牌组成的顺子
  if (isCardTrump(cards[0], currentLevel, trumpSuit)) {
    return { valid: false };
  }

  // 检查是否连续
  const values = cards.map(card => getCardValue(card, currentLevel, trumpSuit));
  values.sort((a, b) => a - b);

  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i-1] + 1) {
      return { valid: false };
    }
  }

  return { valid: true };
};
