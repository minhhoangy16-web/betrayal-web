// HAUNT «Đám cưới ma» – Bà mối (Kẻ phản bội, người lật Haunt) đưa đoàn rước dâu âm phủ tới đón một người sống sót
// làm cô dâu. Cuối mỗi vòng cô dâu bị kéo dần về phía Chú rể ma; cả nhóm phải hộ tống cô và xé hết thiệp cưới.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import { rollDice } from '../engine/dice.js';
import { traitValue } from '../engine/traits.js';
import {
  playersInPlay, tileDefAt, spawnMonster, rollOp, distances, stepToward, rooms, addToken, tokensOf, removeToken,
  dropTokens, tokenActions, handleTokenAction, tokenDisplay, mergeMarks, wallSteps,
} from './helpers.js';

const TEAR_TARGET = 5;
const PULL_SAFE = 4;
const PULL_FAR = 2;
const ROUNDS = 9;
const GROOM = { id: 'chu-re-ma', type: 'chu-re-ma', name: 'Chú rể ma', traits: { might: 5, speed: 2, sanity: 5, knowledge: 3 } };
const DRUMMER = { type: 'ken-trong', name: 'Ma kèn trống', traits: { might: 3, speed: 3, sanity: 3, knowledge: 2 } };

const data = (state) => state.haunt.data;
const heroes = (state) => playersInPlay(state).filter((p) => p.alive && p.side === 'hero');
const groom = (state) => state.monsters[GROOM.id];
const bride = (state) => state.players[data(state).bride];
const cardsNeeded = (state) => (state.turnOrder.length >= 5 ? 5 : 4);
const roundsLeft = (state) => Math.max(0, data(state).startRound + ROUNDS - state.round);

function chooseBride(state) {
  const list = heroes(state);
  if (!list.length) return null;
  return list.reduce((b, p) => (traitValue(p, 'sanity') < traitValue(b, 'sanity') ? p : b)).id;
}

registerOp('damcuoi:tear', (state, it) => {
  const d = data(state);
  const me = state.players[it.playerId];
  if (it.total >= TEAR_TARGET && d.torn < cardsNeeded(state)) {
    d.torn += 1;
    addLog(state, `🧧 ${me.name} tìm thấy và xé nát một tấm thiệp cưới đỏ (${d.torn}/${cardsNeeded(state)}).`, 'haunt');
  } else {
    addLog(state, `${me.name} lục khắp phòng mà không thấy tấm thiệp nào.`, 'haunt');
  }
});

// Cuối vòng: cô dâu bị kéo về phía Chú rể ma.
registerOp('damcuoi:pull', (state) => {
  const d = data(state);
  const b = bride(state);
  const g = groom(state);
  if (!b?.alive || !g || state.winner) return;
  const escorts = heroes(state).filter((p) => p.id !== b.id && samePos(p.pos, b.pos)).length;
  const r = rollDice(state, traitValue(b, 'sanity') + escorts);
  const steps = r.total < PULL_FAR ? 2 : r.total < PULL_SAFE ? 1 : 0;
  addLog(state, `🎺 Tiếng kèn rước dâu vang lên. ${b.name} cố cưỡng lại (${r.total}${escorts ? `, ${escorts} người hộ tống` : ''}).`, 'haunt');
  for (let i = 0; i < steps; i++) {
    if (samePos(b.pos, g.pos)) break;
    const step = stepToward(state, b.pos, g.pos);
    if (!step) break;
    b.pos = step.pos;
  }
  if (steps) addLog(state, `${b.name} bị kéo đi ${steps} bước về phía Chú rể ma.`, 'haunt');
  if (samePos(b.pos, g.pos)) {
    d.married = true;
    addLog(state, `💒 ${b.name} đứng cạnh Chú rể ma khi tiếng kèn dứt. Lễ rước dâu đã xong.`, 'haunt');
  }
});

function specials(state, me) {
  if (!me.alive || me.side !== 'hero') return [];
  const d = data(state);
  const out = [];
  const key = posKey(me.pos);
  const def = tileDefAt(state, me.pos);
  if (!state.turn.usedSpecial && (def.symbol === 'event' || def.symbol === 'omen') && !d.searched.includes(key) && d.torn < cardsNeeded(state)) {
    out.push({ type: 'special', actionId: 'tear', label: `Xé thiệp cưới (đổ Tri thức, cần ${TEAR_TARGET}+)` });
  }
  if (def.id === 'kitchen' && !tokensOf(state, me.id).some((t) => t.kind === 'rice')) {
    out.push({ type: 'special', actionId: 'rice', label: 'Lấy một nắm Gạo muối' });
  }
  const g = groom(state);
  if (g && !g.stunned && !state.turn.hasAttacked && tokensOf(state, me.id).some((t) => t.kind === 'rice')) {
    const near = samePos(g.pos, me.pos) || wallSteps(state, me.pos).some((s) => samePos(s.pos, g.pos));
    if (near) out.push({ type: 'special', actionId: 'throw', label: 'Ném gạo vào Chú rể ma (thay cho tấn công)' });
  }
  out.push(...tokenActions(state, me.id));
  return out;
}

export default {
  id: 'haunt-dam-cuoi-ma',
  name: 'Đám cưới ma',
  traitor: { rule: 'revealer' },

  publicIntro:
    'Nửa đêm có tiếng kèn đám cưới từ dưới hầm vọng lên, mà không có ai thổi. Một đoàn người mặc áo đỏ, mặt trắng bệch ' +
    'đứng chờ dọc hành lang. Bà mối cười rất tươi: «Cô dâu đâu rồi? Giờ lành sắp qua.»',

  monsterCards: [
    { name: GROOM.name, controller: 'Kẻ phản bội', traits: GROOM.traits, rules: [
      'Không chết: thua trận thì bị choáng một lượt.',
      'Bị Gạo muối ném trúng thì choáng ngay, không cần đổ.',
    ] },
    { name: DRUMMER.name, controller: 'Kẻ phản bội', traits: DRUMMER.traits, rules: ['Thua trận thì bị choáng một lượt.'] },
  ],

  traitorTome: {
    title: 'Sách Kẻ phản bội – Đám cưới ma',
    intro:
      'Bạn đã nhận trầu cau của nhà trai dưới âm phủ. Lời hứa với người chết thì không rút lại được. ' +
      'Đêm nay phải đưa được cô dâu về nhà chồng.',
    setup: [
      'Nhân vật của bạn vẫn ở trong game: bạn là Bà mối.',
      'Cô dâu là người sống sót có Tinh thần thấp nhất. Cô dâu chết thì người có Tinh thần thấp nhất tiếp theo thành cô dâu.',
      'Chú rể ma và 2 Ma kèn trống xuất hiện ở phòng xa cô dâu nhất. Bạn điều khiển chúng sau phần đi của mình.',
    ],
    objective: 'Bạn thắng khi cuối một vòng, cô dâu đứng cùng phòng với Chú rể ma, hoặc khi đã có 2 cô dâu chết, hoặc khi mọi người sống sót đều chết.',
    lose: [`Người sống sót xé đủ thiệp cưới (4 tấm, 5 tấm nếu bàn từ 5 người), hoặc cầm cự qua ${ROUNDS} vòng.`],
    tokens: ['Chú rể ma', 'Ma kèn trống', 'Thiệp cưới'],
    rules: [{ title: 'Cuối mỗi vòng: rước dâu', text: `Cô dâu đổ Tinh thần, cộng 1 xúc xắc cho mỗi người sống sót cùng phòng. Dưới ${PULL_SAFE}: bị kéo 1 bước về phía Chú rể ma; dưới ${PULL_FAR}: 2 bước.` }],
    tips: ['Tách người hộ tống khỏi cô dâu, rồi đưa Chú rể ma lại gần.'],
    ifWin: 'Kèn trống nổi lên rộn rã. Đoàn rước dâu đi xuyên qua bức tường, cô dâu ngồi trong kiệu hoa, mặt trắng như giấy. Bà mối đếm lại tiền dẫn cưới, rất hài lòng.',
  },

  survivalSecrets: {
    title: 'Sách Người sống sót – Đám cưới ma',
    intro:
      'Ai đó trong nhà đã nhận lễ hỏi của người chết. Giờ nhà trai tới đón dâu, và cô dâu là một trong các bạn. ' +
      'Xé hết thiệp cưới thì hôn ước bị huỷ. Không thì cứ giữ cô dâu thật chặt cho tới khi gà gáy.',
    setup: [
      'Kẻ phản bội là người lật Haunt (Bà mối).',
      'Cô dâu là người sống sót có Tinh thần thấp nhất (ghi trên bảng tình hình).',
    ],
    objective: `Các bạn thắng khi xé đủ thiệp cưới (4 tấm, 5 tấm nếu bàn từ 5 người), hoặc cầm cự qua ${ROUNDS} vòng.`,
    lose: ['Cuối một vòng, cô dâu đứng cùng phòng với Chú rể ma.', 'Đã có 2 cô dâu chết, hoặc mọi người sống sót đều chết.'],
    tokens: ['Thiệp cưới', 'Gạo muối'],
    actions: [
      {
        name: 'Xé thiệp cưới', when: 'Mỗi lượt một lần, bạn có thể',
        text: 'Đứng ở phòng có biểu tượng Sự kiện hoặc Điềm báo (mỗi phòng một lần): đổ Tri thức.',
        outcomes: [[`${TEAR_TARGET}+`, 'Tìm và xé một tấm thiệp cưới.'], [`0–${TEAR_TARGET - 1}`, 'Không có gì; phòng này đã lục xong.']],
      },
      { name: 'Lấy gạo muối', when: 'Bất cứ lúc nào trong lượt, bạn có thể', text: 'Đứng ở Nhà bếp: lấy một nắm Gạo muối (mỗi người giữ tối đa một nắm).' },
      { name: 'Ném gạo', when: 'Thay cho tấn công, bạn có thể', text: 'Bỏ nắm Gạo muối: Chú rể ma ở cùng phòng hoặc phòng kề cạnh bị choáng ngay.' },
    ],
    rules: [{ title: 'Cuối mỗi vòng: rước dâu', text: `Cô dâu đổ Tinh thần, cộng 1 xúc xắc cho mỗi người sống sót đứng cùng phòng cô dâu. Dưới ${PULL_SAFE} thì bị kéo 1 bước về phía Chú rể ma; dưới ${PULL_FAR} thì 2 bước.` }],
    tips: ['Luôn có người đứng cạnh cô dâu; những người còn lại đi xé thiệp.'],
    ifWin: 'Tấm thiệp cuối cùng rách đôi. Tiếng kèn tắt ngang giữa chừng, đoàn rước dâu tan thành khói. Cô dâu ngồi bệt xuống sàn, cởi chiếc khăn voan đỏ không biết từ đâu ra.',
  },

  setup(state) {
    const n = state.turnOrder.length;
    state.haunt.data = { bride: null, brideDeaths: 0, torn: 0, searched: [], married: false, startRound: state.round, rice: 0, tokens: {} };
    const d = data(state);
    d.bride = chooseBride(state);
    const b = bride(state);
    const dist = distances(state, b.pos);
    const far = rooms(state).reduce((best, k) => ((dist.get(k) ?? -1) > (dist.get(best) ?? -1) ? k : best), posKey(b.pos));
    spawnMonster(state, GROOM, far);
    for (let i = 1; i <= 2; i++) spawnMonster(state, { ...DRUMMER, id: `ken-trong-${i}`, name: `${DRUMMER.name} ${i}` }, far);
    addLog(state, `👰 ${b.name} được chọn làm cô dâu. Đoàn rước dâu âm phủ đứng chờ ở phòng xa nhất. Có ${cardsNeeded(state)} tấm thiệp cưới giấu trong nhà.`, 'haunt');
  },

  onRoundEnd(state) {
    if (!state.winner) enqueueFront(state, [{ op: 'damcuoi:pull' }]);
  },

  onPlayerDeath(state, player) {
    const d = data(state);
    dropTokens(state, player);
    if (player.id === d.bride) {
      d.brideDeaths += 1;
      d.bride = chooseBride(state);
      if (d.bride && d.brideDeaths < 2) addLog(state, `👰 ${bride(state).name} trở thành cô dâu mới.`, 'haunt');
    }
  },

  specialActions(state, playerId) {
    return specials(state, state.players[playerId]);
  },

  performSpecial(state, playerId, action) {
    if (handleTokenAction(state, playerId, action)) return;
    const me = state.players[playerId];
    if (!specials(state, me).some((a) => a.actionId === action.actionId)) throw new GameError('Không thể làm vậy lúc này.');
    const d = data(state);
    if (action.actionId === 'tear') {
      state.turn.usedSpecial = true;
      d.searched.push(posKey(me.pos));
      enqueueFront(state, [rollOp(playerId, 'knowledge', 'Xé thiệp cưới', { op: 'damcuoi:tear' })]);
    } else if (action.actionId === 'rice') {
      d.rice += 1;
      addToken(state, { id: `gao-${d.rice}`, kind: 'rice', label: 'Gạo muối', holder: me.id });
      addLog(state, `${me.name} vốc một nắm gạo muối.`, 'haunt');
    } else {
      state.turn.hasAttacked = true;
      removeToken(state, tokensOf(state, me.id).find((t) => t.kind === 'rice').id);
      groom(state).stunned = true;
      addLog(state, `🌾 ${me.name} ném gạo muối. Chú rể ma rú lên, đứng chết trân.`, 'haunt');
    }
  },

  botTargets(state, me) {
    if (me.side !== 'hero') return heroes(state).filter((p) => p.id !== data(state).bride).map((p) => posKey(p.pos));
    const b = bride(state);
    if (b && me.id !== b.id && !heroes(state).some((p) => p.id !== b.id && samePos(p.pos, b.pos))) return [posKey(b.pos)];
    return null;
  },

  publicData(state) {
    const d = data(state);
    const tokens = tokenDisplay(state);
    const b = bride(state);
    const marks = {};
    for (const k of d.searched) (marks[k] ??= []).push({ kind: 'dug', label: 'Đã lục tìm thiệp' });
    return {
      meters: [
        { id: 'torn', label: 'Thiệp cưới đã xé', value: d.torn, max: cardsNeeded(state), tone: 'good' },
        { id: 'dawn', label: 'Số vòng đã cầm cự', value: ROUNDS - roundsLeft(state), max: ROUNDS, tone: 'neutral' },
      ],
      notes: [b ? `Cô dâu: ${b.name}.` : 'Không còn cô dâu.', `Cô dâu đã chết: ${d.brideDeaths}/2.`],
      marks: mergeMarks(marks, tokens.marks),
      carried: tokens.carried,
    };
  },

  checkVictory(state) {
    const d = data(state);
    if (d.married) return { side: 'traitor', reason: 'Đoàn rước dâu đã đón được cô dâu.' };
    if (d.brideDeaths >= 2 || !heroes(state).length) return { side: 'traitor', reason: 'Đám cưới vẫn diễn ra, dù cô dâu không còn sống.' };
    if (d.torn >= cardsNeeded(state)) return { side: 'heroes', reason: 'Mọi tấm thiệp cưới đã bị xé, hôn ước bị huỷ.' };
    if (roundsLeft(state) === 0) return { side: 'heroes', reason: 'Gà gáy, đoàn rước dâu phải quay về.' };
    return null;
  },
};
