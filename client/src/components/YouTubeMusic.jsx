// Nhạc nền từ YouTube: phát qua trình phát nhúng chính thức của YouTube (không tải hay lưu bản nhạc nào).
// Mỗi người tự chọn trên máy mình; trình phát hiện ở góc màn hình để chỉnh âm lượng / chuyển bài.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, ChevronUp, Music, X } from 'lucide-react';
import { audio } from '../lib/audio.js';

export const TRACKS = [
  { id: 'R7y0fVUjZSc', title: 'Underground', from: 'Resident Evil Remake' },
  { id: 'WShknpNpHbY', title: 'Betrayal', from: 'Silent Hill 2' },
  { id: 'fuX5-BPOrak', title: 'Warehouse', from: "The Witch's House" },
  { id: 'iGqDSFu61UM', title: 'Wandering About ~ Mansion 2nd Floor', from: 'Resident Evil' },
  { id: 'SDx7nFQzVos', title: 'Dining Room', from: 'Ib' },
];

const useSettings = () => useSyncExternalStore(audio.subscribe, audio.getSettings);

function embedUrl(start) {
  const order = [...TRACKS.slice(start), ...TRACKS.slice(0, start)].map((t) => t.id);
  const params = new URLSearchParams({ playlist: order.slice(1).join(','), loop: '1', autoplay: '1', rel: '0', modestbranding: '1' });
  return `https://www.youtube-nocookie.com/embed/${order[0]}?${params}`;
}

export function MusicMenu({ onClose, up = false }) {
  const settings = useSettings();
  const ref = useRef(null);
  useEffect(() => {
    const away = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const esc = (e) => e.key === 'Escape' && onClose();
    setTimeout(() => window.addEventListener('pointerdown', away));
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const youtube = settings.musicSource === 'youtube';
  const choose = (patch) => audio.update(patch);
  const option = 'flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-white/5';

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Nhạc nền"
      className={`absolute z-50 w-72 ${up ? 'bottom-full left-0 mb-2' : 'top-full right-0 mt-2'} rounded-md border border-mortar bg-[#1b1611] p-2 shadow-2xl max-sm:fixed max-sm:inset-x-3 max-sm:top-14 max-sm:w-auto`}
    >
      <p className="px-2 pb-1 text-xs tracking-widest text-stone-500 uppercase">Nhạc nền</p>
      <button type="button" role="menuitemradio" aria-checked={!youtube} className={option} onClick={() => choose({ musicSource: 'synth' })}>
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full border ${!youtube ? 'border-candle bg-candle' : 'border-stone-500'}`} />
        <span>
          <span className="block text-parchment">Nhạc tổng hợp của game</span>
          <span className="block text-xs text-stone-500">Đổi không khí theo giai đoạn, không cần mạng</span>
        </span>
      </button>
      <p className="mt-2 px-2 pb-1 text-xs tracking-widest text-stone-500 uppercase">Danh sách phát YouTube</p>
      {TRACKS.map((t, i) => {
        const on = youtube && settings.youtubeStart === i;
        return (
          <button key={t.id} type="button" role="menuitemradio" aria-checked={on} className={option}
            onClick={() => choose({ musicSource: 'youtube', youtubeStart: i, muted: false })}>
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full border ${on ? 'border-candle bg-candle' : 'border-stone-500'}`} />
            <span>
              <span className="block text-parchment">{t.title}</span>
              <span className="block text-xs text-stone-500">{t.from}</span>
            </span>
          </button>
        );
      })}
      <p className="mt-2 px-2 text-xs leading-snug text-stone-500">
        Phát bằng trình phát YouTube ở góc màn hình, lần lượt cả 5 bài rồi lặp lại. Chỉnh âm lượng nhạc ngay trên trình phát đó.
      </p>
    </div>
  );
}

// Trình phát nhỏ ở góc màn hình, chỉ hiện khi chọn nhạc YouTube.
export function YouTubeDock() {
  const settings = useSettings();
  const [open, setOpen] = useState(true);
  if (settings.musicSource !== 'youtube') return null;
  const track = TRACKS[settings.youtubeStart] ?? TRACKS[0];
  return (
    <aside className="fixed right-3 bottom-3 z-40 w-64 overflow-hidden rounded-md border border-mortar bg-[#1b1611] shadow-2xl" aria-label="Trình phát nhạc YouTube">
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-bone">
        <Music size={14} className="shrink-0 text-candle" aria-hidden="true" />
        <span className="truncate">Bắt đầu từ: {track.title}</span>
        <button type="button" className="ml-auto rounded p-0.5 hover:bg-white/10" onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Thu nhỏ trình phát' : 'Mở rộng trình phát'}>
          {open ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}
        </button>
        <button type="button" className="rounded p-0.5 hover:bg-white/10" onClick={() => audio.update({ musicSource: 'synth' })}
          aria-label="Tắt nhạc YouTube, dùng lại nhạc của game">
          <X size={15} aria-hidden="true" />
        </button>
      </div>
      {/* Giữ iframe khi thu nhỏ để nhạc không bị ngắt. */}
      <div className={open ? 'aspect-video' : 'h-0'}>
        <iframe
          key={track.id}
          src={embedUrl(settings.youtubeStart ?? 0)}
          title="Nhạc nền YouTube"
          className="h-full w-full"
          allow="autoplay; encrypted-media"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </aside>
  );
}
