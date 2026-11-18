// Nút tắt/bật tiếng và thanh âm lượng nhạc nền + hook nối trạng thái game với âm thanh.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { audio } from '../lib/audio.js';
import { useGameStore } from '../store/useGameStore.js';

// compact: chỉ nút tắt/bật tiếng, không có thanh âm lượng (cho màn hình hẹp).
export function AudioControls({ className = '', compact = false }) {
  const settings = useSyncExternalStore(audio.subscribe, audio.getSettings);
  const Icon = settings.muted ? VolumeX : Volume2;
  return (
    <div className={`flex items-center gap-2 rounded border border-mortar bg-stonework px-2 py-1.5 ${className}`}>
      <button
        type="button"
        className="text-bone hover:text-parchment"
        onClick={() => audio.update({ muted: !settings.muted })}
        aria-label={settings.muted ? 'Bật tiếng' : 'Tắt tiếng'}
        aria-pressed={settings.muted}
      >
        <Icon size={17} aria-hidden="true" />
      </button>
      {!compact && <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={settings.muted ? 0 : settings.music}
        onChange={(e) => audio.update({ music: Number(e.target.value), muted: false })}
        className="h-1 w-20 cursor-pointer accent-[#e0a43a]"
        aria-label="Âm lượng nhạc nền"
      />}
    </div>
  );
}

// Gọi fn(value, previous) mỗi khi value đổi, bỏ qua lần đầu tiên có dữ liệu
// (để tải lại trang giữa ván không phát lại âm thanh của sự kiện cũ).
function useOnChange(value, fn) {
  const prev = useRef(value);
  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (before !== null && value !== null && before !== value) fn(value, before);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}

export function useGameAudio() {
  const session = useGameStore((s) => s.session);
  const lobby = useGameStore((s) => s.lobby);
  const game = useGameStore((s) => s.game);
  const inGame = Boolean(session && lobby && lobby.status !== 'lobby' && game);

  // Trình duyệt chặn âm thanh cho tới khi người dùng thao tác lần đầu.
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Nhạc nền theo giai đoạn.
  const mood = !inGame ? 'lobby' : game.phase === 'haunt' ? 'haunt' : game.phase === 'ended' ? 'ended' : 'explore';
  useEffect(() => {
    audio.setMood(mood);
  }, [mood]);

  // Hiệu ứng theo sự kiện. null = chưa có ván (không so sánh).
  const g = inGame ? game : null;
  const me = g?.players[g.you];
  useOnChange(g ? g.lastRoll?.seq ?? 0 : null, () => {
    const roll = g.lastRoll;
    audio.sfx('dice', { count: roll.dice?.length ?? roll.attacker?.dice.length ?? 3 });
  });
  useOnChange(g ? g.lastCard?.seq ?? 0 : null, () => audio.sfx('card'));
  useOnChange(g ? Object.keys(g.board.tiles).length : null, () => audio.sfx('door'));
  useOnChange(g ? g.haunt?.id ?? '' : null, (now) => now && audio.sfx('haunt'));
  useOnChange(g ? Boolean(g.winner) : null, (now) => now && audio.sfx('end'));
  const myTotal = me ? Object.values(me.traits).reduce((a, b) => a + b, 0) : null;
  useOnChange(myTotal, (now, before) => now < before && audio.sfx('hit'));
}

// Báo cho người chơi biết tới lượt họ: âm báo, rung (điện thoại), và tiêu đề tab nhấp nháy khi họ
// đang ở tab hoặc ứng dụng khác. Chỉ báo khi chuyển từ "đang chờ" sang "cần bạn hành động".
export function useTurnAlert(needsMe) {
  const prev = useRef(needsMe);
  useEffect(() => {
    const was = prev.current;
    prev.current = needsMe;
    if (needsMe && !was) {
      audio.sfx('turn');
      try {
        navigator.vibrate?.([120, 80, 120]);
      } catch {
        // Trình duyệt không hỗ trợ rung.
      }
    }
  }, [needsMe]);

  useEffect(() => {
    if (!needsMe) return undefined;
    const original = document.title;
    let on = false;
    const id = setInterval(() => {
      if (!document.hidden) {
        if (on) document.title = original;
        on = false;
        return;
      }
      on = !on;
      document.title = on ? '🔔 Tới lượt bạn!' : original;
    }, 1000);
    return () => {
      clearInterval(id);
      document.title = original;
    };
  }, [needsMe]);
}
