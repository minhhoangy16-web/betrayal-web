// HAUNT «Vòng lặp thời gian» – Kẻ phản bội giấu mặt. Một chiếc nhẫn cũ khoá cả nhóm trong một đêm lặp đi lặp lại.
// Mỗi vòng lặp, ai không kịp về chiếu nghỉ / sảnh thì bị thời gian xé toạc tâm trí. Phải phá chiếc nhẫn (người phá
// nhẫn cần đứng ở các phòng có nhiễu loạn thời gian cùng đồng đội) rồi giết Kẻ phản bội.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { randInt } from '../engine/rng.js';
import { TRAITS } from '../engine/constants.js';
import { shiftTrait, startIndex } from '../engine/traits.js';
import { TILES_BY_ID } from '../data/index.js';
import {
  playersInPlay, tileDefAt, rollOp, tilePos, rooms, addToken, giveTokenTo, dropTokens, tokenDisplay, mergeMarks,
} from './helpers.js';

const BREAK_TARGET = 6;
const SAFE_TILES = ['entrance-hall', 'foyer', 'upper-landing', 'basement-landing'];
const RING = 'nhan-thoi-gian';
const tileName = (id) => TILES_BY_ID[id].name;

const data = (state) => state.haunt.data;
const traitorId = (state) => state.haunt.traitorId;
const traitor = (state) => state.players[traitorId(state)];
const alive = (state) => playersInPlay(state).filter((p) => p.alive);
const heroes = (state) => alive(state).filter((p) => p.id !== traitorId(state));
const ringHolder = (state) => data(state).tokens?.[RING]?.holder ?? null;
const onSafeTile = (state, p) => SAFE_TILES.includes(tileDefAt(state, p.pos).id);
// Phòng có nhiễu loạn thời gian: mọi phòng có biểu tượng Điềm báo.
const onRift = (state, p) => tileDefAt(state, p.pos).symbol === 'omen';

function sendToLanding(state, p) {
  const spots = SAFE_TILES.map((t) => tilePos(state, t)).filter(Boolean);
  p.pos = { ...spots[randInt(state, spots.length)] };
}

function reveal(state, how, empowered = true) {
  const d = data(state);
  if (d.revealed) return;
  const t = traitor(state);
  d.revealed = true;
  t.side = 'traitor';
  addLog(state, `👁 ${how} ${t.name} chính là kẻ giữ vòng lặp!`, 'haunt');
  if (t.alive && empowered) {
    for (const trait of TRAITS) t.traits[trait] = Math.max(t.traits[trait], startIndex(t, trait));
    shiftTrait(state, t, 'might', 1);
  }
}

registerOp('vonglap:break', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  const helpers = alive(state).filter((p) => p.id !== traitorId(state) || !d.revealed)
    .filter((p) => onRift(state, p)).length;
  const total = it.total + helpers;
  if (total >= BREAK_TARGET) {
    d.broken = true;
    addLog(state, `💥 ${me.name} bóp vỡ chiếc nhẫn (${it.total} +${helpers} nhiễu loạn = ${total})! Vòng lặp vỡ tan.`, 'haunt');
    if (!d.revealed) reveal(state, 'Khi chiếc nhẫn vỡ, bóng của một người không còn khớp với họ nữa:', false);
  } else {
    addLog(state, `${me.name} cố phá nhẫn (${total}) nhưng thời gian giật ngược lại. Đau như bị xé làm đôi.`, 'haunt');
    sendToLanding(state, me);
    enqueueFront(state, [{ op: 'damage', type: 'general', amount: 6, playerId: me.id, source: 'haunt' }]);
  }
});

// Cuối mỗi vòng: vòng lặp quay lại.
registerOp('vonglap:loop', (state) => {
  const d = data(state);
  if (state.winner || d.broken) return;
  d.counter -= 1;
  addLog(state, `⏳ Đồng hồ quả lắc điểm chuông. Đêm nay bắt đầu lại. Còn ${d.counter} vòng lặp.`, 'haunt');
  const ops = [];
  for (const p of alive(state)) {
    if (d.revealed && p.id === traitorId(state)) continue;
    if (!onSafeTile(state, p)) ops.push({ op: 'damage', type: 'mental', amount: 2, playerId: p.id, source: 'haunt' });
  }
  if (ops.length) enqueueFront(state, ops);
});

function specials(state, me) {
  if (!me.alive) return [];
  const d = data(state);
  const out = [];
  if (ringHolder(state) === me.id && !d.broken && !state.turn.usedSpecial) {
    out.push({ type: 'special', actionId: 'break', trait: 'speed', label: `Phá nhẫn bằng Tốc độ (+1 mỗi người ở phòng nhiễu loạn, cần ${BREAK_TARGET}+)` });
    out.push({ type: 'special', actionId: 'break', trait: 'knowledge', label: `Phá nhẫn bằng Tri thức (+1 mỗi người ở phòng nhiễu loạn, cần ${BREAK_TARGET}+)` });
  }
  if (me.id === traitorId(state) && !d.revealed) out.push({ type: 'special', actionId: 'reveal', label: 'Lộ mặt: hồi đầy chỉ số, +1 Sức mạnh, đẩy mọi người về chiếu nghỉ' });
  // Trao nhẫn: ai cũng trao được cho ai cùng phòng (không để lộ Kẻ phản bội).
  if (ringHolder(state) === me.id) {
    for (const p of alive(state)) {
      if (p.id === me.id || !samePos(p.pos, me.pos)) continue;
      out.push({ type: 'special', actionId: 'give', targetId: p.id, label: `Trao nhẫn cho ${p.name}` });
    }
  }
  const t = data(state).tokens[RING];
  if (!t.holder && t.at === posKey(me.pos)) out.push({ type: 'special', actionId: 'pick', label: 'Nhặt chiếc nhẫn' });
  return out;
}

export default {
  id: 'haunt-vong-lap',
  name: 'Vòng lặp thời gian',
  mode: 'hidden',
  hiddenTraitor: true,
  traitor: { rule: 'random' },
  traitorLabel: 'Bí mật (ngẫu nhiên)',

  publicIntro:
    'Đồng hồ quả lắc ở sảnh điểm mười hai tiếng. Rồi lại điểm mười hai tiếng. Các bạn nhận ra mình vừa nói đúng những câu ' +
    'đã nói một tiếng trước. Đêm nay đang lặp lại, và chỉ một người trong nhóm không hề ngạc nhiên.',

  traitorTome: {
    title: 'Sách Kẻ phản bội – Vòng lặp thời gian',
    intro:
      'Bạn đã sống đêm này hàng trăm lần. Bạn biết từng câu họ sắp nói, từng bước họ sắp đi. Chiếc nhẫn giữ bạn trẻ mãi trong vòng lặp. ' +
      'Chỉ cần họ không phá được nó trước khi thời gian của họ cạn hết.',
    setup: [
      'Game chọn ngẫu nhiên Kẻ phản bội: chính là bạn. Không ai khác biết.',
      'Người lật Haunt đang giữ chiếc nhẫn. Thanh đếm vòng lặp bắt đầu ở 6/5/4/3 (bàn 3/4/5/6 người).',
    ],
    objective: 'Bạn thắng khi thanh đếm vòng lặp về 0, hoặc khi mọi người khác đều chết.',
    lose: ['Chiếc nhẫn bị phá VÀ bạn chết.'],
    tokens: ['Chiếc nhẫn', 'Thanh đếm vòng lặp'],
    actions: [{ name: 'Lộ mặt', when: 'Bất cứ lúc nào trong lượt của bạn, khi còn giấu mặt, bạn có thể', text: 'Hồi đầy mọi chỉ số, +1 Sức mạnh, và mọi người khác bị đẩy về một phòng chiếu nghỉ / sảnh ngẫu nhiên.' }],
    rules: [
      { title: 'Khi nhẫn bị phá', text: 'Nếu bạn còn giấu mặt, bạn bị lộ ngay và KHÔNG được hồi chỉ số. Muốn được hồi đầy và +1 Sức mạnh, hãy tự lộ mặt trước.' },
      { title: 'Cuối mỗi vòng', text: 'Thanh đếm −1. Ai không đứng ở phòng chiếu nghỉ / sảnh thì chịu 2 sát thương tinh thần (cả bạn, nếu còn giấu mặt).' },
      { title: 'Khi còn giấu mặt', text: 'Không ai tấn công được ai. Bạn trông như mọi người khác, kể cả các nút hành động.' },
    ],
    tips: ['Nếu được giữ nhẫn, cứ «thử» phá nhẫn ở chỗ không ai đứng cùng để chắc chắn trượt.'],
    ifWin: 'Đồng hồ điểm mười hai tiếng lần cuối cùng của họ. Bạn đứng dậy, chỉnh lại cổ áo, chờ những vị khách mới cho vòng lặp kế tiếp.',
  },

  survivalSecrets: {
    title: 'Sách Người sống sót – Vòng lặp thời gian',
    intro:
      'Chiếc nhẫn khắc hình con rắn tự cắn đuôi. Nó giữ cả ngôi nhà trong một đêm không bao giờ hết. Một người trong nhóm đã sống ' +
      'đêm này rất nhiều lần, và muốn giữ nó mãi như vậy.',
    setup: [
      'Kẻ phản bội được chọn ngẫu nhiên và giấu mặt. Có thể là bất kỳ ai, trừ bạn.',
      'Người lật Haunt đang giữ chiếc nhẫn. Thanh đếm vòng lặp bắt đầu ở 6/5/4/3 (bàn 3/4/5/6 người).',
      'Phòng có nhiễu loạn thời gian: mọi phòng có biểu tượng Điềm báo.',
    ],
    objective: 'Các bạn thắng khi chiếc nhẫn đã bị phá VÀ Kẻ phản bội đã chết.',
    lose: ['Thanh đếm vòng lặp về 0.', 'Mọi người sống sót đều chết.'],
    tokens: ['Chiếc nhẫn', 'Thanh đếm vòng lặp'],
    actions: [
      {
        name: 'Phá nhẫn', when: 'Mỗi lượt một lần, nếu giữ nhẫn, bạn có thể',
        text: 'Đổ Tốc độ hoặc Tri thức, cộng 1 cho mỗi người đang đứng ở một phòng có nhiễu loạn thời gian (kể cả bạn).',
        outcomes: [
          [`${BREAK_TARGET}+`, 'Chiếc nhẫn vỡ. Kẻ phản bội nếu còn giấu mặt thì bị lộ ngay. Nếu hắn đã chết thì các bạn thắng.'],
          [`0–${BREAK_TARGET - 1}`, 'Chịu 6 sát thương tổng hợp và bị đẩy về một phòng chiếu nghỉ / sảnh ngẫu nhiên.'],
        ],
      },
      { name: 'Trao nhẫn', when: 'Bất cứ lúc nào trong lượt, nếu giữ nhẫn, bạn có thể', text: 'Trao nhẫn cho một người cùng phòng (cẩn thận: có thể đó là Kẻ phản bội).' },
    ],
    rules: [
      { title: 'Cuối mỗi vòng', text: 'Thanh đếm −1. Ai không đứng ở Sảnh vào, Tiền sảnh, Chiếu nghỉ tầng trên hoặc Chiếu nghỉ tầng hầm thì chịu 2 sát thương tinh thần.' },
      { title: 'Khi Kẻ phản bội còn giấu mặt', text: 'Không ai tấn công được ai.' },
    ],
    tips: ['Trước khi phá nhẫn, rủ mọi người đứng ở các phòng nhiễu loạn để được cộng điểm, rồi kịp chạy về chiếu nghỉ.'],
    ifWin: 'Đồng hồ quả lắc đứng hẳn lại. Ngoài cửa sổ, lần đầu tiên sau rất lâu, trời bắt đầu hửng sáng.',
  },

  setup(state) {
    const n = state.turnOrder.length;
    state.haunt.data = { counter: { 3: 8, 4: 7, 5: 6 }[n] ?? 5, broken: false, revealed: false, tokens: {} };
    addToken(state, { id: RING, kind: 'ring', label: 'Chiếc nhẫn', holder: state.haunt.revealerId });
    addLog(state, `⏳ Chiếc nhẫn trên tay ${state.players[state.haunt.revealerId].name} siết lại. Đêm nay sẽ lặp lại ${data(state).counter} lần.`, 'haunt');
  },

  areEnemies(state, a, b) {
    if (!data(state).revealed) return false;
    return (a.id === traitorId(state)) !== (b.id === traitorId(state));
  },

  // Vòng lặp quay lại vào cuối mỗi vòng (bản gốc: cuối lượt người lật Haunt).
  onRoundEnd(state) {
    if (!state.winner) enqueueFront(state, [{ op: 'vonglap:loop' }]);
  },

  onPlayerDeath(state, player) {
    dropTokens(state, player);
    if (player.id === traitorId(state) && !data(state).revealed) reveal(state, 'Khi trút hơi thở cuối, người đó già đi trăm tuổi trong chớp mắt:');
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    const me = state.players[playerId];
    const option = specials(state, me).find((a) => a.actionId === action.actionId
      && (a.trait ?? null) === (action.trait ?? null) && (a.targetId ?? null) === (action.targetId ?? null));
    if (!option) throw new GameError('Không thể làm vậy lúc này.');
    if (action.actionId === 'break') {
      state.turn.usedSpecial = true;
      enqueueFront(state, [rollOp(playerId, action.trait, 'Phá nhẫn', { op: 'vonglap:break' })]);
    } else if (action.actionId === 'give') {
      giveTokenTo(state, RING, action.targetId);
      addLog(state, `${me.name} trao chiếc nhẫn cho ${state.players[action.targetId].name}.`, 'haunt');
    } else if (action.actionId === 'pick') {
      giveTokenTo(state, RING, me.id);
      addLog(state, `${me.name} nhặt chiếc nhẫn lên.`, 'haunt');
    } else {
      reveal(state, `${me.name} cười khẩy và xoay chiếc đồng hồ ngược chiều:`);
      for (const p of alive(state)) if (p.id !== me.id) sendToLanding(state, p);
      addLog(state, 'Thời gian giật ngược. Mọi người bị ném về các chiếu nghỉ.', 'haunt');
    }
  },

  botTargets(state, me) {
    const d = data(state);
    if (me.id === traitorId(state) && d.revealed) return heroes(state).map((p) => posKey(p.pos));
    if (ringHolder(state) === me.id && !d.broken) return rooms(state, (pos, def) => def.symbol === 'omen');
    if (d.broken && d.revealed && traitor(state).alive) return [posKey(traitor(state).pos)];
    return SAFE_TILES.map((t) => tilePos(state, t)).filter(Boolean).map(posKey);
  },

  botSkip(state, me, action) {
    if (action.actionId === 'reveal') return true;
    if (action.actionId === 'give' || action.actionId === 'pick') return action.actionId === 'give';
    if (action.actionId === 'break' && me.id === traitorId(state)) return true;
    return false;
  },

  publicData(state) {
    const d = data(state);
    const tokens = tokenDisplay(state);
    const holder = ringHolder(state);
    const marks = {};
    for (const k of rooms(state, (pos, def) => def.symbol === 'omen')) (marks[k] ??= []).push({ kind: 'watched', label: 'Nhiễu loạn thời gian' });
    return {
      meters: [{ id: 'counter', label: 'Vòng lặp còn lại', value: d.counter, max: 6, tone: 'bad' }],
      notes: [
        d.broken ? 'Chiếc nhẫn đã vỡ.' : (holder ? `${state.players[holder].name} đang giữ chiếc nhẫn.` : 'Chiếc nhẫn đang nằm trên sàn.'),
        d.revealed ? `Kẻ phản bội là ${traitor(state).name}.` : 'Kẻ phản bội vẫn đang giấu mặt.',
      ],
      marks: mergeMarks(marks, tokens.marks),
      carried: tokens.carried,
    };
  },

  checkVictory(state) {
    const d = data(state);
    if (d.broken && !traitor(state).alive) return { side: 'heroes', reason: 'Chiếc nhẫn đã vỡ và kẻ giữ vòng lặp đã chết.' };
    if (d.counter <= 0) return { side: 'traitor', reason: 'Vòng lặp khép lại mãi mãi.' };
    if (!heroes(state).length) return { side: 'traitor', reason: 'Không còn ai để phá vòng lặp.' };
    return null;
  },
};
