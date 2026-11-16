// Sổ đăng ký kịch bản Haunt. Thêm Haunt mới: tạo file module rồi thêm vào HAUNT_LIST.

import haunt01 from './haunt01-vong-hon.js';

const HAUNT_LIST = [haunt01];

export const HAUNTS = Object.fromEntries(HAUNT_LIST.map((h) => [h.id, h]));

// Module Haunt đang chạy của ván (hoặc null trước khi Haunt bắt đầu).
export function getHaunt(state) {
  return state.haunt ? HAUNTS[state.haunt.id] : null;
}

// Chọn kịch bản khi Haunt Roll thành công. MVP chỉ có một kịch bản; khi có nhiều hơn,
// hãy chọn theo thẻ Omen vừa rút (state.lastCard.cardId), phòng đang đứng, v.v.
// Có thể ép kịch bản cho một ván qua rules.forcedHauntId.
export function selectHaunt(state, revealerId) {
  const forced = state.rules.forcedHauntId;
  if (forced) {
    if (!HAUNTS[forced]) throw new Error(`Không có Haunt ${forced}`);
    return HAUNTS[forced];
  }
  const candidates = HAUNT_LIST.filter((h) => !h.isAvailable || h.isAvailable(state, revealerId));
  return candidates[0] ?? HAUNT_LIST[0];
}
