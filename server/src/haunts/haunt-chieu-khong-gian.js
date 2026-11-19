// HAUNT «Chiều không gian thứ hai» – Kẻ phản bội (Tri thức cao nhất) mở ra một chiều không gian khác bên trong ngôi nhà.
// Người sống sót phải tìm người bạn bị kẹt lại, cõng bạn ra Sảnh vào và thoát ra ngoài. Bản web giữ nguyên các tầng
// (bản gốc gom mọi gạch về một tầng và cho Kẻ phản bội dời gạch).

import { posKey, samePos, resolveStep } from '../engine/board.js';
import { addLog, setLastRoll } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { rollDice } from '../engine/dice.js';
import { randInt } from '../engine/rng.js';
import { TRAITS } from '../engine/constants.js';
import { startIndex } from '../engine/traits.js';
import {
  playersInPlay, tileDefAt, rollOp, chooseOp, roomOption, rooms, posOf, roomLabel, doorSteps,
  addToken, tokensOf, dropTokens, tokenActions, handleTokenAction, tokenDisplay, mergeMarks, tilePos,
} from './helpers.js';

const FIND_TARGET = 8;
const ESCAPE_TARGET = 9;
const JUMP_TARGET = 3;
const MAX_COUNTER = 8;
const FRIEND = 'ban-mat-tich';
const TRAIT_WORD = { might: 'Sức mạnh', speed: 'Tốc độ', sanity: 'Tinh thần', knowledge: 'Tri thức' };

const data = (state) => state.haunt.data;
const heroes = (state) => playersInPlay(state).filter((p) => p.alive && p.side === 'hero');
const traitor = (state) => state.players[state.haunt.traitorId];
const friendHolder = (state) => data(state).tokens?.[FRIEND]?.holder ?? null;
const warpsPerTurn = (state) => ({ 3: 1, 4: 1, 5: 2 }[state.turnOrder.length] ?? 2) + (friendHolder(state) ? 1 : 0);

function openRooms(state) {
  return rooms(state).filter((k) => {
    const pos = posOf(state, k);
    for (let dir = 0; dir < 4; dir++) {
      try {
        if (resolveStep(state, pos, { dir }).kind === 'discover') return true;
      } catch { /* tường */ }
    }
    return false;
  });
}

function poolRoll(state, me, label) {
  const d = data(state);
  const r = rollDice(state, d.counter);
  setLastRoll(state, { kind: 'haunt', playerId: me.id, label, dice: r.dice, total: r.total });
  return r.total;
}

registerOp('chieu:jump', (state, it) => {
  const me = state.players[it.playerId];
  if (it.total < JUMP_TARGET) {
    addLog(state, `${me.name} bước qua khung cửa nhưng lại về chỗ cũ.`, 'haunt');
    return;
  }
  const options = openRooms(state).map((k) => roomOption(state, k));
  if (!options.length) return;
  enqueueFront(state, [chooseOp(me.id, 'Nhảy tới phòng nào?', options, { op: 'chieu:jump-to' }, { always: true })]);
});

registerOp('chieu:jump-to', (state, it) => {
  const me = state.players[it.playerId];
  me.pos = posOf(state, it.choice);
  addLog(state, `🌀 ${me.name} bước ra từ một khung cửa ở ${roomLabel(state, me.pos)}.`, 'haunt');
});

registerOp('chieu:warp', (state, it) => {
  const t = traitor(state);
  if (it.choice === 'hurt') {
    addLog(state, '🌀 Không gian vặn xoắn. Các bức tường gập lại như giấy.', 'haunt');
    const ops = [];
    for (const p of heroes(state)) {
      const steps = doorSteps(state, p.pos);
      if (steps.length) p.pos = steps[randInt(state, steps.length)].pos;
      ops.push({ op: 'damage', type: 'general', dice: 1, playerId: p.id, source: 'haunt' });
    }
    enqueueFront(state, ops);
  } else {
    const trait = it.choice.replace('buff-', '');
    addLog(state, `🌀 ${t.name} hút sức mạnh của chiều không gian (+2 ${TRAIT_WORD[trait]}).`, 'haunt');
    enqueueFront(state, [{ op: 'gain', trait, amount: 2, playerId: t.id }]);
  }
});

function specials(state, me) {
  if (!me.alive) return [];
  const d = data(state);
  const out = [];
  const key = posKey(me.pos);
  if (me.side === 'hero') {
    if (!state.turn.usedSpecial && !d.found && tileDefAt(state, me.pos).symbol === 'omen') {
      out.push({ type: 'special', actionId: 'find', label: `Tìm người bạn mất tích (đổ ${d.counter} xúc xắc, cần ${FIND_TARGET}+)` });
    }
    if (!state.turn.usedSpecial && friendHolder(state) === me.id && tileDefAt(state, me.pos).id === 'entrance-hall') {
      out.push({ type: 'special', actionId: 'escape', label: `Cõng bạn thoát ra (đổ ${d.counter} xúc xắc, cần ${ESCAPE_TARGET}+)` });
    }
    out.push(...tokenActions(state, me.id));
  } else if (me.id === state.haunt.traitorId) {
    if (!state.turn.usedSpecial) out.push({ type: 'special', actionId: 'jump', label: `Nhảy cửa (đổ Tinh thần, cần ${JUMP_TARGET}+)` });
    if (d.warps < warpsPerTurn(state)) {
      out.push({ type: 'special', actionId: 'warp', label: `Bóp méo không gian (${warpsPerTurn(state) - d.warps} lần còn lại)` });
    }
  }
  return out;
}

export default {
  id: 'haunt-chieu-khong-gian',
  name: 'Chiều không gian thứ hai',
  traitor: { rule: 'highestTrait', trait: 'knowledge' },

  publicIntro:
    'Người bạn đi trước mở một cánh cửa rồi biến mất. Cánh cửa dẫn vào một căn phòng không có trong nhà. ' +
    'Cả ngôi nhà bắt đầu nghiêng đi, các khung cửa dẫn tới những nơi không nên dẫn tới.',

  traitorTome: {
    title: 'Sách Kẻ phản bội – Chiều không gian thứ hai',
    intro:
      'Bạn đã đọc đủ sách để biết: ngôi nhà này là một cánh cửa. Người bạn mất tích là chìa khoá. Nếu không ai đưa được cô ấy ra, ' +
      'cánh cửa sẽ mở hẳn, và bạn sẽ là người đầu tiên bước sang bên kia.',
    setup: ['Nhân vật của bạn vẫn ở trong game. Bạn là Kẻ phản bội.', 'Thanh đếm bắt đầu ở 7/6/6/5 (bàn 3/4/5/6 người).'],
    objective: 'Bạn thắng khi mọi người sống sót đều chết.',
    lose: ['Người sống sót cõng được người bạn mất tích ra khỏi Sảnh vào.'],
    tokens: ['Người bạn mất tích', 'Thanh đếm'],
    actions: [
      {
        name: 'Nhảy cửa', when: 'Mỗi lượt một lần, bạn có thể',
        text: 'Đổ Tinh thần.',
        outcomes: [[`${JUMP_TARGET}+`, 'Tới ngay một phòng bất kỳ còn cửa mở ra chỗ chưa khám phá.'], [`0–${JUMP_TARGET - 1}`, 'Không có gì.']],
      },
      {
        name: 'Bóp méo không gian', when: 'Mỗi lượt 1/1/2/2 lần (bàn 3/4/5/6 người), thêm 1 lần nếu đang có người cõng bạn mất tích, bạn có thể',
        text: 'Chọn một: mọi người sống sót chịu 1 xúc xắc sát thương tổng hợp và bị hất sang một phòng bên cạnh ngẫu nhiên; HOẶC bạn +2 một chỉ số tuỳ chọn.',
      },
    ],
    rules: [{ title: 'Khi bạn chết', text: 'Cuối vòng đó bạn sống lại ở một phòng còn cửa mở, hồi đầy mọi chỉ số.' }],
    tips: ['Hất người cõng bạn mất tích ra xa Sảnh vào.'],
    ifWin: 'Cánh cửa cuối cùng mở ra. Bên kia không có gì cả, và bạn bước vào đó, vui vẻ như về nhà.',
  },

  survivalSecrets: {
    title: 'Sách Người sống sót – Chiều không gian thứ hai',
    intro: 'Người bạn mất tích đang kẹt ở đâu đó giữa hai chiều không gian, sau một trong những căn phòng điềm gở. Tìm cô ấy, cõng cô ấy ra Sảnh vào, và đừng để ngôi nhà gập các bạn lại.',
    setup: [
      'Kẻ phản bội là người có Tri thức cao nhất.',
      'Thanh đếm bắt đầu ở 7/6/6/5 (bàn 3/4/5/6 người). Mỗi khi khám phá một phòng Điềm báo mới, thanh đếm +1 (tối đa 8).',
      'Bản web giữ nguyên các tầng nhà (bản gốc gom mọi phòng về một tầng).',
    ],
    objective: 'Các bạn thắng khi cõng được người bạn mất tích ra khỏi nhà từ Sảnh vào.',
    lose: ['Mọi người sống sót đều chết. Giết Kẻ phản bội chỉ làm hắn biến mất tới cuối vòng.'],
    tokens: ['Người bạn mất tích', 'Thanh đếm'],
    actions: [
      {
        name: 'Tìm người bạn mất tích', when: 'Mỗi lượt một lần, bạn có thể',
        text: 'Đứng ở phòng có biểu tượng Điềm báo: đổ số xúc xắc bằng giá trị thanh đếm.',
        outcomes: [[`${FIND_TARGET}+`, 'Tìm thấy! Bạn cõng người bạn đó (trao được cho người cùng phòng).'], [`0–${FIND_TARGET - 1}`, 'Không có gì.']],
      },
      {
        name: 'Cõng bạn thoát ra', when: 'Mỗi lượt một lần, bạn có thể',
        text: 'Đang cõng người bạn mất tích và đứng ở Sảnh vào: đổ số xúc xắc bằng giá trị thanh đếm.',
        outcomes: [[`${ESCAPE_TARGET}+`, 'Các bạn thắng!'], [`0–${ESCAPE_TARGET - 1}`, 'Không có gì.']],
      },
    ],
    tips: ['Mở thêm phòng Điềm báo trước để thanh đếm cao lên rồi mới tìm.'],
    ifWin: 'Các bạn ngã ra bãi cỏ ngoài cổng. Sau lưng, ngôi nhà gập lại như một tờ giấy và biến mất. Người bạn mất tích hỏi các bạn đã đi đâu suốt ba năm qua.',
  },

  setup(state) {
    const n = state.turnOrder.length;
    state.haunt.data = {
      counter: { 3: 7, 4: 6, 5: 6 }[n] ?? 5, known: Object.keys(state.board.tiles), found: false, escaped: false,
      warps: 0, revive: false, tokens: {},
    };
    addLog(state, `🌀 Ngôi nhà nghiêng đi. Thanh đếm: ${data(state).counter}.`, 'haunt');
  },

  onTurnStart(state) {
    data(state).warps = 0;
  },

  onPlayerEnter(state, player, pos) {
    const d = data(state);
    const key = posKey(pos);
    if (d.known.includes(key)) return;
    d.known.push(key);
    if (tileDefAt(state, pos).symbol === 'omen' && d.counter < MAX_COUNTER) {
      d.counter += 1;
      addLog(state, `🌀 Một căn phòng điềm gở mới hiện ra. Thanh đếm: ${d.counter}.`, 'haunt');
    }
  },

  onPlayerDeath(state, player) {
    dropTokens(state, player);
    if (player.id === state.haunt.traitorId) data(state).revive = true;
  },

  onRoundEnd(state) {
    const d = data(state);
    const t = traitor(state);
    if (!d.revive || state.winner) return;
    d.revive = false;
    const list = openRooms(state);
    t.alive = true;
    t.pos = posOf(state, list.length ? list[randInt(state, list.length)] : posKey(tilePos(state, 'foyer')));
    for (const trait of TRAITS) t.traits[trait] = Math.max(t.traits[trait], startIndex(t, trait));
    addLog(state, `🌀 ${t.name} bước ra từ một khung cửa ở ${roomLabel(state, t.pos)}, lành lặn như chưa từng chết.`, 'haunt');
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    if (handleTokenAction(state, playerId, action)) return;
    const me = state.players[playerId];
    if (!specials(state, me).some((a) => a.actionId === action.actionId)) throw new GameError('Không thể làm vậy lúc này.');
    const d = data(state);
    if (action.actionId === 'warp') {
      d.warps += 1;
      enqueueFront(state, [chooseOp(playerId, 'Bóp méo không gian để làm gì?', [
        { id: 'hurt', label: 'Gập phòng: mọi người sống sót chịu 1 xúc xắc sát thương và bị hất đi' },
        ...TRAITS.map((t) => ({ id: `buff-${t}`, label: `+2 ${TRAIT_WORD[t]} cho bạn` })),
      ], { op: 'chieu:warp' }, { always: true })]);
      return;
    }
    state.turn.usedSpecial = true;
    if (action.actionId === 'jump') {
      enqueueFront(state, [rollOp(playerId, 'sanity', 'Nhảy cửa', { op: 'chieu:jump' })]);
    } else if (action.actionId === 'find') {
      const total = poolRoll(state, me, 'Tìm người bạn mất tích');
      if (total >= FIND_TARGET) {
        d.found = true;
        addToken(state, { id: FRIEND, kind: 'friend', label: 'Người bạn mất tích', holder: me.id });
        addLog(state, `🙌 ${me.name} kéo được người bạn mất tích ra khỏi khe tường (${total})!`, 'haunt');
      } else {
        addLog(state, `${me.name} gọi tên bạn nhưng chỉ có tiếng vọng (${total}).`, 'haunt');
      }
    } else if (action.actionId === 'escape') {
      const total = poolRoll(state, me, 'Cõng bạn thoát ra');
      if (total >= ESCAPE_TARGET) {
        d.escaped = true;
        addLog(state, `🚪 ${me.name} cõng bạn lao qua cửa chính (${total})!`, 'haunt');
      } else {
        addLog(state, `Cửa chính dẫn vào… lại chính Sảnh vào (${total}).`, 'haunt');
      }
    }
  },

  botTargets(state, me) {
    if (me.side !== 'hero') return null;
    if (friendHolder(state) === me.id) return [posKey(tilePos(state, 'entrance-hall'))];
    return null;
  },

  botChoose(state, actor, pending) {
    return pending.then?.op === 'chieu:warp' ? 'hurt' : null;
  },

  publicData(state) {
    const d = data(state);
    const tokens = tokenDisplay(state);
    const holder = friendHolder(state);
    return {
      meters: [{ id: 'counter', label: 'Thanh đếm (số xúc xắc khi tìm / thoát)', value: d.counter, max: MAX_COUNTER, tone: 'good' }],
      notes: [
        d.found ? (holder ? `${state.players[holder].name} đang cõng người bạn mất tích.` : 'Người bạn mất tích đang nằm trên sàn.') : 'Chưa tìm thấy người bạn mất tích.',
      ],
      marks: mergeMarks({}, tokens.marks),
      carried: tokens.carried,
    };
  },

  checkVictory(state) {
    if (data(state).escaped) return { side: 'heroes', reason: 'Người bạn mất tích đã được đưa ra ngoài.' };
    if (!heroes(state).length) return { side: 'traitor', reason: 'Ngôi nhà đã gập mọi người vào trong nó.' };
    return null;
  },
};
