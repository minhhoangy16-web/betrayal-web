// HAUNT «Song trùng» – mỗi người sống sót có một bản sao sống sẵn trong nhà, mang khuôn mặt họ (chỉ số ban đầu hạ một nấc).
// Kẻ phản bội (người lật Haunt) đã đeo Mặt nạ và trở thành «người nhà». Bản sao chỉ chết khi bị chính chủ
// hoặc người cầm Mặt nạ đánh trúng; người khác đánh trúng chỉ làm nó choáng.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { TRAITS } from '../engine/constants.js';
import { characterOf, traitValue } from '../engine/traits.js';
import {
  playersInPlay, tileDefAt, spawnMonster, rollOp, chooseOp, addToken, giveTokenTo, dropTokens, tokenActions,
  handleTokenAction, tokenDisplay,
} from './helpers.js';

const SCRY_TARGET = 5;
const SCRY_TILES = ['tower', 'ritual-chamber'];
const MASK = 'mat-na';
const TRAIT_WORD = { might: 'Sức mạnh', speed: 'Tốc độ', sanity: 'Tinh thần', knowledge: 'Tri thức' };

const data = (state) => state.haunt.data;
const heroes = (state) => playersInPlay(state).filter((p) => p.alive && p.side === 'hero');
const twins = (state) => Object.values(state.monsters).filter((m) => m.type === 'song-trung');
const twinOf = (state, monsterId) => data(state).twinOf[monsterId];
const maskHolder = (state) => data(state).tokens?.[MASK]?.holder ?? null;
const baseTraits = (player) => Object.fromEntries(TRAITS.map((t) => {
  const tr = characterOf(player).traits[t];
  return [t, tr.track[Math.max(0, tr.start - 1)]];
}));

registerOp('songtrung:scry', (state, it) => {
  const me = state.players[it.playerId];
  const options = twins(state).filter((m) => !m.stunned).map((m) => ({ id: m.id, label: m.name }));
  if (it.total < SCRY_TARGET || !options.length) {
    addLog(state, `${me.name} nhìn mãi vào quả cầu mà chỉ thấy sương mù.`, 'haunt');
    return;
  }
  enqueueFront(state, [chooseOp(me.id, 'Làm choáng bản sao nào?', options, { op: 'songtrung:stun' }, { always: true })]);
});

registerOp('songtrung:stun', (state, it) => {
  const m = state.monsters[it.choice];
  if (!m) return;
  m.stunned = true;
  addLog(state, `🔮 ${state.players[it.playerId].name} chọc vào hình ảnh trong quả cầu. ${m.name} loạng choạng ngã xuống.`, 'haunt');
});

registerOp('songtrung:spoils', (state, it) => {
  const winner = state.players[it.playerId];
  const loser = state.players[it.loserId];
  if (it.choice === 'steal' && maskHolder(state) === loser.id) {
    giveTokenTo(state, MASK, winner.id);
    addLog(state, `🎭 ${winner.name} giật được Mặt nạ khỏi mặt ${loser.name}!`, 'haunt');
    return;
  }
  enqueueFront(state, [{ op: 'damage', type: 'physical', amount: it.amount, playerId: loser.id, source: 'combat' }]);
});

function specials(state, me) {
  if (!me.alive) return [];
  const out = [];
  if (me.side === 'hero' && !state.turn.usedSpecial && SCRY_TILES.includes(tileDefAt(state, me.pos).id)) {
    out.push({ type: 'special', actionId: 'scry', label: `Soi quả cầu (đổ Tri thức, cần ${SCRY_TARGET}+)` });
  }
  if (me.side === 'traitor' && !state.turn.usedSpecial) {
    for (const m of twins(state).filter((t) => t.stunned && samePos(t.pos, me.pos))) {
      out.push({ type: 'special', actionId: 'protect', targetId: m.id, label: `Bảo vệ gia đình: dựng dậy ${m.name}` });
    }
  }
  out.push(...tokenActions(state, me.id, { canGive: me.side === 'hero' }));
  return out;
}

export default {
  id: 'haunt-song-trung',
  name: 'Song trùng',
  traitor: { rule: 'revealer' },

  publicIntro:
    'Các bạn đã sống ở đây từ lâu. Ít ra là những bản sao của các bạn. Chúng đeo mặt nạ mang khuôn mặt các bạn, nói giọng đều đều: ' +
    '«Quả cầu đã báo trước. Bản giả không được phép sống ngoài kia.»',

  monsterCards: [{ name: 'Bản sao', controller: 'Kẻ phản bội', traits: { might: '*', speed: '*', sanity: '*', knowledge: '*' }, rules: [
    'Mỗi bản sao mang danh tính một người sống sót, chỉ số bằng chỉ số ban đầu của người đó hạ một nấc.',
    'Không đổ xúc xắc khi đi: đi đúng bằng Tốc độ của mình. Tấn công bằng Sức mạnh hoặc Tinh thần, chọn bên có lợi hơn.',
    'Bị chính chủ hoặc người cầm Mặt nạ đánh thắng thì chết; người khác đánh thắng chỉ làm nó choáng.',
  ] }],

  traitorTome: {
    title: 'Sách Kẻ phản bội – Song trùng',
    intro:
      'Bạn chạm mặt chính mình. Bản sao lột chiếc mặt nạ mang khuôn mặt bạn và đưa cho bạn. Bạn đeo nó lên, và người kia biến mất. ' +
      'Từ giờ bạn là một phần của gia đình sống trong ngôi nhà này. Phải bảo vệ tổ ấm.',
    setup: [
      'Nhân vật của bạn vẫn ở trong game. Bạn là Kẻ phản bội và đang cầm Mặt nạ. Hồi đầy mọi chỉ số.',
      'Mỗi người sống sót có một bản sao xuất hiện ở phòng bạn đang đứng. Bạn điều khiển chúng sau phần đi của mình.',
    ],
    objective: 'Bạn thắng khi mọi người sống sót đều chết.',
    lose: ['Mọi bản sao đều chết.'],
    tokens: ['Bản sao (một con cho mỗi người sống sót)', 'Mặt nạ'],
    actions: [{ name: 'Bảo vệ gia đình', when: 'Mỗi lượt một lần, bạn có thể', text: 'Đứng cùng phòng với một bản sao đang choáng: dựng nó dậy, nó hành động bình thường ở lượt sau.' }],
    tips: ['Đừng để người sống sót cướp được Mặt nạ: người cầm Mặt nạ giết được mọi bản sao.'],
    ifWin: 'Tổ ấm đã an toàn. Bạn sống lại một cuộc đời gần như thật. Lần tới cửa chính mở ra và bạn thấy chính mình bước vào, bạn đã sẵn sàng.',
  },

  survivalSecrets: {
    title: 'Sách Người sống sót – Song trùng',
    intro: 'Bản giả không được phép tồn tại ngoài kia, những bản sao nói vậy. Các bạn đồng ý. Chỉ có điều, các bạn chắc chắn mình không phải bản giả.',
    setup: ['Kẻ phản bội là người lật Haunt, đang cầm Mặt nạ.', 'Mỗi người có một bản sao mang khuôn mặt mình.'],
    objective: 'Các bạn thắng khi giết hết các bản sao.',
    lose: ['Mọi người sống sót đều chết.'],
    tokens: ['Bản sao', 'Mặt nạ'],
    actions: [{
      name: 'Soi quả cầu', when: 'Mỗi lượt một lần, bạn có thể',
      text: `Đứng ở ${SCRY_TILES.map((t) => ({ tower: 'Tháp canh', 'ritual-chamber': 'Phòng tế lễ' }[t])).join(' hoặc ')}: đổ Tri thức.`,
      outcomes: [[`${SCRY_TARGET}+`, 'Làm choáng một bản sao bất kỳ.'], [`0–${SCRY_TARGET - 1}`, 'Không có gì.']],
    }],
    rules: [
      { title: 'Giết bản sao', text: 'Bạn giết được bản sao của chính mình. Nếu cầm Mặt nạ, bạn giết được mọi bản sao. Đánh thắng bản sao khác chỉ làm nó choáng.' },
      { title: 'Khi bạn đánh Kẻ phản bội bằng Sức mạnh', text: 'Thắng thì được chọn cướp Mặt nạ (nếu hắn đang cầm) thay vì gây sát thương.' },
    ],
    tips: ['Ai cướp được Mặt nạ thì đi săn bản sao, những người khác lo bản sao của chính mình.'],
    ifWin: 'Các bạn nhìn vào quả cầu và thấy cửa chính mở ra, vài người bước vào. Một trong số họ giống hệt bạn. Không. Không thể nào. Lại nữa sao?',
  },

  setup(state) {
    const t = state.players[state.haunt.traitorId];
    state.haunt.data = { twinOf: {}, tokens: {} };
    addToken(state, { id: MASK, kind: 'mask', label: 'Mặt nạ', holder: t.id });
    for (const h of heroes(state)) {
      const id = `ban-sao-${h.id}`;
      spawnMonster(state, { id, type: 'song-trung', name: `Bản sao ${h.name}`, traits: baseTraits(h) }, posKey(t.pos));
      data(state).twinOf[id] = h.id;
    }
    enqueueFront(state, [{ op: 'heal', traits: TRAITS, playerId: t.id }]);
    addLog(state, `🎭 ${twins(state).length} bản sao bước ra từ bóng tối, mỗi người một khuôn mặt quen.`, 'haunt');
  },

  monsterMoveCount(state, monster) {
    return monster.type === 'song-trung' ? monster.traits.speed : null;
  },

  // Bản sao tấn công bằng Sức mạnh hoặc Tinh thần, bên nào có lợi hơn.
  monsterAttackTrait(state, monster, target) {
    if (monster.type !== 'song-trung') return undefined;
    let best = 'might';
    for (const t of ['might', 'sanity']) if (monster.traits[t] - traitValue(target, t) > monster.traits[best] - traitValue(target, best)) best = t;
    return best;
  },

  onCombatLoss(state, loser, amount, trait, winner) {
    if (loser.kind === 'monster' && state.monsters[loser.id]?.type === 'song-trung') {
      const owner = twinOf(state, loser.id);
      if (winner?.kind === 'player' && (winner.id === owner || maskHolder(state) === winner.id)) {
        addLog(state, `💀 ${state.monsters[loser.id].name} vỡ vụn như thạch cao.`, 'haunt');
        delete state.monsters[loser.id];
        return true;
      }
      return undefined;
    }
    const t = state.haunt.traitorId;
    if (loser.kind === 'player' && loser.id === t && winner?.kind === 'player' && trait === 'might' && maskHolder(state) === t) {
      enqueueFront(state, [chooseOp(winner.id, `Bạn thắng ${state.players[t].name}. Làm gì?`, [
        { id: 'steal', label: 'Cướp Mặt nạ' }, { id: 'hurt', label: `Gây ${amount} sát thương` },
      ], { op: 'songtrung:spoils', loserId: t, amount }, { always: true })]);
      return true;
    }
    return undefined;
  },

  onPlayerDeath(state, player) {
    dropTokens(state, player);
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    if (handleTokenAction(state, playerId, action)) return;
    const me = state.players[playerId];
    const option = specials(state, me).find((a) => a.actionId === action.actionId && (a.targetId ?? null) === (action.targetId ?? null));
    if (!option) throw new GameError('Không thể làm vậy lúc này.');
    state.turn.usedSpecial = true;
    if (action.actionId === 'scry') {
      enqueueFront(state, [rollOp(playerId, 'knowledge', 'Soi quả cầu', { op: 'songtrung:scry' })]);
    } else {
      const m = state.monsters[action.targetId];
      m.stunned = false;
      m.recovering = false;
      addLog(state, `${me.name} đỡ ${m.name} đứng dậy.`, 'haunt');
    }
  },

  botTargets(state, me) {
    if (me.side !== 'hero') return null;
    const mine = twins(state).filter((m) => twinOf(state, m.id) === me.id || maskHolder(state) === me.id);
    return mine.map((m) => posKey(m.pos));
  },

  botSkip(state, me, action) {
    if (action.type !== 'attack' || action.targetType !== 'monster') return false;
    return twinOf(state, action.targetId) !== me.id && maskHolder(state) !== me.id;
  },

  publicData(state) {
    const tokens = tokenDisplay(state);
    const holder = maskHolder(state);
    return {
      meters: [{ id: 'twins', label: 'Bản sao còn lại', value: twins(state).length, max: Object.keys(data(state).twinOf).length, tone: 'bad' }],
      notes: [
        holder ? `${state.players[holder].name} đang cầm Mặt nạ.` : 'Mặt nạ đang nằm trên sàn.',
        ...twins(state).map((m) => `${m.name}: ${TRAITS.map((t) => `${TRAIT_WORD[t]} ${m.traits[t]}`).join(', ')}${m.stunned ? ' (choáng)' : ''}.`),
      ],
      marks: tokens.marks,
      carried: tokens.carried,
    };
  },

  checkVictory(state) {
    if (!twins(state).length) return { side: 'heroes', reason: 'Bản sao cuối cùng đã vỡ vụn.' };
    if (!heroes(state).length) return { side: 'traitor', reason: 'Không còn bản gốc nào. Các bản sao bước ra ngoài thay họ.' };
    return null;
  },
};
