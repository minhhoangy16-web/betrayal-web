const MAX_LOG = 300;

// kind: 'info' | 'move' | 'card' | 'roll' | 'damage' | 'combat' | 'haunt' | 'system'
export function addLog(state, text, kind = 'info') {
  state.logSeq += 1;
  state.log.push({ seq: state.logSeq, kind, text, turn: state.turn?.number ?? 0 });
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

export function setLastRoll(state, roll) {
  state.rollSeq += 1;
  state.lastRoll = { seq: state.rollSeq, ...roll };
}
