// Bot "có mục đích" dùng để đo cân bằng các kịch bản Haunt (không dùng trong game thật).
// Người sống sót đi tới phòng có hành động đặc biệt gần nhất và làm nó; Kẻ phản bội và quái vật
// đuổi theo người sống sót gần nhất. Trước Haunt thì ưu tiên khám phá phòng mới.

import { legalActions } from '../src/engine/Game.js';
import { posKey } from '../src/engine/board.js';
import { inPlay, hook } from '../src/engine/hooks.js';
import { getHaunt } from '../src/haunts/index.js';
import { distances, doorSteps, wallSteps, rooms, posOf } from '../src/haunts/helpers.js';

const pick = (list, rand) => list[Math.floor(rand() * list.length)];
const isTokenAction = (a) => a.actionId === 'pickToken' || a.actionId === 'giveToken';

// Các phòng mà nếu đứng ở đó, người chơi có hành động đặc biệt (không tính nhặt/trao vật).
function goalRooms(state, player) {
  const haunt = getHaunt(state);
  if (!haunt?.specialActions) return [];
  const saved = player.pos;
  const savedTurn = { ...state.turn };
  state.turn.usedSpecial = false;
  state.turn.hasAttacked = false;
  const out = [];
  try {
    for (const key of rooms(state)) {
      player.pos = posOf(state, key);
      if ((haunt.specialActions(state, player.id) ?? []).some((a) => !isTokenAction(a))) out.push(key);
    }
  } finally {
    player.pos = saved;
    Object.assign(state.turn, savedTurn);
  }
  return out;
}

// Chọn bước đi trong `moves` giúp tới gần một phòng thuộc `targets` nhất.
function moveToward(state, from, moves, targets, opts = {}) {
  if (!targets.length) return null;
  let best = null;
  for (const m of moves) {
    if (m.discover) continue;
    const step = (opts.steps ?? doorSteps)(state, from).find((s) => (m.linkTo ? s.linkTo === m.linkTo : s.dir === m.dir));
    if (!step) continue;
    const dist = distances(state, step.pos, opts);
    const d = Math.min(...targets.map((k) => dist.get(k) ?? 99));
    if (!best || d < best.d) best = { m, d };
  }
  return best && best.d < 99 ? best.m : null;
}

function decidePending(state, actor, options, rand) {
  const p = state.pending;
  if (p.type === 'allocateDamage') {
    const traits = state.players[actor].traits;
    const worst = (a) => Math.min(...Object.entries(a.allocation).map(([t, n]) => traits[t] - n));
    return options.reduce((b, a) => (worst(a) > worst(b) ? a : b));
  }
  return pick(options, rand);
}

function decideMonsters(state, options, rand) {
  const attack = options.find((o) => o.type === 'monsterAttack');
  if (attack) return attack;
  const moves = options.filter((o) => o.type === 'monsterMove');
  if (moves.length) {
    const byMonster = {};
    for (const m of moves) (byMonster[m.monsterId] ??= []).push(m);
    for (const [id, list] of Object.entries(byMonster)) {
      const monster = state.monsters[id];
      const heroes = Object.values(state.players).filter((p) => inPlay(p) && (hook(state, 'monsterCanTarget', monster, p) ?? p.side === 'hero'));
      const d = state.haunt?.data;
      // Ma lai: gần sáng thì bay về thân xác.
      const goHome = d?.body && d.dawnRound - state.round <= 1 ? [d.body] : null;
      const steps = hook(state, 'monsterSteps', monster) ? wallSteps : doorSteps;
      const canEnter = (pos) => getHaunt(state).canMonsterEnter?.(state, monster, pos) !== false;
      const best = moveToward(state, monster.pos, list, goHome ?? heroes.map((h) => posKey(h.pos)), { steps, canEnter });
      if (best) return best;
      if (rand() < 0.3) return pick(list, rand);
    }
  }
  return options.find((o) => o.type === 'endMonsterTurn');
}

function decideExplorer(state, actor, options, rand) {
  const me = state.players[actor];
  const end = options.find((o) => o.type === 'endTurn');
  const moves = options.filter((o) => o.type === 'move');
  if (state.phase === 'explore') {
    const discover = moves.filter((m) => m.discover);
    if (discover.length && rand() < 0.7) return pick(discover, rand);
    if (moves.length && rand() < 0.7) return pick(moves, rand);
    return end;
  }
  const specials = options.filter((o) => o.type === 'special');
  let real = specials.filter((a) => !isTokenAction(a));
  // Trục vong: ưu tiên làm lễ; tố giác thỉnh thoảng thôi (người thật sẽ bàn bạc trước khi tố).
  if (state.haunt?.id === 'haunt-truc-vong') {
    const rite = real.find((a) => a.actionId === 'rite');
    if (rite) return rite;
    real = real.filter((a) => a.actionId !== 'accuse' || rand() < 0.08);
  }
  if (real.length) return pick(real, rand);
  const pickUp = specials.find((a) => a.actionId === 'pickToken');
  if (pickUp) return pickUp;
  let attacks = options.filter((o) => o.type === 'attack');
  // Mạnh ai nấy chơi: chỉ đánh người đang giữ vật của Haunt (để cướp), không đánh bừa.
  if (me.side === 'solo') {
    const held = (id) => Object.values(state.haunt.data.tokens ?? {}).some((t) => t.holder === id);
    attacks = attacks.filter((a) => a.targetType === 'player' && held(a.targetId));
  }
  if (attacks.length) return attacks[0];
  if (moves.length) {
    let targets;
    if (state.haunt?.id === 'haunt-truc-vong' && !(me.side === 'traitor' && state.haunt.data.revealed)) {
      targets = trucVongTargets(state, me);
    } else if (me.side === 'traitor') {
      targets = Object.values(state.players).filter((p) => inPlay(p) && p.id !== me.id).map((p) => posKey(p.pos));
    } else {
      targets = goalRooms(state, me).filter((k) => k !== posKey(me.pos));
      const coffin = state.haunt?.data?.coffin;
      if (coffin && specials.some((a) => a.actionId === 'giveToken') === false && Object.values(state.haunt.data.tokens ?? {}).some((t) => t.holder === me.id)) {
        targets = [coffin];
      }
    }
    const step = moveToward(state, me.pos, moves, targets);
    if (step) return step;
    const discover = moves.filter((m) => m.discover);
    if (discover.length && rand() < 0.5) return pick(discover, rand);
    if (rand() < 0.5) return pick(moves, rand);
  }
  return end;
}

// Trục vong: chưa có ai cầm nhang thì đi lục tìm nhang; có nhang rồi thì kéo nhau về Bàn thờ.
function trucVongTargets(state, me) {
  const d = state.haunt.data;
  const altar = state.board.index[d.altar];
  const holders = Object.values(d.tokens ?? {}).filter((t) => t.kind === 'incense' && t.holder);
  const iHold = holders.some((t) => t.holder === me.id);
  if (iHold || holders.length) return [altar].filter((k) => k !== posKey(me.pos));
  return goalRooms(state, me).filter((k) => k !== posKey(me.pos) && k !== altar);
}

export function smartAction(state, actor, rand) {
  const options = legalActions(state, actor);
  if (!options.length) return null;
  if (state.pending) return decidePending(state, actor, options, rand);
  if (state.turn.phase === 'monsters') return decideMonsters(state, options, rand);
  return decideExplorer(state, actor, options, rand);
}
