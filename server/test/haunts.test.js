import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, currentActor, getView } from '../src/engine/Game.js';
import { HAUNTS } from '../src/haunts/index.js';
import { makeRng, newGame } from '../test-support/bot.js';
import { smartAction } from '../test-support/smartBot.js';
import { loadSchema, validate } from '../test-support/miniSchema.js';

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
