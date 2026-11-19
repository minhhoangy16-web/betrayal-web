// HAUNT «Hôn lễ hồn ma» – một hồn ma cô dâu nhập vào Kẻ phản bội (Tinh thần thấp nhất, trừ người lật Haunt) để đi tìm
// chiếc nhẫn cưới đã mất. Người sống sót giữ nhẫn bí mật, phải dẫn hồn ma tới bàn thờ (nằm ở căn phòng cuối cùng
// được khám phá) rồi làm lễ cho cô yên nghỉ. Kẻ phản bội không thấy thẻ Điềm báo và không biết ai cầm nhẫn.

import { posKey, samePos, resolveStep } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { shuffle, randInt } from '../engine/rng.js';
import { startIndex } from '../engine/traits.js';
import { CARDS_BY_ID, TILES_BY_ID } from '../data/index.js';
import {
  playersInPlay, spawnMonster, rooms, rollOp, chooseOp, roomOption, distances, posOf, roomLabel, tilePos,
} from './helpers.js';

const RITE_TARGET = 6;
const BRIDESMAID = { type: 'phu-dau', name: 'Phù dâu ma', traits: { might: 3, speed: 3, sanity: 4, knowledge: 2 } };

const data = (state) => state.haunt.data;
const traitorId = (state) => state.haunt.traitorId;
const heroes = (state) => playersInPlay(state).filter((p) => p.alive && p.side === 'hero');
const ringHolder = (state) => data(state).ring;

registerOp('honle:guide', (state, it) => {
  const t = state.players[traitorId(state)];
  const me = state.players[it.playerId];
  const n = it.total;
  if (!n || !t.alive) {
    addLog(state, `${me.name} gọi mà hồn ma không nghe thấy.`, 'haunt');
    return;
  }
  const dist = distances(state, t.pos);
  const options = [...dist.entries()].filter(([, dd]) => dd > 0 && dd <= n).map(([k]) => roomOption(state, k));
  enqueueFront(state, [chooseOp(me.id, `Dẫn hồn ma đi đâu? (tối đa ${n} phòng)`, [{ id: 'stay', label: 'Để yên' }, ...options],
    { op: 'honle:move' }, { always: true })]);
});

registerOp('honle:move', (state, it) => {
  if (it.choice === 'stay') return;
  const t = state.players[traitorId(state)];
  t.pos = posOf(state, it.choice);
  addLog(state, `💍 Ánh nhẫn lấp lánh. Hồn ma bước theo, tới ${roomLabel(state, t.pos)}.`, 'haunt');
  checkAltar(state);
});

registerOp('honle:rite', (state, it) => {
  const me = state.players[it.playerId];
  if (it.total >= RITE_TARGET) {
    data(state).rested = true;
    addLog(state, `🕊 ${me.name} đeo nhẫn vào tay hồn ma cô dâu. Cô mỉm cười rồi tan vào ánh nến.`, 'haunt');
  } else {
    addLog(state, `${me.name} đọc lời nguyện nhưng hồn ma vẫn chưa chịu đi.`, 'haunt');
  }
});

registerOp('honle:give', (state, it) => {
  const d = data(state);
  if (d.ring !== it.playerId) return;
  d.ring = it.choice;
  const hide = [traitorId(state)];
  addLog(state, `💍 ${state.players[it.playerId].name} lén trao nhẫn cưới cho ${state.players[it.choice].name}.`, 'haunt', null, hide);
});

function checkAltar(state) {
  const d = data(state);
  const t = state.players[traitorId(state)];
  if (d.altar && !d.trapped && t.alive && posKey(t.pos) === d.altar) {
    d.trapped = true;
    addLog(state, '🕯 Hồn ma bước vào phòng có bàn thờ và không ra được nữa.', 'haunt');
  }
}

function specials(state, me) {
  if (!me.alive || me.side !== 'hero') return [];
  const d = data(state);
  const out = [];
  const t = state.players[traitorId(state)];
  if (d.ring === me.id) {
    if (!state.turn.usedSpecial && t.alive) out.push({ type: 'special', actionId: 'guide', label: 'Dẫn hồn (đổ Tri thức: kéo hồn ma đi tối đa ngần ấy phòng)' });
    if (!state.turn.usedSpecial && d.altar && posKey(me.pos) === d.altar && samePos(t.pos, me.pos)) {
      out.push({ type: 'special', actionId: 'rite', label: `Làm lễ cho cô dâu yên nghỉ (đổ Tinh thần, cần ${RITE_TARGET}+)` });
    }
    if (heroes(state).some((p) => p.id !== me.id && samePos(p.pos, me.pos))) {
      out.push({ type: 'special', actionId: 'give', label: 'Lén trao nhẫn cưới cho người cùng phòng' });
    }
  }
  return out;
}

export default {
  id: 'haunt-hon-le-hon-ma',
  name: 'Hôn lễ hồn ma',
  traitor: { rule: 'lowestTrait', trait: 'sanity', excludeRevealer: true },
  traitorLabel: 'Tinh thần thấp nhất (trừ người lật Haunt)',

  publicIntro:
    'Chiếc váy cưới cũ trên ma-nơ-canh khẽ lay động dù không có gió. Có tiếng ai đó hỏi rất nhỏ: «Nhẫn của em đâu?». ' +
    'Rồi một người trong nhóm quay lại, mắt ướt đẫm, bước đi như đang đi về phía lễ đường.',

  monsterCards: [{ name: BRIDESMAID.name, controller: 'Kẻ phản bội', traits: BRIDESMAID.traits, rules: [
    'Xuất hiện ở các phòng Điềm báo. Đánh bằng Sức mạnh; thua thì bị choáng một lượt.',
  ] }],

  traitorTome: {
    title: 'Sách Kẻ phản bội – Hôn lễ hồn ma',
    intro:
      'Trăm năm trước, chú rể không tới. Cô dâu chờ mãi trong ngôi nhà này, và chiếc nhẫn cưới biến mất cùng anh ta. ' +
      'Giờ cô đang ở trong bạn. Cô chỉ muốn lấy lại chiếc nhẫn. Ai đang giấu nó?',
    setup: [
      'Bạn bị hồn ma cô dâu nhập. Bạn được đưa tới Sảnh vào.',
      'Có 1/1/2/3 Phù dâu ma (bàn 3/4/5/6 người) xuất hiện ở các phòng Điềm báo; bạn điều khiển chúng.',
      'Bạn không nhìn thấy thẻ Điềm báo của người sống sót, và không biết ai đang giữ nhẫn cưới.',
    ],
    objective: 'Bạn thắng khi lấy được nhẫn cưới: đánh thắng người đang giữ nhẫn.',
    lose: ['Người sống sót làm xong lễ cho cô dâu yên nghỉ.'],
    tokens: ['Phù dâu ma', 'Nhẫn cưới (bị giấu)'],
    rules: [
      { title: 'Hồn ma không chết', text: 'Chỉ số của bạn không bao giờ tụt dưới mức ban đầu.' },
      { title: 'Khi bạn đánh thắng một người sống sót', text: 'Nếu người đó đang giữ nhẫn cưới, bạn lấy được nhẫn và thắng. Nếu không, game báo cho bạn biết họ không có nhẫn.' },
      { title: 'Bàn thờ', text: 'Bàn thờ đặt ở một phòng ngẫu nhiên, cách Sảnh vào ít nhất 3 phòng. Bước vào phòng có bàn thờ thì bạn không ra được nữa.' },
    ],
    tips: ['Người sống sót sẽ cố lôi bạn về bàn thờ: tránh xa phòng đó.'],
    ifWin: 'Chiếc nhẫn vừa khít ngón tay. Cô dâu xoay một vòng trong căn phòng trống, váy cưới tung bay. Lễ cưới cuối cùng cũng diễn ra, chỉ là không có khách nào còn sống để dự.',
  },

  survivalSecrets: {
    title: 'Sách Người sống sót – Hôn lễ hồn ma',
    intro:
      'Chiếc nhẫn cưới nằm trong túi một người trong nhóm. Hồn ma cô dâu đã nhập vào bạn của các bạn để đi tìm nó. ' +
      'Đưa cô tới bàn thờ, đeo nhẫn cho cô, và cô sẽ yên nghỉ. Để cô giật được nhẫn thì không ai còn yên nữa.',
    setup: [
      'Kẻ phản bội là người có Tinh thần thấp nhất, trừ người lật Haunt. Hắn đứng ở Sảnh vào.',
      'Người lật Haunt đang giữ nhẫn cưới. Kẻ phản bội không biết ai giữ nhẫn và không nhìn thấy thẻ Điềm báo của các bạn.',
      'Bàn thờ cưới được đặt ở một phòng ngẫu nhiên cách Sảnh vào ít nhất 3 phòng (đánh dấu trên bàn cờ).',
    ],
    objective: 'Các bạn thắng khi làm xong lễ cho cô dâu yên nghỉ.',
    lose: ['Kẻ phản bội đánh thắng người đang giữ nhẫn cưới.'],
    tokens: ['Nhẫn cưới', 'Bàn thờ'],
    actions: [
      { name: 'Dẫn hồn', when: 'Mỗi lượt một lần, nếu giữ nhẫn, bạn có thể', text: 'Đổ Tri thức. Kéo Kẻ phản bội đi tối đa số phòng bằng kết quả, tới phòng bạn chọn.' },
      {
        name: 'Làm lễ yên nghỉ', when: 'Mỗi lượt một lần, nếu giữ nhẫn, bạn có thể',
        text: 'Đứng ở phòng có bàn thờ, cùng phòng với Kẻ phản bội: đổ Tinh thần.',
        outcomes: [[`${RITE_TARGET}+`, 'Các bạn thắng! Cô dâu yên nghỉ.'], [`0–${RITE_TARGET - 1}`, 'Không có gì.']],
      },
      { name: 'Lén trao nhẫn', when: 'Bất cứ lúc nào trong lượt, nếu giữ nhẫn, bạn có thể', text: 'Trao nhẫn cho một người sống sót cùng phòng. Kẻ phản bội không thấy dòng nhật ký này.' },
    ],
    rules: [
      { title: 'Hồn ma không chết', text: 'Chỉ số của Kẻ phản bội không tụt dưới mức ban đầu. Đừng mong giết được hắn.' },
      { title: 'Nhẫn che chở', text: 'Người giữ nhẫn đổ thêm 2 xúc xắc khi bị Kẻ phản bội đánh.' },
    ],
    tips: ['Đứng gần nhau để trao nhẫn khi người giữ nhẫn gặp nguy.'],
    ifWin: 'Cô dâu nhìn chiếc nhẫn, rồi nhìn các bạn, khẽ cúi đầu. Ngọn nến trên bàn thờ tắt. Người bạn bị nhập ngã khuỵu xuống, ngơ ngác hỏi sao mình lại mặc váy cưới.',
  },

  setup(state) {
    const t = state.players[traitorId(state)];
    t.pos = { ...tilePos(state, 'entrance-hall') };
    const n = state.turnOrder.length;
    state.haunt.data = { ring: state.haunt.revealerId, altar: null, trapped: false, rested: false, won: false, spawned: 0 };
    // Bàn thờ đặt ở một phòng ngẫu nhiên cách Sảnh vào ít nhất 3 phòng (nếu có).
    const dist = distances(state, t.pos);
    const far = rooms(state).filter((k) => (dist.get(k) ?? 0) >= 3);
    const pool = far.length ? far : rooms(state).filter((k) => k !== posKey(t.pos));
    data(state).altar = pool[randInt(state, pool.length)];
    const omenRooms = shuffle(state, rooms(state, (pos, def) => def.symbol === 'omen'));
    for (let i = 0; i < Math.max(1, n - 3); i++) {
      data(state).spawned += 1;
      spawnMonster(state, { ...BRIDESMAID, id: `phu-dau-${i + 1}`, name: `${BRIDESMAID.name} ${i + 1}` }, omenRooms[i % Math.max(1, omenRooms.length)] ?? 'entrance-hall');
    }
    addLog(state, `👰 ${t.name} bước tới Sảnh vào như đi trên lễ đường.`, 'haunt');
  },

  // Nhẫn cưới che chở người giữ: +2 xúc xắc khi bị hồn ma đánh.
  defenseBonus(state, attacker, target) {
    return attacker.kind === 'player' && attacker.id === traitorId(state) && target.kind === 'player' && data(state).ring === target.id ? 2 : 0;
  },

  // Hồn ma: chỉ số Kẻ phản bội không tụt dưới mức ban đầu.
  traitFloor(state, player, trait) {
    return player.id === traitorId(state) ? startIndex(player, trait) : undefined;
  },

  canPlayerEnter(state, player) {
    return player.id === traitorId(state) && data(state).trapped ? false : undefined;
  },

  onPlayerEnter(state) {
    checkAltar(state);
  },

  onCombatWin(state, winner, loser) {
    if (winner.kind !== 'player' || winner.id !== traitorId(state) || loser.kind !== 'player') return;
    const d = data(state);
    if (d.ring === loser.id) {
      d.won = true;
      addLog(state, `💍 Hồn ma giật được nhẫn cưới từ tay ${state.players[loser.id].name}!`, 'haunt');
    } else {
      addLog(state, `${state.players[loser.id].name} không giữ nhẫn cưới.`, 'haunt', winner.id);
    }
  },

  onPlayerDeath(state, player) {
    const d = data(state);
    if (d.ring !== player.id) return;
    const near = heroes(state).find((p) => p.id !== player.id && samePos(p.pos, player.pos)) ?? heroes(state).find((p) => p.id !== player.id);
    d.ring = near?.id ?? null;
    if (near) addLog(state, `💍 Nhẫn cưới lăn tới tay ${near.name}.`, 'haunt', null, [traitorId(state)]);
  },

  // Kẻ phản bội không thấy thẻ Điềm báo của người sống sót.
  maskView(state, viewerId, view) {
    if (viewerId !== traitorId(state)) return;
    for (const p of Object.values(view.players)) {
      if (p.side !== 'hero' && p.id !== viewerId) continue;
      if (p.id === viewerId) continue;
      const hidden = p.cards.filter((c) => CARDS_BY_ID[c]?.type === 'omen').length;
      p.cards = p.cards.filter((c) => CARDS_BY_ID[c]?.type !== 'omen');
      if (hidden) p.hiddenOmens = hidden;
    }
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    const me = state.players[playerId];
    if (!specials(state, me).some((a) => a.actionId === action.actionId)) throw new GameError('Không thể làm vậy lúc này.');
    if (action.actionId === 'give') {
      const options = heroes(state).filter((p) => p.id !== me.id && samePos(p.pos, me.pos)).map((p) => ({ id: p.id, label: p.name }));
      enqueueFront(state, [chooseOp(playerId, 'Trao nhẫn cho ai?', options, { op: 'honle:give' }, { always: true, secret: true })]);
      return;
    }
    state.turn.usedSpecial = true;
    if (action.actionId === 'guide') enqueueFront(state, [rollOp(playerId, 'knowledge', 'Dẫn hồn', { op: 'honle:guide' })]);
    else enqueueFront(state, [rollOp(playerId, 'sanity', 'Làm lễ yên nghỉ', { op: 'honle:rite' })]);
  },

  botTargets(state, me) {
    const d = data(state);
    const t = state.players[traitorId(state)];
    if (me.id === traitorId(state)) return heroes(state).map((p) => posKey(p.pos));
    if (d.ring === me.id && d.altar) return [d.altar];
    if (!d.altar) {
      // Đi khám phá cho hết chồng gạch để lộ bàn thờ.
      return rooms(state).filter((k) => {
        const pos = posOf(state, k);
        if (!state.tileStack.some((id) => TILES_BY_ID[id].floors.includes(pos.floor))) return false;
        for (let dir = 0; dir < 4; dir++) {
          try {
            if (resolveStep(state, pos, { dir }).kind === 'discover') return true;
          } catch { /* tường */ }
        }
        return false;
      });
    }
    return null;
  },

  // Bot: dẫn hồn ma về phía bàn thờ; không dẫn khi chưa biết bàn thờ.
  botChoose(state, actor, pending) {
    if (pending.then?.op !== 'honle:move') return null;
    const d = data(state);
    if (!d.altar) return 'stay';
    const dist = distances(state, posOf(state, d.altar));
    let best = 'stay';
    let bd = dist.get(posKey(state.players[traitorId(state)].pos)) ?? 99;
    for (const o of pending.options) {
      const dd = o.id === 'stay' ? 99 : dist.get(o.id);
      if (dd !== undefined && dd < bd) { bd = dd; best = o.id; }
    }
    return best;
  },

  botSkip(state, me, action) {
    if (action.type === 'attack') return me.side === 'hero';
    if (action.actionId === 'give') return true;
    return action.actionId === 'guide' && !data(state).altar;
  },

  publicData(state, viewerId) {
    const d = data(state);
    const marks = {};
    if (d.altar) marks[d.altar] = [{ kind: 'altar', label: 'Bàn thờ cưới' }];
    const isTraitor = viewerId === traitorId(state);
    return {
      meters: [],
      notes: [
        d.altar ? `Bàn thờ ở ${roomLabel(state, posOf(state, d.altar))}.` : 'Chưa biết bàn thờ ở đâu.',
        d.trapped ? 'Hồn ma đã bị giữ lại trong phòng bàn thờ.' : null,
        isTraitor ? 'Bạn không biết ai đang giữ nhẫn cưới.' : (d.ring ? `${state.players[d.ring].name} đang giữ nhẫn cưới (Kẻ phản bội không biết).` : null),
      ].filter(Boolean),
      marks,
      carried: !isTraitor && d.ring ? { [d.ring]: ['Nhẫn cưới'] } : {},
    };
  },

  checkVictory(state) {
    const d = data(state);
    if (d.won) return { side: 'traitor', reason: 'Hồn ma cô dâu đã lấy lại được nhẫn cưới.' };
    if (d.rested) return { side: 'heroes', reason: 'Cô dâu đã yên nghỉ.' };
    if (!heroes(state).length) return { side: 'traitor', reason: 'Không còn ai giữ được nhẫn.' };
    return null;
  },
};
