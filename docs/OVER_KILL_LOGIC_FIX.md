# 超杀判定逻辑修复文档

## 超杀规则定义

### 什么是超杀？

**超杀（Over-Kill）**是山东升级扑克中的一个高级概念：

1. **前提条件**：
   - 领出方出的是副牌
   - 已有玩家用主牌杀牌

2. **超杀要求**：
   - 全部是主牌
   - 牌型必须匹配领出牌型
   - **只需在最大的牌型单位上大过杀牌即可**

3. **最大牌型优先级**：
   ```
   雨 > 闪 > 震 > 连对 > 对子 > 单牌
   ```

### 示例

**场景设置**：
- 领出：黑桃AQQJJ（副牌：1个2连对 + 1单张）
- 杀牌：小王 + 红桃6677（主牌：1个2连对 + 1单张）

**超杀判定**：

✅ **成功的超杀1**：
- 超杀牌：红桃8899 + 红桃4
- 分析：
  - 最大牌型单位：连对
  - 连对8899（最大值909）> 连对6677（最大值907）
  - **不需要比较单牌**（红桃4 < 小王 无关紧要）
- 结论：超杀成功 ✅

✅ **成功的超杀2**：
- 超杀牌：红桃991010 + 大王
- 分析：
  - 最大牌型单位：连对
  - 连对991010（最大值910）> 连对6677（最大值907）
  - 不需要比较单牌
- 结论：超杀成功 ✅

❌ **失败的超杀**：
- 尝试超杀：红桃4455 + 大王
- 分析：
  - 最大牌型单位：连对
  - 连对45（最大值904）< 连对67（最大值907）
  - 即使有大王（最大单牌），仍然失败
- 结论：超杀失败 ❌

## 问题分析

### 原始代码问题

在修复前，`compareTrumpCards` 函数中的 `getHighestUnitScore` 有以下问题：

1. **优先级顺序错误**：
   ```javascript
   // 错误的顺序
   1) 闪/震（合并）
   2) 顺子
   3) 连对
   4) 对子
   5) 单张
   ```
   - 雨（顺子）应该是最高优先级，但被放在第2位
   - 闪和震应该分开，但被合并处理

2. **连对比较方式错误**：
   ```javascript
   // 原代码
   if ((analysis.capabilities?.consecutivePairsPairs || 0) > 0) {
     return { category: 'consecutive_pairs', score: analysis.capabilities.consecutivePairsPairs };
   }
   ```
   - 只比较了连对的**数量**（consecutivePairsPairs）
   - 没有比较连对的**最大牌值**

3. **缺少辅助函数**：
   - 没有 `findMaxConsecutivePairValue` 来找连对最大值
   - 没有 `findMaxFlashThunderValue` 来找闪/震最大值
   - 没有 `findMaxStraightValue` 来找顺子最大值

## 修复方案

### 1. 修正优先级顺序

修改后的 `getHighestUnitScore` 函数（第2765-2799行）：

```javascript
const getHighestUnitScore = (analysis) => {
  // 1) 雨（顺子）：最高优先级，按最大牌值比较
  if ((analysis.capabilities?.straightCount || 0) >= 5) {
    const maxStraight = this.findMaxStraightValue(analysis);
    return { category: 'straight', score: maxStraight };
  }
  // 2) 闪：4张同点数主牌
  if ((analysis.capabilities?.flashThunderCount || 0) === 4) {
    const maxFlash = this.findMaxFlashThunderValue(analysis);
    return { category: 'flash', score: maxFlash };
  }
  // 3) 震：>4张同点数主牌
  if ((analysis.capabilities?.flashThunderCount || 0) > 4) {
    const maxThunder = this.findMaxFlashThunderValue(analysis);
    return { category: 'thunder', score: maxThunder };
  }
  // 4) 连对：按最大连对牌值比较
  if ((analysis.capabilities?.consecutivePairsPairs || 0) >= 2) {
    const maxConsecPair = this.findMaxConsecutivePairValue(analysis);
    return { category: 'consecutive_pairs', score: maxConsecPair };
  }
  // 5) 对子：按最大对子牌力比较
  if (analysis.pairs && analysis.pairs.length > 0) {
    const flat = analysis.pairs.flat();
    const maxPair = Math.max(...flat.map(c => 
      CardTypeValidator.getCardValue(c, this.currentLevel, this.trumpSuit)
    ));
    return { category: 'pair', score: maxPair };
  }
  // 6) 单张：按最大单张牌力比较
  if (analysis.singles && analysis.singles.length > 0) {
    const maxSingle = Math.max(...analysis.singles.map(c => 
      CardTypeValidator.getCardValue(c, this.currentLevel, this.trumpSuit)
    ));
    return { category: 'single', score: maxSingle };
  }
  return { category: 'none', score: -1 };
};
```

### 2. 新增辅助函数

#### `findMaxConsecutivePairValue` （第2692-2712行）

```javascript
findMaxConsecutivePairValue(analysis) {
  if (!analysis.pairs || analysis.pairs.length < 2) return 0;
  
  // 对所有对子按牌值排序
  const sortedPairs = analysis.pairs.map(pair => {
    const value = CardTypeValidator.getCardValue(pair[0], this.currentLevel, this.trumpSuit);
    return { pair, value };
  }).sort((a, b) => b.value - a.value);
  
  // 找出最大的连对
  for (let i = 0; i < sortedPairs.length - 1; i++) {
    const diff = sortedPairs[i].value - sortedPairs[i + 1].value;
    if (diff === 1) {
      // 找到连对，返回最大值
      return sortedPairs[i].value;
    }
  }
  
  // 如果没有连对，返回最大对子的值
  return sortedPairs[0]?.value || 0;
}
```

**功能**：
- 找出所有对子并按牌值排序
- 检查相邻对子是否连续（牌值差1）
- 返回最大连对的最大牌值

#### `findMaxFlashThunderValue` （第2714-2741行）

```javascript
findMaxFlashThunderValue(analysis) {
  // 闪/震是4张或更多同点数的主牌
  const cardCounts = {};
  const allCards = [...(analysis.pairs?.flat() || []), ...(analysis.singles || [])];
  
  allCards.forEach(card => {
    const key = `${card.rank}`;
    if (!cardCounts[key]) {
      cardCounts[key] = { count: 0, card };
    }
    cardCounts[key].count++;
  });
  
  // 找出最大的闪/震
  let maxValue = 0;
  Object.values(cardCounts).forEach(({ count, card }) => {
    if (count >= 4) {
      const value = CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit);
      if (value > maxValue) {
        maxValue = value;
      }
    }
  });
  
  return maxValue;
}
```

**功能**：
- 统计每个点数出现的次数
- 找出出现4次或更多的点数（闪/震）
- 返回最大的闪/震牌值

#### `findMaxStraightValue` （第2743-2772行）

```javascript
findMaxStraightValue(analysis) {
  // 顺子是5张或更多连续的牌
  const allCards = [...(analysis.pairs?.flat() || []), ...(analysis.singles || [])];
  if (allCards.length < 5) return 0;
  
  // 获取所有牌的牌值并排序
  const values = allCards.map(card => 
    CardTypeValidator.getCardValue(card, this.currentLevel, this.trumpSuit)
  ).sort((a, b) => b - a);
  
  // 检查是否有连续的5张或更多
  let consecutive = 1;
  let maxInStraight = values[0];
  
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] - values[i] === 1) {
      consecutive++;
      if (consecutive >= 5) {
        // 找到顺子，返回最大值
        return maxInStraight;
      }
    } else {
      consecutive = 1;
      maxInStraight = values[i];
    }
  }
  
  return values[0]; // 回退到最大牌值
}
```

**功能**：
- 获取所有牌的牌值并排序
- 检查是否有连续的5张或更多（顺子）
- 返回顺子中的最大牌值

## 测试验证

### 测试场景

**游戏设置**：
- currentLevel: 2
- trumpSuit: hearts（红桃为主）

**测试用例**：

#### 测试1：基本超杀（连对8899 > 连对6677）

```
领出: spades_A, spades_Q, spades_Q, spades_J, spades_J
杀牌: joker_small, hearts_6, hearts_6, hearts_7, hearts_7
超杀: hearts_8, hearts_8, hearts_9, hearts_9, hearts_4

超杀 > 杀牌: true ✅
```

#### 测试2：超杀（连对991010 > 连对6677）

```
杀牌: joker_small, hearts_6, hearts_6, hearts_7, hearts_7
超杀: hearts_9, hearts_9, hearts_10, hearts_10, joker_big

超杀 > 杀牌: true ✅
```

#### 测试3：失败的超杀（连对45 < 连对67）

```
杀牌: joker_small, hearts_6, hearts_6, hearts_7, hearts_7
尝试超杀: hearts_4, hearts_4, clubs_5, clubs_5, joker_big

超杀 > 杀牌: false ✅
```

**关键验证**：
- ✅ 只比较最大牌型单位（连对）
- ✅ 不需要比较次级单位（单牌）
- ✅ 即使有更大的单牌（大王），连对不够大仍然失败

## 影响范围

### 修改的文件
- `backend/src/models/ShandongUpgradeGame.js`
  - 新增函数：
    - `findMaxConsecutivePairValue`（第2692-2712行）
    - `findMaxFlashThunderValue`（第2714-2741行）
    - `findMaxStraightValue`（第2743-2772行）
  - 修改函数：
    - `compareTrumpCards` 中的 `getHighestUnitScore`（第2765-2799行）

### 影响的游戏规则
1. **超杀判定**：现在正确按照"最大牌型单位"进行比较
2. **牌型优先级**：雨 > 闪 > 震 > 连对 > 对子 > 单牌
3. **混合甩牌比较**：更精确的大小判定

### 不受影响的规则
- 单牌、对子、连对等非混合牌型的比较规则不变
- 同花色跟牌规则不变
- 强制跟牌规则不变
- 甩牌组成匹配验证不变

## 超杀规则总结

### 超杀的三个条件（缺一不可）

1. **全是主牌** ✅
2. **牌型匹配领出牌型** ✅
3. **最大牌型单位 > 杀牌的最大牌型单位** ✅

### 最大牌型单位判定优先级

| 优先级 | 牌型 | 说明 |
|--------|------|------|
| 1 | 雨（顺子） | 5张或更多连续的牌 |
| 2 | 闪 | 4张同点数主牌 |
| 3 | 震 | 5张或更多同点数主牌 |
| 4 | 连对 | 2对或更多连续的对子 |
| 5 | 对子 | 单独的对子 |
| 6 | 单牌 | 单独的牌 |

### 比较规则

1. **识别最大牌型单位**：按优先级从高到低检查
2. **同类别比较**：只比较该类别的牌值大小
3. **忽略次级单位**：不需要比较低优先级的牌型

**示例**：
- 领出：副牌 2连对 + 1单张
- 杀牌：主牌 2连对（6677） + 1单张（小王）
- 超杀：主牌 2连对（8899） + 1单张（4）
- **比较**：只看连对，8899 > 6677 → 超杀成功
- **无需比较**：单牌4 vs 小王（不影响结果）

## 修复日期
2025-10-16

## 修复人员
AI Assistant (Claude)

