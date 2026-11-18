import test from 'node:test';
import assert from 'node:assert/strict';

import { applyAction, getView, legalActions, defaultAction, currentActor, GameError } from '../src/engine/Game.js';
import { CHARACTERS, TILES, CARDS, TILES_BY_ID, DECK_IDS } from '../src/data/index.js';
import { DIE_FACES, rollDice } from '../src/engine/dice.js';
import { validRotations, hasDoor, opposite, tileAt } from '../src/engine/board.js';
import { enqueue, runQueue } from '../src/engine/effects.js';
import { HAUNTS } from '../src/haunts/index.js';
import { loadSchema, validate } from '../test-support/miniSchema.js';
import { makeRng, newGame, botStep, playUntil, actorOf } from '../test-support/bot.js';

const gameStateSchema = loadSchema('gameState');

test('dữ liệu tĩnh khớp JSON Schema', () => {
  const cases = [['character', CHARACTERS], ['roomTile', TILES], ['card', CARDS]];
  for (const [name, list] of cases) {
    const schema = loadSchema(name);
    for (const entry of list) assert.deepEqual(validate(schema, entry), [], `${name} ${entry.id}`);
  }
});

test('dữ liệu tĩnh nhất quán', () => {
  for (const tile of TILES) {
    for (const link of tile.links ?? []) assert.ok(TILES_BY_ID[link], `${tile.id} nối tới gạch không tồn tại ${link}`);
    assert.equal(new Set(tile.doors).size, tile.doors.length, `${tile.id} có cửa trùng`);
  }
  const omenTiles = TILES.filter((t) => t.symbol === 'omen').length;
  assert.ok(DECK_IDS.omen.length >= omenTiles, 'số thẻ Omen phải >= số phòng Omen');
  assert.ok(CHARACTERS.length >= 6);
});

test('xúc xắc: 8 viên, mặt 0/1/2', () => {
  assert.deepEqual([...DIE_FACES].sort(), [0, 0, 1, 1, 2, 2]);
  const state = { rngState: 42, rules: { maxDice: 8 } };
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const r = rollDice(state, 20);
    assert.equal(r.dice.length, 8, 'không bao giờ đổ quá 8 viên');
    assert.equal(r.total, r.dice.reduce((a, b) => a + b, 0));
    r.dice.forEach((d) => seen.add(d));
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2]);
  assert.deepEqual(rollDice(state, 0), { dice: [], total: 0 });
});

test('góc xoay hợp lệ: gạch phải có cửa nối về phòng vừa rời', () => {
  // Gạch chỉ có cửa Bắc, người chơi đi về hướng Đông -> cần cửa Tây -> xoay 3 nấc.
  assert.deepEqual(validRotations({ doors: [0] }, 1), [3]);
  // Cửa Bắc + Nam, đi về hướng Bắc -> cần cửa Nam -> xoay 0 hoặc 2.
  assert.deepEqual(validRotations({ doors: [0, 2] }, 0), [0, 2]);
  assert.deepEqual(validRotations({ doors: [0, 1, 2, 3] }, 2), [0, 1, 2, 3]);
});

test('khởi tạo ván: gạch khởi đầu, vị trí, trạng thái khớp schema', () => {
  const state = newGame(4, 7);
  assert.deepEqual(validate(gameStateSchema, state), []);
  assert.equal(Object.keys(state.board.tiles).length, 5);
  for (const p of Object.values(state.players)) assert.deepEqual(p.pos, { floor: 'ground', x: 0, y: 0 });
  assert.equal(state.tileStack.length, TILES.length - 5);
  assert.throws(() => newGame(2, 1, { minPlayers: 3 }), GameError);
});

test('khám phá phòng: rút gạch, kiểm tra góc xoay, đặt gạch, kết thúc lượt', () => {
  const state = newGame(3, 11);
  const me = state.turn.playerId;
  const discover = legalActions(state, me).find((a) => a.type === 'move' && a.discover);
  assert.ok(discover, 'Sảnh vào phải có cửa chưa mở');
  applyAction(state, me, discover);

  const pending = state.pending;
  assert.equal(pending.type, 'placeTile');
  assert.ok(TILES_BY_ID[pending.tileId].floors.includes('ground'), 'gạch rút phải đặt được ở tầng trệt');
  const bad = [0, 1, 2, 3].find((r) => !pending.validRotations.includes(r));
  if (bad !== undefined) assert.throws(() => applyAction(state, me, { type: 'placeTile', rotation: bad }), GameError);
  // Người khác không được đặt hộ, và không ai làm gì khác được khi đang chờ.
  const other = state.turnOrder.find((id) => id !== me);
  assert.throws(() => applyAction(state, other, { type: 'placeTile', rotation: pending.validRotations[0] }), GameError);
  assert.throws(() => applyAction(state, me, { type: 'endTurn' }), GameError);

  applyAction(state, me, { type: 'placeTile', rotation: pending.validRotations[0] });
  const placed = state.board.tiles[`ground:${pending.x}:${pending.y}`];
  assert.equal(placed.tileId, pending.tileId);
  assert.ok(hasDoor(placed, opposite(pending.fromDir)), 'gạch mới phải có cửa quay về phòng cũ');
  assert.deepEqual(state.players[me].pos, { floor: 'ground', x: pending.x, y: pending.y });

  // Giải quyết nốt các lần đổ/chọn do thẻ gây ra; sau đó lượt phải chuyển cho người khác.
  const rand = makeRng(1);
  while (state.pending) botStep(state, rand);
  if (!state.winner) assert.notEqual(state.turn.playerId, me, 'khám phá phòng mới kết thúc lượt');
});

test('cầu thang nối các tầng', () => {
  const state = newGame(3, 3);
  const me = state.turn.playerId;
  state.players[me].pos = { floor: 'ground', x: 0, y: -2 };
  state.turn.movesLeft = 3;
  applyAction(state, me, { type: 'move', linkTo: 'upper-landing' });
  assert.deepEqual(state.players[me].pos, { floor: 'upper', x: 0, y: 0 });
  applyAction(state, me, { type: 'move', linkTo: 'grand-staircase' });
  applyAction(state, me, { type: 'move', linkTo: 'basement-landing' });
  assert.equal(state.players[me].pos.floor, 'basement');
  assert.equal(state.turn.movesLeft, 0);
  assert.throws(() => applyAction(state, me, { type: 'move', linkTo: 'grand-staircase' }), /hết bước/);
});

test('trước Haunt không ai chết: chỉ số dừng ở nấc thấp nhất', () => {
  const state = newGame(3, 5);
  const me = state.turn.playerId;
  enqueue(state, [{ op: 'damage', type: 'general', amount: 99, playerId: me }]);
  runQueue(state);
  const p = state.players[me];
  assert.equal(state.pending, null);
  assert.ok(p.alive);
  assert.deepEqual(p.traits, { speed: 0, might: 0, sanity: 0, knowledge: 0 });
});

test('sát thương: người chịu tự chia, đúng loại chỉ số và đúng tổng', () => {
  const state = newGame(3, 5);
  const me = state.turn.playerId;
  const before = { ...state.players[me].traits };
  enqueue(state, [{ op: 'damage', type: 'physical', amount: 2, playerId: me }]);
  runQueue(state);
  assert.equal(state.pending.type, 'allocateDamage');
  assert.deepEqual(state.pending.traits, ['speed', 'might']);
  assert.throws(() => applyAction(state, me, { type: 'allocateDamage', allocation: { sanity: 2 } }), GameError);
  assert.throws(() => applyAction(state, me, { type: 'allocateDamage', allocation: { speed: 1 } }), GameError);
  applyAction(state, me, { type: 'allocateDamage', allocation: { speed: 1, might: 1 } });
  assert.equal(state.players[me].traits.speed, before.speed - 1);
  assert.equal(state.players[me].traits.might, before.might - 1);
  assert.equal(state.players[me].traits.sanity, before.sanity);
});

test('Haunt Roll: số xúc xắc = số Omen đã lật, đạt ngưỡng thì Haunt bắt đầu', () => {
  // Ngưỡng 0: Omen đầu tiên chắc chắn kích hoạt Haunt.
  const always = newGame(4, 21, { hauntRollThreshold: 0 });
  playUntil(always, makeRng(21), (s) => s.omensRevealed > 0);
  assert.equal(always.omensRevealed, 1);
  assert.notEqual(always.phase, 'explore');
  assert.equal(always.haunt.id, 'haunt-01');
  assert.equal(always.haunt.traitorId, always.haunt.revealerId);

  // Ngưỡng không thể đạt: không bao giờ có Haunt, và mỗi lần rút Omen đổ đúng số xúc xắc.
  const never = newGame(4, 22, { hauntRollThreshold: 99 });
  const rand = makeRng(22);
  let checked = 0;
  let lastSeq = 0;
  for (let i = 0; i < 6000 && never.omensRevealed < 6; i++) {
    botStep(never, rand);
    const roll = never.lastRoll;
    if (roll?.kind === 'haunt' && roll.seq !== lastSeq) {
      lastSeq = roll.seq;
      assert.equal(roll.dice.length, never.omensRevealed, 'số xúc xắc phải bằng số Omen đã lật');
      assert.equal(roll.triggered, false);
      checked += 1;
    }
  }
  assert.ok(checked >= 3, `chỉ kiểm tra được ${checked} lần Haunt Roll`);
  assert.equal(never.phase, 'explore');

  // Mặc định là 5+ theo luật 3rd Edition.
  assert.equal(newGame(3, 1).rules.hauntRollThreshold, 5);
});

function gameInHaunt(seed, players = 4) {
  const state = newGame(players, seed, { hauntRollThreshold: 0, forcedHauntId: 'haunt-01' });
  // Chơi tới khi Haunt bắt đầu và lượt mới (sau Haunt) đã mở.
  playUntil(state, makeRng(seed), (s) => s.phase === 'haunt' && !s.pending && !s.haunt.pendingFirstTurn);
  assert.equal(state.phase, 'haunt');
  return state;
}

test('Haunt: phân phe, quái vật xuất hiện, lượt đầu thuộc về người bên trái Traitor', () => {
  const state = gameInHaunt(31);
  const { traitorId } = state.haunt;
  assert.equal(state.players[traitorId].side, 'traitor');
  const heroes = Object.values(state.players).filter((p) => p.side === 'hero');
  assert.equal(heroes.length, 3);
  assert.equal(Object.keys(state.monsters).length, 2);
  for (const m of Object.values(state.monsters)) assert.deepEqual(m.pos, { floor: 'basement', x: 0, y: 0 });
  const order = state.turnOrder;
  assert.equal(state.turn.playerId, order[(order.indexOf(traitorId) + 1) % order.length]);
});

test('thông tin mật: mỗi phe chỉ nhận cuốn sách của mình, không lộ chồng bài hay RNG', () => {
  const state = gameInHaunt(32);
  const haunt = HAUNTS['haunt-01'];
  const { traitorId } = state.haunt;
  const heroId = state.turnOrder.find((id) => id !== traitorId);

  const traitorView = getView(state, traitorId);
  const heroView = getView(state, heroId);
  const spectatorView = getView(state, 'không-tồn-tại');

  assert.equal(traitorView.haunt.book.kind, 'traitorTome');
  assert.equal(heroView.haunt.book.kind, 'survivalSecrets');
  assert.equal(spectatorView.haunt.book, null);

  const heroJson = JSON.stringify(heroView);
  const traitorJson = JSON.stringify(traitorView);
  assert.ok(!heroJson.includes(haunt.traitorTome.objective));
  assert.ok(!heroJson.includes(haunt.traitorTome.story));
  assert.ok(!traitorJson.includes(haunt.survivalSecrets.objective));
  assert.ok(!traitorJson.includes(haunt.survivalSecrets.story));

  for (const view of [traitorView, heroView, spectatorView]) {
    for (const secret of ['rngState', 'tileStack', 'decks', 'queue', 'discards']) {
      assert.ok(!(secret in view), `view không được chứa ${secret}`);
    }
    assert.ok(!('index' in view.board));
  }
  assert.deepEqual(spectatorView.legal, []);
});

test('chiến đấu: Vong hồn chỉ bị đánh bằng Tinh thần; thua thì người chơi chịu sát thương', () => {
  const state = gameInHaunt(33);
  const heroId = state.turn.playerId;
  const hero = state.players[heroId];
  assert.equal(hero.side, 'hero');
  const wraith = Object.values(state.monsters)[0];
  wraith.pos = { ...hero.pos };

  const attacks = legalActions(state, heroId).filter((a) => a.type === 'attack' && a.targetType === 'monster');
  assert.ok(attacks.length >= 1);
  assert.ok(attacks.every((a) => a.trait === 'sanity'));
  assert.throws(
    () => applyAction(state, heroId, { type: 'attack', targetType: 'monster', targetId: wraith.id, trait: 'might' }),
    GameError,
  );

  const sanityBefore = hero.traits.sanity + hero.traits.knowledge;
  applyAction(state, heroId, attacks[0]);
  const roll = state.lastRoll;
  assert.equal(roll.kind, 'combat');
  assert.equal(roll.defender.dice.length, wraith.traits.sanity);
  while (state.pending) botStep(state, makeRng(2));
  const after = state.players[heroId];
  const diff = roll.attacker.total - roll.defender.total;
  if (diff > 0) assert.equal(state.monsters[wraith.id].stunned, true);
  if (diff < 0 && after.alive) {
    assert.equal(after.traits.sanity + after.traits.knowledge, sanityBefore + diff, 'sát thương tinh thần = phần chênh');
  }
  if (diff === 0) assert.equal(state.monsters[wraith.id].stunned, false);
  assert.throws(() => applyAction(state, heroId, attacks[0]), GameError, 'mỗi lượt chỉ tấn công một lần');
});

test('Haunt #1: yểm bùa đủ số phòng thì người sống sót thắng', () => {
  const state = gameInHaunt(34);
  const heroId = state.turn.playerId;
  const hero = state.players[heroId];
  const omenTiles = Object.values(state.board.tiles).filter((t) => TILES_BY_ID[t.tileId].symbol === 'omen');
  assert.ok(omenTiles.length >= 1);
  const spot = omenTiles[0];
  hero.pos = { floor: spot.floor, x: spot.x, y: spot.y };
  hero.traits.knowledge = 7; // 8 xúc xắc: gần như chắc chắn đạt 4+
  state.haunt.data.sealsRequired = 1;

  const seal = legalActions(state, heroId).find((a) => a.type === 'special' && a.trait === 'knowledge');
  assert.ok(seal, 'phải có hành động Yểm bùa');
  for (let attempt = 0; attempt < 20 && !state.winner; attempt++) {
    state.turn.usedSpecial = false;
    applyAction(state, heroId, seal);
    assert.equal(state.pending.type, 'roll');
    applyAction(state, heroId, { type: 'roll' });
    while (state.pending) botStep(state, makeRng(3));
  }
  assert.deepEqual(state.winner?.side, 'heroes');
  assert.equal(state.phase, 'ended');
  assert.equal(tileAt(state, hero.pos).sealed, true);
  assert.throws(() => applyAction(state, heroId, { type: 'endTurn' }), /kết thúc/);
});

test('Haunt #1: mọi người sống sót chết thì Traitor thắng; đồ rơi lại trong phòng', () => {
  const state = gameInHaunt(35);
  const heroes = Object.values(state.players).filter((p) => p.side === 'hero');
  heroes[0].cards.push('it-fire-axe');
  const where = { ...heroes[0].pos };
  enqueue(state, heroes.map((h) => ({ op: 'damage', type: 'general', amount: 99, playerId: h.id })));
  runQueue(state);
  assert.ok(heroes.every((h) => !state.players[h.id].alive));
  assert.equal(state.winner.side, 'traitor');
  assert.ok(tileAt(state, where).items.includes('it-fire-axe'));
});

test('hành động không hợp lệ không làm thay đổi state', () => {
  const state = newGame(3, 9);
  const snapshot = JSON.stringify(state);
  const me = state.turn.playerId;
  const other = state.turnOrder.find((id) => id !== me);
  const bad = [
    [other, { type: 'endTurn' }],
    [me, { type: 'move', dir: 2 }],
    [me, { type: 'move', dir: 9 }],
    [me, { type: 'attack', targetType: 'player', targetId: other }],
    [me, { type: 'useItem', cardId: 'it-first-aid' }],
    [me, { type: 'constructor' }],
    [me, { type: 'monsterMove', monsterId: 'x', dir: 0 }],
    [me, null],
    ['ai-đó', { type: 'endTurn' }],
  ];
  for (const [who, action] of bad) {
    assert.throws(() => applyAction(state, who, action), GameError, JSON.stringify(action));
    assert.equal(JSON.stringify(state), snapshot);
  }
});

test('mô phỏng: 300 ván với bot ngẫu nhiên chạy từ đầu tới khi phân thắng thua', () => {
  const wins = { heroes: 0, traitor: 0 };
  let unfinished = 0;
  let totalSteps = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const playerCount = 3 + (seed % 4);
    let state = newGame(playerCount, seed, { minPlayers: 3 });
    const rand = makeRng(seed * 7919);
    let steps = 0;
    while (!state.winner && steps < 30000) {
      const { actor, action } = botStep(state, rand);
      steps += 1;
      if (steps % 25 === 0) {
        const errors = validate(gameStateSchema, state);
        assert.deepEqual(errors, [], `seed ${seed} bước ${steps} sau ${JSON.stringify(action)} của ${actor}`);
        // State phải sống sót qua JSON (yêu cầu để chuyển sang Redis).
        state = JSON.parse(JSON.stringify(state));
      }
      assert.ok(actorOf(state) in state.players);
    }
    totalSteps += steps;
    if (state.winner) wins[state.winner.side] += 1;
    else unfinished += 1;
    assert.deepEqual(validate(gameStateSchema, state), [], `seed ${seed} trạng thái cuối`);
  }
  console.log(`    kết quả mô phỏng: người sống sót thắng ${wins.heroes}, Traitor thắng ${wins.traitor}, ` +
    `chưa xong ${unfinished}, trung bình ${Math.round(totalSteps / 300)} hành động/ván`);
  assert.equal(unfinished, 0, 'mọi ván phải kết thúc');
  assert.ok(wins.heroes > 0 && wins.traitor > 0, 'cả hai phe đều phải có khả năng thắng');
});

test('defaultAction luôn là một hành động hợp lệ và không làm kẹt ván', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const state = newGame(3 + (seed % 4), seed, { minPlayers: 3 });
    const rand = makeRng(seed);
    for (let step = 0; step < 20000 && !state.winner; step++) {
      const actor = currentActor(state);
      const legal = legalActions(state, actor);
      if (rand() < 0.3) {
        const action = defaultAction(state, actor);
        assert.ok(legal.some((a) => JSON.stringify(a) === JSON.stringify(action)), JSON.stringify(action));
        applyAction(state, actor, action);
      } else {
        applyAction(state, actor, legal[Math.floor(rand() * legal.length)]);
      }
    }
    assert.ok(state.winner, `seed ${seed} chưa kết thúc`);
  }
});
