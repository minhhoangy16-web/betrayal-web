// HAUNT «Bùa Lỗ Ban» – dò tìm bùa giấu kín, không có quái vật.
// Chỉ Kẻ phản bội biết bùa nằm ở đâu: vị trí bùa không bao giờ có trong view của người khác.

import { posKey } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { aliveHeroes, roomName, rooms, posOf, doorSteps, roomOption, chooseOp, rollOp } from './helpers.js';

const END = 20;
const SEARCH_TARGET = 4;
const DODGE_TARGET = 4;
const FORBIDDEN = ['entrance-hall', 'foyer', 'grand-staircase', 'upper-landing', 'basement-landing'];

const data = (state) => state.haunt.data;
const keyOf = (state, player) => posKey(player.pos);

const hidingSpots = (state) => rooms(state, (pos, def) => !FORBIDDEN.includes(def.id) && !data(state).charms.includes(posKey(pos)));

// Phòng thông cửa với `key` mà bùa có thể dời tới.
function moveTargets(state, key) {
  const d = data(state);
  return doorSteps(state, posOf(state, key)).map((s) => posKey(s.pos)).filter((k) => {
    const def = state.board.tiles[k].tileId;
    return !FORBIDDEN.includes(def) && !d.cleared.includes(k) && !d.charms.includes(k);
  });
}

const charmsAround = (state, key) => doorSteps(state, posOf(state, key)).filter((s) => data(state).charms.includes(posKey(s.pos))).length;

function hideOp(state, index, total) {
  const spots = hidingSpots(state);
  if (index > total || !spots.length) return [];
  return [chooseOp(state.haunt.traitorId, `Giấu lá bùa thứ ${index}/${total}`, spots.map((k) => roomOption(state, k)),
    { op: 'loban:hide', index, total }, { secret: true, always: true })];
}

registerOp('loban:hide', (state, it) => {
  data(state).charms.push(it.choice);
  addLog(state, `Bạn giấu bùa ở ${roomName(state, posOf(state, it.choice))}.`, 'haunt', state.haunt.traitorId);
  const next = hideOp(state, it.index + 1, it.total);
  if (next.length) enqueueFront(state, next);
  else addLog(state, `Kẻ phản bội đã giấu xong ${data(state).charms.length} lá bùa trong nhà.`, 'haunt');
});

registerOp('loban:collapse', (state, it) => {
  const d = data(state);
  const key = it.choice;
  if (!d.revealed.includes(key)) d.revealed.push(key);
  const pos = posOf(state, key);
  addLog(state, `🪵 Kèo sập! Xà nhà ở ${roomName(state, pos)} đổ xuống – ở đó có bùa Lỗ Ban.`, 'haunt');
  const victims = aliveHeroes(state).filter((p) => keyOf(state, p) === key);
  enqueueFront(state, victims.map((p) => rollOp(p.id, 'speed', 'Né xà nhà', { op: 'loban:dodge' })));
});

registerOp('loban:dodge', (state, it) => {
  if (it.total < DODGE_TARGET) enqueueFront(state, [{ op: 'damage', type: 'physical', amount: 2, playerId: it.playerId, source: 'haunt-lo-ban' }]);
  else addLog(state, `${state.players[it.playerId].name} né kịp.`, 'haunt');
});

registerOp('loban:pickMove', (state, it) => {
  const targets = moveTargets(state, it.choice);
  enqueueFront(state, [chooseOp(it.playerId, 'Dời bùa tới phòng nào?', targets.map((k) => roomOption(state, k)),
    { op: 'loban:move', from: it.choice }, { secret: true, always: true })]);
});

registerOp('loban:move', (state, it) => {
  const d = data(state);
  d.charms = d.charms.map((k) => (k === it.from ? it.choice : k));
  addLog(state, `Bạn dời bùa từ ${roomName(state, posOf(state, it.from))} sang ${roomName(state, posOf(state, it.choice))}.`, 'haunt', it.playerId);
  addLog(state, 'Có tiếng gỗ cọt kẹt đâu đó trong tường – Kẻ phản bội vừa dùng một phép Lỗ Ban.', 'haunt');
});

registerOp('loban:search', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  const key = keyOf(state, me);
  const room = roomName(state, me.pos);
  if (it.total < SEARCH_TARGET) {
    addLog(state, `${me.name} dò ${room} nhưng không cảm nhận được gì, đầu óc quay cuồng.`, 'haunt');
    enqueueFront(state, [{ op: 'damage', type: 'mental', amount: 1, playerId: me.id, source: 'haunt-lo-ban' }]);
    return;
  }
  if (d.charms.includes(key)) {
    d.charms = d.charms.filter((k) => k !== key);
    d.revealed = d.revealed.filter((k) => k !== key);
    d.burned += 1;
    if (!d.cleared.includes(key)) d.cleared.push(key);
    d.hints[key] = charmsAround(state, key);
    addLog(state, `🔥 ${me.name} tìm thấy và đốt lá bùa trong kèo ${room}! Còn ${d.charms.length} lá.`, 'haunt');
  } else {
    if (!d.cleared.includes(key)) d.cleared.push(key);
    d.hints[key] = charmsAround(state, key);
    addLog(state, `${me.name} dò sạch ${room}: các phòng thông cửa với nó đang giấu ${d.hints[key]} lá bùa.`, 'haunt');
  }
});

export default {
  id: 'haunt-lo-ban',
  name: 'Bùa Lỗ Ban',
  mode: 'traitor',
  traitor: { rule: 'highestTrait', trait: 'knowledge' },

  publicIntro:
    'Xà nhà kêu răng rắc như có người đang nghiến răng. Bụi gỗ rơi lả tả, và trên mỗi cây cột hiện ra ' +
    'những vết khắc các bạn chưa thấy bao giờ.',

  traitorTome: {
    title: "Traitor's Tome – Bùa Lỗ Ban",
    story: 'Ông cố bạn là thợ cả dựng ngôi nhà này, và ông chưa bao giờ được trả đủ công. Những lá bùa ông để lại vẫn còn linh.',
    objective: `Bạn thắng khi đồng hồ nhà sập chạm ${END}, hoặc mọi người sống sót đều chết.`,
    rules: [
      'Khi Haunt bắt đầu, bạn bí mật chọn (số người sống sót + 1) phòng để giấu bùa. Không được chọn Sảnh vào, Tiền sảnh và các phòng cầu thang.',
      'Đầu mỗi lượt của bạn, đồng hồ nhà sập tăng bằng số bùa còn lại.',
      `«Kèo sập» (thay cho tấn công): chọn một phòng có bùa; mọi người sống sót ở đó đổ Tốc độ, dưới ${DODGE_TARGET} thì chịu 2 sát thương thể chất. Phòng đó lộ cho cả bàn biết là có bùa.`,
      '«Dời bùa» (thay cho tấn công): chuyển một bùa chưa lộ sang phòng thông cửa với nó, chưa dò sạch và chưa có bùa. Người khác chỉ biết bạn vừa dùng phép, không biết dời bùa nào.',
      'Bùa đã lộ thì không dời được nữa. Bạn vẫn tấn công được như thường nếu không dùng phép.',
    ],
  },

  survivalSecrets: {
    title: 'Secrets of Survival – Bùa Lỗ Ban',
    story: 'Bùa giấu trong kèo cột của một số căn phòng. Còn bùa thì ngôi nhà còn sập dần.',
    objective: 'Các bạn thắng khi tìm và đốt hết bùa.',
    rules: [
      `«Dò bùa» (mỗi lượt một lần): đổ Tri thức tại phòng đang đứng. Đạt ${SEARCH_TARGET}+ mà phòng có bùa thì bùa bị đốt. Đạt ${SEARCH_TARGET}+ mà không có bùa thì phòng được đánh dấu sạch, và game cho biết có bao nhiêu phòng thông cửa với nó đang giấu bùa.`,
      'Dò trượt thì không biết gì và chịu 1 sát thương tinh thần.',
      'Phòng bị Kèo sập được đánh dấu cho cả bàn; bùa đã lộ thì không bị dời đi nữa.',
      'Con số ghi trên phòng đã dò là số bùa lúc dò; Kẻ phản bội có thể dời bùa sau đó.',
    ],
  },

  setup(state) {
    const total = Math.min(aliveHeroes(state).length + 1, rooms(state, (p, def) => !FORBIDDEN.includes(def.id)).length);
    state.haunt.data = { charms: [], cleared: [], revealed: [], hints: {}, burned: 0, clock: 0 };
    addLog(state, 'Kẻ phản bội đang lén giấu bùa vào kèo cột…', 'haunt');
    enqueueFront(state, hideOp(state, 1, total));
  },

  onTurnStart(state, playerId) {
    if (playerId !== state.haunt.traitorId) return;
    const d = data(state);
    d.clock += d.charms.length;
    addLog(state, `🏚 Ngôi nhà rung lên. Đồng hồ nhà sập: ${Math.min(d.clock, END)}/${END}.`, 'haunt');
  },

  specialActions(state, playerId) {
    const me = state.players[playerId];
    const d = data(state);
    if (me.side === 'traitor') {
      if (state.turn.hasAttacked || !d.charms.length) return [];
      const out = [{ type: 'special', actionId: 'collapse', label: 'Phép Kèo sập' }];
      if (d.charms.some((k) => !d.revealed.includes(k) && moveTargets(state, k).length)) {
        out.push({ type: 'special', actionId: 'move', label: 'Phép Dời bùa' });
      }
      return out;
    }
    if (state.turn.usedSpecial || d.cleared.includes(keyOf(state, me))) return [];
    return [{ type: 'special', actionId: 'search', label: `Dò bùa ở phòng này (đổ Tri thức, cần ${SEARCH_TARGET}+)` }];
  },

  performSpecial(state, playerId, action) {
    const d = data(state);
    if (!this.specialActions(state, playerId).some((a) => a.actionId === action.actionId)) {
      throw new GameError('Không thể làm vậy lúc này.');
    }
    if (action.actionId === 'search') {
      state.turn.usedSpecial = true;
      enqueueFront(state, [rollOp(playerId, 'knowledge', 'Dò bùa', { op: 'loban:search' })]);
      return;
    }
    state.turn.hasAttacked = true;
    state.turn.usedSpecial = true;
    if (action.actionId === 'collapse') {
      enqueueFront(state, [chooseOp(playerId, 'Làm sập kèo ở phòng nào?', d.charms.map((k) => roomOption(state, k)),
        { op: 'loban:collapse' }, { secret: true, always: true })]);
    } else {
      const movable = d.charms.filter((k) => !d.revealed.includes(k) && moveTargets(state, k).length);
      enqueueFront(state, [chooseOp(playerId, 'Dời lá bùa nào?', movable.map((k) => roomOption(state, k)),
        { op: 'loban:pickMove' }, { secret: true, always: true })]);
    }
  },

  publicData(state, viewerId) {
    const d = data(state);
    const marks = {};
    for (const key of d.cleared) marks[key] = [{ kind: 'clear', label: `Đã dò sạch · lúc dò quanh đây có ${d.hints[key] ?? 0} bùa` }];
    for (const key of d.revealed) (marks[key] ??= []).push({ kind: 'revealed', label: 'Lộ bùa (Kèo sập)' });
    if (viewerId && viewerId === state.haunt.traitorId) {
      for (const key of d.charms) (marks[key] ??= []).push({ kind: 'charm', label: 'Bùa bạn giấu' });
    }
    return {
      meters: [{ id: 'clock', label: 'Nhà sập', value: Math.min(d.clock, END), max: END, tone: 'danger' }],
      notes: [`Còn ${d.charms.length} lá bùa trong nhà · đã đốt ${d.burned}.`],
      marks,
    };
  },

  checkVictory(state) {
    const d = data(state);
    if (!d.charms.length && d.burned > 0) return { side: 'heroes', reason: 'Lá bùa cuối cùng cháy rụi. Ngôi nhà thở ra một hơi dài rồi lặng im.' };
    if (d.clock >= END) return { side: 'traitor', reason: 'Kèo cột gãy rắc rắc. Ngôi nhà sập xuống đè lên tất cả.' };
    if (!aliveHeroes(state).length) return { side: 'traitor', reason: 'Không còn ai sống sót.' };
    return null;
  },
};

