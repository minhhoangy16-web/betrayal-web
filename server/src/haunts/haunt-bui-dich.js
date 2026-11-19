// HAUNT «Bụi dịch» – Kẻ phản bội giấu mặt và lây lan. Mỗi người cầm 3 thẻ bệnh kín; ai từng cầm thẻ «nhiễm» là đã
// nhiễm bụi vĩnh viễn và chuyển sang phe Kẻ phản bội (chỉ chính họ biết). Cuối lượt đứng chung phòng thì phải đổi thẻ;
// không đổi được với ai thì bụi ăn mòn cơ thể. Người sống sót phải nghiên cứu và chế thuốc giải.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { randInt, shuffle } from '../engine/rng.js';
import { resolveCombat } from '../engine/combat.js';
import { TRAITS } from '../engine/constants.js';
import { TILES_BY_ID } from '../data/index.js';
import { playersInPlay, tileDefAt, rollOp, spawnMonster, distances, stepToward, rooms } from './helpers.js';

const RESEARCH_TARGET = 4;
const CURE_TARGET = 12;
const LAB_TILES = ['study', 'library', 'furnace-room', 'tower'];
const FEVERISH = { type: 'ke-sot', name: 'Kẻ sốt', traits: { might: 6, speed: 5, sanity: 3, knowledge: 3 }, ai: true };
const TRAIT_WORD = { might: 'Sức mạnh', speed: 'Tốc độ', sanity: 'Tinh thần', knowledge: 'Tri thức' };
const labNames = LAB_TILES.map((id) => TILES_BY_ID[id].name).join(', ');

const data = (state) => state.haunt.data;
const alive = (state) => playersInPlay(state).filter((p) => p.alive);
const infected = (state, id) => data(state).infected.includes(id);
const clean = (state) => alive(state).filter((p) => !infected(state, p.id));
const feverish = (state) => Object.values(state.monsters).filter((m) => m.type === FEVERISH.type);

function infect(state, id) {
  const d = data(state);
  if (d.infected.includes(id)) return;
  d.infected.push(id);
  state.players[id].side = 'traitor';
  addLog(state, '🦠 Bạn vừa nhận một thẻ bệnh mang bụi. Bạn đã nhiễm, vĩnh viễn. Từ giờ bạn thuộc phe Kẻ phản bội: hãy lây cho người khác.', 'haunt', id);
}

// Đổi một thẻ ngẫu nhiên giữa hai người.
function swap(state, aId, bId) {
  const d = data(state);
  const A = d.tokens[aId];
  const B = d.tokens[bId];
  if (!A?.length || !B?.length) return;
  const i = randInt(state, A.length);
  const j = randInt(state, B.length);
  [A[i], B[j]] = [B[j], A[i]];
  if (A.includes(1)) infect(state, aId);
  if (B.includes(1)) infect(state, bId);
}

function leftOf(state, id) {
  const order = state.turnOrder;
  for (let k = 1; k < order.length; k++) {
    const p = state.players[order[(order.indexOf(id) + k) % order.length]];
    if (p.alive) return p.id;
  }
  return null;
}

registerOp('bui:research', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  if (it.total >= RESEARCH_TARGET) {
    d.research.push(it.key);
    addLog(state, `🔬 ${me.name} ghi chép được một mẫu bụi (Nghiên cứu: ${d.research.length}).`, 'haunt');
  } else {
    const left = leftOf(state, me.id);
    addLog(state, `${me.name} hít phải bụi khi thu mẫu. Bụi muốn lan đi…`, 'haunt');
    if (left) swap(state, me.id, left);
  }
});

registerOp('bui:cure', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  const total = it.total + d.research.length * 2;
  if (total >= CURE_TARGET) {
    d.cured = true;
    addLog(state, `💉 ${me.name} chế xong thuốc giải (${total})!`, 'haunt');
  } else {
    addLog(state, `${me.name} pha thuốc hỏng (${total}). Bụi muốn lan đi…`, 'haunt');
    const left = leftOf(state, me.id);
    if (left) swap(state, me.id, left);
  }
});

// Cuối lượt: đổi thẻ với từng người cùng phòng; không đổi được với ai thì chịu 2 xúc xắc sát thương tổng hợp.
registerOp('bui:endturn', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  if (!me?.alive || state.winner) return;
  const others = alive(state).filter((p) => p.id !== me.id && samePos(p.pos, me.pos));
  for (const p of others) swap(state, me.id, p.id);
  if (others.length) {
    addLog(state, `${me.name} đứng gần ${others.map((p) => p.name).join(', ')}. Bụi bay qua bay lại giữa họ.`, 'haunt');
  } else if (!d.swapped) {
    addLog(state, `${me.name} không đổi thẻ với ai. Cơn sốt bùng lên.`, 'haunt');
    enqueueFront(state, [{ op: 'damage', type: 'general', dice: 2, playerId: me.id, source: 'haunt' }]);
  }
});

// Lượt ngôi nhà: Kẻ sốt lao về phía người chưa nhiễm gần nhất.
registerOp('bui:fever', (state) => {
  for (const m of feverish(state)) {
    if (!state.monsters[m.id] || state.winner) continue;
    for (let i = 0; i < m.traits.speed; i++) {
      const dist = distances(state, m.pos);
      let target = null;
      for (const p of clean(state)) {
        const dd = dist.get(posKey(p.pos));
        if (dd !== undefined && (!target || dd < target.d)) target = { p, d: dd };
      }
      if (!target || target.d === 0) break;
      const step = stepToward(state, m.pos, target.p.pos);
      if (!step) break;
      m.pos = step.pos;
    }
    const here = clean(state).filter((p) => samePos(p.pos, m.pos));
    if (here.length) resolveCombat(state, { kind: 'monster', id: m.id }, { kind: 'player', id: here[randInt(state, here.length)].id }, 'might');
  }
});

function specials(state, me) {
  if (!me.alive) return [];
  const d = data(state);
  const out = [];
  const def = tileDefAt(state, me.pos);
  const key = posKey(me.pos);
  if (!state.turn.usedSpecial) {
    if (def.symbol === 'omen' && !d.research.includes(key)) {
      out.push({ type: 'special', actionId: 'research', trait: 'knowledge', label: `Thu mẫu bụi bằng Tri thức (cần ${RESEARCH_TARGET}+)` });
      out.push({ type: 'special', actionId: 'research', trait: 'sanity', label: `Thu mẫu bụi bằng Tinh thần (cần ${RESEARCH_TARGET}+)` });
    }
    if (LAB_TILES.includes(def.id)) {
      for (const t of TRAITS) out.push({ type: 'special', actionId: 'cure', trait: t, label: `Chế thuốc giải bằng ${TRAIT_WORD[t]} (+${d.research.length * 2}, cần ${CURE_TARGET}+)` });
    }
  }
  if (!d.swapped) {
    for (const p of alive(state)) {
      if (p.id === me.id || !samePos(p.pos, me.pos)) continue;
      out.push({ type: 'special', actionId: 'trade', targetId: p.id, label: `Đổi một thẻ bệnh với ${p.name}` });
    }
  }
  return out;
}

export default {
  id: 'haunt-bui-dich',
  name: 'Bụi dịch',
  mode: 'hidden',
  hiddenTraitor: true,
  traitor: { rule: 'none' },
  traitorLabel: 'Bí mật: ai từng cầm thẻ nhiễm bụi',

  publicIntro:
    'Lớp bụi đỏ trong căn phòng kín bay lên khi cửa mở. Ai cũng ho. Vài phút sau, có người bắt đầu thấy mọi thứ ngả sang màu đỏ, ' +
    'và một cơn thèm khát kỳ lạ muốn đứng thật gần những người còn lại.',

  monsterCards: [{ name: FEVERISH.name, controller: 'Ngôi nhà', traits: FEVERISH.traits, rules: [
    'Người đã nhiễm bụi mà chết vì cơn sốt cuối lượt thì trở thành Kẻ sốt.',
    'Cuối mỗi vòng, Kẻ sốt lao về phía người chưa nhiễm gần nhất và tấn công bằng Sức mạnh. Thua thì bị choáng.',
  ] }],

  traitorTome: {
    title: 'Sách Kẻ phản bội – Bụi dịch',
    intro:
      'Bạn thấy mọi thứ đỏ rực, và bạn thấy rất khoẻ. Bụi muốn đi tiếp, muốn được ở trong tất cả mọi người. Bạn sẽ giúp nó. ' +
      'Chỉ cần đứng thật gần họ, càng lâu càng tốt.',
    setup: ['Bạn đã cầm phải thẻ bệnh nhiễm bụi. Không ai khác biết, trừ những người cũng đã nhiễm.', 'Bạn vẫn chơi như mọi người, kể cả các nút hành động.'],
    objective: 'Bạn (cùng mọi người đã nhiễm) thắng khi mọi người còn sống đều đã nhiễm bụi, hoặc mọi người chưa nhiễm đều chết.',
    lose: ['Người sống sót chế được thuốc giải.'],
    tokens: ['Thẻ bệnh (3 thẻ kín mỗi người)'],
    rules: [
      { title: 'Lây lan', text: 'Cuối lượt, nếu đứng chung phòng với ai, bạn đổi ngẫu nhiên một thẻ bệnh với từng người đó. Ai nhận thẻ nhiễm là bị nhiễm vĩnh viễn, kể cả khi sau này mất thẻ đó.' },
      { title: 'Cơn sốt', text: 'Nếu cả lượt không đổi thẻ với ai, cuối lượt chịu 2 xúc xắc sát thương tổng hợp. Người đã nhiễm chết vì cơn sốt thì thành Kẻ sốt.' },
    ],
    tips: ['Hãy tỏ ra hăng hái nghiên cứu, rồi đứng chung phòng với người chưa nhiễm.'],
    ifWin: 'Cả nhóm ùa ra khỏi ngôi nhà trong cơn sốt, hướng về phía thị trấn. Bụi về với bụi.',
  },

  survivalSecrets: {
    title: 'Sách Người sống sót – Bụi dịch',
    intro: 'Lớp bụi đỏ đó là một thứ bệnh. Ai đó trong nhóm đã nhiễm và không biết chừng còn đang cố lây cho các bạn. Phải chế được thuốc giải trước.',
    setup: [
      'Mỗi người cầm 3 thẻ bệnh kín (chỉ mình thấy, trên bảng tình hình). Trong cả bàn có 1 thẻ nhiễm (2 thẻ nếu bàn 6 người).',
      'Ai đang cầm thẻ nhiễm lúc này là đã nhiễm. Bạn biết mình đã nhiễm hay chưa, nhưng không biết người khác.',
    ],
    objective: 'Các bạn thắng khi chế được thuốc giải.',
    lose: ['Mọi người còn sống đều đã nhiễm bụi, hoặc mọi người chưa nhiễm đều chết.'],
    tokens: ['Thẻ bệnh', 'Dấu Nghiên cứu'],
    actions: [
      {
        name: 'Thu mẫu bụi', when: 'Mỗi lượt một lần, bạn có thể',
        text: 'Đứng ở phòng có biểu tượng Điềm báo chưa có dấu Nghiên cứu: đổ Tri thức hoặc Tinh thần.',
        outcomes: [[`${RESEARCH_TARGET}+`, 'Đặt một dấu Nghiên cứu lên phòng này.'], [`0–${RESEARCH_TARGET - 1}`, 'Đổi ngẫu nhiên một thẻ bệnh với người ngồi bên trái. Bụi muốn lan đi.']],
      },
      {
        name: 'Chế thuốc giải', when: 'Mỗi lượt một lần, bạn có thể',
        text: `Đứng ở phòng làm thuốc được (${labNames}): đổ một chỉ số bất kỳ, cộng 2 cho mỗi dấu Nghiên cứu trong nhà.`,
        outcomes: [[`${CURE_TARGET}+`, 'Các bạn thắng!'], [`0–${CURE_TARGET - 1}`, 'Đổi ngẫu nhiên một thẻ bệnh với người ngồi bên trái.']],
      },
      { name: 'Kiềm chế', when: 'Mỗi lượt một lần, bạn có thể', text: 'Đổi ngẫu nhiên một thẻ bệnh với một người cùng phòng. Làm vậy thì cuối lượt không bị cơn sốt.' },
    ],
    rules: [
      { title: 'Cuối lượt của bạn', text: 'Nếu đứng chung phòng với ai, đổi ngẫu nhiên một thẻ bệnh với từng người đó. Ai nhận thẻ nhiễm là bị nhiễm vĩnh viễn.' },
      { title: 'Cơn sốt', text: 'Nếu cả lượt không đổi thẻ với ai (bằng Kiềm chế hoặc đứng chung phòng lúc cuối lượt), chịu 2 xúc xắc sát thương tổng hợp.' },
      { title: 'Không đánh nhau', text: 'Không ai tấn công được ai; nguy hiểm duy nhất là bụi, cơn sốt và Kẻ sốt.' },
    ],
    tips: ['Đổi thẻ với người bạn tin, đúng lúc. Ở một mình mãi thì cơn sốt sẽ giết bạn.'],
    ifWin: 'Mũi kim đâm vào tay, cơn ho dứt hẳn. Bạn hết thấy màu đỏ, nhưng bụi vẫn lơ lửng khắp nhà. Phải đi ngay, trước khi thuốc hết tác dụng.',
  },

  setup(state) {
    const ids = alive(state).map((p) => p.id);
    const dusty = ids.length >= 6 ? 2 : 1;
    const pool = shuffle(state, [...Array(dusty).fill(1), ...Array(ids.length * 3 - dusty).fill(0)]);
    state.haunt.data = { tokens: {}, infected: [], research: [], cured: false, swapped: false, spawned: 0 };
    ids.forEach((id, i) => { data(state).tokens[id] = pool.slice(i * 3, i * 3 + 3); });
    for (const id of ids) if (data(state).tokens[id].includes(1)) infect(state, id);
    addLog(state, '🦠 Mỗi người nhận 3 thẻ bệnh úp kín. Một vài thẻ trong số đó mang bụi.', 'haunt');
  },

  areEnemies() {
    return false;
  },

  onTurnStart(state) {
    data(state).swapped = false;
  },

  onExplorerTurnEnd(state, player) {
    return [{ op: 'bui:endturn', playerId: player.id }];
  },

  onPlayerDeath(state, player) {
    const d = data(state);
    if (!infected(state, player.id)) return;
    d.spawned += 1;
    spawnMonster(state, { ...FEVERISH, id: `ke-sot-${d.spawned}`, name: `${FEVERISH.name} (${player.name})` }, posKey(player.pos));
    addLog(state, `🔥 Thân xác ${player.name} đứng dậy, nóng hừng hực: Kẻ sốt!`, 'haunt');
  },

  onRoundEnd(state) {
    if (feverish(state).length && !state.winner) enqueueFront(state, [{ op: 'bui:fever' }]);
  },

  // Giấu phe: mỗi người chỉ thấy phe của chính mình (và đồng bọn nếu đã nhiễm cũng không thấy nhau).
  maskView(state, viewerId, view) {
    for (const p of Object.values(view.players)) if (p.id !== viewerId && p.side === 'traitor') p.side = 'hero';
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    const me = state.players[playerId];
    const option = specials(state, me).find((a) => a.actionId === action.actionId
      && (a.trait ?? null) === (action.trait ?? null) && (a.targetId ?? null) === (action.targetId ?? null));
    if (!option) throw new GameError('Không thể làm vậy lúc này.');
    if (action.actionId === 'trade') {
      data(state).swapped = true;
      swap(state, me.id, action.targetId);
      addLog(state, `${me.name} đổi một thẻ bệnh với ${state.players[action.targetId].name}.`, 'haunt');
      return;
    }
    state.turn.usedSpecial = true;
    if (action.actionId === 'research') {
      enqueueFront(state, [rollOp(playerId, action.trait, 'Thu mẫu bụi', { op: 'bui:research', key: posKey(me.pos) })]);
    } else {
      enqueueFront(state, [rollOp(playerId, action.trait, 'Chế thuốc giải', { op: 'bui:cure' })]);
    }
  },

  botTargets(state, me) {
    const d = data(state);
    if (infected(state, me.id)) return clean(state).filter((p) => p.id !== me.id).map((p) => posKey(p.pos));
    if (d.research.length >= 3) return rooms(state, (pos, def) => LAB_TILES.includes(def.id));
    return rooms(state, (pos, def) => def.symbol === 'omen').filter((k) => !d.research.includes(k));
  },

  botSkip(state, me, action) {
    if (action.actionId === 'cure') {
      return infected(state, me.id) || data(state).research.length < 2 || (action.trait !== 'knowledge' && action.trait !== 'might');
    }
    if (action.actionId === 'trade') return !infected(state, me.id);
    if (action.actionId === 'research') return infected(state, me.id);
    return false;
  },

  publicData(state, viewerId) {
    const d = data(state);
    const mine = viewerId ? d.tokens[viewerId] : null;
    const marks = {};
    for (const k of d.research) (marks[k] ??= []).push({ kind: 'lab', label: 'Đã thu mẫu bụi' });
    return {
      meters: [{ id: 'research', label: `Dấu Nghiên cứu (mỗi dấu +2 khi chế thuốc, cần ${CURE_TARGET}+)`, value: d.research.length, max: 6, tone: 'good' }],
      notes: [
        mine ? `Thẻ bệnh của bạn: ${mine.map((n) => (n ? 'NHIỄM' : 'sạch')).join(', ')}.` : null,
        viewerId && infected(state, viewerId) ? 'Bạn ĐÃ NHIỄM bụi: bạn thuộc phe Kẻ phản bội.' : (viewerId ? 'Bạn chưa nhiễm bụi.' : null),
        `Kẻ sốt trong nhà: ${feverish(state).length}.`,
      ].filter(Boolean),
      marks,
    };
  },

  checkVictory(state) {
    if (data(state).cured) return { side: 'heroes', reason: 'Thuốc giải đã được chế xong.' };
    if (!clean(state).length) return { side: 'traitor', reason: 'Bụi đã ở trong tất cả mọi người.' };
    return null;
  },
};
