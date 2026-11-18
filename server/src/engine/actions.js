// Xử lý từng loại hành động của người chơi. Mỗi handler kiểm tra hợp lệ rồi mới thay đổi state;
// hàng đợi hiệu ứng được chạy sau đó trong Game.applyAction().

import { CARDS_BY_ID, TILES_BY_ID } from '../data/index.js';
import { FLOOR_LABEL } from './constants.js';
import { GameError } from './errors.js';
import { addLog } from './log.js';
import {
  DIRS, samePos, tileAt, resolveStep, validRotations, drawTileForFloor, placeTile as putTile,
} from './board.js';
import {
  enqueue, enqueueFront, toOps, gainCard, loseCard,
  resolveRoll, resolveAllocateDamage, resolveChooseTrait, resolveChoose,
} from './effects.js';
import { finishExplorerPhase, endMonsterPhase } from './turn.js';
import { explorerAttackOptions, monsterAttackOptions, resolveCombat, areEnemies } from './combat.js';
import { getHaunt } from '../haunts/index.js';
import { hook, inPlay } from './hooks.js';

// ---------------------------------------------------------------- kiểm tra chung

function requireNoPending(state) {
  if (state.pending) {
    const who = state.players[state.pending.playerId]?.name ?? 'người chơi khác';
    throw new GameError(`Đang chờ ${who} quyết định.`);
  }
}

function requireExplorerTurn(state, playerId) {
  requireNoPending(state);
  if (state.turn.playerId !== playerId) throw new GameError('Chưa tới lượt của bạn.', 'NOT_YOUR_TURN');
  if (state.turn.phase !== 'explorer') throw new GameError('Đang là lượt quái vật.');
  const player = state.players[playerId];
  if (!player.alive) throw new GameError('Nhân vật của bạn đã chết.');
  if (player.escaped) throw new GameError('Bạn đã thoát ra khỏi ngôi nhà.');
  return player;
}

function requireMonsterTurn(state, playerId) {
  requireNoPending(state);
  if (state.turn.playerId !== playerId || state.turn.phase !== 'monsters') {
    throw new GameError('Không phải lượt quái vật của bạn.', 'NOT_YOUR_TURN');
  }
}

// Số đối thủ đứng cùng phòng – mỗi đối thủ khiến việc rời phòng tốn thêm 1 bước.
export function opponentsHere(state, player) {
  if (state.phase !== 'haunt') return 0;
  let n = 0;
  for (const other of Object.values(state.players)) {
    if (other.id !== player.id && inPlay(other) && areEnemies(state, player, other) && samePos(other.pos, player.pos)) n += 1;
  }
  for (const m of Object.values(state.monsters)) {
    if (!m.stunned && samePos(m.pos, player.pos) && (hook(state, 'monsterCanTarget', m, player) ?? player.side === 'hero')) n += 1;
  }
  return n;
}

// Trả bước khi rời phòng hiện tại để vào `toPos` (kịch bản có thể bắt trả thêm, vd. phòng ngập).
function payMove(state, player, toPos) {
  const extra = hook(state, 'moveCost', player, toPos) ?? 0;
  state.turn.movesLeft = Math.max(0, state.turn.movesLeft - 1 - extra - opponentsHere(state, player));
}

const roomName = (state, pos) => TILES_BY_ID[tileAt(state, pos).tileId].name;

// ---------------------------------------------------------------- di chuyển & khám phá

function move(state, playerId, action) {
  const player = requireExplorerTurn(state, playerId);
  if (state.turn.movesLeft < 1) throw new GameError('Bạn đã hết bước di chuyển.');
  const step = resolveStep(state, player.pos, action);

  if (step.kind === 'move') {
    payMove(state, player, step.pos);
    player.pos = step.pos;
    addLog(state, `${player.name} đi tới ${roomName(state, step.pos)}.`, 'move');
    hook(state, 'onPlayerEnter', player, step.pos);
    return;
  }

  // Bước qua cửa chưa mở: rút gạch theo tầng, chờ người chơi xoay và đặt.
  const tileId = drawTileForFloor(state, player.pos.floor);
  if (!tileId) throw new GameError(`Không còn gạch nào đặt được ở ${FLOOR_LABEL[player.pos.floor]}.`);
  const rotations = validRotations(TILES_BY_ID[tileId], step.dir);
  state.pending = {
    type: 'placeTile', playerId, tileId,
    floor: step.pos.floor, x: step.pos.x, y: step.pos.y,
    fromDir: step.dir, validRotations: rotations, rotation: rotations[0],
  };
  addLog(state, `${player.name} mở cửa hướng ${DIRS[step.dir].name} và rút được «${TILES_BY_ID[tileId].name}».`, 'move');
}

function requirePlacing(state, playerId) {
  const p = state.pending;
  if (!p || p.type !== 'placeTile') throw new GameError('Không có gạch nào đang chờ đặt.');
  if (p.playerId !== playerId) throw new GameError('Không phải bạn là người đặt gạch.');
  return p;
}

function checkRotation(pending, rotation) {
  if (!pending.validRotations.includes(rotation)) {
    throw new GameError('Góc xoay không hợp lệ: gạch phải có cửa nối với phòng bạn vừa rời.');
  }
}

// Xoay thử (để mọi người cùng thấy bản xem trước).
function rotateTile(state, playerId, action) {
  const p = requirePlacing(state, playerId);
  checkRotation(p, action.rotation);
  p.rotation = action.rotation;
}

function placeTile(state, playerId, action) {
  const p = requirePlacing(state, playerId);
  const rotation = action.rotation ?? p.rotation;
  checkRotation(p, rotation);
  const player = state.players[playerId];
  const def = TILES_BY_ID[p.tileId];
  const pos = { floor: p.floor, x: p.x, y: p.y };

  state.pending = null;
  putTile(state, p.tileId, pos, rotation);
  payMove(state, player, pos);
  player.pos = pos;
  addLog(state, `${player.name} khám phá ra ${def.name}.`, 'move');
  hook(state, 'onPlayerEnter', player, pos);

  const ops = [];
  if (def.effect?.trigger === 'discover') ops.push(...toOps(def.effect.effects, playerId, def.id));
  if (def.symbol) ops.push({ op: 'draw', deck: def.symbol, playerId });
  // Luật 3rd Edition: khám phá phòng mới thì lượt tự kết thúc sau khi giải quyết xong.
  ops.push({ op: 'finish' });
  enqueue(state, ops);
}

function endTurn(state, playerId) {
  requireExplorerTurn(state, playerId);
  finishExplorerPhase(state);
}

// ---------------------------------------------------------------- thẻ bài

function requireOwnedCard(player, cardId) {
  if (typeof cardId !== 'string' || !player.cards.includes(cardId)) throw new GameError('Bạn không có thẻ này.');
  return CARDS_BY_ID[cardId];
}

function useItem(state, playerId, action) {
  const player = requireExplorerTurn(state, playerId);
  const card = requireOwnedCard(player, action.cardId);
  if (!card.use) throw new GameError('Thẻ này không có hành động sử dụng.');
  if (state.turn.usedCards.includes(card.id)) throw new GameError('Thẻ này đã được dùng trong lượt.');
  state.turn.usedCards.push(card.id);
  addLog(state, `${player.name} dùng «${card.name}».`, 'card');
  const ops = toOps(card.use.effects, playerId, card.id);
  if (card.use.consume) {
    loseCard(state, player, card.id);
    state.discards[card.type].push(card.id);
  }
  enqueueFront(state, ops);
}

function giveItem(state, playerId, action) {
  const player = requireExplorerTurn(state, playerId);
  const card = requireOwnedCard(player, action.cardId);
  const target = state.players[action.toPlayerId];
  if (!target || target.id === playerId) throw new GameError('Người nhận không hợp lệ.');
  if (!target.alive) throw new GameError('Người nhận đã chết.');
  if (!samePos(target.pos, player.pos)) throw new GameError('Hai người phải đứng cùng phòng.');
  if (target.side !== player.side) throw new GameError('Không thể trao thẻ cho phe đối địch.');
  // Thứ tự hiệu ứng: người trao mất thẻ trước, sau đó người nhận hưởng thẻ.
  gainCard(state, target, card.id);
  loseCard(state, player, card.id);
  addLog(state, `${player.name} trao «${card.name}» cho ${target.name}.`, 'card');
}

function pickupItem(state, playerId, action) {
  const player = requireExplorerTurn(state, playerId);
  const tile = tileAt(state, player.pos);
  const idx = tile.items.indexOf(action.cardId);
  if (idx === -1) throw new GameError('Thẻ đó không nằm trong phòng này.');
  tile.items.splice(idx, 1);
  gainCard(state, player, action.cardId);
  addLog(state, `${player.name} nhặt «${CARDS_BY_ID[action.cardId].name}».`, 'card');
}

// ---------------------------------------------------------------- chiến đấu & Haunt

function attack(state, playerId, action) {
  const player = requireExplorerTurn(state, playerId);
  if (state.phase !== 'haunt') throw new GameError('Chỉ được tấn công sau khi Haunt bắt đầu.');
  if (state.turn.hasAttacked) throw new GameError('Mỗi lượt chỉ được tấn công một lần.');
  const weaponCardId = action.weaponCardId ?? null;
  const trait = action.trait ?? 'might';
  const option = explorerAttackOptions(state, playerId).find(
    (o) => o.targetType === action.targetType && o.targetId === action.targetId &&
      o.trait === trait && o.weaponCardId === weaponCardId,
  );
  if (!option) throw new GameError('Đòn tấn công không hợp lệ (sai mục tiêu, chỉ số hoặc vũ khí).');
  const bonus = weaponCardId ? CARDS_BY_ID[weaponCardId].weapon.bonusDice ?? 0 : 0;
  state.turn.hasAttacked = true;
  resolveCombat(state, { kind: 'player', id: player.id }, { kind: option.targetType, id: option.targetId }, trait, bonus);
}

function special(state, playerId, action) {
  requireExplorerTurn(state, playerId);
  const haunt = getHaunt(state);
  if (state.phase !== 'haunt' || !haunt?.performSpecial) throw new GameError('Không có hành động đặc biệt nào.');
  haunt.performSpecial(state, playerId, action);
}

function requireActiveMonster(state, monsterId) {
  const monster = state.monsters[monsterId];
  const slot = state.turn.monsters[monsterId];
  if (!monster || !slot) throw new GameError('Quái vật không tồn tại.');
  if (monster.stunned) throw new GameError(`${monster.name} đang bị choáng.`);
  return { monster, slot };
}

function monsterMove(state, playerId, action) {
  requireMonsterTurn(state, playerId);
  const { monster, slot } = requireActiveMonster(state, action.monsterId);
  if (slot.movesLeft < 1) throw new GameError(`${monster.name} đã hết bước.`);
  let target;
  const custom = hook(state, 'monsterSteps', monster);
  if (custom) {
    const match = custom.find((s) => (action.linkTo ? s.linkTo === action.linkTo : s.dir === action.dir));
    if (!match) throw new GameError(`${monster.name} không đi hướng đó được.`);
    target = match.pos;
  } else {
    const step = resolveStep(state, monster.pos, action);
    if (step.kind !== 'move') throw new GameError('Quái vật không thể khám phá phòng mới.');
    target = step.pos;
  }
  if (getHaunt(state).canMonsterEnter?.(state, monster, target) === false) {
    throw new GameError(`${monster.name} không thể vào phòng đó.`);
  }
  slot.movesLeft -= 1;
  monster.pos = target;
  addLog(state, `${monster.name} di chuyển tới ${roomName(state, target)}.`, 'move');
}

function monsterAttack(state, playerId, action) {
  requireMonsterTurn(state, playerId);
  const { monster, slot } = requireActiveMonster(state, action.monsterId);
  const option = monsterAttackOptions(state, monster.id).find((o) => o.targetId === action.targetId);
  if (!option) throw new GameError('Mục tiêu không hợp lệ hoặc quái vật đã tấn công rồi.');
  slot.attacked = true;
  resolveCombat(state, { kind: 'monster', id: monster.id }, { kind: 'player', id: action.targetId }, 'might');
}

function endMonsterTurn(state, playerId) {
  requireMonsterTurn(state, playerId);
  endMonsterPhase(state);
}

export const ACTIONS = {
  move,
  rotateTile,
  placeTile,
  endTurn,
  roll: (state, playerId) => resolveRoll(state, playerId),
  allocateDamage: (state, playerId, action) => resolveAllocateDamage(state, playerId, action.allocation),
  chooseTrait: (state, playerId, action) => resolveChooseTrait(state, playerId, action.trait),
  choose: (state, playerId, action) => resolveChoose(state, playerId, action.optionId),
  useItem,
  giveItem,
  pickupItem,
  attack,
  special,
  monsterMove,
  monsterAttack,
  endMonsterTurn,
};
