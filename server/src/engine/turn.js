// Vòng lượt: lượt nhà thám hiểm -> (nếu là Traitor có quái vật) lượt quái vật -> người kế tiếp.
// Hết một vòng (người cuối cùng trong thứ tự ngồi đi xong) thì kịch bản có thể chạy "lượt của
// ngôi nhà" qua hook onRoundEnd, trước khi người đầu tiên của vòng mới bắt đầu.

import { TILES_BY_ID } from '../data/index.js';
import { addLog, setLastRoll } from './log.js';
import { rollDice } from './dice.js';
import { tileAt } from './board.js';
import { traitValue } from './traits.js';
import { registerOp, enqueueFront, toOps } from './effects.js';
import { hook, inPlay } from './hooks.js';

// Quái vật do Kẻ phản bội điều khiển (quái vật có ai: true do game tự điều khiển).
export const traitorMonsters = (state) => Object.values(state.monsters).filter((m) => !m.ai);

export function controlsMonsters(state, playerId) {
  return Boolean(state.haunt) && state.haunt.traitorId === playerId && traitorMonsters(state).length > 0;
}

const canTakeTurn = (state, id) => inPlay(state.players[id]) || controlsMonsters(state, id);

export function startTurn(state, playerId) {
  const player = state.players[playerId];
  const active = inPlay(player);
  state.turn = {
    number: (state.turn?.number ?? 0) + 1,
    playerId,
    phase: 'explorer',
    movesLeft: active ? traitValue(player, 'speed') : 0,
    hasAttacked: false,
    usedSpecial: false,
    usedCards: [],
    monsters: {},
  };
  hook(state, 'onTurnStart', playerId);
  if (active && !hook(state, 'skipExplorer', playerId)) {
    addLog(state, `— Lượt của ${player.name} (${state.turn.movesLeft} bước).`, 'system');
  } else if (controlsMonsters(state, playerId)) {
    // Traitor đã chết (hoặc không tự đi được) vẫn điều khiển quái vật.
    beginMonsterPhase(state);
  } else {
    enqueueFront(state, [{ op: 'afterExplorer' }]);
  }
}

// Kết thúc phần lượt của nhà thám hiểm: áp dụng hiệu ứng "kết thúc lượt tại đây" của phòng,
// rồi chuyển sang lượt quái vật hoặc người kế tiếp.
export function finishExplorerPhase(state) {
  const player = state.players[state.turn.playerId];
  const ops = [];
  if (inPlay(player)) {
    const def = TILES_BY_ID[tileAt(state, player.pos).tileId];
    if (def.effect?.trigger === 'endTurn') {
      addLog(state, `${player.name} kết thúc lượt tại ${def.name}.`, 'info');
      ops.push(...toOps(def.effect.effects, player.id, def.id));
    }
    ops.push(...(hook(state, 'onExplorerTurnEnd', player) ?? []));
  }
  ops.push({ op: 'afterExplorer' });
  enqueueFront(state, ops);
}

registerOp('finish', (state) => finishExplorerPhase(state));

registerOp('afterExplorer', (state) => {
  // Lượt mà Haunt vừa nổ ra: không có lượt quái vật, chuyển thẳng cho người bên trái Traitor.
  if (state.turn.phase !== 'monsters' && !state.haunt?.pendingFirstTurn && controlsMonsters(state, state.turn.playerId)) {
    beginMonsterPhase(state);
  } else {
    advanceTurn(state);
  }
});

registerOp('roundEnd', (state) => {
  hook(state, 'onRoundEnd');
});

// Bắt đầu lượt của một người sau lượt của ngôi nhà. Nếu người đó vừa chết thì tìm người kế tiếp.
registerOp('beginTurn', (state, it) => {
  if (canTakeTurn(state, it.playerId)) startTurn(state, it.playerId);
  else advanceTurn(state, it.playerId);
});

export function beginMonsterPhase(state) {
  state.turn.phase = 'monsters';
  state.turn.movesLeft = 0;
  state.turn.monsters = {};
  addLog(state, '— Lượt quái vật.', 'system');
  for (const monster of traitorMonsters(state)) {
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
  for (const monster of traitorMonsters(state)) {
    if (monster.recovering) {
      monster.stunned = false;
      monster.recovering = false;
      addLog(state, `${monster.name} tỉnh lại.`, 'haunt');
    }
  }
  advanceTurn(state);
}

// fromId: tìm người kế tiếp tính từ người này (mặc định: người đang tới lượt).
export function advanceTurn(state, fromId = state.turn.playerId) {
  const order = state.turnOrder;
  let from = order.indexOf(fromId);
  if (state.haunt?.pendingFirstTurn) {
    from = order.indexOf(state.haunt.traitorId ?? state.haunt.revealerId);
    state.haunt.pendingFirstTurn = false;
  }
  for (let i = 1; i <= order.length; i++) {
    const raw = from + i;
    const id = order[raw % order.length];
    if (!canTakeTurn(state, id)) continue;
    if (raw >= order.length) {
      state.round += 1;
      if (state.phase === 'haunt') {
        // Lượt của ngôi nhà chạy trước người đầu tiên của vòng mới.
        enqueueFront(state, [{ op: 'roundEnd' }, { op: 'beginTurn', playerId: id }]);
        return;
      }
    }
    startTurn(state, id);
    return;
  }
}
