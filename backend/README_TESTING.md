# 跟牌和甩牌测试使用说明

## 快速开始

### 运行测试

```bash
cd backend
node test-runner.js
```

### 查看测试报告

测试完成后会在 `backend/test-report.txt` 生成详细报告。

```bash
# Windows
type test-report.txt

# Mac/Linux
cat test-report.txt
```

## 当前测试结果

✅ **通过率**: 92% (23/25)  
❌ **失败测试**: 2个  
⚠️ **发现问题**: 3个

### 主要发现

#### ✅ 已验证通过的功能
- 基础单张跟牌
- 对子跟牌强制规则
- 主副牌识别（包括常主2,3,5）
- 垫牌规则
- 主牌跟副牌规则
- 主杀规则

#### ❌ 需要修复的问题

1. **连对跟牌 - 部分对子情况**
   - 位置: `ShandongUpgradeGame.js:1612-1667`
   - 问题: 有1对但需要2对时，验证逻辑有误

2. **甩牌否定测试**
   - 问题: 测试脚本未正确模拟甩牌否定逻辑

3. **甩牌跟牌功能未完成**
   - 缺失方法: `analyzeMixedCards`, `buildMandatoryMixedCombo`, `validateMixedCombo`
   - 影响: 甩牌跟牌验证无法工作

4. **数字'10'的连续值问题**
   - 问题: `getSequentialValue`对'10'返回0，导致连对识别失败
   - 影响: JJ 1010 无法识别为连对

## 详细文档

- **测试方案**: `docs/FOLLOW_CARD_TEST_PLAN.md`
- **检查清单**: `docs/BUG_CHECK_CHECKLIST.md`
- **执行报告**: `docs/TEST_EXECUTION_REPORT.md`
- **技术实现**: `docs/FOLLOW_CARD_IMPLEMENTATION.md`

## 测试脚本说明

测试代码位于: `backend/src/models/FollowCardTest.js`

### 测试分类

1. **基础跟牌规则** (testBasicSingleFollow)
2. **对子跟牌规则** (testPairFollow)
3. **主副牌识别** (testTrumpIdentification)
4. **垫牌规则** (testPadding)
5. **主牌跟副牌** (testTrumpFollowSuit)
6. **主杀规则** (testTrumpKill)
7. **连对跟牌** (testConsecutivePairsFollow)
8. **甩牌验证** (testMixedCardValidation)
9. **甩牌跟牌** (testMixedFollow)
10. **边界情况** (testEdgeCases)

### 运行单个测试

```javascript
const Tester = require('./src/models/FollowCardTest');
const t = new Tester();

// 只运行主副牌识别测试
t.testTrumpIdentification();
t.printSummary();
```

## 下一步

### 优先修复 (建议顺序)

1. ⬜ 修复数字'10'的连续值问题
2. ⬜ 完善连对跟牌的部分对子逻辑
3. ⬜ 实现甩牌跟牌功能
4. ⬜ 添加闪/震、顺子测试
5. ⬜ 集成测试（真实游戏环境）

### 建议的修复流程

1. 阅读 `docs/BUG_CHECK_CHECKLIST.md` 了解重点检查区域
2. 查看 `docs/TEST_EXECUTION_REPORT.md` 了解详细问题
3. 修复代码
4. 运行测试验证
5. 更新文档

## 贡献

如果发现新的bug或问题：

1. 在 `docs/BUG_CHECK_CHECKLIST.md` 中记录
2. 在 `FollowCardTest.js` 中添加测试用例
3. 运行测试确认问题复现
4. 修复并验证

---

**创建日期**: 2024年10月14日

