// Kiểm thử lớp socket bằng io giả (không cần cài socket.io để chạy test).

import test from 'node:test';
import assert from 'node:assert/strict';

import { RoomManager } from '../src/rooms/RoomManager.js';
import { registerSocketHandlers } from '../src/socket/handlers.js';
import { CHARACTERS } from '../src/data/index.js';

class FakeSocket {
  static next = 1;
  constructor(io) {
    this.io = io;
    this.id = `sock-${FakeSocket.next++}`;
    this.data = {};
    this.listeners = {};
    this.rooms = new Set();
    this.received = [];
  }
  on(event, fn) { this.listeners[event] = fn; }
  join(room) { this.rooms.add(room); }
  leave(room) { this.rooms.delete(room); }
  // Gửi sự kiện lên server và chờ ack.
  send(event, payload) {
    return new Promise((resolve) => this.listeners[event](payload, resolve));
  }
  disconnect() {
    this.io.sockets.delete(this.id);
    this.listeners.disconnect?.();
  }
  last(event) {
    return this.received.findLast(([name]) => name === event)?.[1];
  }
}

class FakeIo {
  sockets = new Map();
  on(event, fn) { this.onConnection = fn; }
  connect() {
    const socket = new FakeSocket(this);
    this.sockets.set(socket.id, socket);
    this.onConnection(socket);
    return socket;
  }
  resolve(target) {
    if (this.sockets.has(target)) return [this.sockets.get(target)];
    return [...this.sockets.values()].filter((s) => s.rooms.has(target));
  }
  to(target) {
    // structuredClone mô phỏng việc dữ liệu được serialize khi đi qua mạng.
    return { emit: (event, data) => this.resolve(target).forEach((s) => s.received.push([event, structuredClone(data)])) };
  }
  in(target) {
    return { socketsLeave: (room) => this.resolve(target).forEach((s) => s.leave(room)) };
  }
}

function setup(rules = {}, autoSkip = {}) {
  const io = new FakeIo();
  const manager = new RoomManager({ rules });
  registerSocketHandlers(io, manager, { logger: { error() {} }, autoSkip });
  return { io, manager };
}

async function startedRoom(count = 3, autoSkip = {}) {
  const { io, manager } = setup({}, autoSkip);
  const sockets = [];
  const host = io.connect();
  const created = await host.send('room:create', { name: 'Chủ phòng' });
  sockets.push({ socket: host, ...created });
  for (let i = 1; i < count; i++) {
    const socket = io.connect();
    const joined = await socket.send('room:join', { code: created.code, name: `Khách ${i}` });
    assert.ok(joined.ok, joined.error);
    sockets.push({ socket, ...joined });
  }
  for (let i = 0; i < count; i++) {
    const res = await sockets[i].socket.send('room:selectCharacter', { characterId: CHARACTERS[i].id });
    assert.ok(res.ok, res.error);
  }
  const started = await host.send('room:start', {});
  assert.ok(started.ok, started.error);
  return { io, manager, sockets, code: created.code };
}

test('lobby: tạo phòng, tham gia, chọn nhân vật, điều kiện bắt đầu', async () => {
  const { io } = setup();
  const host = io.connect();
  const created = await host.send('room:create', { name: '  An  ' });
  assert.ok(created.ok);
  assert.match(created.code, /^[A-Z2-9]{5}$/);

  const guest = io.connect();
  assert.equal((await guest.send('room:join', { code: 'ZZZZZ', name: 'Bình' })).code, 'ROOM_NOT_FOUND');
  assert.equal((await guest.send('room:join', { code: created.code, name: '' })).code, 'BAD_NAME');
  assert.equal((await guest.send('room:join', { code: created.code, name: 'an' })).code, 'NAME_TAKEN');
  // Mã phòng không phân biệt hoa thường.
  const joined = await guest.send('room:join', { code: created.code.toLowerCase(), name: 'Bình' });
  assert.ok(joined.ok);

  const lobby = host.last('room:state');
  assert.equal(lobby.players.length, 2);
  assert.equal(lobby.players[0].name, 'An');
  assert.ok(!JSON.stringify(lobby).includes(created.token), 'token không được phát cho cả phòng');
  assert.ok(!JSON.stringify(lobby).includes('sock-'), 'socketId không được phát cho cả phòng');

  assert.ok((await host.send('room:selectCharacter', { characterId: CHARACTERS[0].id })).ok);
  assert.equal((await guest.send('room:selectCharacter', { characterId: CHARACTERS[0].id })).code, 'CHARACTER_TAKEN');
  assert.ok((await guest.send('room:selectCharacter', { characterId: CHARACTERS[1].id })).ok);

  assert.equal((await guest.send('room:start', {})).code, 'NOT_HOST');
  assert.equal((await host.send('room:start', {})).code, 'NOT_ENOUGH_PLAYERS');

  const third = io.connect();
  await third.send('room:join', { code: created.code, name: 'Chi' });
  assert.equal((await host.send('room:start', {})).code, 'CHARACTER_MISSING');
  await third.send('room:selectCharacter', { characterId: CHARACTERS[2].id });
  assert.ok((await host.send('room:start', {})).ok);
  assert.equal(host.last('room:state').status, 'playing');

  const late = io.connect();
  assert.equal((await late.send('room:join', { code: created.code, name: 'Dũng' })).code, 'ALREADY_STARTED');
});

test('phòng tối đa 6 người', async () => {
  const { io } = setup();
  const host = io.connect();
  const { code } = await host.send('room:create', { name: 'P1' });
  for (let i = 2; i <= 6; i++) assert.ok((await io.connect().send('room:join', { code, name: `P${i}` })).ok);
  assert.equal((await io.connect().send('room:join', { code, name: 'P7' })).code, 'ROOM_FULL');
});

test('chủ phòng mời người chơi ra; người bị mời ra vào lại được phòng khác', async () => {
  const { io } = setup();
  const host = io.connect();
  const { code } = await host.send('room:create', { name: 'Chủ' });
  const guest = io.connect();
  const joined = await guest.send('room:join', { code, name: 'Khách' });
  assert.equal((await guest.send('room:kick', { playerId: joined.playerId })).code, 'NOT_HOST');
  assert.ok((await host.send('room:kick', { playerId: joined.playerId })).ok);
  assert.ok(guest.last('room:kicked') !== undefined || guest.received.some(([e]) => e === 'room:kicked'));
  assert.equal(host.last('room:state').players.length, 1);
  assert.ok(!guest.rooms.has(code));
  assert.ok((await guest.send('room:create', { name: 'Khách' })).ok);
});

test('game: mỗi người nhận view riêng; chỉ người tới lượt mới hành động được', async () => {
  const { sockets, manager, code } = await startedRoom(3);
  const views = sockets.map((s) => s.socket.last('game:state'));
  views.forEach((view, i) => {
    assert.equal(view.you, sockets[i].playerId);
    assert.equal(view.phase, 'explore');
    assert.ok(!('tileStack' in view));
  });

  const current = sockets.find((s) => s.playerId === views[0].turn.playerId);
  const waiting = sockets.find((s) => s.playerId !== views[0].turn.playerId);
  assert.ok(current.socket.last('game:state').legal.length > 0);
  assert.deepEqual(waiting.socket.last('game:state').legal, []);

  const denied = await waiting.socket.send('game:action', { type: 'endTurn' });
  assert.deepEqual([denied.ok, denied.code], [false, 'NOT_YOUR_TURN']);
  assert.equal((await current.socket.send('game:action', { type: 'bay-lên' })).ok, false);
  assert.equal((await current.socket.send('game:action', 'rác')).ok, false);

  const before = waiting.socket.received.length;
  assert.ok((await current.socket.send('game:action', { type: 'endTurn' })).ok);
  assert.ok(waiting.socket.received.length > before, 'mọi người đều nhận state mới');
  assert.notEqual(waiting.socket.last('game:state').turn.playerId, current.playerId);
  assert.equal(manager.getRoom(code).game.turn.number, 2);
});

test('mất kết nối và kết nối lại bằng token', async () => {
  const { io, sockets, code } = await startedRoom(3);
  const [host, guest] = sockets;
  guest.socket.disconnect();
  const lobby = host.socket.last('room:state');
  assert.equal(lobby.players.find((p) => p.id === guest.playerId).connected, false);

  const fresh = io.connect();
  assert.equal((await fresh.send('room:rejoin', { code, token: 'sai' })).code, 'BAD_TOKEN');
  assert.equal((await fresh.send('game:action', { type: 'endTurn' })).code, 'NOT_IN_ROOM');
  const back = await fresh.send('room:rejoin', { code, token: guest.token });
  assert.deepEqual([back.ok, back.playerId], [true, guest.playerId]);
  assert.equal(fresh.last('game:state').you, guest.playerId);
  assert.equal(host.socket.last('room:state').players.find((p) => p.id === guest.playerId).connected, true);
});

test('rời lobby: chuyển quyền chủ phòng, phòng trống thì bị xoá', async () => {
  const { io, manager } = setup();
  const host = io.connect();
  const { code } = await host.send('room:create', { name: 'A' });
  const guest = io.connect();
  const joined = await guest.send('room:join', { code, name: 'B' });
  assert.ok((await host.send('room:leave', {})).ok);
  assert.equal(guest.last('room:state').hostId, joined.playerId);
  assert.ok((await guest.send('room:leave', {})).ok);
  assert.equal(manager.rooms.size, 0);
});

test('dọn phòng bỏ hoang', async () => {
  const { io, manager } = setup();
  const host = io.connect();
  await host.send('room:create', { name: 'A' });
  assert.equal(manager.cleanup(Date.now() + 10 * 60 * 60 * 1000), 0, 'còn người kết nối thì không xoá');
  host.disconnect();
  assert.equal(manager.cleanup(Date.now()), 0, 'chưa quá thời gian chờ');
  assert.equal(manager.cleanup(Date.now() + 10 * 60 * 60 * 1000), 1);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const actorOf = (game) => (game.pending ? game.pending.playerId : game.turn.playerId);

test('người đang tới lượt mất kết nối: đếm ngược rồi tự bỏ lượt', async () => {
  const { manager, sockets, code } = await startedRoom(3, { graceMs: 60, nextMs: 10 });
  const room = manager.getRoom(code);
  const actorId = actorOf(room.game);
  const actor = sockets.find((s) => s.playerId === actorId);
  const watcher = sockets.find((s) => s.playerId !== actorId);
  const turnBefore = room.game.turn.number;

  actor.socket.disconnect();
  const lobby = watcher.socket.last('room:state');
  assert.equal(lobby.autoSkip.playerId, actorId);
  assert.ok(lobby.autoSkip.inMs > 0 && lobby.autoSkip.inMs <= 60);
  assert.equal(room.game.turn.number, turnBefore, 'chưa bỏ lượt khi còn trong thời gian chờ');

  await sleep(120);
  assert.notEqual(actorOf(room.game), actorId, 'lượt đã chuyển sang người khác');
  assert.ok(room.game.turn.number > turnBefore);
  assert.ok(room.game.log.some((l) => l.text.includes('tự động bỏ lượt')));
  assert.equal(watcher.socket.last('room:state').autoSkip, null);
  assert.notEqual(watcher.socket.last('game:state').turn.playerId, actorId);
});

test('kết nối lại trước khi hết giờ thì không bị bỏ lượt', async () => {
  const { io, manager, sockets, code } = await startedRoom(3, { graceMs: 80, nextMs: 10 });
  const room = manager.getRoom(code);
  const actorId = actorOf(room.game);
  const actor = sockets.find((s) => s.playerId === actorId);
  actor.socket.disconnect();
  await sleep(20);
  const back = io.connect();
  assert.ok((await back.send('room:rejoin', { code, token: actor.token })).ok);
  await sleep(120);
  assert.equal(actorOf(room.game), actorId);
  assert.equal(room.autoSkip, null);
});

test('chủ phòng bỏ qua lượt của người mất kết nối', async () => {
  const { manager, sockets, code } = await startedRoom(4, { graceMs: 60_000, nextMs: 60_000 });
  const room = manager.getRoom(code);
  const [host] = sockets;
  // Đảm bảo người đang tới lượt không phải chủ phòng.
  while (actorOf(room.game) === host.playerId) {
    assert.ok((await host.socket.send('game:action', { type: 'endTurn' })).ok);
  }
  const actorId = actorOf(room.game);
  const actor = sockets.find((s) => s.playerId === actorId);
  const other = sockets.find((s) => s.playerId !== actorId && s.playerId !== host.playerId);

  assert.equal((await host.socket.send('game:skip', {})).code, 'PLAYER_CONNECTED');
  actor.socket.disconnect();
  assert.equal((await other.socket.send('game:skip', {})).code, 'NOT_HOST');
  assert.ok((await host.socket.send('game:skip', {})).ok);
  assert.notEqual(actorOf(room.game), actorId);
});
