import { TILES_BY_ID } from '../data/index.js';
import { GameError } from './errors.js';

// Hướng: 0 = Bắc, 1 = Đông, 2 = Nam, 3 = Tây. Xoay r nấc = xoay 90° theo chiều kim đồng hồ r lần.
export const DIRS = [
  { id: 0, name: 'Bắc', dx: 0, dy: -1 },
  { id: 1, name: 'Đông', dx: 1, dy: 0 },
  { id: 2, name: 'Nam', dx: 0, dy: 1 },
  { id: 3, name: 'Tây', dx: -1, dy: 0 },
];

export const opposite = (dir) => (dir + 2) % 4;
export const posKey = (pos) => `${pos.floor}:${pos.x}:${pos.y}`;
export const samePos = (a, b) => a.floor === b.floor && a.x === b.x && a.y === b.y;
export const tileAt = (state, pos) => state.board.tiles[posKey(pos)] ?? null;
export const neighborPos = (pos, dir) => ({ floor: pos.floor, x: pos.x + DIRS[dir].dx, y: pos.y + DIRS[dir].dy });

export function doorsOf(placed) {
  return TILES_BY_ID[placed.tileId].doors.map((d) => (d + placed.rotation) % 4);
}

export function hasDoor(placed, dir) {
  return doorsOf(placed).includes(dir);
}

// Các góc xoay hợp lệ khi đặt gạch mới: gạch phải có cửa quay về phía phòng mà
// người chơi vừa bước ra (fromDir là hướng người chơi đã đi).
export function validRotations(tileDef, fromDir) {
  const need = opposite(fromDir);
  const out = [];
  for (let r = 0; r < 4; r++) {
    if (tileDef.doors.some((d) => (d + r) % 4 === need)) out.push(r);
  }
  return out;
}

export function placeTile(state, tileId, pos, rotation) {
  const key = posKey(pos);
  if (state.board.tiles[key]) throw new Error(`Ô ${key} đã có gạch`);
  state.board.tiles[key] = { tileId, floor: pos.floor, x: pos.x, y: pos.y, rotation, items: [] };
  state.board.index[tileId] = key;
  return state.board.tiles[key];
}

export function hasTileForFloor(state, floor) {
  return state.tileStack.some((id) => TILES_BY_ID[id].floors.includes(floor));
}

// Rút gạch trên cùng của chồng mà đặt được ở tầng này; các gạch bị bỏ qua giữ nguyên thứ tự.
export function drawTileForFloor(state, floor) {
  const idx = state.tileStack.findIndex((id) => TILES_BY_ID[id].floors.includes(floor));
  if (idx === -1) return null;
  return state.tileStack.splice(idx, 1)[0];
}

// Kiểm tra một bước đi từ pos. step = { dir } (qua cửa) hoặc { linkTo } (cầu thang).
// Trả về { kind: 'move', pos } hoặc { kind: 'discover', pos, dir } (ô chưa có gạch).
export function resolveStep(state, pos, step) {
  const here = tileAt(state, pos);
  if (!here) throw new GameError('Vị trí hiện tại không hợp lệ.');
  if (step.linkTo !== undefined && step.linkTo !== null) {
    const def = TILES_BY_ID[here.tileId];
    if (!def.links?.includes(step.linkTo)) throw new GameError('Phòng này không có lối đi đó.');
    const key = state.board.index[step.linkTo];
    if (!key) throw new GameError('Phòng đích chưa được khám phá.');
    const t = state.board.tiles[key];
    return { kind: 'move', pos: { floor: t.floor, x: t.x, y: t.y } };
  }
  const dir = step.dir;
  if (!Number.isInteger(dir) || dir < 0 || dir > 3) throw new GameError('Hướng đi không hợp lệ.');
  if (!hasDoor(here, dir)) throw new GameError('Hướng đó không có cửa.');
  const np = neighborPos(pos, dir);
  const there = tileAt(state, np);
  if (!there) return { kind: 'discover', pos: np, dir };
  if (!hasDoor(there, opposite(dir))) throw new GameError('Bên kia cánh cửa là tường.');
  return { kind: 'move', pos: np };
}
