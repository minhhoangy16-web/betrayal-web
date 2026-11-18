// Tạo "góc nhìn" của từng người chơi từ GameState đầy đủ.
// Mọi thông tin bí mật phải được lọc ở ĐÂY, trên server – client không bao giờ nhận được
// thứ tự chồng bài, seed RNG, cuốn sách Haunt của phe bên kia, hay bí mật riêng của kịch bản.

import { TILES_BY_ID } from '../data/index.js';
import { FLOORS, TRAITS } from './constants.js';
import { legalActions } from './legal.js';
import { traitValue } from './traits.js';
import { hook } from './hooks.js';
import { getHaunt } from '../haunts/index.js';

const LOG_TAIL = 120;

// Kẻ phản bội giấu mặt và chưa bị lật: chỉ chính họ biết.
export function traitorHiddenFrom(state, viewerId) {
  const h = state.haunt;
  return Boolean(h && getHaunt(state)?.hiddenTraitor && !h.data?.revealed && h.traitorId !== viewerId);
}

function hauntView(state, viewer) {
  if (!state.haunt) return null;
  const haunt = getHaunt(state);
  // Chỉ gửi đúng một cuốn sách, theo phe của người xem. Khán giả không nhận cuốn nào.
  let book = null;
  if (viewer?.side === 'traitor') book = { kind: 'traitorTome', ...haunt.traitorTome };
  else if (viewer && viewer.side !== 'explorer') book = { kind: 'survivalSecrets', ...haunt.survivalSecrets };
  const hidden = traitorHiddenFrom(state, viewer?.id);
  return {
    id: state.haunt.id,
    name: state.haunt.name,
    mode: haunt.mode ?? 'traitor', // 'traitor' | 'hidden' | 'coop' | 'solo'
    revealerId: state.haunt.revealerId,
    traitorId: hidden ? null : state.haunt.traitorId,
    publicIntro: haunt.publicIntro,
    data: haunt.publicData ? haunt.publicData(state, viewer?.id ?? null) : {},
    book,
  };
}

// Yêu cầu bí mật (vd. chọn Thành tâm / Lòng dạ khác): người khác chỉ thấy là đang chờ ai.
function pendingView(state, viewerId) {
  const p = state.pending;
  if (!p) return null;
  if (p.type === 'choose') {
    const { then, ...rest } = p;
    if (p.secret && p.playerId !== viewerId) {
      return { type: 'choose', playerId: p.playerId, label: p.label, secret: true, options: [] };
    }
    return rest;
  }
  return p;
}

export function getView(state, viewerId) {
  const viewer = state.players[viewerId] ?? null;
  const hidden = traitorHiddenFrom(state, viewerId);

  const players = {};
  for (const p of Object.values(state.players)) {
    const values = {};
    for (const t of TRAITS) values[t] = traitValue(p, t);
    // Giấu mặt: người khác không biết phe của nhau, chỉ biết phe của chính mình.
    const side = hidden && p.id !== viewerId ? 'unknown' : p.side;
    players[p.id] = { ...p, side, traitValues: values };
  }

  const tilesLeft = {};
  for (const floor of FLOORS) {
    tilesLeft[floor] = state.tileStack.filter((id) => TILES_BY_ID[id].floors.includes(floor)).length;
  }

  const view = {
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
    scenarioId: state.scenarioId,
    omensRevealed: state.omensRevealed,
    pending: pendingView(state, viewerId),
    monsters: state.monsters,
    haunt: hauntView(state, viewer),
    lastRoll: state.lastRoll,
    lastCard: state.lastCard,
    log: state.log.filter((l) => !l.to || l.to === viewerId).slice(-LOG_TAIL),
    winner: state.winner,
    legal: viewer ? legalActions(state, viewer.id) : [],
  };
  hook(state, 'maskView', viewerId, view);
  return view;
}
