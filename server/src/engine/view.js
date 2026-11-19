// Tạo "góc nhìn" của từng người chơi từ GameState đầy đủ.
// Mọi thông tin bí mật phải được lọc ở ĐÂY, trên server – client không bao giờ nhận được
// thứ tự chồng bài, seed RNG, cuốn sách Haunt của phe bên kia, hay bí mật riêng của kịch bản.

import { TILES_BY_ID } from '../data/index.js';
import { FLOORS, TRAITS } from './constants.js';
import { legalActions } from './legal.js';
import { traitValue } from './traits.js';
import { hook } from './hooks.js';
import { getHaunt } from '../haunts/index.js';

const LOG_TAIL = 600; // gửi toàn bộ nhật ký còn giữ để người chơi tra cứu lại

// Kẻ phản bội giấu mặt và chưa bị lật: chỉ chính họ biết.
export function traitorHiddenFrom(state, viewerId) {
  const h = state.haunt;
  return Boolean(h && getHaunt(state)?.hiddenTraitor && !h.data?.revealed && h.traitorId !== viewerId);
}

// Đoạn kết («Nếu bạn thắng / thua») không nằm trong sách lúc chơi: chỉ gửi khi ván đã kết thúc.
const stripEndings = (book) => {
  if (!book) return null;
  const { ifWin, ifLose, ...rest } = book;
  return rest;
};

const TRAITOR_RULE_LABEL = {
  revealer: 'Người lật Haunt',
  leftOfRevealer: 'Người ngồi bên trái người lật Haunt',
  random: 'Ngẫu nhiên (giấu mặt)',
  none: 'Không có',
};
const TRAIT_WORD = { might: 'Sức mạnh', speed: 'Tốc độ', sanity: 'Tinh thần', knowledge: 'Tri thức' };

function traitorRuleLabel(haunt) {
  if (haunt.traitorLabel) return haunt.traitorLabel;
  const rule = haunt.traitor?.rule ?? 'revealer';
  if (rule === 'highestTrait') return `${TRAIT_WORD[haunt.traitor.trait]} cao nhất`;
  if (rule === 'lowestTrait') return `${TRAIT_WORD[haunt.traitor.trait]} thấp nhất`;
  return TRAITOR_RULE_LABEL[rule] ?? 'Người lật Haunt';
}

// Khung thông báo kết thúc: đoạn kết của phe thắng (hoặc đoạn «cả bàn thua»).
function endingFor(state, haunt) {
  const w = state.winner;
  if (!w) return null;
  const tome = haunt.traitorTome ?? {};
  const secrets = haunt.survivalSecrets ?? {};
  if (w.side === 'heroes') return { tone: 'win', title: 'Nếu phe sống sót thắng', text: secrets.ifWin };
  if (w.side === 'traitor') return { tone: 'lose', title: 'Nếu Kẻ phản bội thắng', text: tome.ifWin ?? secrets.ifLose };
  if (w.side === 'players') return { tone: 'win', title: 'Kết cục', text: secrets.ifWin };
  return { tone: 'lose', title: 'Nếu ngôi nhà thắng', text: secrets.ifLose ?? tome.ifWin };
}

function hauntView(state, viewer) {
  if (!state.haunt) return null;
  const haunt = getHaunt(state);
  // Chỉ gửi đúng một cuốn sách, theo phe của người xem. Khán giả không nhận cuốn nào.
  let book = null;
  if (viewer?.side === 'traitor') book = { kind: 'traitorTome', ...stripEndings(haunt.traitorTome) };
  else if (viewer && viewer.side !== 'explorer') book = { kind: 'survivalSecrets', ...stripEndings(haunt.survivalSecrets) };
  const hidden = traitorHiddenFrom(state, viewer?.id);
  return {
    id: state.haunt.id,
    name: state.haunt.name,
    number: haunt.number ?? null,
    mode: haunt.mode ?? 'traitor', // 'traitor' | 'hidden' | 'coop' | 'solo'
    revealerId: state.haunt.revealerId,
    traitorId: hidden ? null : state.haunt.traitorId,
    traitorRule: traitorRuleLabel(haunt),
    triggerCardId: state.haunt.triggerCardId ?? null,
    // Kẻ phản bội vẫn đang giấu mặt (công khai: ai cũng biết là đã có người lộ mặt hay chưa).
    secretTraitor: Boolean(haunt.hiddenTraitor && !state.haunt.data?.revealed),
    publicIntro: haunt.publicIntro,
    data: haunt.publicData ? haunt.publicData(state, viewer?.id ?? null) : {},
    book,
    monsters: haunt.monsterCards ?? [],
    ending: endingFor(state, haunt),
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
    gameId: state.gameId ?? state.code,
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
