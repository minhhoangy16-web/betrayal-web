import { io } from 'socket.io-client';
import { SERVER_URL } from './constants.js';

// Một kết nối duy nhất cho cả ứng dụng; store sẽ gọi socket.connect() khi khởi động.
// Chuỗi rỗng = kết nối về chính địa chỉ đang mở trang.
export const socket = io(SERVER_URL || undefined, { autoConnect: false });

// Gửi sự kiện và chờ ack của server. Luôn resolve về { ok, error?, ... } – không bao giờ reject.
export function request(event, payload = {}) {
  return new Promise((resolve) => {
    socket.timeout(8000).emit(event, payload, (err, res) => {
      if (err) resolve({ ok: false, error: 'Máy chủ không phản hồi.', code: 'TIMEOUT' });
      else resolve(res ?? { ok: false, error: 'Phản hồi không hợp lệ.' });
    });
  });
}
