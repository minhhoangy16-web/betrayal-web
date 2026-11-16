import { CHARACTERS_BY_ID } from '../data/index.js';
import { MAX_INDEX, TRAIT_LABEL } from './constants.js';
import { addLog } from './log.js';
import { tileAt } from './board.js';

export const characterOf = (player) => CHARACTERS_BY_ID[player.characterId];
export const startIndex = (player, trait) => characterOf(player).traits[trait].start;

// Giá trị hiện tại của chỉ số (số xúc xắc được đổ). Chạm đầu lâu (index -1) = 0.
export function traitValue(player, trait) {
  const idx = player.traits[trait];
  return idx < 0 ? 0 : characterOf(player).traits[trait].track[idx];
}

// Trước Haunt không ai chết: chỉ số dừng ở nấc thấp nhất (critical, index 0).
// Sau khi Haunt bắt đầu, chỉ số có thể tụt xuống đầu lâu (index -1) và nhân vật chết.
export const minIndex = (state) => (state.phase === 'explore' ? 0 : -1);

// Số nấc tối đa mỗi chỉ số còn có thể bị hạ.
export function damageCapacity(state, player, traits) {
  const min = minIndex(state);
  const cap = {};
  for (const t of traits) cap[t] = Math.max(0, player.traits[t] - min);
  return cap;
}

export function killPlayer(state, player) {
  if (!player.alive) return;
  player.alive = false;
  const tile = tileAt(state, player.pos);
  if (tile && player.cards.length) tile.items.push(...player.cards);
  player.cards = [];
  addLog(state, `☠ ${player.name} đã chết.`, 'haunt');
}

// Dịch chuyển chỉ số delta nấc (âm = giảm). Trả về số nấc thực sự thay đổi.
export function shiftTrait(state, player, trait, delta) {
  if (!player.alive || delta === 0) return 0;
  const before = player.traits[trait];
  const after = Math.max(minIndex(state), Math.min(MAX_INDEX, before + delta));
  player.traits[trait] = after;
  const moved = after - before;
  if (moved !== 0) {
    const sign = moved > 0 ? '+' : '';
    addLog(state, `${player.name}: ${TRAIT_LABEL[trait]} ${sign}${moved} nấc (còn ${traitValue(player, trait)}).`, 'damage');
  }
  if (after < 0) killPlayer(state, player);
  return moved;
}
