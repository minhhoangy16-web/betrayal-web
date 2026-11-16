// Hàm tiện ích dùng chung cho các kịch bản Haunt.

export function aliveHeroes(state) {
  return Object.values(state.players).filter((p) => p.alive && p.side === 'hero');
}

// def = { id, type, name, traits: { speed, might, sanity?, knowledge? } }
export function spawnMonster(state, def, tileId) {
  const key = state.board.index[tileId];
  if (!key) throw new Error(`Không thể đặt quái vật: gạch ${tileId} chưa có trên bàn`);
  const t = state.board.tiles[key];
  state.monsters[def.id] = {
    id: def.id,
    type: def.type,
    name: def.name,
    traits: { ...def.traits },
    pos: { floor: t.floor, x: t.x, y: t.y },
    stunned: false,
    recovering: false,
  };
  return state.monsters[def.id];
}
