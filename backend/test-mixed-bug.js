/**
 * 测试甩牌跟牌bug
 * 场景：首家出 ♠JJ ♠QQ ♠A (连对+单张)
 */

const ShandongUpgradeGame = require('./src/models/ShandongUpgradeGame');
const Player = require('./src/models/Player');
const Card = require('./src/models/Card');

console.log('\n=== 测试甩牌跟牌Bug ===\n');

// 创建游戏（绕过初始化）
const game = Object.create(ShandongUpgradeGame.prototype);
game.roomId = 'test-room';
game.players = [];
game.deck = [];
game.currentTurn = 0;
game.roundCards = [];
game.trickWinners = [];
game.scores = [0, 0];

// 添加4个玩家
for (let i = 0; i < 4; i++) {
  const player = new Player(`socket${i}`, `玩家${i}`, i);
  game.players.push(player);
}

// 设置游戏状态
game.currentLevel = 2;
game.trumpSuit = 'hearts';  // 主花色是红桃
game.trumpRank = 7;
game.gamePhase = 'playing';
game.currentTurn = 2;
game.roundCards = [];

// 玩家2（首家）的手牌 - 将要甩牌 ♠JJ ♠QQ ♠A
game.players[2].cards = [
  new Card('spades', 'J', 1),
  new Card('spades', 'J', 0),
  new Card('spades', 'Q', 1),
  new Card('spades', 'Q', 0),
  new Card('spades', 'A', 1)
];

// 玩家3（跟牌者）的手牌 - 没有对子
game.players[3].cards = [
  new Card('spades', 'A', 0),
  new Card('spades', 'K', 0),
  new Card('spades', '10', 0),
  new Card('spades', '9', 0),
  new Card('spades', '6', 0)
];

console.log('首家手牌:', game.players[2].cards.map(c => c.displayName).join(', '));
console.log('跟牌者手牌:', game.players[3].cards.map(c => c.displayName).join(', '));
console.log('');

// 首家出牌 ♠JJ ♠QQ ♠A
console.log('=== 首家出牌: ♠JJ ♠QQ ♠A ===\n');
const leadCards = [
  new Card('spades', 'J', 1),
  new Card('spades', 'J', 0),
  new Card('spades', 'Q', 1),
  new Card('spades', 'Q', 0),
  new Card('spades', 'A', 1)
];

const leadResult = game.validatePlayCards(2, leadCards);
console.log('首家出牌结果:', {
  valid: leadResult.valid,
  cardType: leadResult.cardType ? leadResult.cardType.type : null,
  message: leadResult.message
});

if (leadResult.valid) {
  // 模拟添加到roundCards
  game.roundCards = [{
    playerId: 2,
    cards: leadCards,
    playerName: '玩家2',
    cardType: leadResult.cardType
  }];
  
  console.log('\n=== 玩家3跟牌 ===\n');
  
  // 尝试跟牌
  const followCards = [
    new Card('spades', 'A', 0),
    new Card('spades', 'K', 0),
    new Card('spades', '10', 0),
    new Card('spades', '9', 0),
    new Card('spades', '6', 0)
  ];
  
  console.log('玩家3出牌:', followCards.map(c => c.displayName).join(', '));
  
  game.currentTurn = 3;
  const followResult = game.validatePlayCards(3, followCards);
  
  console.log('\n跟牌结果:', {
    valid: followResult.valid,
    message: followResult.message
  });
  
  if (!followResult.valid) {
    console.log('\n❌ 错误！这应该是合法的跟牌');
    console.log('   首家出5张，跟牌者也出5张最大的单张');
  }
}

