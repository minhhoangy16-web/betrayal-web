// Địa chỉ server. Bản build (production) dùng chính địa chỉ đang mở trang, vì server phục vụ luôn
// giao diện. Khi phát triển (npm run client), giao diện ở cổng 5173 còn server ở cổng 3001.
// Đặt VITE_SERVER_URL chỉ khi bạn cố ý để giao diện và server ở hai địa chỉ khác nhau.
export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');

export const TRAITS = ['speed', 'might', 'sanity', 'knowledge'];
export const TRAIT_LABEL = { speed: 'Tốc độ', might: 'Sức mạnh', sanity: 'Tinh thần', knowledge: 'Tri thức' };

// Thứ tự hiển thị tab tầng: từ trên xuống dưới.
export const FLOORS = ['upper', 'ground', 'basement'];
export const FLOOR_LABEL = { upper: 'Tầng trên', ground: 'Tầng trệt', basement: 'Tầng hầm' };

// Khớp với server/src/engine/board.js: 0 = Bắc, 1 = Đông, 2 = Nam, 3 = Tây.
export const DIRS = [
  { id: 0, label: 'Bắc', dx: 0, dy: -1 },
  { id: 1, label: 'Đông', dx: 1, dy: 0 },
  { id: 2, label: 'Nam', dx: 0, dy: 1 },
  { id: 3, label: 'Tây', dx: -1, dy: 0 },
];

export const DAMAGE_LABEL = { physical: 'thể chất', mental: 'tinh thần', general: 'tổng hợp' };
export const CARD_TYPE_LABEL = { omen: 'Điềm báo', item: 'Vật phẩm', event: 'Sự kiện' };
export const SIDE_LABEL = {
  explorer: 'Nhà thám hiểm', hero: 'Người sống sót', traitor: 'Kẻ phản bội', solo: 'Mạnh ai nấy chơi', unknown: 'Chưa rõ phe',
};

export const TILE_SIZE = 136;

// Đường dẫn tới file trong client/public/media/. Chấp nhận cả URL tuyệt đối.
export function mediaUrl(path) {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/')) return path;
  return `${import.meta.env.BASE_URL}media/${path}`;
}

export const posKey = (pos) => `${pos.floor}:${pos.x}:${pos.y}`;
export const samePos = (a, b) => a.floor === b.floor && a.x === b.x && a.y === b.y;
export const rotatedDoors = (tileDef, rotation) => tileDef.doors.map((d) => (d + rotation) % 4);
