// Haunt Roll, bắt đầu Haunt và kiểm tra thắng thua.

import { TRAITS } from './constants.js';
import { rollDice } from './dice.js';
import { addLog, setLastRoll } from './log.js';
import { traitValue } from './traits.js';
import { randInt } from './rng.js';
import { registerOp, setVictoryCheck } from './effects.js';
import { getHaunt, selectHaunt } from '../haunts/index.js';

// Luật 3rd Edition: đổ số xúc xắc bằng tổng số Omen đã lật trên toàn bàn; đạt ngưỡng thì Haunt bắt đầu.
registerOp('hauntRoll', (state, it) => {
  if (state.phase !== 'explore') return;
  const player = state.players[it.playerId];
  const threshold = state.rules.hauntRollThreshold;
  const r = rollDice(state, state.omensRevealed);
  const triggered = r.total >= threshold;
  setLastRoll(state, {
    kind: 'haunt', playerId: player.id, dice: r.dice, total: r.total, threshold, triggered, label: 'Haunt Roll',
  });
  addLog(
    state,
    `🎲 Haunt Roll của ${player.name} (${r.dice.length} xúc xắc): [${r.dice.join(', ')}] = ${r.total} ` +
      `(cần ${threshold}+) → ${triggered ? 'HAUNT BẮT ĐẦU!' : 'chưa có gì xảy ra.'}`,
    'haunt',
  );
  if (triggered) startHaunt(state, player.id);
});

// rule: 'revealer' | 'leftOfRevealer' | 'highestTrait' | 'lowestTrait' (kèm trait)
//       | 'random' (bất kỳ ai, kể cả người lật Haunt) | 'none' (không có Kẻ phản bội)
export function pickTraitor(state, traitorRule, revealerId) {
  const order = state.turnOrder;
  const rule = traitorRule?.rule ?? 'revealer';
  if (rule === 'none') return null;
  if (rule === 'random') return order[randInt(state, order.length)];
  if (rule === 'leftOfRevealer') return order[(order.indexOf(revealerId) + 1) % order.length];
  if (rule === 'highestTrait' || rule === 'lowestTrait') {
    if (!TRAITS.includes(traitorRule.trait)) throw new Error('Thiếu trait cho luật chọn Traitor');
    const sign = rule === 'highestTrait' ? 1 : -1;
    // Hoà thì ưu tiên người lật Haunt, rồi theo thứ tự ngồi tính từ người lật.
    const start = order.indexOf(revealerId);
    let best = null;
    for (let i = 0; i < order.length; i++) {
      const p = state.players[order[(start + i) % order.length]];
      const score = sign * traitValue(p, traitorRule.trait);
      if (!best || score > best.score) best = { id: p.id, score };
    }
    return best.id;
  }
  return revealerId;
}

export function startHaunt(state, revealerId) {
  const haunt = selectHaunt(state, revealerId);
  const traitorId = pickTraitor(state, haunt.traitor, revealerId);
  state.phase = 'haunt';
  state.haunt = {
    id: haunt.id,
    name: haunt.name,
    revealerId,
    traitorId,
    startedOnTurn: state.turn.number,
    startedOnRound: state.round,
    pendingFirstTurn: true,
    data: {},
  };
  // Không có Kẻ phản bội: mọi người cùng phe 'hero', hoặc mỗi người một phe 'solo' (mạnh ai nấy chơi).
  for (const p of Object.values(state.players)) p.side = p.id === traitorId ? 'traitor' : haunt.playerSide ?? 'hero';
  if (haunt.hiddenTraitor) {
    addLog(state, `👁 Haunt «${haunt.name}» bắt đầu. Một người trong các bạn không còn là chính mình…`, 'haunt');
    addLog(state, 'Bạn chính là người bị nhập. Đừng để ai biết.', 'haunt', traitorId);
  } else if (!traitorId) {
    addLog(state, `👁 Haunt «${haunt.name}» bắt đầu. Lần này không có Kẻ phản bội.`, 'haunt');
  } else {
    addLog(state, `👁 Haunt «${haunt.name}» bắt đầu. Kẻ phản bội là ${state.players[traitorId].name}!`, 'haunt');
  }
  haunt.setup(state);
}

export function checkVictory(state) {
  if (state.phase !== 'haunt' || state.winner) return;
  const result = getHaunt(state).checkVictory(state);
  if (!result) return;
  state.winner = result;
  state.phase = 'ended';
  state.pending = null;
  state.queue = [];
  addLog(state, `🏁 ${winnerLabel(state, result)} chiến thắng! ${result.reason}`, 'haunt');
}

setVictoryCheck(checkVictory);

// winner = { side: 'heroes' | 'traitor' | 'players' | 'house', playerIds?, reason }
//   players: một hoặc vài người thắng riêng (mạnh ai nấy chơi) – playerIds là danh sách người thắng.
//   house: không ai thắng, ngôi nhà thắng.
export function winnerLabel(state, result) {
  if (result.side === 'heroes') return 'Những người sống sót';
  if (result.side === 'traitor') return 'Kẻ phản bội';
  if (result.side === 'house') return 'Ngôi nhà';
  return (result.playerIds ?? []).map((id) => state.players[id]?.name).join(' và ');
}
