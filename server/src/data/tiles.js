// Gạch phòng (Room Tiles).
// Hướng cửa: 0 = Bắc, 1 = Đông, 2 = Nam, 3 = Tây (ở góc xoay 0). Toạ độ: Bắc là y - 1.
// floors: các tầng mà gạch được phép đặt. symbol: thẻ phải rút khi KHÁM PHÁ ra phòng.
// start: vị trí cố định khi bắt đầu ván. links: lối đi đặc biệt (cầu thang) tới gạch khác.
// effect.trigger: 'discover' (khi vừa khám phá) | 'endTurn' (khi kết thúc lượt tại đây).

const N = 0, E = 1, S = 2, W = 3;

export const TILES = [
  // ---- Gạch khởi đầu ----
  { id: 'entrance-hall', name: 'Sảnh vào', floors: ['ground'], doors: [N, E, W], symbol: null,
    start: { floor: 'ground', x: 0, y: 0 }, text: 'Cửa chính sau lưng bạn đã khoá chặt.' },
  { id: 'foyer', name: 'Tiền sảnh', floors: ['ground'], doors: [N, E, S, W], symbol: null,
    start: { floor: 'ground', x: 0, y: -1 } },
  { id: 'grand-staircase', name: 'Cầu thang lớn', floors: ['ground'], doors: [S], symbol: null,
    start: { floor: 'ground', x: 0, y: -2 }, links: ['upper-landing', 'basement-landing'],
    text: 'Dẫn lên Chiếu nghỉ tầng trên và xuống Chiếu nghỉ tầng hầm.' },
  { id: 'upper-landing', name: 'Chiếu nghỉ tầng trên', floors: ['upper'], doors: [N, E, S, W], symbol: null,
    start: { floor: 'upper', x: 0, y: 0 }, links: ['grand-staircase'] },
  { id: 'basement-landing', name: 'Chiếu nghỉ tầng hầm', floors: ['basement'], doors: [N, E, S, W], symbol: null,
    start: { floor: 'basement', x: 0, y: 0 }, links: ['grand-staircase'] },

  // ---- Phòng Điềm báo (omen) ----
  { id: 'dining-room', name: 'Phòng ăn', floors: ['ground'], doors: [N, E], symbol: 'omen' },
  { id: 'game-room', name: 'Phòng trò chơi', floors: ['ground', 'upper', 'basement'], doors: [N, E, S], symbol: 'omen' },
  { id: 'attic', name: 'Gác mái', floors: ['upper'], doors: [S, W], symbol: 'omen' },
  { id: 'master-bedroom', name: 'Phòng ngủ chính', floors: ['upper'], doors: [N, W], symbol: 'omen' },
  { id: 'crypt', name: 'Hầm mộ', floors: ['basement'], doors: [N, S], symbol: 'omen',
    text: 'Kết thúc lượt tại đây: chịu 1 sát thương tinh thần.',
    effect: { trigger: 'endTurn', effects: [{ op: 'damage', type: 'mental', amount: 1 }] } },
  { id: 'ritual-chamber', name: 'Phòng tế lễ', floors: ['basement'], doors: [N, E, W], symbol: 'omen' },
  { id: 'servants-quarters', name: 'Phòng gia nhân', floors: ['upper', 'basement'], doors: [N, E, S, W], symbol: 'omen' },
  { id: 'abandoned-room', name: 'Phòng bỏ hoang', floors: ['ground', 'upper', 'basement'], doors: [N, E, S, W], symbol: 'omen' },
  { id: 'mirror-gallery', name: 'Hành lang gương', floors: ['ground', 'upper'], doors: [N, S], symbol: 'omen' },

  // ---- Phòng Sự kiện (event) ----
  { id: 'conservatory', name: 'Nhà kính', floors: ['ground', 'upper'], doors: [N, W], symbol: 'event' },
  { id: 'ballroom', name: 'Phòng khiêu vũ', floors: ['ground'], doors: [N, E, S, W], symbol: 'event' },
  { id: 'bedroom', name: 'Phòng ngủ khách', floors: ['upper'], doors: [E, W], symbol: 'event' },
  { id: 'nursery', name: 'Phòng trẻ', floors: ['upper'], doors: [N, E], symbol: 'event' },
  { id: 'creaky-hallway', name: 'Hành lang cót két', floors: ['ground', 'upper', 'basement'], doors: [N, E, S, W], symbol: 'event' },
  { id: 'dusty-hallway', name: 'Hành lang phủ bụi', floors: ['ground', 'upper', 'basement'], doors: [N, E, S, W], symbol: 'event' },
  { id: 'wine-cellar', name: 'Hầm rượu', floors: ['basement'], doors: [N, S], symbol: 'event' },
  { id: 'furnace-room', name: 'Phòng lò', floors: ['basement'], doors: [N, S, W], symbol: 'event',
    text: 'Kết thúc lượt tại đây: chịu 1 sát thương thể chất.',
    effect: { trigger: 'endTurn', effects: [{ op: 'damage', type: 'physical', amount: 1 }] } },
  { id: 'tower', name: 'Tháp canh', floors: ['upper'], doors: [E, W], symbol: 'event' },
  { id: 'garden', name: 'Vườn hoang', floors: ['ground'], doors: [N, S], symbol: 'event' },

  // ---- Phòng Vật phẩm (item) ----
  { id: 'kitchen', name: 'Nhà bếp', floors: ['ground', 'basement'], doors: [N, E], symbol: 'item' },
  { id: 'storeroom', name: 'Kho chứa', floors: ['upper', 'basement'], doors: [N], symbol: 'item' },
  { id: 'larder', name: 'Phòng thực phẩm', floors: ['ground', 'basement'], doors: [N, S], symbol: 'item' },
  { id: 'study', name: 'Phòng làm việc', floors: ['ground', 'upper'], doors: [S, W], symbol: 'item' },
  { id: 'vault', name: 'Phòng két sắt', floors: ['basement'], doors: [N], symbol: 'item' },
  { id: 'sewing-room', name: 'Phòng may', floors: ['upper'], doors: [N, E, S], symbol: 'item' },
  { id: 'workshop', name: 'Xưởng mộc', floors: ['ground', 'basement'], doors: [E, S, W], symbol: 'item' },

  // ---- Phòng không biểu tượng ----
  { id: 'library', name: 'Thư viện', floors: ['ground', 'upper'], doors: [S, W], symbol: null,
    text: 'Khi khám phá: +1 Tri thức.',
    effect: { trigger: 'discover', effects: [{ op: 'gain', trait: 'knowledge', amount: 1 }] } },
  { id: 'chapel', name: 'Nhà nguyện', floors: ['ground', 'upper'], doors: [N, S], symbol: null,
    text: 'Khi khám phá: +1 Tinh thần.',
    effect: { trigger: 'discover', effects: [{ op: 'gain', trait: 'sanity', amount: 1 }] } },
  { id: 'gym', name: 'Phòng tập', floors: ['upper', 'basement'], doors: [E, S], symbol: null,
    text: 'Khi khám phá: +1 Sức mạnh.',
    effect: { trigger: 'discover', effects: [{ op: 'gain', trait: 'might', amount: 1 }] } },
  { id: 'tunnel', name: 'Đường hầm', floors: ['basement'], doors: [E, W], symbol: null },
];
