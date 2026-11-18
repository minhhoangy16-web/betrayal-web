// HAUNT «Trùng tang» – thu thập ba lễ vật rồi làm lễ giải trùng trước khi đồng hồ trùng hết giờ.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { traitValue } from '../engine/traits.js';
import {
  aliveHeroes, inPlay, spawnMonster, tileDefAt, roomName, posOf, chooseOp, rollOp,
  addToken, tokensOf, tokensAt, hasToken, dropTokens, tokenActions, handleTokenAction, tokenDisplay, mergeMarks,
} from './helpers.js';

const END = 12;
const TAKE_AT = [3, 6, 9];
const SEARCH_TARGET = 4;
const RITE_TARGET = 5;

// Ba lễ vật: tìm ở phòng có biểu tượng nào, đổ chỉ số nào.
const OFFERINGS = [
  { kind: 'rice', label: 'Gạo muối', symbol: 'item', trait: 'knowledge' },
  { kind: 'peach', label: 'Bùa gỗ đào', symbol: 'event', trait: 'sanity' },
  { kind: 'effigy', label: 'Hình nhân', symbol: 'omen', trait: 'might' },
];

const COFFIN_WALKER = { id: 'nhap-trang', type: 'nhap-trang', name: 'Quỷ nhập tràng', traits: { speed: 3, might: 5, sanity: 2 } };

const data = (state) => state.haunt.data;
const found = (state, kind) => Boolean(data(state).found[kind]);

// Ba lễ vật đã có mặt đủ trong phòng có Quan tài (người cầm đang đứng đó, hoặc nằm trên sàn).
function offeringsInCoffinRoom(state) {
  const key = data(state).coffin;
  const kinds = new Set(tokensAt(state, key).map((t) => t.kind));
  for (const p of aliveHeroes(state)) {
    if (posKey(p.pos) === key) for (const t of tokensOf(state, p.id)) kinds.add(t.kind);
  }
  return OFFERINGS.every((o) => kinds.has(o.kind));
}

function searchOptions(state, player) {
  const def = tileDefAt(state, player.pos);
  return OFFERINGS.filter((o) => !found(state, o.kind) && def.symbol === o.symbol).map((o) => ({
    type: 'special', actionId: 'search', kind: o.kind, trait: o.trait,
    label: `Tìm ${o.label} (đổ ${o.trait === 'knowledge' ? 'Tri thức' : o.trait === 'sanity' ? 'Tinh thần' : 'Sức mạnh'}, cần ${SEARCH_TARGET}+)`,
  }));
}

registerOp('trungtang:search', (state, it) => {
  const player = state.players[it.playerId];
  const o = OFFERINGS.find((x) => x.kind === it.kind);
  if (found(state, o.kind)) return;
  if (it.total >= SEARCH_TARGET) {
    data(state).found[o.kind] = true;
    addToken(state, { id: o.kind, kind: o.kind, label: o.label, holder: player.id });
    addLog(state, `🕯 ${player.name} tìm được ${o.label}.`, 'haunt');
  } else {
    addLog(state, `${player.name} lục tìm mãi mà không thấy ${o.label}.`, 'haunt');
  }
});

registerOp('trungtang:rite', (state, it) => {
  const player = state.players[it.playerId];
  if (it.total >= RITE_TARGET) {
    data(state).done = true;
    addLog(state, `📿 ${player.name} đọc xong bài văn giải trùng. Nắp quan tài sập xuống.`, 'haunt');
  } else {
    addLog(state, `${player.name} đọc vấp lời khấn – lễ chưa thành.`, 'haunt');
  }
});

// Thần Trùng bắt người: người có Tinh thần thấp nhất (trừ người cầm Hình nhân) chịu 2 sát thương tinh thần.
function takeVictim(state) {
  const candidates = aliveHeroes(state).filter((p) => !hasToken(state, p.id, 'effigy'));
  const pool = candidates.length ? candidates : aliveHeroes(state);
  if (!pool.length) return;
  const low = Math.min(...pool.map((p) => traitValue(p, 'sanity')));
  const tied = pool.filter((p) => traitValue(p, 'sanity') === low);
  addLog(state, '⚰ Đồng hồ trùng điểm. Thần Trùng đi bắt người.', 'haunt');
  const traitorId = state.haunt.traitorId;
  if (tied.length > 1 && inPlay(state.players[traitorId])) {
    enqueueFront(state, [chooseOp(traitorId, 'Thần Trùng bắt ai?', tied.map((p) => ({ id: p.id, label: p.name })), { op: 'trungtang:take' })]);
  } else {
    enqueueFront(state, [{ op: 'trungtang:take', choice: tied[0].id }]);
  }
}

registerOp('trungtang:take', (state, it) => {
  const victim = state.players[it.choice];
  if (!inPlay(victim)) return;
  addLog(state, `Thần Trùng chọn ${victim.name}.`, 'haunt');
  enqueueFront(state, [{ op: 'damage', type: 'mental', amount: 2, playerId: victim.id, source: 'haunt-trung-tang' }]);
});

registerOp('trungtang:call', (state, it) => {
  const target = state.players[it.choice];
  addLog(state, `${state.players[it.playerId].name} gọi hồn ${target.name}.`, 'haunt');
  enqueueFront(state, [rollOp(target.id, 'sanity', 'Bị gọi hồn', { op: 'trungtang:callResult' })]);
});

registerOp('trungtang:callResult', (state, it) => {
  if (it.total < 3) enqueueFront(state, [{ op: 'lose', trait: 'sanity', amount: 1, playerId: it.playerId }]);
  else addLog(state, `${state.players[it.playerId].name} trấn tĩnh được.`, 'haunt');
});

export default {
  id: 'haunt-trung-tang',
  name: 'Trùng tang',
  mode: 'traitor',
  traitor: { rule: 'lowestTrait', trait: 'sanity' },

  publicIntro:
    'Tiếng mõ lâm râm vang lên từ một căn phòng không ai mở. Giữa nhà hiện ra một cỗ quan tài sơn đen, nắp hé mở. ' +
    'Một người trong các bạn không còn thở nữa mà vẫn đứng dậy được.',

  traitorTome: {
    title: "Traitor's Tome – Trùng tang",
    story: 'Thần Trùng đã chọn bạn làm người dẫn đường. Chỉ cần trì hoãn đủ lâu, cả nhà sẽ đi theo bạn.',
    objective: `Bạn thắng khi đồng hồ trùng chạm ${END}, hoặc mọi người sống sót đều chết.`,
    rules: [
      `Đầu mỗi lượt của bạn, đồng hồ trùng tăng 1. Ở các mốc ${TAKE_AT.join(', ')}, Thần Trùng bắt người: người sống sót có Tinh thần thấp nhất chịu 2 sát thương tinh thần (hoà thì bạn chọn).`,
      'Bạn điều khiển Quỷ nhập tràng (Tốc độ 3, Sức mạnh 5, Tinh thần 2) trong lượt quái vật. Nó không chết, chỉ bị đánh choáng.',
      '«Gọi hồn» (mỗi lượt một lần, thay cho tấn công): chọn một người sống sót cùng tầng; họ đổ Tinh thần, dưới 3 thì mất 1 Tinh thần.',
      'Người sống sót chết sẽ làm rơi lễ vật họ đang cầm tại chỗ.',
    ],
  },

  survivalSecrets: {
    title: 'Secrets of Survival – Trùng tang',
    story: 'Theo lệ xưa, muốn giải trùng phải có gạo muối, bùa gỗ đào và một hình nhân để Thần Trùng bắt thay người sống.',
    objective: `Các bạn thắng khi đưa đủ ba lễ vật vào phòng có Quan tài và làm lễ thành công trước khi đồng hồ trùng chạm ${END}.`,
    rules: [
      `«Tìm lễ vật» (mỗi lượt một lần): Gạo muối ở phòng có biểu tượng Vật phẩm (đổ Tri thức), Bùa gỗ đào ở phòng Sự kiện (đổ Tinh thần), Hình nhân ở phòng Điềm báo (đổ Sức mạnh). Cần ${SEARCH_TARGET}+. Mỗi lễ vật chỉ có một.`,
      'Lễ vật trao cho nhau được khi đứng cùng phòng, và nhặt lại được nếu bị rơi.',
      `«Làm lễ giải trùng»: khi cả ba lễ vật ở trong phòng có Quan tài, đổ Tri thức ${RITE_TARGET}+, cộng 1 xúc xắc cho mỗi người sống sót khác cùng phòng.`,
      `Ai cầm Hình nhân thì Thần Trùng không bắt ở các mốc ${TAKE_AT.join(', ')}.`,
      'Quỷ nhập tràng bị đánh bằng Sức mạnh; ai cầm Gạo muối được +2 xúc xắc khi đánh nó.',
    ],
  },

  setup(state) {
    const traitor = state.players[state.haunt.traitorId];
    state.haunt.data = { clock: 0, coffin: posKey(traitor.pos), found: {}, done: false };
    spawnMonster(state, COFFIN_WALKER, traitor.pos);
    addLog(state, `Cỗ quan tài nằm giữa ${roomName(state, traitor.pos)}. Quỷ nhập tràng bật dậy từ trong đó.`, 'haunt');
  },

  onTurnStart(state, playerId) {
    if (playerId !== state.haunt.traitorId || state.haunt.pendingFirstTurn) return;
    const d = data(state);
    d.clock += 1;
    addLog(state, `⏳ Đồng hồ trùng: ${d.clock}/${END}.`, 'haunt');
    if (TAKE_AT.includes(d.clock)) takeVictim(state);
  },

  onPlayerDeath(state, player) {
    dropTokens(state, player);
  },

  attackBonus(state, attacker, target) {
    if (attacker.kind === 'player' && target.kind === 'monster' && hasToken(state, attacker.id, 'rice')) return 2;
    return 0;
  },

  specialActions(state, playerId) {
    const me = state.players[playerId];
    const out = [];
    if (me.side === 'traitor') {
      if (!state.turn.hasAttacked) {
        const targets = aliveHeroes(state).filter((p) => p.pos.floor === me.pos.floor);
        if (targets.length) out.push({ type: 'special', actionId: 'call', label: 'Gọi hồn một người cùng tầng' });
      }
      return out;
    }
    if (!state.turn.usedSpecial) {
      out.push(...searchOptions(state, me));
      if (posKey(me.pos) === data(state).coffin && offeringsInCoffinRoom(state)) {
        out.push({ type: 'special', actionId: 'rite', label: `Làm lễ giải trùng (đổ Tri thức, cần ${RITE_TARGET}+)` });
      }
    }
    out.push(...tokenActions(state, playerId));
    return out;
  },

  performSpecial(state, playerId, action) {
    if (handleTokenAction(state, playerId, action)) return;
    const me = state.players[playerId];
    if (action.actionId === 'call') {
      if (me.side !== 'traitor' || state.turn.hasAttacked) throw new GameError('Không thể gọi hồn lúc này.');
      const targets = aliveHeroes(state).filter((p) => p.pos.floor === me.pos.floor);
      if (!targets.length) throw new GameError('Không có ai cùng tầng.');
      state.turn.hasAttacked = true;
      enqueueFront(state, [chooseOp(playerId, 'Gọi hồn ai?', targets.map((p) => ({ id: p.id, label: p.name })), { op: 'trungtang:call' }, { always: true })]);
      return;
    }
    if (me.side === 'traitor' || state.turn.usedSpecial) throw new GameError('Không thể làm vậy lúc này.');
    if (action.actionId === 'search') {
      const opt = searchOptions(state, me).find((o) => o.kind === action.kind);
      if (!opt) throw new GameError('Ở đây không tìm được lễ vật đó.');
      state.turn.usedSpecial = true;
      enqueueFront(state, [rollOp(playerId, opt.trait, 'Tìm lễ vật', { op: 'trungtang:search', kind: opt.kind })]);
      return;
    }
    if (action.actionId === 'rite') {
      if (posKey(me.pos) !== data(state).coffin || !offeringsInCoffinRoom(state)) throw new GameError('Chưa đủ lễ vật trong phòng có Quan tài.');
      state.turn.usedSpecial = true;
      const helpers = aliveHeroes(state).filter((p) => p.id !== playerId && samePos(p.pos, me.pos)).length;
      enqueueFront(state, [rollOp(playerId, 'knowledge', 'Làm lễ giải trùng', { op: 'trungtang:rite' }, helpers)]);
      return;
    }
    throw new GameError('Hành động đặc biệt không tồn tại.');
  },

  publicData(state) {
    const d = data(state);
    const tokens = tokenDisplay(state);
    const missing = OFFERINGS.filter((o) => !found(state, o.kind)).map((o) => o.label);
    return {
      meters: [{ id: 'clock', label: 'Đồng hồ trùng', value: d.clock, max: END, tone: 'danger', marksAt: TAKE_AT }],
      notes: [missing.length ? `Còn phải tìm: ${missing.join(', ')}.` : 'Đã đủ ba lễ vật – mang tất cả về phòng có Quan tài.'],
      marks: mergeMarks({ [d.coffin]: [{ kind: 'coffin', label: 'Quan tài' }] }, tokens.marks),
      carried: tokens.carried,
      coffin: d.coffin,
      coffinRoom: roomName(state, posOf(state, d.coffin)),
    };
  },

  checkVictory(state) {
    const d = data(state);
    if (d.done) return { side: 'heroes', reason: 'Lễ giải trùng đã thành. Thần Trùng rời khỏi ngôi nhà.' };
    if (d.clock >= END) return { side: 'traitor', reason: 'Đồng hồ trùng điểm lần cuối. Cả nhà đi theo người đã khuất.' };
    if (!aliveHeroes(state).length) return { side: 'traitor', reason: 'Không còn ai sống sót.' };
    return null;
  },
};
