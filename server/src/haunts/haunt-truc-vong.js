// HAUNT «Trục vong» – Kẻ phản bội giấu mặt: game chọn ngẫu nhiên một người bị vong nhập, không ai khác biết.
// Mọi thứ có thể lộ danh tính (lựa chọn khi làm lễ, Hút dương khí) chỉ được lưu ở server và công bố ẩn danh.

import { samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront, enqueue } from '../engine/effects.js';
import { shiftTrait } from '../engine/traits.js';
import { playersInPlay, roomName, tilePos, chooseOp } from './helpers.js';

const END = 10;
const RITES = 3;
const DEATHS = 2;
const ALTARS = ['chapel', 'ritual-chamber', 'entrance-hall'];

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
  if (!state.turn.usedSpecial && samePos(me.pos, altarPos(state)) && d.riteRound !== state.round && d.rites < RITES) {
    const here = atAltar(state).length;
    if (here >= riteNeeds(state)) out.push({ type: 'special', actionId: 'rite', label: `Làm lễ trục vong (${here} người dự)` });
  }
  if (isTraitor && !d.revealed && !d.drainedTurn && !state.turn.usedSpecial) {
    for (const p of others) out.push({ type: 'special', actionId: 'drain', targetId: p.id, label: `Hút dương khí của ${p.name}` });
  }
  if (!d.accused.includes(me.id) && !d.revealed && !state.turn.usedSpecial) {
    for (const p of others) out.push({ type: 'special', actionId: 'accuse', targetId: p.id, label: `Tố giác ${p.name}` });
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
    story: 'Một vong hồn đã vào ở trong bạn, và nó không muốn đi. Đừng để ai biết.',
    objective: `Âm khí chạm ${END}, hoặc có ${DEATHS} người khác chết.`,
    rules: [
      'Cuối mỗi vòng, Âm khí tự tăng 1 (tăng 2 khi bạn đã bị lộ mặt).',
      '«Hút dương khí» (mỗi lượt một lần, khi còn giấu mặt): chọn một người cùng phòng. Cuối vòng họ mất 1 Tinh thần; nhật ký chỉ ghi «một luồng khí lạnh lướt qua» phòng đó, không nêu ai làm.',
      'Khi dự lễ, bạn được chọn bí mật «Lòng dạ khác» để làm hỏng lễ. Game chỉ công bố lễ thành hay hỏng.',
      'Bị tố giác đúng thì bạn lộ mặt: +2 Sức mạnh, +2 Tốc độ, không Hút dương khí được nữa nhưng tấn công như thường, và lễ không còn bị bạn phá.',
      'Trên màn hình người khác, phe của bạn hiện là «?». Người khác cũng không tấn công được bạn khi bạn chưa lộ mặt.',
    ],
  },

  survivalSecrets: {
    title: 'Sách của người sống sót – Trục vong',
    story: 'Một người trong nhóm không còn là chính họ. Có thể là bất kỳ ai, trừ bạn.',
    objective: `Làm thành công ${RITES} lễ trục vong; hoặc tố giác đúng Kẻ bị nhập rồi đánh bại họ.`,
    rules: [
      '«Làm lễ trục vong» (mỗi vòng một lần cho cả bàn): cần ít nhất 3 người ở Bàn thờ (ít hơn 3 người còn sống thì tất cả). Mỗi người dự lễ bí mật chọn «Thành tâm» hoặc «Lòng dạ khác»; người sống sót chỉ chọn được Thành tâm, nhưng ai cũng thấy cùng một hộp thoại.',
      'Lễ hỏng thì Âm khí tăng 2, mọi người dự lễ chịu 1 sát thương tinh thần, và chắc chắn Kẻ bị nhập đang đứng trong nhóm dự lễ.',
      '«Hút dương khí» được tính cuối vòng và ghi ẩn danh theo phòng. Hãy để ý ai từng đứng cùng phòng với nạn nhân.',
      '«Tố giác» (mỗi người một lần trong cả ván): chỉ ra một người cùng phòng. Đúng thì họ lộ mặt. Sai thì bạn mất 2 Tinh thần và Âm khí tăng 1.',
      'Khi Kẻ bị nhập đã lộ mặt, còn bao nhiêu lễ thì làm nốt, hoặc đánh họ cho tới chết.',
    ],
  },

  setup(state) {
    const altar = ALTARS.find((id) => tilePos(state, id));
    state.haunt.data = {
      altar, am: 0, rites: 0, revealed: false, accused: [], drains: [], drainedTurn: false, rite: null, riteRound: null,
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
    if (player.id === state.haunt.traitorId && !data(state).revealed) reveal(state, 'Khi trút hơi thở cuối, một bóng đen thoát ra khỏi xác:');
  },

  onRoundEnd(state) {
    const d = data(state);
    raiseAm(state, d.revealed ? 2 : 1, 'đêm trôi qua');
    if (d.drains.length) enqueueFront(state, [{ op: 'trucvong:drain' }]);
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    const me = state.players[playerId];
    const d = data(state);
    const option = specials(state, me).find((a) => a.actionId === action.actionId && (a.targetId ?? null) === (action.targetId ?? null));
    if (!option) throw new GameError('Không thể làm vậy lúc này.');
    if (action.actionId === 'rite') {
      state.turn.usedSpecial = true;
      d.riteRound = state.round;
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
    return {
      meters: [
        { id: 'am', label: 'Âm khí', value: d.am, max: END, tone: 'danger' },
        { id: 'rites', label: 'Lễ trục vong đã thành', value: d.rites, max: RITES, tone: 'good' },
        { id: 'dead', label: 'Người đã chết', value: othersDead(state), max: DEATHS, tone: 'danger' },
      ],
      notes: [
        d.revealed ? 'Kẻ bị nhập đã lộ mặt.' : 'Chưa ai biết ai bị nhập.',
        d.riteRound === state.round ? 'Vòng này đã làm lễ rồi.' : 'Vòng này chưa làm lễ.',
      ],
      marks: key ? { [key]: [{ kind: 'altar', label: 'Bàn thờ' }] } : {},
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
