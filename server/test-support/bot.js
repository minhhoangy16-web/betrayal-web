// Bot ngẫu nhiên dùng trong test: luôn chọn một hành động trong legalActions().

import { applyAction, createGame, legalActions } from '../src/engine/Game.js';
import { CHARACTERS } from '../src/data/index.js';

export function makeRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newGame(playerCount, seed, rules = {}) {
  const players = CHARACTERS.slice(0, playerCount).map((c, i) => ({ id: `p${i + 1}`, name: `Người ${i + 1}`, characterId: c.id }));
  return createGame({ code: 'TEST1', players, seed, rules: { minPlayers: 1, ...rules } });
}

// Ai là người phải hành động lúc này?
export const actorOf = (state) => (state.pending ? state.pending.playerId : state.turn.playerId);

// Thực hiện một bước ngẫu nhiên. Trả về hành động đã chọn.
export function botStep(state, rand) {
  const actor = actorOf(state);
  const options = legalActions(state, actor);
  if (!options.length) throw new Error(`Bế tắc: ${actor} không có hành động hợp lệ nào`);
  const action = options[Math.floor(rand() * options.length)];
  applyAction(state, actor, action);
  return { actor, action };
}

// Chơi tới khi điều kiện `until(state)` đúng hoặc hết số bước cho phép.
export function playUntil(state, rand, until, maxSteps = 20000) {
  let steps = 0;
  while (!until(state) && !state.winner && steps < maxSteps) {
    botStep(state, rand);
    steps += 1;
  }
  return steps;
}
