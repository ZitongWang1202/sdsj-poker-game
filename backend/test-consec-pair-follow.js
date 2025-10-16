/**
 * 测试连对跟牌场景：首家JJQQA，跟牌者88764
 */

const ShandongUpgradeGame = require('./src/models/ShandongUpgradeGame');
const Player = require('./src/models/Player');
const Card = require('./src/models/Card');

function createCard(suit, rank, deckNumber = 0) {
  return new Card(suit, rank, deckNumber);
}

console.log('========== 测试：首家出连对JJQQA，跟牌者88764 ==========\n');

// 先创建4个玩家
const players = [];
for (let i = 0; i < 4; i++) {
  const player = new Player(`socket${i}`, `玩家${i}`, i);
  players.push(player);
}

// 创建游戏（传入玩家）
const game = new ShandongUpgradeGame(players);

// 设置游戏状态
game.currentLevel = 2;
game.trumpSuit = 'spades';
game.gamePhase = 'playing';
game.dealer = 0;

// 设置玩家手牌
// 玩家0（首家）：黑桃JJQQA
game.players[0].cards = [
  createCard('spades', 'J', 0),
  createCard('spades', 'J', 1),
  createCard('spades', 'Q', 0),
  createCard('spades', 'Q', 1),
  createCard('spades', 'A', 0)
];

// 玩家1（跟牌者）：黑桃88764
game.players[1].cards = [
  createCard('spades', '8', 0),
  createCard('spades', '8', 1),
  createCard('spades', '7', 0),
  createCard('spades', '6', 0),
  createCard('spades', '4', 0)
];

// 其他玩家随便设置
game.players[2].cards = [
  createCard('hearts', 'K', 0),
  createCard('hearts', 'K', 1),
  createCard('hearts', 'Q', 0),
  createCard('hearts', 'J', 0),
  createCard('hearts', '10', 0)
];

game.players[3].cards = [
  createCard('clubs', '9', 0),
  createCard('clubs', '9', 1),
  createCard('clubs', '8', 0),
  createCard('clubs', '7', 0),
  createCard('clubs', '6', 0)
];

// 玩家0领牌
console.log('👤 玩家0领牌：黑桃JJQQA（连对+单张）');
game.currentTurn = 0;
const leadResult = game.validatePlayCards(0, [
  createCard('spades', 'J', 0),
  createCard('spades', 'J', 1),
  createCard('spades', 'Q', 0),
  createCard('spades', 'Q', 1),
  createCard('spades', 'A', 0)
]);

if (leadResult.valid) {
  console.log('✅ 领牌成功:', leadResult.cardType.name);
  game.roundCards = [{
    playerId: 0,
    cards: game.players[0].cards.slice(0, 5),
    playerName: '玩家0',
    cardType: leadResult.cardType
  }];
} else {
  console.log('❌ 领牌失败:', leadResult.message);
  process.exit(1);
}

console.log('\n👤 玩家1跟牌：黑桃88764（1对+3单张）');
game.currentTurn = 1;
const followResult = game.validatePlayCards(1, [
  createCard('spades', '8', 0),
  createCard('spades', '8', 1),
  createCard('spades', '7', 0),
  createCard('spades', '6', 0),
  createCard('spades', '4', 0)
]);

console.log('\n📊 跟牌验证结果:');
if (followResult.valid) {
  console.log('✅ 跟牌成功！');
  console.log('   牌型:', followResult.cardType.name);
  console.log('   说明: 手上有1对，出1对+3单张补齐，符合规则');
} else {
  console.log('❌ 跟牌失败！');
  console.log('   原因:', followResult.message);
  console.log('   错误: 系统应该接受这个跟牌（1对+3单张）');
}

console.log('\n========== 测试完成 ==========');

