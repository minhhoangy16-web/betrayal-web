// HAUNT «Nhẫn ảo ảnh» – Kẻ phản bội (người lật Haunt) đeo chiếc nhẫn tạo ảo ảnh: hắn biến mất khỏi bàn cờ và hiện ra
// thành nhiều bản giống hệt nhau, chỉ một bản là thật. Người sống sót phải xua tan ảo ảnh để tìm ra hắn và giết hắn.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { randInt, shuffle } from '../engine/rng.js';
import { TRAITS } from '../engine/constants.js';
import { traitValue } from '../engine/traits.js';
import { CARDS_BY_ID } from '../data/index.js';
import { playersInPlay, tileDefAt, spawnMonster, rollOp, chooseOp, distances, posOf } from './helpers.js';

const FACE_TARGET = 5;
const CALL_TARGET = 8;
const MIRROR = 'om-girl-in-mirror';
const CALL_TILES = ['chapel', 'ritual-chamber'];

const data = (state) => state.haunt.data;
const traitorId = (state) => state.haunt.traitorId;
const traitor = (state) => state.players[traitorId(state)];
const heroes = (state) => playersInPlay(state).filter((p) => p.alive && p.side === 'hero');
const illusions = (state) => Object.values(state.monsters).filter((m) => m.type === 'ao-anh');
const isIllusion = (state, ref) => ref?.kind === 'monster' && state.monsters[ref.id]?.type === 'ao-anh';
const omenCount = (player) => player.cards.filter((c) => CARDS_BY_ID[c]?.type === 'omen').length;

function traitorTraits(state) {
  const t = traitor(state);
  return Object.fromEntries(TRAITS.map((k) => [k, traitValue(t, k)]));
}

// Rải ảo ảnh trong phạm vi Tốc độ của Kẻ phản bội; một bản ngẫu nhiên là thật.
function summon(state) {
  const d = data(state);
  const t = traitor(state);
  const dist = distances(state, t.pos);
  const reach = traitValue(t, 'speed');
  const spots = [...dist.entries()].filter(([, dd]) => dd <= reach).map(([k]) => k);
  const keys = shuffle(state, spots);
  for (const m of illusions(state)) delete state.monsters[m.id];
  const count = Math.max(1, d.count);
  for (let i = 0; i < count; i++) {
    d.made += 1;
    spawnMonster(state, { id: `ao-anh-${d.made}`, type: 'ao-anh', name: `Bóng hình ${i + 1}`, traits: traitorTraits(state) }, keys[i % keys.length]);
  }
  d.real = illusions(state)[randInt(state, illusions(state).length)].id;
  d.hidden = true;
  d.justSummoned = true;
  addLog(state, `💍 ${t.name} xoay chiếc nhẫn và tan biến. ${count} bóng hình giống hệt hắn xuất hiện quanh nhà.`, 'haunt');
}

// Xua tan một ảo ảnh. Trúng bản thật thì Kẻ phản bội hiện ra.
function dispel(state, monsterId, by) {
  const d = data(state);
  const m = state.monsters[monsterId];
  if (!m) return;
  if (monsterId === d.real) {
    const t = traitor(state);
    t.pos = { ...m.pos };
    for (const x of illusions(state)) delete state.monsters[x.id];
    d.hidden = false;
    d.real = null;
    d.count = Math.max(1, d.count - 1);
    addLog(state, `✨ ${by} chạm vào bóng hình và nó không tan: ${t.name} hiện nguyên hình! Mọi ảo ảnh biến mất.`, 'haunt');
  } else {
    delete state.monsters[monsterId];
    addLog(state, `${by} xua tan một ảo ảnh. Chỉ còn làn khói mỏng.`, 'haunt');
  }
}

registerOp('aoanh:face', (state, it) => {
  const me = state.players[it.playerId];
  const total = it.total + (me.cards.includes(MIRROR) ? 2 : 0);
  if (total >= FACE_TARGET) dispel(state, it.monsterId, me.name);
  else {
    addLog(state, `${me.name} nhìn mãi mà không phân biệt được thật giả (${total}).`, 'haunt');
    enqueueFront(state, [{ op: 'damage', type: 'mental', dice: 1, playerId: me.id, source: 'haunt' }]);
  }
});

registerOp('aoanh:call', (state, it) => {
  const me = state.players[it.playerId];
  const total = it.total + omenCount(me);
  const d = data(state);
  if (total < CALL_TARGET) {
    addLog(state, `${me.name} gọi tên chiếc nhẫn nhưng nó không đáp (${total}).`, 'haunt');
    return;
  }
  if (!d.hidden && traitor(state).alive) {
    addLog(state, `💍 Chiếc nhẫn siết chặt tay ${traitor(state).name} (${total}).`, 'haunt');
    enqueueFront(state, [{ op: 'damage', type: 'mental', dice: 1, playerId: traitorId(state), source: 'haunt' }]);
    return;
  }
  const options = illusions(state).map((m) => ({ id: m.id, label: `${m.name} ở ${tileDefAt(state, m.pos).name}` }));
  if (options.length) enqueueFront(state, [chooseOp(me.id, 'Xua tan ảo ảnh nào?', options, { op: 'aoanh:dispel' }, { always: true })]);
});

registerOp('aoanh:dispel', (state, it) => dispel(state, it.choice, state.players[it.playerId].name));

function specials(state, me) {
  if (!me.alive) return [];
  const d = data(state);
  const out = [];
  if (me.side === 'hero' && !state.turn.usedSpecial) {
    for (const m of illusions(state).filter((x) => samePos(x.pos, me.pos))) {
      out.push({ type: 'special', actionId: 'face', targetId: m.id, label: `Đối mặt ảo ảnh (đổ Tri thức${me.cards.includes(MIRROR) ? ' +2' : ''}, cần ${FACE_TARGET}+)` });
    }
    if (CALL_TILES.includes(tileDefAt(state, me.pos).id)) {
      out.push({ type: 'special', actionId: 'call', label: `Gọi tên chiếc nhẫn (đổ Tinh thần +${omenCount(me)}, cần ${CALL_TARGET}+)` });
    }
  }
  if (me.id === traitorId(state) && !d.hidden && !state.turn.usedSpecial) {
    out.push({ type: 'special', actionId: 'summon', label: 'Gọi ảo ảnh (biến mất, rải ảo ảnh quanh mình, kết thúc lượt)' });
  }
  return out;
}

export default {
  id: 'haunt-nhan-ao-anh',
  name: 'Nhẫn ảo ảnh',
  traitor: { rule: 'revealer' },

  publicIntro:
    'Chiếc nhẫn trên tay người bạn loé sáng. Người đó mỉm cười, rồi có tới năm người giống hệt nhau cùng mỉm cười ' +
    'từ khắp các góc nhà.',

  monsterCards: [{ name: 'Ảo ảnh', controller: 'Kẻ phản bội', traits: { might: '*', speed: '*', sanity: '*', knowledge: '*' }, rules: [
    'Có chỉ số giống hệt Kẻ phản bội. Chỉ một ảo ảnh là thật (là chính Kẻ phản bội).',
    'Không đổ xúc xắc khi đi: đi đúng bằng Tốc độ. Không mở phòng mới, không bị choáng.',
    'Bị đánh thắng hoặc bị «Đối mặt» thành công thì tan biến. Trúng bản thật thì Kẻ phản bội hiện nguyên hình.',
  ] }],

  traitorTome: {
    title: 'Sách Kẻ phản bội – Nhẫn ảo ảnh',
    intro: 'Chiếc nhẫn cho bạn thấy những gì bạn muốn thấy, và cho họ thấy những gì bạn muốn họ thấy. Đêm nay bạn muốn họ thấy rất nhiều bản của bạn.',
    setup: [
      'Nhân vật của bạn rời bàn cờ. Có 3/4/5/6 ảo ảnh (bàn 3/4/5/6 người) xuất hiện trong phạm vi Tốc độ của bạn; một trong số đó là bạn.',
      'Chỉ bạn biết ảo ảnh nào là thật (ghi trên bảng tình hình của bạn).',
    ],
    objective: 'Bạn thắng khi mọi người sống sót đều chết.',
    lose: ['Bạn chết.'],
    tokens: ['Ảo ảnh'],
    actions: [{ name: 'Gọi ảo ảnh', when: 'Mỗi lượt một lần, khi đã hiện nguyên hình, bạn có thể', text: 'Biến mất khỏi bàn cờ và rải lại ảo ảnh quanh mình (mỗi lần bị lộ thì bớt một ảo ảnh). Lượt của bạn kết thúc.' }],
    rules: [
      { title: 'Khi đang ẩn', text: 'Bạn không đi, chỉ điều khiển các ảo ảnh trong lượt quái. Không ai đánh được bạn.' },
      { title: 'Khi bị lộ', text: 'Mọi ảo ảnh biến mất, bạn xuất hiện ở chỗ ảo ảnh thật và chơi như người thường.' },
    ],
    tips: ['Đưa ảo ảnh giả lên trước để hút các lần «Đối mặt», giữ bản thật ở phía sau.'],
    ifWin: 'Người cuối cùng nhìn khắp phòng và thấy toàn khuôn mặt bạn. Họ không bao giờ biết bản nào là thật.',
  },

  survivalSecrets: {
    title: 'Sách Người sống sót – Nhẫn ảo ảnh',
    intro: 'Một trong những bóng hình kia là người bạn đã phản bội các bạn. Những bóng còn lại chỉ là ảo ảnh, nhưng đánh vẫn đau như thật.',
    setup: ['Kẻ phản bội là người lật Haunt, đã biến vào các ảo ảnh. Chỉ một ảo ảnh là thật.'],
    objective: 'Các bạn thắng khi giết được Kẻ phản bội.',
    lose: ['Mọi người sống sót đều chết.'],
    tokens: ['Ảo ảnh'],
    actions: [
      {
        name: 'Đối mặt ảo ảnh', when: 'Mỗi lượt một lần, bạn có thể',
        text: 'Đứng cùng phòng với một ảo ảnh: đổ Tri thức. Cầm «Cô bé trong gương» thì cộng 2 vào kết quả.',
        outcomes: [[`${FACE_TARGET}+`, 'Xua tan ảo ảnh. Nếu đó là bản thật, Kẻ phản bội hiện nguyên hình.'], [`0–${FACE_TARGET - 1}`, 'Chịu 1 xúc xắc sát thương tinh thần.']],
      },
      {
        name: 'Gọi tên chiếc nhẫn', when: 'Mỗi lượt một lần, bạn có thể',
        text: 'Đứng ở Nhà nguyện hoặc Phòng tế lễ: đổ Tinh thần, cộng 1 cho mỗi thẻ Điềm báo bạn đang cầm.',
        outcomes: [[`${CALL_TARGET}+`, 'Nếu Kẻ phản bội đã hiện hình: hắn chịu 1 xúc xắc sát thương tinh thần. Nếu chưa: xua tan một ảo ảnh tuỳ chọn.'], [`0–${CALL_TARGET - 1}`, 'Không có gì.']],
      },
    ],
    rules: [{ title: 'Đánh ảo ảnh', text: 'Đánh thắng một ảo ảnh cũng xua tan được nó.' }],
    tips: ['Khi Kẻ phản bội hiện hình, dồn đánh ngay trước khi hắn gọi ảo ảnh lại.'],
    ifWin: 'Chiếc nhẫn rơi xuống sàn, lăn mấy vòng rồi nằm im. Không ai dám nhặt nó lên.',
  },

  setup(state) {
    state.haunt.data = { count: state.turnOrder.length, made: 0, real: null, hidden: false, justSummoned: false };
    summon(state);
  },

  // Đang ẩn: không có phần đi; không ai đánh được hay bị cản bởi Kẻ phản bội.
  skipExplorer(state, playerId) {
    return playerId === traitorId(state) && data(state).hidden;
  },
  areEnemies(state, a, b) {
    if (data(state).hidden && (a.id === traitorId(state) || b.id === traitorId(state))) return false;
    return undefined;
  },

  onTurnStart(state, playerId) {
    const d = data(state);
    if (playerId !== traitorId(state)) return;
    d.justSummoned = false;
    const traits = traitorTraits(state);
    for (const m of illusions(state)) m.traits = { ...traits };
  },

  monsterMoveCount(state, monster) {
    if (monster.type !== 'ao-anh') return null;
    return data(state).justSummoned ? 0 : monster.traits.speed;
  },

  onCombatLoss(state, loser, amount, trait, winner) {
    if (!isIllusion(state, loser)) return undefined;
    dispel(state, loser.id, winner?.kind === 'player' ? state.players[winner.id].name : 'Ai đó');
    return true;
  },

  maskView(state, viewerId, view) {
    if (viewerId !== traitorId(state) && data(state).hidden && view.players[traitorId(state)]) view.players[traitorId(state)].pos = null;
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    const me = state.players[playerId];
    if (!specials(state, me).some((a) => a.actionId === action.actionId && (a.targetId ?? null) === (action.targetId ?? null))) {
      throw new GameError('Không thể làm vậy lúc này.');
    }
    state.turn.usedSpecial = true;
    if (action.actionId === 'face') enqueueFront(state, [rollOp(playerId, 'knowledge', 'Đối mặt ảo ảnh', { op: 'aoanh:face', monsterId: action.targetId })]);
    else if (action.actionId === 'call') enqueueFront(state, [rollOp(playerId, 'sanity', 'Gọi tên chiếc nhẫn', { op: 'aoanh:call' })]);
    else {
      summon(state);
      state.turn.movesLeft = 0;
      state.turn.hasAttacked = true;
    }
  },

  botTargets(state, me) {
    if (me.side !== 'hero') return heroes(state).map((p) => posKey(p.pos));
    const d = data(state);
    return d.hidden ? illusions(state).map((m) => posKey(m.pos)) : [posKey(traitor(state).pos)];
  },

  publicData(state, viewerId) {
    const d = data(state);
    const isTraitor = viewerId === traitorId(state);
    const real = d.real && state.monsters[d.real];
    return {
      meters: [{ id: 'illusions', label: 'Ảo ảnh còn lại', value: illusions(state).length, max: state.turnOrder.length, tone: 'bad' }],
      notes: [
        d.hidden ? 'Kẻ phản bội đang ẩn trong các ảo ảnh.' : `${traitor(state).name} đang hiện nguyên hình!`,
        isTraitor && real ? `Bạn đang là ảo ảnh ở ${tileDefAt(state, real.pos).name}.` : null,
      ].filter(Boolean),
      marks: isTraitor && real ? { [posKey(real.pos)]: [{ kind: 'body', label: 'Bạn thật' }] } : {},
    };
  },

  checkVictory(state) {
    if (!traitor(state).alive) return { side: 'heroes', reason: 'Kẻ đeo nhẫn ảo ảnh đã chết.' };
    if (!heroes(state).length) return { side: 'traitor', reason: 'Không ai phân biệt được thật giả.' };
    return null;
  },
};
