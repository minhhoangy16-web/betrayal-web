// HAUNT «Trục vong» – Kẻ phản bội giấu mặt: game chọn ngẫu nhiên một người bị vong nhập, không ai khác biết.
// Mọi thứ có thể lộ danh tính (lựa chọn khi làm lễ, Hút dương khí) chỉ được lưu ở server và công bố ẩn danh.

import { samePos, posKey } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront, enqueue } from '../engine/effects.js';
import { shiftTrait } from '../engine/traits.js';
import {
  playersInPlay, roomName, tileDefAt, tilePos, chooseOp, rollOp,
  addToken, tokensOf, removeToken, hasToken, dropTokens, giveTokenTo, tokenActions, handleTokenAction, tokenDisplay, mergeMarks,
} from './helpers.js';

const END = 10;
const RITES = 3;
const DEATHS = 2;
const INCENSE_TARGET = 4;
const INCENSE_SYMBOLS = ['omen', 'event']; // nhang đèn chỉ còn sót ở phòng có biểu tượng Điềm báo hoặc Sự kiện
const ALTARS = ['chapel', 'ritual-chamber', 'entrance-hall'];
// Không tìm nhang ở các phòng cầu thang / lối đi (cũng như ở chính Bàn thờ).
const NO_INCENSE = ['foyer', 'grand-staircase', 'upper-landing', 'basement-landing'];

const data = (state) => state.haunt.data;
const traitor = (state) => state.players[state.haunt.traitorId];
const altarPos = (state) => tilePos(state, data(state).altar);
const living = (state) => playersInPlay(state).filter((p) => p.alive);
const othersDead = (state) => Object.values(state.players).filter((p) => p.id !== state.haunt.traitorId && !p.alive).length;

function raiseAm(state, n, why) {
  const d = data(state);
  d.am = Math.min(END, d.am + n);
  addLog(state, `🌫 Âm khí tăng ${n} (${why}): ${d.am}/${END}.`, 'haunt');
}

function reveal(state, how) {
  const d = data(state);
  const t = traitor(state);
  d.revealed = true;
  t.side = 'traitor';
  addLog(state, `👁 ${how} ${t.name} chính là người bị vong nhập!`, 'haunt');
  if (t.alive) {
    shiftTrait(state, t, 'might', 2);
    shiftTrait(state, t, 'speed', 2);
    addLog(state, `Vong lộ diện trong xác ${t.name}: Sức mạnh và Tốc độ tăng 2.`, 'haunt');
  }
}

// Ai đang đứng ở Bàn thờ và có thể dự lễ.
const atAltar = (state) => living(state).filter((p) => samePos(p.pos, altarPos(state)));
const riteNeeds = (state) => Math.min(3, living(state).length);

// Tìm nhang: mỗi phòng chỉ lục được một lần, dù thành hay hỏng.
function canSearch(state, me) {
  const d = data(state);
  const key = posKey(me.pos);
  if (state.turn.usedSpecial || samePos(me.pos, altarPos(state)) || d.searched.includes(key)) return false;
  const def = tileDefAt(state, me.pos);
  if (NO_INCENSE.includes(def.id) || !INCENSE_SYMBOLS.includes(def.symbol)) return false;
  return !hasToken(state, me.id, 'incense');
}

registerOp('trucvong:search', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  if (it.total >= INCENSE_TARGET) {
    d.incense += 1;
    addToken(state, { id: `nhang-${d.incense}`, kind: 'incense', label: 'Bó nhang', holder: me.id });
    addLog(state, `🧧 ${me.name} tìm được một bó nhang còn khô ở ${roomName(state, me.pos)}.`, 'haunt');
  } else {
    addLog(state, `${me.name} lục khắp ${roomName(state, me.pos)} mà chỉ thấy nhang mốc. Phòng này không còn gì.`, 'haunt');
  }
});

registerOp('trucvong:vote', (state, it) => {
  if (it.choice === 'bad') data(state).rite.bad = true;
});

registerOp('trucvong:riteEnd', (state) => {
  const d = data(state);
  const { bad, participants } = d.rite;
  d.rite = null;
  if (!bad) {
    d.rites += 1;
    addLog(state, `🪔 Lễ trục vong thành (${d.rites}/${RITES}). Khói hương bay thẳng lên trời.`, 'haunt');
    return;
  }
  addLog(state, '💨 Lễ hỏng! Nén hương gãy làm đôi. Có kẻ dự lễ không thành tâm.', 'haunt');
  raiseAm(state, 2, 'lễ hỏng');
  enqueueFront(state, participants.map((id) => ({ op: 'damage', type: 'mental', amount: 1, playerId: id, source: 'haunt' })));
});

registerOp('trucvong:drain', (state) => {
  const d = data(state);
  const drains = d.drains;
  d.drains = [];
  for (const { victimId, room } of drains) {
    const v = state.players[victimId];
    if (!v.alive) continue;
    addLog(state, `🥶 Một luồng khí lạnh lướt qua ${room}. ${v.name} rùng mình.`, 'haunt');
    enqueue(state, [{ op: 'lose', trait: 'sanity', amount: 1, playerId: v.id }]);
  }
});

function specials(state, me) {
  const d = data(state);
  const out = [];
  const isTraitor = me.id === state.haunt.traitorId;
  const others = living(state).filter((p) => p.id !== me.id && samePos(p.pos, me.pos));
  if (canSearch(state, me)) {
    out.push({ type: 'special', actionId: 'search', label: `Tìm nhang đèn (đổ Tri thức, cần ${INCENSE_TARGET}+)` });
  }
  if (!state.turn.usedSpecial && samePos(me.pos, altarPos(state)) && d.riteRound !== state.round && d.rites < RITES
    && hasToken(state, me.id, 'incense')) {
    const here = atAltar(state).length;
    if (here >= riteNeeds(state)) out.push({ type: 'special', actionId: 'rite', label: `Thắp nhang làm lễ trục vong (${here} người dự)` });
  }
  if (isTraitor && !d.revealed && !d.drainedTurn && !state.turn.usedSpecial) {
    for (const p of others) out.push({ type: 'special', actionId: 'drain', targetId: p.id, label: `Hút dương khí của ${p.name}` });
  }
  if (!d.accused.includes(me.id) && !d.revealed && !state.turn.usedSpecial) {
    for (const p of others) out.push({ type: 'special', actionId: 'accuse', targetId: p.id, label: `Tố giác ${p.name}` });
  }
  // Nhặt / trao nhang. Khi chưa lộ mặt ai cũng trao được cho ai (nếu không, việc thiếu nút «Trao» sẽ làm lộ Kẻ bị nhập).
  if (!hasToken(state, me.id, 'incense')) out.push(...tokenActions(state, me.id, { canGive: false }));
  for (const t of tokensOf(state, me.id)) {
    for (const p of others) {
      if (hasToken(state, p.id, 'incense')) continue;
      if (d.revealed && (p.id === state.haunt.traitorId) !== isTraitor) continue;
      out.push({ type: 'special', actionId: 'giveIncense', tokenId: t.id, toPlayerId: p.id, label: `Trao ${t.label} cho ${p.name}` });
    }
  }
  return out;
}

export default {
  id: 'haunt-truc-vong',
  name: 'Trục vong',
  mode: 'hidden',
  hiddenTraitor: true,
  minPlayers: 4,
  traitor: { rule: 'random' },

  publicIntro:
    'Đèn vụt tắt trong một hơi thở. Khi sáng lại, mọi người vẫn đứng đó, ' +
    'nhưng ai cũng cảm thấy có thêm một hơi thở lạnh trong nhóm.',

  traitorTome: {
    title: 'Sách của Kẻ bị nhập – Trục vong',
    ifWin:
      'Âm khí phủ kín ngôi nhà. Những người kia lần lượt gục xuống, còn bạn mỉm cười bằng nụ cười không phải của mình. Vong đã tìm được một thân xác vừa vặn.',
    story: 'Một vong hồn đã vào ở trong bạn, và nó không muốn đi. Đừng để ai biết.',
    objective: `Bạn thắng khi Âm khí chạm ${END}, hoặc khi có ${DEATHS} người khác chết, hoặc khi không còn ai khác sống sót.`,
    lose: [
      `Người sống sót làm thành công ${RITES} lễ trục vong.`,
      'Bạn chết (dù đã lộ mặt hay chưa).',
    ],
    setup: [
      'Game chọn ngẫu nhiên một người bị vong nhập: chính là bạn. Không ai khác biết, kể cả người vừa lật Haunt.',
      'Bàn thờ được lập ở Nhà nguyện, Phòng tế lễ hoặc Sảnh vào (phòng nào có trên bàn cờ trước).',
      'Trên màn hình người khác, phe của bạn hiện là «?», giống hệt mọi người.',
    ],
    rules: [
      'Cuối mỗi vòng, Âm khí tự tăng 1 (tăng 2 khi bạn đã lộ mặt).',
      'Bạn cũng có các hành động như người sống sót: tìm nhang, trao nhang, dự lễ, tố giác. Hãy giả vờ hợp tác.',
      '«Hút dương khí» (mỗi lượt một lần, khi còn giấu mặt): chọn một người cùng phòng. Cuối vòng họ mất 1 Tinh thần; nhật ký chỉ ghi «một luồng khí lạnh lướt qua» phòng đó, không nêu ai làm. Hành động này không chiếm lượt hành động đặc biệt của bạn.',
      'Khi dự lễ, bạn được bí mật chọn «Lòng dạ khác» để làm hỏng lễ. Game chỉ công bố lễ thành hay hỏng. Lễ hỏng: Âm khí +2, mọi người dự lễ (cả bạn) chịu 1 sát thương tinh thần, và bó nhang đã cháy hết.',
      'Ai đứng ở Bàn thờ vào cuối hai vòng liền đều mất 1 Tinh thần, kể cả bạn.',
      'Bị tố giác đúng thì bạn lộ mặt: +2 Sức mạnh, +2 Tốc độ, không Hút dương khí được nữa và không phá lễ được nữa, nhưng tấn công như thường. Âm khí từ đó tăng 2 mỗi vòng.',
      'Khi bạn chưa lộ mặt, không ai tấn công được ai (để không lộ phe). Người tố giác sai bị phạt: mất 2 Tinh thần và Âm khí +1.',
    ],
    tips: [
      'Nhận cầm nhang rồi đi chậm, hoặc tố giác oan người khác để Âm khí tăng.',
      'Đừng phá mọi lễ: lễ hỏng cho họ biết chắc bạn nằm trong nhóm dự lễ.',
    ],
  },

  survivalSecrets: {
    title: 'Sách của người sống sót – Trục vong',
    ifWin:
      'Nén nhang cuối cùng cháy hết. Người bạn bị nhập khuỵu xuống, mở mắt ra và hỏi chuyện gì vừa xảy ra. Không ai trả lời. Các bạn chỉ dìu nhau ra khỏi nhà.',
    story: 'Một người trong nhóm không còn là chính họ. Có thể là bất kỳ ai, trừ bạn.',
    objective: `Các bạn thắng khi làm thành công ${RITES} lễ trục vong, hoặc khi Kẻ bị nhập chết (tố giác đúng để họ lộ mặt rồi đánh tới chết).`,
    lose: [
      `Âm khí chạm ${END}. Âm khí tăng 1 mỗi cuối vòng (2 khi Kẻ bị nhập đã lộ mặt), +2 mỗi lễ hỏng, +1 mỗi lần tố giác sai.`,
      `Có ${DEATHS} người (không tính Kẻ bị nhập) đã chết.`,
    ],
    setup: [
      'Game chọn ngẫu nhiên một người bị vong nhập và chỉ người đó biết. Trên màn hình, phe của người khác đều hiện «?».',
      'Bàn thờ được lập ở Nhà nguyện, Phòng tế lễ hoặc Sảnh vào (đánh dấu trên bàn cờ).',
    ],
    rules: [
      `«Tìm nhang đèn» (mỗi lượt một lần): đứng ở phòng có biểu tượng Điềm báo hoặc Sự kiện (không phải Bàn thờ), đổ Tri thức ${INCENSE_TARGET}+ để lấy một Bó nhang. Mỗi phòng chỉ lục được một lần, dù thành hay trượt (phòng đã lục được đánh dấu). Mỗi người cầm tối đa 1 bó.`,
      'Bó nhang trao cho người cùng phòng (chưa có nhang) được. Người cầm nhang chết thì nhang rơi tại chỗ, nhặt lại được.',
      `«Thắp nhang làm lễ trục vong» (mỗi vòng chỉ một lễ cho cả bàn): người chủ trì phải cầm Bó nhang, và ở Bàn thờ phải có ít nhất 3 người tính cả người chủ trì (nếu còn ít hơn 3 người sống thì cần tất cả). Mỗi lễ đốt hết một bó nhang, thành hay hỏng cũng vậy.`,
      'Mọi người đứng ở Bàn thờ đều dự lễ, và mỗi người bí mật chọn «Thành tâm» hoặc «Lòng dạ khác». Người sống sót chỉ chọn được Thành tâm, nhưng ai cũng thấy cùng một hộp thoại.',
      'Lễ hỏng (có người chọn Lòng dạ khác): Âm khí +2, mọi người dự lễ chịu 1 sát thương tinh thần, và chắc chắn Kẻ bị nhập nằm trong nhóm dự lễ.',
      'Âm khí tụ quanh Bàn thờ: ai đứng ở Bàn thờ vào cuối hai vòng liền thì mất 1 Tinh thần. Không thể ngồi lì ở đó chờ làm lễ tiếp.',
      '«Hút dương khí» của Kẻ bị nhập được tính cuối vòng và ghi ẩn danh theo phòng («một luồng khí lạnh lướt qua …»). Hãy để ý ai từng đứng cùng phòng với nạn nhân.',
      '«Tố giác» (mỗi người một lần trong cả ván): chỉ ra một người cùng phòng. Đúng thì họ lộ mặt (và mạnh lên +2 Sức mạnh, +2 Tốc độ). Sai thì bạn mất 2 Tinh thần và Âm khí +1.',
      'Khi chưa ai lộ mặt, không ai tấn công được ai. Khi Kẻ bị nhập đã lộ, họ không phá lễ được nữa: làm nốt số lễ còn lại hoặc đánh họ tới chết.',
    ],
    tips: [
      'Chia nhau đi tìm nhang, hẹn giờ cùng về Bàn thờ, làm lễ xong thì lại tản ra.',
      'Nếu một lễ hỏng, lần sau hãy đổi nhóm dự lễ để khoanh vùng người bị nhập.',
    ],
  },

  setup(state) {
    const altar = ALTARS.find((id) => tilePos(state, id));
    state.haunt.data = {
      altar, am: 0, rites: 0, revealed: false, accused: [], drains: [], drainedTurn: false, rite: null, riteRound: null,
      searched: [], incense: 0, lastAtAltar: [],
    };
    addLog(state, `Bàn thờ được lập ở ${roomName(state, tilePos(state, altar))}. Âm khí bắt đầu dâng.`, 'haunt');
  },

  // Khi chưa lộ mặt, không ai là đối thủ của ai (tránh lộ danh tính qua danh sách hành động).
  areEnemies(state, a, b) {
    if (!data(state).revealed) return false;
    return a.side !== b.side;
  },

  onTurnStart(state) {
    data(state).drainedTurn = false;
  },

  onPlayerDeath(state, player) {
    dropTokens(state, player);
    if (player.id === state.haunt.traitorId && !data(state).revealed) reveal(state, 'Khi trút hơi thở cuối, một bóng đen thoát ra khỏi xác:');
  },

  onRoundEnd(state) {
    const d = data(state);
    raiseAm(state, d.revealed ? 2 : 1, 'đêm trôi qua');
    const ops = [];
    // Âm khí tụ quanh Bàn thờ: ai ở lì ở đó hai cuối vòng liền bị hút mất 1 Tinh thần
    // (kể cả Kẻ bị nhập, để không lộ ai). Ghé qua làm lễ rồi đi thì không sao.
    const here = atAltar(state).map((p) => p.id);
    const camping = atAltar(state).filter((p) => d.lastAtAltar.includes(p.id));
    d.lastAtAltar = here;
    if (camping.length) {
      addLog(state, `🕯 Âm khí tụ quanh Bàn thờ. ${camping.map((p) => p.name).join(', ')} lạnh buốt sống lưng.`, 'haunt');
      ops.push(...camping.map((p) => ({ op: 'lose', trait: 'sanity', amount: 1, playerId: p.id })));
    }
    if (d.drains.length) ops.push({ op: 'trucvong:drain' });
    if (ops.length) enqueueFront(state, ops);
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    if (action.actionId === 'pickToken' && handleTokenAction(state, playerId, action)) return;
    const me = state.players[playerId];
    const d = data(state);
    const option = specials(state, me).find((a) => a.actionId === action.actionId && (a.targetId ?? null) === (action.targetId ?? null)
      && (a.tokenId ?? null) === (action.tokenId ?? null) && (a.toPlayerId ?? null) === (action.toPlayerId ?? null));
    if (!option) throw new GameError('Không thể làm vậy lúc này.');
    if (action.actionId === 'giveIncense') {
      giveTokenTo(state, action.tokenId, action.toPlayerId);
      addLog(state, `${me.name} trao Bó nhang cho ${state.players[action.toPlayerId].name}.`, 'haunt');
      return;
    }
    if (action.actionId === 'search') {
      state.turn.usedSpecial = true;
      d.searched.push(posKey(me.pos));
      enqueueFront(state, [rollOp(playerId, 'knowledge', 'Tìm nhang đèn', { op: 'trucvong:search' })]);
    } else if (action.actionId === 'rite') {
      state.turn.usedSpecial = true;
      d.riteRound = state.round;
      removeToken(state, tokensOf(state, playerId).find((t) => t.kind === 'incense').id);
      const participants = atAltar(state).map((p) => p.id);
      d.rite = { bad: false, participants };
      addLog(state, `🕯 ${me.name} chủ trì lễ trục vong. ${participants.length} người dự lễ, mỗi người bí mật chọn lòng mình.`, 'haunt');
      const traitorCanSabotage = !d.revealed;
      enqueueFront(state, [
        ...participants.map((id) => chooseOp(id, 'Lễ trục vong: lòng bạn thế nào?', [
          { id: 'good', label: 'Thành tâm' },
          {
            id: 'bad', label: 'Lòng dạ khác',
            disabled: !(id === state.haunt.traitorId && traitorCanSabotage),
            hint: id === state.haunt.traitorId && traitorCanSabotage ? 'Làm hỏng lễ' : 'Bạn không bị nhập',
          },
        ], { op: 'trucvong:vote' }, { secret: true })),
        { op: 'trucvong:riteEnd' },
      ]);
    } else if (action.actionId === 'drain') {
      // Không đặt usedSpecial (ai cũng thấy cờ này); chỉ giới hạn mỗi lượt một lần bằng dữ liệu riêng trên server.
      d.drainedTurn = true;
      d.drains.push({ victimId: action.targetId, room: roomName(state, me.pos) });
    } else if (action.actionId === 'accuse') {
      state.turn.usedSpecial = true;
      d.accused.push(playerId);
      const target = state.players[action.targetId];
      addLog(state, `☝ ${me.name} tố giác ${target.name}!`, 'haunt');
      if (target.id === state.haunt.traitorId) {
        reveal(state, 'Lời tố giác trúng.');
      } else {
        addLog(state, `${target.name} không bị nhập. ${me.name} bủn rủn vì đã nghi oan.`, 'haunt');
        shiftTrait(state, me, 'sanity', -2);
        raiseAm(state, 1, 'nghi oan');
      }
    }
  },

  publicData(state) {
    const d = data(state);
    const key = state.board.index[d.altar];
    const tokens = tokenDisplay(state);
    const marks = {};
    if (key) marks[key] = [{ kind: 'altar', label: 'Bàn thờ' }];
    for (const k of d.searched) (marks[k] ??= []).push({ kind: 'dug', label: 'Đã lục tìm nhang' });
    const held = Object.values(d.tokens ?? {}).filter((t) => t.kind === 'incense').length;
    return {
      meters: [
        { id: 'am', label: 'Âm khí', value: d.am, max: END, tone: 'danger' },
        { id: 'rites', label: 'Lễ trục vong đã thành', value: d.rites, max: RITES, tone: 'good' },
        { id: 'dead', label: 'Người đã chết', value: othersDead(state), max: DEATHS, tone: 'danger' },
      ],
      notes: [
        d.revealed ? 'Kẻ bị nhập đã lộ mặt.' : 'Chưa ai biết ai bị nhập.',
        d.riteRound === state.round ? 'Vòng này đã làm lễ rồi.' : 'Vòng này chưa làm lễ.',
        held ? `Đang có ${held} bó nhang trong nhà.` : 'Chưa có bó nhang nào: phải đi tìm trước khi làm lễ.',
      ],
      marks: mergeMarks(marks, tokens.marks),
      carried: tokens.carried,
    };
  },

  checkVictory(state) {
    const d = data(state);
    const t = traitor(state);
    let result = null;
    if (d.rites >= RITES) result = { side: 'heroes', reason: 'Ba lễ trục vong đã thành. Vong hồn bị đuổi khỏi xác người.' };
    else if (!t.alive) result = { side: 'heroes', reason: `Xác ${t.name} gục xuống, vong hồn không còn chỗ trú.` };
    else if (d.am >= END) result = { side: 'traitor', reason: `Âm khí phủ kín ngôi nhà. Vong hồn trong xác ${t.name} đã thắng.` };
    else if (othersDead(state) >= DEATHS) result = { side: 'traitor', reason: `Đã có ${DEATHS} người chết. Vong hồn trong xác ${t.name} đã thắng.` };
    else if (!living(state).some((p) => p.id !== t.id)) result = { side: 'traitor', reason: 'Không còn ai sống sót.' };
    if (result) {
      d.revealed = true;
      t.side = 'traitor';
    }
    return result;
  },
};
