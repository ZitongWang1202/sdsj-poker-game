const ShandongUpgradeGame = require('./ShandongUpgradeGame');
const Card = require('./Card');

function makePlayer(name) {
  return { name, cards: [], receiveCards(cards){ this.cards = cards; }, playCardsByIds(ids){ const set=new Set(ids); const out=this.cards.filter(c=>set.has(c.id)); this.cards=this.cards.filter(c=>!set.has(c.id)); return out; } };
}

function createGameWithHands(hands, opts={}){
  const players = [makePlayer('P0'), makePlayer('P1'), makePlayer('P2'), makePlayer('P3')];
  const game = new ShandongUpgradeGame(players, false, null);
  game.players.forEach((p,i)=>p.receiveCards(hands[i] || []));
  if (opts.level) game.currentLevel = opts.level;
  if (opts.trumpSuit) game.trumpSuit = opts.trumpSuit;
  if (opts.trumpPlayer !== undefined) game.trumpPlayer = opts.trumpPlayer;
  game.gamePhase = 'playing';
  game.currentTurn = opts.currentTurn ?? 0;
  return game;
}

function c(suit, rank, deck=0){ return new Card(suit, rank, deck); }

describe('ShandongUpgradeGame follow rules (no mixed)', () => {
  test('single: must follow suit when enough', () => {
    const lead = [c('spades','A')];
    const follower = [c('spades','K'), c('hearts','A')];
    const hands = [lead, follower, [], []];
    const game = createGameWithHands(hands, { level: 2, trumpSuit: 'hearts', trumpPlayer: 0, currentTurn: 0 });
    // lead
    let r1 = game.playCardsByIds(0, lead.map(x=>x.id));
    expect(r1.success).toBe(true);
    // follow try off-suit should fail
    const off = [hands[1][1]]; // hearts A (trump)
    const r2 = game.validatePlayCards(1, off);
    expect(r2.valid).toBe(false);
    // follow on-suit ok
    const on = [hands[1][0]]; // spades K
    const r3 = game.validatePlayCards(1, on);
    expect(r3.valid).toBe(true);
  });

  test('pair: must play pair if has pair in suit; else two highest singles in suit', () => {
    const lead = [c('clubs','Q'), c('clubs','Q')];
    const follower = [c('clubs','J'), c('clubs','J'), c('clubs','10')];
    const hands = [lead, follower, [], []];
    const game = createGameWithHands(hands, { level: 2, trumpSuit: 'hearts', trumpPlayer: 0, currentTurn: 0 });
    // lead
    game.playCardsByIds(0, lead.map(x=>x.id));
    // follower has pair -> must play pair
    let r = game.validatePlayCards(1, follower.slice(0,2));
    expect(r.valid).toBe(true);
    // using two singles should fail
    r = game.validatePlayCards(1, [follower[0], follower[2]]);
    expect(r.valid).toBe(false);
  });

  test('consecutive pairs: off-suit cannot kill unless trump same-type same-count', () => {
    const lead = [c('spades','Q'),c('spades','Q'),c('spades','J'),c('spades','J')];
    // follower has no spades, tries four trump singles -> allowed as discard but cannot be qualified kill
    const follower = [c('hearts','A'),c('hearts','A'),c('hearts','K'),c('hearts','K')]; // trump pairs
    const hands = [lead, follower, [], []];
    const game = createGameWithHands(hands, { level: 2, trumpSuit: 'hearts', trumpPlayer: 0, currentTurn: 0 });
    game.playCardsByIds(0, lead.map(x=>x.id));
    // valid follow with trump consecutive pairs (same-type same-count) -> should be valid
    let r = game.validatePlayCards(1, follower);
    expect(r.valid).toBe(true);
  });

  test('straight (rain): same suit, >=5, contiguous, no level/2/3/5/joker', () => {
    const lead = [c('spades','A'),c('spades','K'),c('spades','Q'),c('spades','J'),c('spades',10)];
    const follower = [c('spades','A'),c('spades','K'),c('spades','Q'),c('spades','J'),c('spades',10)];
    const hands = [lead, follower, [], []];
    const game = createGameWithHands(hands, { level: 9, trumpSuit: 'hearts', trumpPlayer: 0, currentTurn: 0 });
    game.playCardsByIds(0, lead.map(x=>x.id));
    const r = game.validatePlayCards(1, follower);
    expect(r.valid).toBe(true);
  });

  test('flash/thunder: only level or 2/3/5 with four suits', () => {
    const lead = [c('hearts',9),c('spades',9),c('diamonds',9),c('clubs',9)];
    const follower = [c('hearts',9),c('spades',9),c('diamonds',9),c('clubs',9)];
    const hands = [lead, follower, [], []];
    const game = createGameWithHands(hands, { level: 9, trumpSuit: 'hearts', trumpPlayer: 0, currentTurn: 0 });
    game.playCardsByIds(0, lead.map(x=>x.id));
    const r = game.validatePlayCards(1, follower);
    expect(r.valid).toBe(true);
  });
});


describe('ShandongUpgradeGame mixed mandatory combo gaps', () => {
  test('flash/straight gaps are filled by max singles (singlesForPairs)', () => {
    const game = createGameWithHands([[],[],[],[]], { level: 9, trumpSuit: 'hearts' });
    // 构造首家甩牌(混合)：包含5张同点数的主牌(9，四花色+1张同点数主花色普通牌)
    const leadCards = [
      c('hearts', 9), c('spades', 9), c('diamonds', 9), c('clubs', 9), // 4张同点数主牌（满足闪/震能力统计）
      c('hearts', 'K') // 额外一张打破flash识别，确保identify为mixed
    ];
    const leadAnalysis = game.analyzeMixedCards(leadCards);

    // 构造可用牌：只有2张可用于闪/震的同点数主牌，其余为若干主牌单张
    const available = [
      c('spades', 9), c('diamonds', 9), // 只能覆盖2张，缺口=2
      c('hearts', 'A'), c('hearts', 'Q'), c('hearts', 'J') // 用于作为最大单张
    ];
    // 为了统一排序逻辑，模拟同一玩家在"trump"花色集合内
    const sortedAvailable = [...available];
    const availableAnalysis = game.analyzeMixedCards(sortedAvailable);

    const combo = game.buildMandatoryMixedCombo(leadAnalysis, availableAnalysis, sortedAvailable);
    // 闪缺口=2，应全部体现在 singlesForPairs (最大单张) 中
    expect(combo.singlesForPairs.length).toBeGreaterThanOrEqual(2);
    // 单张单位数量不受本例影响，为0
    expect(combo.singlesFlexibleCount).toBe(0);
  });

  test('consecutive pairs gap: use pairs first then max singles for remaining', () => {
    const game = createGameWithHands([[],[],[],[]], { level: 2, trumpSuit: 'spades' });
    // 首家甩牌(混合)中含3连对能力（例如 ♥66 ♥77 ♥88 与一些杂牌，确保为mixed）
    const leadCards = [c('hearts',6),c('hearts',6),c('hearts',7),c('hearts',7),c('hearts',8),c('hearts',8), c('hearts','A')];
    const leadAnalysis = game.analyzeMixedCards(leadCards);

    // 可用牌只有2对能组成连对（缺1对），且没有额外对子可用来补这1对 -> 需要用2张最大单张补
    const available = [c('hearts',6),c('hearts',6), c('hearts',7),c('hearts',7), c('hearts','K'), c('hearts','Q')];
    const sortedAvailable = [...available];
    const availableAnalysis = game.analyzeMixedCards(sortedAvailable);

    const combo = game.buildMandatoryMixedCombo(leadAnalysis, availableAnalysis, sortedAvailable);
    // 需要的对子数量 >=2，对子缺口按2张/对用最大单张补
    expect(combo.pairs.length).toBe(2);
    expect(combo.singlesForPairs.length).toBeGreaterThanOrEqual(2); // 至少为缺口1对 * 2张
  });

  test('single units from lead are flexible-count only (not forced max)', () => {
    const game = createGameWithHands([[],[],[],[]], { level: 2, trumpSuit: 'hearts' });
    // 首家甩牌(混合)：仅3张同花色副牌单张 + 杂牌，确保为mixed
    const leadCards = [c('spades','A'), c('spades','K'), c('spades','Q'), c('hearts','K')];
    const leadAnalysis = game.analyzeMixedCards(leadCards);

    // 可用牌：提供足够多的本门花色单张
    const available = [c('spades','J'), c('spades',10), c('spades',9), c('spades',8)];
    const sortedAvailable = [...available];
    const availableAnalysis = game.analyzeMixedCards(sortedAvailable);

    const combo = game.buildMandatoryMixedCombo(leadAnalysis, availableAnalysis, sortedAvailable);
    // singlesFlexibleCount 应等于首家单张单位数量（本例为3）
    expect(combo.singlesFlexibleCount).toBeGreaterThanOrEqual(3);
    // 不涉及对子/高阶缺口，singlesForPairs 应为0
    expect(combo.singlesForPairs.length).toBe(0);
  });

  test('lead mixed cards: forced play when beaten by others', () => {
    const game = new ShandongUpgradeGame();
    game.players = [
      { id: 0, name: 'Player1', cards: [] },
      { id: 1, name: 'Player2', cards: [
        { suit: 'hearts', rank: 'A' },
        { suit: 'hearts', rank: 'A' },
        { suit: 'hearts', rank: 'K' },
        { suit: 'hearts', rank: 'Q' }
      ] },
      { id: 2, name: 'Player3', cards: [] },
      { id: 3, name: 'Player4', cards: [] }
    ];
    game.currentLevel = 2;
    game.trumpSuit = 'hearts';
    game.gamePhase = 'playing';
    game.roundCards = [];

    // 首家尝试甩牌：红桃K + 红桃Q + 红桃J（3张单张）
    const leadMixed = [
      { suit: 'hearts', rank: 'K' },
      { suit: 'hearts', rank: 'Q' },
      { suit: 'hearts', rank: 'J' }
    ];

    const result = game.judgeLeadMixedAndForce(leadMixed, 0);
    
    // 应该被强制出牌，因为Player2有更大的单张A
    expect(result.shouldForce).toBe(true);
    expect(result.forcedCards).toEqual([{ suit: 'hearts', rank: 'J' }]);
    expect(result.forcedCardType.type).toBe('single');
  });
});



