const MAX_LOG = 300;

// kind: 'info' | 'move' | 'card' | 'roll' | 'damage' | 'combat' | 'haunt' | 'system'
// to: chỉ người chơi này thấy dòng nhật ký (thông tin bí mật của Haunt).
export function addLog(state, text, kind = 'info', to = null) {
  state.logSeq += 1;
  const entry = { seq: state.logSeq, kind, text, turn: state.turn?.number ?? 0 };
  if (to) entry.to = to;
  state.log.push(entry);
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

export function setLastRoll(state, roll) {
  state.rollSeq += 1;
  state.lastRoll = { seq: state.rollSeq, ...roll };
}
