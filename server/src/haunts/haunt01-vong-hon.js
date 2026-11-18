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

  // Sách Kẻ phản bội (chỉ người đó thấy) và sách Người sống sót. Các mục: objective (thắng khi),
  // lose (thua khi), setup (khi Haunt bắt đầu), rules (luật riêng), tips (mẹo).
  traitorTome: {
    title: 'Sách Kẻ phản bội – Vong hồn dưới hầm',
    story:
      'Bạn đã nghe chúng gọi từ lúc bước qua cửa. Dòng họ chủ nhà hứa trả lại cho bạn những gì đã mất, ' +
      'miễn là không ai còn sống để rời khỏi đây.',
    objective: 'Bạn thắng khi mọi người sống sót đều đã chết (người chết là khi một chỉ số bất kỳ tụt xuống đầu lâu).',
    lose: [
      'Người sống sót yểm bùa xong đủ số phòng Điềm báo: 3 phòng nếu họ có 2–3 người, 4 phòng nếu có từ 4 người.',
      'Bạn chết không làm bạn thua: các Vong hồn vẫn tiếp tục săn người trong lượt của bạn.',
    ],
    setup: [
      'Bạn là người vừa lật Haunt.',
      'Vong hồn xuất hiện ở Chiếu nghỉ tầng hầm: 2 con nếu người sống sót có 2–3 người, 3 con nếu có từ 4 người.',
    ],
    rules: [
      'Mỗi lượt của bạn gồm hai phần: bạn đi và hành động như thường, sau đó là lượt quái vật để bạn điều khiển các Vong hồn.',
      'Vong hồn: Tốc độ 2, Sức mạnh 4, Tinh thần 3. Đầu lượt quái vật, mỗi con đổ Tốc độ để biết được đi mấy bước (ít nhất 1 bước).',
      'Mỗi Vong hồn được tấn công một lần mỗi lượt, bằng Sức mạnh. Thua thì người sống sót chịu sát thương thể chất bằng phần chênh lệch.',
      'Vong hồn không vào được phòng đã yểm bùa. Vong hồn đang đứng trong phòng lúc phòng đó được yểm thì bị choáng.',
      'Vong hồn bị choáng (do yểm bùa hoặc thua trận) bỏ qua một lượt quái vật rồi tỉnh lại.',
      'Bạn vẫn là người: tự tấn công bằng Sức mạnh như thường, và người sống sót cũng đánh được bạn.',
    ],
    tips: [
      'Người sống sót cần đứng ở phòng có biểu tượng Điềm báo mới yểm được. Hãy chặn các phòng đó và đừng để họ đứng yên.',
      'Dồn Vong hồn vào người có Sức mạnh thấp.',
    ],
  },

  survivalSecrets: {
    title: 'Sách Người sống sót – Vong hồn dưới hầm',
    story:
      'Trong cuốn gia phả có một trang bị xé: nghi thức yểm bùa bằng nến tại những nơi điềm gở từng xuất hiện. ' +
      'Đủ số ngọn nến thì ngôi nhà sẽ ngủ yên trở lại.',
    objective: 'Các bạn thắng khi yểm bùa đủ số phòng: 3 phòng nếu lúc Haunt bắt đầu có 2–3 người sống sót, 4 phòng nếu có từ 4 người.',
    lose: [
      'Mọi người sống sót đều chết (một chỉ số bất kỳ tụt xuống đầu lâu là chết).',
      'Giết Kẻ phản bội KHÔNG làm các bạn thắng: Vong hồn vẫn hoạt động.',
    ],
    setup: [
      'Kẻ phản bội là người vừa lật Haunt.',
      'Vong hồn xuất hiện ở Chiếu nghỉ tầng hầm (2 con nếu có 2–3 người sống sót, 3 con nếu có từ 4 người).',
    ],
    rules: [
      `«Yểm bùa» (mỗi lượt một lần): đứng trong phòng có biểu tượng Điềm báo chưa được yểm, đổ Tri thức hoặc Tinh thần (tự chọn). Đạt ${SEAL_TARGET}+ là thành công. Trượt thì chịu 1 sát thương tinh thần.`,
      'Phòng đã yểm được đánh dấu trên bàn cờ. Vong hồn không vào được phòng đó, nên đó là chỗ trú an toàn.',
      'Vong hồn đang đứng trong phòng lúc yểm bùa sẽ bị choáng, bỏ một lượt quái vật.',
      'Không đánh Vong hồn bằng Sức mạnh được. Bạn tấn công chúng bằng Tinh thần: thắng thì Vong hồn bị choáng, thua thì bạn chịu sát thương tinh thần bằng phần chênh lệch.',
      'Khi Vong hồn tấn công bạn, hai bên đổ Sức mạnh. Thua thì chịu sát thương thể chất bằng phần chênh lệch.',
      'Rời một phòng có Vong hồn (chưa choáng) hoặc Kẻ phản bội tốn thêm 1 bước cho mỗi kẻ địch ở đó.',
      'Kẻ phản bội đánh được bằng Sức mạnh như người thường.',
    ],
    tips: [
      'Người có Tri thức hoặc Tinh thần cao nên lo yểm bùa, người khỏe đi chặn Kẻ phản bội.',
      'Đứng trong phòng đã yểm để nghỉ khi bị thương nặng.',
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
    const { sealed, sealsRequired } = state.haunt.data;
    return {
      sealed, sealsRequired,
      meters: [{ id: 'sealed', label: 'Phòng Điềm báo đã yểm bùa', value: sealed.length, max: sealsRequired, tone: 'good' }],
    };
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
