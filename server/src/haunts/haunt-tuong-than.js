// HAUNT «Tượng thần tranh đoạt» – ai cũng là địch (free-for-all), người cuối cùng còn sống thắng.
// Người cầm Tượng thần cộng giá trị thanh đếm vào đòn Sức mạnh; mỗi lần giết được người khác khi đang cầm
// tượng, thanh đếm tăng 1. Đánh thắng người cầm tượng thì có thể cướp tượng thay vì gây sát thương.

import { addLog } from '../engine/log.js';
import { posKey } from '../engine/board.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront, loseCard } from '../engine/effects.js';
import { CARDS_BY_ID } from '../data/index.js';
import {
  playersInPlay, tileDefAt, rollOp, chooseOp, addToken, tokensOf, giveTokenTo, dropTokens, tokenActions, handleTokenAction,
  tokenDisplay,
} from './helpers.js';

const SEARCH_TARGET = 5;
const IDOL_ID = 'tuong-than';

const data = (state) => state.haunt.data;
const alive = (state) => playersInPlay(state).filter((p) => p.alive);
const idolHolder = (state) => data(state).tokens?.[IDOL_ID]?.holder ?? null;
const physical = (trait) => (trait === 'might' || trait === 'speed' ? 'physical' : 'mental');

registerOp('tuongthan:search', (state, it) => {
  const me = state.players[it.playerId];
  if (it.total >= SEARCH_TARGET) {
    addLog(state, `${me.name} lục được một món đồ trên kệ.`, 'haunt');
    enqueueFront(state, [{ op: 'draw', deck: 'item', playerId: me.id }]);
  } else {
    addLog(state, `${me.name} lục tung các kệ mà chẳng thấy gì dùng được.`, 'haunt');
  }
});

registerOp('tuongthan:spoils', (state, it) => {
  const winner = state.players[it.playerId];
  const loser = state.players[it.loserId];
  if (it.choice === 'steal' && idolHolder(state) === loser.id) {
    giveTokenTo(state, IDOL_ID, winner.id);
    addLog(state, `🗿 ${winner.name} giật được Tượng thần khỏi tay ${loser.name}!`, 'haunt');
    return;
  }
  enqueueFront(state, [{ op: 'damage', type: it.damageType, amount: it.amount, playerId: loser.id, source: 'combat' }]);
});

function specials(state, me) {
  if (!me.alive) return [];
  const d = data(state);
  const out = [];
  if (!state.turn.usedSpecial && tileDefAt(state, me.pos).symbol === 'item') {
    out.push({ type: 'special', actionId: 'search', label: `Lục kệ (đổ Tri thức, cần ${SEARCH_TARGET}+)` });
  }
  // Liều mạng: vứt bỏ Vật phẩm để +1 cho đòn Sức mạnh trong lượt này.
  if (!state.turn.hasAttacked) {
    for (const cardId of me.cards) {
      if (CARDS_BY_ID[cardId]?.type !== 'item') continue;
      out.push({ type: 'special', actionId: 'sacrifice', cardId, label: `Vứt bỏ ${CARDS_BY_ID[cardId].name}: +1 cho đòn Sức mạnh lượt này (đang +${d.rage[me.id] ?? 0})` });
    }
  }
  out.push(...tokenActions(state, me.id, { canGive: false }));
  return out;
}

export default {
  id: 'haunt-tuong-than',
  name: 'Tượng thần tranh đoạt',
  mode: 'solo',
  playerSide: 'solo',
  freeForAll: true,
  traitor: { rule: 'none' },
  traitorLabel: 'Không có (ai cũng là địch)',

  publicIntro:
    'Đêm giao thừa. Tấm ảnh chụp chung cả nhóm nằm gọn trong khe của một bức tượng thần cũ. Nhìn những nụ cười gượng ' +
    'trong ảnh, bạn chợt nghĩ bức tượng sẽ đẹp hơn nhiều nếu được nhuộm đỏ.',

  traitorTome: null,

  survivalSecrets: {
    title: 'Sách chung – Tượng thần tranh đoạt',
    intro:
      'Càng gần giao thừa, các bạn càng thấy mình đã xa nhau tới mức nào. Tấm ảnh chụp chung trượt vào khe bức tượng thần ' +
      'như được đo sẵn. Từ lúc đó, ai cũng nhìn những người còn lại bằng ánh mắt khác. Chỉ một người được đón năm mới.',
    setup: [
      'Không có Kẻ phản bội và không có phe: ai cũng là địch của ai, ai cũng chặn đường người khác.',
      'Người lật Haunt đang cầm Tượng thần. Thanh đếm bắt đầu ở 1.',
    ],
    objective: 'Bạn thắng khi là người cuối cùng còn sống.',
    lose: ['Bạn chết. Nếu những người cuối cùng chết cùng lúc thì không ai thắng.'],
    tokens: ['Tượng thần (một tượng)', 'Thanh đếm'],
    actions: [
      {
        name: 'Lục kệ', when: 'Mỗi lượt một lần, bạn có thể',
        text: 'Đứng ở phòng có biểu tượng Vật phẩm: đổ Tri thức.',
        outcomes: [[`${SEARCH_TARGET}+`, 'Rút một thẻ Vật phẩm.'], [`0–${SEARCH_TARGET - 1}`, 'Không có gì.']],
      },
      {
        name: 'Liều mạng', when: 'Trước khi tấn công trong lượt, bạn có thể',
        text: 'Vứt bỏ hẳn bao nhiêu Vật phẩm tuỳ ý. Mỗi món vứt đi cộng 1 vào kết quả đòn Sức mạnh của bạn trong lượt này.',
      },
    ],
    rules: [
      { title: 'Khi bạn tấn công bằng Sức mạnh', text: 'Nếu đang cầm Tượng thần, cộng giá trị thanh đếm vào kết quả.' },
      { title: 'Khi bạn giết một người', text: 'Nếu đang cầm Tượng thần, thanh đếm tăng 1. Trong ảnh bớt đi một khuôn mặt.' },
      { title: 'Khi bạn đánh người cầm Tượng thần bằng Sức mạnh', text: 'Thắng thì được chọn cướp Tượng thần thay vì gây sát thương.' },
      { title: 'Khi người cầm tượng chết', text: 'Tượng rơi tại chỗ, ai đến cũng nhặt được.' },
    ],
    tips: ['Thanh đếm càng cao thì người cầm tượng càng nguy hiểm: hãy cướp tượng sớm.'],
    ifWin:
      'Chuông giao thừa vang lên. Bạn bước qua những gì còn lại của buổi tiệc, nhặt bức tượng lên. Tấm ảnh trong khe đã đổi: ' +
      'giờ chỉ còn mình bạn, cười rất tươi.',
    ifLose:
      'Pháo hoa nổ ngoài trời mà không ai trong nhà còn đứng dậy được. Bức tượng thần nằm lăn giữa sàn, tấm ảnh trong khe trống trơn.',
  },

  setup(state) {
    state.haunt.data = { track: 1, rage: {}, lastHit: null, tokens: {} };
    addToken(state, { id: IDOL_ID, kind: 'idol', label: 'Tượng thần', holder: state.haunt.revealerId });
    addLog(state, `🗿 ${state.players[state.haunt.revealerId].name} đang cầm Tượng thần. Từ giờ ai cũng là kẻ thù của nhau.`, 'haunt');
  },

  areEnemies(state, a, b) {
    return a.id !== b.id;
  },

  onTurnStart(state) {
    data(state).rage = {};
  },

  attackResultBonus(state, attacker, target, trait) {
    if (attacker.kind !== 'player' || trait !== 'might') return 0;
    const d = data(state);
    return (idolHolder(state) === attacker.id ? d.track : 0) + (d.rage[attacker.id] ?? 0);
  },

  onCombatWin(state, winner, loser) {
    if (winner.kind === 'player' && loser.kind === 'player') data(state).lastHit = { winner: winner.id, loser: loser.id };
  },

  // Đánh thắng người cầm Tượng thần bằng Sức mạnh: chọn cướp tượng hoặc gây sát thương.
  onCombatLoss(state, loser, amount, trait, winner) {
    if (loser.kind !== 'player' || winner?.kind !== 'player' || trait !== 'might' || idolHolder(state) !== loser.id) return undefined;
    enqueueFront(state, [chooseOp(winner.id, `Bạn thắng ${state.players[loser.id].name}. Làm gì?`, [
      { id: 'steal', label: 'Cướp Tượng thần' },
      { id: 'hurt', label: `Gây ${amount} sát thương` },
    ], { op: 'tuongthan:spoils', loserId: loser.id, amount, damageType: physical(trait) }, { always: true })]);
    return true;
  },

  onPlayerDeath(state, player) {
    const d = data(state);
    const killer = d.lastHit?.loser === player.id ? d.lastHit.winner : null;
    if (killer && idolHolder(state) === killer) {
      d.track += 1;
      addLog(state, `🗿 Tượng thần no máu thêm một chút. Thanh đếm: ${d.track}.`, 'haunt');
    }
    dropTokens(state, player);
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    if (handleTokenAction(state, playerId, action)) return;
    const me = state.players[playerId];
    const option = specials(state, me).find((a) => a.actionId === action.actionId && (a.cardId ?? null) === (action.cardId ?? null));
    if (!option) throw new GameError('Không thể làm vậy lúc này.');
    if (action.actionId === 'search') {
      state.turn.usedSpecial = true;
      enqueueFront(state, [rollOp(playerId, 'knowledge', 'Lục kệ', { op: 'tuongthan:search' })]);
    } else if (action.actionId === 'sacrifice') {
      const d = data(state);
      loseCard(state, me, action.cardId);
      d.rage[me.id] = (d.rage[me.id] ?? 0) + 1;
      addLog(state, `${me.name} vứt bỏ ${CARDS_BY_ID[action.cardId].name}, lấy đà cho cú đánh tới (+${d.rage[me.id]}).`, 'haunt');
    }
  },

  // Bot đo cân bằng: đi tìm người khác mà đánh (ưu tiên người cầm tượng).
  botTargets(state, me) {
    const holder = idolHolder(state);
    const others = alive(state).filter((p) => p.id !== me.id);
    const pick = holder && holder !== me.id ? others.filter((p) => p.id === holder) : others;
    return pick.map((p) => posKey(p.pos));
  },

  publicData(state) {
    const d = data(state);
    const tokens = tokenDisplay(state);
    const holder = idolHolder(state);
    return {
      meters: [{ id: 'track', label: 'Thanh đếm (cộng vào đòn Sức mạnh của người cầm tượng)', value: d.track, max: 8, tone: 'bad' }],
      notes: [holder ? `${state.players[holder].name} đang cầm Tượng thần.` : 'Tượng thần đang nằm trên sàn.', `Còn ${alive(state).length} người sống.`],
      marks: tokens.marks,
      carried: tokens.carried,
    };
  },

  checkVictory(state) {
    const left = alive(state);
    if (left.length === 1) return { side: 'players', playerIds: [left[0].id], reason: `${left[0].name} là người cuối cùng còn đứng vững.` };
    if (!left.length) return { side: 'house', reason: 'Không ai sống tới giao thừa.' };
    return null;
  },
};
