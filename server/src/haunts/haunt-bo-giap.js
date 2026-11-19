// HAUNT «Bộ giáp mượn thời» – Kẻ phản bội (người bên trái người lật Haunt) sống nhờ một bộ giáp cổ: ai mặc giáp
// thì bị hút dần tuổi thọ sang hắn. Hắn chết thì sống lại bên bộ giáp. Người sống sót phải gom nguyên liệu
// rồi phá bùa của bộ giáp.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { TRAITS } from '../engine/constants.js';
import { startIndex } from '../engine/traits.js';
import { TILES_BY_ID } from '../data/index.js';
import { playersInPlay, tileDefAt, rollOp, addToken, tokensOf, giveTokenTo, tokenDisplay, posOf } from './helpers.js';

const FIND_TARGET = 5;
const BREAK_TARGET = 6;
const ARMOR = 'bo-giap';
const BREAK_TILES = ['workshop', 'ritual-chamber'];
const INGREDIENTS = {
  sanity: { label: 'Lọ máu khô', tiles: ['crypt', 'garden', 'bathroom'] },
  might: { label: 'Miếng thịt lạ', tiles: ['larder', 'dining-room', 'kitchen'] },
  knowledge: { label: 'Bụi thời gian', tiles: ['furnace-room', 'tower', 'library'] },
  speed: { label: 'Nắm cỏ đêm', tiles: ['wine-cellar', 'conservatory', 'laundry'] },
};
const TRAIT_WORD = { might: 'Sức mạnh', speed: 'Tốc độ', sanity: 'Tinh thần', knowledge: 'Tri thức' };
const tileName = (id) => TILES_BY_ID[id].name;

const data = (state) => state.haunt.data;
const heroes = (state) => playersInPlay(state).filter((p) => p.alive && p.side === 'hero');
const traitor = (state) => state.players[state.haunt.traitorId];
const armorHolder = (state) => data(state).tokens?.[ARMOR]?.holder ?? null;
const needed = (state) => ({ 3: 2, 4: 3 }[state.turnOrder.length] ?? 4);

function armorPos(state) {
  const t = data(state).tokens[ARMOR];
  if (t.holder) return state.players[t.holder].pos;
  return t.at ? posOf(state, t.at) : traitor(state).pos;
}

registerOp('giap:find', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  if (it.total >= FIND_TARGET && !d.found[it.trait]) {
    d.found[it.trait] = posKey(me.pos);
    addLog(state, `🧪 ${me.name} tìm được ${INGREDIENTS[it.trait].label} (${d.foundCount = Object.keys(d.found).length}/4).`, 'haunt');
  } else {
    addLog(state, `${me.name} chưa tìm được ${INGREDIENTS[it.trait].label}.`, 'haunt');
  }
});

registerOp('giap:break', (state, it) => {
  const me = state.players[it.playerId];
  if (it.total >= BREAK_TARGET) {
    data(state).broken = true;
    addLog(state, `💥 ${me.name} đọc xong câu phá bùa. Bộ giáp nứt toác!`, 'haunt');
  } else {
    addLog(state, `${me.name} phá bùa không thành. Bộ giáp như có ý chí riêng.`, 'haunt');
    enqueueFront(state, [{ op: 'lose', trait: 'sanity', amount: 1, playerId: me.id }]);
  }
});

// Cuối lượt Kẻ phản bội: ai đang mặc giáp thì −1 mọi chỉ số, Kẻ phản bội +1 mọi chỉ số.
registerOp('giap:drain', (state) => {
  const holder = armorHolder(state);
  const t = traitor(state);
  if (!holder || holder === t.id || !t.alive) return;
  const victim = state.players[holder];
  addLog(state, `⏳ Bộ giáp hút tuổi thọ của ${victim.name} sang ${t.name}.`, 'haunt');
  enqueueFront(state, [
    ...TRAITS.map((trait) => ({ op: 'lose', trait, amount: 1, playerId: victim.id })),
    ...TRAITS.map((trait) => ({ op: 'gain', trait, amount: 1, playerId: t.id })),
  ]);
});

function specials(state, me) {
  if (state.turn.usedSpecial || !me.alive || me.side !== 'hero') return [];
  const d = data(state);
  const id = tileDefAt(state, me.pos).id;
  const out = [];
  for (const [trait, ing] of Object.entries(INGREDIENTS)) {
    if (!d.found[trait] && ing.tiles.includes(id)) {
      out.push({ type: 'special', actionId: 'find', trait, label: `Tìm ${ing.label} (đổ ${TRAIT_WORD[trait]}, cần ${FIND_TARGET}+)` });
    }
  }
  if (BREAK_TILES.includes(id) && Object.keys(d.found).length >= needed(state)) {
    out.push({ type: 'special', actionId: 'break', label: `Phá bùa bộ giáp (đổ Tinh thần, cần ${BREAK_TARGET}+)` });
  }
  return out;
}

const ingredientList = Object.entries(INGREDIENTS)
  .map(([t, ing]) => `${TRAIT_WORD[t]} – ${ing.label}: ${ing.tiles.map(tileName).join(', ')}`);

export default {
  id: 'haunt-bo-giap',
  name: 'Bộ giáp mượn thời',
  traitor: { rule: 'leftOfRevealer' },

  publicIntro:
    'Trong góc phòng là một bộ giáp cổ, già hơn cả ngôi nhà. Bên trong là một xác khô mặc quần áo của người bạn mới mất tích ' +
    'có mấy hôm. Xác khô vỡ vụn thành bụi. Một người trong nhóm lặng lẽ biến vào bóng tối, rồi trở ra trong bộ đồ lính thời xưa.',

  traitorTome: {
    title: 'Sách Kẻ phản bội – Bộ giáp mượn thời',
    intro:
      'Sáu trăm năm trước bạn tìm thấy bộ giáp này và gắn liền với nó. Ai bước vào trong nó sẽ trả cho bạn những năm tháng còn lại ' +
      'của họ. Đám bạn của những người này cũng vậy. Ngôi nhà vẫn còn nhiều năm tháng để mượn.',
    setup: ['Nhân vật của bạn vẫn ở trong game. Bạn là Kẻ phản bội và đang mặc Bộ giáp.', 'Hồi đầy mọi chỉ số.'],
    objective: 'Bạn thắng khi mọi người sống sót đều chết.',
    lose: ['Người sống sót phá được bùa của bộ giáp.'],
    tokens: ['Bộ giáp'],
    rules: [
      { title: 'Khi bạn đánh thắng một người sống sót bằng Sức mạnh', text: 'Nếu bạn đang mặc Bộ giáp: không gây sát thương, mà mặc Bộ giáp sang người đó.' },
      { title: 'Cuối lượt của bạn', text: 'Nếu một người sống sót đang mặc Bộ giáp: họ −1 mọi chỉ số, bạn +1 mọi chỉ số. Nếu bạn đang mặc thì không có gì.' },
      { title: 'Khi bạn chết', text: 'Cuối vòng đó, bạn sống lại ở chỗ Bộ giáp đang ở, hồi đầy mọi chỉ số, rồi chơi tiếp như thường.' },
    ],
    tips: ['Trao giáp cho người đang làm phép phá bùa để họ yếu đi nhanh nhất.'],
    ifWin: 'Bạn khoác bộ giáp lên người. Đã mấy trăm năm rồi, và nhờ những kẻ cứ tò mò bước vào ngôi nhà này, bạn sẽ còn mặc nó thêm vài trăm năm nữa.',
  },

  survivalSecrets: {
    title: 'Sách Người sống sót – Bộ giáp mượn thời',
    intro:
      'Bộ giáp đó hút tuổi thọ của người mặc nó. Người bạn vừa thay đồ kia sống được tới giờ là nhờ những người như các bạn. ' +
      'Muốn kết thúc, phải gom đủ nguyên liệu rồi phá bùa ngay trong căn phòng thích hợp.',
    setup: ['Kẻ phản bội là người ngồi bên trái người lật Haunt, đang mặc Bộ giáp.', 'Người ngồi bên trái Kẻ phản bội đi lượt đầu tiên.'],
    objective: `Các bạn thắng khi phá được bùa của Bộ giáp.`,
    lose: ['Mọi người sống sót đều chết. Giết Kẻ phản bội không đủ: hắn sẽ sống lại bên bộ giáp.'],
    tokens: ['4 nguyên liệu: Lọ máu khô, Miếng thịt lạ, Bụi thời gian, Nắm cỏ đêm'],
    actions: [
      {
        name: 'Tìm nguyên liệu', when: 'Mỗi lượt một lần, bạn có thể',
        text: `Đứng ở phòng có nguyên liệu, đổ chỉ số tương ứng (mỗi loại chỉ tìm một lần). ${ingredientList.join('. ')}.`,
        outcomes: [[`${FIND_TARGET}+`, 'Có được nguyên liệu đó.'], [`0–${FIND_TARGET - 1}`, 'Không có gì.']],
      },
      {
        name: 'Phá bùa bộ giáp', when: 'Mỗi lượt một lần, bạn có thể',
        text: `Đứng ở ${BREAK_TILES.map(tileName).join(' hoặc ')}, khi đã có ít nhất 2/3/4/4 nguyên liệu (bàn 3/4/5/6 người): đổ Tinh thần.`,
        outcomes: [[`${BREAK_TARGET}+`, 'Các bạn thắng! Bùa của bộ giáp bị phá.'], [`0–${BREAK_TARGET - 1}`, 'Mất 1 Tinh thần. Bộ giáp có ý chí riêng.']],
      },
    ],
    rules: [{ title: 'Bị mặc giáp', text: 'Kẻ phản bội đánh thắng bạn bằng Sức mạnh thì không gây sát thương mà mặc giáp sang bạn. Cuối mỗi lượt của hắn, bạn −1 mọi chỉ số và hắn +1.' }],
    tips: ['Chia nhau tìm nguyên liệu ở nhiều tầng cùng lúc; người mặc giáp nên đi phá bùa trước khi kiệt sức.'],
    ifWin: 'Da người bạn cũ khô lại, hoá đá, rồi rã thành bụi. Thời gian của hắn cuối cùng đã hết.',
  },

  setup(state) {
    const t = traitor(state);
    state.haunt.data = { found: {}, broken: false, revive: false, tokens: {} };
    addToken(state, { id: ARMOR, kind: 'armor', label: 'Bộ giáp', holder: t.id });
    enqueueFront(state, [{ op: 'heal', traits: TRAITS, playerId: t.id }]);
    addLog(state, `🛡 ${t.name} khoác lên mình bộ giáp cổ.`, 'haunt');
  },

  onCombatLoss(state, loser, amount, trait, winner) {
    const t = traitor(state);
    if (trait !== 'might' || winner?.kind !== 'player' || winner.id !== t.id || loser.kind !== 'player') return undefined;
    if (armorHolder(state) !== t.id) return undefined;
    giveTokenTo(state, ARMOR, loser.id);
    addLog(state, `🛡 ${t.name} khoá bộ giáp lên người ${state.players[loser.id].name}.`, 'haunt');
    return true;
  },

  onExplorerTurnEnd(state, player) {
    return player.id === state.haunt.traitorId ? [{ op: 'giap:drain' }] : [];
  },

  onPlayerDeath(state, player) {
    const d = data(state);
    if (player.id === state.haunt.traitorId) {
      d.revive = true;
      if (armorHolder(state) === player.id) d.tokens[ARMOR] = { ...d.tokens[ARMOR], holder: null, at: posKey(player.pos) };
    } else if (armorHolder(state) === player.id) {
      d.tokens[ARMOR] = { ...d.tokens[ARMOR], holder: null, at: posKey(player.pos) };
    }
  },

  // Kẻ phản bội chết: cuối vòng sống lại ở chỗ bộ giáp, hồi đầy chỉ số.
  onRoundEnd(state) {
    const d = data(state);
    const t = traitor(state);
    if (!d.revive || state.winner) return;
    d.revive = false;
    t.alive = true;
    t.pos = { ...armorPos(state) };
    for (const trait of TRAITS) t.traits[trait] = Math.max(t.traits[trait], startIndex(t, trait));
    addLog(state, `⚱ Bộ giáp rung lên. ${t.name} bước ra từ trong đó, lành lặn như chưa từng chết.`, 'haunt');
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    const me = state.players[playerId];
    const option = specials(state, me).find((a) => a.actionId === action.actionId && (a.trait ?? null) === (action.trait ?? null));
    if (!option) throw new GameError('Không thể làm vậy lúc này.');
    state.turn.usedSpecial = true;
    if (action.actionId === 'find') enqueueFront(state, [rollOp(playerId, action.trait, 'Tìm nguyên liệu', { op: 'giap:find', trait: action.trait })]);
    else enqueueFront(state, [rollOp(playerId, 'sanity', 'Phá bùa bộ giáp', { op: 'giap:break' })]);
  },

  publicData(state) {
    const d = data(state);
    const tokens = tokenDisplay(state);
    const holder = armorHolder(state);
    return {
      meters: [{ id: 'found', label: `Nguyên liệu (cần ${needed(state)} để phá bùa)`, value: Object.keys(d.found).length, max: 4, tone: 'good' }],
      notes: [
        holder ? `${state.players[holder].name} đang mặc Bộ giáp.` : 'Bộ giáp đang nằm trên sàn.',
        `Đã có: ${Object.keys(d.found).map((t) => INGREDIENTS[t].label).join(', ') || 'chưa có gì'}.`,
      ],
      marks: tokens.marks,
      carried: tokens.carried,
    };
  },

  checkVictory(state) {
    if (data(state).broken) return { side: 'heroes', reason: 'Bùa của bộ giáp đã bị phá.' };
    if (!heroes(state).length) return { side: 'traitor', reason: 'Không còn ai đủ sức phá bùa.' };
    return null;
  },
};
