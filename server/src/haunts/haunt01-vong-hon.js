// HAUNT #1 – «Vong hồn dưới hầm» (kịch bản tự sáng tác, dùng làm mẫu để viết Haunt mới).
//
// Một module Haunt là một object thuần với các hook dưới đây. Trạng thái riêng của Haunt nằm
// trong state.haunt.data (phải serialize được JSON). Đăng ký module trong haunts/index.js.

import { TILES_BY_ID } from '../data/index.js';
import { posKey, tileAt } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { TRAIT_LABEL, defaultAttackTraits } from '../engine/constants.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { spawnMonster, aliveHeroes } from './helpers.js';

const SEAL_TARGET = 4; // tổng xúc xắc cần đạt để yểm bùa thành công
const SEAL_TRAITS = ['knowledge', 'sanity'];

const WRAITH = { type: 'wraith', name: 'Vong hồn', traits: { speed: 2, might: 4, sanity: 3 } };

function canSealHere(state, player) {
  if (player.side !== 'hero' || !player.alive) return false;
  const tile = tileAt(state, player.pos);
  return TILES_BY_ID[tile.tileId].symbol === 'omen' && !state.haunt.data.sealed.includes(posKey(player.pos));
}

// Kết quả lần đổ yểm bùa (được gọi qua `then` của op 'roll').
registerOp('haunt01:seal', (state, it) => {
  const player = state.players[it.playerId];
  const data = state.haunt.data;
  if (it.total >= SEAL_TARGET) {
    data.sealed.push(it.tileKey);
    const tile = state.board.tiles[it.tileKey];
    tile.sealed = true;
    addLog(state, `🕯 ${player.name} yểm bùa thành công tại ${TILES_BY_ID[tile.tileId].name} ` +
      `(${data.sealed.length}/${data.sealsRequired}).`, 'haunt');
    // Vong hồn đang đứng trong phòng vừa được yểm bị đánh choáng.
    for (const m of Object.values(state.monsters)) {
      if (posKey(m.pos) === it.tileKey && !m.stunned) {
        m.stunned = true;
        m.recovering = false;
        addLog(state, `${m.name} bị ánh nến đánh choáng.`, 'haunt');
      }
    }
  } else {
    addLog(state, `${player.name} đọc sai lời chú – ngọn nến phụt tắt.`, 'haunt');
    enqueueFront(state, [{ op: 'damage', type: 'mental', amount: 1, playerId: player.id, source: 'haunt-01' }]);
  }
});

export default {
  id: 'haunt-01',
  name: 'Vong hồn dưới hầm',

  // Ai là Traitor: 'revealer' | 'leftOfRevealer' | 'highestTrait' | 'lowestTrait' (+ trait)
  traitor: { rule: 'revealer' },

  // Đọc to cho cả bàn.
  publicIntro:
    'Nền nhà rung lên. Từ dưới tầng hầm, những bóng trắng trồi qua sàn gỗ – và một người trong ' +
    'số các bạn đang mỉm cười chào đón chúng.',

  // Chỉ Traitor thấy.
  traitorTome: {
    title: "Traitor's Tome – Vong hồn dưới hầm",
    story:
      'Bạn đã nghe chúng gọi từ lúc bước qua cửa. Dòng họ chủ nhà hứa trả lại cho bạn những gì đã mất, ' +
      'miễn là không ai còn sống để rời khỏi đây.',
    objective: 'Bạn thắng khi mọi người sống sót đều đã chết.',
    rules: [
      'Các Vong hồn xuất hiện ở Chiếu nghỉ tầng hầm và do bạn điều khiển trong lượt quái vật, ngay sau lượt của bạn.',
      'Vong hồn: Tốc độ 2, Sức mạnh 4, Tinh thần 3. Đầu lượt quái vật, mỗi Vong hồn đổ Tốc độ để biết số bước (tối thiểu 1).',
      'Mỗi Vong hồn được tấn công một lần mỗi lượt bằng Sức mạnh, gây sát thương thể chất.',
      'Vong hồn không vào được phòng đã bị yểm bùa. Vong hồn bị choáng sẽ bỏ một lượt quái vật.',
      'Nếu bạn chết, các Vong hồn vẫn tiếp tục hành động trong lượt của bạn.',
      'Người sống sót đang tìm cách làm gì đó tại các phòng có biểu tượng Điềm báo. Đừng để họ đứng yên ở đó.',
    ],
  },

  // Chỉ người sống sót thấy.
  survivalSecrets: {
    title: 'Secrets of Survival – Vong hồn dưới hầm',
    story:
      'Trong cuốn gia phả có một trang bị xé: nghi thức yểm bùa bằng nến tại những nơi điềm gở từng xuất hiện. ' +
      'Đủ số ngọn nến thì ngôi nhà sẽ ngủ yên trở lại.',
    objective: 'Các bạn thắng khi yểm bùa đủ số phòng yêu cầu (3 phòng nếu có 2–3 người sống sót, 4 phòng nếu có 4–5 người).',
    rules: [
      `Hành động đặc biệt «Yểm bùa» (mỗi lượt một lần): khi đứng trong phòng có biểu tượng Điềm báo chưa được yểm, ` +
        `đổ Tri thức hoặc Tinh thần. ${SEAL_TARGET}+ là thành công; thất bại thì chịu 1 sát thương tinh thần.`,
      'Vong hồn không vào được phòng đã yểm bùa; Vong hồn đang ở trong phòng lúc yểm sẽ bị choáng.',
      'Vong hồn không thể bị đánh bằng Sức mạnh. Bạn tấn công chúng bằng Tinh thần: thắng thì Vong hồn bị choáng, ' +
        'thua thì bạn chịu sát thương tinh thần bằng phần chênh.',
      'Mỗi Vong hồn (chưa choáng) hoặc Kẻ phản bội đứng cùng phòng khiến bạn tốn thêm 1 bước khi rời phòng.',
      'Kẻ phản bội vẫn là người: tấn công hắn bằng Sức mạnh như bình thường. Giết hắn không dừng được Vong hồn.',
    ],
  },

  setup(state) {
    const heroes = aliveHeroes(state).length;
    state.haunt.data = { sealed: [], sealsRequired: heroes >= 4 ? 4 : 3 };
    const count = heroes >= 4 ? 3 : 2;
    for (let i = 1; i <= count; i++) {
      spawnMonster(state, { ...WRAITH, id: `wraith-${i}`, name: `${WRAITH.name} ${i}` }, 'basement-landing');
    }
    addLog(state, `${count} Vong hồn trồi lên ở Chiếu nghỉ tầng hầm.`, 'haunt');
  },

  // Dữ liệu Haunt công khai cho mọi người chơi (hiển thị tiến độ trên UI).
  publicData(state) {
    return { sealed: state.haunt.data.sealed, sealsRequired: state.haunt.data.sealsRequired };
  },

  // Chỉ số được phép tấn công. Trả về null để dùng luật mặc định.
  attackTraits(state, attacker, target, weaponDef) {
    if (attacker.kind === 'player' && target.kind === 'monster') return ['sanity'];
    return defaultAttackTraits(weaponDef);
  },

  canMonsterEnter(state, monster, pos) {
    return !state.haunt.data.sealed.includes(posKey(pos));
  },

  // Các hành động đặc biệt mà người chơi này có thể làm ngay bây giờ.
  specialActions(state, playerId) {
    const player = state.players[playerId];
    if (state.turn.usedSpecial || !canSealHere(state, player)) return [];
    return SEAL_TRAITS.map((trait) => ({
      type: 'special', actionId: 'seal', trait, label: `Yểm bùa (đổ ${TRAIT_LABEL[trait]}, cần ${SEAL_TARGET}+)`,
    }));
  },

  performSpecial(state, playerId, action) {
    const player = state.players[playerId];
    if (action.actionId !== 'seal') throw new GameError('Hành động đặc biệt không tồn tại.');
    if (state.turn.usedSpecial) throw new GameError('Mỗi lượt chỉ được yểm bùa một lần.');
    if (!canSealHere(state, player)) throw new GameError('Không thể yểm bùa ở đây.');
    if (!SEAL_TRAITS.includes(action.trait)) throw new GameError('Chỉ được đổ Tri thức hoặc Tinh thần.');
    state.turn.usedSpecial = true;
    enqueueFront(state, [{
      op: 'roll', playerId, trait: action.trait, label: 'Yểm bùa', source: 'haunt-01',
      then: { op: 'haunt01:seal', tileKey: posKey(player.pos) },
    }]);
  },

  // Trả về null nếu chưa ai thắng, hoặc { side: 'heroes' | 'traitor', reason }.
  checkVictory(state) {
    const { sealed, sealsRequired } = state.haunt.data;
    if (sealed.length >= sealsRequired) {
      return { side: 'heroes', reason: 'Ngọn nến cuối cùng được thắp lên và ngôi nhà chìm vào im lặng.' };
    }
    if (aliveHeroes(state).length === 0) {
      return { side: 'traitor', reason: 'Không còn ai sống sót để rời khỏi ngôi nhà.' };
    }
    return null;
  },
};
