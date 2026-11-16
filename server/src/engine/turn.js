// Vòng lượt: lượt nhà thám hiểm -> (nếu là Traitor có quái vật) lượt quái vật -> người kế tiếp.

import { TILES_BY_ID } from '../data/index.js';
import { addLog, setLastRoll } from './log.js';
import { rollDice } from './dice.js';
import { tileAt } from './board.js';
import { traitValue } from './traits.js';
import { registerOp, enqueueFront, toOps } from './effects.js';

export function controlsMonsters(state, playerId) {
  return Boolean(state.haunt) && state.haunt.traitorId === playerId && Object.keys(state.monsters).length > 0;
}

export function startTurn(state, playerId) {
  const player = state.players[playerId];
  state.turn = {
    number: (state.turn?.number ?? 0) + 1,
    playerId,
    phase: 'explorer',
    movesLeft: player.alive ? traitValue(player, 'speed') : 0,
    hasAttacked: false,
    usedSpecial: false,
    usedCards: [],
    monsters: {},
  };
  if (player.alive) {
    addLog(state, `— Lượt của ${player.name} (${state.turn.movesLeft} bước).`, 'system');
  } else {
    // Traitor đã chết vẫn điều khiển quái vật.
    beginMonsterPhase(state);
  }
}

// Kết thúc phần lượt của nhà thám hiểm: áp dụng hiệu ứng "kết thúc lượt tại đây" của phòng,
// rồi chuyển sang lượt quái vật hoặc người kế tiếp.
export function finishExplorerPhase(state) {
  const player = state.players[state.turn.playerId];
  const ops = [];
  if (player.alive) {
    const def = TILES_BY_ID[tileAt(state, player.pos).tileId];
    if (def.effect?.trigger === 'endTurn') {
      addLog(state, `${player.name} kết thúc lượt tại ${def.name}.`, 'info');
      ops.push(...toOps(def.effect.effects, player.id, def.id));
    }
  }
  ops.push({ op: 'afterExplorer' });
  enqueueFront(state, ops);
}

registerOp('finish', (state) => finishExplorerPhase(state));

registerOp('afterExplorer', (state) => {
  // Lượt mà Haunt vừa nổ ra: không có lượt quái vật, chuyển thẳng cho người bên trái Traitor.
  if (!state.haunt?.pendingFirstTurn && controlsMonsters(state, state.turn.playerId)) {
    beginMonsterPhase(state);
  } else {
    advanceTurn(state);
  }
});

export function beginMonsterPhase(state) {
  state.turn.phase = 'monsters';
  state.turn.movesLeft = 0;
  state.turn.monsters = {};
  addLog(state, '— Lượt quái vật.', 'system');
  for (const monster of Object.values(state.monsters)) {
    if (monster.stunned) {
      // Quái vật bị choáng bỏ lượt này và tỉnh lại khi lượt quái vật kết thúc.
      monster.recovering = true;
      state.turn.monsters[monster.id] = { movesLeft: 0, attacked: true };
      continue;
    }
    const r = rollDice(state, monster.traits.speed);
    const moves = Math.max(1, r.total);
    setLastRoll(state, { kind: 'monsterMove', monsterId: monster.id, dice: r.dice, total: r.total, label: monster.name });
    state.turn.monsters[monster.id] = { movesLeft: moves, attacked: false };
    addLog(state, `${monster.name} đổ Tốc độ [${r.dice.join(', ')}] → ${moves} bước.`, 'roll');
  }
}

export function endMonsterPhase(state) {
  for (const monster of Object.values(state.monsters)) {
    if (monster.recovering) {
      monster.stunned = false;
      monster.recovering = false;
      addLog(state, `${monster.name} tỉnh lại.`, 'haunt');
    }
  }
  advanceTurn(state);
}

export function advanceTurn(state) {
  const order = state.turnOrder;
  let from = order.indexOf(state.turn.playerId);
  if (state.haunt?.pendingFirstTurn) {
    from = order.indexOf(state.haunt.traitorId);
    state.haunt.pendingFirstTurn = false;
  }
  for (let i = 1; i <= order.length; i++) {
    const raw = from + i;
    const id = order[raw % order.length];
    if (state.players[id].alive || controlsMonsters(state, id)) {
      if (raw >= order.length) state.round += 1;
      startTurn(state, id);
      return;
    }
  }
}
