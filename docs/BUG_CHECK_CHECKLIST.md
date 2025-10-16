# 跟牌和甩牌Bug检查清单

## 🎯 快速检查清单

### 优先级1：高风险区域 ⚠️

#### ✓ 1. 常主在副牌花色的识别
**问题**：当领出红桃时，红桃3和红桃5虽然是红桃花色，但它们是常主，属于主牌，不能作为红桃副牌跟牌。

**位置**：
- `backend/src/models/ShandongUpgradeGame.js` - `isCardTrump()`
- `backend/src/models/ShandongUpgradeGame.js` - `getPlayerCardsOfSuit()`

**检查方法**：
```javascript
// 测试场景
级别: 2, 主花色: 黑桃
领出: 红桃A (副牌)
玩家手牌: 红桃K, 红桃3, 黑桃A

期望: 
- 出红桃K → 通过（红桃副牌）
- 出红桃3 → 失败（红桃3是常主，属于主牌）
```

**状态**: ⬜ 待检查

---

#### ✓ 2. 对子跟牌强制规则
**问题**：需要在全部手牌中检查是否有对子，而不是只在可用花色的牌中检查。

**位置**：
- `backend/src/models/ShandongUpgradeGame.js:1579-1610` - `checkMandatoryPair()`
- `backend/src/models/ShandongUpgradeGame.js:1791-1817` - `findLeadSuitPairs()`

**检查方法**：
```javascript
// 测试场景
领出: 对A
玩家手牌: 对K, 单7, 单8

期望:
- 出对K → 通过
- 出单7+单8 → 失败（有对子必须出对子）
```

**状态**: ⬜ 待检查

---

#### ✓ 3. 甩牌否定逻辑
**问题**：甩牌时需要检查其他玩家是否能否定，涉及复杂的单位提取和比较逻辑。

**位置**：
- `backend/src/models/ShandongUpgradeGame.js:2866-2942` - `judgeLeadMixedAndForce()`
- `backend/src/models/ShandongUpgradeGame.js:3211-3251` - `canPlayerBeatUnit()`

**检查方法**：
```javascript
// 测试场景1: 单张否定
玩家0甩: K, Q, J (红桃)
玩家2有: A (红桃)
期望: 被否定，强制出J

// 测试场景2: 对子否定
玩家0甩: 对K, 单J (红桃)
玩家2有: 对A (红桃)
期望: 被否定，强制出单J

// 测试场景3: 混合单位
玩家0甩: 对A, 对K, 单Q (红桃)
其他玩家都没有更大的单位
期望: 甩牌成功
```

**状态**: ⬜ 待检查

---

### 优先级2：中风险区域 ⚡

#### ✓ 4. 连对不能由常主形成
**问题**：常主2,3,5虽然点数连续，但不能形成连对。需要通过`getSequentialValue`为它们分配非连续数值。

**位置**：
- `backend/src/models/ShandongUpgradeGame.js` - CardTypeValidator类 - `getSequentialValue()`
- `backend/src/models/ShandongUpgradeGame.js:2956-3006` - `detectConsecutivePairs()`

**检查方法**：
```javascript
// 测试场景
级别: 10, 主花色: 黑桃
手牌: 红桃2,2, 红桃3,3

期望: 不能识别为连对（常主不连续）
```

**状态**: ⬜ 待检查

---

#### ✓ 5. 甩牌跟牌组合匹配
**问题**：跟甩牌时需要匹配领出者的组合结构（对子对对子，单张对单张）。

**位置**：
- `backend/src/models/ShandongUpgradeGame.js:1730-1751` - `checkMandatoryMixed()`

**检查方法**：
```javascript
// 测试场景
领出: 对A + 单K (红桃)
玩家手牌: 对Q, 对J, 单10, 单9 (红桃)

期望:
- 出对Q+单10 → 通过（对+单匹配）
- 出对Q+对J → 失败（组合不匹配，应该是1对+1单）
```

**状态**: ⬜ 待检查

---

#### ✓ 6. 垫牌时的主杀匹配
**问题**：当前代码已放宽限制（line 1471-1474），主杀不再要求牌型完全匹配，是否影响游戏公平性？

**位置**：
- `backend/src/models/ShandongUpgradeGame.js:1443-1475` - `validateCardTypeMatch()`

**当前实现**：
```javascript
// 没有足够对应花色：允许垫牌。这里不再前置限制"主杀必须同型同量"，
// 是否能赢交由 compareCards 中的 isQualifiedTrumpKill 判断。
return { valid: true };
```

**讨论点**：
- 是否应该要求主杀时牌型匹配？
- 例如：领出对子时，是否必须用主牌对子杀？

**状态**: ⬜ 待讨论

---

### 优先级3：低风险区域 ℹ️

#### ✓ 7. 顺子中的对子处理
**问题**：顺子（雨）可以包含对子，比较时需要对子数相同。

**位置**：
- `backend/src/models/ShandongUpgradeGame.js:3008-3092` - `detectStraightsFromAllCards()`
- `backend/src/models/ShandongUpgradeGame.js:3274-3320` - `canBeatStraight()`

**检查方法**：
```javascript
// 测试场景
领出: 6,7,8,9,10,10 (红桃顺子，含1对10)
跟牌: 7,8,9,10,J,J (红桃顺子，含1对J)

期望: 长度相同(6)，对子数相同(1)，可以比较最大值
```

**状态**: ⬜ 待检查

---

#### ✓ 8. 闪/震的比较规则
**问题**：闪/震必须相同张数才能比较，震可以降级使用。

**位置**：
- `backend/src/models/ShandongUpgradeGame.js:3094-3144` - `detectFlashesAndThunders()`
- `backend/src/models/ShandongUpgradeGame.js:3253-3272` - `canBeatThunderOrFlash()`

**检查方法**：
```javascript
// 测试场景
领出: 4张闪 (2,2,2,2 四种花色)
玩家有: 5张震 (3,3,3,3,3 - 可以降级为4张)

期望: 可以选4张3来压过4张2
```

**状态**: ⬜ 待检查

---

## 🔧 测试工具

### 1. 自动化测试
```bash
cd backend
node test-runner.js
```

### 2. 单独测试某个功能
```bash
cd backend
node -e "
const Tester = require('./src/models/FollowCardTest');
const t = new Tester();
t.testTrumpFollowSuit();  // 测试主副牌跟牌
t.printSummary();
"
```

### 3. 在浏览器中测试
打开游戏，创建4人房间，手动测试各种场景。

---

## 📝 Bug报告模板

当发现bug时，请按以下格式记录：

```
Bug编号: #____
发现日期: ____________________
严重程度: 高/中/低
状态: 未修复/修复中/已修复

问题描述:
____________________________________________________

复现步骤:
1. ________________________________________________
2. ________________________________________________
3. ________________________________________________

期望结果:
____________________________________________________

实际结果:
____________________________________________________

相关代码位置:
文件: ____________________
函数: ____________________
行号: ____________________

建议修复方案:
____________________________________________________
```

---

## ✅ 检查进度

- [ ] 常主在副牌花色的识别
- [ ] 对子跟牌强制规则
- [ ] 甩牌否定逻辑
- [ ] 连对不能由常主形成
- [ ] 甩牌跟牌组合匹配
- [ ] 垫牌时的主杀匹配
- [ ] 顺子中的对子处理
- [ ] 闪/震的比较规则

---

**创建日期**: 2024年10月14日  
**最后更新**: 2024年10月14日

