const MAX_LOG = 600;

// kind: 'info' | 'move' | 'card' | 'roll' | 'damage' | 'combat' | 'haunt' | 'system'
// to: chỉ người chơi này thấy dòng nhật ký (thông tin bí mật của Haunt).
// hideFrom: danh sách người chơi KHÔNG được thấy dòng này (vd. giấu với Kẻ phản bội).
export function addLog(state, text, kind = 'info', to = null, hideFrom = null) {
  state.logSeq += 1;
  // round + actor: để tra cứu nhật ký theo vòng và theo người đang đi lượt (thông tin công khai).
  const entry = { seq: state.logSeq, kind, text, turn: state.turn?.number ?? 0, round: state.round ?? 1 };
  if (state.turn?.playerId) entry.actor = state.turn.playerId;
  if (to) entry.to = to;
  if (hideFrom?.length) entry.hideFrom = hideFrom;
  state.log.push(entry);
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

export function setLastRoll(state, roll) {
  state.rollSeq += 1;
  state.lastRoll = { seq: state.rollSeq, ...roll };
}
