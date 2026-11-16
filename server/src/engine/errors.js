// Lỗi do hành động không hợp lệ của người chơi (không phải bug của server).
export class GameError extends Error {
  constructor(message, code = 'INVALID_ACTION') {
    super(message);
    this.name = 'GameError';
    this.code = code;
  }
}
