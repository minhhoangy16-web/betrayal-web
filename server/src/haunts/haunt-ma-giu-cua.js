// HAUNT «Ma giữ của» – mạnh ai nấy chơi: đào hũ vàng, cướp của nhau, mang ra khỏi nhà.
// Vị trí hũ chưa đào chỉ lưu ở server; người lật Haunt được biết riêng chỗ của một hũ.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { resolveCombat } from '../engine/combat.js';
import { randInt, shuffle } from '../engine/rng.js';
import { FLOOR_LABEL } from '../engine/constants.js';
import {
  playersInPlay, spawnMonster, tileDefAt, roomName, rooms, posOf, distances, stepToward, rollOp, chooseOp,
  addToken, tokensOf, removeToken, dropTokens, tokenActions, handleTokenAction, tokenDisplay, mergeMarks, escapePlayer,
} from './helpers.js';

const ROUNDS = 12;
const DIG_TARGET = 4;
const JARS_TO_LEAVE = 3;
const STEPS = 4;
const EXIT = 'entrance-hall';
const SHRINES = ['chapel', 'ritual-chamber'];
const NO_GOLD = ['entrance-hall', 'foyer', 'grand-staircase', 'upper-landing', 'basement-landing'];
const GUARD = { id: 'ma-giu-cua', type: 'ma-giu-cua', name: 'Ma giữ của', traits: { speed: STEPS, might: 5, sanity: 4 }, ai: true };

const data = (state) => state.haunt.data;
const guard = (state) => state.monsters[GUARD.id];
const jars = (state, id) => tokensOf(state, id).filter((t) => t.kind === 'gold').length;
const living = (state) => playersInPlay(state).filter((p) => p.alive);
const roundsLeft = (state) => Math.max(0, data(state).dawnRound - state.round);
const ignored = (state, p) => (data(state).ignoreUntil[p.id] ?? 0) > state.round;

function newJar(state, holder) {
  const d = data(state);
  d.jarSeq += 1;
  return addToken(state, { id: `hu-${d.jarSeq}`, kind: 'gold', label: 'Hũ vàng', holder });
}

// Chôn một hũ vào phòng ngẫu nhiên (chưa có hũ). Phòng đó không còn tính là «đã đào».
function bury(state, preferBasement = false) {
  const d = data(state);
  const free = rooms(state, (pos, def) => !NO_GOLD.includes(def.id) && !d.hidden.includes(posKey(pos)));
  if (!free.length) return null;
  const basement = free.filter((k) => k.startsWith('basement'));
  const pool = preferBasement && basement.length && randInt(state, 3) > 0 ? basement : free;
  const key = pool[randInt(state, pool.length)];
  d.hidden.push(key);
  d.dug = d.dug.filter((k) => k !== key);
  return key;
}

registerOp('giucua:dig', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  const key = posKey(me.pos);
  if (it.total < DIG_TARGET) {
    addLog(state, `${me.name} đào mãi mà nền nhà vẫn cứng như đá.`, 'haunt');
    return;
  }
  if (d.hidden.includes(key)) {
    d.hidden = d.hidden.filter((k) => k !== key);
    newJar(state, me.id);
    addLog(state, `💰 ${me.name} đào được một hũ vàng ở ${roomName(state, me.pos)}! (đang giữ ${jars(state, me.id)})`, 'haunt');
  } else {
    addLog(state, `${me.name} đào tung ${roomName(state, me.pos)} nhưng chẳng có gì.`, 'haunt');
  }
  if (!d.dug.includes(key)) d.dug.push(key);
});

// Người thắng trận giữa hai người chơi chọn: gây sát thương hay cướp một hũ.
registerOp('giucua:spoils', (state, it) => {
  const loser = state.players[it.loserId];
  const winner = state.players[it.playerId];
  if (it.choice === 'steal') {
    const jar = tokensOf(state, loser.id).find((t) => t.kind === 'gold');
    if (jar) {
      jar.holder = winner.id;
      addLog(state, `🪙 ${winner.name} cướp một hũ vàng của ${loser.name}!`, 'haunt');
      return;
    }
  }
  enqueueFront(state, [{ op: 'damage', type: it.damageType, amount: it.amount, playerId: loser.id, source: 'combat' }]);
});

registerOp('giucua:guard', (state) => {
  const g = guard(state);
  if (!g || state.winner) return;
  if (g.stunned) {
    g.stunned = false;
    addLog(state, `${g.name} lồm cồm tỉnh lại.`, 'haunt');
    return;
  }
  const pick = () => {
    const targets = living(state).filter((p) => !ignored(state, p));
    if (!targets.length) return null;
    const dist = distances(state, g.pos);
    const most = Math.max(...targets.map((p) => jars(state, p.id)));
    const pool = targets.filter((p) => jars(state, p.id) === most);
    return pool.map((p) => ({ p, d: dist.get(posKey(p.pos)) ?? 99 })).sort((a, b) => a.d - b.d)[0].p;
  };
  for (let i = 0; i < STEPS; i++) {
    const t = pick();
    if (!t || samePos(t.pos, g.pos)) break;
    const step = stepToward(state, g.pos, t.pos);
    if (!step) break;
    g.pos = step.pos;
  }
  const here = living(state).filter((p) => samePos(p.pos, g.pos) && !ignored(state, p));
  if (!here.length) return;
  const victim = here.sort((a, b) => jars(state, b.id) - jars(state, a.id))[0];
  resolveCombat(state, { kind: 'monster', id: g.id }, { kind: 'player', id: victim.id }, 'might');
});

function specials(state, me) {
  const d = data(state);
  const out = [];
  const def = tileDefAt(state, me.pos);
  const key = posKey(me.pos);
  const mine = jars(state, me.id);
  if (!state.turn.usedSpecial && !NO_GOLD.includes(def.id) && !d.dug.includes(key)) {
    out.push({ type: 'special', actionId: 'dig', label: `Đào của (đổ Sức mạnh, cần ${DIG_TARGET}+)` });
  }
  if (!state.turn.usedSpecial && SHRINES.includes(def.id) && mine > 0) {
    out.push({ type: 'special', actionId: 'return', label: 'Trả của (bỏ 1 hũ, Ma giữ của tha bạn 2 vòng)' });
  }
  if (def.id === EXIT && mine >= JARS_TO_LEAVE) {
    out.push({ type: 'special', actionId: 'leave', label: `Rời khỏi nhà với ${mine} hũ vàng` });
  }
  out.push(...tokenActions(state, me.id, { canGive: false }));
  return out;
}

export default {
  id: 'haunt-ma-giu-cua',
  name: 'Ma giữ của',
  mode: 'solo',
  playerSide: 'solo',
  traitor: { rule: 'none' },

  publicIntro:
    'Sàn nhà nứt ra, lộ một miệng hũ sành đầy vàng lá. Ai cũng nhìn thấy, và ai cũng nhìn nhau. ' +
    'Từ dưới hầm vọng lên tiếng một đứa trẻ đang đếm: «Một hũ… hai hũ…»',

  traitorTome: null,

  survivalSecrets: {
    title: 'Sách chung – Ma giữ của',
    story: 'Chủ cũ của ngôi nhà chôn vàng dưới nền và yểm một linh hồn trẻ con canh giữ. Đêm nay mạnh ai nấy đào.',
    objective: `Mỗi người chơi cho riêng mình. Bạn thắng một mình nếu là người đầu tiên đứng ở Sảnh vào với ít nhất ${JARS_TO_LEAVE} hũ vàng và chọn «Rời khỏi nhà». Nếu chưa ai rời được, lúc gà gáy (sau ${ROUNDS} vòng) người còn sống giữ nhiều hũ nhất thắng (bằng nhau thì cùng thắng).`,
    lose: [
      'Có người khác ra khỏi nhà với vàng trước bạn.',
      'Gà gáy mà bạn đã chết hoặc giữ ít hũ hơn người khác.',
      'Gà gáy mà không ai còn sống giữ được hũ nào, hoặc tất cả đều chết: ngôi nhà thắng, không ai thắng.',
    ],
    setup: [
      'Không có Kẻ phản bội và không có phe: ai cũng có thể đánh ai.',
      `Có (số người chơi + 3) hũ vàng chôn trong nhà, phần lớn ở tầng hầm. Không có hũ ở Sảnh vào, Tiền sảnh và các phòng cầu thang / chiếu nghỉ.`,
      'Người lật Haunt được biết riêng chỗ chôn của một hũ (đánh dấu trên bàn cờ, chỉ người đó thấy).',
      'Ma giữ của (game điều khiển: Tốc độ 4, Sức mạnh 5) thức dậy ở Chiếu nghỉ tầng hầm.',
    ],
    rules: [
      `«Đào của» (mỗi lượt một lần): đổ Sức mạnh ${DIG_TARGET}+ ở phòng đang đứng. Có hũ thì lấy được; không có thì phòng bị đánh dấu «đã đào». Trượt thì không có gì, phòng chưa bị đánh dấu nên đào lại được.`,
      'Bảng tình hình cho biết mỗi tầng còn bao nhiêu hũ chưa đào, và ai đang giữ bao nhiêu hũ.',
      'Của nặng: cứ 2 hũ đang mang thì bớt 1 bước di chuyển mỗi lượt (ít nhất vẫn đi được 1 bước).',
      'Thắng trận với người chơi khác: bạn chọn gây sát thương như thường hoặc cướp 1 hũ của họ. Hũ vàng không trao tặng được.',
      `Cuối mỗi vòng, Ma giữ của đi ${STEPS} bước về phía người đang giữ nhiều hũ nhất rồi tấn công bằng Sức mạnh. Nó thắng thì giật lại 1 hũ và chôn vào một phòng ngẫu nhiên (phòng đó có thể đào lại). Đánh thắng nó thì nó choáng, bỏ một vòng.`,
      '«Trả của» ở Nhà nguyện hoặc Phòng tế lễ: bỏ vĩnh viễn 1 hũ để Ma giữ của tha bạn trong 2 vòng.',
      'Người chết làm rơi hết hũ tại chỗ; ai đến đó cũng nhặt được.',
    ],
    tips: [
      'Đừng ôm quá nhiều hũ đi chậm: Ma giữ của và người khác đều nhắm vào người giàu nhất.',
      'Khi đủ 3 hũ, chạy thẳng về Sảnh vào.',
    ],
  },

  setup(state) {
    const n = state.turnOrder.length;
    state.haunt.data = {
      hidden: [], dug: [], jarSeq: 0, ignoreUntil: {}, leftId: null, dawn: false,
      dawnRound: state.round + ROUNDS, knownBy: {},
    };
    for (let i = 0; i < n + 3; i++) bury(state, true);
    const d = data(state);
    spawnMonster(state, GUARD, 'basement-landing');
    const hint = shuffle(state, d.hidden)[0];
    if (hint) {
      d.knownBy[state.haunt.revealerId] = hint;
      addLog(state, `Bạn thoáng thấy ánh vàng dưới sàn ${roomName(state, posOf(state, hint))} (${FLOOR_LABEL[posOf(state, hint).floor]}).`, 'haunt', state.haunt.revealerId);
    }
    addLog(state, `Có ${d.hidden.length} hũ vàng chôn trong nhà. Ma giữ của đã thức giấc ở Chiếu nghỉ tầng hầm.`, 'haunt');
  },

  areEnemies(state, a, b) {
    return a.id !== b.id;
  },

  monsterCanTarget() {
    return true;
  },

  canAttackMonster() {
    return true;
  },

  onTurnStart(state, playerId) {
    const p = state.players[playerId];
    const slow = Math.floor(jars(state, playerId) / 2);
    if (slow && state.turn.movesLeft > 0) {
      state.turn.movesLeft = Math.max(1, state.turn.movesLeft - slow);
      addLog(state, `${p.name} mang nặng, chỉ đi được ${state.turn.movesLeft} bước.`, 'haunt');
    }
  },

  // Thua người chơi khác mà đang có hũ: người thắng chọn cướp hay đánh.
  onCombatLoss(state, loser, amount, trait, winner) {
    if (loser.kind !== 'player' || winner?.kind !== 'player' || jars(state, loser.id) === 0) return undefined;
    const damageType = trait === 'might' || trait === 'speed' ? 'physical' : 'mental';
    enqueueFront(state, [chooseOp(winner.id, `Bạn thắng ${state.players[loser.id].name}. Làm gì?`, [
      { id: 'steal', label: 'Cướp 1 hũ vàng' },
      { id: 'hurt', label: `Gây ${amount} sát thương` },
    ], { op: 'giucua:spoils', loserId: loser.id, amount, damageType }, { always: true })]);
    return true;
  },

  onCombatWin(state, winner, loser) {
    if (winner.kind === 'monster' && winner.id === GUARD.id && loser.kind === 'player') {
      const jar = tokensOf(state, loser.id).find((t) => t.kind === 'gold');
      if (!jar) return;
      removeToken(state, jar.id);
      bury(state);
      addLog(state, `${guard(state).name} giật lại một hũ vàng của ${state.players[loser.id].name} và đem đi chôn chỗ khác.`, 'haunt');
    }
  },

  onPlayerDeath(state, player) {
    dropTokens(state, player);
  },

  onRoundEnd(state) {
    const d = data(state);
    if (state.round >= d.dawnRound) {
      d.dawn = true;
      return;
    }
    if (roundsLeft(state) <= 2) addLog(state, `🐓 Còn ${roundsLeft(state)} vòng nữa là gà gáy.`, 'haunt');
    enqueueFront(state, [{ op: 'giucua:guard' }]);
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    if (handleTokenAction(state, playerId, action)) return;
    const me = state.players[playerId];
    const d = data(state);
    if (!specials(state, me).some((a) => a.actionId === action.actionId)) throw new GameError('Không thể làm vậy lúc này.');
    if (action.actionId === 'dig') {
      state.turn.usedSpecial = true;
      enqueueFront(state, [rollOp(playerId, 'might', 'Đào của', { op: 'giucua:dig' })]);
    } else if (action.actionId === 'return') {
      state.turn.usedSpecial = true;
      removeToken(state, tokensOf(state, playerId).find((t) => t.kind === 'gold').id);
      d.ignoreUntil[playerId] = state.round + 2;
      addLog(state, `🙏 ${me.name} trả lại một hũ vàng. Ma giữ của sẽ để yên cho họ hai vòng.`, 'haunt');
    } else if (action.actionId === 'leave') {
      d.leftId = playerId;
      escapePlayer(state, me, `ôm ${jars(state, playerId)} hũ vàng chạy ra khỏi nhà!`);
    }
  },

  publicData(state, viewerId) {
    const d = data(state);
    const tokens = tokenDisplay(state);
    const marks = {};
    for (const key of d.dug) marks[key] = [{ kind: 'dug', label: 'Đã đào' }];
    const exit = state.board.index[EXIT];
    if (exit) (marks[exit] ??= []).push({ kind: 'exit', label: `Lối ra (cần ${JARS_TO_LEAVE} hũ)` });
    const known = d.knownBy[viewerId];
    if (known && d.hidden.includes(known)) (marks[known] ??= []).push({ kind: 'gold', label: 'Bạn thấy ánh vàng ở đây' });
    const perFloor = ['upper', 'ground', 'basement']
      .map((f) => [f, d.hidden.filter((k) => k.startsWith(`${f}:`)).length])
      .filter(([, n]) => n)
      .map(([f, n]) => `${FLOOR_LABEL[f]} ${n}`);
    const elapsed = ROUNDS - roundsLeft(state);
    const rich = living(state).map((p) => [p.name, jars(state, p.id)]).filter(([, n]) => n).map(([name, n]) => `${name}: ${n}`);
    return {
      meters: [{ id: 'dawn', label: 'Tới lúc gà gáy', value: elapsed, max: ROUNDS, tone: 'neutral' }],
      notes: [
        perFloor.length ? `Hũ chưa đào: ${perFloor.join(', ')}.` : 'Không còn hũ nào chôn dưới đất.',
        rich.length ? `Đang giữ hũ: ${rich.join(', ')}.` : 'Chưa ai có hũ nào.',
      ],
      marks: mergeMarks(marks, tokens.marks),
      carried: tokens.carried,
    };
  },

  checkVictory(state) {
    const d = data(state);
    if (d.leftId) {
      return { side: 'players', playerIds: [d.leftId], reason: `${state.players[d.leftId].name} đã mang vàng ra khỏi nhà.` };
    }
    const alive = living(state);
    if (!alive.length) return { side: 'house', reason: 'Không ai sống sót. Vàng lại nằm yên dưới nền nhà.' };
    if (d.dawn) {
      const most = Math.max(...alive.map((p) => jars(state, p.id)));
      if (most === 0) return { side: 'house', reason: 'Gà gáy mà không ai giữ nổi một hũ vàng.' };
      const winners = alive.filter((p) => jars(state, p.id) === most).map((p) => p.id);
      return { side: 'players', playerIds: winners, reason: `Gà gáy. Người giữ nhiều vàng nhất (${most} hũ) là người thắng.` };
    }
    return null;
  },
};
