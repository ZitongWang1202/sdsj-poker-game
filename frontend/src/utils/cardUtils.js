// 扑克牌工具函数

// 判断是否为主牌
export const isCardTrump = (card, currentLevel = 2, trumpSuit = null) => {
  // 大小王总是主牌
  if (card.suit === 'joker') return true;
  
  // 级牌总是主牌
  if (card.rank === currentLevel) return true;
  
  // 山东升级：2,3,5为常主
  if ([2, 3, 5].includes(card.rank)) return true;
  
  // 主花色的牌
  if (card.suit === trumpSuit) return true;
  
  return false;
};

// 获取牌的数值
export const getCardValue = (card, currentLevel = 2, trumpSuit = null) => {
  // 山东升级特殊规则：2,3,5为常主
  const permanentTrumps = [2, 3, 5];
  
  if (card.suit === 'joker') {
    return card.rank === 'small' ? 16 : 17; // 小王16，大王17
  }
  
  // 如果是当前级牌
  if (card.rank === currentLevel) {
    if (card.suit === trumpSuit) {
      return 15; // 主级牌
    } else {
      return 14; // 副级牌
    }
  }
  
  // 常主牌
  if (permanentTrumps.includes(card.rank)) {
    if (card.suit === trumpSuit) {
      // 主牌中的常主
      if (card.rank === 2) return 11;
      if (card.rank === 3) return 12;
      if (card.rank === 5) return 13;
    } else {
      // 副牌中的常主
      if (card.rank === 2) return 8;
      if (card.rank === 3) return 9;
      if (card.rank === 5) return 10;
    }
  }
  
  // 普通牌
  const rankValues = {
    4: 1, 6: 2, 7: 3, 8: 4, 9: 5,
    'J': 6, 'Q': 7, 'K': 8, 'A': 9
  };
  
  return rankValues[card.rank] || 0;
};

// 排序手牌
export const sortCards = (cards, currentLevel = 2, trumpSuit = null) => {
  return [...cards].sort((a, b) => {
    // 先按主副牌分类，再按大小排序
    const aIsTrump = isCardTrump(a, currentLevel, trumpSuit);
    const bIsTrump = isCardTrump(b, currentLevel, trumpSuit);
    
    if (aIsTrump && !bIsTrump) return 1;
    if (!aIsTrump && bIsTrump) return -1;
    
    if (aIsTrump && bIsTrump) {
      // 都是主牌，按主牌顺序排序
      return getCardValue(a, currentLevel, trumpSuit) - getCardValue(b, currentLevel, trumpSuit);
    } else {
      // 都是副牌，先按花色再按大小
      if (a.suit !== b.suit) {
        return a.suit.localeCompare(b.suit);
      }
      return getCardValue(a, currentLevel, trumpSuit) - getCardValue(b, currentLevel, trumpSuit);
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
