// Mặt thẻ bài kiểu giấy cũ: hình bóng đen ở đầu thẻ, tên in hoa, dòng loại thẻ in nghiêng,
// nội dung, bảng kết quả theo điểm xúc xắc, và dòng nhắc Haunt Roll ở chân thẻ Điềm báo.
// Mọi chữ hiệu ứng được dựng từ dữ liệu thẻ của server, nên luôn khớp với luật thật.

import { Eye, Package, Sparkles } from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';
import { CARD_TYPE_LABEL, DAMAGE_LABEL, TRAIT_LABEL, mediaUrl } from '../lib/constants.js';
import { Art } from './ui.jsx';

export const CARD_THEME = {
  omen: { paper: '#c3c9a6', edge: '#7d8660', ink: '#1d2116', accent: '#4c5a2e', back: '#2a2f1e', icon: Eye },
  item: { paper: '#e4dcc4', edge: '#9a8d6c', ink: '#211b12', accent: '#5a4a2a', back: '#2b261b', icon: Package },
  event: { paper: '#e2c987', edge: '#a3843f', ink: '#24190a', accent: '#6b4a12', back: '#30230f', icon: Sparkles },
};

// Hạt giấy: nhiễu SVG nhúng thẳng làm nền, không cần file ảnh.
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>" +
  "<feColorMatrix values='0 0 0 0 0.25 0 0 0 0 0.2 0 0 0 0 0.12 0 0 0 0.35 0'/></filter>" +
  "<rect width='160' height='160' filter='url(%23n)'/></svg>\")";

// Mép giấy sờn: đa giác răng cưa nhẹ, cố định theo id thẻ.
function tornEdge(seed) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const pts = [];
  const steps = 14;
  const j = () => (rnd() * 1.4).toFixed(2);
  for (let i = 0; i <= steps; i++) pts.push(`${((i / steps) * 100).toFixed(1)}% ${j()}%`);
  for (let i = 1; i <= steps; i++) pts.push(`${100 - j()}% ${((i / steps) * 100).toFixed(1)}%`);
  for (let i = steps - 1; i >= 0; i--) pts.push(`${((i / steps) * 100).toFixed(1)}% ${100 - j()}%`);
  for (let i = steps - 1; i >= 1; i--) pts.push(`${j()}% ${((i / steps) * 100).toFixed(1)}%`);
  return `polygon(${pts.join(', ')})`;
}

const GROUP_LABEL = { physical: 'Tốc độ và Sức mạnh', mental: 'Tinh thần và Tri thức', any: 'mọi chỉ số' };

// Diễn giải một hiệu ứng (op) thành câu ngắn. Trả về null cho op không cần ghi.
export function describeEffect(effect, tilesById) {
  const n = effect.amount ?? 1;
  switch (effect.op) {
    case 'gain':
      if (effect.trait) return `+${n} ${TRAIT_LABEL[effect.trait]}`;
      if (effect.choice === 'mental') return `+${n} Tinh thần hoặc Tri thức (tuỳ chọn)`;
      if (effect.choice === 'physical') return `+${n} Tốc độ hoặc Sức mạnh (tuỳ chọn)`;
      return `+${n} một chỉ số tuỳ chọn`;
    case 'lose':
      return `−${n} ${TRAIT_LABEL[effect.trait]}`;
    case 'heal':
      return `Hồi ${GROUP_LABEL[effect.group] ?? effect.traits?.map((t) => TRAIT_LABEL[t]).join(', ')} về mức khởi đầu`;
    case 'damage':
      return effect.dice
        ? `Chịu sát thương ${DAMAGE_LABEL[effect.type]} bằng ${effect.dice} xúc xắc`
        : `Chịu ${n} sát thương ${DAMAGE_LABEL[effect.type]}`;
    case 'draw':
      return `Rút 1 thẻ ${CARD_TYPE_LABEL[effect.deck]}`;
    case 'teleport':
      return `Bị đưa tới ${tilesById?.[effect.tileId]?.name ?? 'một phòng khác'}`;
    default:
      return null;
  }
}

const summarize = (effects, tilesById) => {
  const parts = (effects ?? []).map((e) => describeEffect(e, tilesById)).filter(Boolean);
  return parts.length ? parts.join('. ') : 'Không có gì xảy ra';
};

// Nhãn khoảng điểm cho từng dòng kết quả: "4+", "2–3", "0–1", "0".
function outcomeRows(outcomes) {
  const sorted = [...outcomes].sort((a, b) => b.min - a.min);
  return sorted.map((o, i) => {
    const max = i === 0 ? null : sorted[i - 1].min - 1;
    const range = max === null ? `${o.min}+` : max === o.min ? `${o.min}` : `${o.min}–${max}`;
    return { range, ...o };
  });
}

function RollTable({ roll, theme, tilesById }) {
  const what = roll.trait ? `Đổ ${TRAIT_LABEL[roll.trait]}` : `Đổ ${roll.dice} xúc xắc`;
  return (
    <div className="mt-2">
      <p className="text-[0.92em] font-semibold">{what}:</p>
      <dl className="mt-1 space-y-1">
        {outcomeRows(roll.outcomes ?? []).map((row) => (
          <div key={row.range} className="flex gap-2">
            <dt className="w-9 shrink-0 font-display text-[0.95em] font-bold" style={{ color: theme.accent }}>{row.range}</dt>
            <dd className="min-w-0 leading-snug">
              {row.text && <span className="italic">{row.text} </span>}
              <span>{summarize(row.effects, tilesById)}.</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Các khối nội dung của thẻ, theo đúng dữ liệu.
function CardBody({ card, theme, tilesById }) {
  const blocks = [];
  if (card.type === 'event') {
    const roll = card.effects.find((e) => e.op === 'roll');
    if (roll) blocks.push(<RollTable key="roll" roll={roll} theme={theme} tilesById={tilesById} />);
    else blocks.push(<p key="fx" className="mt-2 font-semibold">{summarize(card.effects, tilesById)}.</p>);
  }
  if (card.weapon) {
    blocks.push(
      <p key="weapon" className="mt-2">
        <b>Vũ khí:</b> tấn công bằng {TRAIT_LABEL[card.weapon.trait]}
        {card.weapon.bonusDice ? `, +${card.weapon.bonusDice} xúc xắc` : ''}.
      </p>,
    );
  }
  if (card.onGain?.length) blocks.push(<p key="gain" className="mt-2"><b>Khi nhận:</b> {summarize(card.onGain, tilesById)}.</p>);
  if (card.onLose?.length) blocks.push(<p key="lose" className="mt-1"><b>Khi mất:</b> {summarize(card.onLose, tilesById)}.</p>);
  if (card.use) {
    const roll = card.use.effects.find((e) => e.op === 'roll');
    blocks.push(
      <div key="use" className="mt-2">
        <p><b>{card.use.consume ? 'Dùng rồi bỏ:' : 'Mỗi lượt một lần:'}</b>{roll ? '' : ` ${summarize(card.use.effects, tilesById)}.`}</p>
        {roll && <RollTable roll={roll} theme={theme} tilesById={tilesById} />}
      </div>,
    );
  }
  return blocks;
}

// size: 'lg' (popup) | 'md' | 'sm' (mini trong túi đồ)
export default function CardFace({ cardId, size = 'lg', className = '' }) {
  const catalog = useGameStore((s) => s.catalog);
  const glyph = useGameStore((s) => s.media.glyphs?.[cardId]);
  const card = catalog.cardsById[cardId];
  if (!card) return null;
  const theme = CARD_THEME[card.type];
  const Icon = theme.icon;
  const dims = {
    lg: { width: 300, font: 15, icon: 92, title: 22 },
    md: { width: 240, font: 13, icon: 70, title: 18 },
    sm: { width: 150, font: 9.5, icon: 44, title: 12 },
  }[size];

  return (
    <article
      className={`relative shrink-0 font-body ${className}`}
      style={{ width: dims.width, filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.55))' }}
      aria-label={`Thẻ ${CARD_TYPE_LABEL[card.type]}: ${card.name}`}
    >
      <div
        className="flex min-h-full flex-col px-[8%] pt-[7%] pb-[8%]"
        style={{
          clipPath: tornEdge(card.id),
          aspectRatio: '5 / 7',
          color: theme.ink,
          fontSize: dims.font,
          backgroundColor: theme.paper,
          backgroundImage: `${GRAIN}, radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.28), rgba(0,0,0,0) 60%), ` +
            `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, ${theme.edge} 120%)`,
          boxShadow: `inset 0 0 0 3px ${theme.edge}55, inset 0 0 26px ${theme.edge}`,
        }}
      >
        <div className="flex justify-center" style={{ height: dims.icon }}>
          {glyph ? (
            <Art src={mediaUrl(glyph)} className="h-full w-auto" style={{ filter: 'brightness(0)', opacity: 0.88 }} />
          ) : (
            <Icon size={dims.icon * 0.8} aria-hidden="true" />
          )}
        </div>
        <h3
          className="mt-1 text-center font-display leading-tight font-bold uppercase"
          style={{ fontSize: dims.title, letterSpacing: '0.04em' }}
        >
          {card.name}
        </h3>
        <p className="text-center italic opacity-80" style={{ fontSize: '0.9em' }}>
          {CARD_TYPE_LABEL[card.type]}{card.weapon ? ' · Vũ khí' : ''}
        </p>
        {size !== 'sm' && (
          <>
            <div className="mx-auto my-1.5 h-px w-2/3" style={{ backgroundColor: theme.edge }} />
            {/* Sự kiện: lời dẫn của thẻ. Điềm báo / Vật phẩm: luật được dựng từ dữ liệu bên dưới,
                nên không lặp lại phần tóm tắt. */}
            {card.type === 'event' && <p className="text-center leading-snug italic">{card.text}</p>}
            <div className="leading-snug">
              <CardBody card={card} theme={theme} tilesById={catalog.tilesById} />
            </div>
            <div className="flex-1" />
            {card.type === 'omen' && (
              <p className="mt-3 text-center italic opacity-75" style={{ fontSize: '0.82em' }}>
                Khi rút thẻ này, đổ Haunt Roll ngay. Bỏ qua nếu Haunt đã bắt đầu.
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
}

// Mặt sau thẻ (dùng cho chồng bài và hoạt ảnh rút bài).
export function CardBack({ type, width = 300, className = '', style }) {
  const theme = CARD_THEME[type];
  const Icon = theme.icon;
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-lg ${className}`}
      style={{
        width,
        aspectRatio: '5 / 7',
        background: `radial-gradient(circle at 50% 45%, ${theme.edge}, ${theme.back} 72%)`,
        border: `${Math.max(2, width / 60)}px solid ${theme.edge}`,
        boxShadow: `inset 0 0 0 ${Math.max(2, width / 40)}px ${theme.back}, inset 0 0 0 ${Math.max(3, width / 30)}px ${theme.edge}88`,
        ...style,
      }}
    >
      <Icon size={width * 0.32} color={theme.paper} aria-hidden="true" />
      {width >= 60 && (
        <span className="font-display font-bold tracking-[0.2em] uppercase" style={{ color: theme.paper, fontSize: width * 0.075 }}>
          {CARD_TYPE_LABEL[type]}
        </span>
      )}
    </div>
  );
}
