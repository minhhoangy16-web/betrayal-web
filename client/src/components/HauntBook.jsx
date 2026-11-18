// Cửa sổ đọc sách Haunt. Server chỉ gửi đúng một cuốn theo phe của người chơi
// (Traitor's Tome hoặc Secrets of Survival) nên ở đây không có gì để lộ.

import { useEffect, useRef } from 'react';
import { BookOpen, Skull, X } from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';
import { HauntMeters } from './HauntStatus.jsx';

export default function HauntBook({ onClose }) {
  const haunt = useGameStore((s) => s.game?.haunt);
  const players = useGameStore((s) => s.game?.players);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!haunt) return null;
  const book = haunt.book;
  const traitor = book?.kind === 'traitorTome';
  const traitorLine = {
    traitor: players[haunt.traitorId]?.name,
    hidden: haunt.traitorId ? players[haunt.traitorId]?.name : 'đang giấu mặt',
  }[haunt.mode ?? 'traitor'];
  const modeLine = { coop: 'Không có kẻ phản bội – mọi người cùng chống lại ngôi nhà.', solo: 'Không có phe – mỗi người tự chơi cho mình.' }[haunt.mode];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="haunt-book-title"
        className={`thin-scroll relative max-h-full w-full max-w-2xl overflow-y-auto rounded-md border-2 p-6 shadow-2xl
          ${traitor ? 'border-blood bg-[#1d0f0f]' : 'border-[#6b5a3c] bg-[#221c14]'}`}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 rounded p-1 text-bone hover:bg-black/40"
          aria-label="Đóng sách"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <p className="text-xs tracking-[0.3em] text-stone-500 uppercase">Haunt</p>
        <h2 className="font-display text-2xl text-parchment">{haunt.name}</h2>
        {traitorLine && (
          <p className="mt-1 text-sm text-bone">
            Kẻ phản bội: <strong className="text-red-400">{traitorLine}</strong>
          </p>
        )}
        {modeLine && <p className="mt-1 text-sm text-bone">{modeLine}</p>}
        <p className="mt-3 border-l-2 border-mortar pl-3 text-bone italic">{haunt.publicIntro}</p>

        <div className="mt-4 rounded border border-mortar/70 bg-black/20 p-3">
          <HauntMeters data={haunt.data} />
        </div>

        {book ? (
          <div className="mt-5 border-t border-mortar pt-4">
            <h3 id="haunt-book-title" className={`flex items-center gap-2 font-display text-lg ${traitor ? 'text-red-300' : 'text-candle'}`}>
              {traitor ? <Skull size={18} aria-hidden="true" /> : <BookOpen size={18} aria-hidden="true" />}
              {book.title}
            </h3>
            <p className="mt-1 text-xs tracking-wider text-stone-500 uppercase">
              {traitor ? 'Chỉ mình bạn đọc được cuốn này' : 'Kẻ phản bội không đọc được cuốn này'}
            </p>
            <p className="mt-3 leading-relaxed text-parchment">{book.story}</p>
            <h4 className="mt-4 font-display text-sm tracking-widest text-bone uppercase">Mục tiêu</h4>
            <p className="mt-1 font-semibold text-parchment">{book.objective}</p>
            <h4 className="mt-4 font-display text-sm tracking-widest text-bone uppercase">Luật riêng</h4>
            <ul className="mt-1 list-disc space-y-1.5 pl-5 leading-snug text-parchment">
              {book.rules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
          </div>
        ) : (
          <p id="haunt-book-title" className="mt-5 border-t border-mortar pt-4 text-bone italic">
            Bạn đang theo dõi với tư cách khán giả nên không có cuốn sách nào.
          </p>
        )}
      </article>
    </div>
  );
}
