// Quản lý phòng chơi trong bộ nhớ (in-memory).
// Để chuyển sang Redis: thay Map `rooms` bằng một store có cùng các thao tác get/set/delete –
// Room và GameState đều là JSON thuần.

import { randomBytes, randomUUID, randomInt } from 'node:crypto';
import { CHARACTERS_BY_ID } from '../data/index.js';
import { createGame, GameError, DEFAULT_RULES } from '../engine/Game.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ các ký tự dễ nhầm: I, O, 0, 1
const CODE_LENGTH = 5;
const NAME_MAX = 20;

function cleanName(raw) {
  const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX) : '';
  if (!name) throw new GameError('Hãy nhập tên người chơi.', 'BAD_NAME');
  return name;
}

export class RoomManager {
  /**
   * @param {object} [options]
   * @param {object} [options.rules]        Ghi đè luật mặc định (minPlayers, hauntRollThreshold...).
   * @param {number} [options.idleMs]       Xoá phòng không còn ai kết nối sau khoảng thời gian này.
   */
  constructor({ rules = {}, idleMs = 30 * 60 * 1000 } = {}) {
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.idleMs = idleMs;
    /** @type {Map<string, object>} */
    this.rooms = new Map();
  }

  // ------------------------------------------------------------ tra cứu

  getRoom(code) {
    const room = this.rooms.get(String(code ?? '').trim().toUpperCase());
    if (!room) throw new GameError('Không tìm thấy phòng.', 'ROOM_NOT_FOUND');
    return room;
  }

  getPlayer(room, playerId) {
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new GameError('Bạn không ở trong phòng này.', 'NOT_IN_ROOM');
    return player;
  }

  generateCode() {
    for (let attempt = 0; attempt < 1000; attempt++) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Không tạo được mã phòng');
  }

  // ------------------------------------------------------------ lobby

  newPlayer(name) {
    return {
      id: randomUUID(),
      token: randomBytes(24).toString('hex'), // bí mật, dùng để kết nối lại
      name: cleanName(name),
      characterId: null,
      connected: true,
      socketId: null,
      disconnectedAt: null,
    };
  }

  createRoom(hostName) {
    const player = this.newPlayer(hostName);
    const room = {
      code: this.generateCode(),
      hostId: player.id,
      status: 'lobby', // 'lobby' | 'playing' | 'finished'
      players: [player],
      autoSkip: null, // { playerId, at } khi đang đếm ngược bỏ lượt người mất kết nối
      game: null,
      createdAt: Date.now(),
      touchedAt: Date.now(),
    };
    this.rooms.set(room.code, room);
    return { room, player };
  }

  joinRoom(code, name) {
    const room = this.getRoom(code);
    if (room.status !== 'lobby') throw new GameError('Ván chơi đã bắt đầu.', 'ALREADY_STARTED');
    if (room.players.length >= this.rules.maxPlayers) throw new GameError('Phòng đã đầy.', 'ROOM_FULL');
    const player = this.newPlayer(name);
    if (room.players.some((p) => p.name.toLowerCase() === player.name.toLowerCase())) {
      throw new GameError('Tên này đã có người dùng trong phòng.', 'NAME_TAKEN');
    }
    room.players.push(player);
    room.touchedAt = Date.now();
    return { room, player };
  }

  // Kết nối lại bằng token đã cấp khi tạo/tham gia phòng.
  rejoin(code, token) {
    const room = this.getRoom(code);
    const player = room.players.find((p) => typeof token === 'string' && p.token === token);
    if (!player) throw new GameError('Phiên chơi không hợp lệ.', 'BAD_TOKEN');
    room.touchedAt = Date.now();
    return { room, player };
  }

  selectCharacter(code, playerId, characterId) {
    const room = this.getRoom(code);
    const player = this.getPlayer(room, playerId);
    if (room.status !== 'lobby') throw new GameError('Không thể đổi nhân vật khi ván đã bắt đầu.');
    if (characterId !== null) {
      if (!CHARACTERS_BY_ID[characterId]) throw new GameError('Nhân vật không tồn tại.');
      if (room.players.some((p) => p.id !== playerId && p.characterId === characterId)) {
        throw new GameError('Nhân vật này đã có người chọn.', 'CHARACTER_TAKEN');
      }
    }
    player.characterId = characterId;
    return room;
  }

  // Rời phòng. Trong lobby: xoá hẳn. Khi đang chơi: giữ chỗ để có thể kết nối lại.
  leave(code, playerId) {
    const room = this.getRoom(code);
    const player = this.getPlayer(room, playerId);
    if (room.status === 'lobby') {
      room.players = room.players.filter((p) => p.id !== playerId);
      if (!room.players.length) {
        this.rooms.delete(room.code);
        return null;
      }
      if (room.hostId === playerId) room.hostId = room.players[0].id;
    } else {
      player.connected = false;
      player.socketId = null;
      player.disconnectedAt ??= Date.now();
    }
    return room;
  }

  kick(code, hostId, targetId) {
    const room = this.getRoom(code);
    if (room.hostId !== hostId) throw new GameError('Chỉ chủ phòng mới được mời người chơi ra.', 'NOT_HOST');
    if (room.status !== 'lobby') throw new GameError('Không thể mời ra khi ván đã bắt đầu.');
    if (targetId === hostId) throw new GameError('Chủ phòng không thể tự mời mình ra.');
    const target = this.getPlayer(room, targetId);
    room.players = room.players.filter((p) => p.id !== targetId);
    return { room, target };
  }

  setConnection(room, player, socketId) {
    player.connected = Boolean(socketId);
    player.socketId = socketId;
    if (socketId) player.disconnectedAt = null;
    else if (!player.disconnectedAt) player.disconnectedAt = Date.now();
    room.touchedAt = Date.now();
  }

  startGame(code, playerId, { seed } = {}) {
    const room = this.getRoom(code);
    if (room.hostId !== playerId) throw new GameError('Chỉ chủ phòng mới được bắt đầu.', 'NOT_HOST');
    if (room.status !== 'lobby') throw new GameError('Ván chơi đã bắt đầu.', 'ALREADY_STARTED');
    if (room.players.length < this.rules.minPlayers) {
      throw new GameError(`Cần ít nhất ${this.rules.minPlayers} người chơi.`, 'NOT_ENOUGH_PLAYERS');
    }
    const missing = room.players.filter((p) => !p.characterId);
    if (missing.length) {
      throw new GameError(`Chưa chọn nhân vật: ${missing.map((p) => p.name).join(', ')}.`, 'CHARACTER_MISSING');
    }
    room.game = createGame({
      code: room.code,
      players: room.players.map((p) => ({ id: p.id, name: p.name, characterId: p.characterId })),
      seed,
      rules: this.rules,
    });
    room.status = 'playing';
    room.touchedAt = Date.now();
    return room;
  }

  // ------------------------------------------------------------ hiển thị & dọn dẹp

  // Trạng thái lobby công khai – không bao giờ chứa token hay socketId.
  lobbyView(room) {
    return {
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      minPlayers: this.rules.minPlayers,
      maxPlayers: this.rules.maxPlayers,
      players: room.players.map((p) => ({
        id: p.id, name: p.name, characterId: p.characterId, connected: p.connected,
      })),
      // Đang chờ một người mất kết nối: lượt của họ sẽ tự bỏ qua sau `inMs` mili giây.
      autoSkip: room.autoSkip
        ? { playerId: room.autoSkip.playerId, inMs: Math.max(0, room.autoSkip.at - Date.now()) }
        : null,
    };
  }

  // Xoá các phòng không còn ai kết nối quá idleMs. Trả về số phòng đã xoá.
  cleanup(now = Date.now()) {
    let removed = 0;
    for (const [code, room] of this.rooms) {
      const idle = now - room.touchedAt > this.idleMs;
      if (idle && room.players.every((p) => !p.connected)) {
        this.rooms.delete(code);
        removed += 1;
      }
    }
    return removed;
  }
}
