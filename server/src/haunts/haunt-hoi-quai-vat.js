// HAUNT «Đêm hội quái vật» – Kẻ phản bội (người lật Haunt) bị giết ngay và điều khiển 1–3 quái vật chọn ngẫu nhiên
// trong Hồn ma, Ma cà rồng, Người sói. Người sống sót phải tìm đúng vũ khí khắc chế từng con.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { resolveCombat } from '../engine/combat.js';
import { killPlayer, traitValue } from '../engine/traits.js';
import { shuffle } from '../engine/rng.js';
import { CARDS_BY_ID } from '../data/index.js';
import { playersInPlay, spawnMonster, tileDefAt, wallSteps, distances, rollOp, chooseOp, roomOption, posOf, roomLabel } from './helpers.js';

const SEARCH_TARGET = 4;
const MONSTERS = {
  ghost: { id: 'hon-ma', type: 'hon-ma', name: 'Hồn ma', traits: { might: 4, speed: 4, sanity: 5, knowledge: 5 } },
  vampire: { id: 'ma-ca-rong', type: 'ma-ca-rong', name: 'Ma cà rồng', traits: { might: 5, speed: 4, sanity: 5, knowledge: 5 } },
  werewolf: { id: 'nguoi-soi', type: 'nguoi-soi', name: 'Người sói', traits: { might: 6, speed: 4, sanity: 4, knowledge: 4 } },
};
// Vũ khí khắc chế (thẻ trong game này).
const BANE = {
  ghost: ['it-charm', 'om-silver-necklace'],
  vampire: ['it-old-revolver', 'it-fire-axe'],
  werewolf: ['om-ritual-knife', 'it-rusty-machete'],
};
const kindOf = (state, monsterId) => Object.keys(MONSTERS).find((k) => MONSTERS[k].id === monsterId && state.monsters[monsterId]);
const data = (state) => state.haunt.data;
const heroes = (state) => playersInPlay(state).filter((p) => p.alive && p.side === 'hero');
const holdsBane = (player, kind) => BANE[kind].some((c) => player.cards.includes(c));
const baneNames = (kind) => BANE[kind].map((c) => CARDS_BY_ID[c].name).join(' hoặc ');

registerOp('quaivat:search', (state, it) => {
  const me = state.players[it.playerId];
  if (it.total < SEARCH_TARGET) {
    addLog(state, `${me.name} lục lọi mà chỉ thấy toàn đồ bỏ.`, 'haunt');
    return;
  }
  const deck = it.deck;
  const top = state.decks[deck].slice(0, 4);
  if (!top.length) {
    addLog(state, `Chồng bài ${deck === 'item' ? 'Vật phẩm' : 'Điềm báo'} đã hết.`, 'haunt');
    return;
  }
  enqueueFront(state, [chooseOp(me.id, 'Chọn một thẻ để giữ (các thẻ còn lại xuống đáy chồng)',
    top.map((c) => ({ id: c, label: `${CARDS_BY_ID[c].name}: ${CARDS_BY_ID[c].text ?? ''}` })),
    { op: 'quaivat:take', deck, top }, { always: true, secret: true })]);
});

registerOp('quaivat:take', (state, it) => {
  const me = state.players[it.playerId];
  const rest = it.top.filter((c) => c !== it.choice);
  state.decks[it.deck] = [...state.decks[it.deck].filter((c) => !it.top.includes(c)), ...rest];
  me.cards.push(it.choice);
  const card = CARDS_BY_ID[it.choice];
  addLog(state, `🔎 ${me.name} tìm được «${card.name}».`, 'haunt');
  if (card.onGain?.length) enqueueFront(state, card.onGain.map((e) => ({ ...e, playerId: me.id, cardId: it.choice })));
});

// Hồn ma «Hù»: đẩy người bị hù đi tối đa số phòng bằng Tốc độ của họ.
registerOp('quaivat:boo-push', (state, it) => {
  const victim = state.players[it.victimId];
  if (!victim?.alive || it.choice === 'stay') return;
  victim.pos = posOf(state, it.choice);
  addLog(state, `👻 ${victim.name} hoảng loạn chạy tới ${roomLabel(state, victim.pos)}.`, 'haunt');
});

registerOp('quaivat:howl', (state, it) => {
  const wolf = state.monsters[MONSTERS.werewolf.id];
  if (!wolf || state.winner) return;
  const [next, ...rest] = it.targets.filter((id) => state.players[id]?.alive && samePos(state.players[id].pos, wolf.pos));
  if (!next) return;
  if (rest.length) enqueueFront(state, [{ op: 'quaivat:howl', targets: rest }]);
  resolveCombat(state, { kind: 'monster', id: wolf.id }, { kind: 'player', id: next }, 'might');
});

function specials(state, me) {
  if (state.turn.usedSpecial || !me.alive || me.side !== 'hero') return [];
  const sym = tileDefAt(state, me.pos).symbol;
  if (sym !== 'item' && sym !== 'omen') return [];
  return [{ type: 'special', actionId: 'search', label: `Tìm vũ khí (đổ Tri thức, cần ${SEARCH_TARGET}+: xem 4 thẻ ${sym === 'item' ? 'Vật phẩm' : 'Điềm báo'}, giữ 1)` }];
}

export default {
  id: 'haunt-hoi-quai-vat',
  name: 'Đêm hội quái vật',
  traitor: { rule: 'revealer' },

  publicIntro:
    'Hội cư dân thuê các bạn tới dọn sạch «những thứ không được phép cư trú» trong căn nhà. Không ai nói trước là có tới mấy thứ. ' +
    'Người đầu tiên mở miệng cười trong bóng tối đã không kịp kêu lên.',

  monsterCards: [
    { name: 'Hồn ma', controller: 'Kẻ phản bội', traits: MONSTERS.ghost.traits, rules: [
      'Đi xuyên tường sang phòng kề cạnh. Không bị choáng.',
      '«Hù» (thay cho đòn thường): đòn Tinh thần vào một người cùng phòng, rồi đẩy người đó đi tối đa số phòng bằng Tốc độ của họ.',
      `Chỉ bị diệt khi người cầm ${baneNames('ghost')} đánh thắng bằng Tinh thần.`,
    ] },
    { name: 'Ma cà rồng', controller: 'Kẻ phản bội', traits: MONSTERS.vampire.traits, rules: [
      '«Hút máu» (thay cho đòn thường): đòn Sức mạnh, +1 vào kết quả cho mỗi dấu Máu đang có, rồi thêm 1 dấu Máu.',
      `Bị diệt khi người cầm ${baneNames('vampire')} đánh thắng; người khác đánh thắng chỉ làm nó choáng.`,
    ] },
    { name: 'Người sói', controller: 'Kẻ phản bội', traits: MONSTERS.werewolf.traits, rules: [
      '«Hú» (thay cho đòn thường): lần lượt tấn công bằng Sức mạnh mọi người trong phòng.',
      `Bị diệt khi người cầm ${baneNames('werewolf')} đánh thắng; người khác đánh thắng chỉ làm nó choáng.`,
    ] },
  ],

  traitorTome: {
    title: 'Sách Kẻ phản bội – Đêm hội quái vật',
    intro:
      'Bọn người được thuê tới «dọn dẹp» đã tìm thấy bạn trước. Nhưng ngôi nhà này chưa bao giờ chỉ có một chủ. ' +
      'Khi hơi thở cuối cùng rời khỏi bạn, những cư dân cũ của ngôi nhà thức dậy và nghe theo lời bạn.',
    setup: [
      'Nhân vật của bạn chết ngay. Từ giờ bạn chỉ điều khiển quái vật, thay cho lượt của mình.',
      'Chọn ngẫu nhiên 1/2/2/3 quái vật (bàn 3/4/5/6 người) trong Hồn ma, Ma cà rồng, Người sói. Chúng xuất hiện ở chỗ xác bạn.',
    ],
    objective: 'Bạn thắng khi mọi người sống sót đều chết.',
    lose: ['Mọi quái vật của bạn đều bị diệt.'],
    tokens: ['Hồn ma, Ma cà rồng, Người sói (quái vật lớn)', 'Dấu Máu (của Ma cà rồng)'],
    rules: [{ title: 'Thay cho lượt của bạn', text: 'Điều khiển từng quái vật đang có trong nhà, theo thứ tự tuỳ ý. Mỗi con tự đổ Tốc độ để biết số bước.' }],
    tips: ['Người sống sót cần đúng vũ khí mới diệt được quái: đánh vào người đang cầm vũ khí trước.'],
    ifWin:
      'Kẻ đột nhập cuối cùng nằm im. Bạn nhìn ra cửa sổ và thấy nhà hàng xóm vừa dựng bộ đèn trang trí loè loẹt. ' +
      'Thật là quái gở. Phải báo hội cư dân mới được.',
  },

  survivalSecrets: {
    title: 'Sách Người sống sót – Đêm hội quái vật',
    intro:
      'Quy định của hội cư dân rất rõ: cấm dán quảng cáo, cấm mở nhạc to, và cấm cho quái vật ở. Điều cuối là lý do các bạn có mặt. ' +
      'Đuổi một con đã khó. Còn nếu chúng không chỉ có một con thì sao?',
    setup: ['Người lật Haunt là Kẻ phản bội, đã chết và điều khiển quái vật.', 'Người ngồi bên trái Kẻ phản bội đi lượt đầu tiên.'],
    objective: 'Các bạn thắng khi diệt hết quái vật trong nhà, bằng đúng vũ khí khắc chế từng con.',
    lose: ['Mọi người sống sót đều chết.'],
    tokens: ['Hồn ma, Ma cà rồng, Người sói'],
    actions: [{
      name: 'Tìm vũ khí', when: 'Mỗi lượt một lần, bạn có thể',
      text: 'Đứng ở phòng có biểu tượng Vật phẩm hoặc Điềm báo: đổ Tri thức.',
      outcomes: [
        [`${SEARCH_TARGET}+`, 'Xem 4 thẻ trên cùng của chồng Vật phẩm (phòng Vật phẩm) hoặc Điềm báo (phòng Điềm báo). Giữ 1 thẻ, các thẻ còn lại xuống đáy chồng.'],
        [`0–${SEARCH_TARGET - 1}`, 'Không có gì.'],
      ],
    }],
    rules: [
      { title: 'Đúng vũ khí', text: 'Cầm đúng vũ khí khắc chế thì được thêm 2 xúc xắc khi đánh con quái đó.' },
      { title: 'Khi bạn đánh Hồn ma', text: `Nếu cầm ${baneNames('ghost')}, bạn và Hồn ma cùng đổ Tinh thần; thắng thì Hồn ma bị diệt. Không có thì Hồn ma không hề hấn gì.` },
      { title: 'Khi bạn đánh Ma cà rồng', text: `Nếu cầm ${baneNames('vampire')} và thắng, Ma cà rồng bị diệt.` },
      { title: 'Khi bạn đánh Người sói', text: `Nếu cầm ${baneNames('werewolf')} và thắng, Người sói bị diệt.` },
    ],
    tips: ['Chưa có vũ khí thì đừng đứng chung phòng với Người sói.'],
    ifWin:
      'Con quái cuối cùng gục xuống. Trước khi về, bạn đặt lại tấm thảm chùi chân ngay ngắn trước cửa. ' +
      'Mọi thứ đúng chỗ của nó, và không ai phải bị thương thêm nữa.',
  },

  setup(state) {
    const n = state.turnOrder.length;
    const count = { 3: 1, 4: 2, 5: 2 }[n] ?? 3;
    const traitor = state.players[state.haunt.traitorId];
    const where = posKey(traitor.pos);
    killPlayer(state, traitor);
    const kinds = shuffle(state, Object.keys(MONSTERS)).slice(0, count);
    for (const k of kinds) spawnMonster(state, MONSTERS[k], where);
    state.haunt.data = { blood: 0, kinds };
    addLog(state, `💀 ${traitor.name} gục xuống. Từ xác họ bò ra: ${kinds.map((k) => MONSTERS[k].name).join(', ')}.`, 'haunt');
  },

  monsterSteps(state, monster) {
    return monster.id === MONSTERS.ghost.id ? wallSteps(state, monster.pos) : undefined;
  },

  attackTraits(state, attacker, target) {
    if (target.kind === 'monster' && kindOf(state, target.id) === 'ghost') {
      return holdsBane(state.players[attacker.id], 'ghost') ? ['sanity'] : ['might'];
    }
    return undefined;
  },

  // Đúng vũ khí khắc chế: +2 xúc xắc khi đánh con quái đó.
  attackBonus(state, attacker, target) {
    if (attacker.kind !== 'player' || target.kind !== 'monster') return 0;
    const kind = kindOf(state, target.id);
    return kind && holdsBane(state.players[attacker.id], kind) ? 2 : 0;
  },

  attackResultBonus(state, attacker) {
    return attacker.kind === 'monster' && attacker.id === MONSTERS.vampire.id && data(state).slurping ? data(state).blood : 0;
  },

  monsterSpecialActions(state, monster) {
    const slot = state.turn.monsters[monster.id];
    if (!slot || slot.attacked) return [];
    const kind = kindOf(state, monster.id);
    const here = heroes(state).filter((p) => samePos(p.pos, monster.pos));
    if (!here.length) return [];
    if (kind === 'ghost') return here.map((p) => ({ actionId: 'boo', targetId: p.id, label: `Hù ${p.name} (đòn Tinh thần rồi đẩy đi)` }));
    if (kind === 'vampire') return here.map((p) => ({ actionId: 'slurp', targetId: p.id, label: `Hút máu ${p.name} (+${data(state).blood})` }));
    if (kind === 'werewolf' && here.length > 1) return [{ actionId: 'howl', label: `Hú: đánh cả ${here.length} người trong phòng` }];
    return [];
  },

  performMonsterSpecial(state, playerId, monster, slot, action) {
    slot.attacked = true;
    const d = data(state);
    if (action.actionId === 'boo') {
      const victim = state.players[action.targetId];
      const dist = distances(state, victim.pos);
      const max = traitValue(victim, 'speed');
      const options = [...dist.entries()].filter(([, dd]) => dd > 0 && dd <= max).map(([k]) => roomOption(state, k));
      enqueueFront(state, [chooseOp(playerId, `Đẩy ${victim.name} đi đâu? (tối đa ${max} phòng)`, [{ id: 'stay', label: 'Để yên' }, ...options],
        { op: 'quaivat:boo-push', victimId: victim.id }, { always: true })]);
      resolveCombat(state, { kind: 'monster', id: monster.id }, { kind: 'player', id: victim.id }, 'sanity');
    } else if (action.actionId === 'slurp') {
      d.slurping = true;
      resolveCombat(state, { kind: 'monster', id: monster.id }, { kind: 'player', id: action.targetId }, 'might');
      d.slurping = false;
      d.blood += 1;
      addLog(state, `🩸 Ma cà rồng liếm môi. Dấu Máu: ${d.blood}.`, 'haunt');
    } else if (action.actionId === 'howl') {
      addLog(state, '🐺 Người sói hú dài rồi lao vào tất cả.', 'haunt');
      enqueueFront(state, [{ op: 'quaivat:howl', targets: heroes(state).filter((p) => samePos(p.pos, monster.pos)).map((p) => p.id) }]);
    } else {
      throw new GameError('Chiêu không tồn tại.');
    }
  },

  // Thua trận: Hồn ma không bị choáng; quái bị đúng vũ khí đánh thắng thì bị diệt.
  onCombatLoss(state, loser, amount, trait, winner) {
    if (loser.kind !== 'monster') return undefined;
    const kind = kindOf(state, loser.id);
    if (!kind) return undefined;
    const hero = winner?.kind === 'player' ? state.players[winner.id] : null;
    if (hero && holdsBane(hero, kind) && (kind !== 'ghost' || trait === 'sanity')) {
      addLog(state, `⚔ ${hero.name} diệt được ${state.monsters[loser.id].name}!`, 'haunt');
      delete state.monsters[loser.id];
      return true;
    }
    if (kind === 'ghost') {
      addLog(state, 'Hồn ma tan ra rồi tụ lại, chẳng hề hấn gì.', 'combat');
      return true;
    }
    return undefined;
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    const me = state.players[playerId];
    if (!specials(state, me).some((a) => a.actionId === action.actionId)) throw new GameError('Không thể làm vậy lúc này.');
    state.turn.usedSpecial = true;
    const deck = tileDefAt(state, me.pos).symbol === 'item' ? 'item' : 'omen';
    enqueueFront(state, [rollOp(playerId, 'knowledge', 'Tìm vũ khí', { op: 'quaivat:search', deck })]);
  },

  botTargets(state, me) {
    if (me.side !== 'hero') return null;
    const alive = Object.keys(MONSTERS).filter((k) => state.monsters[MONSTERS[k].id]);
    const armed = alive.filter((k) => holdsBane(me, k));
    if (armed.length) return armed.map((k) => posKey(state.monsters[MONSTERS[k].id].pos));
    return null;
  },

  botChoose(state, actor, pending) {
    if (pending.then?.op !== 'quaivat:take') return null;
    const want = Object.keys(MONSTERS).filter((k) => state.monsters[MONSTERS[k].id]).flatMap((k) => BANE[k]);
    return pending.options.find((o) => want.includes(o.id))?.id ?? null;
  },

  botSkip(state, me, action) {
    if (action.type !== 'attack' || action.targetType !== 'monster') return false;
    const kind = kindOf(state, action.targetId);
    return Boolean(kind) && !holdsBane(me, kind);
  },

  publicData(state) {
    const d = data(state);
    const alive = Object.keys(MONSTERS).filter((k) => state.monsters[MONSTERS[k].id]);
    return {
      meters: [{ id: 'monsters', label: 'Quái vật còn lại', value: alive.length, max: d.kinds.length, tone: 'bad' }],
      notes: [
        `Còn: ${alive.map((k) => MONSTERS[k].name).join(', ') || 'không con nào'}.`,
        ...alive.map((k) => `${MONSTERS[k].name} khắc chế bởi: ${baneNames(k)}.`),
        d.kinds.includes('vampire') ? `Dấu Máu của Ma cà rồng: ${d.blood}.` : null,
      ].filter(Boolean),
    };
  },

  checkVictory(state) {
    const alive = Object.keys(MONSTERS).filter((k) => state.monsters[MONSTERS[k].id]);
    if (!alive.length) return { side: 'heroes', reason: 'Con quái vật cuối cùng đã bị diệt.' };
    if (!heroes(state).length) return { side: 'traitor', reason: 'Không còn ai sống để đuổi quái vật đi.' };
    return null;
  },
};
