// HAUNT «Giải nguyền cho bà môi giới» – hợp tác. Bà môi giới dẫn khách xem nhà hoá ra bị nguyền mắc kẹt trong
// ngôi nhà, và cách duy nhất để thoát là giết khách. Cả bàn phải tìm hiểu lời nguyền, thanh tẩy các phòng,
// chuẩn bị bùa hộ thân rồi làm lễ giải nguyền ngay bên cạnh bà ta.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { resolveCombat } from '../engine/combat.js';
import { rollDice } from '../engine/dice.js';
import { randInt } from '../engine/rng.js';
import { FLOOR_LABEL } from '../engine/constants.js';
import { TILES_BY_ID } from '../data/index.js';
import { traitValue } from '../engine/traits.js';
import {
  playersInPlay, spawnMonster, tileDefAt, roomLabel, posOf, distances, stepToward, rollOp, chooseOp, roomOption,
} from './helpers.js';

const STUDY_TILES = ['library', 'chapel', 'study'];
const WARD_TILES = ['nursery', 'workshop', 'garden'];
const RITUAL_TILE = 'ritual-chamber';
const FIRE_MAX = 6;
const KNOW_MAX = 2;
const WARD_MAX = 2;
const STUDY_TARGET = 5;
const CLEANSE_TARGET = 6;
const WARD_TARGET = 6;
const RITE_WIN = 11;
const RITE_SAFE = 7;
const DEMON = { id: 'quy-moi-gioi', type: 'quy-moi-gioi', name: 'Bà môi giới bị nguyền', traits: { might: 5, speed: 3, sanity: 5, knowledge: 4 }, ai: true };

const data = (state) => state.haunt.data;
const heroes = (state) => playersInPlay(state).filter((p) => p.alive);
const demon = (state) => state.monsters[DEMON.id];
const isDemon = (ref) => ref?.kind === 'monster' && ref.id === DEMON.id;
const hasKnow = (state, id) => data(state).know.includes(id);
const hasWard = (state, id) => data(state).wards.includes(id);
const tileNames = (ids) => ids.map((id) => ({ library: 'Thư viện', chapel: 'Nhà nguyện', study: 'Phòng làm việc', nursery: 'Phòng trẻ', workshop: 'Xưởng mộc', garden: 'Vườn hoang' }[id])).join(', ');

function firesOnFloor(state, floor) {
  return data(state).fires.filter((k) => k.startsWith(`${floor}:`)).length;
}

registerOp('giainguyen:study', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  if (it.total < STUDY_TARGET) {
    addLog(state, `${me.name} lật giở mãi mà chưa hiểu ra điều gì. Cần thêm thời gian.`, 'haunt');
    return;
  }
  if (d.know.length >= KNOW_MAX) {
    addLog(state, `${me.name} hiểu thêm về lời nguyền, nhưng đã đủ người nắm được bí mật.`, 'haunt');
    return;
  }
  let who = me;
  if (hasKnow(state, me.id)) {
    who = heroes(state).find((p) => p.id !== me.id && samePos(p.pos, me.pos) && !hasKnow(state, p.id));
    if (!who) {
      addLog(state, `${me.name} đã hiểu lời nguyền rồi, và không có ai cùng phòng để giảng lại.`, 'haunt');
      return;
    }
  }
  d.know.push(who.id);
  addLog(state, `📜 ${who.name} đã hiểu được lời nguyền (Hiểu biết).`, 'haunt');
});

registerOp('giainguyen:cleanse', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  const total = it.total + (hasKnow(state, me.id) ? 2 : 0);
  if (total >= CLEANSE_TARGET && d.fires.length < FIRE_MAX) {
    d.fires.push(it.key);
    addLog(state, `🔥 ${me.name} thanh tẩy ${roomLabel(state, posOf(state, it.key))} (${total}).`, 'haunt');
  } else {
    addLog(state, `${me.name} đọc câu chú chưa đủ nhanh. Căn phòng vẫn còn uế khí (${total}).`, 'haunt');
  }
});

registerOp('giainguyen:ward', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  const total = it.total + (hasKnow(state, me.id) ? 2 : 0);
  if (total >= WARD_TARGET && d.wards.length < WARD_MAX) {
    d.wards.push(me.id);
    addLog(state, `🛡 ${me.name} dựng xong bùa hộ thân (${total}).`, 'haunt');
  } else {
    addLog(state, `${me.name} chưa dựng xong bùa hộ thân (${total}). Thời gian không còn nhiều.`, 'haunt');
  }
});

registerOp('giainguyen:rite', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  const fires = firesOnFloor(state, me.pos.floor);
  const ritual = tileDefAt(state, me.pos).id === RITUAL_TILE ? 1 : 0;
  const know = hasKnow(state, me.id) ? 2 : 0;
  const total = it.total + fires + ritual + know;
  const parts = [`xúc xắc ${it.total}`, fires && `+${fires} phòng thanh tẩy`, ritual && '+1 Phòng tế lễ', know && '+2 Hiểu biết'].filter(Boolean).join(', ');
  if (total >= RITE_WIN) {
    d.freed = true;
    addLog(state, `✨ ${me.name} đọc trọn bài chú (${total}: ${parts}). Lời nguyền vỡ tan!`, 'haunt');
  } else if (total >= RITE_SAFE) {
    addLog(state, `${me.name} làm lễ (${total}: ${parts}) nhưng lời nguyền vẫn chưa chịu buông.`, 'haunt');
  } else {
    addLog(state, `${me.name} làm lễ hỏng (${total}: ${parts}). Bà môi giới rú lên, ai cũng choáng váng.`, 'haunt');
    enqueueFront(state, heroes(state).map((p) => ({ op: 'lose', trait: 'sanity', amount: 1, playerId: p.id })));
  }
});

// Lượt của bà môi giới (cuối vòng): đổ Tốc độ, đi về phía người gần nhất, tấn công bằng Tinh thần nếu cùng phòng.
// Xong thì rú lên: ai cùng tầng chịu 1 xúc xắc sát thương tinh thần.
registerOp('giainguyen:act', (state) => {
  const m = demon(state);
  if (!m || state.winner) return;
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
  }
  const ops = [{ op: 'giainguyen:scream' }];
  const here = heroes(state).filter((p) => samePos(p.pos, m.pos));
  enqueueFront(state, ops);
  if (here.length) resolveCombat(state, { kind: 'monster', id: m.id }, { kind: 'player', id: here[randInt(state, here.length)].id }, 'sanity');
});

registerOp('giainguyen:scream', (state) => {
  const m = demon(state);
  if (!m || state.winner) return;
  const near = heroes(state).filter((p) => p.pos.floor === m.pos.floor);
  if (!near.length) return;
  addLog(state, `😱 Bà môi giới rú lên. Cả ${FLOOR_LABEL[m.pos.floor]} rung chuyển.`, 'haunt');
  enqueueFront(state, near.map((p) => ({ op: 'damage', type: 'mental', dice: 1, playerId: p.id, source: 'haunt' })));
});

registerOp('giainguyen:push', (state, it) => {
  const m = demon(state);
  if (!m || it.choice === 'stay') return;
  m.pos = posOf(state, it.choice);
  addLog(state, `${state.players[it.playerId].name} đẩy lùi bà môi giới tới ${roomLabel(state, m.pos)}.`, 'haunt');
});

function specials(state, me) {
  if (state.turn.usedSpecial || !me.alive) return [];
  const d = data(state);
  const def = tileDefAt(state, me.pos);
  const key = posKey(me.pos);
  const out = [];
  const canTeach = heroes(state).some((p) => p.id !== me.id && samePos(p.pos, me.pos) && !hasKnow(state, p.id));
  if (STUDY_TILES.includes(def.id) && d.know.length < KNOW_MAX && (!hasKnow(state, me.id) || canTeach)) {
    out.push({ type: 'special', actionId: 'study', label: `Tìm hiểu lời nguyền (đổ Tri thức, cần ${STUDY_TARGET}+)` });
  }
  if (def.symbol === 'event' && !d.fires.includes(key) && d.fires.length < FIRE_MAX) {
    out.push({ type: 'special', actionId: 'cleanse', label: `Thanh tẩy căn phòng (đổ Tốc độ${hasKnow(state, me.id) ? ' +2' : ''}, cần ${CLEANSE_TARGET}+)` });
  }
  if (WARD_TILES.includes(def.id) && !hasWard(state, me.id) && d.wards.length < WARD_MAX) {
    out.push({ type: 'special', actionId: 'ward', label: `Chuẩn bị bùa hộ thân (đổ Sức mạnh${hasKnow(state, me.id) ? ' +2' : ''}, cần ${WARD_TARGET}+)` });
  }
  if (demon(state) && samePos(demon(state).pos, me.pos)) {
    out.push({ type: 'special', actionId: 'rite', label: `Làm lễ giải nguyền (đổ Tinh thần, cần ${RITE_WIN}+)` });
  }
  return out;
}

export default {
  id: 'haunt-giai-nguyen',
  name: 'Giải nguyền cho bà môi giới',
  mode: 'coop',
  traitor: { rule: 'none' },
  traitorLabel: 'Không có (cả bàn hợp tác)',

  publicIntro:
    'Bà môi giới chặn trước cửa, mặt đỏ bừng, giọng rất lịch sự: «Thật ngại quá. Tôi bị nhốt ở đây từ hồi mới vào nghề. ' +
    'Muốn ra được, tôi phải giết các anh chị. Mong mọi người thông cảm.»',

  monsterCards: [{ name: DEMON.name, controller: 'Ngôi nhà', traits: DEMON.traits, rules: [
    'Đổ Tốc độ để biết số bước, đi về phía người gần nhất; cùng phòng thì tấn công bằng Tinh thần.',
    'Không bị choáng. Ai đánh thắng bà ta thì được đẩy bà ta đi tối đa số phòng bằng số sát thương lẽ ra gây ra.',
    'Ai đang có Bùa hộ thân thì đổ thêm 2 xúc xắc khi đánh hoặc bị bà ta đánh.',
    'Cuối lượt của bà ta: mỗi người cùng tầng chịu 1 xúc xắc sát thương tinh thần.',
  ] }],

  traitorTome: null,

  survivalSecrets: {
    title: 'Sách chung – Giải nguyền cho bà môi giới',
    intro:
      'Các bạn tới xem căn nhà đang rao bán. Lúc sắp về, bà môi giới đứng chắn ngay cửa và xin lỗi rối rít: bốn mươi năm ' +
      'trước bà bước qua cánh cửa này và chưa bao giờ ra lại được. Lời nguyền chỉ buông tha nếu bà giết được khách. ' +
      'Bà không muốn thế, nhưng bà cũng sắp hết cách rồi.',
    setup: [
      'Không ai là Kẻ phản bội. Cả bàn cùng một phe.',
      'Bà môi giới bị nguyền xuất hiện ở Sảnh vào. Bà đi sau mỗi vòng (lượt ngôi nhà).',
      'Đặt sẵn 3/2/1/0 dấu Thanh tẩy (bàn 3/4/5/6 người) lên các phòng đang có người đứng, mỗi phòng tối đa một dấu.',
    ],
    objective: 'Cả bàn thắng khi làm xong lễ giải nguyền cho bà môi giới.',
    lose: ['Mọi người đều chết.'],
    tokens: [
      `Dấu Thanh tẩy (tối đa ${FIRE_MAX}): giúp lễ giải nguyền.`,
      `Hiểu biết về lời nguyền (tối đa ${KNOW_MAX} người): +2 cho nhiều lần đổ.`,
      `Bùa hộ thân (tối đa ${WARD_MAX} người): +2 xúc xắc khi đánh nhau với bà môi giới.`,
    ],
    actions: [
      {
        name: 'Tìm hiểu lời nguyền', when: 'Mỗi lượt một lần, bạn có thể',
        text: `Đứng ở phòng tra cứu được (${tileNames(STUDY_TILES)}): đổ Tri thức.`,
        outcomes: [
          [`${STUDY_TARGET}+`, 'Nhận Hiểu biết. Nếu đã có, trao Hiểu biết cho một người cùng phòng chưa có.'],
          [`0–${STUDY_TARGET - 1}`, 'Không có gì. Bạn cần thêm thời gian.'],
        ],
      },
      {
        name: 'Thanh tẩy căn phòng', when: 'Mỗi lượt một lần, bạn có thể',
        text: 'Đứng ở phòng có biểu tượng Sự kiện chưa có dấu Thanh tẩy: đổ Tốc độ. Có Hiểu biết thì cộng 2 vào kết quả.',
        outcomes: [[`${CLEANSE_TARGET}+`, 'Đặt dấu Thanh tẩy lên phòng này.'], [`0–${CLEANSE_TARGET - 1}`, 'Không có gì. Đọc chú nhanh hơn nữa.']],
      },
      {
        name: 'Chuẩn bị bùa hộ thân', when: 'Mỗi lượt một lần, bạn có thể',
        text: `Đứng ở phòng hộ vệ (${tileNames(WARD_TILES)}): đổ Sức mạnh. Có Hiểu biết thì cộng 2 vào kết quả.`,
        outcomes: [[`${WARD_TARGET}+`, 'Nhận Bùa hộ thân.'], [`0–${WARD_TARGET - 1}`, 'Không có gì. Thời gian sắp hết!']],
      },
      {
        name: 'Làm lễ giải nguyền', when: 'Mỗi lượt một lần, bạn có thể',
        text: 'Đứng cùng phòng với bà môi giới: đổ Tinh thần. Cộng 1 cho mỗi dấu Thanh tẩy trên cùng tầng với bạn, cộng 1 nếu bạn đang ở Phòng tế lễ, cộng 2 nếu bạn có Hiểu biết.',
        outcomes: [
          [`${RITE_WIN}+`, 'Cả bàn thắng! Lời nguyền được giải.'],
          [`${RITE_SAFE}–${RITE_WIN - 1}`, 'Không có gì.'],
          [`0–${RITE_SAFE - 1}`, 'Mỗi người mất 1 Tinh thần. Bà môi giới rú lên.'],
        ],
      },
    ],
    tips: [
      'Dồn dấu Thanh tẩy vào một tầng rồi kéo bà môi giới về tầng đó để làm lễ.',
      'Người có Bùa hộ thân nên đứng chắn, để người có Hiểu biết làm lễ.',
    ],
    ifWin:
      'Bà môi giới bật khóc, cười, rồi lại khóc. Bà nói sẽ đi xem phim, ăn kem, rồi bay sang tận đâu đó thật xa. ' +
      'Các bạn vỗ vai bà và đề nghị bắt đầu bằng một bát phở ở đầu ngõ đã.',
    ifLose:
      'Cánh cửa chính bật mở. Bà môi giới bước ra ngoài lần đầu sau bốn mươi năm, phủi bụi trên áo, ' +
      'và không ngoái lại nhìn những vị khách đã ở lại thay bà.',
  },

  setup(state) {
    const n = state.turnOrder.length;
    const fires = { 3: 3, 4: 2, 5: 1 }[n] ?? 0;
    const heroTiles = [...new Set(heroes(state).map((p) => posKey(p.pos)))];
    const chosen = [];
    while (chosen.length < fires && heroTiles.length) chosen.push(heroTiles.splice(randInt(state, heroTiles.length), 1)[0]);
    state.haunt.data = { fires: chosen, know: [], wards: [], freed: false };
    spawnMonster(state, DEMON, 'entrance-hall');
    addLog(state, `🏠 Bà môi giới đứng chắn ở Sảnh vào.${fires ? ` ${fires} phòng đã được thanh tẩy sẵn.` : ''}`, 'haunt');
  },

  // Bùa hộ thân: +2 xúc xắc khi đánh hoặc bị bà môi giới đánh.
  attackBonus(state, attacker, target) {
    return attacker.kind === 'player' && isDemon(target) && hasWard(state, attacker.id) ? 2 : 0;
  },
  defenseBonus(state, attacker, target) {
    return isDemon(attacker) && target.kind === 'player' && hasWard(state, target.id) ? 2 : 0;
  },

  // Không bị choáng: người thắng được đẩy bà ta đi tối đa số phòng bằng sát thương.
  onCombatLoss(state, loser, amount, trait, winner) {
    if (!isDemon(loser)) return undefined;
    const m = demon(state);
    const dist = distances(state, m.pos);
    const options = [...dist.entries()].filter(([, dd]) => dd > 0 && dd <= amount).map(([k]) => roomOption(state, k));
    if (winner?.kind === 'player' && options.length) {
      enqueueFront(state, [chooseOp(winner.id, `Đẩy bà môi giới đi đâu? (tối đa ${amount} phòng)`, [
        { id: 'stay', label: 'Để bà ta ở yên' }, ...options,
      ], { op: 'giainguyen:push' }, { always: true })]);
    }
    return true;
  },

  onRoundEnd(state) {
    if (!state.winner) enqueueFront(state, [{ op: 'giainguyen:act' }]);
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    const me = state.players[playerId];
    if (!specials(state, me).some((a) => a.actionId === action.actionId)) throw new GameError('Không thể làm vậy lúc này.');
    state.turn.usedSpecial = true;
    const key = posKey(me.pos);
    const roll = {
      study: ['knowledge', 'Tìm hiểu lời nguyền', { op: 'giainguyen:study' }],
      cleanse: ['speed', 'Thanh tẩy căn phòng', { op: 'giainguyen:cleanse', key }],
      ward: ['might', 'Chuẩn bị bùa hộ thân', { op: 'giainguyen:ward' }],
      rite: ['sanity', 'Làm lễ giải nguyền', { op: 'giainguyen:rite' }],
    }[action.actionId];
    enqueueFront(state, [rollOp(playerId, ...roll)]);
  },

  // Bot đo cân bằng: không làm lễ khi chưa chuẩn bị (người thật cũng không làm thế).
  botSkip(state, me, action) {
    if (action.type === 'attack') return action.targetId === DEMON.id && !hasWard(state, me.id) && traitValue(me, 'might') < 5;
    if (action.actionId !== 'rite') return false;
    const expect = traitValue(me, 'sanity') + firesOnFloor(state, me.pos.floor) + (hasKnow(state, me.id) ? 2 : 0)
      + (tileDefAt(state, me.pos).id === RITUAL_TILE ? 1 : 0);
    return expect < RITE_WIN - 2;
  },

  // Gợi ý cho bot đo cân bằng: chuẩn bị đủ rồi mới tới làm lễ.
  botTargets(state, me) {
    const d = data(state);
    const m = demon(state);
    if (!m || !me.alive) return null;
    const ready = hasKnow(state, me.id) || firesOnFloor(state, m.pos.floor) >= 3;
    if (ready) return [posKey(m.pos)];
    const keys = Object.keys(state.board.tiles);
    const def = (k) => TILES_BY_ID[state.board.tiles[k].tileId];
    if (d.know.length < KNOW_MAX && !hasKnow(state, me.id)) return keys.filter((k) => STUDY_TILES.includes(def(k).id));
    return keys.filter((k) => def(k).symbol === 'event' && !d.fires.includes(k) && k.startsWith(`${m.pos.floor}:`));
  },

  publicData(state) {
    const d = data(state);
    const marks = {};
    for (const k of d.fires) (marks[k] ??= []).push({ kind: 'cleansed', label: 'Đã thanh tẩy' });
    const name = (id) => state.players[id]?.name;
    return {
      meters: [{ id: 'fires', label: 'Phòng đã thanh tẩy', value: d.fires.length, max: FIRE_MAX, tone: 'good' }],
      notes: [
        d.know.length ? `Hiểu biết: ${d.know.map(name).join(', ')}.` : 'Chưa ai hiểu được lời nguyền.',
        d.wards.length ? `Bùa hộ thân: ${d.wards.map(name).join(', ')}.` : 'Chưa ai có bùa hộ thân.',
      ],
      marks,
      carried: Object.fromEntries(heroes(state).map((p) => [p.id, [
        hasKnow(state, p.id) && 'Hiểu biết', hasWard(state, p.id) && 'Bùa hộ thân',
      ].filter(Boolean)]).filter(([, v]) => v.length)),
    };
  },

  checkVictory(state) {
    if (data(state).freed) return { side: 'heroes', reason: 'Lời nguyền đã được giải. Bà môi giới được tự do.' };
    if (!heroes(state).length) return { side: 'house', reason: 'Không còn vị khách nào sống sót.' };
    return null;
  },
};
