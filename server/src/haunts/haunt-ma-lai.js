// HAUNT «Ma lai» – đầu bay xuyên tường săn người; thân xác giấu kín là điểm yếu.
// Vị trí thân xác (chính là quân cờ của Kẻ phản bội) bị giấu khỏi view của người khác cho tới khi bị tìm ra.

import { posKey, samePos } from '../engine/board.js';
import { addLog } from '../engine/log.js';
import { GameError } from '../engine/errors.js';
import { registerOp, enqueueFront } from '../engine/effects.js';
import {
  aliveHeroes, spawnMonster, tileDefAt, roomName, rooms, posOf, distances, wallSteps, roomOption, chooseOp, rollOp,
  addToken, tokensOf, removeToken, dropTokens, tokenActions, handleTokenAction, tokenDisplay, mergeMarks,
} from './helpers.js';

const ROUNDS_TO_DAWN = 9;
const MIN_BODY_DISTANCE = 3;
const TRACK_TARGET = 3;
const FLIP_TARGET = 5;
const ASH_BAGS = 3;
const MAX_MIGHT = 7;
const ASH_ROOMS = ['kitchen', 'furnace-room'];
const FORBIDDEN = ['entrance-hall', 'foyer', 'grand-staircase', 'upper-landing', 'basement-landing'];
const HEAD = { id: 'malai-head', type: 'ma-lai', name: 'Đầu ma lai', traits: { speed: 6, might: 4, sanity: 5 } };

const data = (state) => state.haunt.data;
const head = (state) => state.monsters[HEAD.id];
const isTraitor = (state, player) => player.id === state.haunt.traitorId;
const deadHeroes = (state) => Object.values(state.players).filter((p) => p.side === 'hero' && !p.alive).length;
const roundsLeft = (state) => Math.max(0, data(state).dawnRound - state.round);

// Phòng giấu thân xác: cách mọi người sống sót ít nhất 3 phòng; không có thì lấy các phòng xa nhất.
function bodyRooms(state) {
  const heroes = aliveHeroes(state);
  const maps = heroes.map((h) => distances(state, h.pos));
  const candidates = rooms(state, (pos, def) => !FORBIDDEN.includes(def.id)).map((key) => ({
    key, d: Math.min(...maps.map((m) => m.get(key) ?? 99)),
  }));
  const far = candidates.filter((c) => c.d >= MIN_BODY_DISTANCE);
  if (far.length) return far.map((c) => c.key);
  const best = Math.max(...candidates.map((c) => c.d));
  return candidates.filter((c) => c.d === best).map((c) => c.key);
}

registerOp('malai:hide', (state, it) => {
  const traitor = state.players[state.haunt.traitorId];
  data(state).body = it.choice;
  traitor.pos = posOf(state, it.choice);
  addLog(state, `Bạn giấu thân xác ở ${roomName(state, traitor.pos)}.`, 'haunt', traitor.id);
  addLog(state, 'Thân xác của ma lai đã được giấu ở đâu đó trong nhà.', 'haunt');
});

registerOp('malai:track', (state, it) => {
  const me = state.players[it.playerId];
  const d = data(state);
  if (it.total < TRACK_TARGET) {
    addLog(state, `${me.name} mất dấu vệt máu.`, 'haunt');
    return;
  }
  const body = posOf(state, d.body);
  if (body.floor !== me.pos.floor) {
    addLog(state, `🩸 ${me.name} lần theo vệt máu: thân xác không ở tầng này.`, 'haunt');
    return;
  }
  const dist = distances(state, me.pos).get(d.body);
  addLog(state, dist === undefined
    ? `🩸 ${me.name} lần theo vệt máu: thân xác ở tầng này nhưng chưa có lối đi tới.`
    : `🩸 ${me.name} lần theo vệt máu: thân xác ở tầng này, cách ${dist} phòng.`, 'haunt');
});

registerOp('malai:flip', (state, it) => {
  const me = state.players[it.playerId];
  if (it.total >= FLIP_TARGET) {
    data(state).flipped = true;
    addLog(state, `🙃 ${me.name} úp ngược thân xác! Cái đầu không còn chỗ để về.`, 'haunt');
  } else {
    addLog(state, `${me.name} không lật nổi thân xác lạnh ngắt.`, 'haunt');
  }
});

function heroActions(state, me) {
  const d = data(state);
  const out = [];
  const key = posKey(me.pos);
  const def = tileDefAt(state, me.pos);
  if (!state.turn.usedSpecial) {
    if (!d.found && !state.turn.hasAttacked) {
      out.push({ type: 'special', actionId: 'track', label: `Lần theo vệt máu (đổ Tri thức, cần ${TRACK_TARGET}+)` });
    }
    if (d.found && key === d.body) {
      out.push({ type: 'special', actionId: 'flip', label: `Úp ngược thân xác (đổ Sức mạnh, cần ${FLIP_TARGET}+)` });
    }
    if (ASH_ROOMS.includes(def.id) && d.ashLeft > 0) out.push({ type: 'special', actionId: 'ash', label: `Nhặt tro bếp (còn ${d.ashLeft} túi)` });
    if (tokensOf(state, me.id).some((t) => t.kind === 'ash') && !d.ashRooms.includes(key)) {
      out.push({ type: 'special', actionId: 'spread', label: 'Rắc tro ở phòng này' });
    }
  }
  out.push(...tokenActions(state, me.id));
  return out;
}

export default {
  id: 'haunt-ma-lai',
  name: 'Ma lai',
  mode: 'traitor',
  traitor: { rule: 'revealer' },

  publicIntro:
    'Một người trong các bạn gục xuống rồi biến mất vào bóng tối. Một lúc sau, ở chỗ họ vừa đứng, một cái đầu người ' +
    'lơ lửng hiện ra, mắt sáng xanh, lủng lẳng phía dưới là một mớ ruột gan.',

  traitorTome: {
    title: "Traitor's Tome – Ma lai",
    story: 'Cơn đói đêm nay không chịu đợi được nữa. Bạn đã giấu thân xác thật kỹ; hãy ăn cho no rồi quay về trước khi gà gáy.',
    objective: 'Lúc trời sáng, Đầu ma lai đang ở cùng phòng với Thân xác và đã có ít nhất một nửa số người sống sót chết (làm tròn xuống, tối thiểu 1). Hoặc mọi người sống sót chết trước đó.',
    rules: [
      `Khi Haunt bắt đầu, bạn bí mật chọn phòng giấu Thân xác: cách mọi người sống sót ít nhất ${MIN_BODY_DISTANCE} phòng. Trời sáng sau ${ROUNDS_TO_DAWN} vòng.`,
      'Bạn không tự đi lại nữa. Bạn điều khiển Đầu ma lai (Tốc độ 6, Sức mạnh 4, Tinh thần 5) trong lượt quái vật.',
      'Đầu ma lai bay được sang phòng kề cạnh cùng tầng dù không có cửa, và đi cầu thang như thường. Nó không vào được phòng đã rắc tro.',
      `Mỗi lần Đầu ma lai thắng một trận, Sức mạnh của nó tăng 1 (tối đa ${MAX_MIGHT}). Bị choáng thì đứng yên một lượt quái vật.`,
      'Chỉ bạn thấy Thân xác trên bàn cờ, cho tới khi có người tìm ra nó. Bay về canh xác sớm là tự chỉ đường cho cả bàn.',
    ],
  },

  survivalSecrets: {
    title: 'Secrets of Survival – Ma lai',
    story: 'Một người bạn đã thành ma lai. Thân xác của nó nằm đâu đó trong nhà, trống rỗng và đang chờ cái đầu quay về. Vệt máu kéo dài trên sàn sẽ dẫn bạn tới nó.',
    objective: 'Úp ngược Thân xác; hoặc cầm cự tới lúc trời sáng mà Đầu ma lai chưa về, hay chưa đủ số người chết.',
    rules: [
      `«Lần theo vệt máu» (mỗi lượt một lần, thay cho tấn công): đổ Tri thức ${TRACK_TARGET}+. Game cho biết Thân xác có ở cùng tầng với bạn không, và nếu có thì còn cách bao nhiêu phòng theo đường đi.`,
      'Bước vào đúng phòng có Thân xác thì tự phát hiện, không cần đổ. Từ đó Thân xác hiện trên bàn cờ cho mọi người.',
      `«Úp ngược thân xác» (mỗi lượt một lần): ở phòng có Thân xác, đổ Sức mạnh ${FLIP_TARGET}+, cộng 1 xúc xắc cho mỗi người sống sót khác cùng phòng. Thành công là thắng ngay.`,
      `«Nhặt tro bếp» ở Nhà bếp hoặc Phòng lò (cả ván có ${ASH_BAGS} túi). «Rắc tro» tại phòng đang đứng: Đầu ma lai không bao giờ vào được phòng đó nữa.`,
      'Đánh Đầu ma lai bằng Sức mạnh, thắng thì nó choáng. Thân xác không bị tấn công.',
    ],
  },

  setup(state) {
    const traitor = state.players[state.haunt.traitorId];
    const heroes = aliveHeroes(state).length;
    spawnMonster(state, HEAD, traitor.pos);
    state.haunt.data = {
      body: posKey(traitor.pos), found: false, flipped: false, dawn: false,
      dawnRound: state.round + ROUNDS_TO_DAWN, ashLeft: ASH_BAGS, ashRooms: [], bags: 0,
      deathsNeeded: Math.max(1, Math.floor(heroes / 2)),
    };
    enqueueFront(state, [chooseOp(traitor.id, 'Giấu thân xác ở phòng nào?', bodyRooms(state).map((k) => roomOption(state, k)),
      { op: 'malai:hide' }, { secret: true })]);
  },

  skipExplorer(state, playerId) {
    return playerId === state.haunt.traitorId;
  },

  monsterSteps(state, monster) {
    return monster.id === HEAD.id ? wallSteps(state, monster.pos) : undefined;
  },

  canMonsterEnter(state, monster, pos) {
    return !data(state).ashRooms.includes(posKey(pos));
  },

  // Thân xác không tính là đối thủ (không cản đường, không bị đánh, không lộ vị trí).
  areEnemies(state, a, b) {
    if (isTraitor(state, a) || isTraitor(state, b)) return false;
    return a.side !== b.side;
  },

  canBeAttacked(state, ref) {
    return !(ref.kind === 'player' && ref.id === state.haunt.traitorId);
  },

  onCombatWin(state, winner) {
    if (winner.kind === 'monster' && winner.id === HEAD.id) {
      const h = head(state);
      if (h.traits.might < MAX_MIGHT) {
        h.traits.might += 1;
        addLog(state, `Đầu ma lai hút máu, Sức mạnh tăng lên ${h.traits.might}.`, 'haunt');
      }
    }
  },

  onPlayerEnter(state, player, pos) {
    const d = data(state);
    if (!d.found && player.side === 'hero' && posKey(pos) === d.body) {
      d.found = true;
      addLog(state, `🕯 ${player.name} vấp phải một thân người không đầu ở ${roomName(state, pos)} – thân xác của ma lai!`, 'haunt');
    }
  },

  onPlayerDeath(state, player) {
    dropTokens(state, player);
  },

  onRoundEnd(state) {
    const d = data(state);
    if (state.round >= d.dawnRound) d.dawn = true;
    else if (roundsLeft(state) <= 2) addLog(state, `🐓 Còn ${roundsLeft(state)} vòng nữa là gà gáy.`, 'haunt');
  },

  specialActions(state, playerId) {
    const me = state.players[playerId];
    return me.side === 'hero' ? heroActions(state, me) : [];
  },

  performSpecial(state, playerId, action) {
    if (handleTokenAction(state, playerId, action)) return;
    const me = state.players[playerId];
    const d = data(state);
    if (!heroActions(state, me).some((a) => a.actionId === action.actionId)) throw new GameError('Không thể làm vậy lúc này.');
    state.turn.usedSpecial = true;
    if (action.actionId === 'track') {
      state.turn.hasAttacked = true;
      enqueueFront(state, [rollOp(playerId, 'knowledge', 'Lần theo vệt máu', { op: 'malai:track' })]);
    } else if (action.actionId === 'flip') {
      const helpers = aliveHeroes(state).filter((p) => p.id !== playerId && samePos(p.pos, me.pos)).length;
      enqueueFront(state, [rollOp(playerId, 'might', 'Úp ngược thân xác', { op: 'malai:flip' }, helpers)]);
    } else if (action.actionId === 'ash') {
      d.ashLeft -= 1;
      d.bags += 1;
      addToken(state, { id: `ash-${d.bags}`, kind: 'ash', label: 'Túi tro bếp', holder: playerId });
      addLog(state, `${me.name} hốt một túi tro bếp.`, 'haunt');
    } else if (action.actionId === 'spread') {
      const bag = tokensOf(state, playerId).find((t) => t.kind === 'ash');
      removeToken(state, bag.id);
      d.ashRooms.push(posKey(me.pos));
      addLog(state, `${me.name} rắc tro khắp ${roomName(state, me.pos)}. Đầu ma lai sẽ không vào được đây.`, 'haunt');
    }
  },

  // Người khác không được thấy quân cờ Kẻ phản bội (chính là thân xác) cho tới khi nó bị tìm ra.
  maskView(state, viewerId, view) {
    const d = data(state);
    if (!d.found && viewerId !== state.haunt.traitorId) view.players[state.haunt.traitorId].pos = null;
  },

  publicData(state, viewerId) {
    const d = data(state);
    const tokens = tokenDisplay(state);
    const marks = {};
    for (const key of d.ashRooms) marks[key] = [{ kind: 'ash', label: 'Đã rắc tro' }];
    if (d.found || viewerId === state.haunt.traitorId) (marks[d.body] ??= []).push({ kind: 'body', label: 'Thân xác ma lai' });
    const elapsed = ROUNDS_TO_DAWN - roundsLeft(state);
    return {
      meters: [
        { id: 'dawn', label: 'Tới lúc gà gáy', value: elapsed, max: ROUNDS_TO_DAWN, tone: 'neutral' },
        { id: 'dead', label: 'Người đã chết', value: deadHeroes(state), max: d.deathsNeeded, tone: 'danger' },
      ],
      notes: [
        d.found ? `Thân xác nằm ở ${roomName(state, posOf(state, d.body))}.` : 'Chưa ai tìm ra thân xác.',
        `Còn ${roundsLeft(state)} vòng nữa là trời sáng.`,
      ],
      marks: mergeMarks(marks, tokens.marks),
      carried: tokens.carried,
    };
  },

  checkVictory(state) {
    const d = data(state);
    if (d.flipped) return { side: 'heroes', reason: 'Thân xác bị úp ngược. Cái đầu gào lên rồi tan biến khi gà gáy.' };
    if (!aliveHeroes(state).length) return { side: 'traitor', reason: 'Không còn ai sống sót.' };
    if (d.dawn) {
      const home = samePos(head(state).pos, posOf(state, d.body));
      if (home && deadHeroes(state) >= d.deathsNeeded) {
        return { side: 'traitor', reason: 'Gà gáy. Cái đầu đã kịp nhập lại vào xác, no nê sau một đêm dài.' };
      }
      return {
        side: 'heroes',
        reason: home ? 'Trời sáng mà ma lai chưa ăn đủ. Nó phải nằm im chờ đêm sau.' : 'Gà gáy mà cái đầu chưa về kịp. Nó tan thành khói trong nắng sớm.',
      };
    }
    return null;
  },
};
