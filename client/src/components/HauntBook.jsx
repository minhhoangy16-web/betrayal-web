// Cửa sổ đọc sách Haunt, bố cục theo kiểu sách luật: tiêu đề + số, khung «Đọc trước!» (Giới thiệu, Chuẩn bị),
// cột trái (Mục tiêu, Vật dụng cần), cột phải (hành động đặc biệt, luật riêng, khung quái vật).
// Server chỉ gửi đúng một cuốn theo phe của người chơi, và KHÔNG gửi đoạn kết (đoạn kết chỉ hiện khi
// ván kết thúc, trong khung thông báo thắng / thua).

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
  'Không còn mở thêm Haunt Roll. Bảng tình hình luôn ghi các con số quan trọng của kịch bản.',
];

const TRAIT_ORDER = [['might', 'Sức mạnh'], ['speed', 'Tốc độ'], ['sanity', 'Tinh thần'], ['knowledge', 'Tri thức']];

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
    <div className={`rounded-md border-2 px-4 py-2 text-center ${banner.tone}`}>
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

// Dòng luật dạng «Tên hành động» (điều kiện): mô tả  →  khối hành động đặc biệt.
const ACTION_RE = /^«([^»]+)»\s*(?:\(([^)]*)\))?\s*:?\s*(.*)$/s;
function splitRules(book) {
  const actions = [...(book.actions ?? [])];
  const rules = [];
  for (const r of book.rules ?? []) {
    const m = typeof r === 'string' ? r.match(ACTION_RE) : null;
    if (m) actions.push({ name: m[1], when: m[2] ? `${m[2][0].toUpperCase()}${m[2].slice(1)}, bạn có thể` : null, text: m[3] });
    else rules.push(r);
  }
  return { actions, rules };
}

function SectionTitle({ children, tone = 'text-[#e2a08f]' }) {
  return <h4 className={`font-display text-lg leading-tight ${tone}`}>{children}</h4>;
}

function ActionBlock({ action }) {
  return (
    <div className="mt-3">
      {action.when && <p className="text-xs text-stone-400">{action.when}</p>}
      <p className="flex items-center gap-1.5 font-display text-lg text-[#e2a08f]">
        <span aria-hidden="true" className="inline-block size-4 rounded-full border-2 border-[#e2a08f]" />
        {action.name}
      </p>
      <p className="pl-6 leading-snug text-parchment">{action.text}</p>
      {action.outcomes?.length > 0 && (
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pl-6 text-sm">
          {action.outcomes.map(([range, text]) => (
            <div key={range} className="contents">
              <dt className="font-bold whitespace-nowrap text-parchment">{range}</dt>
              <dd className="text-bone">{text}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function RuleBlock({ rule }) {
  if (typeof rule === 'string') return <li>{rule}</li>;
  return (
    <li className="list-none">
      <p className="-ml-5 font-display text-base text-[#e2a08f]">{rule.title}</p>
      {rule.text && <p>{rule.text}</p>}
      {rule.items && (
        <ul className="list-disc space-y-1 pl-5">
          {rule.items.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}
    </li>
  );
}

function MonsterCard({ monster }) {
  return (
    <div className="mt-4 rounded-lg border-2 border-[#b89a4e] bg-[#3a3016] p-3 shadow-inner">
      <p className="font-display text-lg text-[#f3d98c]">
        Quái vật: {monster.name}
        {monster.controller && <span className="ml-2 text-xs text-stone-400">(điều khiển: {monster.controller})</span>}
      </p>
      <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-parchment">
        {TRAIT_ORDER.filter(([t]) => monster.traits?.[t] != null).map(([t, label]) => (
          <span key={t}>
            {label} <strong>{monster.traits[t]}</strong>
          </span>
        ))}
      </p>
      {monster.rules?.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm leading-snug text-bone">
          {monster.rules.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function HauntBook({ onClose }) {
  const haunt = useGameStore((s) => s.game?.haunt);
  const players = useGameStore((s) => s.game?.players);
  const scenarioId = useGameStore((s) => s.game?.scenarioId);
  const catalog = useGameStore((s) => s.catalog);
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
  const scenarioName = (catalog.scenarios ?? []).find((s) => s.id === scenarioId)?.title ?? 'Không có';
  const triggerName = haunt.triggerCardId ? catalog.cardsById[haunt.triggerCardId]?.name : null;
  const traitorName = haunt.traitorId ? players[haunt.traitorId]?.name : null;
  const { actions, rules } = book ? splitRules(book) : { actions: [], rules: [] };
  const intro = book?.intro ?? book?.story;
  const coop = haunt.mode === 'coop';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="haunt-book-title"
        className={`thin-scroll relative max-h-full w-full max-w-4xl overflow-y-auto rounded-md border-2 p-4 shadow-2xl sm:p-6
          ${traitor ? 'border-blood bg-[#1d1212]' : 'border-[#6b5a3c] bg-[#221c14]'}`}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 rounded p-1 text-bone hover:bg-black/40"
          aria-label="Đóng sách"
        >
          <X size={20} aria-hidden="true" />
        </button>

        {/* Tiêu đề kiểu sách luật: tên + số Haunt, dòng thông tin */}
        <header className="flex items-start gap-4 border-b border-mortar pr-8 pb-3">
          <div className="min-w-0 flex-1 text-right">
            <h2 id="haunt-book-title" className="font-display text-3xl leading-tight text-parchment sm:text-4xl">{haunt.name}</h2>
            <p className="mt-1 text-sm text-[#e2a08f]">
              <span className="font-semibold">Kịch bản:</span> {scenarioName}
              {triggerName && <> · <span className="font-semibold">Điềm báo kích hoạt:</span> «{triggerName}»</>}
            </p>
            <p className="text-sm text-[#9fc79a]">
              <span className="font-semibold">Kẻ phản bội:</span> {haunt.traitorRule}
              {traitorName && <> – <strong className="text-red-300">{traitorName}</strong></>}
            </p>
          </div>
          {haunt.number && (
            <div className="border-x border-[#b89a4e] px-4 font-display text-5xl leading-none text-[#e2a08f] sm:text-6xl">{haunt.number}</div>
          )}
        </header>

        {book && <div className="mt-3"><RoleBanner haunt={haunt} traitor={traitor} /></div>}

        {book ? (
          <>
            {/* Đọc trước! */}
            <section className="mt-4 overflow-hidden rounded border-2 border-[#7d2a24]">
              <p className="bg-[#7d2a24] py-1 text-center font-display text-parchment italic">Đọc trước!</p>
              <div className="space-y-3 p-3">
                <div>
                  <SectionTitle>Giới thiệu</SectionTitle>
                  <p className="mt-1 leading-relaxed text-parchment italic">{intro}</p>
                </div>
                {book.setup?.length > 0 && (
                  <div>
                    <SectionTitle>Chuẩn bị</SectionTitle>
                    <ol className="mt-1 list-decimal space-y-1 pl-6 leading-snug text-parchment">
                      {book.setup.map((s) => <li key={s}>{s}</li>)}
                    </ol>
                  </div>
                )}
              </div>
            </section>

            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              {/* Cột trái: Mục tiêu, Vật dụng cần, tình hình */}
              <div className="space-y-3">
                <section className="rounded bg-[#4a2723]/70 p-3">
                  <SectionTitle>Mục tiêu</SectionTitle>
                  <p className="mt-1 font-semibold text-parchment">{book.objective}</p>
                  {book.lose?.length > 0 && (
                    <>
                      <p className="mt-2 text-sm font-semibold text-red-300">{coop ? 'Cả bàn thua khi:' : 'Bạn thua khi:'}</p>
                      <ul className="list-disc space-y-1 pl-5 text-sm leading-snug text-parchment">
                        {book.lose.map((r) => <li key={r}>{r}</li>)}
                      </ul>
                    </>
                  )}
                </section>
                {book.tokens?.length > 0 && (
                  <section className="rounded bg-[#4a2723]/50 p-3">
                    <SectionTitle>Vật dụng cần</SectionTitle>
                    <ul className="mt-1 space-y-0.5 text-sm text-parchment">
                      {book.tokens.map((t) => <li key={t}>{t}</li>)}
                    </ul>
                  </section>
                )}
                <section className="rounded border border-mortar/70 bg-black/20 p-3">
                  <SectionTitle tone="text-bone">Tình hình</SectionTitle>
                  <div className="mt-1"><HauntMeters data={haunt.data} /></div>
                </section>
                {book.tips?.length > 0 && (
                  <section className="rounded border border-mortar/50 p-3">
                    <SectionTitle tone="text-bone">Mẹo</SectionTitle>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-bone italic">
                      {book.tips.map((t) => <li key={t}>{t}</li>)}
                    </ul>
                  </section>
                )}
              </div>

              {/* Cột phải: hành động đặc biệt, luật riêng, quái vật */}
              <div className="md:border-l md:border-[#b89a4e]/60 md:pl-4">
                {actions.map((a) => <ActionBlock key={a.name} action={a} />)}
                {rules.length > 0 && (
                  <section className="mt-4">
                    <SectionTitle>Luật đặc biệt</SectionTitle>
                    <ul className="mt-1 list-disc space-y-1.5 pl-5 leading-snug text-parchment">
                      {rules.map((r) => <RuleBlock key={typeof r === 'string' ? r : r.title} rule={r} />)}
                    </ul>
                  </section>
                )}
                {haunt.monsters?.map((m) => <MonsterCard key={m.name} monster={m} />)}
              </div>
            </div>

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
          </>
        ) : (
          <>
            <p className="mt-4 border-l-2 border-mortar pl-3 text-bone italic">{haunt.publicIntro}</p>
            <p className="mt-4 text-bone italic">Bạn đang theo dõi với tư cách khán giả nên không có cuốn sách nào.</p>
          </>
        )}
      </article>
    </div>
  );
}
