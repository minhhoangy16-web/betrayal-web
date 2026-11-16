// Tạo "góc nhìn" của từng người chơi từ GameState đầy đủ.
// Mọi thông tin bí mật phải được lọc ở ĐÂY, trên server – client không bao giờ nhận được
// thứ tự chồng bài, seed RNG, hay cuốn sách Haunt của phe bên kia.

import { TILES_BY_ID } from '../data/index.js';
import { FLOORS, TRAITS } from './constants.js';
import { legalActions } from './legal.js';
import { traitValue } from './traits.js';
import { getHaunt } from '../haunts/index.js';

const LOG_TAIL = 120;

function hauntView(state, viewer) {
  if (!state.haunt) return null;
  const haunt = getHaunt(state);
  // Chỉ gửi đúng một cuốn sách, theo phe của người xem. Khán giả không nhận cuốn nào.
  let book = null;
  if (viewer?.side === 'traitor') book = { kind: 'traitorTome', ...haunt.traitorTome };
  else if (viewer?.side === 'hero') book = { kind: 'survivalSecrets', ...haunt.survivalSecrets };
  return {
    id: state.haunt.id,
    name: state.haunt.name,
    revealerId: state.haunt.revealerId,
    traitorId: state.haunt.traitorId,
    publicIntro: haunt.publicIntro,
    data: haunt.publicData ? haunt.publicData(state) : {},
    book,
  };
}

export function getView(state, viewerId) {
  const viewer = state.players[viewerId] ?? null;

  const players = {};
  for (const p of Object.values(state.players)) {
    const values = {};
    for (const t of TRAITS) values[t] = traitValue(p, t);
    players[p.id] = { ...p, traitValues: values };
  }

  const tilesLeft = {};
  for (const floor of FLOORS) {
    tilesLeft[floor] = state.tileStack.filter((id) => TILES_BY_ID[id].floors.includes(floor)).length;
  }

  return {
    code: state.code,
    you: viewer ? viewer.id : null,
    phase: state.phase,
    round: state.round,
    rules: state.rules,
    players,
    turnOrder: state.turnOrder,
    turn: state.turn,
    board: { tiles: state.board.tiles },
    stacks: {
      tiles: state.tileStack.length,
      tilesByFloor: tilesLeft,
      omen: state.decks.omen.length,
      item: state.decks.item.length,
      event: state.decks.event.length,
    },
    omensRevealed: state.omensRevealed,
    pending: state.pending,
    monsters: state.monsters,
    haunt: hauntView(state, viewer),
    lastRoll: state.lastRoll,
    lastCard: state.lastCard,
    log: state.log.slice(-LOG_TAIL),
    winner: state.winner,
    legal: viewer ? legalActions(state, viewer.id) : [],
  };
}
