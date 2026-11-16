// Lớp Socket.io: chỉ chuyển sự kiện vào RoomManager / engine và phát lại state.
// File này cố ý không import 'socket.io' để có thể test bằng io giả (xem test/socket.test.js).
//
// Client -> Server (mọi sự kiện đều có ack: { ok: true, ...data } | { ok: false, error, code })
//   room:create          { name }                -> { code, playerId, token }
//   room:join            { code, name }          -> { code, playerId, token }
//   room:rejoin          { code, token }         -> { code, playerId, token }
//   room:selectCharacter { characterId | null }
//   room:kick            { playerId }            (chủ phòng)
//   room:start           {}                      (chủ phòng)
//   room:leave           {}
//   game:action          { type, ...payload }    (xem engine/actions.js)
//
// Server -> Client
//   room:state   Trạng thái lobby (giống nhau cho mọi người trong phòng)
//   game:state   Góc nhìn riêng của từng người (đã lọc thông tin bí mật)
//   room:kicked  Bạn bị chủ phòng mời ra

import { applyAction, getView, GameError } from '../engine/Game.js';

export function registerSocketHandlers(io, manager, { logger = console } = {}) {
  const broadcastLobby = (room) => io.to(room.code).emit('room:state', manager.lobbyView(room));

  // Mỗi người nhận một view khác nhau nên phải gửi theo từng socket.
  const broadcastGame = (room) => {
    if (!room.game) return;
    for (const p of room.players) {
      if (p.socketId) io.to(p.socketId).emit('game:state', getView(room.game, p.id));
    }
  };

  const broadcast = (room) => {
    broadcastLobby(room);
    broadcastGame(room);
  };

  io.on('connection', (socket) => {
    socket.data = socket.data ?? {};

    // Bọc handler: bắt lỗi, trả ack thống nhất, không bao giờ làm sập server vì input xấu.
    const on = (event, handler) => {
      socket.on(event, (payload, ack) => {
        if (typeof payload === 'function') [payload, ack] = [{}, payload];
        const reply = typeof ack === 'function' ? ack : () => {};
        try {
          const data = handler(payload && typeof payload === 'object' ? payload : {});
          reply({ ok: true, ...(data ?? {}) });
        } catch (err) {
          if (err instanceof GameError) {
            reply({ ok: false, error: err.message, code: err.code });
          } else {
            logger.error(`[socket] lỗi khi xử lý ${event}:`, err);
            reply({ ok: false, error: 'Lỗi máy chủ.', code: 'SERVER_ERROR' });
          }
        }
      });
    };

    const session = () => {
      const { code, playerId } = socket.data;
      if (!code || !playerId) throw new GameError('Bạn chưa vào phòng nào.', 'NOT_IN_ROOM');
      const room = manager.getRoom(code);
      return { room, player: manager.getPlayer(room, playerId) };
    };

    const attach = (room, player) => {
      // Nếu người chơi mở tab mới, tab cũ bị thay thế.
      if (player.socketId && player.socketId !== socket.id) {
        io.to(player.socketId).emit('room:replaced');
      }
      socket.data.code = room.code;
      socket.data.playerId = player.id;
      socket.join(room.code);
      manager.setConnection(room, player, socket.id);
      broadcast(room);
      return { code: room.code, playerId: player.id, token: player.token };
    };

    const detach = () => {
      const { code } = socket.data;
      if (code) socket.leave(code);
      socket.data.code = null;
      socket.data.playerId = null;
    };

    // Socket này có đang giữ một chỗ hợp lệ trong phòng nào không? (Bị mời ra / phòng bị xoá -> không.)
    const requireFree = () => {
      try {
        session();
      } catch (err) {
        if (!(err instanceof GameError)) throw err;
        detach();
        return;
      }
      throw new GameError('Bạn đang ở trong một phòng khác.', 'ALREADY_IN_ROOM');
    };

    on('room:create', ({ name }) => {
      requireFree();
      const { room, player } = manager.createRoom(name);
      return attach(room, player);
    });

    on('room:join', ({ code, name }) => {
      requireFree();
      const { room, player } = manager.joinRoom(code, name);
      return attach(room, player);
    });

    on('room:rejoin', ({ code, token }) => {
      const { room, player } = manager.rejoin(code, token);
      return attach(room, player);
    });

    on('room:selectCharacter', ({ characterId = null }) => {
      const { room, player } = session();
      manager.selectCharacter(room.code, player.id, characterId);
      broadcastLobby(room);
    });

    on('room:kick', ({ playerId }) => {
      const { room, player } = session();
      const { target } = manager.kick(room.code, player.id, playerId);
      if (target.socketId) {
        io.to(target.socketId).emit('room:kicked');
        io.in(target.socketId).socketsLeave(room.code);
      }
      broadcastLobby(room);
    });

    on('room:start', () => {
      const { room, player } = session();
      manager.startGame(room.code, player.id);
      broadcast(room);
    });

    on('room:leave', () => {
      const { room, player } = session();
      const remaining = manager.leave(room.code, player.id);
      detach();
      if (remaining) broadcast(remaining);
    });

    on('game:action', (action) => {
      const { room, player } = session();
      if (!room.game) throw new GameError('Ván chơi chưa bắt đầu.', 'NOT_STARTED');
      applyAction(room.game, player.id, action);
      if (room.game.winner && room.status !== 'finished') {
        room.status = 'finished';
        broadcastLobby(room);
      }
      room.touchedAt = Date.now();
      broadcastGame(room);
    });

    socket.on('disconnect', () => {
      const { code, playerId } = socket.data;
      if (!code || !playerId) return;
      try {
        const room = manager.getRoom(code);
        const player = manager.getPlayer(room, playerId);
        // Chỉ đánh dấu mất kết nối nếu đây vẫn là socket hiện tại của người chơi.
        if (player.socketId === socket.id) {
          manager.setConnection(room, player, null);
          broadcastLobby(room);
        }
      } catch (err) {
        if (!(err instanceof GameError)) logger.error('[socket] lỗi khi ngắt kết nối:', err);
      }
    });
  });
}
