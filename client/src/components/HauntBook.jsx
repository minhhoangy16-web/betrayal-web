// Cửa sổ đọc sách Haunt. Server chỉ gửi đúng một cuốn theo phe của người chơi
// (Sách Kẻ phản bội hoặc Sách Người sống sót) nên ở đây không có gì để lộ.

import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, EyeOff, Skull, Users, X } from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';
import { HauntMeters } from './HauntStatus.jsx';

// Luật chung áp dụng cho mọi kịch bản sau khi Haunt bắt đầu.
const COMMON_RULES = [
  'Từ lúc Haunt bắt đầu, một chỉ số bất kỳ tụt xuống đầu lâu là nhân vật chết. Người chết làm rơi mọi thẻ và vật đang cầm tại chỗ.',
  'Mỗi lượt: đi tối đa bằng Tốc độ, tấn công tối đa một lần, và làm tối đa một hành động đặc biệt của kịch bản (trừ khi luật ghi khác).',
  'Tấn công: hai bên đổ cùng một chỉ số (thường là Sức mạnh). Bên thấp hơn chịu sát thương bằng phần chênh lệch: thể chất nếu đổ Sức mạnh / Tốc độ, tinh thần nếu đổ Tinh thần / Tri thức. Hoà thì không ai bị gì.',
  'Quái vật không có thanh chỉ số: thua trận thì bị choáng và bỏ một lượt.',
  'Rời một phòng có kẻ địch (chưa bị choáng) tốn thêm 1 bước cho mỗi kẻ địch ở đó.',
  'Không còn mở thêm Haunt Roll. Bảng tình hình (bên phải) luôn ghi các con số quan trọng của kịch bản.',
];

// Dải tiêu đề lớn ở đầu sách: cho biết ngay bạn thuộc phe nào.
function RoleBanner({ haunt, traitor }) {
  if (traitor && haunt.mode === 'hidden') {
    return (
      <div className="rounded-md border-2 border-blood bg-[#2b0d0d] px-4 py-3 text-center shadow-[0_0_24px_rgba(139,26,26,0.45)]">
        <p className="flex items-center justify-center gap-2 font-display text-3xl tracking-[0.12em] text-red-400 uppercase sm:text-4xl">
          <EyeOff size={28} aria-hidden="true" /> Phản bội (Bí mật)
        </p>
        <p className="mt-1 text-sm text-red-200">
          {haunt.secretTraitor
            ? 'Chỉ mình bạn biết điều này. Người khác thấy phe của bạn là «?». Đừng để lộ.'
            : 'Bạn đã bị lộ mặt. Giờ cả bàn đều biết.'}
        </p>
      </div>
    );
  }
  const banner = traitor
    ? { text: 'Kẻ phản bội', tone: 'border-blood bg-[#2b0d0d] text-red-400', icon: Skull }
    : haunt.mode === 'coop'
      ? { text: 'Cả bàn hợp tác', tone: 'border-candle bg-[#2a2216] text-candle', icon: Users }
      : haunt.mode === 'solo'
        ? { text: 'Mạnh ai nấy chơi', tone: 'border-candle bg-[#2a2216] text-candle', icon: Users }
        : { text: 'Người sống sót', tone: 'border-emerald-700 bg-[#122019] text-emerald-300', icon: BookOpen };
  const Icon = banner.icon;
  return (
    <div className={`rounded-md border-2 px-4 py-2.5 text-center ${banner.tone}`}>
      <p className="flex items-center justify-center gap-2 font-display text-2xl tracking-[0.12em] uppercase sm:text-3xl">
        <Icon size={24} aria-hidden="true" /> {banner.text}
      </p>
      {haunt.mode === 'hidden' && !traitor && (
        <p className="mt-1 text-sm text-bone">
          {haunt.secretTraitor ? 'Một người trong nhóm là Kẻ phản bội giấu mặt. Có thể là bất kỳ ai, trừ bạn.' : 'Kẻ phản bội đã lộ mặt.'}
        </p>
      )}
    </div>
  );
}

function Section({ title, items, tone = 'text-parchment', marker = 'list-disc' }) {
  if (!items?.length) return null;
  return (
    <>
      <h4 className="mt-4 font-display text-sm tracking-widest text-bone uppercase">{title}</h4>
      <ul className={`mt-1 ${marker} space-y-1.5 pl-5 leading-snug ${tone}`}>
        {items.map((rule) => <li key={rule}>{rule}</li>)}
      </ul>
    </>
  );
}

export default function HauntBook({ onClose }) {
  const haunt = useGameStore((s) => s.game?.haunt);
  const players = useGameStore((s) => s.game?.players);
  const closeRef = useRef(null);
  const [showCommon, setShowCommon] = useState(false);

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
  const loseTitle = haunt.mode === 'coop' ? 'Cả bàn thua khi' : 'Bạn thua khi';

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

        {book && <div className="mt-5 mb-4"><RoleBanner haunt={haunt} traitor={traitor} /></div>}

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
              {traitor ? 'Chỉ mình bạn đọc được cuốn này' : haunt.mode === 'coop' || haunt.mode === 'solo' ? 'Mọi người đọc chung cuốn này' : 'Kẻ phản bội không đọc được cuốn này'}
            </p>
            <p className="mt-3 leading-relaxed text-parchment">{book.story}</p>

            <div className="mt-4 rounded border border-emerald-800/70 bg-emerald-950/30 p-3">
              <h4 className="font-display text-sm tracking-widest text-emerald-300 uppercase">
                {haunt.mode === 'coop' ? 'Cả bàn thắng khi' : 'Bạn thắng khi'}
              </h4>
              <p className="mt-1 font-semibold text-parchment">{book.objective}</p>
            </div>
            {book.lose?.length > 0 && (
              <div className="mt-2 rounded border border-red-900/70 bg-red-950/30 p-3">
                <h4 className="font-display text-sm tracking-widest text-red-300 uppercase">{loseTitle}</h4>
                <ul className="mt-1 list-disc space-y-1 pl-5 leading-snug text-parchment">
                  {book.lose.map((rule) => <li key={rule}>{rule}</li>)}
                </ul>
              </div>
            )}

            <Section title="Khi Haunt bắt đầu" items={book.setup} />
            <Section title="Luật riêng" items={book.rules} />
            <Section title="Mẹo" items={book.tips} tone="text-bone italic" />

            <button
              type="button"
              onClick={() => setShowCommon((v) => !v)}
              aria-expanded={showCommon}
              className="mt-5 flex w-full items-center justify-between rounded border border-mortar/70 px-3 py-2 text-left text-sm text-bone hover:bg-black/30"
            >
              Luật chung khi Haunt đã bắt đầu
              <ChevronDown size={16} className={showCommon ? 'rotate-180' : ''} aria-hidden="true" />
            </button>
            {showCommon && (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-snug text-bone">
                {COMMON_RULES.map((rule) => <li key={rule}>{rule}</li>)}
              </ul>
            )}
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
