// HAUNT «Cô hồn tháng Bảy» – không có Kẻ phản bội: cả bàn hợp tác gom lễ cúng, chống cô hồn do game điều khiển.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { resolveCombat } from '../engine/combat.js';
import { randInt } from '../engine/rng.js';
import {
  playersInPlay, spawnMonster, tileDefAt, roomName, rooms, posOf, tilePos, distances, stepToward, rollOp,
  addToken, tokensOf, removeToken, dropTokens, tokenActions, handleTokenAction, tokenDisplay, mergeMarks,
} from './helpers.js';

const END = 10;
const STEPS = 3;
const SEEK_TARGET = 4;
const BURN_TARGET = 4;
const ALTAR = 'entrance-hall';
const PORRIDGE_ROOMS = ['kitchen', 'larder'];
const GHOST = { type: 'co-hon', name: 'Cô hồn', traits: { speed: STEPS, might: null, sanity: 3 }, ai: true };
const OFFERINGS = {
  gao: { label: 'Gạo muối', trait: 'knowledge' },
  vangma: { label: 'Tiền vàng mã', trait: 'sanity' },
  chao: { label: 'Nồi cháo', trait: null },
};

const data = (state) => state.haunt.data;
const ghosts = (state) => Object.values(state.monsters).filter((m) => m.type === GHOST.type);
const isGhost = (state, ref) => ref.kind === 'monster' && state.monsters[ref.id]?.type === GHOST.type;
const altarPos = (state) => tilePos(state, ALTAR);
const bigTable = (state) => state.turnOrder.length >= 5;

function spawnGhost(state, where) {
  const d = data(state);
  d.spawned += 1;
  return spawnMonster(state, { ...GHOST, id: `co-hon-${d.spawned}`, name: `Cô hồn ${d.spawned}` }, where);
}

function raiseAm(state, n, why) {
  const d = data(state);
  d.am = Math.min(END, d.am + n);
  addLog(state, `🌫 Âm khí ${n > 0 ? 'tăng' : 'giảm'} ${Math.abs(n)}${why ? ` (${why})` : ''}: ${d.am}/${END}.`, 'haunt');
}

// Phòng này còn cho được lễ gì (null nếu không).
function offeringHere(state, pos) {
  const key = posKey(pos);
  if (data(state).used.includes(key)) return null;
  const def = tileDefAt(state, pos);
  if (PORRIDGE_ROOMS.includes(def.id)) return 'chao';
  if (def.symbol === 'item') return 'gao';
  if (def.symbol === 'event') return 'vangma';
  return null;
}

function giveOffering(state, playerId, kind) {
  const d = data(state);
  d.found += 1;
  addToken(state, { id: `le-${d.found}`, kind, label: OFFERINGS[kind].label, holder: playerId });
  addLog(state, `🍚 ${state.players[playerId].name} tìm được ${OFFERINGS[kind].label}.`, 'haunt');
}

registerOp('cohon:seek', (state, it) => {
  if (it.total >= SEEK_TARGET) giveOffering(state, it.playerId, it.kind);
  else addLog(state, `${state.players[it.playerId].name} lục lọi mãi mà không thấy gì dùng được.`, 'haunt');
});

registerOp('cohon:burn', (state, it) => {
  if (it.total >= BURN_TARGET) {
    data(state).burned = true;
    addLog(state, '🔥 Vàng mã cháy rực. Những bóng đen cúi đầu nhận lễ rồi tan vào màn đêm.', 'haunt');
  } else {
    addLog(state, 'Lửa leo lét rồi tắt ngấm. Cô hồn chưa chịu nhận lễ.', 'haunt');
  }
});

// Cô hồn hành động: đi 3 bước về phía người gần nhất (ai cầm lễ thì tính như gần hơn 1 phòng), rồi tấn công.
registerOp('cohon:act', (state, it) => {
  const ghost = state.monsters[it.monsterId];
  if (!ghost || state.winner) return;
  const players = playersInPlay(state);
  const target = () => {
    const dist = distances(state, ghost.pos);
    let best = null;
    for (const p of players) {
      if (!p.alive) continue;
      const raw = dist.get(posKey(p.pos));
      if (raw === undefined) continue;
      const d = raw - (tokensOf(state, p.id).length ? 1 : 0);
      if (!best || d < best.d) best = { p, d };
    }
    return best?.p ?? null;
  };
  for (let i = 0; i < STEPS; i++) {
    const p = target();
    if (!p || samePos(p.pos, ghost.pos)) break;
    const step = stepToward(state, ghost.pos, p.pos);
    if (!step) break;
    ghost.pos = step.pos;
  }
  const here = players.filter((p) => p.alive && samePos(p.pos, ghost.pos));
  if (!here.length) return;
  const victim = here.find((p) => tokensOf(state, p.id).length) ?? here[0];
  resolveCombat(state, { kind: 'monster', id: ghost.id }, { kind: 'player', id: victim.id }, 'sanity');
});

registerOp('cohon:spawn', (state) => {
  const omenRooms = rooms(state, (pos, def) => def.symbol === 'omen');
  const count = bigTable(state) ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const where = omenRooms.length ? omenRooms[randInt(state, omenRooms.length)] : 'basement-landing';
    const g = spawnGhost(state, where);
    addLog(state, `👻 ${g.name} lẩn khuất hiện ra ở ${roomName(state, g.pos)}.`, 'haunt');
  }
});

function specials(state, me) {
  const d = data(state);
  const out = [];
  const atAltar = samePos(me.pos, altarPos(state));
  if (!state.turn.usedSpecial) {
    const kind = offeringHere(state, me.pos);
    if (kind) {
      const t = OFFERINGS[kind].trait;
      out.push({
        type: 'special', actionId: 'seek',
        label: t ? `Tìm ${OFFERINGS[kind].label} (đổ ${t === 'knowledge' ? 'Tri thức' : 'Tinh thần'}, cần ${SEEK_TARGET}+)` : `Lấy ${OFFERINGS[kind].label}`,
      });
    }
    if (atAltar && d.altar >= d.need) {
      out.push({ type: 'special', actionId: 'burn', label: `Đốt vàng mã (đổ Tinh thần, cần ${BURN_TARGET}+)` });
    }
  }
  if (atAltar && d.altar < d.need) {
    for (const t of tokensOf(state, me.id)) {
      out.push({ type: 'special', actionId: 'offer', tokenId: t.id, label: `Dâng ${t.label} lên Mâm cúng` });
    }
  }
  out.push(...tokenActions(state, me.id));
  return out;
}

export default {
  id: 'haunt-co-hon',
  name: 'Cô hồn tháng Bảy',
  mode: 'coop',
  traitor: { rule: 'none' },

  publicIntro:
    'Đồng hồ điểm mười hai tiếng dù kim đã gỉ từ lâu. Ngoài cửa sổ, trăng rằm đỏ như máu. ' +
    'Từ khắp các xó tối vang lên tiếng thì thầm: «Đói… đói…»',

  traitorTome: null,

  survivalSecrets: {
    title: 'Sách chung – Cô hồn tháng Bảy',
    story: 'Rằm tháng Bảy, cửa ngục mở. Những vong hồn không ai thờ cúng đang kéo về đòi ăn. Cúng cho đủ rồi đốt vàng mã tiễn họ đi.',
    objective: `Dâng đủ lễ (số người chơi + 3) lên Mâm cúng ở Sảnh vào, rồi đốt vàng mã thành công trước khi Âm khí chạm ${END}. Không có Kẻ phản bội: cả bàn cùng thắng hoặc cùng thua.`,
    rules: [
      `«Tìm lễ cúng» (mỗi lượt một lần): ở phòng biểu tượng Vật phẩm đổ Tri thức ${SEEK_TARGET}+ lấy Gạo muối; ở phòng Sự kiện đổ Tinh thần ${SEEK_TARGET}+ lấy Tiền vàng mã; ở Nhà bếp hoặc Phòng thực phẩm lấy Nồi cháo, không cần đổ. Mỗi phòng chỉ cho lễ một lần.`,
      '«Dâng lễ» ở Sảnh vào: đặt một lễ lên Mâm cúng. Âm khí giảm 1, và Cô hồn gần Mâm cúng nhất no bụng rời đi.',
      `«Đốt vàng mã» khi Mâm cúng đã đủ lễ: đứng ở Sảnh vào đổ Tinh thần ${BURN_TARGET}+, cộng 1 xúc xắc cho mỗi người khác cùng phòng. Thành công là cả bàn thắng.`,
      'Đánh Cô hồn bằng Tinh thần; thắng thì nó tan biến, thua thì chịu sát thương tinh thần. Cô hồn thắng một người đang cầm lễ thì giật mất một lễ.',
      `Lượt của ngôi nhà (cuối mỗi vòng): Âm khí tăng 1, cộng 1 cho mỗi 2 Cô hồn; thêm Cô hồn ở một phòng Điềm báo; mỗi Cô hồn đi ${STEPS} bước về phía người gần nhất (người cầm lễ hút chúng hơn) rồi tấn công.`,
    ],
  },

  setup(state) {
    state.haunt.data = { am: 0, altar: 0, need: state.turnOrder.length + 3, used: [], found: 0, spawned: 0, burned: false };
    spawnGhost(state, 'basement-landing');
    spawnGhost(state, 'basement-landing');
    addLog(state, 'Mâm cúng được bày ra giữa Sảnh vào. Hai bóng đen trồi lên ở Chiếu nghỉ tầng hầm.', 'haunt');
  },

  attackTraits(state, attacker, target) {
    return isGhost(state, target) ? ['sanity'] : undefined;
  },

  // Cô hồn thua trận thì tan biến.
  onCombatLoss(state, loser) {
    if (isGhost(state, loser)) {
      addLog(state, `${state.monsters[loser.id].name} tan biến thành làn khói xám.`, 'combat');
      delete state.monsters[loser.id];
      return true;
    }
    return undefined;
  },

  onCombatWin(state, winner, loser) {
    if (isGhost(state, winner) && loser.kind === 'player') {
      const grabbed = tokensOf(state, loser.id)[0];
      if (grabbed) {
        removeToken(state, grabbed.id);
        addLog(state, `${state.monsters[winner.id].name} giật mất ${grabbed.label} của ${state.players[loser.id].name}!`, 'haunt');
      }
    }
  },

  onPlayerDeath(state, player) {
    dropTokens(state, player);
  },

  onRoundEnd(state) {
    if (state.winner) return;
    const extra = Math.floor(ghosts(state).length / 2);
    raiseAm(state, 1 + extra, 'ngôi nhà');
    enqueueFront(state, [
      { op: 'cohon:spawn' },
      { op: 'cohon:actAll' },
    ]);
  },

  specialActions(state, playerId) {
    const me = state.players[playerId];
    return specials(state, me);
  },

  performSpecial(state, playerId, action) {
    if (handleTokenAction(state, playerId, action)) return;
    const me = state.players[playerId];
    const d = data(state);
    const option = specials(state, me).find((a) => a.actionId === action.actionId && (a.tokenId ?? null) === (action.tokenId ?? null));
    if (!option) throw new GameError('Không thể làm vậy lúc này.');
    if (action.actionId === 'seek') {
      state.turn.usedSpecial = true;
      const kind = offeringHere(state, me.pos);
      d.used.push(posKey(me.pos));
      const trait = OFFERINGS[kind].trait;
      if (trait) enqueueFront(state, [rollOp(playerId, trait, `Tìm ${OFFERINGS[kind].label}`, { op: 'cohon:seek', kind })]);
      else giveOffering(state, playerId, kind);
    } else if (action.actionId === 'offer') {
      const token = tokensOf(state, playerId).find((t) => t.id === action.tokenId);
      removeToken(state, token.id);
      d.altar += 1;
      addLog(state, `🕯 ${me.name} dâng ${token.label} lên Mâm cúng (${d.altar}/${d.need}).`, 'haunt');
      if (d.am > 0) raiseAm(state, -1, 'dâng lễ');
      const dist = distances(state, altarPos(state));
      const full = ghosts(state).sort((a, b) => (dist.get(posKey(a.pos)) ?? 99) - (dist.get(posKey(b.pos)) ?? 99))[0];
      if (full) {
        addLog(state, `${full.name} no bụng, lặng lẽ rời đi.`, 'haunt');
        delete state.monsters[full.id];
      }
    } else if (action.actionId === 'burn') {
      state.turn.usedSpecial = true;
      const helpers = playersInPlay(state).filter((p) => p.id !== playerId && p.alive && samePos(p.pos, me.pos)).length;
      enqueueFront(state, [rollOp(playerId, 'sanity', 'Đốt vàng mã', { op: 'cohon:burn' }, helpers)]);
    }
  },

  publicData(state) {
    const d = data(state);
    const tokens = tokenDisplay(state);
    const marks = {};
    const altar = state.board.index[ALTAR];
    if (altar) marks[altar] = [{ kind: 'altar', label: `Mâm cúng (${d.altar}/${d.need} lễ)` }];
    for (const key of rooms(state)) {
      if (!d.used.includes(key) && offeringHere(state, posOf(state, key))) {
        (marks[key] ??= []).push({ kind: 'offering', label: `Còn ${OFFERINGS[offeringHere(state, posOf(state, key))].label}` });
      }
    }
    return {
      meters: [
        { id: 'am', label: 'Âm khí', value: d.am, max: END, tone: 'danger' },
        { id: 'altar', label: 'Lễ trên Mâm cúng', value: d.altar, max: d.need, tone: 'good' },
      ],
      notes: [
        `${ghosts(state).length} Cô hồn đang lảng vảng trong nhà.`,
        d.altar >= d.need ? 'Đã đủ lễ: hãy đốt vàng mã ở Sảnh vào!' : `Còn thiếu ${d.need - d.altar} lễ.`,
      ],
      marks: mergeMarks(marks, tokens.marks),
      carried: tokens.carried,
    };
  },

  checkVictory(state) {
    const d = data(state);
    if (d.burned) return { side: 'heroes', reason: 'Vàng mã đã cháy hết. Cô hồn nhận lễ và rời đi trong yên lặng.' };
    if (!playersInPlay(state).some((p) => p.alive)) return { side: 'house', reason: 'Không còn ai đủ sức đứng ra cúng.' };
    if (d.am >= END) return { side: 'house', reason: 'Âm khí phủ kín ngôi nhà. Từ nay nó thuộc về những kẻ đói khát.' };
    return null;
  },
};

// Mỗi Cô hồn hành động lần lượt (để sát thương của con trước được chia xong trước con sau).
registerOp('cohon:actAll', (state) => {
  enqueueFront(state, ghosts(state).map((g) => ({ op: 'cohon:act', monsterId: g.id })));
});
