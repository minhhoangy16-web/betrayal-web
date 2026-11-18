// Điểm vào của engine. Engine là thuần logic: không biết gì về socket hay HTTP,
// và GameState là một object JSON thuần nên lưu được vào Redis/DB bằng JSON.stringify.
//
//   const state = createGame({ code, players, seed });
//   applyAction(state, playerId, { type: 'move', dir: 0 });
//   const view = getView(state, playerId);

import { CHARACTERS_BY_ID, START_TILES, STACK_TILES, DECK_IDS } from '../data/index.js';
import { DEFAULT_RULES } from './constants.js';
import { GameError } from './errors.js';
import { shuffle, randInt } from './rng.js';
import { addLog } from './log.js';
import { placeTile } from './board.js';
import { runQueue, enqueueFront } from './effects.js';
import { startTurn } from './turn.js';
import { checkVictory } from './haunt.js';
import { ACTIONS } from './actions.js';
import { inPlay } from './hooks.js';

export { GameError } from './errors.js';
export { getView } from './view.js';
export { legalActions, currentActor, defaultAction } from './legal.js';
export { DEFAULT_RULES } from './constants.js';

/**
 * @param {object} opts
 * @param {string} opts.code            Mã phòng.
 * @param {{id:string,name:string,characterId:string}[]} opts.players  Theo thứ tự chỗ ngồi.
 * @param {number} [opts.seed]          Seed RNG (để tái lập ván chơi khi test).
 * @param {object} [opts.rules]         Ghi đè DEFAULT_RULES.
 */
export function createGame({ code, players, seed, rules = {} }) {
  const merged = { ...DEFAULT_RULES, ...rules };
  if (players.length < merged.minPlayers || players.length > merged.maxPlayers) {
    throw new GameError(`Cần từ ${merged.minPlayers} đến ${merged.maxPlayers} người chơi.`);
  }
  const taken = new Set();
  for (const p of players) {
    if (!CHARACTERS_BY_ID[p.characterId]) throw new GameError(`${p.name} chưa chọn nhân vật hợp lệ.`);
    if (taken.has(p.characterId)) throw new GameError('Hai người chơi không thể chọn cùng một nhân vật.');
    taken.add(p.characterId);
  }

  const state = {
    version: 1,
    code,
    phase: 'explore',
    round: 1,
    rules: merged,
    rngState: (seed ?? Math.floor(Math.random() * 0xffffffff)) | 0,
    players: {},
    turnOrder: [],
    turn: null,
    board: { tiles: {}, index: {} },
    tileStack: [],
    decks: { omen: [], item: [], event: [] },
    discards: { omen: [], item: [], event: [] },
    omensRevealed: 0,
    pending: null,
    queue: [],
    haunt: null,
    monsters: {},
    lastRoll: null,
    lastCard: null,
    log: [],
    logSeq: 0,
    rollSeq: 0,
    cardSeq: 0,
    winner: null,
  };

  for (const tile of START_TILES) placeTile(state, tile.id, tile.start, 0);
  const entrance = START_TILES.find((t) => t.id === 'entrance-hall').start;

  for (const p of players) {
    const character = CHARACTERS_BY_ID[p.characterId];
    state.players[p.id] = {
      id: p.id,
      name: p.name,
      characterId: p.characterId,
      traits: {
        speed: character.traits.speed.start,
        might: character.traits.might.start,
        sanity: character.traits.sanity.start,
        knowledge: character.traits.knowledge.start,
      },
      pos: { ...entrance },
      alive: true,
      side: 'explorer',
      cards: [],
    };
  }

  state.tileStack = shuffle(state, STACK_TILES.map((t) => t.id));
  for (const deck of ['omen', 'item', 'event']) state.decks[deck] = shuffle(state, DECK_IDS[deck]);

  // Giữ thứ tự chỗ ngồi, chọn ngẫu nhiên người đi đầu.
  state.turnOrder = players.map((p) => p.id);
  addLog(state, 'Cánh cửa đóng sầm sau lưng. Cuộc khám phá bắt đầu.', 'system');
  startTurn(state, state.turnOrder[randInt(state, state.turnOrder.length)]);
  return state;
}

function settle(state) {
  runQueue(state);
  checkVictory(state);
  // Người đang tới lượt chết (hoặc thoát khỏi nhà) giữa lượt: chuyển lượt.
  const current = state.players[state.turn.playerId];
  if (!state.winner && !state.pending && state.turn.phase === 'explorer' && !inPlay(current)) {
    enqueueFront(state, [{ op: 'afterExplorer' }]);
    runQueue(state);
    checkVictory(state);
  }
}

/**
 * Áp dụng một hành động. Ném GameError nếu không hợp lệ.
 * Giao dịch nguyên tử: nếu có lỗi giữa chừng, state giữ nguyên như trước khi gọi.
 */
export function applyAction(state, playerId, action) {
  if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
    throw new GameError('Hành động không hợp lệ.');
  }
  if (state.winner) throw new GameError('Ván chơi đã kết thúc.');
  if (!state.players[playerId]) throw new GameError('Bạn không ở trong ván này.');
  const handler = Object.hasOwn(ACTIONS, action.type) ? ACTIONS[action.type] : null;
  if (!handler) throw new GameError(`Không có hành động «${action.type}».`);

  const draft = structuredClone(state);
  handler(draft, playerId, action);
  settle(draft);

  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, draft);
  return state;
}
