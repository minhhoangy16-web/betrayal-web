// Bộ thông dịch hiệu ứng (effect interpreter).
//
// Mọi thứ xảy ra trong game (hiệu ứng thẻ, phòng, Haunt Roll, kết thúc lượt...) đều là một "op"
// trong hàng đợi state.queue. runQueue() chạy lần lượt cho tới khi hết hàng đợi hoặc cần người
// chơi quyết định – khi đó nó đặt state.pending và dừng lại. Khi người chơi trả lời
// (roll / allocateDamage / chooseTrait / placeTile), pending được xoá và hàng đợi chạy tiếp.
//
// Thêm cơ chế mới = registerOp('tên-op', handler) rồi dùng { op: 'tên-op', ... } trong dữ liệu thẻ.

import { TRAITS, PHYSICAL, MENTAL, DAMAGE_TRAITS, MAX_INDEX, TRAIT_LABEL, DAMAGE_LABEL } from './constants.js';
import { GameError } from './errors.js';
import { rollDice } from './dice.js';
import { shuffle } from './rng.js';
import { addLog, setLastRoll } from './log.js';
import { traitValue, shiftTrait, damageCapacity, startIndex } from './traits.js';
import { CARDS_BY_ID, TILES_BY_ID } from '../data/index.js';

const OPS = {};
let victoryCheck = () => {};

export function registerOp(name, handler) {
  OPS[name] = handler;
}

// haunt.js đăng ký hàm kiểm tra thắng thua ở đây để tránh import vòng.
export function setVictoryCheck(fn) {
  victoryCheck = fn;
}

// Chuyển danh sách hiệu ứng (dữ liệu thẻ) thành op gắn với một người chơi.
export function toOps(effects, playerId, source) {
  return (effects ?? []).map((e) => ({ ...e, playerId, source }));
}

export function enqueue(state, ops) {
  state.queue.push(...ops);
}

export function enqueueFront(state, ops) {
  state.queue.unshift(...ops);
}

export function runQueue(state) {
  let guard = 0;
  while (!state.pending && !state.winner && state.queue.length) {
    if (++guard > 2000) throw new Error('Hàng đợi hiệu ứng lặp vô hạn');
    const item = state.queue.shift();
    const handler = OPS[item.op];
    if (!handler) throw new Error(`Op không tồn tại: ${item.op}`);
    handler(state, item);
    victoryCheck(state);
  }
  if (state.winner) {
    state.queue = [];
    state.pending = null;
  }
}

// ---------------------------------------------------------------- thẻ bài

export function drawCard(state, playerId, deck) {
  const player = state.players[playerId];
  if (!state.decks[deck].length && deck === 'event' && state.discards.event.length) {
    state.decks.event = shuffle(state, state.discards.event);
    state.discards.event = [];
    addLog(state, 'Xào lại chồng bài Sự kiện.', 'system');
  }
  const cardId = state.decks[deck].shift();
  if (!cardId) {
    addLog(state, `Chồng bài ${deck} đã hết – không rút được thẻ.`, 'system');
    return null;
  }
  const card = CARDS_BY_ID[cardId];
  state.cardSeq += 1;
  state.lastCard = { seq: state.cardSeq, cardId, playerId };
  addLog(state, `${player.name} rút thẻ ${labelOf(card.type)}: «${card.name}».`, 'card');

  if (card.type === 'event') {
    state.discards.event.push(cardId);
    enqueueFront(state, toOps(card.effects, playerId, cardId));
    return cardId;
  }
  player.cards.push(cardId);
  const ops = toOps(card.onGain, playerId, cardId);
  if (card.type === 'omen') {
    state.omensRevealed += 1;
    if (state.phase === 'explore') ops.push({ op: 'hauntRoll', playerId });
  }
  enqueueFront(state, ops);
  return cardId;
}

const labelOf = (type) => ({ omen: 'Điềm báo', item: 'Vật phẩm', event: 'Sự kiện' })[type];

// Nhận một thẻ có sẵn (được trao / nhặt lên). Không kích hoạt Haunt Roll.
export function gainCard(state, player, cardId) {
  player.cards.push(cardId);
  enqueueFront(state, toOps(CARDS_BY_ID[cardId].onGain, player.id, cardId));
}

// Bỏ thẻ khỏi tay người chơi và áp dụng onLose. Trả về false nếu không có thẻ.
export function loseCard(state, player, cardId) {
  const idx = player.cards.indexOf(cardId);
  if (idx === -1) return false;
  player.cards.splice(idx, 1);
  enqueueFront(state, toOps(CARDS_BY_ID[cardId].onLose, player.id, cardId));
  return true;
}

// ---------------------------------------------------------------- ops cơ bản

const traitGroup = (choice) => {
  if (Array.isArray(choice)) return choice;
  if (choice === 'physical') return PHYSICAL;
  if (choice === 'mental') return MENTAL;
  return TRAITS;
};

registerOp('log', (state, it) => addLog(state, it.text, it.kind ?? 'info'));

registerOp('gain', (state, it) => {
  const player = state.players[it.playerId];
  if (!player?.alive) return;
  const amount = it.amount ?? 1;
  if (!it.choice) {
    shiftTrait(state, player, it.trait, amount);
    return;
  }
  const options = traitGroup(it.choice).filter((t) => player.traits[t] < MAX_INDEX);
  if (!options.length) return;
  if (options.length === 1) {
    shiftTrait(state, player, options[0], amount);
    return;
  }
  state.pending = { type: 'chooseTrait', playerId: player.id, options, amount, source: it.source ?? null };
});

// "Mất N chỉ số X": hạ trực tiếp một chỉ số cụ thể.
registerOp('lose', (state, it) => {
  const player = state.players[it.playerId];
  if (!player?.alive) return;
  shiftTrait(state, player, it.trait, -(it.amount ?? 1));
});

// Hồi phục: đưa chỉ số về mức khởi đầu nếu đang thấp hơn.
registerOp('heal', (state, it) => {
  const player = state.players[it.playerId];
  if (!player?.alive) return;
  for (const t of it.traits ?? traitGroup(it.group)) {
    const start = startIndex(player, t);
    if (player.traits[t] < start) shiftTrait(state, player, t, start - player.traits[t]);
  }
});

// Sát thương thể chất / tinh thần / tổng hợp: người chịu tự chia cho các chỉ số được phép.
registerOp('damage', (state, it) => {
  const player = state.players[it.playerId];
  if (!player?.alive) return;
  let amount = it.amount ?? 0;
  if (it.dice) {
    const r = rollDice(state, it.dice);
    setLastRoll(state, { kind: 'damage', playerId: player.id, dice: r.dice, total: r.total, label: 'Sát thương' });
    amount = r.total;
  }
  if (amount <= 0) return;

  const traits = DAMAGE_TRAITS[it.type];
  if (!traits) throw new Error(`Loại sát thương không hợp lệ: ${it.type}`);
  const capacity = damageCapacity(state, player, traits);
  const open = traits.filter((t) => capacity[t] > 0);
  const total = open.reduce((sum, t) => sum + capacity[t], 0);
  const required = Math.min(amount, total);
  addLog(state, `${player.name} chịu ${amount} sát thương ${DAMAGE_LABEL[it.type]}.`, 'damage');
  if (required === 0) {
    addLog(state, `${player.name} không thể tụt thêm nữa trước khi Haunt bắt đầu.`, 'damage');
    return;
  }
  // Chỉ có một cách chia -> áp dụng luôn, khỏi hỏi người chơi.
  if (open.length === 1) return applyAllocation(state, player, { [open[0]]: required });
  if (required === total) return applyAllocation(state, player, capacity);
  state.pending = {
    type: 'allocateDamage', playerId: player.id, damageType: it.type,
    amount: required, traits: open, capacity, source: it.source ?? null,
  };
});

// Đổ xúc xắc theo chỉ số (trait) hoặc số xúc xắc cố định (dice). Người chơi phải bấm "đổ".
// Kết quả: chọn outcomes[] theo tổng, hoặc chuyển tổng cho op tiếp theo qua `then`.
registerOp('roll', (state, it) => {
  const player = state.players[it.playerId];
  if (!player?.alive) return;
  state.pending = {
    type: 'roll', playerId: player.id,
    trait: it.trait ?? null, dice: it.dice ?? null, bonus: it.bonus ?? 0,
    label: it.label ?? 'Đổ xúc xắc', outcomes: it.outcomes ?? null, then: it.then ?? null,
    source: it.source ?? null,
  };
});

registerOp('draw', (state, it) => {
  if (!state.players[it.playerId]?.alive) return;
  drawCard(state, it.playerId, it.deck);
});

registerOp('teleport', (state, it) => {
  const player = state.players[it.playerId];
  if (!player?.alive) return;
  const key = state.board.index[it.tileId];
  if (!key) return;
  const t = state.board.tiles[key];
  player.pos = { floor: t.floor, x: t.x, y: t.y };
  addLog(state, `${player.name} bị đưa tới ${TILES_BY_ID[it.tileId].name}.`, 'move');
});

// Hỏi một người chơi chọn một phương án. Dùng cho mọi lựa chọn của kịch bản Haunt: chọn phòng,
// chọn mục tiêu, chọn cách làm lễ... it = { playerId, label, options: [{ id, label, pos?, disabled?,
// hint? }], secret?, then: { op, ... } }. Khi người chơi chọn, op `then` chạy với `choice` = id.
// secret: người khác chỉ thấy "đang chờ X quyết định", không thấy các phương án.
registerOp('choose', (state, it) => {
  const player = state.players[it.playerId];
  if (!player) return;
  const enabled = (it.options ?? []).filter((o) => !o.disabled);
  if (!enabled.length) return;
  if (enabled.length === 1 && !it.secret && !it.always) {
    enqueueFront(state, [{ ...it.then, playerId: it.playerId, choice: enabled[0].id }]);
    return;
  }
  state.pending = {
    type: 'choose', playerId: it.playerId, label: it.label ?? 'Chọn', options: it.options,
    secret: Boolean(it.secret), then: it.then, source: it.source ?? null,
  };
});

// ---------------------------------------------------------------- trả lời pending

function requirePending(state, playerId, type) {
  const p = state.pending;
  if (!p || p.type !== type) throw new GameError('Không có yêu cầu nào đang chờ loại này.');
  if (p.playerId !== playerId) throw new GameError('Không phải bạn là người cần quyết định.');
  return p;
}

export function resolveRoll(state, playerId) {
  const p = requirePending(state, playerId, 'roll');
  const player = state.players[playerId];
  const count = (p.trait ? traitValue(player, p.trait) : p.dice) + (p.bonus ?? 0);
  const r = rollDice(state, count);
  setLastRoll(state, {
    kind: p.trait ? 'trait' : 'dice', playerId, trait: p.trait, dice: r.dice, total: r.total, label: p.label,
  });
  const what = p.trait ? TRAIT_LABEL[p.trait] : `${r.dice.length} xúc xắc`;
  addLog(state, `${player.name} đổ ${what} cho «${p.label}»: [${r.dice.join(', ')}] = ${r.total}.`, 'roll');
  state.pending = null;

  if (p.then) {
    enqueueFront(state, [{ ...p.then, playerId, total: r.total, source: p.source }]);
    return;
  }
  const outcome = [...(p.outcomes ?? [])].sort((a, b) => b.min - a.min).find((o) => r.total >= o.min);
  if (!outcome) return;
  if (outcome.text) addLog(state, outcome.text, 'card');
  enqueueFront(state, toOps(outcome.effects, playerId, p.source));
}

export function applyAllocation(state, player, allocation) {
  for (const [trait, n] of Object.entries(allocation)) {
    if (n > 0) shiftTrait(state, player, trait, -n);
  }
}

export function resolveAllocateDamage(state, playerId, allocation) {
  const p = requirePending(state, playerId, 'allocateDamage');
  if (!allocation || typeof allocation !== 'object') throw new GameError('Thiếu cách chia sát thương.');
  let sum = 0;
  const clean = {};
  for (const [trait, raw] of Object.entries(allocation)) {
    if (!p.traits.includes(trait)) throw new GameError(`Không thể trừ vào ${TRAIT_LABEL[trait] ?? trait}.`);
    if (!Number.isInteger(raw) || raw < 0) throw new GameError('Số nấc phải là số nguyên không âm.');
    if (raw > p.capacity[trait]) throw new GameError(`${TRAIT_LABEL[trait]} không thể giảm nhiều như vậy.`);
    clean[trait] = raw;
    sum += raw;
  }
  if (sum !== p.amount) throw new GameError(`Phải chia đúng ${p.amount} nấc sát thương.`);
  state.pending = null;
  applyAllocation(state, state.players[playerId], clean);
}

export function resolveChooseTrait(state, playerId, trait) {
  const p = requirePending(state, playerId, 'chooseTrait');
  if (!p.options.includes(trait)) throw new GameError('Chỉ số không nằm trong lựa chọn.');
  state.pending = null;
  shiftTrait(state, state.players[playerId], trait, p.amount);
}

export function resolveChoose(state, playerId, optionId) {
  const p = requirePending(state, playerId, 'choose');
  const option = p.options.find((o) => o.id === optionId);
  if (!option || option.disabled) throw new GameError('Lựa chọn không hợp lệ.');
  state.pending = null;
  enqueueFront(state, [{ ...p.then, playerId, choice: optionId }]);
}

// Liệt kê mọi cách chia sát thương hợp lệ (dùng cho legalActions / bot / gợi ý UI).
export function enumerateAllocations(traits, capacity, amount) {
  const out = [];
  const walk = (i, left, acc) => {
    if (i === traits.length) {
      if (left === 0) out.push({ ...acc });
      return;
    }
    const t = traits[i];
    for (let n = 0; n <= Math.min(left, capacity[t]); n++) {
      acc[t] = n;
      walk(i + 1, left - n, acc);
    }
    delete acc[t];
  };
  walk(0, amount, {});
  return out;
}
