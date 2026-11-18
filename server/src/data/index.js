import { CHARACTERS } from './characters.js';
import { TILES } from './tiles.js';
import { OMENS } from './cards/omens.js';
import { ITEMS } from './cards/items.js';
import { EVENTS } from './cards/events.js';
import { SCENARIOS } from './scenarios.js';

const byId = (list, kind) => {
  const map = {};
  for (const entry of list) {
    if (map[entry.id]) throw new Error(`Trùng id ${kind}: ${entry.id}`);
    map[entry.id] = entry;
  }
  return map;
};

export { CHARACTERS, TILES };
export const CARDS = [...OMENS, ...ITEMS, ...EVENTS];

export const CHARACTERS_BY_ID = byId(CHARACTERS, 'character');
export const TILES_BY_ID = byId(TILES, 'tile');
export const CARDS_BY_ID = byId(CARDS, 'card');

export const START_TILES = TILES.filter((t) => t.start);
export const STACK_TILES = TILES.filter((t) => !t.start);
export const DECK_IDS = {
  omen: OMENS.map((c) => c.id),
  item: ITEMS.map((c) => c.id),
  event: EVENTS.map((c) => c.id),
};

// Dữ liệu tĩnh công khai gửi cho client (không chứa nội dung bí mật của Haunt).
export function getCatalog() {
  return { characters: CHARACTERS, tiles: TILES, cards: CARDS, scenarios: SCENARIOS };
}
