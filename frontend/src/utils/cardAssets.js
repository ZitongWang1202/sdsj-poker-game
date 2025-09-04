// 卡牌资源管理工具

/**
 * 获取卡牌SVG路径
 * @param {Object} card - 卡牌对象 {suit, rank}
 * @returns {string} SVG文件路径
 */
export const getCardImagePath = (card) => {
  if (!card || !card.suit || !card.rank) {
    return '/assets/cards/BACK.svg';
  }

  // 处理卡牌背面
  if (card.suit === 'BACK' || card.rank === 'BACK') {
    return '/assets/cards/BACK.svg';
  }

  // 处理大小王
  if (card.suit === 'JOKER' || card.suit === 'joker') {
    console.log('🃏 处理大小王:', { suit: card.suit, rank: card.rank });
    if (card.rank === 'BIG' || card.rank === 'big') {
      return '/assets/cards/JOKER/BIG_JOKER.svg';
    }
    if (card.rank === 'SMALL' || card.rank === 'small') {
      return '/assets/cards/JOKER/SMALL_JOKER.svg';
    }
    // 如果都不匹配，记录错误信息
    console.warn('⚠️ 大小王rank不匹配:', card.rank);
  }

  // 处理普通牌
  const suit = card.suit.toUpperCase();
  let rank = card.rank.toString().toUpperCase();
  
  // 处理特殊牌面
  if (rank === '1') rank = 'A';  // A牌
  if (rank === '11') rank = 'J'; // J牌
  if (rank === '12') rank = 'Q'; // Q牌  
  if (rank === '13') rank = 'K'; // K牌

  return `/assets/cards/${suit}/${suit}_${rank}.svg`;
};

/**
 * 获取卡牌背面图片路径
 * @returns {string} 卡牌背面SVG路径
 */
export const getCardBackPath = () => {
  return '/assets/cards/BACK.svg';
};

/**
 * 预加载卡牌图片
 * @param {Array} cards - 卡牌数组
 */
export const preloadCardImages = (cards) => {
  cards.forEach(card => {
    const img = new Image();
    img.src = getCardImagePath(card);
  });
};

/**
 * 获取花色的中文名称
 * @param {string} suit - 花色英文名
 * @returns {string} 花色中文名
 */
export const getSuitNameChinese = (suit) => {
  const suitMap = {
    'HEARTS': '红桃',
    'DIAMONDS': '方片', 
    'CLUBS': '梅花',
    'SPADES': '黑桃',
    'JOKER': '王'
  };
  return suitMap[suit?.toUpperCase()] || suit;
};

/**
 * 获取牌面的中文名称
 * @param {string|number} rank - 牌面
 * @returns {string} 牌面中文名
 */
export const getRankNameChinese = (rank) => {
  const rankMap = {
    'A': 'A',
    '1': 'A',
    '2': '2',
    '3': '3', 
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
    'J': 'J',
    '11': 'J',
    'Q': 'Q', 
    '12': 'Q',
    'K': 'K',
    '13': 'K',
    'BIG': '大王',
    'big': '大王',
    'SMALL': '小王',
    'small': '小王'
  };
  return rankMap[rank?.toString()] || rank;
};
