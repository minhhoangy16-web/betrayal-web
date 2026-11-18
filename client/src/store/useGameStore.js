// Store Zustand: giữ kết nối, phiên chơi, trạng thái lobby và góc nhìn game do server gửi về.
// Client không tự tính luật: mọi thay đổi đều đi qua act() -> server -> 'game:state'.

import { create } from 'zustand';
import { socket, request } from '../lib/socket.js';
import { SERVER_URL, mediaUrl } from '../lib/constants.js';
import { audio } from '../lib/audio.js';

// sessionStorage là riêng cho từng tab, nên mỗi tab trình duyệt là một người chơi khác nhau
// (tiện để tự test multiplayer), và tải lại trang vẫn giữ được chỗ.
const SESSION_KEY = 'betrayal.session';

function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function saveSession(session) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Trình duyệt chặn storage: vẫn chơi được, chỉ mất khả năng kết nối lại sau khi tải trang.
  }
}

const indexById = (list) => Object.fromEntries(list.map((entry) => [entry.id, entry]));

let started = false;
let toastSeq = 0;

export const useGameStore = create((set, get) => ({
  connected: false,
  catalog: null,
  catalogError: null,
  media: { tiles: {}, cards: {}, glyphs: {}, portraits: {}, faces: {} }, // ảnh tuỳ chọn cho gạch và thẻ, đọc từ public/media/manifest.json
  viewCardId: null, // thẻ đang mở xem to (bấm vào thẻ trong túi đồ)
  bagPlayerId: null, // đang xem túi đồ của người chơi nào (bấm vào avatar)
  session: loadSession(), // { code, playerId, token }
  lobby: null,
  game: null,
  toasts: [],
  selectedMonsterId: null,

  init() {
    if (started) return;
    started = true;

    socket.on('connect', async () => {
      set({ connected: true });
      if (!get().catalog) get().loadCatalog();
      const { session } = get();
      if (!session) return;
      const res = await request('room:rejoin', { code: session.code, token: session.token });
      if (!res.ok) {
        get().clearSession();
        if (res.code !== 'TIMEOUT') get().toast('Phòng cũ không còn tồn tại.', 'error');
      }
    });
    socket.on('disconnect', () => set({ connected: false }));
    socket.on('room:state', (lobby) => {
      // Đổi thời gian còn lại thành mốc giờ trên máy này để đếm ngược.
      const autoSkip = lobby.autoSkip ? { ...lobby.autoSkip, deadline: Date.now() + lobby.autoSkip.inMs } : null;
      // Cả phòng vừa quay về phòng chờ: bỏ góc nhìn của ván cũ.
      const backToLobby = lobby.status === 'lobby';
      set((s) => ({
        lobby: { ...lobby, autoSkip },
        ...(backToLobby && s.game ? { game: null, bagPlayerId: null, viewCardId: null, selectedMonsterId: null } : {}),
      }));
    });
    socket.on('game:state', (game) => set({ game }));
    socket.on('room:kicked', () => {
      get().clearSession();
      get().toast('Bạn đã bị chủ phòng mời ra.', 'error');
    });
    socket.on('room:replaced', () => {
      get().clearSession();
      get().toast('Phiên chơi này vừa được mở ở một tab khác.', 'error');
    });

    get().loadCatalog();
    get().loadMedia();
    socket.connect();
  },

  // Dữ liệu tĩnh (nhân vật, gạch, thẻ) để vẽ giao diện.
  async loadCatalog() {
    try {
      const res = await fetch(`${SERVER_URL}/api/catalog`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({
        catalogError: null,
        catalog: {
          ...data,
          charactersById: indexById(data.characters),
          tilesById: indexById(data.tiles),
          cardsById: indexById(data.cards),
        },
      });
    } catch {
      set({ catalogError: `Không kết nối được máy chủ${SERVER_URL ? ` tại ${SERVER_URL}` : ''}.` });
    }
  },

  // Ảnh và nhạc tuỳ chọn. Không có manifest (hoặc manifest hỏng) thì game dùng giao diện vẽ sẵn
  // và âm thanh tổng hợp.
  async loadMedia() {
    try {
      const res = await fetch(mediaUrl('manifest.json'));
      if (!res.ok) return;
      const manifest = await res.json();
      const img = manifest.images ?? {};
      set({
        media: {
          tiles: img.tiles ?? {},
          cards: img.cards ?? {},
          glyphs: img.glyphs ?? {},
          portraits: img.portraits ?? {}, // chân dung nhân vật (bảng chỉ số, màn chọn nhân vật)
          faces: img.faces ?? {}, // ảnh khuôn mặt vuông nhỏ (quân cờ, danh sách người chơi)
        },
      });
      audio.setManifest(manifest.audio, mediaUrl);
    } catch {
      // Bỏ qua: media là phần tuỳ chọn.
    }
  },

  toast(text, kind = 'info') {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500);
  },

  clearSession() {
    saveSession(null);
    set({ session: null, lobby: null, game: null, selectedMonsterId: null, viewCardId: null, bagPlayerId: null });
  },

  // Tạo phòng hoặc tham gia phòng: lưu lại phiên để kết nối lại được.
  async enter(event, payload) {
    const res = await request(event, payload);
    if (!res.ok) {
      get().toast(res.error, 'error');
      return false;
    }
    const session = { code: res.code, playerId: res.playerId, token: res.token };
    saveSession(session);
    set({ session });
    return true;
  },
  createRoom: (name) => get().enter('room:create', { name }),
  joinRoom: (code, name) => get().enter('room:join', { code, name }),

  async send(event, payload) {
    const res = await request(event, payload);
    if (!res.ok) get().toast(res.error, 'error');
    return res.ok;
  },
  selectCharacter: (characterId) => get().send('room:selectCharacter', { characterId }),
  kick: (playerId) => get().send('room:kick', { playerId }),
  setScenario: (scenarioId) => get().send('room:scenario', { scenarioId }),
  startGame: () => get().send('room:start', {}),
  act: (action) => get().send('game:action', action),
  skipTurn: () => get().send('game:skip', {}),
  viewCard: (cardId) => set({ viewCardId: cardId }),
  viewBag: (playerId) => set({ bagPlayerId: playerId }),
  // Ván đã kết thúc: đưa cả phòng về phòng chờ (giữ mã phòng và nhân vật).
  backToLobby: () => get().send('room:backToLobby', {}),

  async leave() {
    await request('room:leave', {});
    get().clearSession();
  },

  selectMonster: (id) => set({ selectedMonsterId: id }),
}));
