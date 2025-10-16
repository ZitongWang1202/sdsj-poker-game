/**
 * 测试跨花色否定bug修复：副牌不能跨花色压过
 */

const ShandongUpgradeGame = require('./src/models/ShandongUpgradeGame');
const Player = require('./src/models/Player');
const Card = require('./src/models/Card');

function createCard(suit, rank, deckNumber = 0) {
  return new Card(suit, rank, deckNumber);
}

console.log('========== 测试：副牌不能跨花色否定 ==========\n');

// 先创建4个玩家
const players = [];
for (let i = 0; i < 4; i++) {
  const player = new Player(`socket${i}`, `玩家${i}`, i);
  players.push(player);
}

// 创建游戏（传入玩家）
const game = new ShandongUpgradeGame(players);

// 设置游戏状态（主牌为黑桃spades）
game.currentLevel = 2;
game.trumpSuit = 'spades';  // 黑桃为主
game.gamePhase = 'playing';
game.dealer = 0;

// 设置玩家手牌
// 玩家0（首家）：副牌hearts K、10、9（甩牌3张单张）
game.players[0].cards = [
  createCard('hearts', 'K', 0),
  createCard('hearts', '10', 0),
  createCard('hearts', '9', 0)
];

// 玩家1：副牌clubs A（不同花色）+ 其他牌
game.players[1].cards = [
  createCard('clubs', 'A', 0),  // 梅花A不应该能否定红桃9
  createCard('clubs', 'K', 0),
  createCard('diamonds', 'Q', 0),
  createCard('diamonds', 'J', 0)
];

// 玩家2：副牌hearts A（同花色）
game.players[2].cards = [
  createCard('hearts', 'A', 0),  // 红桃A应该能否定红桃9
  createCard('hearts', 'Q', 0),
  createCard('diamonds', '10', 0)
];

// 玩家3：主牌
game.players[3].cards = [
  createCard('spades', 'K', 0),
  createCard('spades', 'Q', 0),
  createCard('spades', 'J', 0)
];

console.log('📋 设置：');
console.log('  主牌：黑桃spades');
console.log('  玩家0甩牌：红桃hearts K、10、9（3张单张）');
console.log('  玩家1手牌：梅花clubs A、K + 方块diamonds Q、J（不同花色）');
console.log('  玩家2手牌：红桃hearts A、Q + 方块diamonds 10（同花色）');
console.log('  玩家3手牌：黑桃spades K、Q、J（主牌）\n');

// 玩家0甩牌
console.log('👤 玩家0甩牌：红桃hearts K、10、9');
game.currentTurn = 0;
const leadResult = game.validatePlayCards(0, [
  createCard('hearts', 'K', 0),
  createCard('hearts', '10', 0),
  createCard('hearts', '9', 0)
]);

if (leadResult.valid) {
  console.log('✅ 甩牌验证通过:', leadResult.cardType.name);
  game.roundCards = [{
    playerId: 0,
    cards: game.players[0].cards.slice(0, 3),
    playerName: '玩家0',
    cardType: leadResult.cardType
  }];
  
  console.log('\n🔍 检查甩牌是否会被否定...\n');
  
  // 测试修复：检查玩家1（梅花A）是否能否定
  const player1CanBeat = game.canBeatSingle(game.players[1].cards, [createCard('hearts', '9', 0)]);
  console.log('🧪 测试1：玩家1的梅花A能否定红桃9？');
  if (player1CanBeat) {
    console.log('  ❌ 错误！梅花A不应该能否定红桃9（跨花色）');
  } else {
    console.log('  ✅ 正确！梅花A不能否定红桃9（跨花色）');
  }
  
  // 测试修复：检查玩家2（红桃A）是否能否定
  const player2CanBeat = game.canBeatSingle(game.players[2].cards, [createCard('hearts', '9', 0)]);
  console.log('\n🧪 测试2：玩家2的红桃A能否定红桃9？');
  if (player2CanBeat) {
    console.log('  ✅ 正确！红桃A能否定红桃9（同花色）');
  } else {
    console.log('  ❌ 错误！红桃A应该能否定红桃9（同花色）');
  }
  
  // 测试修复：检查玩家3（主牌）是否能否定
  const player3CanBeat = game.canBeatSingle(game.players[3].cards, [createCard('hearts', '9', 0)]);
  console.log('\n🧪 测试3：玩家3的主牌黑桃能否定副牌红桃9？');
  if (player3CanBeat) {
    console.log('  ❌ 错误！主牌不应该能否定副牌（主副牌类型不同）');
  } else {
    console.log('  ✅ 正确！主牌不能否定副牌（主副牌类型不同）');
  }
  
} else {
  console.log('❌ 甩牌验证失败:', leadResult.message);
}

console.log('\n========== 测试完成 ==========');
console.log('\n📊 总结：');
console.log('  在升级扑克中：');
console.log('  1. 副牌只能被同花色的副牌压过');
console.log('  2. 主牌可以跨花色比较（因为主牌属于同一系统）');
console.log('  3. 主副牌之间不能互相压过');

