// Phòng chơi: quay lại phòng chờ sau khi ván kết thúc.

import test from 'node:test';
import assert from 'node:assert/strict';

import { RoomManager } from '../src/rooms/RoomManager.js';
import { CHARACTERS } from '../src/data/index.js';

function startedRoom() {
  const m = new RoomManager({ rules: { minPlayers: 3 } });
  const { room, player: host } = m.createRoom('Chủ');
  const b = m.joinRoom(room.code, 'Bình').player;
  const c = m.joinRoom(room.code, 'Chi').player;
  [host, b, c].forEach((p, i) => m.selectCharacter(room.code, p.id, CHARACTERS[i].id));
  m.startGame(room.code, host.id, { seed: 7 });
  return { m, room, host, b, c };
}

test('Về phòng chờ: chỉ được khi ván đã kết thúc, giữ mã phòng và nhân vật', () => {
  const { m, room, host, b, c } = startedRoom();
  assert.throws(() => m.backToLobby(room.code, b.id), /chưa kết thúc/);

  const firstGameId = room.game.gameId;
  room.game.winner = { side: 'heroes', reason: 'test' };
  room.status = 'finished';
  m.setConnection(room, c, null); // Chi đã tắt máy: bị bỏ khỏi phòng chờ

  m.backToLobby(room.code, b.id);
  assert.equal(room.status, 'lobby');
  assert.equal(room.game, null);
  assert.deepEqual(room.players.map((p) => p.id), [host.id, b.id]);
  assert.ok(room.players.every((p) => p.characterId));

  // Người mới vào được, rồi chơi tiếp ván mới trong cùng phòng.
  const d = m.joinRoom(room.code, 'Dũng').player;
  m.selectCharacter(room.code, d.id, CHARACTERS[3].id);
  m.startGame(room.code, host.id, { seed: 8 });
  assert.equal(room.status, 'playing');
  assert.notEqual(room.game.gameId, firstGameId);
});

test('Về phòng chờ: chủ phòng đã rời thì chuyển chủ phòng cho người còn lại', () => {
  const { m, room, host, b } = startedRoom();
  room.status = 'finished';
  m.setConnection(room, host, null);
  m.backToLobby(room.code, b.id);
  assert.equal(room.hostId, b.id);
});
