import { randInt } from './rng.js';

// Xúc xắc 6 mặt đặc trưng: hai mặt 0, hai mặt 1, hai mặt 2.
export const DIE_FACES = [0, 0, 1, 1, 2, 2];

export function rollDice(state, count) {
  const max = state.rules?.maxDice ?? 8;
  const n = Math.max(0, Math.min(max, Math.floor(count)));
  const dice = [];
  for (let i = 0; i < n; i++) dice.push(DIE_FACES[randInt(state, DIE_FACES.length)]);
  return { dice, total: dice.reduce((a, b) => a + b, 0) };
}
