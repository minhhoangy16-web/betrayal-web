// RNG có seed (mulberry32). Trạng thái nằm trong state.rngState nên ván chơi
// tái lập được và có thể serialize sang Redis.
export function nextRandom(state) {
  let t = (state.rngState = (state.rngState + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(state, n) {
  return Math.floor(nextRandom(state) * n);
}

export function shuffle(state, list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(state, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
