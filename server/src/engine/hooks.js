// Điểm nối giữa bộ máy và kịch bản Haunt đang chạy.
//
// Bộ máy gọi hook(state, 'tênHook', ...) ở những chỗ một kịch bản có thể muốn đổi luật. Nếu kịch bản
// không khai báo hook đó, kết quả là undefined và bộ máy dùng luật mặc định. Module này không
// import kịch bản nào (haunts/index.js tự đăng ký vào đây) để tránh vòng import.
//
// Danh sách hook (đều tuỳ chọn, xem haunts/README.md):
//   onTurnStart(state, playerId)              đầu lượt một người chơi (có thể enqueue op)
//   skipExplorer(state, playerId) -> bool     bỏ phần lượt nhà thám hiểm (vd. Kẻ phản bội hoá thân xác)
//   onExplorerTurnEnd(state, player) -> ops[] khi người chơi kết thúc phần lượt của mình
//   onRoundEnd(state)                         sau khi người cuối cùng trong vòng đi xong
//   onPlayerEnter(state, player, pos)         sau khi người chơi bước vào một phòng
//   onPlayerDeath(state, player)              khi một người chơi chết
//   canPlayerEnter(state, player, toPos) -> false để chặn người chơi đi vào phòng (từ phòng hiện tại)
//   moveCost(state, player, toPos) -> số      số bước phải trả thêm khi vào phòng
//   areEnemies(state, a, b) -> bool           hai người chơi có được đánh nhau không
//   canBeAttacked(state, ref) -> bool         một đơn vị có bị tấn công được không
//   canAttackMonster(state, player, monster)  người chơi có được đánh quái vật này không
//   monsterCanTarget(state, monster, player)  quái vật có được đánh người chơi này không
//   monsterSteps(state, monster) -> steps[]   ghi đè các bước đi của quái vật ({dir|linkTo, pos})
//   attackBonus(state, attacker, target, trait) -> số xúc xắc cộng thêm
//   defenseBonus(state, attacker, target, trait) -> số xúc xắc cộng thêm cho bên bị đánh
//   attackResultBonus(state, attacker, target, trait) -> số cộng thẳng vào tổng điểm của bên tấn công
//   onCombatWin(state, winnerRef, loserRef, amount, trait)  trước khi bên thua chịu hậu quả
//   onCombatLoss(state, loserRef, amount, trait, winnerRef) -> true nếu kịch bản tự xử lý bên thua
//   monsterMoveCount(state, monster) -> số bước cố định trong lượt quái (null = đổ Tốc độ)
//   monsterAttackTrait(state, monster, player) -> chỉ số quái vật dùng khi tấn công (mặc định might)
//   monsterSpecialActions(state, monster) -> [{actionId, targetId?, label}] (chiêu riêng trong lượt quái)
//   performMonsterSpecial(state, playerId, monster, slot, action)
//   maskView(state, viewerId, view)           sửa view gửi cho một người (giấu thông tin)

let resolver = () => null;

export function setHauntResolver(fn) {
  resolver = fn;
}

export function hook(state, name, ...args) {
  const haunt = state.haunt ? resolver(state) : null;
  const fn = haunt?.[name];
  return typeof fn === 'function' ? fn(state, ...args) : undefined;
}

// Người chơi còn ở trên bàn cờ: còn sống và chưa thoát khỏi nhà.
export const inPlay = (player) => Boolean(player?.alive && !player.escaped);
