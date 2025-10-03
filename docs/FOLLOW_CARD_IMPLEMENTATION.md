# 山东升级跟牌规则技术实现文档

## 📚 概述

本文档详细说明山东升级游戏中跟牌规则的技术实现，包括核心算法、数据结构、关键函数和实现细节。

## 🏗️ 架构设计

### 核心组件
```
Frontend (React)           Backend (Node.js)
├── PokerTable.js          ├── ShandongUpgradeGame.js
├── followValidation.js    ├── Player.js
└── cardUtils.js           └── server.js
```

### 数据流
```
用户选择卡牌 → 前端验证 → 后端验证 → 游戏状态更新 → 广播结果
```

## 🔧 核心算法实现

### 1. 卡牌主副识别 (isCardTrump)

**位置**: `backend/src/models/ShandongUpgradeGame.js:5-19`

```javascript
static isCardTrump(card, currentLevel = 2, trumpSuit = null) {
  // 大小王总是主牌
  if (card.suit === 'joker') return true;
  
  // 级牌总是主牌
  if (card.rank === currentLevel) return true;
  
  // 山东升级：2,3,5为常主
  if (['2', '3', '5'].includes(card.rank)) return true;
  
  // 主花色的牌
  if (card.suit === trumpSuit) return true;
  
  return false;
}
```

**关键点**:
- 优先级: 大小王 > 级牌 > 常主(2,3,5) > 主花色
- 使用字符串数组 `['2','3','5']` 而非数字数组
- currentLevel参数支持动态级别变化

### 2. 牌型识别 (identifyCardType)

**位置**: `backend/src/models/ShandongUpgradeGame.js:75-159`

```javascript
static identifyCardType(cards, currentLevel = 2, trumpSuit = null) {
  // 单张 → 对子 → 连对 → 闪/震 → 雨 → 甩牌
  
  if (cards.length === 1) return { type: 'single', name: '单张' };
  
  if (cards.length === 2) {
    const result = this.identifyPair(cards, currentLevel, trumpSuit);
    if (result.valid) return { type: 'pair', name: '对子' };
  }
  
  // ... 其他牌型检查
}
```

**识别优先级**:
1. 单张 (1张)
2. 对子 (2张)  
3. 连对/拖拉机 (4张+，偶数)
4. 闪/震 (4张+，特殊主牌组合)
5. 雨/顺子 (5张+，同花色连续)
6. 甩牌 (其他情况)

### 3. 强制跟牌核心逻辑

**位置**: `backend/src/models/ShandongUpgradeGame.js:1415-1488`

```javascript
checkMandatoryFollow(leadCard, cardsToPlay, availableCards, leadSuit, allPlayerCards) {
  const leadType = leadCard.cardType;
  const sortedAvailable = this.sortCardsByValue(availableCards);
  
  switch (leadType.type) {
    case 'single':
      return this.checkMandatorySingle(cardsToPlay, sortedAvailable);
    case 'pair':
      return this.checkMandatoryPair(cardsToPlay, sortedAvailable, allPlayerCards, leadSuit);
    case 'consecutive_pairs':
      return this.checkMandatoryConsecutivePairs(cardsToPlay, sortedAvailable, leadType.pairCount || 2);
    case 'straight':
      return this.checkMandatoryStraight(cardsToPlay, sortedAvailable, cardsToPlay.length);
    case 'flash':
    case 'thunder':
      return this.checkMandatoryFlashThunder(cardsToPlay, sortedAvailable, cardsToPlay.length);
    case 'mixed':
      return this.checkMandatoryMixed(cardsToPlay, sortedAvailable, leadCard);
    default:
      return { valid: true };
  }
}
```

### 4. 对子跟牌规则 (checkMandatoryPair)

**位置**: `backend/src/models/ShandongUpgradeGame.js:1491-1519`

```javascript
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
      return { valid: false, message: '有对子必须出对子' };
    }
    return { valid: true };
  } else {
    // 没有对子，必须出两张最大的单张
    const expectedCards = sortedAvailable.slice(0, 2);
    const sortedPlayed = this.sortCardsByValue(cardsToPlay);
    
    if (!this.cardsMatch(sortedPlayed, expectedCards)) {
      return { 
        valid: false, 
        message: `必须出最大的两张牌: ${expectedCards.map(c => this.getCardDisplayName(c)).join(', ')}` 
      };
    }
    return { valid: true };
  }
}
```

**关键逻辑**:
1. 在**全部手牌**中检查是否有领出花色的对子
2. 有对子 → 必须出对子
3. 没有对子 → 必须出最大的两张单张

### 5. 垫牌规则验证

**位置**: `backend/src/models/ShandongUpgradeGame.js:1278-1292`

```javascript
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
```

**核心思想**:
- 只有当该花色牌数 ≥ 出牌数量时，才强制跟花色
- 牌数不够时允许混合花色出牌（垫牌）

## 📊 数据结构设计

### 卡牌对象
```javascript
{
  suit: 'hearts',      // 花色: hearts/spades/clubs/diamonds/joker
  rank: 'A',           // 点数: A/K/Q/J/10/9/8/7/6/5/4/3/2/big/small
  id: 'hearts_A_0'     // 唯一标识符
}
```

### 牌型对象
```javascript
{
  type: 'pair',        // 牌型类型
  name: '对子',        // 显示名称
  cards: [...],        // 包含的卡牌
  message: '对子',     // 消息文本
  pairCount: 1         // 对子数量（连对时使用）
}
```

### 验证结果对象
```javascript
{
  valid: true,         // 是否有效
  message: '成功'      // 消息（失败时包含错误原因）
}
```

## 🔄 前后端同步

### 验证逻辑同步
前端和后端都实现了相同的验证逻辑：

**前端**: `frontend/src/utils/followValidation.js`
**后端**: `backend/src/models/ShandongUpgradeGame.js`

### 关键同步点
1. **主牌识别** - `isCardTrump` 函数
2. **牌型识别** - `identifyCardType` 函数  
3. **强制跟牌** - `checkMandatoryFollow` 函数
4. **甩牌验证** - `validateMixed` 函数

## 🎯 特殊规则实现

### 1. 常主识别
```javascript
// 山东升级特色：2,3,5为常主，但排除当前级牌
const permanentTrumps = ['2', '3', '5'].filter(rank => rank !== currentLevel.toString());
if (permanentTrumps.includes(card.rank)) return true;
```

### 2. 主牌甩牌规则
```javascript
// 所有主牌视为同一花色
if (trumpCards.length === cards.length) {
  return { valid: true }; // 全部是主牌，允许混合花色
}
```

### 3. 连续性判断
```javascript
// 使用getSequentialValue为常主分配非连续数值
if (card.rank === '5') return 950;  // 间隔50
if (card.rank === '3') return 900;  // 防止形成连对
if (card.rank === '2') return 850;
```

## 🔍 关键算法细节

### 1. 卡牌价值计算 (getCardValue)

**用途**: 排序和比较卡牌大小

```javascript
// 主牌价值 (990-999)
if (card.suit === 'joker') {
  return card.rank === 'small' ? 998 : 999;
}

// 级牌价值
if (card.rank === currentLevel) {
  return card.suit === trumpSuit ? 997 : 996;
}

// 常主价值
const permanentTrumps = ['2', '3', '5'];
if (permanentTrumps.includes(card.rank)) {
  if (card.suit === trumpSuit) {
    if (card.rank === '5') return 995;
    if (card.rank === '3') return 993;
    if (card.rank === '2') return 991;
  }
}

// 副牌价值 (1-89)
const rankValues = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11,
  10: 10, 9: 9, 8: 8, 7: 7, 6: 6, 4: 4
};
```

### 2. 连续性价值计算 (getSequentialValue)

**用途**: 判断连对和顺子的连续性

```javascript
// 为常主分配非连续数值，防止误判为连对
if (permanentTrumps.includes(card.rank)) {
  if (card.rank === '5') return 950;  // 大间隔
  if (card.rank === '3') return 900;  // 确保不连续
  if (card.rank === '2') return 850;
}

// 副牌使用连续数值
const suitRankOrder = ['A', 'K', 'Q', 'J', 10, 9, 8, 7, 6, 4];
const index = suitRankOrder.indexOf(card.rank);
return 100 + (suitRankOrder.length - 1 - index);
```

## 🚀 性能优化

### 1. 卡牌ID系统
使用唯一ID而非数组索引，避免排序导致的索引错位：
```javascript
// 卡牌ID格式: suit_rank_index
cardId = 'hearts_A_0'

// 移除卡牌时使用ID匹配
removeCardById(cardId) {
  this.cards = this.cards.filter(card => card.id !== cardId);
}
```

### 2. 缓存验证结果
```javascript
// 避免重复计算牌型
const cardTypeCache = new Map();
const cacheKey = cards.map(c => c.id).sort().join(',');
if (cardTypeCache.has(cacheKey)) {
  return cardTypeCache.get(cacheKey);
}
```

### 3. 提前验证
前端先验证，减少无效请求：
```javascript
// 前端预验证
const validation = validateFollowCards(selectedCards, leadCard, myCards);
if (!validation.valid) {
  showError(validation.message);
  return;
}
// 发送到后端
socket.emit('playCards', { cardIds });
```

## 🐛 已知问题与解决方案

### 1. 类型不匹配问题
**问题**: 常主数组使用数字类型，但卡牌rank是字符串
**解决**: 统一使用字符串类型 `['2','3','5']`

### 2. 垫牌规则过严
**问题**: 只要有该花色就强制跟牌，忽略了牌数不够的情况
**解决**: 增加牌数充足性检查

### 3. 强制跟牌优先级
**问题**: 基本牌型匹配优先级高于强制跟牌规则
**解决**: 重构验证流程，强制跟牌规则优先

## 📈 扩展性设计

### 1. 规则配置化
```javascript
const gameRules = {
  permanentTrumps: ['2', '3', '5'],
  allowMixedTrumpInMixed: true,
  strictFollowRules: true
};
```

### 2. 插件化验证器
```javascript
class CardValidator {
  static registerValidator(type, validator) {
    this.validators[type] = validator;
  }
  
  static validate(cards, type) {
    return this.validators[type]?.(cards) || { valid: false };
  }
}
```

### 3. 多语言支持
```javascript
const messages = {
  'zh-CN': {
    'must_follow_pair': '必须出对子',
    'must_follow_suit': '有{suit}必须跟牌'
  },
  'en-US': {
    'must_follow_pair': 'Must play a pair',
    'must_follow_suit': 'Must follow {suit}'
  }
};
```

## 🔧 调试工具

### 1. 详细日志
```javascript
console.log('🔍 连对识别 - 输入牌:', cards.map(c => c.toString()));
console.log('🔍 分组结果:', groupedCards);
console.log('✅ 连对识别成功!');
```

### 2. 测试工具
```javascript
function createTestCard(suit, rank) {
  return { 
    suit, 
    rank, 
    id: `${suit}_${rank}_0`,
    toString: () => `${suit}_${rank}`
  };
}
```

### 3. 性能监控
```javascript
const startTime = performance.now();
const result = validateFollowCards(cards);
const endTime = performance.now();
console.log(`验证耗时: ${endTime - startTime}ms`);
```

## 📚 参考资料

- [山东升级游戏规则](./GAME_RULES.md)
- [技术进展文档](./TECHNICAL_PROGRESS.md)
- [测试结果报告](./FOLLOW_CARD_TEST_RESULTS.md)
- [用户故事](./USER_STORIES.md)

---

**维护者**: AI Assistant  
**最后更新**: 2024年9月24日  
**版本**: 1.0.0
