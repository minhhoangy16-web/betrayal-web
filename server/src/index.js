// Khởi động HTTP + Socket.io server.
//
// Nếu thư mục client/dist tồn tại (đã chạy `npm run build`), server phục vụ luôn giao diện ở cùng
// địa chỉ: một dịch vụ, một đường link, không cần cấu hình CORS. Khi phát triển, giao diện chạy
// riêng bằng Vite ở cổng 5173 và kết nối sang đây.
//
// Biến môi trường:
//   PORT            (mặc định 3001; các dịch vụ hosting như Render tự đặt biến này)
//   CLIENT_ORIGIN   Chỉ cần khi giao diện nằm ở địa chỉ KHÁC server; phân tách bằng dấu phẩy
//                   (mặc định http://localhost:5173 cho lúc phát triển)
//   MIN_PLAYERS     Hạ xuống 1–2 để tự test một mình trên máy local (mặc định 3)
//   HAUNT_THRESHOLD Ngưỡng Haunt Roll (mặc định 5 theo luật 3rd Edition)

import http from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { RoomManager } from './rooms/RoomManager.js';
import { registerSocketHandlers } from './socket/handlers.js';
import { getCatalog } from './data/index.js';
import { DEFAULT_RULES } from './engine/Game.js';

const PORT = Number(process.env.PORT ?? 3001);
const ORIGINS = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim());

const intEnv = (name, fallback, min, max) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name} phải là số nguyên trong khoảng ${min}–${max}`);
  }
  return n;
};

const rules = {
  minPlayers: intEnv('MIN_PLAYERS', DEFAULT_RULES.minPlayers, 1, DEFAULT_RULES.maxPlayers),
  hauntRollThreshold: intEnv('HAUNT_THRESHOLD', DEFAULT_RULES.hauntRollThreshold, 1, 16),
};

const app = express();
app.use(cors({ origin: ORIGINS }));
app.get('/health', (req, res) => res.json({ ok: true }));
// Dữ liệu tĩnh (nhân vật, gạch, thẻ) để client vẽ giao diện. Không chứa bí mật Haunt.
app.get('/api/catalog', (req, res) => res.json({ ...getCatalog(), rules: { ...DEFAULT_RULES, ...rules } }));

// Giao diện đã build (client/dist). Mọi đường dẫn không phải API trả về index.html.
const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));
const hasClient = existsSync(`${CLIENT_DIST}/index.html`);
if (hasClient) {
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io')) return next();
    res.set('Cache-Control', 'no-cache');
    return res.sendFile(`${CLIENT_DIST}/index.html`);
  });
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ORIGINS } });

const manager = new RoomManager({ rules });
registerSocketHandlers(io, manager);

// Dọn các phòng bị bỏ hoang mỗi 5 phút.
setInterval(() => manager.cleanup(), 5 * 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT} (cho phép origin: ${ORIGINS.join(', ')})`);
  console.log(hasClient
    ? 'Giao diện: phục vụ từ client/dist tại cùng địa chỉ này.'
    : 'Giao diện: chưa build (chạy `npm run build`), hoặc dùng `npm run client` khi phát triển.');
  console.log(`Luật: tối thiểu ${rules.minPlayers} người, Haunt Roll cần ${rules.hauntRollThreshold}+`);
});
