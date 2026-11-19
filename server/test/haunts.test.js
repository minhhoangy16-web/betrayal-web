import { posKey } from '../src/engine/board.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, currentActor, getView } from '../src/engine/Game.js';
import { HAUNTS } from '../src/haunts/index.js';
import { makeRng, newGame } from '../test-support/bot.js';
import { smartAction } from '../test-support/smartBot.js';
import { loadSchema, validate } from '../test-support/miniSchema.js';
import { posOf } from '../src/haunts/helpers.js';

const schema = loadSchema('gameState');

function play(hauntId, seed, players) {
  const s = newGame(players, seed, { minPlayers: 3, hauntRollThreshold: 99, forcedHauntId: hauntId });
  const rand = makeRng(seed * 7);
  let n = 0;
  while (!s.winner && n < 20000) {
    if (s.phase === 'explore' && s.round >= 4 && !s.pending) s.rules.hauntRollThreshold = 0;
    const actor = currentActor(s);
    const act = smartAction(s, actor, rand);
    assert.ok(act, `${hauntId} seed ${seed}: không có hành động hợp lệ`);
    applyAction(s, actor, act);
    n++;
    if (n % 150 === 0) {
      assert.deepEqual(validate(schema, s), []);
      for (const id of s.turnOrder) getView(s, id);
    }
  }
  return s;
}

for (const id of Object.keys(HAUNTS)) {
  test(`${id}: ván chơi bằng bot luôn kết thúc và state hợp lệ`, () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = play(id, seed, 3 + (seed % 4));
      if (HAUNTS[id].minPlayers && s.turnOrder.length < HAUNTS[id].minPlayers) continue;
      assert.equal(s.haunt?.id, id);
      assert.ok(s.winner, `${id} seed ${seed} chưa kết thúc`);
      assert.deepEqual(validate(schema, s), []);
    }
  });
}

test('Ma lai: người khác không thấy vị trí thân xác cho tới khi tìm ra', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = newGame(4, seed, { minPlayers: 3, hauntRollThreshold: 99, forcedHauntId: 'haunt-ma-lai' });
    const rand = makeRng(seed);
    while (!s.winner && !(s.haunt && !s.pending)) {
      if (s.round >= 3) s.rules.hauntRollThreshold = 0;
      const a = currentActor(s);
      applyAction(s, a, smartAction(s, a, rand));
    }
    if (!s.haunt || s.winner) continue;
    const traitorId = s.haunt.traitorId;
    const other = s.turnOrder.find((id) => id !== traitorId);
    assert.equal(getView(s, other).players[traitorId].pos, null);
    assert.ok(getView(s, traitorId).players[traitorId].pos);
    const otherMarks = Object.values(getView(s, other).haunt.data.marks ?? {}).flat();
    assert.ok(!otherMarks.some((m) => m.kind === 'body'));
    return;
  }
  assert.fail('không tạo được tình huống kiểm thử');
});

test('Bùa Lỗ Ban: vị trí bùa chỉ Kẻ phản bội thấy', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = newGame(4, seed, { minPlayers: 3, hauntRollThreshold: 99, forcedHauntId: 'haunt-lo-ban' });
    const rand = makeRng(seed);
    while (!s.winner && !(s.haunt && !s.pending)) {
      if (s.round >= 3) s.rules.hauntRollThreshold = 0;
      const a = currentActor(s);
      applyAction(s, a, smartAction(s, a, rand));
    }
    if (!s.haunt || s.winner) continue;
    const traitorId = s.haunt.traitorId;
    const other = s.turnOrder.find((id) => id !== traitorId);
    const charms = (v) => Object.values(v.haunt.data.marks ?? {}).flat().filter((m) => m.kind === 'charm').length;
    assert.ok(charms(getView(s, traitorId)) > 0);
    assert.equal(charms(getView(s, other)), 0);
    assert.ok(!JSON.stringify(getView(s, other)).includes('"charms"'));
    return;
  }
  assert.fail('không tạo được tình huống kiểm thử');
});

test('Trục vong: không ai ngoài Kẻ bị nhập biết danh tính, lựa chọn khi làm lễ được giấu', () => {
  let checkedRite = false;
  for (let seed = 1; seed <= 40 && !checkedRite; seed++) {
    const s = newGame(5, seed, { minPlayers: 3, hauntRollThreshold: 99, forcedHauntId: 'haunt-truc-vong' });
    const rand = makeRng(seed);
    let checkedStart = false;
    for (let n = 0; n < 20000 && !s.winner; n++) {
      if (s.round >= 3 && s.phase === 'explore') s.rules.hauntRollThreshold = 0;
      if (s.haunt && !s.haunt.data.revealed) {
        const traitorId = s.haunt.traitorId;
        for (const id of s.turnOrder.filter((x) => x !== traitorId)) {
          const v = getView(s, id);
          assert.equal(v.haunt.traitorId, null);
          assert.ok(Object.values(v.players).every((p) => p.id === id || p.side === 'unknown'));
          assert.ok(!JSON.stringify(v).includes('"drains"'));
          assert.ok(!v.legal.some((a) => a.actionId === 'drain'));
          if (s.pending?.type === 'choose' && s.pending.playerId !== id) {
            assert.deepEqual(v.pending.options, []);
            checkedRite = true;
          }
        }
        if (!checkedStart) {
          assert.equal(getView(s, traitorId).haunt.traitorId, traitorId);
          checkedStart = true;
        }
      }
      const a = currentActor(s);
      applyAction(s, a, smartAction(s, a, rand));
    }
  }
  assert.ok(checkedRite, 'chưa gặp lần làm lễ nào để kiểm tra');
});

test('Thẻ kịch bản: bảng Haunt đầy đủ, hợp lệ, và kịch bản được chọn khi tạo ván', async () => {
  const { SCENARIOS } = await import('../src/data/scenarios.js');
  const { DECK_IDS } = await import('../src/data/index.js');
  const usedAll = new Set();
  for (const sc of SCENARIOS) {
    assert.deepEqual(Object.keys(sc.table).sort(), [...DECK_IDS.omen].sort(), sc.id);
    const used = new Set();
    for (const [omen, row] of Object.entries(sc.table)) {
      assert.equal(row.length, 2);
      for (const id of row) { assert.ok(HAUNTS[id], `${sc.id}/${omen}: ${id}`); used.add(id); }
      // Kịch bản cần nhiều người phải có phương án thay ở cột còn lại.
      if (row.some((id) => HAUNTS[id].minPlayers)) assert.ok(row.some((id) => !HAUNTS[id].minPlayers), `${sc.id}/${omen}`);
    }
    assert.ok(used.size >= 8, `${sc.id} phải dùng ít nhất 8 Haunt khác nhau`);
    for (const id of used) usedAll.add(id);
    assert.ok(sc.title && sc.story && sc.purpose && sc.tagline);
  }
  // Haunt nào cũng phải có mặt trong ít nhất một thẻ kịch bản.
  assert.equal(usedAll.size, Object.keys(HAUNTS).length);
  const s = newGame(3, 5, { minPlayers: 3 });
  assert.ok(SCENARIOS.some((sc) => sc.id === s.scenarioId));
  assert.equal(getView(s, s.turnOrder[0]).scenarioId, s.scenarioId);
});

test('Trục vong: phải có nhang mới làm lễ được; trao nhang không làm lộ Kẻ bị nhập', () => {
  const s = newGame(4, 11, { minPlayers: 3, hauntRollThreshold: 99, forcedHauntId: 'haunt-truc-vong' });
  const rand = makeRng(11);
  for (let n = 0; n < 20000 && !(s.haunt && !s.pending && s.turn.phase !== 'monsters'); n++) {
    if (s.phase === 'explore' && s.round >= 2 && !s.pending) s.rules.hauntRollThreshold = 0;
    const a = currentActor(s);
    applyAction(s, a, smartAction(s, a, rand));
  }
  assert.ok(s.haunt && !s.winner);
  const d = s.haunt.data;
  const altar = posOf(s, s.board.index[d.altar]);
  for (const p of Object.values(s.players)) p.pos = { ...altar };
  const me = s.turn.playerId;
  s.turn.usedSpecial = false;
  d.riteRound = null;
  const legal = () => getView(s, me).legal.filter((a) => a.type === 'special');
  assert.ok(!legal().some((a) => a.actionId === 'rite'), 'không có nhang thì không được làm lễ');

  d.tokens = { 'nhang-test': { id: 'nhang-test', kind: 'incense', label: 'Bó nhang', holder: me, at: null } };
  assert.ok(legal().some((a) => a.actionId === 'rite'), 'có nhang thì làm lễ được');
  // Trao được cho mọi người cùng phòng, kể cả Kẻ bị nhập (không lộ ai là ai).
  const gives = legal().filter((a) => a.actionId === 'giveIncense').map((a) => a.toPlayerId).sort();
  assert.deepEqual(gives, s.turnOrder.filter((id) => id !== me).sort());
  // Không tìm nhang ở Bàn thờ.
  assert.ok(!legal().some((a) => a.actionId === 'search'));
});

test('Sách Haunt: đoạn kết không gửi xuống khi đang chơi, chỉ hiện khi ván kết thúc', () => {
  const s = newGame(4, 21, { minPlayers: 3, hauntRollThreshold: 99, forcedHauntId: 'haunt-trung-tang' });
  const rand = makeRng(21);
  for (let n = 0; n < 20000 && !s.haunt; n++) {
    if (s.phase === 'explore' && s.round >= 2 && !s.pending) s.rules.hauntRollThreshold = 0;
    const a = currentActor(s);
    applyAction(s, a, smartAction(s, a, rand));
  }
  for (const id of s.turnOrder) {
    const v = getView(s, id).haunt;
    assert.ok(v.book && !('ifWin' in v.book) && !('ifLose' in v.book));
    assert.equal(v.ending, null);
    assert.ok(v.number >= 1 && v.traitorRule);
  }
  s.winner = { side: 'heroes', reason: 'test' };
  const v = getView(s, s.turnOrder[0]).haunt;
  assert.equal(v.ending.tone, 'win');
  assert.ok(v.ending.text.length > 20);
});

test('Tầm nhìn: các phòng nối thẳng hàng qua cửa', async () => {
  const { lineOfSight, tilePos } = await import('../src/haunts/helpers.js');
  const s = newGame(3, 1, { minPlayers: 3 });
  const hall = tilePos(s, 'entrance-hall');
  const los = lineOfSight(s, hall);
  assert.ok(los.has(`${hall.floor}:${hall.x}:${hall.y}`));
  assert.ok(los.has(posKey(tilePos(s, 'foyer'))));
  assert.ok(los.has(posKey(tilePos(s, 'grand-staircase'))));
  assert.ok(!los.has(posKey(tilePos(s, 'upper-landing'))), 'không nhìn xuyên tầng');
});

test('Hôn lễ hồn ma: Kẻ phản bội không thấy thẻ Điềm báo và không biết ai giữ nhẫn', async () => {
  const { CARDS_BY_ID } = await import('../src/data/index.js');
  const s = newGame(4, 31, { minPlayers: 3, hauntRollThreshold: 99, forcedHauntId: 'haunt-hon-le-hon-ma' });
  const rand = makeRng(31);
  for (let n = 0; n < 20000 && !s.haunt; n++) {
    if (s.phase === 'explore' && s.round >= 2 && !s.pending) s.rules.hauntRollThreshold = 0;
    const a = currentActor(s);
    applyAction(s, a, smartAction(s, a, rand));
  }
  const t = s.haunt.traitorId;
  const v = getView(s, t);
  for (const p of Object.values(v.players)) {
    if (p.id === t || p.side !== 'hero') continue;
    assert.ok(!p.cards.some((c) => CARDS_BY_ID[c].type === 'omen'));
  }
  const ring = s.haunt.data.ring;
  assert.ok(!JSON.stringify(v.haunt.data).includes('Nhẫn cưới') || !v.haunt.data.carried?.[ring]);
  assert.ok(getView(s, ring).haunt.data.carried[ring].includes('Nhẫn cưới'));
});
