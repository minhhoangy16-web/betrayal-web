// Các bảng phụ: danh sách người chơi, túi đồ, khay xúc xắc, thẻ vừa rút, nhật ký.

import { useEffect, useRef } from 'react';
import { Backpack, Dices, ScrollText, Skull, Users, WifiOff } from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';
import { CARD_TYPE_LABEL, SIDE_LABEL, TRAITS, TRAIT_LABEL, mediaUrl } from '../lib/constants.js';
import { Art, Button, Die, Panel, PlayerToken, TraitIcon } from './ui.jsx';

export function PlayerList({ inspectedId, onInspect }) {
  const game = useGameStore((s) => s.game);
  const lobby = useGameStore((s) => s.lobby);
  const catalog = useGameStore((s) => s.catalog);
  const actorId = game.pending ? game.pending.playerId : game.turn.playerId;
  const online = Object.fromEntries((lobby?.players ?? []).map((p) => [p.id, p.connected]));
  const carried = game.haunt?.data?.carried ?? {};

  return (
    <Panel title="Người chơi" icon={Users}>
      <ul className="divide-y divide-mortar/60">
        {game.turnOrder.map((id) => {
          const p = game.players[id];
          const character = catalog.charactersById[p.characterId];
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onInspect(id)}
                aria-pressed={id === inspectedId}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-stonework/70
                  ${id === inspectedId ? 'bg-stonework' : ''}`}
              >
                <PlayerToken player={p} character={character} active={id === actorId} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`truncate ${p.alive ? '' : 'text-stone-500 line-through'}`}>{p.name}</span>
                    {id === game.you && <span className="text-xs text-stone-500">(bạn)</span>}
                    {online[id] === false && <WifiOff size={13} className="shrink-0 text-ember" aria-label="Mất kết nối" />}
                  </div>
                  <div className="truncate text-xs text-stone-500">
                    {p.side === 'traitor'
                      ? <span className="font-semibold text-red-400">{SIDE_LABEL.traitor}</span>
                      : p.side === 'explorer' ? character.name : SIDE_LABEL[p.side] ?? character.name}
                    {p.escaped && <span className="text-emerald-300"> · đã thoát</span>}
                  </div>
                  {carried[id]?.length > 0 && (
                    <div className="truncate text-xs text-candle" title={carried[id].join(', ')}>
                      Mang: {carried[id].join(', ')}
                    </div>
                  )}
                </div>
                {p.alive ? (
                  <div className="grid grid-cols-4 gap-x-1.5 text-center text-xs text-bone">
                    {TRAITS.map((t) => (
                      <span key={t} title={TRAIT_LABEL[t]} className="flex flex-col items-center">
                        <TraitIcon trait={t} size={11} className="text-stone-500" />
                        <span className={p.traits[t] === 0 ? 'font-bold text-ember' : ''}>{p.traitValues[t]}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <Skull size={16} className="text-stone-500" aria-label="Đã chết" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

const TYPE_TINT = { omen: 'text-violet-300', item: 'text-emerald-300', event: 'text-amber-300' };

export function Inventory() {
  const game = useGameStore((s) => s.game);
  const catalog = useGameStore((s) => s.catalog);
  const act = useGameStore((s) => s.act);
  const cardImages = useGameStore((s) => s.media.cards);
  const viewCard = useGameStore((s) => s.viewCard);
  const me = game.players[game.you];
  if (!me) return null;

  return (
    <Panel title={`Túi đồ (${me.cards.length})`} icon={Backpack}>
      {me.cards.length === 0 ? (
        <p className="px-3 py-3 text-sm text-stone-500 italic">Bạn chưa có thẻ nào.</p>
      ) : (
        <ul className="divide-y divide-mortar/60">
          {me.cards.map((cardId) => {
            const card = catalog.cardsById[cardId];
            const canUse = game.legal.some((a) => a.type === 'useItem' && a.cardId === cardId);
            const gives = game.legal.filter((a) => a.type === 'giveItem' && a.cardId === cardId);
            return (
              <li key={cardId} className="flex gap-3 px-3 py-2">
                <button type="button" className="shrink-0" onClick={() => viewCard(cardId)} aria-label={`Xem thẻ ${card.name}`}>
                  <Art src={mediaUrl(cardImages[cardId])} className="h-14 w-14 rounded object-cover hover:ring-2 hover:ring-candle" />
                </button>
                <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <button type="button" className="text-left font-display text-sm text-parchment hover:text-candle" onClick={() => viewCard(cardId)}>
                    {card.name}
                  </button>
                  <span className={`shrink-0 text-[11px] tracking-wider uppercase ${TYPE_TINT[card.type]}`}>
                    {CARD_TYPE_LABEL[card.type]}
                  </span>
                </div>
                <p className="mt-0.5 text-sm leading-snug text-bone">{card.text}</p>
                {(canUse || gives.length > 0) && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {canUse && (
                      <Button variant="candle" className="px-2! py-1! text-sm" onClick={() => act({ type: 'useItem', cardId })}>
                        Dùng
                      </Button>
                    )}
                    {gives.map((a) => (
                      <Button key={a.toPlayerId} className="px-2! py-1! text-sm" onClick={() => act(a)}>
                        Trao cho {game.players[a.toPlayerId].name}
                      </Button>
                    ))}
                  </div>
                )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function DiceRow({ dice, tone }) {
  if (!dice.length) return <span className="text-sm text-stone-500 italic">không có xúc xắc</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {dice.map((value, i) => <Die key={i} value={value} tone={tone} delay={i * 45} />)}
    </span>
  );
}

export function DiceTray() {
  const game = useGameStore((s) => s.game);
  const roll = game.lastRoll;
  const nameOf = (ref) => (ref.kind === 'monster' ? game.monsters[ref.id]?.name : game.players[ref.id]?.name) ?? '?';

  let body = <p className="text-sm text-stone-500 italic">Chưa có lần đổ nào.</p>;
  if (roll?.kind === 'combat') {
    body = (
      <div className="space-y-2" key={roll.seq}>
        <p className="text-sm text-bone">{roll.label} · {TRAIT_LABEL[roll.trait]}</p>
        {[['attacker', 'blood'], ['defender', 'ash']].map(([side, tone]) => (
          <div key={side} className="flex items-center gap-2">
            <span className="w-20 truncate text-sm">{nameOf(roll[side])}</span>
            <DiceRow dice={roll[side].dice} tone={tone} />
            <strong className="ml-auto font-display text-lg">{roll[side].total}</strong>
          </div>
        ))}
      </div>
    );
  } else if (roll) {
    const haunt = roll.kind === 'haunt';
    body = (
      <div className="space-y-2" key={roll.seq}>
        <p className="text-sm text-bone">
          {roll.label}
          {roll.trait && ` · ${TRAIT_LABEL[roll.trait]}`}
          {roll.playerId && ` · ${game.players[roll.playerId]?.name}`}
        </p>
        <div className="flex items-center gap-2">
          <DiceRow dice={roll.dice} tone={haunt ? 'blood' : 'bone'} />
          <strong className="ml-auto font-display text-2xl">{roll.total}</strong>
        </div>
        {haunt && (
          <p className={`text-sm ${roll.triggered ? 'font-semibold text-red-400' : 'text-bone'}`}>
            Cần {roll.threshold}+ — {roll.triggered ? 'Haunt bắt đầu!' : 'ngôi nhà vẫn im lặng.'}
          </p>
        )}
      </div>
    );
  }
  return <Panel title="Xúc xắc" icon={Dices}><div className="p-3">{body}</div></Panel>;
}

export function LastCard() {
  const game = useGameStore((s) => s.game);
  const catalog = useGameStore((s) => s.catalog);
  const cardImages = useGameStore((s) => s.media.cards);
  const viewCard = useGameStore((s) => s.viewCard);
  if (!game.lastCard) return null;
  const card = catalog.cardsById[game.lastCard.cardId];
  const who = game.players[game.lastCard.playerId];
  return (
    <button
      type="button"
      onClick={() => viewCard(card.id)}
      className="flex w-full items-center gap-3 rounded-md border border-[#6b5a3c] bg-[#2a2319] p-2 text-left hover:border-candle"
      aria-label={`Thẻ vừa rút: ${card.name}. Bấm để xem`}
    >
      <Art src={mediaUrl(cardImages[card.id])} className="h-12 w-12 shrink-0 rounded object-cover" />
      <span className="min-w-0 flex-1">
        <span className={`block text-[11px] tracking-widest uppercase ${TYPE_TINT[card.type]}`}>
          {CARD_TYPE_LABEL[card.type]} · {who?.name} vừa rút
        </span>
        <span className="block truncate font-display text-[15px] text-parchment">{card.name}</span>
      </span>
      <span className="shrink-0 text-xs text-bone">Xem</span>
    </button>
  );
}

const LOG_TINT = {
  haunt: 'text-red-300', combat: 'text-orange-300', damage: 'text-rose-200', card: 'text-violet-200',
  roll: 'text-amber-200', system: 'text-stone-500', move: 'text-bone', info: 'text-bone',
};

const NO_LOG = [];

export function LogPanel() {
  const log = useGameStore((s) => s.game?.log) ?? NO_LOG;
  const boxRef = useRef(null);
  const lastSeq = log.at(-1)?.seq;

  // Luôn cuộn xuống dòng mới nhất.
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastSeq]);

  return (
    <Panel title="Nhật ký" icon={ScrollText} className="flex min-h-0 flex-1 flex-col">
      <ol ref={boxRef} className="thin-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sm leading-snug" aria-live="polite">
        {log.map((entry) => (
          <li key={entry.seq} className={LOG_TINT[entry.kind] ?? 'text-bone'}>{entry.text}</li>
        ))}
      </ol>
    </Panel>
  );
}
