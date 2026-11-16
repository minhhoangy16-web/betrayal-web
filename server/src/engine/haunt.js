// Haunt Roll, bắt đầu Haunt và kiểm tra thắng thua.

import { TRAITS } from './constants.js';
import { rollDice } from './dice.js';
import { addLog, setLastRoll } from './log.js';
import { traitValue } from './traits.js';
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
export function pickTraitor(state, traitorRule, revealerId) {
  const order = state.turnOrder;
  const rule = traitorRule?.rule ?? 'revealer';
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
    pendingFirstTurn: true,
    data: {},
  };
  for (const p of Object.values(state.players)) p.side = p.id === traitorId ? 'traitor' : 'hero';
  addLog(state, `👁 Haunt «${haunt.name}» bắt đầu. Kẻ phản bội là ${state.players[traitorId].name}!`, 'haunt');
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
  const who = result.side === 'heroes' ? 'Những người sống sót' : 'Kẻ phản bội';
  addLog(state, `🏁 ${who} chiến thắng! ${result.reason}`, 'haunt');
}

setVictoryCheck(checkVictory);
