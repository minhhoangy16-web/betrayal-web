// Các bảng phụ: danh sách người chơi, túi đồ, khay xúc xắc, thẻ vừa rút, nhật ký.

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Backpack, Dices, Maximize2, ScrollText, Search, Skull, Users, WifiOff, X } from 'lucide-react';
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
  const viewBag = useGameStore((s) => s.viewBag);

  return (
    <Panel title="Người chơi" icon={Users}>
      <ul className="divide-y divide-mortar/60">
        {game.turnOrder.map((id) => {
          const p = game.players[id];
          const character = catalog.charactersById[p.characterId];
          return (
            <li key={id} className={`flex items-center hover:bg-stonework/70 ${id === inspectedId ? 'bg-stonework' : ''}`}>
              {/* Bấm vào avatar: xem túi đồ của người này. */}
              <button
                type="button"
                onClick={() => viewBag(id)}
                className="relative shrink-0 rounded-full py-2 pl-3"
                title={`Xem túi đồ của ${p.name}`}
                aria-label={`Xem túi đồ của ${p.name} (${p.cards.length} thẻ)`}
              >
                <PlayerToken player={p} character={character} active={id === actorId} title={`${p.name} – bấm để xem túi đồ`} />
                <span className="absolute -right-1 bottom-1 flex items-center gap-0.5 rounded-full bg-ink/90 px-1 text-[10px] leading-4 text-candle ring-1 ring-mortar">
                  <Backpack size={9} aria-hidden="true" />{p.cards.length + (carried[id]?.length ?? 0)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onInspect(id)}
                aria-pressed={id === inspectedId}
                className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-3 pl-2 text-left"
              >
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
  const nameOf = (ref) => ref.name ?? (ref.kind === 'monster' ? game.monsters[ref.id]?.name : game.players[ref.id]?.name) ?? '?';

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

// Bộ lọc nhật ký theo loại dòng.
const LOG_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'haunt', label: 'Haunt', kinds: ['haunt'] },
  { id: 'fight', label: 'Đánh nhau', kinds: ['combat', 'damage'] },
  { id: 'card', label: 'Thẻ', kinds: ['card'] },
  { id: 'roll', label: 'Xúc xắc', kinds: ['roll'] },
  { id: 'move', label: 'Di chuyển', kinds: ['move', 'info'] },
  { id: 'secret', label: 'Riêng tôi' },
];

const NO_LOG = [];

// Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu.
const fold = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

function useFilteredLog(log, players, { query, filter, who }) {
  const q = fold(query.trim());
  const f = LOG_FILTERS.find((x) => x.id === filter);
  const whoName = who !== 'all' ? fold(players[who]?.name ?? '') : '';
  return log.filter((e) => {
    if (f?.kinds && !f.kinds.includes(e.kind)) return false;
    if (filter === 'secret' && !e.to) return false;
    if (who !== 'all' && e.actor !== who && !fold(e.text).includes(whoName)) return false;
    if (q && !fold(e.text).includes(q)) return false;
    return true;
  });
}

function LogControls({ query, setQuery, filter, setFilter, who, setWho, players, turnOrder }) {
  return (
    <div className="space-y-1.5 border-b border-mortar/60 px-3 py-2">
      <div className="flex gap-1.5">
        <label className="relative min-w-0 flex-1">
          <Search size={13} className="absolute top-1/2 left-2 -translate-y-1/2 text-stone-500" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm trong nhật ký…"
            aria-label="Tìm trong nhật ký"
            className="w-full rounded border border-mortar bg-ink/70 py-1 pr-2 pl-7 text-sm text-parchment placeholder:text-stone-500 focus:border-candle focus:outline-none"
          />
        </label>
        <select
          value={who}
          onChange={(e) => setWho(e.target.value)}
          aria-label="Lọc theo người chơi"
          className="max-w-[45%] rounded border border-mortar bg-ink/70 px-1 text-sm text-parchment"
        >
          <option value="all">Mọi người</option>
          {turnOrder.map((id) => <option key={id} value={id}>{players[id]?.name}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Lọc theo loại">
        {LOG_FILTERS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setFilter(x.id)}
            aria-pressed={filter === x.id}
            className={`rounded-full border px-2 py-0.5 text-[11px] ${filter === x.id ? 'border-candle bg-candle/20 text-candle' : 'border-mortar text-bone hover:bg-stonework'}`}
          >
            {x.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LogList({ entries, big, players, filtered }) {
  const boxRef = useRef(null);
  const atBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const lastSeq = entries.at(-1)?.seq;

  // Tự cuộn xuống dòng mới nhất, trừ khi người chơi đang kéo lên đọc lại.
  useEffect(() => {
    const el = boxRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastSeq]);

  const onScroll = () => {
    const el = boxRef.current;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    atBottom.current = bottom;
    setShowJump(!bottom);
  };

  const rows = [];
  let round = null;
  for (const e of entries) {
    if (e.round !== undefined && e.round !== round) {
      round = e.round;
      rows.push(
        <li key={`r${e.seq}`} className="sticky top-0 z-[1] -mx-3 border-y border-mortar/60 bg-crypt/95 px-3 py-0.5 font-display text-[11px] tracking-widest text-candle uppercase">
          Vòng {round}
        </li>,
      );
    }
    const actor = e.actor ? players[e.actor]?.name : null;
    rows.push(
      <li key={e.seq} className={`${LOG_TINT[e.kind] ?? 'text-bone'} ${e.to ? 'border-l-2 border-violet-400 pl-1.5' : ''}`}>
        {big && actor && e.kind !== 'system' && <span className="mr-1.5 text-[11px] text-stone-500">[{actor}]</span>}
        {e.text}
        {e.to && <span className="ml-1 text-[10px] text-violet-300">(chỉ bạn thấy)</span>}
      </li>,
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ol
        ref={boxRef}
        onScroll={onScroll}
        className={`thin-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2 leading-snug ${big ? 'text-[15px]' : 'text-sm'}`}
        aria-live="polite"
      >
        {rows.length ? rows : (
          <li className="text-stone-500 italic">{filtered ? 'Không có dòng nào khớp bộ lọc.' : 'Chưa có gì.'}</li>
        )}
      </ol>
      {showJump && (
        <button
          type="button"
          onClick={() => {
            const el = boxRef.current;
            el.scrollTop = el.scrollHeight;
          }}
          className="absolute right-3 bottom-2 flex items-center gap-1 rounded-full border border-candle bg-ink/95 px-2 py-0.5 text-xs text-candle shadow"
        >
          <ArrowDown size={12} aria-hidden="true" /> Mới nhất
        </button>
      )}
    </div>
  );
}

export function LogPanel() {
  const log = useGameStore((s) => s.game?.log) ?? NO_LOG;
  const players = useGameStore((s) => s.game?.players);
  const turnOrder = useGameStore((s) => s.game?.turnOrder) ?? NO_LOG;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [who, setWho] = useState('all');
  const [big, setBig] = useState(false);
  const entries = useFilteredLog(log, players ?? {}, { query, filter, who });
  const filtered = Boolean(query.trim()) || filter !== 'all' || who !== 'all';
  const controls = (
    <LogControls {...{ query, setQuery, filter, setFilter, who, setWho, players: players ?? {}, turnOrder }} />
  );

  useEffect(() => {
    if (!big) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setBig(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [big]);

  return (
    <>
      <Panel
        title={filtered ? `Nhật ký (${entries.length}/${log.length})` : 'Nhật ký'}
        icon={ScrollText}
        className="flex min-h-0 flex-1 flex-col"
        action={(
          <button type="button" onClick={() => setBig(true)} className="rounded p-1 text-bone hover:bg-stonework" title="Mở nhật ký cỡ lớn" aria-label="Mở nhật ký cỡ lớn">
            <Maximize2 size={14} aria-hidden="true" />
          </button>
        )}
      >
        {controls}
        {!big && <LogList entries={entries} players={players ?? {}} filtered={filtered} />}
      </Panel>
      {big && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBig(false);
          }}
        >
          <section role="dialog" aria-modal="true" aria-label="Nhật ký ván chơi" className="flex h-full max-h-[90dvh] w-full max-w-3xl flex-col rounded-md border-2 border-[#6b5a3c] bg-crypt shadow-2xl">
            <header className="flex items-center justify-between border-b border-mortar px-4 py-2">
              <h2 className="flex items-center gap-2 font-display tracking-widest text-parchment uppercase">
                <ScrollText size={16} aria-hidden="true" /> Nhật ký ván chơi
                <span className="text-xs text-stone-500 normal-case">({entries.length} dòng)</span>
              </h2>
              <button type="button" onClick={() => setBig(false)} className="rounded p-1 text-bone hover:bg-black/40" aria-label="Đóng">
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            {controls}
            <LogList entries={entries} big players={players ?? {}} filtered={filtered} />
          </section>
        </div>
      )}
    </>
  );
}
