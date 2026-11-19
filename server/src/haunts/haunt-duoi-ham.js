// HAUNT «Chiến dịch dưới hầm» – Kẻ phản bội (người bên trái người lật Haunt) là chủ cũ của căn nhà, một điệp viên thời
// chiến tranh lạnh. Hắn nhốt mọi người dưới tầng hầm và thả «xác sống thí nghiệm». Người sống sót phải phá cửa hầm,
// lên tầng trệt và thoát ra ngoài.

import { posKey, samePos, resolveStep } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { shuffle } from '../engine/rng.js';
import { TILES_BY_ID } from '../data/index.js';
import { playersInPlay, tileDefAt, spawnMonster, rollOp, tilePos, rooms, posOf } from './helpers.js';

const ESCAPE_TARGET = 6;
const DOOR_TARGET = 6;
const ESCAPE_TILES = ['entrance-hall', 'garden'];
const MAX_ZOMBIES = 10;
const ZOMBIE = { type: 'xac-song', name: 'Xác sống', traits: { might: 5, speed: 2, sanity: 2, knowledge: 2 } };

const data = (state) => state.haunt.data;
const heroes = (state) => playersInPlay(state).filter((p) => p.alive && p.side === 'hero');
const zombies = (state) => Object.values(state.monsters).filter((m) => m.type === ZOMBIE.type);
const traitor = (state) => state.players[state.haunt.traitorId];
const isStairLink = (from, to, state) => {
  const a = TILES_BY_ID[state.board.tiles[posKey(from)]?.tileId]?.id;
  const b = TILES_BY_ID[state.board.tiles[posKey(to)]?.tileId]?.id;
  return (a === 'basement-landing' && b === 'grand-staircase') || (a === 'grand-staircase' && b === 'basement-landing');
};

function spawnZombie(state, where) {
  const d = data(state);
  if (zombies(state).length >= MAX_ZOMBIES) return null;
  d.spawned += 1;
  return spawnMonster(state, { ...ZOMBIE, id: `xac-song-${d.spawned}`, name: `${ZOMBIE.name} ${d.spawned}` }, where);
}

// Phòng tầng hầm còn cửa mở ra chỗ chưa khám phá.
function openBasementRooms(state) {
  return rooms(state, (pos) => pos.floor === 'basement').filter((k) => {
    const pos = posOf(state, k);
    for (let dir = 0; dir < 4; dir++) {
      try {
        if (resolveStep(state, pos, { dir }).kind === 'discover') return true;
      } catch {
        // tường
      }
    }
    return false;
  });
}

registerOp('duoiham:door', (state, it) => {
  const me = state.players[it.playerId];
  if (it.total >= DOOR_TARGET) {
    data(state).doorOpen = true;
    addLog(state, `🔓 ${me.name} phá tung ổ khoá cửa hầm! Cầu thang lên tầng trệt đã mở.`, 'haunt');
  } else {
    addLog(state, `${me.name} hì hục với cánh cửa thép mà nó vẫn đứng im.`, 'haunt');
  }
});

registerOp('duoiham:escape', (state, it) => {
  const me = state.players[it.playerId];
  if (it.total >= ESCAPE_TARGET) {
    data(state).escaped = me.id;
    addLog(state, `🏃 ${me.name} lao ra ngoài trời đêm!`, 'haunt');
  } else {
    addLog(state, `${me.name} giật mãi mà cánh cửa không chịu mở.`, 'haunt');
  }
});

// Cuối lượt Kẻ phản bội: thả xác sống.
registerOp('duoiham:spawn', (state) => {
  if (state.winner) return;
  const t = traitor(state);
  const n = state.turnOrder.length;
  let made = 0;
  if (n >= 5 && spawnZombie(state, 'basement-landing')) made += 1;
  if (t.alive && samePos(t.pos, data(state).lab)) {
    for (const k of openBasementRooms(state)) if (spawnZombie(state, k)) made += 1;
  }
  if (made) addLog(state, `🧟 Loa rè rè vang lên. ${made} xác sống thí nghiệm được thả xuống tầng hầm.`, 'haunt');
});

function specials(state, me) {
  if (state.turn.usedSpecial || !me.alive || me.side !== 'hero') return [];
  const out = [];
  const id = tileDefAt(state, me.pos).id;
  if (id === 'basement-landing' && !data(state).doorOpen) {
    out.push({ type: 'special', actionId: 'door', label: `Phá cửa hầm (đổ Sức mạnh, cần ${DOOR_TARGET}+)` });
  }
  if (ESCAPE_TILES.includes(id)) out.push({ type: 'special', actionId: 'escape', label: `Thoát ra ngoài (đổ Tốc độ, cần ${ESCAPE_TARGET}+)` });
  return out;
}

export default {
  id: 'haunt-duoi-ham',
  name: 'Chiến dịch dưới hầm',
  traitor: { rule: 'leftOfRevealer' },

  publicIntro:
    'Người môi giới nói chủ cũ là điệp viên thời chiến tranh lạnh, nhà đầy lối đi bí mật và camera, «nhưng dọn sạch rồi». ' +
    'Vậy tại sao cánh cửa hầm vừa sập lại sau lưng các bạn? Tường nhà khẽ rên lên như đang đói.',

  monsterCards: [{ name: ZOMBIE.name, controller: 'Kẻ phản bội', traits: ZOMBIE.traits, rules: [
    'Bị đánh thắng thì chết hẳn, không bị choáng.',
    'Mỗi cuối lượt Kẻ phản bội: thêm 0/0/1/1 xác sống (bàn 3/4/5/6 người) ở Chiếu nghỉ tầng hầm; nếu Kẻ phản bội đang ở Phòng điều khiển, thêm một con ở mỗi phòng tầng hầm còn cửa mở ra chỗ chưa khám phá.',
    `Tối đa ${MAX_ZOMBIES} con cùng lúc.`,
  ] }],

  traitorTome: {
    title: 'Sách Kẻ phản bội – Chiến dịch dưới hầm',
    intro:
      'Bạn nhìn bọn họ qua những con mắt của ngôi nhà. Có thể là gián điệp nước ngoài. Bạn gạt công tắc, nhốt chúng dưới hầm, ' +
      'chờ chỉ thị từ cấp trên. Lần cuối bạn nhận chỉ thị là năm 1965. Nếu chỉ thị không tới trước khi đám thí nghiệm tìm ra chúng thì… thôi vậy.',
    setup: [
      'Nhân vật của bạn vẫn ở trong game. Bạn bị đưa tới Phòng điều khiển (Phòng làm việc nếu đã có trên tầng trệt, không thì Tiền sảnh).',
      'Mọi người sống sót bị nhốt ở Chiếu nghỉ tầng hầm; các phòng tầng hầm khác bị xáo trở lại chồng gạch.',
    ],
    objective: 'Bạn thắng khi mọi người sống sót đều chết.',
    lose: ['Một người sống sót thoát ra ngoài.'],
    tokens: ['Xác sống (quái vật nhỏ)'],
    rules: [
      { title: 'Nhiệm vụ trên hết', text: 'Bạn không được rời Phòng điều khiển cho tới khi có người sống sót lên tới tầng trệt.' },
      { title: 'Cuối lượt của bạn', text: 'Thả xác sống như ghi trong khung quái vật, rồi điều khiển chúng.' },
    ],
    tips: ['Ở lại Phòng điều khiển càng lâu, tầng hầm càng đông xác sống.'],
    ifWin: 'Bạn thắng một trận. Nhưng cuộc chiến này không bao giờ kết thúc.',
  },

  survivalSecrets: {
    title: 'Sách Người sống sót – Chiến dịch dưới hầm',
    intro:
      'Cửa hầm sập lại. Tường nhà dịch chuyển, rên lên một tiếng đói khát. Ai đó đang theo dõi các bạn, và đã đến lúc phải ra khỏi đây.',
    setup: [
      'Kẻ phản bội là người ngồi bên trái người lật Haunt.',
      'Mọi người sống sót bị đưa về Chiếu nghỉ tầng hầm. Các phòng tầng hầm khác bị xáo trở lại chồng gạch: phải khám phá lại.',
      'Cầu thang từ Chiếu nghỉ tầng hầm lên tầng trệt bị khoá.',
    ],
    objective: 'Các bạn thắng khi một người thoát ra khỏi nhà.',
    lose: ['Mọi người sống sót đều chết.'],
    actions: [
      {
        name: 'Phá cửa hầm', when: 'Mỗi lượt một lần, bạn có thể',
        text: 'Đứng ở Chiếu nghỉ tầng hầm: đổ Sức mạnh.',
        outcomes: [[`${DOOR_TARGET}+`, 'Cầu thang lên tầng trệt mở ra cho mọi người.'], [`0–${DOOR_TARGET - 1}`, 'Không có gì.']],
      },
      {
        name: 'Thoát ra ngoài', when: 'Mỗi lượt một lần, bạn có thể',
        text: 'Đứng ở Sảnh vào hoặc Vườn hoang: đổ Tốc độ.',
        outcomes: [[`${ESCAPE_TARGET}+`, 'Các bạn thắng! Bạn thoát ra ngoài.'], [`0–${ESCAPE_TARGET - 1}`, 'Không có gì.']],
      },
    ],
    tips: ['Người khoẻ nhất lo phá cửa; những người khác giữ chân xác sống. Xác sống chậm nhưng đông.'],
    ifWin: 'Ra được tới đường rồi mà bạn vẫn không bỏ được cảm giác có ai đó đang theo dõi.',
  },

  setup(state) {
    const t = traitor(state);
    const labTile = tilePos(state, 'study')?.floor === 'ground' ? 'study' : 'foyer';
    const lab = tilePos(state, labTile);
    // Đưa mọi người sống sót về chiếu nghỉ hầm, rồi trả các phòng tầng hầm khác về chồng gạch.
    const landing = tilePos(state, 'basement-landing');
    for (const p of Object.values(state.players)) {
      if (p.id === t.id) p.pos = { ...lab };
      else if (p.alive || p.pos?.floor === 'basement') p.pos = { ...landing };
    }
    const removed = [];
    for (const [key, tile] of Object.entries(state.board.tiles)) {
      if (tile.floor !== 'basement' || tile.tileId === 'basement-landing') continue;
      delete state.board.tiles[key];
      delete state.board.index[tile.tileId];
      removed.push(tile.tileId);
    }
    for (const m of Object.values(state.monsters)) if (m.pos.floor === 'basement' && !state.board.tiles[posKey(m.pos)]) m.pos = { ...landing };
    state.tileStack = shuffle(state, [...state.tileStack, ...removed]);
    state.haunt.data = { lab, labTile, doorOpen: false, escaped: null, spawned: 0, heroOnGround: false };
    addLog(state, `🚪 Cửa hầm sập lại. ${removed.length} phòng dưới hầm chìm vào bóng tối. ${t.name} ngồi vào bàn điều khiển.`, 'haunt');
  },

  // Cầu thang hầm bị khoá cho tới khi phá cửa; Kẻ phản bội không rời Phòng điều khiển khi chưa ai lên tầng trệt.
  canPlayerEnter(state, player, toPos) {
    const d = data(state);
    if (!d.doorOpen && player.side === 'hero' && isStairLink(player.pos, toPos, state)) return false;
    if (player.id === state.haunt.traitorId && samePos(player.pos, d.lab) && !d.heroOnGround) return false;
    return undefined;
  },

  onPlayerEnter(state, player, pos) {
    if (player.side === 'hero' && pos.floor !== 'basement' && !data(state).heroOnGround) {
      data(state).heroOnGround = true;
      addLog(state, `📡 ${player.name} đã lên khỏi tầng hầm. Kẻ phản bội được rời Phòng điều khiển.`, 'haunt');
    }
  },

  onExplorerTurnEnd(state, player) {
    return player.id === state.haunt.traitorId ? [{ op: 'duoiham:spawn' }] : [];
  },

  // Xác sống bị đánh thắng thì chết hẳn.
  onCombatLoss(state, loser) {
    if (loser.kind === 'monster' && state.monsters[loser.id]?.type === ZOMBIE.type) {
      addLog(state, `${state.monsters[loser.id].name} đổ gục, lần này là mãi mãi.`, 'combat');
      delete state.monsters[loser.id];
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
    if (action.actionId === 'door') enqueueFront(state, [rollOp(playerId, 'might', 'Phá cửa hầm', { op: 'duoiham:door' })]);
    else enqueueFront(state, [rollOp(playerId, 'speed', 'Thoát ra ngoài', { op: 'duoiham:escape' })]);
  },

  botTargets(state, me) {
    if (me.side !== 'hero') return null;
    const d = data(state);
    if (!d.doorOpen) return [posKey(tilePos(state, 'basement-landing'))];
    return ESCAPE_TILES.map((t) => tilePos(state, t)).filter(Boolean).map(posKey);
  },

  publicData(state) {
    const d = data(state);
    return {
      meters: [{ id: 'zombies', label: 'Xác sống trong nhà', value: zombies(state).length, max: MAX_ZOMBIES, tone: 'bad' }],
      notes: [
        d.doorOpen ? 'Cửa hầm đã bị phá: cầu thang lên tầng trệt đã mở.' : 'Cửa hầm đang khoá.',
        d.heroOnGround ? 'Đã có người lên tầng trệt.' : 'Chưa ai lên được tầng trệt.',
      ],
      marks: { [posKey(d.lab)]: [{ kind: 'lab', label: 'Phòng điều khiển' }] },
    };
  },

  checkVictory(state) {
    if (data(state).escaped) return { side: 'heroes', reason: `${state.players[data(state).escaped].name} đã thoát ra ngoài.` };
    if (!heroes(state).length) return { side: 'traitor', reason: 'Không ai thoát khỏi tầng hầm.' };
    return null;
  },
};
