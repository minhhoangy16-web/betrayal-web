// HAUNT «Trốn tìm với Ma xó» – Kẻ phản bội (Ma xó) đi tìm, người sống sót trốn và gom đồ chơi trả về Phòng trẻ.
// Ma xó KHÔNG thấy vị trí người sống sót (trừ khi chung phòng); chỉ nghe tiếng động gửi riêng qua nhật ký.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import {
  aliveHeroes, tileDefAt, roomName, rooms, posOf, rollOp,
  addToken, tokensOf, removeToken, dropTokens, tokenActions, handleTokenAction, tokenDisplay, mergeMarks,
} from './helpers.js';

const TOYS_NEEDED = 5;
const SEARCH_TARGET = 5;
const FLEE_TARGET = 5;
const ROUNDS = 10;
const FLOOR_WORD = { upper: 'tầng trên', ground: 'tầng trệt', basement: 'tầng hầm' };

const data = (state) => state.haunt.data;
const traitorId = (state) => state.haunt.traitorId;
const isTraitor = (state, id) => id === traitorId(state);
const tileCount = (state) => Object.keys(state.board.tiles).length;
const catchesNeeded = (state) => data(state).heroesAtStart + 1;

// Phòng trẻ nếu đã có trên bàn cờ, không thì Chiếu nghỉ tầng trên.
function nurseryKey(state) {
  return rooms(state, (pos, def) => def.id === 'nursery')[0] ?? rooms(state, (pos, def) => def.id === 'upper-landing')[0];
}

function hear(state, text) {
  addLog(state, `👂 ${text}`, 'haunt', traitorId(state));
}

registerOp('trontim:flee', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  if (!me?.alive) return;
  if (it.total >= FLEE_TARGET) {
    addLog(state, `${me.name} nín thở, lách qua sau lưng Ma xó.`, 'haunt');
    return;
  }
  d.catches += 1;
  addLog(state, `👻 Ma xó tóm được ${me.name}! (Đã bắt ${d.catches}/${catchesNeeded(state)})`, 'haunt');
  dropTokens(state, me);
  enqueueFront(state, [{ op: 'damage', type: 'mental', amount: 2, playerId: me.id, source: 'haunt' }]);
});

registerOp('trontim:search', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  d.searched.push(it.key);
  if (it.total >= SEARCH_TARGET && d.toysMade < TOYS_NEEDED + 2) {
    d.toysMade += 1;
    addToken(state, { id: `toy-${d.toysMade}`, kind: 'toy', label: 'Đồ chơi cũ', holder: me.id });
    addLog(state, `🧸 ${me.name} lục ra một món đồ chơi cũ.`, 'haunt');
  } else {
    addLog(state, `${me.name} lục tung phòng mà không thấy gì.`, 'haunt');
  }
});

function heroActions(state, me) {
  const d = data(state);
  const out = [];
  const key = posKey(me.pos);
  const def = tileDefAt(state, me.pos);
  if (!state.turn.usedSpecial) {
    if ((def.symbol === 'item' || def.symbol === 'event') && !d.searched.includes(key)) {
      out.push({ type: 'special', actionId: 'search', label: `Lục tìm đồ chơi (đổ Tri thức, cần ${SEARCH_TARGET}+)` });
    }
  }
  const toys = tokensOf(state, me.id).filter((t) => t.kind === 'toy');
  if (toys.length && key === nurseryKey(state)) {
    out.push({ type: 'special', actionId: 'return', label: `Trả ${toys.length} đồ chơi về chỗ cũ` });
  }
  out.push(...tokenActions(state, me.id));
  return out;
}

function traitorActions(state) {
  if (state.turn.usedSpecial) return [];
  return [{ type: 'special', actionId: 'listen', label: 'Lắng nghe (biết mỗi tầng có bao nhiêu người)' }];
}

export default {
  id: 'haunt-tron-tim',
  name: 'Trốn tìm với Ma xó',
  mode: 'traitor',
  traitor: { rule: 'revealer' },
  traitorLabel: 'Người vừa lật Haunt',

  publicIntro:
    'Có tiếng trẻ con đếm từ một đến mười vọng ra từ góc nhà. Khi tiếng đếm dừng, một người trong các bạn quay lại, ' +
    'mắt nhắm nghiền mà vẫn mỉm cười: «Trốn kỹ chưa? Tớ đi tìm đây».',

  traitorTome: {
    title: 'Sách Kẻ phản bội – Trốn tìm với Ma xó',
    intro: 'Ma xó mượn thân bạn để chơi trò nó thích nhất. Bạn không nhìn thấy ai, chỉ nghe được tiếng động. Tìm cho ra từng người.',
    setup: [
      'Bạn là người vừa lật Haunt. Tốc độ của bạn +2.',
      'Từ giờ bạn KHÔNG thấy vị trí người sống sót trên bàn cờ, trừ người đang ở chung phòng với bạn.',
    ],
    objective: `Bạn thắng khi bắt đủ số lần bằng số người sống sót lúc đầu cộng 1, hoặc khi hết ${ROUNDS} vòng mà họ chưa trả đủ đồ chơi, hoặc khi mọi người sống sót đều chết.`,
    lose: [`Người sống sót trả đủ ${TOYS_NEEDED} món đồ chơi về Phòng trẻ.`],
    tokens: ['Đồ chơi cũ'],
    actions: [
      { name: 'Lắng nghe', when: 'Mỗi lượt một lần, bạn có thể', text: 'Biết mỗi tầng hiện có bao nhiêu người sống sót (gửi riêng cho bạn trong nhật ký).' },
    ],
    rules: [
      { title: 'Bắt', text: `Mỗi khi bạn bước vào phòng có người sống sót, từng người đó đổ Tốc độ. Dưới ${FLEE_TARGET}: bị bắt, mất 2 Tinh thần và làm rơi hết đồ chơi tại chỗ. Mỗi người chỉ bị bắt tối đa một lần trong một lượt của bạn.` },
      { title: 'Tiếng động', text: 'Cuối lượt mỗi người sống sót, bạn nghe được: phòng chính xác nếu họ vừa mở phòng mới hoặc lục tìm đồ chơi; nếu không thì chỉ biết họ ở tầng nào.' },
      { title: 'Không đánh nhau', text: 'Không ai tấn công được ai trong Haunt này.' },
    ],
    tips: ['Lắng nghe đầu lượt rồi đi về tầng đông người nhất. Canh gần Phòng trẻ khi họ đã gom được đồ chơi.'],
    ifWin: '«Tìm thấy rồi!» Tiếng cười trẻ con vang khắp nhà. Ma xó chưa chơi chán, và từ nay sẽ không ai được về nhà nữa.',
  },

  survivalSecrets: {
    title: 'Sách Người sống sót – Trốn tìm với Ma xó',
    intro: 'Ma xó chỉ chịu đi khi đồ chơi của nó được trả về chỗ cũ. Nó không nhìn thấy bạn, nhưng nghe rất thính.',
    setup: ['Kẻ phản bội (Ma xó) không thấy vị trí của các bạn, chỉ nghe tiếng động.', `Đồ chơi nằm rải rác trong các phòng có biểu tượng Vật phẩm hoặc Sự kiện.`],
    objective: `Các bạn thắng khi trả đủ ${TOYS_NEEDED} món đồ chơi về Phòng trẻ (nếu Phòng trẻ chưa được mở thì trả về Chiếu nghỉ tầng trên).`,
    lose: [
      'Ma xó bắt đủ số lần bằng số người sống sót lúc đầu cộng 1.',
      `Hết ${ROUNDS} vòng mà chưa trả đủ đồ chơi.`,
      'Mọi người sống sót đều chết.',
    ],
    tokens: ['Đồ chơi cũ'],
    actions: [
      {
        name: 'Lục tìm đồ chơi', when: 'Mỗi lượt một lần, bạn có thể',
        text: 'Đứng ở phòng có biểu tượng Vật phẩm hoặc Sự kiện chưa ai lục: đổ Tri thức. Mỗi phòng chỉ lục được một lần. Lục tìm gây tiếng động.',
        outcomes: [[`${SEARCH_TARGET}+`, 'Nhận một Đồ chơi cũ.'], [`0–${SEARCH_TARGET - 1}`, 'Không thấy gì.']],
      },
      { name: 'Trả đồ chơi', when: 'Bất cứ lúc nào trong lượt', text: 'Đứng ở Phòng trẻ (hoặc Chiếu nghỉ tầng trên): trả mọi đồ chơi đang cầm.' },
    ],
    rules: [
      { title: 'Bị bắt', text: `Khi Ma xó bước vào phòng bạn đang đứng, đổ Tốc độ. ${FLEE_TARGET}+ là trốn kịp. Dưới ${FLEE_TARGET}: bạn bị bắt, mất 2 Tinh thần và làm rơi hết đồ chơi tại chỗ.` },
      { title: 'Tiếng động', text: 'Mở phòng mới hoặc lục tìm đồ chơi thì Ma xó biết chính xác bạn ở phòng nào. Còn lại nó chỉ biết bạn ở tầng nào.' },
      { title: 'Đồ chơi', text: 'Đồ chơi rơi trên sàn thì ai cũng nhặt được; trao được cho đồng đội cùng phòng.' },
    ],
    tips: ['Đừng tụ một chỗ: Ma xó bắt được cả nhóm trong một bước. Người nhanh nhất nên chạy đồ chơi về.'],
    ifWin: 'Món đồ chơi cuối cùng về lại góc phòng. Tiếng cười tắt dần, người bạn của các bạn mở mắt, ngơ ngác không nhớ mình vừa chơi trò gì.',
  },

  setup(state) {
    const t = state.players[traitorId(state)];
    state.haunt.data = {
      catches: 0, returned: 0, toysMade: 0, searched: [], rounds: 0,
      heroesAtStart: aliveHeroes(state).length, caughtThisTurn: [], noisy: {}, tiles: tileCount(state), heard: {},
    };
    enqueueFront(state, [{ op: 'gain', trait: 'speed', amount: 2, playerId: t.id }]);
    addLog(state, '🙈 Ma xó bắt đầu đi tìm. Nó không nhìn thấy các bạn, nhưng nghe được tiếng động.', 'haunt');
  },

  areEnemies() {
    return false;
  },

  canBeAttacked() {
    return false;
  },

  onTurnStart(state) {
    const d = data(state);
    d.caughtThisTurn = [];
    d.tiles = tileCount(state);
  },

  onPlayerEnter(state, player, pos) {
    const d = data(state);
    if (isTraitor(state, player.id)) {
      const ops = [];
      for (const h of aliveHeroes(state)) {
        if (!samePos(h.pos, pos) || d.caughtThisTurn.includes(h.id)) continue;
        d.caughtThisTurn.push(h.id);
        d.heard[h.id] = posKey(pos);
        ops.push(rollOp(h.id, 'speed', 'Trốn Ma xó', { op: 'trontim:flee' }));
      }
      if (ops.length) {
        addLog(state, `👻 Ma xó bước vào ${roomName(state, pos)}: «Thấy rồi nhé!»`, 'haunt');
        enqueueFront(state, ops);
      }
      return;
    }
    if (tileCount(state) > d.tiles) {
      d.noisy[player.id] = true;
      d.tiles = tileCount(state);
    }
  },

  onExplorerTurnEnd(state, player) {
    const d = data(state);
    if (isTraitor(state, player.id) || !player.alive) return [];
    if (d.noisy[player.id]) {
      d.heard[player.id] = posKey(player.pos);
      hear(state, `Có tiếng động từ ${roomName(state, player.pos)}: ${player.name} ở đó.`);
    } else {
      d.heard[player.id] = player.pos.floor;
      hear(state, `Bạn nghe loáng thoáng ${player.name} ở ${FLOOR_WORD[player.pos.floor] ?? player.pos.floor}.`);
    }
    d.noisy[player.id] = false;
    return [];
  },

  onPlayerDeath(state, player) {
    dropTokens(state, player);
  },

  onRoundEnd(state) {
    data(state).rounds += 1;
  },

  // Ma xó không thấy người sống sót (trừ khi chung phòng), cũng không đọc được dòng di chuyển của họ.
  maskView(state, viewerId, view) {
    if (!isTraitor(state, viewerId) || state.winner) return;
    const me = state.players[viewerId];
    const heroIds = Object.values(state.players).filter((p) => p.id !== viewerId).map((p) => p.id);
    for (const id of heroIds) {
      if (!me.pos || !state.players[id].pos || !samePos(state.players[id].pos, me.pos)) view.players[id].pos = null;
    }
    view.log = view.log.filter((l) => !(heroIds.includes(l.actor) && (l.kind === 'move' || l.kind === 'info')));
  },

  specialActions(state, playerId) {
    return isTraitor(state, playerId) ? traitorActions(state) : heroActions(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    const me = state.players[playerId];
    const d = data(state);
    if (isTraitor(state, playerId)) {
      if (action.actionId !== 'listen' || state.turn.usedSpecial) throw new GameError('Không thể làm vậy lúc này.');
      state.turn.usedSpecial = true;
      const count = {};
      for (const h of aliveHeroes(state)) count[h.pos.floor] = (count[h.pos.floor] ?? 0) + 1;
      hear(state, `Bạn lắng nghe: ${Object.keys(FLOOR_WORD).map((f) => `${FLOOR_WORD[f]} ${count[f] ?? 0} người`).join(', ')}.`);
      addLog(state, 'Ma xó đứng im, nghiêng đầu lắng nghe…', 'haunt');
      return;
    }
    if (handleTokenAction(state, playerId, action)) return;
    const option = heroActions(state, me).find((a) => a.actionId === action.actionId);
    if (!option) throw new GameError('Không thể làm vậy lúc này.');
    if (action.actionId === 'return') {
      const toys = tokensOf(state, me.id).filter((t) => t.kind === 'toy');
      for (const t of toys) removeToken(state, t.id);
      d.returned += toys.length;
      addLog(state, `🧸 ${me.name} trả ${toys.length} đồ chơi về chỗ cũ (${d.returned}/${TOYS_NEEDED}).`, 'haunt');
      return;
    }
    state.turn.usedSpecial = true;
    d.noisy[me.id] = true;
    enqueueFront(state, [rollOp(playerId, 'knowledge', 'Lục tìm đồ chơi', { op: 'trontim:search', key: posKey(me.pos) })]);
  },

  // Bot Ma xó chỉ dùng thông tin nó nghe được (không gian lận nhìn vị trí thật).
  botTargets(state, me) {
    const d = data(state);
    if (isTraitor(state, me.id)) {
      const out = [];
      for (const h of aliveHeroes(state)) {
        const heard = d.heard[h.id];
        if (!heard) continue;
        if (heard.includes(',') || heard.includes(':')) out.push(heard);
        else out.push(...rooms(state, (pos) => pos.floor === heard));
      }
      return out.length ? out : rooms(state);
    }
    if (tokensOf(state, me.id).some((t) => t.kind === 'toy')) return [nurseryKey(state)];
    const dropped = Object.keys(tokenDisplay(state).marks ?? {});
    const searchable = rooms(state, (pos, def) => (def.symbol === 'item' || def.symbol === 'event')).filter((k) => !d.searched.includes(k));
    return [...dropped, ...searchable];
  },

  publicData(state, viewerId) {
    const d = data(state);
    const tokens = tokenDisplay(state);
    const marks = {};
    for (const k of d.searched) (marks[k] ??= []).push({ kind: 'cleansed', label: 'Đã lục tìm' });
    const nk = nurseryKey(state);
    if (nk) (marks[nk] ??= []).push({ kind: 'nest', label: 'Chỗ trả đồ chơi' });
    return {
      meters: [
        { id: 'toys', label: 'Đồ chơi đã trả', value: d.returned, max: TOYS_NEEDED, tone: 'good' },
        { id: 'catches', label: 'Số lần bị bắt', value: d.catches, max: catchesNeeded(state), tone: 'danger' },
        { id: 'rounds', label: 'Vòng đã qua', value: d.rounds, max: ROUNDS, tone: 'neutral' },
      ],
      notes: [
        nk ? `Trả đồ chơi ở ${roomName(state, posOf(state, nk))}.` : null,
        isTraitor(state, viewerId) ? 'Bạn không thấy người sống sót trừ khi chung phòng. Xem nhật ký để nghe tiếng động.' : null,
      ].filter(Boolean),
      marks: mergeMarks(marks, tokens.marks),
      carried: tokens.carried,
    };
  },

  checkVictory(state) {
    const d = data(state);
    if (d.returned >= TOYS_NEEDED) return { side: 'heroes', reason: 'Đồ chơi đã về đủ chỗ cũ.' };
    if (d.catches >= catchesNeeded(state)) return { side: 'traitor', reason: 'Ma xó đã bắt đủ người.' };
    if (d.rounds >= ROUNDS) return { side: 'traitor', reason: 'Trò trốn tìm kéo dài mãi mãi.' };
    if (!aliveHeroes(state).length) return { side: 'traitor', reason: 'Không còn ai để trốn.' };
    return null;
  },
};
