// Chiến đấu: hai bên đổ xúc xắc theo cùng một chỉ số, bên thấp hơn chịu sát thương bằng phần chênh.
// Might / Speed gây sát thương thể chất; Sanity / Knowledge gây sát thương tinh thần.
// Quái vật không có thanh chỉ số: khi lẽ ra chịu sát thương thì bị choáng (stunned).

import { CARDS_BY_ID } from '../data/index.js';
import { PHYSICAL, TRAIT_LABEL, defaultAttackTraits } from './constants.js';
import { rollDice } from './dice.js';
import { addLog, setLastRoll } from './log.js';
import { samePos } from './board.js';
import { traitValue } from './traits.js';
import { enqueueFront } from './effects.js';
import { getHaunt } from '../haunts/index.js';

// ref = { kind: 'player' | 'monster', id }
export function unitOf(state, ref) {
  return ref.kind === 'player' ? state.players[ref.id] : state.monsters[ref.id];
}

export function unitTraitValue(state, ref, trait) {
  const unit = unitOf(state, ref);
  if (ref.kind === 'player') return traitValue(unit, trait);
  return unit.traits[trait] ?? null;
}

export function attackTraitsFor(state, attackerRef, targetRef, weaponDef) {
  const custom = getHaunt(state)?.attackTraits?.(state, attackerRef, targetRef, weaponDef);
  return custom ?? defaultAttackTraits(weaponDef);
}

// Mọi đòn tấn công hợp lệ của nhà thám hiểm đang tới lượt.
export function explorerAttackOptions(state, playerId) {
  const me = state.players[playerId];
  if (state.phase !== 'haunt' || !me.alive || state.turn.hasAttacked) return [];
  const attacker = { kind: 'player', id: playerId };
  const targets = [];
  for (const other of Object.values(state.players)) {
    if (other.id !== playerId && other.alive && other.side !== me.side && samePos(other.pos, me.pos)) {
      targets.push({ kind: 'player', id: other.id });
    }
  }
  if (me.side === 'hero') {
    for (const m of Object.values(state.monsters)) {
      if (!m.stunned && samePos(m.pos, me.pos)) targets.push({ kind: 'monster', id: m.id });
    }
  }
  const weapons = [null, ...me.cards.filter((id) => CARDS_BY_ID[id].weapon)];
  const options = [];
  for (const target of targets) {
    for (const weaponCardId of weapons) {
      const weapon = weaponCardId ? CARDS_BY_ID[weaponCardId].weapon : null;
      for (const trait of attackTraitsFor(state, attacker, target, weapon)) {
        if (weapon && weapon.trait !== trait) continue;
        if (unitTraitValue(state, target, trait) === null) continue;
        options.push({ type: 'attack', targetType: target.kind, targetId: target.id, trait, weaponCardId });
      }
    }
  }
  return options;
}

export function monsterAttackOptions(state, monsterId) {
  const monster = state.monsters[monsterId];
  const slot = state.turn.monsters[monsterId];
  if (!monster || !slot || monster.stunned || slot.attacked) return [];
  return Object.values(state.players)
    .filter((p) => p.alive && p.side === 'hero' && samePos(p.pos, monster.pos))
    .map((p) => ({ type: 'monsterAttack', monsterId, targetId: p.id }));
}

function inflict(state, ref, amount, trait) {
  const unit = unitOf(state, ref);
  if (ref.kind === 'monster') {
    unit.stunned = true;
    unit.recovering = false;
    addLog(state, `${unit.name} bị đánh choáng.`, 'combat');
    return;
  }
  const type = PHYSICAL.includes(trait) ? 'physical' : 'mental';
  enqueueFront(state, [{ op: 'damage', type, amount, playerId: unit.id, source: 'combat' }]);
}

export function resolveCombat(state, attackerRef, defenderRef, trait, bonusDice = 0) {
  const a = unitOf(state, attackerRef);
  const d = unitOf(state, defenderRef);
  const ar = rollDice(state, unitTraitValue(state, attackerRef, trait) + bonusDice);
  const dr = rollDice(state, unitTraitValue(state, defenderRef, trait));
  setLastRoll(state, {
    kind: 'combat', trait, label: `${a.name} tấn công ${d.name}`,
    attacker: { ...attackerRef, dice: ar.dice, total: ar.total },
    defender: { ...defenderRef, dice: dr.dice, total: dr.total },
  });
  addLog(
    state,
    `⚔ ${a.name} tấn công ${d.name} bằng ${TRAIT_LABEL[trait]}: ` +
      `[${ar.dice.join(', ')}] = ${ar.total} đấu [${dr.dice.join(', ')}] = ${dr.total}.`,
    'combat',
  );
  if (ar.total === dr.total) {
    addLog(state, 'Hoà – không ai bị thương.', 'combat');
    return;
  }
  const loser = ar.total > dr.total ? defenderRef : attackerRef;
  inflict(state, loser, Math.abs(ar.total - dr.total), trait);
}
