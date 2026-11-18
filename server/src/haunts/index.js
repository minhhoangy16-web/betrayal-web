// Sổ đăng ký kịch bản Haunt. Thêm Haunt mới: tạo file module rồi thêm vào HAUNT_LIST.

import { setHauntResolver } from '../engine/hooks.js';
import { SCENARIOS_BY_ID, DEFAULT_SCENARIO_ID } from '../data/scenarios.js';
import haunt01 from './haunt01-vong-hon.js';
import trungTang from './haunt-trung-tang.js';
import maDa from './haunt-ma-da.js';
import loBan from './haunt-lo-ban.js';
import maLai from './haunt-ma-lai.js';
import coHon from './haunt-co-hon.js';
import maGiuCua from './haunt-ma-giu-cua.js';
import trucVong from './haunt-truc-vong.js';

const HAUNT_LIST = [haunt01, trungTang, maDa, loBan, maLai, coHon, maGiuCua, trucVong];

export const HAUNTS = Object.fromEntries(HAUNT_LIST.map((h) => [h.id, h]));

// Module Haunt đang chạy của ván (hoặc null trước khi Haunt bắt đầu).
export function getHaunt(state) {
  return state.haunt ? HAUNTS[state.haunt.id] : null;
}

setHauntResolver(getHaunt);

// Mỗi thẻ kịch bản (data/scenarios.js) có bảng Haunt riêng: Haunt nào nổ ra tuỳ thẻ Điềm báo vừa rút
// và tầng của căn phòng. Bảng của thẻ mặc định dùng khi ván không có kịch bản.
export const SCENARIO_TABLE = SCENARIOS_BY_ID[DEFAULT_SCENARIO_ID].table;
export const scenarioTable = (state) => SCENARIOS_BY_ID[state.scenarioId]?.table ?? SCENARIO_TABLE;

// Tên các Haunt (công khai) để hiển thị bảng trên thẻ kịch bản.
export const hauntSummaries = () => HAUNT_LIST.map((h) => ({ id: h.id, name: h.name, minPlayers: h.minPlayers ?? null }));

const playable = (state, id) => {
  const h = HAUNTS[id];
  return Boolean(h) && (!h.minPlayers || state.turnOrder.length >= h.minPlayers);
};

// Chọn kịch bản khi Haunt Roll thành công. Có thể ép kịch bản cho một ván qua rules.forcedHauntId.
// Kịch bản không đủ người chơi (vd. giấu mặt cần từ 4 người) thì lấy ô ở cột còn lại.
export function selectHaunt(state, revealerId) {
  const forced = state.rules.forcedHauntId;
  if (forced) {
    if (!HAUNTS[forced]) throw new Error(`Không có Haunt ${forced}`);
    return HAUNTS[forced];
  }
  const row = scenarioTable(state)[state.lastCard?.cardId];
  if (row) {
    const basement = state.players[revealerId]?.pos.floor === 'basement';
    const [first, second] = basement ? [row[1], row[0]] : row;
    if (playable(state, first)) return HAUNTS[first];
    if (playable(state, second)) return HAUNTS[second];
  }
  return HAUNT_LIST[0];
}
