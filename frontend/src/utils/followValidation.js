// 前端跟牌规则验证
import { identifyCardType, isCardTrump, getCardValue, getCardDisplayName } from './cardUtils';

// 跟牌规则验证
export const validateFollowCards = (cardsToPlay, leadCard, myCards, currentLevel = 2, trumpSuit = null) => {
  if (!leadCard || !leadCard.cards) {
    return { valid: true }; // 首家出牌，无需验证跟牌规则
  }

  const leadCards = leadCard.cards;
  const leadType = identifyCardType(leadCards, currentLevel, trumpSuit);
  
  // 必须出相同数量的牌
  if (cardsToPlay.length !== leadCards.length) {
    return { 
      valid: false, 
      message: `必须出${leadCards.length}张牌` 
    };
  }

  // 获取领出花色
  const leadSuit = getLeadSuit(leadCards, currentLevel, trumpSuit);
  
  // 检查是否有对应花色的牌
  const availableCards = getPlayerCardsOfSuit(myCards, leadSuit, currentLevel, trumpSuit);
  const hasLeadSuit = availableCards.length > 0;
  
  // 如果有对应花色，检查是否有足够的牌跟牌
  if (hasLeadSuit) {
    // 如果该花色的牌数够出牌，必须跟花色
    if (availableCards.length >= cardsToPlay.length) {
      if (!isFollowingSuit(cardsToPlay, leadSuit, currentLevel, trumpSuit)) {
        return { 
          valid: false, 
          message: `有${getSuitName(leadSuit)}必须跟牌` 
        };
      }
    }
    // 如果该花色的牌数不够，允许垫牌（混合花色出牌）
  }

  // 强制跟牌规则验证（只有当有足够的对应花色牌时才检查）
  if (hasLeadSuit && availableCards.length >= cardsToPlay.length) {
    const mandatoryFollow = checkMandatoryFollow(
      leadType,
      cardsToPlay,
      availableCards,
      myCards, // 传入全部手牌用于检查对子
      leadSuit,
      currentLevel,
      trumpSuit
    );
    
    if (!mandatoryFollow.valid) {
      return mandatoryFollow;
    }
  }

  return { valid: true };
};

// 获取领出花色
const getLeadSuit = (cards, currentLevel, trumpSuit) => {
  if (cards.length === 0) return null;
  const firstCard = cards[0];
  if (isCardTrump(firstCard, currentLevel, trumpSuit)) {
    return 'trump';
  }
  return firstCard.suit;
};

// 获取玩家在指定花色上的所有牌
const getPlayerCardsOfSuit = (playerCards, leadSuit, currentLevel, trumpSuit) => {
  if (leadSuit === 'trump') {
    return playerCards.filter(card => isCardTrump(card, currentLevel, trumpSuit));
  } else {
    return playerCards.filter(card => 
      card.suit === leadSuit && !isCardTrump(card, currentLevel, trumpSuit)
    );
  }
};

// 检查是否跟了对应花色
const isFollowingSuit = (cards, leadSuit, currentLevel, trumpSuit) => {
  if (leadSuit === 'trump') {
    return cards.every(card => isCardTrump(card, currentLevel, trumpSuit));
  }
  // 非主花色时，必须是对应花色且不是主牌（排除常主/级牌/王/主花色）
  return cards.every(card => card.suit === leadSuit && !isCardTrump(card, currentLevel, trumpSuit));
};

// 获取花色名称
const getSuitName = (suit) => {
  const names = {
    'spades': '黑桃',
    'hearts': '红桃', 
    'diamonds': '方块',
    'clubs': '梅花',
    'trump': '主牌'
  };
  return names[suit] || suit;
};

// 强制跟牌检查
const checkMandatoryFollow = (leadType, cardsToPlay, availableCards, allCards, leadSuit, currentLevel, trumpSuit) => {
  const sortedAvailable = [...availableCards].sort((a, b) => 
    getCardValue(b, currentLevel, trumpSuit) - getCardValue(a, currentLevel, trumpSuit)
  );
  
  switch (leadType.type) {
    case 'single':
      return { valid: true }; // 单张可以出任意同花色单张
      
    case 'pair':
      return checkMandatoryPair(cardsToPlay, sortedAvailable, allCards, leadSuit, currentLevel, trumpSuit);
      
    default:
      return { valid: true };
  }
};

// 对子强制检查
const checkMandatoryPair = (cardsToPlay, sortedAvailable, allCards, leadSuit, currentLevel, trumpSuit) => {
  if (cardsToPlay.length !== 2) {
    return { valid: false, message: '必须出两张牌' };
  }
  
  // 在全部手牌中检查是否有领出花色的对子
  const leadSuitPairs = findLeadSuitPairs(allCards, leadSuit, currentLevel, trumpSuit);
  
  if (leadSuitPairs.length > 0) {
    // 有对子，必须出对子
    const [card1, card2] = cardsToPlay;
    if (card1.rank === card2.rank && card1.suit === card2.suit) {
      return { valid: true };
    }
    return { 
      valid: false, 
      message: '有对子必须出对子' 
    };
  } else {
    // 没有对子，必须出两张最大的单张
    const expectedCards = sortedAvailable.slice(0, 2);
    const playedIds = cardsToPlay.map(c => c.id).sort();
    const expectedIds = expectedCards.map(c => c.id).sort();
    
    if (!playedIds.every((id, index) => id === expectedIds[index])) {
      return { 
        valid: false, 
        message: `必须出两张最大的牌: ${expectedCards.map(c => getCardDisplayName(c)).join(', ')}` 
      };
    }
    return { valid: true };
  }
};

// 找对子
const findPairs = (cards) => {
  const pairs = [];
  const used = new Set();
  
  for (let i = 0; i < cards.length - 1; i++) {
    if (used.has(i)) continue;
    
    for (let j = i + 1; j < cards.length; j++) {
      if (used.has(j)) continue;
      
      const card1 = cards[i];
      const card2 = cards[j];
      
      if (card1.rank === card2.rank && card1.suit === card2.suit) {
        pairs.push([card1, card2]);
        used.add(i);
        used.add(j);
        break;
      }
    }
  }
  
  return pairs;
};

// 找领出花色的对子
const findLeadSuitPairs = (allCards, leadSuit, currentLevel, trumpSuit) => {
  const pairs = [];
  const used = new Set();
  
  // 先筛选出领出花色的牌
  const leadSuitCards = getPlayerCardsOfSuit(allCards, leadSuit, currentLevel, trumpSuit);
  
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
};
