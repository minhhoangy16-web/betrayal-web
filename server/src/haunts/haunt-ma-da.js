// HAUNT «Ma da» – chạy thoát khỏi ngôi nhà đang ngập dần từ dưới lên.

import { posKey } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import {
  aliveHeroes, spawnMonster, tileDefAt, roomName, rooms, posOf, doorSteps, roomOption, chooseOp, rollOp,
  addToken, hasToken, dropTokens, tokenActions, handleTokenAction, tokenDisplay, mergeMarks, escapePlayer,
} from './helpers.js';

const FLOODS_PER_TURN = 2;
const KEY_TARGET = 4;
const CLIMB_TARGET = 4;
const DRAG_TARGET = 3;
const CLIMB_ROOMS = ['tower', 'attic'];
const WATER_GHOST = { type: 'ma-da', name: 'Ma da', traits: { speed: 4, might: 4, sanity: 2 } };

const data = (state) => state.haunt.data;
const isFlooded = (state, pos) => data(state).flooded.includes(posKey(pos));
const startCount = (state) => data(state).startHeroes;
const escapedCount = (state) => Object.values(state.players).filter((p) => p.side === 'hero' && p.escaped).length;
const deadCount = (state) => Object.values(state.players).filter((p) => p.side === 'hero' && !p.alive).length;

// Phòng tầng trệt có thể ngập thêm: thông cửa (hoặc cầu thang) với một phòng đã ngập.
function floodable(state) {
  return rooms(state, (pos) => pos.floor === 'ground' && !isFlooded(state, pos)
    && doorSteps(state, pos).some((s) => isFlooded(state, s.pos)));
}

function floodOps(state, remaining) {
  const options = floodable(state);
  if (!options.length || remaining <= 0) return [];
  return [chooseOp(state.haunt.traitorId, `Nước dâng: chọn phòng ngập (còn ${remaining})`,
    options.map((k) => roomOption(state, k)), { op: 'mada:flood', remaining }, { always: true })];
}

registerOp('mada:flood', (state, it) => {
  data(state).flooded.push(it.choice);
  addLog(state, `🌊 Nước tràn vào ${roomName(state, posOf(state, it.choice))}.`, 'haunt');
  enqueueFront(state, floodOps(state, it.remaining - 1));
});

registerOp('mada:drag', (state, it) => {
  if (it.total < DRAG_TARGET) {
    addLog(state, `Bàn tay dưới nước kéo chân ${state.players[it.playerId].name}.`, 'haunt');
    enqueueFront(state, [{ op: 'damage', type: 'physical', amount: 2, playerId: it.playerId, source: 'haunt-ma-da' }]);
  }
});

registerOp('mada:key', (state, it) => {
  const p = state.players[it.playerId];
  if (data(state).keyFound) return;
  if (it.total >= KEY_TARGET) {
    data(state).keyFound = true;
    addToken(state, { id: 'key', kind: 'key', label: 'Chìa khoá cửa chính', holder: p.id });
    addLog(state, `🔑 ${p.name} tìm thấy chìa khoá cửa chính!`, 'haunt');
  } else {
    addLog(state, `${p.name} lục tìm nhưng không thấy chìa khoá.`, 'haunt');
  }
});

registerOp('mada:climb', (state, it) => {
  const p = state.players[it.playerId];
  if (it.total >= CLIMB_TARGET) escapePlayer(state, p, 'trèo qua cửa sổ, tuột xuống theo mái ngói và thoát ra ngoài!');
  else addLog(state, `${p.name} trượt tay, chưa leo xuống được.`, 'haunt');
});

function heroActions(state, me) {
  const out = [];
  const def = tileDefAt(state, me.pos);
  const d = data(state);
  if (!state.turn.usedSpecial) {
    if (!d.keyFound && def.symbol === 'item') {
      out.push({ type: 'special', actionId: 'key', label: `Tìm chìa khoá (đổ Tri thức, cần ${KEY_TARGET}+)` });
    }
    if (def.id === 'entrance-hall' && !isFlooded(state, me.pos)) {
      if (!d.doorOpen && hasToken(state, me.id, 'key')) out.push({ type: 'special', actionId: 'unlock', label: 'Mở cửa chính' });
      if (d.doorOpen) out.push({ type: 'special', actionId: 'leave', label: 'Thoát ra qua cửa chính' });
    }
    if (CLIMB_ROOMS.includes(def.id)) {
      out.push({ type: 'special', actionId: 'climb', label: `Leo xuống từ đây (đổ Sức mạnh, cần ${CLIMB_TARGET}+)` });
    }
  }
  out.push(...tokenActions(state, me.id));
  return out;
}

export default {
  id: 'haunt-ma-da',
  name: 'Ma da',
  mode: 'traitor',
  traitor: { rule: 'lowestTrait', trait: 'speed' },

  publicIntro:
    'Nước đen trào lên từ miệng giếng dưới hầm, lạnh và tanh mùi bùn. ' +
    'Một người trong các bạn ướt sũng từ đầu đến chân, dù không hề xuống hầm.',

  traitorTome: {
    title: 'Sách Kẻ phản bội – Ma da',
    story: 'Bạn đã chết đuối dưới cái giếng này từ lâu. Đủ người chết thay thì bạn mới được đi.',
    objective: 'Bạn thắng khi có quá nhiều người sống sót chết, tới mức số còn lại không đủ để thoát (bảng tình hình ghi đúng số người chết cần có).',
    lose: [
      'Ít nhất một nửa số người sống sót (làm tròn lên) thoát ra ngoài. Ví dụ: 3 người thì cần 2 người thoát, 4 người cần 2, 5 người cần 3.',
    ],
    setup: [
      'Bạn là người có Tốc độ thấp nhất lúc Haunt bắt đầu.',
      'Cả tầng hầm ngập nước. Ma da trồi lên ở Chiếu nghỉ tầng hầm: 2 con nếu người sống sót có 2–4 người, 3 con nếu có từ 5 người.',
    ],
    rules: [
      `Đầu mỗi lượt của bạn, nước dâng: bạn chọn ${FLOODS_PER_TURN} phòng ở tầng trệt cho ngập. Phòng được chọn phải thông cửa với một phòng đã ngập (Cầu thang lớn thông xuống tầng hầm). Tầng trên không bao giờ ngập.`,
      'Nếu Sảnh vào bị ngập, cửa chính mất tác dụng: người sống sót chỉ còn đường leo xuống từ Tháp canh hoặc Gác mái.',
      'Sau phần đi của bạn là lượt quái vật: bạn điều khiển các Ma da (Tốc độ 4, Sức mạnh 4). Chúng chỉ đi trong phòng ngập và tấn công bằng Sức mạnh.',
      'Ma da thua trận thì bị choáng một lượt quái vật.',
      'Bạn đi trong nước không tốn thêm bước, và không bị kéo chân.',
    ],
    tips: [
      'Ưu tiên cho ngập Sảnh vào và các phòng dẫn lên cầu thang để cắt đường thoát.',
      'Ai cầm chìa khoá thì dồn Ma da về phía người đó.',
    ],
  },

  survivalSecrets: {
    title: 'Sách Người sống sót – Ma da',
    story: 'Nước sẽ không dừng lại. Ở lại là chết đuối, nên phải ra khỏi ngôi nhà này.',
    objective: 'Các bạn thắng khi ít nhất một nửa số người sống sót (làm tròn lên) thoát ra ngoài: 3 người cần 2 người thoát, 4 người cần 2, 5 người cần 3.',
    lose: [
      'Số người chết nhiều tới mức người còn lại không đủ để thoát. Bảng tình hình ghi rõ: «Thoát đủ X người là thắng; chết Y người là thua».',
    ],
    setup: [
      'Kẻ phản bội là người có Tốc độ thấp nhất lúc Haunt bắt đầu.',
      'Cả tầng hầm đã ngập. Ma da xuất hiện ở Chiếu nghỉ tầng hầm.',
    ],
    rules: [
      `Vào phòng ngập tốn 2 bước thay vì 1. Kết thúc lượt trong phòng ngập thì đổ Sức mạnh: dưới ${DRAG_TARGET} là bị kéo chân, chịu 2 sát thương thể chất.`,
      `Lối ra 1, cửa chính: «Tìm chìa khoá» (mỗi lượt một lần) ở phòng có biểu tượng Vật phẩm, đổ Tri thức ${KEY_TARGET}+. Cả nhà chỉ có một chìa.`,
      'Người cầm chìa đứng ở Sảnh vào (chưa ngập) thì «Mở cửa chính». Từ đó ai đứng ở Sảnh vào cũng «Thoát ra qua cửa chính» được (mỗi người tự làm trong lượt của mình). Sảnh vào bị ngập thì cửa này mất.',
      `Lối ra 2: đứng ở Tháp canh hoặc Gác mái, «Leo xuống» bằng cách đổ Sức mạnh ${CLIMB_TARGET}+. Mỗi người tự leo; trượt thì thử lại lượt sau.`,
      'Người đã thoát rời khỏi bàn cờ, không bị tấn công nữa và được tính là thoát.',
      'Chìa khoá trao cho nhau được khi cùng phòng. Người cầm chìa chết thì chìa rơi tại chỗ, nhặt lại được.',
      'Ma da chỉ đi trong phòng ngập. Đánh chúng bằng Sức mạnh như thường, thắng thì nó choáng một lượt.',
    ],
    tips: [
      'Tầng trên không bao giờ ngập. Nếu cửa chính khó giữ, cả nhóm nên lên Tháp canh hoặc Gác mái mà leo xuống.',
      'Tránh dừng lượt trong nước.',
    ],
  },

  setup(state) {
    const heroes = aliveHeroes(state);
    state.haunt.data = {
      flooded: rooms(state, (pos) => pos.floor === 'basement'),
      startHeroes: heroes.length,
      need: Math.ceil(heroes.length / 2),
      keyFound: false,
      doorOpen: false,
    };
    const count = heroes.length >= 5 ? 3 : 2;
    for (let i = 1; i <= count; i++) spawnMonster(state, { ...WATER_GHOST, id: `ma-da-${i}`, name: `Ma da ${i}` }, 'basement-landing');
    addLog(state, `Tầng hầm chìm trong nước. ${count} Ma da trồi lên ở Chiếu nghỉ tầng hầm.`, 'haunt');
  },

  onTurnStart(state, playerId) {
    if (playerId === state.haunt.traitorId) enqueueFront(state, floodOps(state, FLOODS_PER_TURN));
  },

  canMonsterEnter(state, monster, pos) {
    return isFlooded(state, pos);
  },

  moveCost(state, player, toPos) {
    return player.side === 'hero' && isFlooded(state, toPos) ? 1 : 0;
  },

  onExplorerTurnEnd(state, player) {
    if (player.side !== 'hero' || !isFlooded(state, player.pos)) return [];
    return [rollOp(player.id, 'might', 'Bị kéo chân dưới nước', { op: 'mada:drag' })];
  },

  onPlayerDeath(state, player) {
    dropTokens(state, player);
  },

  specialActions(state, playerId) {
    const me = state.players[playerId];
    return me.side === 'hero' ? heroActions(state, me) : [];
  },

  performSpecial(state, playerId, action) {
    if (handleTokenAction(state, playerId, action)) return;
    const me = state.players[playerId];
    if (!heroActions(state, me).some((a) => a.actionId === action.actionId)) throw new GameError('Không thể làm vậy lúc này.');
    state.turn.usedSpecial = true;
    if (action.actionId === 'key') enqueueFront(state, [rollOp(playerId, 'knowledge', 'Tìm chìa khoá', { op: 'mada:key' })]);
    else if (action.actionId === 'climb') enqueueFront(state, [rollOp(playerId, 'might', 'Leo xuống', { op: 'mada:climb' })]);
    else if (action.actionId === 'unlock') {
      data(state).doorOpen = true;
      addLog(state, `🔓 ${me.name} mở được cửa chính! Ai đứng ở Sảnh vào cũng thoát ra được.`, 'haunt');
    } else if (action.actionId === 'leave') {
      escapePlayer(state, me, 'chạy ra qua cửa chính và thoát khỏi ngôi nhà!');
    }
  },

  publicData(state) {
    const d = data(state);
    const tokens = tokenDisplay(state);
    const marks = {};
    for (const key of d.flooded) marks[key] = [{ kind: 'flood', label: 'Ngập nước' }];
    for (const key of rooms(state, (pos, def) => CLIMB_ROOMS.includes(def.id) || def.id === 'entrance-hall')) {
      (marks[key] ??= []).push({ kind: 'exit', label: 'Lối thoát' });
    }
    const loseAt = startCount(state) - d.need + 1;
    return {
      meters: [
        { id: 'escaped', label: 'Đã thoát ra', value: escapedCount(state), max: d.need, tone: 'good' },
        { id: 'dead', label: 'Đã chết', value: deadCount(state), max: loseAt, tone: 'danger' },
      ],
      notes: [
        d.doorOpen ? 'Cửa chính đã mở.' : d.keyFound ? 'Đã có chìa khoá cửa chính.' : 'Chưa ai tìm thấy chìa khoá cửa chính.',
        `Thoát đủ ${d.need} người là thắng; chết ${loseAt} người là thua.`,
      ],
      marks: mergeMarks(marks, tokens.marks),
      carried: tokens.carried,
    };
  },

  checkVictory(state) {
    const d = data(state);
    if (escapedCount(state) >= d.need) return { side: 'heroes', reason: 'Đủ người đã thoát khỏi ngôi nhà trước khi nước nuốt trọn nó.' };
    if (deadCount(state) > startCount(state) - d.need) return { side: 'traitor', reason: 'Ma da đã có đủ người chết thay.' };
    if (!aliveHeroes(state).length) {
      return escapedCount(state) >= d.need
        ? { side: 'heroes', reason: 'Đủ người đã thoát ra.' }
        : { side: 'traitor', reason: 'Không ai còn lại để thoát ra.' };
    }
    return null;
  },
};

