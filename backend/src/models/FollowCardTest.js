/**
 * 山东升级 - 跟牌和甩牌测试脚本
 * 
 * 测试范围：
 * 1. 基础跟牌规则（单张、对子、连对）
 * 2. 特殊牌型跟牌（闪、震、顺子）
 * 3. 甩牌验证
 * 4. 垫牌规则
 * 5. 主杀和超吃
 * 6. 强制跟牌规则
 */

const ShandongUpgradeGame = require('./ShandongUpgradeGame');
const Player = require('./Player');
const Card = require('./Card');

class FollowCardTester {
  constructor() {
    this.testResults = [];
    this.passedTests = 0;
    this.failedTests = 0;
  }

  // 创建测试牌
  createCard(suit, rank, deckNumber = 0) {
    // Card构造函数: constructor(suit, rank, deckNumber = 0)
    // Card会自动生成id: `${suit}_${rank}_${deckNumber}`
    return new Card(suit, rank, deckNumber);
  }

  // 创建测试游戏
  createTestGame() {
    // 创建一个简化的游戏对象，只包含测试所需的方法和属性
    const game = {
      players: [],
      currentLevel: 2,
      trumpSuit: 'spades',
      gamePhase: 'playing',
      currentTurn: 1,
      roundCards: [],
      
      // 从ShandongUpgradeGame复制验证方法
      validatePlayCards: ShandongUpgradeGame.prototype.validatePlayCards,
      validateFollowCards: ShandongUpgradeGame.prototype.validateFollowCards,
      getLeadSuit: ShandongUpgradeGame.prototype.getLeadSuit,
      playerHasLeadSuit: ShandongUpgradeGame.prototype.playerHasLeadSuit,
      isFollowingSuit: ShandongUpgradeGame.prototype.isFollowingSuit,
      getPlayerCardsOfSuit: ShandongUpgradeGame.prototype.getPlayerCardsOfSuit,
      validateCardTypeMatch: ShandongUpgradeGame.prototype.validateCardTypeMatch,
      checkMandatoryFollow: ShandongUpgradeGame.prototype.checkMandatoryFollow,
      checkMandatorySingle: ShandongUpgradeGame.prototype.checkMandatorySingle,
      checkMandatoryPair: ShandongUpgradeGame.prototype.checkMandatoryPair,
      checkMandatoryConsecutivePairs: ShandongUpgradeGame.prototype.checkMandatoryConsecutivePairs,
      checkMandatoryStraight: ShandongUpgradeGame.prototype.checkMandatoryStraight,
      checkMandatoryFlashThunder: ShandongUpgradeGame.prototype.checkMandatoryFlashThunder,
      checkMandatoryMixed: ShandongUpgradeGame.prototype.checkMandatoryMixed,
      sortCardsByValue: ShandongUpgradeGame.prototype.sortCardsByValue,
      findPairs: function(cards) {
        // 修正后的版本：确保正确引用不同的卡牌对象
        const pairs = [];
        const used = new Set();
        
        for (let i = 0; i < cards.length - 1; i++) {
          if (used.has(i)) continue;
          
          for (let j = i + 1; j < cards.length; j++) {
            if (used.has(j)) continue;
            
            const card1 = cards[i];
            const card2 = cards[j];
            
            if (card1.rank === card2.rank && card1.suit === card2.suit) {
              pairs.push([cards[i], cards[j]]);
              used.add(i);
              used.add(j);
              break;
            }
          }
        }
        
        return pairs;
      },
      findLeadSuitPairs: ShandongUpgradeGame.prototype.findLeadSuitPairs,
      getPlayerCardsOfSuitFromCards: ShandongUpgradeGame.prototype.getPlayerCardsOfSuitFromCards,
      identifyPlayedPair: ShandongUpgradeGame.prototype.identifyPlayedPair,
      identifyPlayedPairs: ShandongUpgradeGame.prototype.identifyPlayedPairs,
      cardsMatch: ShandongUpgradeGame.prototype.cardsMatch,
      cardsMatchWithSameValue: ShandongUpgradeGame.prototype.cardsMatchWithSameValue,
      getCardDisplayName: ShandongUpgradeGame.prototype.getCardDisplayName,
      getSuitName: ShandongUpgradeGame.prototype.getSuitName,
      judgeLeadMixedAndForce: ShandongUpgradeGame.prototype.judgeLeadMixedAndForce,
      evaluateRound: ShandongUpgradeGame.prototype.evaluateRound,
      
      // 甩牌相关方法
      analyzeMixedCards: ShandongUpgradeGame.prototype.analyzeMixedCards,
      buildMandatoryMixedCombo: ShandongUpgradeGame.prototype.buildMandatoryMixedCombo,
      validateMixedCombo: ShandongUpgradeGame.prototype.validateMixedCombo,
      detectStraightsFromAllCards: ShandongUpgradeGame.prototype.detectStraightsFromAllCards,
      detectConsecutivePairs: ShandongUpgradeGame.prototype.detectConsecutivePairs,
      detectFlashesAndThunders: ShandongUpgradeGame.prototype.detectFlashesAndThunders,
      findMinUnit: ShandongUpgradeGame.prototype.findMinUnit,
      canBeBeatenByOthers: ShandongUpgradeGame.prototype.canBeBeatenByOthers,
      canPlayerBeatUnit: ShandongUpgradeGame.prototype.canPlayerBeatUnit,
      canBeatSingle: ShandongUpgradeGame.prototype.canBeatSingle,
      canBeatPair: ShandongUpgradeGame.prototype.canBeatPair,
      canBeatConsecutivePairs: ShandongUpgradeGame.prototype.canBeatConsecutivePairs,
      canBeatStraight: ShandongUpgradeGame.prototype.canBeatStraight,
      canBeatThunderOrFlash: ShandongUpgradeGame.prototype.canBeatThunderOrFlash,
      isSamePair: ShandongUpgradeGame.prototype.isSamePair,
      findConsecutiveCards: ShandongUpgradeGame.prototype.findConsecutiveCards
    };
    
    // 添加4个玩家（注意参数顺序：socketId, name, position）
    for (let i = 0; i < 4; i++) {
      const player = new Player(`socket${i}`, `玩家${i}`, i);
      game.players.push(player);
    }
    
    return game;
  }

  // 模拟领牌
  mockLeadCards(game, playerId, cards) {
    // 清空roundCards，确保是首家出牌
    game.roundCards = [];
    game.currentTurn = playerId;
    
    // 调用validatePlayCards来验证领牌（包括甩牌验证）
    const validation = game.validatePlayCards(playerId, cards);
    
    if (validation.valid) {
      // 如果验证通过，添加到roundCards
      game.roundCards = [{
        playerId: playerId,
        cards: cards,
        playerName: game.players[playerId].name,
        cardType: validation.cardType
      }];
      
      return { 
        success: true, 
        cardType: validation.cardType,
        message: validation.message
      };
    } else {
      return {
        success: false,
        message: validation.message
      };
    }
  }

  // 记录测试结果
  logTest(testName, passed, message = '') {
    const result = {
      name: testName,
      passed,
      message
    };
    
    this.testResults.push(result);
    
    if (passed) {
      this.passedTests++;
      console.log(`✅ ${testName}`);
    } else {
      this.failedTests++;
      console.log(`❌ ${testName}`);
      console.log(`   失败原因: ${message}`);
    }
  }

  // ========== 测试1: 基础单张跟牌 ==========
  testBasicSingleFollow() {
    console.log('\n========== 测试1: 基础单张跟牌 ==========');
    
    const game = this.createTestGame();
    
    // 设置玩家0的手牌（领牌者）
    game.players[0].cards = [
      this.createCard('hearts', 'A', 0)
    ];
    
    // 设置玩家1的手牌（跟牌者 - 有红桃）
    game.players[1].cards = [
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', '7', 0),
      this.createCard('clubs', 'Q', 0)
    ];
    
    // 玩家0出红桃A (模拟领牌)
    game.currentTurn = 0;
    this.mockLeadCards(game, 0, [this.createCard('hearts', 'A', 0)]);
    
    // 测试1.1: 跟牌者出同花色单张（合法）
    game.currentTurn = 1;
    const follow1 = game.validatePlayCards(1, [this.createCard('hearts', '7', 0)]);
    this.logTest(
      '1.1 有花色时可以出任意同花色单张',
      follow1.valid === true,
      follow1.message || ''
    );
    
    // 测试1.2: 跟牌者出其他花色（不合法，有红桃必须跟红桃）
    const follow2 = game.validatePlayCards(1, [this.createCard('clubs', 'Q', 0)]);
    this.logTest(
      '1.2 有花色时不能出其他花色',
      follow2.valid === false,
      '期望失败但得到: ' + (follow2.valid ? '通过' : '失败')
    );
  }

  // ========== 测试2: 对子跟牌规则 ==========
  testPairFollow() {
    console.log('\n========== 测试2: 对子跟牌规则 ==========');
    
    const game = this.createTestGame();
    
    // 设置玩家0的手牌（领牌者）
    game.players[0].cards = [
      this.createCard('hearts', 'A', 0),
      this.createCard('hearts', 'A', 1)
    ];
    
    // 设置玩家1的手牌（跟牌者 - 有对子）
    game.players[1].cards = [
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', 'K', 1),
      this.createCard('hearts', '7', 0),
      this.createCard('hearts', '8', 0)
    ];
    
    // 玩家0出对A
    game.currentTurn = 0;
    this.mockLeadCards(game, 0, [
      this.createCard('hearts', 'A', 0),
      this.createCard('hearts', 'A', 1)
    ]);
    
    // 测试2.1: 有对子必须出对子
    game.currentTurn = 1;
    const follow1 = game.validatePlayCards(1, [
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', 'K', 1)
    ]);
    this.logTest(
      '2.1 有对子时出对子（合法）',
      follow1.valid === true,
      follow1.message || ''
    );
    
    // 测试2.2: 有对子但出两张单张（不合法）
    const follow2 = game.validatePlayCards(1, [
      this.createCard('hearts', '7', 0),
      this.createCard('hearts', '8', 0)
    ]);
    this.logTest(
      '2.2 有对子时不能出两张单张',
      follow2.valid === false,
      '期望失败，实际: ' + (follow2.valid ? '通过' : '失败')
    );
    
    // 测试2.3: 没有对子时必须出两张最大的单张
    game.players[1].cards = [
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', '7', 0),
      this.createCard('hearts', '6', 0),
      this.createCard('clubs', 'Q', 0)
    ];
    
    game.currentTurn = 1;
    const follow3 = game.validatePlayCards(1, [
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', '7', 0)
    ]);
    this.logTest(
      '2.3 没有对子时出两张最大的单张（合法）',
      follow3.valid === true,
      follow3.message || ''
    );
    
    // 测试2.4: 没有对子时出非最大的单张（不合法）
    const follow4 = game.validatePlayCards(1, [
      this.createCard('hearts', '7', 0),
      this.createCard('hearts', '6', 0)
    ]);
    this.logTest(
      '2.4 没有对子时不能出非最大的单张',
      follow4.valid === false,
      '期望失败，实际: ' + (follow4.valid ? '通过' : '失败')
    );
  }

  // ========== 测试3: 主副牌识别 ==========
  testTrumpIdentification() {
    console.log('\n========== 测试3: 主副牌识别 ==========');
    
    const game = this.createTestGame();
    game.currentLevel = 2;
    game.trumpSuit = 'spades';
    
    // 测试3.1: 大小王是主牌
    const jokerBig = this.createCard('joker', 'big', 0);
    const jokerSmall = this.createCard('joker', 'small', 0);
    this.logTest(
      '3.1 大王是主牌',
      ShandongUpgradeGame.CardTypeValidator.isCardTrump(jokerBig, 2, 'spades') === true
    );
    this.logTest(
      '3.2 小王是主牌',
      ShandongUpgradeGame.CardTypeValidator.isCardTrump(jokerSmall, 2, 'spades') === true
    );
    
    // 测试3.3: 级牌是主牌
    const level2Spades = this.createCard('spades', '2', 0);
    const level2Hearts = this.createCard('hearts', '2', 0);
    this.logTest(
      '3.3 主花色的级牌是主牌',
      ShandongUpgradeGame.CardTypeValidator.isCardTrump(level2Spades, 2, 'spades') === true
    );
    this.logTest(
      '3.4 副花色的级牌也是主牌',
      ShandongUpgradeGame.CardTypeValidator.isCardTrump(level2Hearts, 2, 'spades') === true
    );
    
    // 测试3.5: 常主（2,3,5）是主牌
    const perm3 = this.createCard('hearts', '3', 0);
    const perm5 = this.createCard('clubs', '5', 0);
    this.logTest(
      '3.5 常主3是主牌',
      ShandongUpgradeGame.CardTypeValidator.isCardTrump(perm3, 2, 'spades') === true
    );
    this.logTest(
      '3.6 常主5是主牌',
      ShandongUpgradeGame.CardTypeValidator.isCardTrump(perm5, 2, 'spades') === true
    );
    
    // 测试3.7: 主花色的牌是主牌
    const spadesK = this.createCard('spades', 'K', 0);
    this.logTest(
      '3.7 主花色K是主牌',
      ShandongUpgradeGame.CardTypeValidator.isCardTrump(spadesK, 2, 'spades') === true
    );
    
    // 测试3.8: 副花色的非常主非级牌不是主牌
    const heartsK = this.createCard('hearts', 'K', 0);
    this.logTest(
      '3.8 副花色K不是主牌',
      ShandongUpgradeGame.CardTypeValidator.isCardTrump(heartsK, 2, 'spades') === false
    );
  }

  // ========== 测试4: 垫牌规则 ==========
  testPadding() {
    console.log('\n========== 测试4: 垫牌规则 ==========');
    
    const game = this.createTestGame();
    
    // 设置玩家0的手牌（领牌者）
    game.players[0].cards = [
      this.createCard('hearts', 'A', 0),
      this.createCard('hearts', 'K', 0)
    ];
    
    // 设置玩家1的手牌（跟牌者 - 只有1张红桃，不够跟牌）
    game.players[1].cards = [
      this.createCard('hearts', '7', 0),
      this.createCard('clubs', 'Q', 0),
      this.createCard('clubs', 'J', 0),
      this.createCard('diamonds', '9', 0)
    ];
    
    // 玩家0出对A
    game.currentTurn = 0;
    this.mockLeadCards(game, 0, [
      this.createCard('hearts', 'A', 0),
      this.createCard('hearts', 'K', 0)
    ]);
    
    // 测试4.1: 该花色牌数不够时允许垫牌
    game.currentTurn = 1;
    const follow1 = game.validatePlayCards(1, [
      this.createCard('hearts', '7', 0),
      this.createCard('clubs', 'Q', 0)
    ]);
    this.logTest(
      '4.1 牌数不够时允许垫牌（混合花色）',
      follow1.valid === true,
      follow1.message || ''
    );
    
    // 测试4.2: 完全没有该花色时可以出任意牌
    game.players[1].cards = [
      this.createCard('clubs', 'Q', 0),
      this.createCard('clubs', 'J', 0),
      this.createCard('diamonds', '9', 0),
      this.createCard('diamonds', '8', 0)
    ];
    
    const follow2 = game.validatePlayCards(1, [
      this.createCard('clubs', 'Q', 0),
      this.createCard('diamonds', '9', 0)
    ]);
    this.logTest(
      '4.2 没有该花色时可以出任意牌',
      follow2.valid === true,
      follow2.message || ''
    );
  }

  // ========== 测试5: 主牌跟副牌 ==========
  testTrumpFollowSuit() {
    console.log('\n========== 测试5: 主牌跟副牌 ==========');
    
    const game = this.createTestGame();
    game.currentLevel = 2;
    game.trumpSuit = 'spades';
    
    // 设置玩家0的手牌（领牌者 - 出红桃）
    game.players[0].cards = [
      this.createCard('hearts', 'A', 0)
    ];
    
    // 设置玩家1的手牌（跟牌者 - 有红桃，也有主牌）
    game.players[1].cards = [
      this.createCard('hearts', 'K', 0),
      this.createCard('spades', 'A', 0), // 主牌
      this.createCard('hearts', '3', 0), // 常主，也是主牌
      this.createCard('hearts', '7', 0)
    ];
    
    // 玩家0出红桃A（副牌）
    game.currentTurn = 0;
    this.mockLeadCards(game, 0, [this.createCard('hearts', 'A', 0)]);
    
    // 测试5.1: 有副牌时必须跟副牌，不能出主牌
    game.currentTurn = 1;
    const follow1 = game.validatePlayCards(1, [
      this.createCard('spades', 'A', 0)
    ]);
    this.logTest(
      '5.1 领出副牌时不能用主牌跟（有副牌时）',
      follow1.valid === false,
      '期望失败，实际: ' + (follow1.valid ? '通过' : '失败')
    );
    
    // 测试5.2: 常主虽然在红桃花色，但它是主牌，不能算作红桃副牌
    const follow2 = game.validatePlayCards(1, [
      this.createCard('hearts', '3', 0)
    ]);
    this.logTest(
      '5.2 领出副牌时不能出常主',
      follow2.valid === false,
      '期望失败，实际: ' + (follow2.valid ? '通过' : '失败')
    );
    
    // 测试5.3: 必须出副牌红桃
    const follow3 = game.validatePlayCards(1, [
      this.createCard('hearts', 'K', 0)
    ]);
    this.logTest(
      '5.3 领出副牌时必须跟副牌',
      follow3.valid === true,
      follow3.message || ''
    );
  }

  // ========== 测试6: 副牌领牌，主杀 ==========
  testTrumpKill() {
    console.log('\n========== 测试6: 副牌领牌，主杀 ==========');
    
    const game = this.createTestGame();
    game.currentLevel = 2;
    game.trumpSuit = 'spades';
    
    // 设置玩家0的手牌（领牌者 - 出红桃对）
    game.players[0].cards = [
      this.createCard('hearts', 'A', 0),
      this.createCard('hearts', 'A', 1)
    ];
    
    // 设置玩家1的手牌（跟牌者 - 没有红桃，但有主牌）
    game.players[1].cards = [
      this.createCard('spades', 'K', 0),
      this.createCard('spades', 'K', 1), // 主对子
      this.createCard('spades', 'Q', 0),
      this.createCard('clubs', 'J', 0)
    ];
    
    // 玩家0出红桃对A（副牌对子）
    game.currentTurn = 0;
    this.mockLeadCards(game, 0, [
      this.createCard('hearts', 'A', 0),
      this.createCard('hearts', 'A', 1)
    ]);
    
    // 测试6.1: 没有副牌时可以用主牌杀（垫牌阶段，任何牌都可以）
    game.currentTurn = 1;
    const follow1 = game.validatePlayCards(1, [
      this.createCard('spades', 'K', 0),
      this.createCard('spades', 'K', 1)
    ]);
    this.logTest(
      '6.1 没有副牌时可以用主牌杀',
      follow1.valid === true,
      follow1.message || ''
    );
  }

  // ========== 测试7: 连对跟牌 ==========
  testConsecutivePairsFollow() {
    console.log('\n========== 测试7: 连对跟牌 ==========');
    
    const game = this.createTestGame();
    game.currentLevel = 2;
    game.trumpSuit = 'spades';
    
    // 设置玩家0的手牌（领牌者 - 出连对）
    game.players[0].cards = [
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', 'K', 1),
      this.createCard('hearts', 'Q', 0),
      this.createCard('hearts', 'Q', 1)
    ];
    
    // 设置玩家1的手牌（跟牌者 - 有连对）
    game.players[1].cards = [
      this.createCard('hearts', 'J', 0),
      this.createCard('hearts', 'J', 1),
      this.createCard('hearts', '10', 0),
      this.createCard('hearts', '10', 1),
      this.createCard('hearts', '9', 0),
      this.createCard('hearts', '8', 0)
    ];
    
    // 玩家0出连对KK QQ
    game.currentTurn = 0;
    this.mockLeadCards(game, 0, [
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', 'K', 1),
      this.createCard('hearts', 'Q', 0),
      this.createCard('hearts', 'Q', 1)
    ]);
    
    // 测试7.1: 有连对时必须出连对（或多对）
    game.currentTurn = 1;
    const follow1 = game.validatePlayCards(1, [
      this.createCard('hearts', 'J', 0),
      this.createCard('hearts', 'J', 1),
      this.createCard('hearts', '10', 0),
      this.createCard('hearts', '10', 1)
    ]);
    this.logTest(
      '7.1 有连对时出连对（合法）',
      follow1.valid === true,
      follow1.message || ''
    );
    
    // 测试7.2: 有连对但不够数量时，必须出所有对子+最大单张
    game.players[1].cards = [
      this.createCard('hearts', 'J', 0),
      this.createCard('hearts', 'J', 1),
      this.createCard('hearts', '9', 0),
      this.createCard('hearts', '8', 0),
      this.createCard('hearts', '7', 0)
    ];
    
    const follow2 = game.validatePlayCards(1, [
      this.createCard('hearts', 'J', 0),
      this.createCard('hearts', 'J', 1),
      this.createCard('hearts', '9', 0),
      this.createCard('hearts', '8', 0)
    ]);
    this.logTest(
      '7.2 有1对但需要2对时，出1对+2张最大单张（合法）',
      follow2.valid === true,
      follow2.message || ''
    );
    
    // 测试7.3: 没有对子时必须出4张最大的单张
    game.players[1].cards = [
      this.createCard('hearts', 'A', 0),
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', 'J', 0),
      this.createCard('hearts', '9', 0),
      this.createCard('hearts', '7', 0)
    ];
    
    const follow3 = game.validatePlayCards(1, [
      this.createCard('hearts', 'A', 0),
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', 'J', 0),
      this.createCard('hearts', '9', 0)
    ]);
    this.logTest(
      '7.3 没有对子时出4张最大单张（合法）',
      follow3.valid === true,
      follow3.message || ''
    );
  }

  // ========== 测试8: 甩牌验证 ==========
  testMixedCardValidation() {
    console.log('\n========== 测试8: 甩牌验证 ==========');
    
    const game = this.createTestGame();
    game.currentLevel = 2;
    game.trumpSuit = 'spades';
    
    // 设置玩家0的手牌（领牌者 - 甩牌A+K+Q）
    game.players[0].cards = [
      this.createCard('hearts', 'A', 0),
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', 'Q', 0)
    ];
    
    // 设置其他玩家都没有更大的红桃单张
    for (let i = 1; i < 4; i++) {
      game.players[i].cards = [
        this.createCard('clubs', '7', i),
        this.createCard('clubs', '8', i),
        this.createCard('diamonds', '9', i)
      ];
    }
    
    // 玩家0甩牌A+K+Q（应该成功）
    game.currentTurn = 0;
    const leadResult = this.mockLeadCards(game, 0, [
      this.createCard('hearts', 'A', 0),
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', 'Q', 0)
    ]);
    
    this.logTest(
      '8.1 甩牌成功（其他玩家没有更大的牌）',
      leadResult.success === true,
      leadResult.message || ''
    );
    
    // 测试8.2: 甩牌被否定（有玩家有更大的单张）
    const game2 = this.createTestGame();
    game2.currentLevel = 2;
    game2.trumpSuit = 'spades';
    
    game2.players[0].cards = [
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', 'Q', 0),
      this.createCard('hearts', 'J', 0)
    ];
    
    // 玩家1没有红桃
    game2.players[1].cards = [
      this.createCard('clubs', '7', 0),
      this.createCard('clubs', '8', 0),
      this.createCard('diamonds', '9', 0)
    ];
    
    // 玩家2有更大的红桃A
    game2.players[2].cards = [
      this.createCard('hearts', 'A', 0),
      this.createCard('clubs', '7', 0),
      this.createCard('clubs', '8', 0)
    ];
    
    // 玩家3没有红桃
    game2.players[3].cards = [
      this.createCard('clubs', '7', 0),
      this.createCard('clubs', '8', 0),
      this.createCard('diamonds', '9', 0)
    ];
    
    game2.currentTurn = 0;
    const leadResult2 = this.mockLeadCards(game2, 0, [
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', 'Q', 0),
      this.createCard('hearts', 'J', 0)
    ]);
    
    // 如果被否定，应该强制出最小的单位
    const wasForced = leadResult2.message && leadResult2.message.includes('否定');
    this.logTest(
      '8.2 甩牌被否定（有玩家有更大的单张）',
      wasForced === true,
      `期望被否定，实际: ${leadResult2.message}`
    );
  }

  // ========== 测试9: 甩牌跟牌规则 ==========
  testMixedFollow() {
    console.log('\n========== 测试9: 甩牌跟牌规则 ==========');
    
    const game = this.createTestGame();
    game.currentLevel = 2;
    game.trumpSuit = 'spades';
    
    // 设置玩家0的手牌（领牌者 - 甩牌：对A + 单K）
    game.players[0].cards = [
      this.createCard('hearts', 'A', 0),
      this.createCard('hearts', 'A', 1),
      this.createCard('hearts', 'K', 0)
    ];
    
    // 设置玩家1的手牌（跟牌者 - 有对子+单张）
    game.players[1].cards = [
      this.createCard('hearts', 'Q', 0),
      this.createCard('hearts', 'Q', 1),
      this.createCard('hearts', 'J', 0),
      this.createCard('hearts', '10', 0)
    ];
    
    // 其他玩家设置为没有红桃
    for (let i = 2; i < 4; i++) {
      game.players[i].cards = [
        this.createCard('clubs', '7', i),
        this.createCard('clubs', '8', i),
        this.createCard('diamonds', '9', i)
      ];
    }
    
    // 玩家0甩牌：对A + 单K
    game.currentTurn = 0;
    const leadResult = this.mockLeadCards(game, 0, [
      this.createCard('hearts', 'A', 0),
      this.createCard('hearts', 'A', 1),
      this.createCard('hearts', 'K', 0)
    ]);
    
    console.log('  领牌结果:', leadResult);
    
    // 测试9.1: 跟牌者有对子+单张时，应该出对子+单张
    game.currentTurn = 1;
    const follow1 = game.validatePlayCards(1, [
      this.createCard('hearts', 'Q', 0),
      this.createCard('hearts', 'Q', 1),
      this.createCard('hearts', 'J', 0)
    ]);
    
    this.logTest(
      '9.1 跟甩牌（对+单）时出对+单（合法）',
      follow1.valid === true,
      follow1.message || ''
    );
  }

  // ========== 测试10: 连对跟牌详细规则 ==========
  testConsecutivePairsFollowDetailed() {
    console.log('\n========== 测试10: 连对跟牌详细规则 ==========');
    
    const game = this.createTestGame();
    game.currentLevel = 2;
    game.trumpSuit = 'hearts'; // 主牌是红桃，黑桃是副牌
    
    // ===== 场景1: 有三联对时必须出三联对 =====
    console.log('\n  场景1: 有三联对时必须出三联对');
    game.players[0].cards = [
      this.createCard('spades', 'A', 0),
      this.createCard('spades', 'A', 1),
      this.createCard('spades', 'K', 0),
      this.createCard('spades', 'K', 1),
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1)
    ];
    
    game.players[1].cards = [
      this.createCard('spades', 'J', 0),
      this.createCard('spades', 'J', 1),
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1),
      this.createCard('spades', '10', 0),
      this.createCard('spades', '10', 1)
    ];
    
    game.currentTurn = 0;
    this.mockLeadCards(game, 0, [
      this.createCard('spades', 'A', 0),
      this.createCard('spades', 'A', 1),
      this.createCard('spades', 'K', 0),
      this.createCard('spades', 'K', 1),
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1)
    ]);
    
    game.currentTurn = 1;
    const follow1_1 = game.validatePlayCards(1, [
      this.createCard('spades', 'J', 0),
      this.createCard('spades', 'J', 1),
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1),
      this.createCard('spades', '10', 0),
      this.createCard('spades', '10', 1)
    ]);
    this.logTest(
      '10.1 有三联对时必须出三联对（合法）',
      follow1_1.valid === true,
      follow1_1.message || ''
    );
    
    // ===== 场景2: 有多个三联对时可以任意挑选一个 =====
    console.log('\n  场景2: 有多个三联对时可以任意挑选一个');
    game.players[1].cards = [
      this.createCard('spades', 'J', 0),
      this.createCard('spades', 'J', 1),
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1),
      this.createCard('spades', '10', 0),
      this.createCard('spades', '10', 1),
      this.createCard('spades', '9', 0),
      this.createCard('spades', '9', 1),
      this.createCard('spades', '8', 0),
      this.createCard('spades', '8', 1),
      this.createCard('spades', '7', 0),
      this.createCard('spades', '7', 1)
    ];
    
    game.currentTurn = 1;
    const follow2_1 = game.validatePlayCards(1, [
      this.createCard('spades', '9', 0),
      this.createCard('spades', '9', 1),
      this.createCard('spades', '8', 0),
      this.createCard('spades', '8', 1),
      this.createCard('spades', '7', 0),
      this.createCard('spades', '7', 1)
    ]);
    this.logTest(
      '10.2 有多个三联对时可以选择任意一个三联对（合法）',
      follow2_1.valid === true,
      follow2_1.message || ''
    );
    
    // ===== 场景3: 有两联对时，必须出两联对+对子（如果有额外对子）=====
    console.log('\n  场景3: 有两联对+额外对子时，必须出两联对+对子');
    game.players[1].cards = [
      this.createCard('spades', 'J', 0),
      this.createCard('spades', 'J', 1),
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1),
      this.createCard('spades', '8', 0),
      this.createCard('spades', '8', 1),
      this.createCard('spades', '7', 0),
      this.createCard('spades', '7', 1),
      this.createCard('spades', '6', 0),
      this.createCard('spades', '4', 0)
    ];
    
    game.currentTurn = 1;
    // 合法: 出JJQQ88 (两联对JJQQ + 对子88)
    const follow3_1 = game.validatePlayCards(1, [
      this.createCard('spades', 'J', 0),
      this.createCard('spades', 'J', 1),
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1),
      this.createCard('spades', '8', 0),
      this.createCard('spades', '8', 1)
    ]);
    this.logTest(
      '10.3 有两联对+额外对子时，出两联对+对子（JJQQ88，合法）',
      follow3_1.valid === true,
      follow3_1.message || ''
    );
    
    // 合法: 出JJQQ77 (两联对JJQQ + 对子77)
    const follow3_2 = game.validatePlayCards(1, [
      this.createCard('spades', 'J', 0),
      this.createCard('spades', 'J', 1),
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1),
      this.createCard('spades', '7', 0),
      this.createCard('spades', '7', 1)
    ]);
    this.logTest(
      '10.4 有两联对+额外对子时，出两联对+对子（JJQQ77，合法）',
      follow3_2.valid === true,
      follow3_2.message || ''
    );
    
    // 合法: 出QQ8877 (两联对中的QQ + 另一个两联对8877)
    const follow3_3 = game.validatePlayCards(1, [
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1),
      this.createCard('spades', '8', 0),
      this.createCard('spades', '8', 1),
      this.createCard('spades', '7', 0),
      this.createCard('spades', '7', 1)
    ]);
    this.logTest(
      '10.5 有两联对+额外对子时，出另一个两联对+对子（QQ8877，合法）',
      follow3_3.valid === true,
      follow3_3.message || ''
    );
    
    // 不合法: 出8877 6 4（用单张补，但有额外对子）
    const follow3_4 = game.validatePlayCards(1, [
      this.createCard('spades', '8', 0),
      this.createCard('spades', '8', 1),
      this.createCard('spades', '7', 0),
      this.createCard('spades', '7', 1),
      this.createCard('spades', '6', 0),
      this.createCard('spades', '4', 0)
    ]);
    this.logTest(
      '10.6 有两联对+额外对子时，不能用单张补（8877 6 4，不合法）',
      follow3_4.valid === false,
      '期望失败，实际: ' + (follow3_4.valid ? '通过' : '失败')
    );
    
    // 不合法: 出JJQQ 6 4（用单张补，但有额外对子）
    const follow3_5 = game.validatePlayCards(1, [
      this.createCard('spades', 'J', 0),
      this.createCard('spades', 'J', 1),
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1),
      this.createCard('spades', '6', 0),
      this.createCard('spades', '4', 0)
    ]);
    this.logTest(
      '10.7 有两联对+额外对子时，不能用单张补（JJQQ 6 4，不合法）',
      follow3_5.valid === false,
      '期望失败，实际: ' + (follow3_5.valid ? '通过' : '失败')
    );
    
    // ===== 场景4: 有两联对但无额外对子，用最大单张补 =====
    console.log('\n  场景4: 有两联对但无额外对子，用最大单张补');
    game.players[1].cards = [
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1),
      this.createCard('spades', 'J', 0),
      this.createCard('spades', 'J', 1),
      this.createCard('spades', '10', 0),
      this.createCard('spades', '9', 0),
      this.createCard('spades', '8', 0),
      this.createCard('spades', '7', 0),
      this.createCard('spades', '6', 0),
      this.createCard('spades', '4', 0)
    ];
    
    game.currentTurn = 1;
    // 合法: 出QQJJ10 9（两联对+最大两张单张）
    const follow4_1 = game.validatePlayCards(1, [
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1),
      this.createCard('spades', 'J', 0),
      this.createCard('spades', 'J', 1),
      this.createCard('spades', '10', 0),
      this.createCard('spades', '9', 0)
    ]);
    this.logTest(
      '10.8 有两联对无额外对子时，出两联对+最大两张单张（QQJJ10 9，合法）',
      follow4_1.valid === true,
      follow4_1.message || ''
    );
    
    // ===== 场景5: 另一个两联对+单张的例子 =====
    game.players[1].cards = [
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1),
      this.createCard('spades', 'J', 0),
      this.createCard('spades', 'J', 1),
      this.createCard('spades', '10', 0),
      this.createCard('spades', '9', 0),
      this.createCard('spades', '9', 1),
      this.createCard('spades', '8', 0),
      this.createCard('spades', '8', 1),
      this.createCard('spades', '7', 0),
      this.createCard('spades', '6', 0),
      this.createCard('spades', '4', 0)
    ];
    
    game.currentTurn = 1;
    // 合法: 出QJ 9988（两联对中的QJ + 另一个两联对9988的部分作为两联对）
    // 实际上这里应该是出QJ109988，但因为只需要6张，所以出某个两联对+两张最大单
    const follow5_1 = game.validatePlayCards(1, [
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'J', 0),
      this.createCard('spades', '10', 0),
      this.createCard('spades', '9', 0),
      this.createCard('spades', '9', 1),
      this.createCard('spades', '8', 0)
    ]);
    // 注意：QJ109988不是合法连对，因为Q J 10不连续（缺少Q的对子）
    // 这个测试可能需要调整
    
    // ===== 场景6: 没有连对但有3个以上对子，可以任意选3个 =====
    console.log('\n  场景6: 没有连对但有3个以上对子，可以任意选3个');
    game.players[1].cards = [
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1),
      this.createCard('spades', '10', 0),
      this.createCard('spades', '10', 1),
      this.createCard('spades', '8', 0),
      this.createCard('spades', '8', 1),
      this.createCard('spades', '6', 0),
      this.createCard('spades', '6', 1),
      this.createCard('spades', '4', 0)
    ];
    
    game.currentTurn = 1;
    // 合法: 从4个对子中任意选3个
    const follow6_1 = game.validatePlayCards(1, [
      this.createCard('spades', 'Q', 0),
      this.createCard('spades', 'Q', 1),
      this.createCard('spades', '10', 0),
      this.createCard('spades', '10', 1),
      this.createCard('spades', '8', 0),
      this.createCard('spades', '8', 1)
    ]);
    this.logTest(
      '10.9 没有连对但有4个对子时，可以任意选3个（QQ 10 10 88，合法）',
      follow6_1.valid === true,
      follow6_1.message || ''
    );
    
    const follow6_2 = game.validatePlayCards(1, [
      this.createCard('spades', '10', 0),
      this.createCard('spades', '10', 1),
      this.createCard('spades', '8', 0),
      this.createCard('spades', '8', 1),
      this.createCard('spades', '6', 0),
      this.createCard('spades', '6', 1)
    ]);
    this.logTest(
      '10.10 没有连对但有4个对子时，可以任意选3个（10 10 88 66，合法）',
      follow6_2.valid === true,
      follow6_2.message || ''
    );
    
    // ===== 场景7: 对子不足3个，必须出所有对子+最大单张补齐 =====
    console.log('\n  场景7: 对子不足3个，必须出所有对子+最大单张补齐');
    game.players[1].cards = [
      this.createCard('spades', '8', 0),
      this.createCard('spades', '8', 1),
      this.createCard('spades', '7', 0),
      this.createCard('spades', '6', 0),
      this.createCard('spades', '4', 0)
    ];
    
    game.currentTurn = 1;
    // 合法: 出88 + 最大4张单张中的2张（7 6）
    const follow7_1 = game.validatePlayCards(1, [
      this.createCard('spades', '8', 0),
      this.createCard('spades', '8', 1),
      this.createCard('spades', '7', 0),
      this.createCard('spades', '6', 0),
      this.createCard('spades', '4', 0),
      this.createCard('spades', '4', 0) // 这里需要6张，但只有5张，需要调整
    ]);
    // 这个场景需要调整，因为只有5张牌但需要6张
    
    // 重新设置手牌
    game.players[1].cards = [
      this.createCard('spades', '8', 0),
      this.createCard('spades', '8', 1),
      this.createCard('spades', '7', 0),
      this.createCard('spades', '6', 0),
      this.createCard('spades', '4', 0),
      this.createCard('spades', 'J', 0)
    ];
    
    const follow7_2 = game.validatePlayCards(1, [
      this.createCard('spades', '8', 0),
      this.createCard('spades', '8', 1),
      this.createCard('spades', 'J', 0),
      this.createCard('spades', '7', 0),
      this.createCard('spades', '6', 0),
      this.createCard('spades', '4', 0)
    ]);
    this.logTest(
      '10.11 只有1对时，出所有对子+最大4张单张（88 J764，合法）',
      follow7_2.valid === true,
      follow7_2.message || ''
    );
  }

  // ========== 测试11: 边界情况 ==========
  testEdgeCases() {
    console.log('\n========== 测试11: 边界情况 ==========');
    
    // 测试10.1: 出牌数量不匹配
    const game1 = this.createTestGame();
    game1.players[0].cards = [
      this.createCard('hearts', 'A', 0)
    ];
    game1.players[1].cards = [
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', 'Q', 0)
    ];
    
    game1.currentTurn = 0;
    this.mockLeadCards(game1, 0, [this.createCard('hearts', 'A', 0)]);
    
    game1.currentTurn = 1;
    const follow1 = game1.validatePlayCards(1, [
      this.createCard('hearts', 'K', 0),
      this.createCard('hearts', 'Q', 0)
    ]);
    
    this.logTest(
      '10.1 出牌数量不匹配（不合法）',
      follow1.valid === false,
      '期望失败，实际: ' + (follow1.valid ? '通过' : '失败')
    );
    
    // 测试10.2: 空手牌
    const game2 = this.createTestGame();
    game2.players[1].cards = [];
    
    const follow2 = game2.validatePlayCards(1, []);
    this.logTest(
      '10.2 空手牌验证',
      follow2.valid === false || follow2.message.includes('至少一张'),
      '空手牌应该返回错误'
    );
  }

  // 运行所有测试
  runAllTests() {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  山东升级 - 跟牌和甩牌测试套件                ║');
    console.log('╚════════════════════════════════════════════════╝\n');
    
    try {
      this.testBasicSingleFollow();
      this.testPairFollow();
      this.testTrumpIdentification();
      this.testPadding();
      this.testTrumpFollowSuit();
      this.testTrumpKill();
      this.testConsecutivePairsFollow();
      this.testMixedCardValidation();
      this.testMixedFollow();
      this.testConsecutivePairsFollowDetailed();
      this.testEdgeCases();
    } catch (error) {
      console.error('\n💥 测试过程中发生错误:', error);
      console.error(error.stack);
    }
    
    return this.printSummary();
  }

  // 打印测试总结
  printSummary() {
    console.log('\n\n╔════════════════════════════════════════════════╗');
    console.log('║  测试总结                                      ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log(`\n总测试数: ${this.testResults.length}`);
    console.log(`✅ 通过: ${this.passedTests}`);
    console.log(`❌ 失败: ${this.failedTests}`);
    console.log(`通过率: ${((this.passedTests / this.testResults.length) * 100).toFixed(2)}%\n`);
    
    if (this.failedTests > 0) {
      console.log('失败的测试:\n');
      this.testResults
        .filter(r => !r.passed)
        .forEach((r, index) => {
          console.log(`${index + 1}. ${r.name}`);
          console.log(`   原因: ${r.message}\n`);
        });
    }
    
    return {
      total: this.testResults.length,
      passed: this.passedTests,
      failed: this.failedTests,
      results: this.testResults
    };
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  const tester = new FollowCardTester();
  tester.runAllTests();
}

module.exports = FollowCardTester;

