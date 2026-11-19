// Công cụ dùng chung cho các kịch bản Haunt.
//
// Dữ liệu hiển thị chung mà publicData() của một kịch bản có thể trả về (giao diện tự vẽ):
//   meters:  [{ id, label, value, max, tone: 'danger' | 'good' | 'neutral' }]  thanh đồng hồ / tiến độ
//   notes:   [string]                                                          dòng ghi chú ngắn
//   marks:   { "floor:x:y": [{ kind, label }] }                                 biểu tượng trên phòng
//            kind: coffin | flood | ash | clear | dug | charm | revealed | body | altar | offering | gold | exit | token
//   carried: { playerId: [label] }                                             vật của Haunt đang cầm

import { TILES_BY_ID } from '../data/index.js';
import { FLOOR_LABEL, TRAIT_LABEL } from '../engine/constants.js';
import { DIRS, posKey, tileAt, resolveStep, neighborPos } from '../engine/board.js';
import { GameError } from '../engine/errors.js';
import { addLog } from '../engine/log.js';
import { inPlay } from '../engine/hooks.js';

export { inPlay };

export const playersInPlay = (state) => Object.values(state.players).filter(inPlay);

export function aliveHeroes(state) {
  return Object.values(state.players).filter((p) => inPlay(p) && p.side === 'hero');
}

export const tileDefAt = (state, pos) => TILES_BY_ID[tileAt(state, pos).tileId];
export const roomName = (state, pos) => tileDefAt(state, pos).name;
export const roomLabel = (state, pos) => `${roomName(state, pos)} (${FLOOR_LABEL[pos.floor]})`;
export const posOf = (state, key) => {
  const t = state.board.tiles[key];
  return { floor: t.floor, x: t.x, y: t.y };
};
export const tilePos = (state, tileId) => {
  const key = state.board.index[tileId];
  return key ? posOf(state, key) : null;
};

// Các phòng đã có trên bàn (dạng posKey), lọc theo hàm (pos, def) => bool.
export function rooms(state, filter = () => true) {
  return Object.keys(state.board.tiles).filter((key) => {
    const pos = posOf(state, key);
    return filter(pos, tileDefAt(state, pos));
  });
}

// ---------------------------------------------------------------- đường đi

// Phòng kề có cửa thông (và cầu thang): [{ dir? , linkTo?, pos }]
export function doorSteps(state, pos) {
  const out = [];
  for (let dir = 0; dir < 4; dir++) {
    try {
      const r = resolveStep(state, pos, { dir });
      if (r.kind === 'move') out.push({ dir, pos: r.pos });
    } catch (err) {
      if (!(err instanceof GameError)) throw err;
    }
  }
  for (const linkTo of tileDefAt(state, pos).links ?? []) {
    const p = tilePos(state, linkTo);
    if (p) out.push({ linkTo, pos: p });
  }
  return out;
}

// Tầm nhìn (line of sight): chính phòng đang đứng, cộng các phòng nối thẳng hàng theo một hướng
// (cùng tầng), mỗi cặp phòng liền nhau đều thông cửa. Trả về Set các posKey.
export function lineOfSight(state, pos) {
  const seen = new Set([posKey(pos)]);
  for (let dir = 0; dir < 4; dir++) {
    let cur = pos;
    for (let guard = 0; guard < 30; guard++) {
      let r;
      try {
        r = resolveStep(state, cur, { dir });
      } catch (err) {
        if (!(err instanceof GameError)) throw err;
        break;
      }
      if (r.kind !== 'move') break;
      cur = r.pos;
      seen.add(posKey(cur));
    }
  }
  return seen;
}

// Phòng kề cạnh cùng tầng dù có tường hay không (bay xuyên tường), cộng cầu thang.
export function wallSteps(state, pos) {
  const out = [];
  for (let dir = 0; dir < 4; dir++) {
    const np = neighborPos(pos, dir);
    if (tileAt(state, np)) out.push({ dir, pos: np });
  }
  for (const linkTo of tileDefAt(state, pos).links ?? []) {
    const p = tilePos(state, linkTo);
    if (p) out.push({ linkTo, pos: p });
  }
  return out;
}

// Khoảng cách (số bước) từ `from` tới mọi phòng tới được. canEnter(pos) lọc phòng được đi vào.
export function distances(state, from, { steps = doorSteps, canEnter = () => true } = {}) {
  const dist = new Map([[posKey(from), 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    const d = dist.get(posKey(cur));
    for (const s of steps(state, cur)) {
      const k = posKey(s.pos);
      if (dist.has(k) || !canEnter(s.pos)) continue;
      dist.set(k, d + 1);
      queue.push(s.pos);
    }
  }
  return dist;
}

// Một bước đi từ `pos` gần mục tiêu hơn (theo đường ngắn nhất), hoặc null.
export function stepToward(state, pos, targetPos, opts = {}) {
  const fromTarget = distances(state, targetPos, opts);
  const here = fromTarget.get(posKey(pos));
  if (here === undefined || here === 0) return null;
  const options = (opts.steps ?? doorSteps)(state, pos)
    .filter((s) => (opts.canEnter ?? (() => true))(s.pos))
    .map((s) => ({ ...s, d: fromTarget.get(posKey(s.pos)) }))
    .filter((s) => s.d !== undefined && s.d < here);
  return options[0] ?? null;
}

// Đi tối đa `n` bước về phía mục tiêu do targetFn() chọn lại sau mỗi bước (null = đứng yên).
export function walkToward(state, unit, n, targetFn, opts = {}) {
  for (let i = 0; i < n; i++) {
    const target = targetFn();
    if (!target) return;
    const step = stepToward(state, unit.pos, target, opts);
    if (!step) return;
    unit.pos = step.pos;
  }
}

// Người chơi gần nhất (theo đường đi) trong danh sách, kèm khoảng cách.
export function nearest(state, fromPos, players, opts = {}) {
  const dist = distances(state, fromPos, opts);
  let best = null;
  for (const p of players) {
    const d = dist.get(posKey(p.pos));
    if (d === undefined) continue;
    if (!best || d < best.d) best = { player: p, d };
  }
  return best;
}

// ---------------------------------------------------------------- quái vật

// def = { id, type, name, traits: { speed, might, sanity?, knowledge? }, ai? }
export function spawnMonster(state, def, where) {
  let pos = where;
  if (typeof where === 'string') {
    pos = where.includes(':') ? posOf(state, where) : tilePos(state, where);
    if (!pos) throw new Error(`Không thể đặt quái vật: gạch ${where} chưa có trên bàn`);
  }
  state.monsters[def.id] = {
    id: def.id,
    type: def.type,
    name: def.name,
    traits: { ...def.traits },
    pos: { ...pos },
    stunned: false,
    recovering: false,
    ...(def.ai ? { ai: true } : {}),
  };
  return state.monsters[def.id];
}

// ---------------------------------------------------------------- lựa chọn & đổ xúc xắc

export const roomOption = (state, key, extra = {}) => ({ id: key, label: roomLabel(state, posOf(state, key)), pos: posOf(state, key), ...extra });

export const chooseOp = (playerId, label, options, then, extra = {}) => ({ op: 'choose', playerId, label, options, then, ...extra });

// Đổ chỉ số rồi gọi op `then` với `total`. bonus: số xúc xắc cộng thêm.
export const rollOp = (playerId, trait, label, then, bonus = 0) => ({ op: 'roll', playerId, trait, bonus, label, then });

export const traitText = (trait) => TRAIT_LABEL[trait];

// ---------------------------------------------------------------- vật của Haunt

// state.haunt.data.tokens = { [id]: { id, kind, label, holder: playerId|null, at: posKey|null } }
const tokenStore = (state) => {
  state.haunt.data.tokens ??= {};
  return state.haunt.data.tokens;
};

export function addToken(state, token) {
  tokenStore(state)[token.id] = { holder: null, at: null, ...token };
  return tokenStore(state)[token.id];
}

export const tokensOf = (state, playerId) => Object.values(tokenStore(state)).filter((t) => t.holder === playerId);
export const tokensAt = (state, key) => Object.values(tokenStore(state)).filter((t) => t.at === key);
export const hasToken = (state, playerId, kind) => tokensOf(state, playerId).some((t) => t.kind === kind);

export function giveTokenTo(state, tokenId, playerId) {
  const t = tokenStore(state)[tokenId];
  t.holder = playerId;
  t.at = null;
}

export function removeToken(state, tokenId) {
  delete tokenStore(state)[tokenId];
}

// Người chết làm rơi mọi vật của Haunt tại chỗ.
export function dropTokens(state, player) {
  const key = posKey(player.pos);
  for (const t of tokensOf(state, player.id)) {
    t.holder = null;
    t.at = key;
    addLog(state, `${t.label} rơi xuống sàn ${roomName(state, player.pos)}.`, 'haunt');
  }
}

// Các hành động chung với vật của Haunt: nhặt lên, trao cho đồng đội cùng phòng.
export function tokenActions(state, playerId, { canGive = true } = {}) {
  const me = state.players[playerId];
  const key = posKey(me.pos);
  const out = tokensAt(state, key).map((t) => ({ type: 'special', actionId: 'pickToken', tokenId: t.id, label: `Nhặt ${t.label}` }));
  if (canGive) {
    for (const t of tokensOf(state, playerId)) {
      for (const other of Object.values(state.players)) {
        if (other.id !== playerId && inPlay(other) && other.side === me.side && posKey(other.pos) === key) {
          out.push({ type: 'special', actionId: 'giveToken', tokenId: t.id, toPlayerId: other.id, label: `Trao ${t.label} cho ${other.name}` });
        }
      }
    }
  }
  return out;
}

// Trả về true nếu đã xử lý hành động.
export function handleTokenAction(state, playerId, action) {
  if (action.actionId !== 'pickToken' && action.actionId !== 'giveToken') return false;
  const option = tokenActions(state, playerId).find((o) => o.actionId === action.actionId && o.tokenId === action.tokenId
    && (action.actionId === 'pickToken' || o.toPlayerId === action.toPlayerId));
  if (!option) throw new GameError('Không thể làm vậy với vật này.');
  const me = state.players[playerId];
  const t = tokenStore(state)[action.tokenId];
  if (action.actionId === 'pickToken') {
    giveTokenTo(state, t.id, playerId);
    addLog(state, `${me.name} nhặt ${t.label}.`, 'haunt');
  } else {
    giveTokenTo(state, t.id, action.toPlayerId);
    addLog(state, `${me.name} trao ${t.label} cho ${state.players[action.toPlayerId].name}.`, 'haunt');
  }
  return true;
}

// Phần hiển thị chung của vật của Haunt: ai đang cầm gì, vật nào nằm trên sàn phòng nào.
export function tokenDisplay(state, { hide = () => false } = {}) {
  const carried = {};
  const marks = {};
  for (const t of Object.values(tokenStore(state))) {
    if (hide(t)) continue;
    if (t.holder) (carried[t.holder] ??= []).push(t.label);
    else if (t.at) (marks[t.at] ??= []).push({ kind: 'token', label: t.label });
  }
  return { carried, marks };
}

export function mergeMarks(...lists) {
  const out = {};
  for (const list of lists) {
    for (const [key, marks] of Object.entries(list ?? {})) (out[key] ??= []).push(...marks);
  }
  return out;
}

// Ghi đè phần di chuyển: thoát ra khỏi nhà.
export function escapePlayer(state, player, how) {
  player.escaped = true;
  addLog(state, `🚪 ${player.name} ${how}`, 'haunt');
}

export const DIR_NAMES = DIRS.map((d) => d.name);
