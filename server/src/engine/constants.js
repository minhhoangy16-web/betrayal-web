export const TRAITS = ['speed', 'might', 'sanity', 'knowledge'];
export const PHYSICAL = ['speed', 'might'];
export const MENTAL = ['sanity', 'knowledge'];
export const DAMAGE_TRAITS = { physical: PHYSICAL, mental: MENTAL, general: TRAITS };
export const FLOORS = ['basement', 'ground', 'upper'];
export const TRACK_LENGTH = 8;
export const MAX_INDEX = TRACK_LENGTH - 1;

export const TRAIT_LABEL = { speed: 'Tốc độ', might: 'Sức mạnh', sanity: 'Tinh thần', knowledge: 'Tri thức' };
export const FLOOR_LABEL = { basement: 'tầng hầm', ground: 'tầng trệt', upper: 'tầng trên' };
export const DAMAGE_LABEL = { physical: 'thể chất', mental: 'tinh thần', general: 'tổng hợp' };

// Luật mặc định – có thể ghi đè cho từng ván qua createGame({ rules }).
export const DEFAULT_RULES = {
  // Bản 3rd Edition: đổ số xúc xắc = số Omen đã lật, tổng >= 5 thì Haunt bắt đầu.
  hauntRollThreshold: 5,
  maxDice: 8,
  minPlayers: 3,
  maxPlayers: 6,
};

// Chỉ số được phép dùng để tấn công khi kịch bản Haunt không quy định khác:
// Sức mạnh, cộng thêm chỉ số của vũ khí đang dùng (nếu có).
export function defaultAttackTraits(weaponDef) {
  const traits = ['might'];
  if (weaponDef?.trait && !traits.includes(weaponDef.trait)) traits.push(weaponDef.trait);
  return traits;
}
