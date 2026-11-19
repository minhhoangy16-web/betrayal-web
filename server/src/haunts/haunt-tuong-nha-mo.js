// HAUNT «Tượng nhà mồ» – hợp tác, theo cơ chế «tượng chỉ đi khi không ai nhìn».
// Tượng không đánh và không bị đánh. Ai nhìn thấy tượng (tầm nhìn: cùng phòng hoặc các phòng nối thẳng hàng
// qua cửa) thì bị sát thương; muốn diệt tượng phải «Ú òa»: đứng cùng phòng một tượng mà có tượng khác trong tầm
// nhìn, để hai tượng nhìn nhau và cùng hoá gỗ đá vĩnh viễn.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { rollDice } from '../engine/dice.js';
import { randInt } from '../engine/rng.js';
import { playersInPlay, spawnMonster, rooms, roomName, distances, stepToward, lineOfSight, rollOp } from './helpers.js';

const PEEK_TARGET = 4;
const PEEK_FAIL_DICE = 1;
const MIRROR_CARD = 'om-girl-in-mirror';
const STATUE = { type: 'tuong-go', name: 'Tượng gỗ', traits: { speed: 4, might: 8, sanity: 8, knowledge: 8 }, ai: true };

const data = (state) => state.haunt.data;
const statues = (state) => Object.values(state.monsters).filter((m) => m.type === STATUE.type);
const isStatue = (state, ref) => ref?.kind === 'monster' && state.monsters[ref.id]?.type === STATUE.type;
const heroes = (state) => playersInPlay(state).filter((p) => p.alive);

// Các tượng nằm trong tầm nhìn của một người.
function visibleStatues(state, player) {
  const los = lineOfSight(state, player.pos);
  return statues(state).filter((m) => los.has(posKey(m.pos)));
}

// Tượng có đang bị ai đó nhìn không.
function watched(state, statue) {
  return heroes(state).some((p) => lineOfSight(state, p.pos).has(posKey(statue.pos)));
}

function spawnStatue(state, where) {
  const d = data(state);
  d.spawned += 1;
  return spawnMonster(state, { ...STATUE, id: `tuong-${d.spawned}`, name: `${STATUE.name} ${d.spawned}` }, where);
}

// Lượt của ngôi nhà: tượng không bị nhìn thì nhích về phía người gần nhất và dừng ngay khi lọt vào tầm nhìn.
// Xong thì mỗi người chịu 1 xúc xắc sát thương tổng hợp cho mỗi tượng mình đang nhìn thấy.
registerOp('tuong:act', (state) => {
  if (state.winner) return;
  const frozen = new Set(statues(state).filter((m) => watched(state, m)).map((m) => m.id));
  let moved = 0;
  for (const m of statues(state)) {
    if (frozen.has(m.id)) continue;
    const steps = Math.max(1, rollDice(state, m.traits.speed).total);
    for (let i = 0; i < steps; i++) {
      const dist = distances(state, m.pos);
      let target = null;
      for (const p of heroes(state)) {
        const dd = dist.get(posKey(p.pos));
        if (dd !== undefined && (!target || dd < target.d)) target = { p, d: dd };
      }
      if (!target || target.d === 0) break;
      const step = stepToward(state, m.pos, target.p.pos);
      if (!step) break;
      m.pos = step.pos;
      if (watched(state, m)) break;
    }
    moved += 1;
  }
  if (moved) addLog(state, `🗿 Có tiếng gỗ cọ xuống sàn. ${moved} bức tượng đã đổi chỗ khi không ai nhìn.`, 'haunt');
  const ops = [];
  for (const p of heroes(state)) {
    const n = visibleStatues(state, p).length;
    if (!n) continue;
    addLog(state, `👁 ${p.name} đang nhìn thấy ${n} bức tượng.`, 'haunt');
    ops.push({ op: 'damage', type: 'general', dice: n, playerId: p.id, source: 'haunt' });
  }
  if (ops.length) enqueueFront(state, ops);
});

registerOp('tuong:peek', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  const bonus = me.cards.includes(MIRROR_CARD) ? 2 : 0;
  const total = it.total + bonus;
  const a = state.monsters[it.statueId];
  const b = state.monsters[it.otherId];
  if (total >= PEEK_TARGET && a && b) {
    delete state.monsters[a.id];
    delete state.monsters[b.id];
    d.removed += 2;
    addLog(state, `🙈 Ú òa! ${a.name} và ${b.name} nhìn thẳng vào nhau rồi cứng đờ vĩnh viễn.${bonus ? ' (Gương +2)' : ''}`, 'haunt');
  } else {
    addLog(state, `${me.name} hô «ú òa» nhưng hai bức tượng không nhìn nhau. Gỗ nứt toác, dăm gỗ găm khắp người.`, 'haunt');
    enqueueFront(state, [{ op: 'damage', type: 'general', dice: PEEK_FAIL_DICE, playerId: me.id, source: 'haunt' }]);
  }
});

function specials(state, me) {
  if (state.turn.usedSpecial || !me.alive) return [];
  const here = statues(state).filter((m) => samePos(m.pos, me.pos));
  if (!here.length) return [];
  const seen = visibleStatues(state, me);
  const out = [];
  const statue = here[0];
  for (const other of seen) {
    if (other.id === statue.id) continue;
    out.push({
      type: 'special', actionId: 'peek', targetId: other.id,
      label: `Ú òa: cho ${statue.name} nhìn ${other.name} (đổ Tri thức, cần ${PEEK_TARGET}+)`,
    });
  }
  return out;
}

export default {
  id: 'haunt-tuong-nha-mo',
  name: 'Tượng nhà mồ',
  mode: 'coop',
  traitor: { rule: 'none' },
  traitorLabel: 'Không có (cả bàn hợp tác)',

  publicIntro:
    'Khắp ngôi nhà là những bức tượng gỗ đẽo thô, mặt tròn mắt rỗng, như tượng canh nhà mồ trên cao nguyên. ' +
    'Không ai nhớ chúng đã ở đó từ lúc nào. Chỉ biết mỗi lần chớp mắt, chúng lại gần hơn một chút.',

  monsterCards: [{ name: STATUE.name, controller: 'Ngôi nhà', traits: STATUE.traits, rules: [
    'Không tấn công và không bị tấn công.',
    'Lượt ngôi nhà: tượng đang bị nhìn từ đầu lượt thì đứng yên. Tượng khác đổ Tốc độ, tiến về người gần nhất và dừng ngay khi lọt vào tầm nhìn của ai đó.',
    'Cuối lượt ngôi nhà: mỗi người chịu 1 xúc xắc sát thương tổng hợp cho mỗi tượng trong tầm nhìn của mình.',
  ] }],

  traitorTome: null,

  survivalSecrets: {
    title: 'Sách chung – Tượng nhà mồ',
    intro:
      'Ai đó đã mang những bức tượng nhà mồ về bày khắp ngôi nhà này, xa cả nghìn cây số khỏi nấm mồ chúng được ' +
      'tạc ra để canh giữ. Chúng không biết đi. Chúng chỉ không thích bị nhìn. Và chúng rất muốn có thêm bạn.',
    setup: [
      'Không ai là Kẻ phản bội. Cả bàn cùng một phe, ngôi nhà do game điều khiển.',
      'Mỗi người có một Tượng gỗ xuất hiện ngay trong phòng mình đang đứng.',
      'Thêm 3/4/5/6 tượng (3, 4, 5, 6 người chơi) ở các phòng không ai nhìn thấy.',
    ],
    objective: 'Cả bàn thắng khi không còn bức tượng nào trong nhà.',
    lose: ['Mọi người đều chết.'],
    tokens: ['Tượng gỗ (quái vật nhỏ)'],
    actions: [{
      name: 'Ú òa',
      when: 'Mỗi lượt một lần, bạn có thể',
      text: 'Đứng cùng phòng với một Tượng gỗ mà có một tượng khác nằm trong tầm nhìn của bạn: đổ Tri thức. Nếu bạn cầm thẻ «Cô bé trong gương», cộng 2 vào kết quả.',
      outcomes: [
        [`${PEEK_TARGET}+`, 'Bỏ cả hai bức tượng khỏi nhà. Chúng nhìn thấy nhau và đứng im mãi mãi.'],
        [`0–${PEEK_TARGET - 1}`, `Chịu ${PEEK_FAIL_DICE} xúc xắc sát thương tổng hợp.`],
      ],
    }],
    rules: [
      { title: 'Tầm nhìn', text: 'Bạn nhìn thấy mọi thứ trong phòng mình, và trong các phòng nối thẳng hàng với phòng mình theo một hướng, cùng tầng, khi mọi phòng trên đường đó đều thông cửa với nhau.' },
      { title: 'Ánh mắt gỗ', text: 'Khi bạn bước vào một phòng mà từ đó nhìn thấy một bức tượng mà lúc đầu lượt bạn chưa thấy, chịu 2 xúc xắc sát thương tổng hợp. Mỗi lượt chỉ bị một lần.' },
      { title: 'Cuối mỗi vòng (lượt ngôi nhà)', text: 'Các tượng di chuyển như ghi trong khung quái vật, rồi mỗi người chịu 1 xúc xắc sát thương tổng hợp cho mỗi tượng trong tầm nhìn của mình.' },
    ],
    tips: [
      'Hai người đứng ở hai phòng thẳng hàng thì nhìn được cả dãy: dùng điều đó để giữ tượng đứng yên.',
      'Kéo một tượng vào tầm nhìn của tượng khác rồi «Ú òa» ngay trong lượt.',
    ],
    ifWin:
      'Bức tượng cuối cùng nhìn thẳng vào mắt bạn rồi đứng im, lần này là mãi mãi. Các bạn đi giật lùi ra tới cổng, ' +
      'không ai dám quay lưng, cũng không ai dám chớp mắt.',
    ifLose:
      'Chân tay các bạn cứng lại, thớ gỗ bò dần lên cổ. Sáng mai, ngôi nhà sẽ có thêm vài bức tượng mới, ' +
      'mặt tròn, mắt rỗng, nhìn ra cửa chờ khách.',
  },

  setup(state) {
    state.haunt.data = { spawned: 0, removed: 0, seen: [], gazed: false };
    for (const p of heroes(state)) spawnStatue(state, posKey(p.pos));
    const extra = Math.min(6, Math.max(3, state.turnOrder.length));
    const seenByAnyone = new Set(heroes(state).flatMap((p) => [...lineOfSight(state, p.pos)]));
    const hidden = rooms(state).filter((k) => !seenByAnyone.has(k));
    const others = rooms(state).filter((k) => seenByAnyone.has(k) && !heroes(state).some((p) => posKey(p.pos) === k));
    for (let i = 0; i < extra; i++) {
      const pool = hidden.length ? hidden : others;
      const key = pool.length ? pool.splice(randInt(state, pool.length), 1)[0] : 'basement-landing';
      spawnStatue(state, key);
    }
    data(state).total = statues(state).length;
    addLog(state, `🗿 ${statues(state).length} bức tượng gỗ đứng rải rác khắp nhà, mặt hướng về phía các bạn.`, 'haunt');
  },

  canBeAttacked(state, ref) {
    return isStatue(state, ref) ? false : undefined;
  },
  canAttackMonster(state, player, monster) {
    return monster.type === STATUE.type ? false : undefined;
  },
  monsterCanTarget(state, monster) {
    return monster.type === STATUE.type ? false : undefined;
  },

  onTurnStart(state, playerId) {
    const d = data(state);
    const p = state.players[playerId];
    d.seen = p?.alive ? visibleStatues(state, p).map((m) => m.id) : [];
    d.gazed = false;
  },

  // Ánh mắt gỗ: lần đầu trong lượt nhìn thấy một tượng mới.
  onPlayerEnter(state, player) {
    const d = data(state);
    if (state.turn.playerId !== player.id || d.gazed || !player.alive) return;
    const fresh = visibleStatues(state, player).filter((m) => !d.seen.includes(m.id));
    if (!fresh.length) return;
    d.gazed = true;
    addLog(state, `${player.name} bắt gặp ánh mắt rỗng của ${fresh[0].name}. Lạnh buốt tận xương.`, 'haunt');
    enqueueFront(state, [{ op: 'damage', type: 'general', dice: 2, playerId: player.id, source: 'haunt' }]);
  },

  onRoundEnd(state) {
    if (!state.winner) enqueueFront(state, [{ op: 'tuong:act' }]);
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    const me = state.players[playerId];
    const option = specials(state, me).find((a) => a.actionId === action.actionId && a.targetId === action.targetId);
    if (!option) throw new GameError('Không thể làm vậy lúc này.');
    state.turn.usedSpecial = true;
    const statue = statues(state).find((m) => samePos(m.pos, me.pos));
    enqueueFront(state, [rollOp(playerId, 'knowledge', 'Ú òa', { op: 'tuong:peek', statueId: statue.id, otherId: action.targetId })]);
  },

  publicData(state) {
    const d = data(state);
    const marks = {};
    for (const m of statues(state)) {
      const k = posKey(m.pos);
      if (watched(state, m)) (marks[k] ??= []).push({ kind: 'watched', label: `${m.name} đang bị nhìn` });
    }
    return {
      meters: [{ id: 'removed', label: 'Tượng đã hoá đá', value: d.removed, max: d.total, tone: 'good' }],
      notes: [`Còn ${statues(state).length} bức tượng trong nhà.`],
      marks,
    };
  },

  checkVictory(state) {
    if (!statues(state).length) return { side: 'heroes', reason: 'Bức tượng cuối cùng đã đứng im mãi mãi.' };
    if (!heroes(state).length) return { side: 'house', reason: 'Ngôi nhà có thêm những bức tượng mới.' };
    return null;
  },
};
