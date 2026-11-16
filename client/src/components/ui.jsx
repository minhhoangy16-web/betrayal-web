// Các mảnh giao diện dùng chung.

import { useState } from 'react';
import { Zap, Dumbbell, Flame, Brain, Eye, Sparkles, Package, Skull } from 'lucide-react';

const TRAIT_ICONS = { speed: Zap, might: Dumbbell, sanity: Flame, knowledge: Brain };
const SYMBOL_ICONS = { omen: Eye, event: Sparkles, item: Package };

export function TraitIcon({ trait, size = 16, className = '' }) {
  const Icon = TRAIT_ICONS[trait];
  return <Icon size={size} className={className} aria-hidden="true" />;
}

export function SymbolIcon({ symbol, size = 16, className = '' }) {
  const Icon = SYMBOL_ICONS[symbol];
  return Icon ? <Icon size={size} className={className} aria-hidden="true" /> : null;
}

const BUTTON_STYLES = {
  primary: 'bg-blood text-parchment border-red-900 hover:bg-red-800',
  ghost: 'bg-stonework text-parchment border-mortar hover:bg-mortar',
  candle: 'bg-candle text-ink border-yellow-700 hover:bg-yellow-500',
};

export function Button({ variant = 'ghost', className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded border px-3 py-1.5 text-[15px] leading-tight
        transition-colors disabled:opacity-40 disabled:hover:bg-inherit ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Panel({ title, icon: Icon, action, className = '', children }) {
  return (
    <section className={`rounded-md border border-mortar bg-crypt/90 ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-mortar px-3 py-2">
          <h2 className="flex items-center gap-2 font-display text-sm tracking-widest text-bone uppercase">
            {Icon && <Icon size={15} aria-hidden="true" />}
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

// Ảnh minh hoạ tuỳ chọn (gạch, thẻ). Tự ẩn nếu file không tải được.
export function Art({ src, className = '', style }) {
  const [failed, setFailed] = useState(null);
  if (!src || failed === src) return null;
  return <img src={src} alt="" draggable={false} className={className} style={style} onError={() => setFailed(src)} />;
}

// Quân cờ tròn của người chơi: màu nhân vật + chữ cái đầu của tên.
export function PlayerToken({ player, character, size = 28, active = false, title }) {
  const style = {
    width: size,
    height: size,
    backgroundColor: player.alive ? character?.color ?? '#57534e' : '#292524',
    fontSize: size * 0.48,
  };
  return (
    <span
      title={title ?? player.name}
      style={style}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 font-display font-bold text-white
        ${active ? 'border-candle shadow-[0_0_10px_rgba(224,164,58,0.8)]' : 'border-black/70'}
        ${player.alive ? '' : 'opacity-60'}`}
    >
      {player.alive ? player.name.trim().charAt(0).toUpperCase() : <Skull size={size * 0.55} aria-hidden="true" />}
    </span>
  );
}

// Một viên xúc xắc 0 / 1 / 2 chấm.
export function Die({ value, tone = 'bone', delay = 0 }) {
  const tones = { bone: 'bg-parchment text-ink', blood: 'bg-blood text-parchment', ash: 'bg-stone-400 text-ink' };
  return (
    <span
      style={{ animationDelay: `${delay}ms` }}
      className={`die-pop inline-flex h-8 w-8 items-center justify-center gap-1 rounded-md border border-black/60 shadow ${tones[tone]}`}
      aria-label={`${value}`}
    >
      {Array.from({ length: value }, (_, i) => (
        <span key={i} className="h-2 w-2 rounded-full bg-current" />
      ))}
    </span>
  );
}
