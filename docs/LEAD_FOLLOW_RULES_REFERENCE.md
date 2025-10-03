## 领出/跟牌规则实现参考（源码摘录）

说明：以下为当前代码中与"领出/跟牌"直接相关的核心函数完整实现，便于逐条对照规则核查。分为前端与后端两部分，均为当前仓库实际源码的原样拷贝。

---

### 前端 `frontend/src/utils/followValidation.js`

```javascript
// 前端跟牌规则验证
// 导入必要的工具函数：牌型识别、主牌判断、牌值计算、显示名称
import { identifyCardType, isCardTrump, getCardValue, getCardDisplayName } from './cardUtils';

/**
 * 跟牌规则验证主函数
 * @param {Array} cardsToPlay - 玩家要出的牌
 * @param {Object} leadCard - 领出牌信息 {cards: Array, cardType: Object}
 * @param {Array} myCards - 玩家当前手牌
 * @param {number} currentLevel - 当前级牌（默认2）
 * @param {string} trumpSuit - 主花色（null表示未确定）
 * @returns {Object} {valid: boolean, message?: string}
 */
export const validateFollowCards = (cardsToPlay, leadCard, myCards, currentLevel = 2, trumpSuit = null) => {
  // 如果没有领出牌，说明是首家出牌，无需验证跟牌规则
  if (!leadCard || !leadCard.cards) {
    return { valid: true }; // 首家出牌，无需验证跟牌规则
  }

  // 获取领出牌组和牌型信息
  const leadCards = leadCard.cards;
  const leadType = identifyCardType(leadCards, currentLevel, trumpSuit);
  
  // 规则1：必须出相同数量的牌（跟牌数量必须与领出数量一致）
  if (cardsToPlay.length !== leadCards.length) {
    return { 
      valid: false, 
      message: `必须出${leadCards.length}张牌` 
    };
  }

  // 规则2：确定领出花色（主牌花色或具体花色）
  const leadSuit = getLeadSuit(leadCards, currentLevel, trumpSuit);
  
  // 规则3：检查玩家是否有对应花色的可跟牌
  const availableCards = getPlayerCardsOfSuit(myCards, leadSuit, currentLevel, trumpSuit);
  const hasLeadSuit = availableCards.length > 0;
  
  // 规则4：花色跟牌规则
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

  // 规则5：强制跟牌规则验证（只有当有足够的对应花色牌时才检查）
  if (hasLeadSuit && availableCards.length >= cardsToPlay.length) {
    const mandatoryFollow = checkMandatoryFollow(
      leadType,        // 领出牌型
      cardsToPlay,     // 要出的牌
      availableCards,  // 可跟的牌（已按牌力排序）
      myCards,         // 传入全部手牌用于检查对子
      leadSuit,        // 领出花色
      currentLevel,    // 当前级牌
      trumpSuit        // 主花色
    );
    
    if (!mandatoryFollow.valid) {
      return mandatoryFollow;
    }
  }

  return { valid: true };
};

/**
 * 获取领出花色
 * 核心逻辑：如果首张牌是主牌，则领出花色为'trump'；否则为首张牌的花色
 * @param {Array} cards - 领出牌组
 * @param {number} currentLevel - 当前级牌
 * @param {string} trumpSuit - 主花色
 * @returns {string|null} 领出花色：'trump'、'spades'、'hearts'、'diamonds'、'clubs' 或 null
 */
const getLeadSuit = (cards, currentLevel, trumpSuit) => {
  if (cards.length === 0) return null;  // 空牌组返回null
  const firstCard = cards[0];           // 取首张牌
  if (isCardTrump(firstCard, currentLevel, trumpSuit)) {
    return 'trump';  // 首张是主牌，领出花色为主牌
  }
  return firstCard.suit;  // 首张是副牌，领出花色为该牌花色
};

/**
 * 获取玩家在指定花色上的所有可跟牌
 * 核心逻辑：区分主牌花色和副牌花色，副牌花色时排除主牌（常主/级牌/王/主花色）
 * @param {Array} playerCards - 玩家手牌
 * @param {string} leadSuit - 领出花色
 * @param {number} currentLevel - 当前级牌
 * @param {string} trumpSuit - 主花色
 * @returns {Array} 可跟的牌数组
 */
const getPlayerCardsOfSuit = (playerCards, leadSuit, currentLevel, trumpSuit) => {
  if (leadSuit === 'trump') {
    // 领出主牌时，返回所有主牌（大小王、级牌、常主、主花色）
    return playerCards.filter(card => isCardTrump(card, currentLevel, trumpSuit));
  } else {
    // 领出副牌时，只返回该花色的副牌（排除该花色的主牌）
    return playerCards.filter(card => 
      card.suit === leadSuit && !isCardTrump(card, currentLevel, trumpSuit)
    );
  }
};

/**
 * 检查是否跟了对应花色
 * 核心逻辑：验证出的牌是否符合花色跟牌规则
 * @param {Array} cards - 要出的牌
 * @param {string} leadSuit - 领出花色
 * @param {number} currentLevel - 当前级牌
 * @param {string} trumpSuit - 主花色
 * @returns {boolean} 是否跟对花色
 */
const isFollowingSuit = (cards, leadSuit, currentLevel, trumpSuit) => {
  if (leadSuit === 'trump') {
    // 领出主牌时，出的牌必须全部是主牌
    return cards.every(card => isCardTrump(card, currentLevel, trumpSuit));
  }
  // 领出副牌时，出的牌必须全部是对应花色的副牌（排除常主/级牌/王/主花色）
  return cards.every(card => card.suit === leadSuit && !isCardTrump(card, currentLevel, trumpSuit));
};

/**
 * 获取花色中文名称
 * @param {string} suit - 花色标识
 * @returns {string} 中文名称
 */
const getSuitName = (suit) => {
  const names = {
    'spades': '黑桃',     // ♠
    'hearts': '红桃',     // ♥
    'diamonds': '方块',   // ♦
    'clubs': '梅花',      // ♣
    'trump': '主牌'       // 主牌统称
  };
  return names[suit] || suit;  // 未找到则返回原值
};

/**
 * 强制跟牌检查分派器
 * 根据领出牌型调用相应的强制规则检查
 * @param {Object} leadType - 领出牌型信息
 * @param {Array} cardsToPlay - 要出的牌
 * @param {Array} availableCards - 可跟的牌（未排序）
 * @param {Array} allCards - 全部手牌（用于检查对子）
 * @param {string} leadSuit - 领出花色
 * @param {number} currentLevel - 当前级牌
 * @param {string} trumpSuit - 主花色
 * @returns {Object} 验证结果
 */
const checkMandatoryFollow = (leadType, cardsToPlay, availableCards, allCards, leadSuit, currentLevel, trumpSuit) => {
  // 按牌力从大到小排序可用牌
  const sortedAvailable = [...availableCards].sort((a, b) => 
    getCardValue(b, currentLevel, trumpSuit) - getCardValue(a, currentLevel, trumpSuit)
  );
  
  // 根据领出牌型分派到相应的强制规则检查
  switch (leadType.type) {
    case 'single':
      return { valid: true }; // 单张可以出任意同花色单张，无强制要求
      
    case 'pair':
      return checkMandatoryPair(cardsToPlay, sortedAvailable, allCards, leadSuit, currentLevel, trumpSuit);
      
    default:
      return { valid: true }; // 其他牌型暂不实现强制规则
  }
};

/**
 * 对子强制检查
 * 核心规则：有对子必须出对子，没有对子必须出两张最大的单张
 * @param {Array} cardsToPlay - 要出的牌（必须2张）
 * @param {Array} sortedAvailable - 可跟的牌（已按牌力排序）
 * @param {Array} allCards - 全部手牌
 * @param {string} leadSuit - 领出花色
 * @param {number} currentLevel - 当前级牌
 * @param {string} trumpSuit - 主花色
 * @returns {Object} 验证结果
 */
const checkMandatoryPair = (cardsToPlay, sortedAvailable, allCards, leadSuit, currentLevel, trumpSuit) => {
  // 验证出牌数量
  if (cardsToPlay.length !== 2) {
    return { valid: false, message: '必须出两张牌' };
  }
  
  // 在全部手牌中检查是否有领出花色的对子
  const leadSuitPairs = findLeadSuitPairs(allCards, leadSuit, currentLevel, trumpSuit);
  
  if (leadSuitPairs.length > 0) {
    // 有对子，必须出对子
    const [card1, card2] = cardsToPlay;
    if (card1.rank === card2.rank && card1.suit === card2.suit) {
      return { valid: true };  // 出的是对子，符合要求
    }
    return { 
      valid: false, 
      message: '有对子必须出对子' 
    };
  } else {
    // 没有对子，必须出两张最大的单张
    const expectedCards = sortedAvailable.slice(0, 2);  // 取前两张最大的
    const playedIds = cardsToPlay.map(c => c.id).sort();
    const expectedIds = expectedCards.map(c => c.id).sort();
    
    // 检查是否出了正确的两张最大牌
    if (!playedIds.every((id, index) => id === expectedIds[index])) {
      return { 
        valid: false, 
        message: `必须出两张最大的牌: ${expectedCards.map(c => getCardDisplayName(c)).join(', ')}` 
      };
    }
    return { valid: true };
  }
};

/**
 * 找对子（通用函数）
 * 在给定牌组中找出所有对子（同点数同花色）
 * @param {Array} cards - 牌组
 * @returns {Array} 对子数组，每个元素是[card1, card2]
 */
const findPairs = (cards) => {
  const pairs = [];
  const used = new Set();  // 记录已使用的牌索引，避免重复配对
  
  // 双重循环找对子
  for (let i = 0; i < cards.length - 1; i++) {
    if (used.has(i)) continue;  // 跳过已使用的牌
    
    for (let j = i + 1; j < cards.length; j++) {
      if (used.has(j)) continue;  // 跳过已使用的牌
      
      const card1 = cards[i];
      const card2 = cards[j];
      
      // 检查是否为对子：同点数且同花色
      if (card1.rank === card2.rank && card1.suit === card2.suit) {
        pairs.push([card1, card2]);
        used.add(i);  // 标记两张牌都已使用
        used.add(j);
        break;  // 找到对子后跳出内层循环
      }
    }
  }
  
  return pairs;
};

/**
 * 找领出花色的对子
 * 核心逻辑：先筛选出领出花色的牌，再在其中找对子
 * @param {Array} allCards - 全部手牌
 * @param {string} leadSuit - 领出花色
 * @param {number} currentLevel - 当前级牌
 * @param {string} trumpSuit - 主花色
 * @returns {Array} 领出花色的对子数组
 */
const findLeadSuitPairs = (allCards, leadSuit, currentLevel, trumpSuit) => {
  const pairs = [];
  const used = new Set();
  
  // 先筛选出领出花色的牌（主牌或副牌）
  const leadSuitCards = getPlayerCardsOfSuit(allCards, leadSuit, currentLevel, trumpSuit);
  
  // 在领出花色的牌中找对子
  for (let i = 0; i < leadSuitCards.length - 1; i++) {
    if (used.has(i)) continue;
    
    for (let j = i + 1; j < leadSuitCards.length; j++) {
      if (used.has(j)) continue;
      
      const card1 = leadSuitCards[i];
      const card2 = leadSuitCards[j];
      
      // 检查是否为对子：同点数且同花色
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
```

---

### 后端 `backend/src/models/ShandongUpgradeGame.js`

```javascript
/**
 * 出牌验证入口函数
 * 区分首家出牌和跟牌，分别进行不同的验证逻辑
 * @param {number} playerId - 玩家ID
 * @param {Array} cardsToPlay - 要出的牌
 * @returns {Object} 验证结果
 */
validatePlayCards(playerId, cardsToPlay) {
  // 识别牌型（单张、对子、连对、顺子等）
  const cardType = CardTypeValidator.identifyCardType(cardsToPlay, this.currentLevel, this.trumpSuit);
  
  // 如果是第一个出牌的玩家（lead player）
  if (this.roundCards.length === 0) {
    // lead玩家可以出任何有效牌型，只需验证牌型合法性
    if (cardType.type === 'invalid') {
      return { valid: false, message: '无效的牌型' };
    }
    
    return { 
      valid: true, 
      cardType: cardType,
      isLead: true 
    };
  }
  
  // 跟牌验证：获取领出牌信息，调用跟牌规则验证
  const leadCard = this.roundCards[0];  // 第一张出牌就是领出牌
  const validation = this.validateFollowCards(cardsToPlay, leadCard, cardType);
  
  return {
    valid: validation.valid,
    message: validation.message,
    cardType: cardType,
    isLead: false
  };
}

/**
 * 验证跟牌规则（后端主函数）
 * 与前端逻辑基本一致，但使用后端的CardTypeValidator
 * @param {Array} cardsToPlay - 要出的牌
 * @param {Object} leadCard - 领出牌信息
 * @param {Object} cardType - 要出牌的牌型信息
 * @returns {Object} 验证结果
 */
validateFollowCards(cardsToPlay, leadCard, cardType) {
  const leadCardType = leadCard.cardType;
  
  // 规则1：必须出相同数量的牌
  if (cardsToPlay.length !== leadCard.cards.length) {
    return { 
      valid: false, 
      message: `必须出${leadCard.cards.length}张牌` 
    };
  }
  
  // 规则2：花色跟牌规则
  const leadSuit = this.getLeadSuit(leadCard.cards);  // 获取领出花色
  const playerId = this.currentTurn; // 当前出牌玩家
  const hasLeadSuit = this.playerHasLeadSuit(playerId, leadSuit);  // 是否有对应花色的牌
  
  // 规则3：如果有对应花色，检查是否有足够的牌跟牌
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
  
  // 规则4：牌型匹配规则（强制跟牌规则）
  const typeMatch = this.validateCardTypeMatch(
    cardType,      // 要出的牌型
    leadCardType,  // 领出牌型
    hasLeadSuit,   // 是否有对应花色
    playerId,      // 玩家ID
    cardsToPlay,   // 要出的牌
    leadCard       // 领出牌信息
  );
  if (!typeMatch.valid) {
    return typeMatch;
  }
  
  return { valid: true };
}

/**
 * 获取领出花色（后端版本）
 * 与前端逻辑一致：首张是主牌则返回'trump'，否则返回首张花色
 * @param {Array} leadCards - 领出牌组
 * @returns {string} 领出花色
 */
getLeadSuit(leadCards) {
  const firstCard = leadCards[0];
  if (CardTypeValidator.isCardTrump(firstCard, this.currentLevel, this.trumpSuit)) {
    return 'trump'; // 首张是主牌，领出花色为主牌
  }
  return firstCard.suit;  // 首张是副牌，领出花色为该牌花色
}

/**
 * 检查玩家是否有对应花色的可跟牌
 * @param {number} playerId - 玩家ID
 * @param {string} leadSuit - 领出花色
 * @returns {boolean} 是否有对应花色的牌
 */
playerHasLeadSuit(playerId, leadSuit) {
  const player = this.players[playerId];
  if (!player) return false;
  
  if (leadSuit === 'trump') {
    // 检查是否有主牌（大小王、级牌、常主、主花色）
    return player.cards.some(card => 
      CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
    );
  } else {
    // 检查是否有对应花色的副牌（排除该花色的主牌）
    return player.cards.some(card => 
      card.suit === leadSuit && 
      !CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
    );
  }
}

/**
 * 检查是否跟了对应花色（后端版本）
 * 与前端逻辑一致：验证出的牌是否符合花色跟牌规则
 * @param {Array} cards - 要出的牌
 * @param {string} leadSuit - 领出花色
 * @returns {boolean} 是否跟对花色
 */
isFollowingSuit(cards, leadSuit) {
  if (leadSuit === 'trump') {
    // 领出主牌时，出的牌必须全部是主牌
    return cards.every(card => 
      CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
    );
  }
  // 领出副牌时，出的牌必须全部是对应花色的副牌（排除常主/级牌/王/主花色）
  return cards.every(card => 
    card.suit === leadSuit && 
    !CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
  );
}

/**
 * 获取玩家在指定花色上的所有可跟牌（后端版本）
 * 与前端逻辑一致：区分主牌和副牌花色
 * @param {number} playerId - 玩家ID
 * @param {string} leadSuit - 领出花色
 * @returns {Array} 可跟的牌数组
 */
getPlayerCardsOfSuit(playerId, leadSuit) {
  const player = this.players[playerId];
  if (!player) return [];
  
  if (leadSuit === 'trump') {
    // 领出主牌时，返回所有主牌
    return player.cards.filter(card => 
      CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
    );
  } else {
    // 领出副牌时，返回对应花色的副牌（排除该花色的主牌）
    return player.cards.filter(card => 
      card.suit === leadSuit && 
      !CardTypeValidator.isCardTrump(card, this.currentLevel, this.trumpSuit)
    );
  }
}

/**
 * 检查强制跟牌规则（后端分派器）
 * 根据领出牌型调用相应的强制规则检查
 * @param {Object} leadCard - 领出牌信息
 * @param {Array} cardsToPlay - 要出的牌
 * @param {Array} availableCards - 可跟的牌
 * @param {string} leadSuit - 领出花色
 * @param {Array} allPlayerCards - 全部手牌
 * @returns {Object} 验证结果
 */
checkMandatoryFollow(leadCard, cardsToPlay, availableCards, leadSuit, allPlayerCards) {
  const leadType = leadCard.cardType.type;
  const leadCount = leadCard.cards.length;
  
  // 验证出牌数量
  if (cardsToPlay.length !== leadCount) {
    return { 
      valid: false, 
      message: `必须出${leadCount}张牌` 
    };
  }
  
  // 按牌力排序可用牌（从大到小）
  const sortedAvailable = this.sortCardsByValue(availableCards);
  
  // 根据领出牌型分派到相应的强制规则检查
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

/**
 * 按牌力排序（从大到小）
 * @param {Array} cards - 牌组
 * @returns {Array} 排序后的牌组
 */
sortCardsByValue(cards) {
  return [...cards].sort((a, b) => 
    CardTypeValidator.getCardValue(b, this.currentLevel, this.trumpSuit) - 
    CardTypeValidator.getCardValue(a, this.currentLevel, this.trumpSuit)
  );
}

/**
 * 检查强制单张跟牌
 * 核心规则：必须出对应花色的牌（任意一张都可以）
 * @param {Array} cardsToPlay - 要出的牌（必须1张）
 * @param {Array} sortedAvailable - 可跟的牌（已按牌力排序）
 * @returns {Object} 验证结果
 */
checkMandatorySingle(cardsToPlay, sortedAvailable) {
  if (cardsToPlay.length !== 1) {
    return { valid: false, message: '必须出一张牌' };
  }
  
  // 单张跟牌：有同花色时可以出任意同花色单张
  const playedCard = cardsToPlay[0];
  
  // 检查出的牌是否在可用牌中（即是否为对应花色的牌）
  const isValidCard = sortedAvailable.some(card => card.id === playedCard.id);
  
  if (!isValidCard) {
    return { 
      valid: false, 
      message: '必须出对应花色的牌' 
    };
  }
  
  return { valid: true };
}

/**
 * 检查强制对子跟牌（简化摘录：完整逻辑见源码）
 * 核心规则：有对子必须出对子，没有对子必须出两张最大的单张
 * @param {Array} cardsToPlay - 要出的牌（必须2张）
 * @param {Array} sortedAvailable - 可跟的牌（已按牌力排序）
 * @param {Array} allPlayerCards - 全部手牌
 * @param {string} leadSuit - 领出花色
 * @returns {Object} 验证结果
 */
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
```

## 总结

### 核心规则总结

1. **领出花色判定**：
   - 首张牌是主牌 → 领出花色为 'trump'
   - 首张牌是副牌 → 领出花色为该牌花色

2. **可跟牌集合**：
   - 领出主牌时：所有主牌（大小王、级牌、常主、主花色）
   - 领出副牌时：该花色的副牌（排除该花色的主牌）

3. **花色跟牌规则**：
   - 有对应花色的牌且数量足够 → 必须跟花色
   - 有对应花色的牌但数量不够 → 允许垫牌
   - 没有对应花色的牌 → 允许垫牌

4. **强制跟牌规则**：
   - 单张：出任意对应花色的单张
   - 对子：有对子必须出对子，没有对子必须出两张最大的单张

### 关键修复点

- **常主/级牌/王统一视为主牌**：在副牌花色跟牌时，这些牌不会被误算为副牌
- **前后端逻辑一致**：确保服务端验证与前端提示一致
- **字符串比较统一**：避免数字与字符串比较导致的判断错误

— End —


