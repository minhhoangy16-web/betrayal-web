// HAUNT «Sên vũ trụ» – một thiên thạch rơi xuyên mái nhà, nhả ra lũ sên ngoài hành tinh. Kẻ phản bội (người lật Haunt)
// đã bị sên bám gáy và bảo vệ hai tổ sên. Sên bám thắng ai thì người đó bị điều khiển, đổi sang phe Kẻ phản bội.
// Người sống sót phải tìm muối và phá cả hai tổ.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { resolveCombat } from '../engine/combat.js';
import { randInt } from '../engine/rng.js';
import { TILES_BY_ID } from '../data/index.js';
import {
  playersInPlay, tileDefAt, spawnMonster, rollOp, chooseOp, rooms, addToken, tokensOf, removeToken, dropTokens,
  tokenActions, handleTokenAction, tokenDisplay, mergeMarks, tilePos,
} from './helpers.js';

const SALT_TARGET = 4;
const NEST_TARGET = 8;
const NEST_SAFE = 5;
const SALT_MAX = 5;
const SALT_TILES = ['kitchen', 'dining-room', 'larder', 'wine-cellar', 'gym', 'study'];
const SLUG = { type: 'sen', name: 'Sên', traits: { might: 3, speed: 4, sanity: 3, knowledge: 5 } };

const data = (state) => state.haunt.data;
const heroes = (state) => playersInPlay(state).filter((p) => p.alive && p.side === 'hero');
const slugs = (state) => Object.values(state.monsters).filter((m) => m.type === SLUG.type);
const isSlug = (state, ref) => ref?.kind === 'monster' && state.monsters[ref.id]?.type === SLUG.type;
const nestAt = (state, pos) => data(state).nests.find((n) => !n.destroyed && n.key === posKey(pos));
const tileNames = (ids) => ids.map((id) => TILES_BY_ID[id].name).join(', ');

function spawnSlug(state, where) {
  const d = data(state);
  d.spawned += 1;
  return spawnMonster(state, { ...SLUG, id: `sen-${d.spawned}`, name: `${SLUG.name} ${d.spawned}` }, where);
}

registerOp('sen:salt', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  if (it.total >= SALT_TARGET && d.salt < SALT_MAX) {
    d.salt += 1;
    addToken(state, { id: `muoi-${d.salt}`, kind: 'salt', label: 'Muối', holder: me.id });
    addLog(state, `🧂 ${me.name} tìm được một gói muối.`, 'haunt');
  } else if (it.total <= 1) {
    spawnSlug(state, posKey(me.pos));
    addLog(state, `${me.name} lật một cái hũ, một con sên trườn ra. Chúng ở khắp nơi!`, 'haunt');
  } else {
    addLog(state, `${me.name} không tìm thấy muối.`, 'haunt');
  }
});

registerOp('sen:nest-salt', (state, it) => {
  const me = state.players[it.playerId];
  const n = Number(it.choice);
  const salts = tokensOf(state, me.id).filter((t) => t.kind === 'salt').slice(0, n);
  for (const t of salts) removeToken(state, t.id);
  enqueueFront(state, [rollOp(me.id, 'speed', 'Phá tổ sên', { op: 'sen:nest', bonus: salts.length * 2 })]);
});

registerOp('sen:nest', (state, it) => {
  const me = state.players[it.playerId];
  const nest = nestAt(state, me.pos);
  const total = it.total + it.bonus;
  if (nest && total >= NEST_TARGET) {
    nest.destroyed = true;
    addLog(state, `💥 ${me.name} phá tan một tổ sên (${total})!`, 'haunt');
  } else if (total < NEST_SAFE) {
    spawnSlug(state, posKey(me.pos));
    addLog(state, `${me.name} chọc giận cả tổ (${total}). Một con sên bò ra.`, 'haunt');
  } else {
    addLog(state, `${me.name} chưa phá được tổ (${total}).`, 'haunt');
  }
});

function specials(state, me) {
  if (!me.alive) return [];
  const out = [];
  const d = data(state);
  if (!state.turn.usedSpecial) {
    if (me.side === 'hero') {
      if (SALT_TILES.includes(tileDefAt(state, me.pos).id) && d.salt < SALT_MAX) {
        out.push({ type: 'special', actionId: 'salt', trait: 'knowledge', label: `Tìm muối bằng Tri thức (cần ${SALT_TARGET}+)` });
        out.push({ type: 'special', actionId: 'salt', trait: 'speed', label: `Tìm muối bằng Tốc độ (cần ${SALT_TARGET}+)` });
      }
      if (nestAt(state, me.pos)) out.push({ type: 'special', actionId: 'nest', label: `Phá tổ sên (đổ Tốc độ, +2 mỗi gói muối bỏ ra, cần ${NEST_TARGET}+)` });
    } else if (me.id === state.haunt.traitorId && nestAt(state, me.pos)) {
      out.push({ type: 'special', actionId: 'summon', label: 'Gọi đàn: thêm 2 con sên ở tổ này' });
    }
  }
  if (me.side === 'hero') out.push(...tokenActions(state, me.id));
  return out;
}

export default {
  id: 'haunt-sen-vu-tru',
  name: 'Sên vũ trụ',
  traitor: { rule: 'revealer' },

  publicIntro:
    'Hòn thiên thạch đâm xuyên mái nhà, nằm im dưới tầng hầm, rỗ chằng chịt và nhớp nháp. Rồi nó run lên. ' +
    'Những con sên trơn bóng bò ra, nhanh hơn sên rất nhiều. Sên thì chết vì muối… đúng không?',

  monsterCards: [{ name: SLUG.name, controller: 'Kẻ phản bội', traits: SLUG.traits, rules: [
    'Bị đánh thắng thì chết, không bị choáng.',
    '«Bám gáy» (thay cho đòn thường): đòn Tinh thần vào một người cùng phòng, +1 vào kết quả cho mỗi con sên khác cùng phòng.',
    'Thắng thì người đó bị điều khiển: đổi sang phe Kẻ phản bội. Đánh xong (thắng hay thua), mọi con sên trong phòng đều chết.',
  ] }],

  traitorTome: {
    title: 'Sách Kẻ phản bội – Sên vũ trụ',
    intro:
      'Trước giờ bạn chưa hiểu vì sao cô bạn mê săn thiên thạch tới vậy. Giờ thì hiểu rồi. Một con sên vừa trườn lên cổ bạn và bám vào gáy. ' +
      'Bạn không lo lắm. Bạn còn thấy chúng khá dễ thương.',
    setup: [
      'Nhân vật của bạn vẫn ở trong game. Bạn là Kẻ phản bội.',
      'Có hai tổ sên: một ở tầng hầm, một ở tầng trên.',
      'Có 2/3/4/5 con sên (bàn 3/4/5/6 người) xuất hiện ở phòng bạn đang đứng. Bạn điều khiển chúng sau phần đi của mình.',
    ],
    objective: 'Bạn thắng khi mọi người sống sót đều đã chết hoặc bị điều khiển.',
    lose: ['Người sống sót phá được cả hai tổ sên.'],
    tokens: ['Sên (quái vật nhỏ)', '2 tổ sên'],
    actions: [{ name: 'Gọi đàn', when: 'Mỗi lượt một lần, bạn có thể', text: 'Đứng ở phòng có tổ sên: thêm 2 con sên vào phòng đó.' }],
    rules: [{ title: 'Người bị điều khiển', text: 'Họ chuyển sang phe bạn, thắng cùng bạn và đọc được sách này.' }],
    tips: ['Dồn nhiều sên vào một phòng rồi mới bám: mỗi con khác cộng 1.'],
    ifWin: 'Bạn nhìn ra cửa sổ, nghĩ cách giới thiệu với thế giới về một dạng sống mới. Phải đặt cho chúng một cái tên thật hay.',
  },

  survivalSecrets: {
    title: 'Sách Người sống sót – Sên vũ trụ',
    intro:
      'Cô bạn của các bạn làm nghề săn thiên thạch. Đã từng, vì giờ cô nằm kia, nửa người bị ăn mòn. Hòn đá cuối cùng cô săn được ' +
      'rơi thẳng xuống tầng hầm, và lũ sên bò ra từ đó. Muối giết được sên, phải không?',
    setup: ['Kẻ phản bội là người lật Haunt.', 'Có hai tổ sên: một ở tầng hầm, một ở tầng trên (đánh dấu trên bàn cờ).'],
    objective: 'Các bạn thắng khi phá được cả hai tổ sên.',
    lose: ['Mọi người sống sót đều đã chết hoặc bị sên điều khiển.'],
    tokens: [`Muối (tối đa ${SALT_MAX} gói)`],
    actions: [
      {
        name: 'Tìm muối', when: 'Mỗi lượt một lần, bạn có thể',
        text: `Đứng ở phòng có muối (${tileNames(SALT_TILES)}): đổ Tri thức hoặc Tốc độ.`,
        outcomes: [[`${SALT_TARGET}+`, 'Nhận một gói Muối.'], [`2–${SALT_TARGET - 1}`, 'Không có gì.'], ['0–1', 'Một con sên xuất hiện trong phòng.']],
      },
      {
        name: 'Phá tổ sên', when: 'Mỗi lượt một lần, bạn có thể',
        text: 'Đứng ở phòng có tổ sên: bỏ ra bao nhiêu gói Muối tuỳ ý, rồi đổ Tốc độ, cộng 2 cho mỗi gói muối đã bỏ.',
        outcomes: [[`${NEST_TARGET}+`, 'Phá được tổ. Phá cả hai tổ là thắng.'], [`${NEST_SAFE}–${NEST_TARGET - 1}`, 'Không có gì.'], [`0–${NEST_SAFE - 1}`, 'Một con sên xuất hiện trong phòng.']],
      },
    ],
    rules: [{ title: 'Muối', text: 'Muối trao cho nhau được khi cùng phòng. Người cầm muối chết thì muối rơi tại chỗ.' }],
    tips: ['Gom 2–3 gói muối vào một người rồi mới tới tổ.'],
    ifWin: 'Lần sau ở bữa tiệc có ai bàn chuyện người ngoài hành tinh có thật hay không, bạn sẽ ngậm miệng. Bạn biết trên kia có những thứ gì.',
  },

  setup(state) {
    const t = state.players[state.haunt.traitorId];
    const n = state.turnOrder.length;
    const pickFloor = (floor, fallback) => {
      const list = rooms(state, (pos) => pos.floor === floor);
      return list.length ? list[randInt(state, list.length)] : posKey(tilePos(state, fallback));
    };
    state.haunt.data = {
      nests: [{ key: pickFloor('basement', 'basement-landing'), destroyed: false }, { key: pickFloor('upper', 'upper-landing'), destroyed: false }],
      salt: 0, spawned: 0, tokens: {},
    };
    for (let i = 0; i < n - 1; i++) spawnSlug(state, posKey(t.pos));
    addLog(state, `🐌 ${n - 1} con sên trườn ra quanh chân ${t.name}. Hai tổ sên phập phồng trong nhà.`, 'haunt');
  },

  monsterCanTarget(state, monster) {
    return monster.type === SLUG.type ? false : undefined;
  },

  attackTraits(state, attacker, target) {
    return isSlug(state, target) ? ['might'] : undefined;
  },

  attackResultBonus(state, attacker) {
    if (!isSlug(state, attacker)) return 0;
    const me = state.monsters[attacker.id];
    return slugs(state).filter((m) => m.id !== me.id && samePos(m.pos, me.pos)).length;
  },

  monsterSpecialActions(state, monster) {
    const slot = state.turn.monsters[monster.id];
    if (monster.type !== SLUG.type || !slot || slot.attacked) return [];
    return heroes(state).filter((p) => samePos(p.pos, monster.pos))
      .map((p) => ({ actionId: 'latch', targetId: p.id, label: `Bám gáy ${p.name}` }));
  },

  performMonsterSpecial(state, playerId, monster, slot, action) {
    slot.attacked = true;
    const pos = { ...monster.pos };
    resolveCombat(state, { kind: 'monster', id: monster.id }, { kind: 'player', id: action.targetId }, 'sanity');
    const here = slugs(state).filter((m) => samePos(m.pos, pos));
    for (const m of here) delete state.monsters[m.id];
    addLog(state, `${here.length} con sên trong phòng teo tóp lại và chết.`, 'haunt');
  },

  onCombatLoss(state, loser, amount, trait, winner) {
    if (isSlug(state, loser)) {
      delete state.monsters[loser.id];
      return true;
    }
    if (isSlug(state, winner) && loser.kind === 'player') {
      const p = state.players[loser.id];
      dropTokens(state, p);
      p.side = 'traitor';
      addLog(state, `🧠 Một con sên chui vào gáy ${p.name}. Từ giờ ${p.name} thuộc về đàn sên.`, 'haunt');
      return true;
    }
    return undefined;
  },

  onPlayerDeath(state, player) {
    dropTokens(state, player);
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    if (handleTokenAction(state, playerId, action)) return;
    const me = state.players[playerId];
    const option = specials(state, me).find((a) => a.actionId === action.actionId && (a.trait ?? null) === (action.trait ?? null));
    if (!option) throw new GameError('Không thể làm vậy lúc này.');
    state.turn.usedSpecial = true;
    if (action.actionId === 'salt') {
      enqueueFront(state, [rollOp(playerId, action.trait, 'Tìm muối', { op: 'sen:salt' })]);
    } else if (action.actionId === 'nest') {
      const have = tokensOf(state, me.id).filter((t) => t.kind === 'salt').length;
      const options = Array.from({ length: have + 1 }, (_, i) => ({ id: String(i), label: i ? `Bỏ ${i} gói muối (+${i * 2})` : 'Không dùng muối' }));
      enqueueFront(state, [chooseOp(playerId, 'Dùng bao nhiêu muối?', options, { op: 'sen:nest-salt' })]);
    } else {
      const key = posKey(me.pos);
      spawnSlug(state, key);
      spawnSlug(state, key);
      addLog(state, `${me.name} gõ nhẹ vào tổ. Thêm hai con sên bò ra.`, 'haunt');
    }
  },

  botTargets(state, me) {
    if (me.side !== 'hero') return null;
    const salt = tokensOf(state, me.id).filter((t) => t.kind === 'salt').length;
    const d = data(state);
    if (salt >= 2 || d.salt >= SALT_MAX) return d.nests.filter((n) => !n.destroyed).map((n) => n.key);
    return rooms(state, (pos, def) => SALT_TILES.includes(def.id));
  },

  botChoose(state, actor, pending) {
    return pending.then?.op === 'sen:nest-salt' ? pending.options.at(-1).id : null;
  },

  publicData(state) {
    const d = data(state);
    const tokens = tokenDisplay(state);
    const marks = {};
    for (const n of d.nests) if (!n.destroyed) (marks[n.key] ??= []).push({ kind: 'nest', label: 'Tổ sên' });
    const controlled = Object.values(state.players).filter((p) => p.side === 'traitor' && p.id !== state.haunt.traitorId);
    return {
      meters: [{ id: 'nests', label: 'Tổ sên đã phá', value: d.nests.filter((n) => n.destroyed).length, max: 2, tone: 'good' }],
      notes: [
        `Muối đã tìm: ${d.salt}/${SALT_MAX}. Sên trong nhà: ${slugs(state).length}.`,
        controlled.length ? `Bị điều khiển: ${controlled.map((p) => p.name).join(', ')}.` : 'Chưa ai bị sên điều khiển.',
      ],
      marks: mergeMarks(marks, tokens.marks),
      carried: tokens.carried,
    };
  },

  checkVictory(state) {
    if (data(state).nests.every((n) => n.destroyed)) return { side: 'heroes', reason: 'Cả hai tổ sên đã bị phá.' };
    if (!heroes(state).length) return { side: 'traitor', reason: 'Không còn ai thoát khỏi đàn sên.' };
    return null;
  },
};
