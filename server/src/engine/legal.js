// Liệt kê mọi hành động hợp lệ của một người chơi tại thời điểm hiện tại.
// Client dùng để bật/tắt nút; test dùng để chạy bot mô phỏng cả ván.

import { CARDS_BY_ID, TILES_BY_ID } from '../data/index.js';
import { GameError } from './errors.js';
import { samePos, tileAt, resolveStep, hasTileForFloor } from './board.js';
import { enumerateAllocations } from './effects.js';
import { explorerAttackOptions, monsterAttackOptions } from './combat.js';
import { getHaunt } from '../haunts/index.js';

// Các bước đi có thể từ một vị trí: [{ dir, discover } | { linkTo }]
function stepsFrom(state, pos, { allowDiscover, filter }) {
  const out = [];
  const tryStep = (step) => {
    try {
      const res = resolveStep(state, pos, step);
      if (res.kind === 'discover') {
        if (allowDiscover && hasTileForFloor(state, pos.floor)) out.push({ ...step, discover: true });
      } else if (!filter || filter(res.pos)) {
        out.push(step.linkTo ? step : { ...step, discover: false });
      }
    } catch (err) {
      if (!(err instanceof GameError)) throw err;
    }
  };
  for (let dir = 0; dir < 4; dir++) tryStep({ dir });
  for (const linkTo of TILES_BY_ID[tileAt(state, pos).tileId].links ?? []) tryStep({ linkTo });
  return out;
}

function pendingActions(pending) {
  switch (pending.type) {
    case 'placeTile':
      return pending.validRotations.map((rotation) => ({ type: 'placeTile', rotation }));
    case 'roll':
      return [{ type: 'roll' }];
    case 'allocateDamage':
      return enumerateAllocations(pending.traits, pending.capacity, pending.amount)
        .map((allocation) => ({ type: 'allocateDamage', allocation }));
    case 'chooseTrait':
      return pending.options.map((trait) => ({ type: 'chooseTrait', trait }));
    default:
      return [];
  }
}

function monsterPhaseActions(state) {
  const haunt = getHaunt(state);
  const out = [];
  for (const monster of Object.values(state.monsters)) {
    const slot = state.turn.monsters[monster.id];
    if (!slot || monster.stunned) continue;
    if (slot.movesLeft >= 1) {
      const filter = (pos) => haunt.canMonsterEnter?.(state, monster, pos) !== false;
      for (const step of stepsFrom(state, monster.pos, { allowDiscover: false, filter })) {
        const { discover, ...rest } = step;
        out.push({ type: 'monsterMove', monsterId: monster.id, ...rest });
      }
    }
    out.push(...monsterAttackOptions(state, monster.id));
  }
  out.push({ type: 'endMonsterTurn' });
  return out;
}

function explorerPhaseActions(state, player) {
  const out = [];
  if (state.turn.movesLeft >= 1) {
    for (const step of stepsFrom(state, player.pos, { allowDiscover: true })) out.push({ type: 'move', ...step });
  }
  for (const cardId of player.cards) {
    if (CARDS_BY_ID[cardId].use && !state.turn.usedCards.includes(cardId)) out.push({ type: 'useItem', cardId });
    for (const other of Object.values(state.players)) {
      if (other.id !== player.id && other.alive && other.side === player.side && samePos(other.pos, player.pos)) {
        out.push({ type: 'giveItem', cardId, toPlayerId: other.id });
      }
    }
  }
  for (const cardId of tileAt(state, player.pos).items) out.push({ type: 'pickupItem', cardId });
  out.push(...explorerAttackOptions(state, player.id));
  if (state.phase === 'haunt') out.push(...(getHaunt(state).specialActions?.(state, player.id) ?? []));
  out.push({ type: 'endTurn' });
  return out;
}

export function legalActions(state, playerId) {
  const player = state.players[playerId];
  if (!player || state.winner) return [];
  if (state.pending) return state.pending.playerId === playerId ? pendingActions(state.pending) : [];
  if (state.turn.playerId !== playerId) return [];
  if (state.turn.phase === 'monsters') return monsterPhaseActions(state);
  return player.alive ? explorerPhaseActions(state, player) : [];
}
