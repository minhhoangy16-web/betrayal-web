// Hiệu ứng trên bàn cờ:
//  - Ba chồng bài (Điềm báo, Sự kiện, Vật phẩm) ở góc dưới bên trái, kèm số thẻ còn lại.
//  - Khi có người rút thẻ: thẻ úp bay ra từ đúng chồng bài, lật mặt, rồi hiện nội dung thẻ.
//  - Khi có người đổ xúc xắc: xúc xắc lăn khoảng một giây rồi dừng ở kết quả thật.
// Kết quả luôn do server quyết định; ở đây chỉ diễn lại cho đẹp. Tải lại trang không phát lại
// hiệu ứng của sự kiện cũ.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';
import { CARD_TYPE_LABEL, TRAIT_LABEL } from '../lib/constants.js';
import CardFace, { CardBack } from './CardFace.jsx';

const DECKS = ['omen', 'event', 'item'];
const CARD_W = 300;
const AUTO_CLOSE_MS = 9000;

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Gọi onChange(next) mỗi khi value đổi, bỏ qua giá trị đầu tiên.
function useChanged(value, onChange) {
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value && value !== undefined && value !== null) onChange(value);
    prev.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}

// ---------------------------------------------------------------- chồng bài

function DeckPiles({ pileRefs }) {
  const stacks = useGameStore((s) => s.game.stacks);
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex gap-2 rounded-md border border-mortar bg-ink/85 p-2">
      {DECKS.map((type) => {
        const count = stacks[type];
        return (
          <div key={type} className="flex flex-col items-center gap-1" title={`${CARD_TYPE_LABEL[type]}: còn ${count} thẻ`}>
            <div ref={(el) => { pileRefs.current[type] = el; }} className={`relative ${count ? '' : 'opacity-30'}`} style={{ width: 40, height: 56 }}>
              {count > 2 && <CardBack type={type} width={40} className="absolute top-0 left-0" style={{ transform: 'translate(3px, -3px)' }} />}
              {count > 1 && <CardBack type={type} width={40} className="absolute top-0 left-0" style={{ transform: 'translate(1.5px, -1.5px)' }} />}
              <CardBack type={type} width={40} className="absolute top-0 left-0" />
            </div>
            <span className="text-[11px] leading-none text-bone">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- rút bài

function CardDraw({ draw, from, onDone }) {
  const players = useGameStore((s) => s.game.players);
  const you = useGameStore((s) => s.game.you);
  const catalog = useGameStore((s) => s.catalog);
  const card = catalog.cardsById[draw.cardId];
  const skip = reducedMotion();
  const [phase, setPhase] = useState(skip ? 'shown' : 'start'); // start -> fly -> flip -> shown
  const [offset, setOffset] = useState(null);
  const layerRef = useRef(null);
  const closeRef = useRef(null);

  // Tính vị trí chồng bài so với tâm lớp phủ để thẻ bay ra từ đúng chỗ.
  useLayoutEffect(() => {
    if (skip) return;
    const layer = layerRef.current?.getBoundingClientRect();
    const pile = from?.getBoundingClientRect();
    if (!layer || !pile) {
      setPhase('flip');
      return;
    }
    setOffset({
      x: pile.left + pile.width / 2 - (layer.left + layer.width / 2),
      y: pile.top + pile.height / 2 - (layer.top + layer.height / 2),
      s: pile.width / CARD_W,
    });
    const t1 = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('fly')));
    return () => cancelAnimationFrame(t1);
  }, [skip, from]);

  useEffect(() => {
    let t;
    if (phase === 'fly') t = setTimeout(() => setPhase('flip'), 560);
    if (phase === 'flip') t = setTimeout(() => setPhase('shown'), 700);
    if (phase === 'shown') {
      closeRef.current?.focus({ preventScroll: true });
      t = setTimeout(onDone, AUTO_CLOSE_MS);
    }
    return () => clearTimeout(t);
  }, [phase, onDone]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  if (!card) return null;
  const flown = phase !== 'start';
  const flipped = phase === 'flip' || phase === 'shown';
  const who = draw.playerId === you ? 'Bạn' : players[draw.playerId]?.name ?? '?';
  const wrapperTransform = !flown && offset ? `translate(${offset.x}px, ${offset.y}px) scale(${offset.s})` : 'none';

  return (
    <div
      ref={layerRef}
      className={`fixed inset-0 z-40 flex flex-col items-center justify-center overflow-y-auto p-4 transition-colors duration-500 lg:absolute
        ${flown ? 'bg-black/60' : 'bg-black/0'}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDone();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${who} rút thẻ ${CARD_TYPE_LABEL[card.type]}: ${card.name}`}
    >
      <div
        style={{
          transform: wrapperTransform,
          transition: skip ? 'none' : 'transform 540ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          perspective: 1400,
        }}
      >
        <div
          className="relative"
          style={{
            transformStyle: 'preserve-3d',
            transition: skip ? 'none' : 'transform 680ms cubic-bezier(0.3, 0.7, 0.2, 1)',
            transform: flipped ? 'rotateY(180deg)' : 'none',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center" style={{ backfaceVisibility: 'hidden' }}>
            <CardBack type={card.type} width={CARD_W} style={{ height: '100%', aspectRatio: 'auto' }} />
          </div>
          <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <CardFace cardId={card.id} size="lg" />
          </div>
        </div>
      </div>
      <div className={`mt-3 flex items-center gap-3 transition-opacity duration-300 ${phase === 'shown' ? 'opacity-100' : 'opacity-0'}`}>
        <span className="text-parchment">{who} vừa rút thẻ {CARD_TYPE_LABEL[card.type]}</span>
        <button
          ref={closeRef}
          type="button"
          onClick={onDone}
          className="flex items-center gap-1 rounded border border-mortar bg-stonework px-3 py-1 text-parchment hover:bg-mortar"
        >
          <X size={15} aria-hidden="true" /> Đóng
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- xúc xắc

const randomFace = () => [0, 0, 1, 1, 2, 2][Math.floor(Math.random() * 6)];

function DieFace({ value, rolling, tone }) {
  const tones = { bone: 'bg-parchment text-ink', blood: 'bg-blood text-parchment', ash: 'bg-stone-400 text-ink' };
  return (
    <span
      className={`inline-flex h-11 w-11 items-center justify-center gap-1.5 rounded-lg border-2 border-black/60 shadow-lg ${tones[tone]}
        ${rolling ? 'die-tumble' : 'die-land'}`}
      style={rolling ? { animationDelay: `${Math.random() * -0.3}s` } : undefined}
    >
      {Array.from({ length: value }, (_, i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-current" />)}
    </span>
  );
}

function DiceRow({ name, dice, total, rolling, tone }) {
  const [faces, setFaces] = useState(() => dice.map(randomFace));
  useEffect(() => {
    if (!rolling) return undefined;
    const id = setInterval(() => setFaces(dice.map(randomFace)), 80);
    return () => clearInterval(id);
  }, [rolling, dice]);
  return (
    <div className="flex items-center gap-3">
      {name && <span className="w-24 truncate text-right text-sm text-bone">{name}</span>}
      <span className="flex flex-wrap justify-center gap-1.5">
        {dice.length === 0 && <span className="text-sm text-stone-400 italic">không có xúc xắc</span>}
        {dice.map((v, i) => <DieFace key={i} value={rolling ? faces[i] : v} rolling={rolling} tone={tone} />)}
      </span>
      <strong className={`w-10 text-center font-display text-3xl transition-opacity ${rolling ? 'opacity-0' : 'opacity-100'}`}>{total}</strong>
    </div>
  );
}

// low: đặt ở dưới thay vì trên, để không che thẻ đang mở.
function DiceRoll({ roll, onDone, low }) {
  const game = useGameStore((s) => s.game);
  const skip = reducedMotion();
  const [rolling, setRolling] = useState(!skip);
  useEffect(() => {
    const t1 = setTimeout(() => setRolling(false), skip ? 0 : 900);
    const t2 = setTimeout(onDone, skip ? 2200 : 3200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [skip, onDone]);

  const nameOf = (ref) => (ref.kind === 'monster' ? game.monsters[ref.id]?.name : game.players[ref.id]?.name) ?? '?';
  const who = roll.playerId ? (roll.playerId === game.you ? 'Bạn' : game.players[roll.playerId]?.name) : null;
  const haunt = roll.kind === 'haunt';
  return (
    <div className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-3 lg:absolute
      ${low ? 'bottom-6 lg:bottom-20' : 'top-20 lg:top-14'}`}>
      <div className={`rounded-lg border-2 px-5 py-3 shadow-2xl backdrop-blur-sm
        ${haunt ? 'border-blood bg-[#1d0f0f]/95' : 'border-mortar bg-crypt/95'}`}>
        <p className="mb-2 text-center text-sm text-bone">
          {roll.label}
          {roll.trait && ` · ${TRAIT_LABEL[roll.trait]}`}
          {who && ` · ${who}`}
        </p>
        {roll.kind === 'combat' ? (
          <div className="space-y-2">
            <DiceRow name={nameOf(roll.attacker)} dice={roll.attacker.dice} total={roll.attacker.total} rolling={rolling} tone="blood" />
            <DiceRow name={nameOf(roll.defender)} dice={roll.defender.dice} total={roll.defender.total} rolling={rolling} tone="ash" />
          </div>
        ) : (
          <DiceRow dice={roll.dice ?? []} total={roll.total} rolling={rolling} tone={haunt ? 'blood' : 'bone'} />
        )}
        {haunt && !rolling && (
          <p className={`mt-2 text-center font-display tracking-wider uppercase ${roll.triggered ? 'text-lg text-red-400' : 'text-sm text-bone'}`}>
            {roll.triggered ? 'Haunt bắt đầu!' : `Cần ${roll.threshold}+ — ngôi nhà vẫn im lặng`}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ghép lại

export default function TableEffects() {
  const lastCard = useGameStore((s) => s.game.lastCard);
  const lastRoll = useGameStore((s) => s.game.lastRoll);
  const catalog = useGameStore((s) => s.catalog);
  const pileRefs = useRef({});
  const [cardQueue, setCardQueue] = useState([]);
  const [roll, setRoll] = useState(null);

  useChanged(lastCard?.seq, () => setCardQueue((q) => [...q, lastCard]));
  useChanged(lastRoll?.seq, () => setRoll(lastRoll));

  const nextCard = useCallback(() => setCardQueue((q) => q.slice(1)), []);
  const clearRoll = useCallback(() => setRoll(null), []);
  const current = cardQueue[0];
  const type = current ? catalog.cardsById[current.cardId]?.type : null;

  return (
    <>
      <DeckPiles pileRefs={pileRefs} />
      {current && <CardDraw key={`card-${current.seq}`} draw={current} from={pileRefs.current[type]} onDone={nextCard} />}
      {roll && <DiceRoll key={`roll-${roll.seq}`} roll={roll} onDone={clearRoll} low={Boolean(current)} />}
    </>
  );
}

// Xem to một thẻ trong túi đồ.
export function CardViewer() {
  const cardId = useGameStore((s) => s.viewCardId);
  const viewCard = useGameStore((s) => s.viewCard);
  const closeRef = useRef(null);
  useEffect(() => {
    if (!cardId) return undefined;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') viewCard(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cardId, viewCard]);
  if (!cardId) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) viewCard(null);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Xem thẻ"
    >
      <CardFace cardId={cardId} size="lg" />
      <button
        ref={closeRef}
        type="button"
        onClick={() => viewCard(null)}
        className="mt-3 flex items-center gap-1 rounded border border-mortar bg-stonework px-3 py-1 text-parchment hover:bg-mortar"
      >
        <X size={15} aria-hidden="true" /> Đóng
      </button>
    </div>
  );
}
