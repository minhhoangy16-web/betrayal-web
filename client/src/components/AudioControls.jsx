// Nút tắt/bật tiếng và thanh âm lượng nhạc nền + hook nối trạng thái game với âm thanh.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AudioLines, Music, Volume2, VolumeX } from 'lucide-react';
import { audio } from '../lib/audio.js';
import { useGameStore } from '../store/useGameStore.js';
import Soundboard from './Soundboard.jsx';
import { MusicMenu } from './YouTubeMusic.jsx';

const CARD_KIND = { 'om-': 'omen', 'it-': 'item', 'ev-': 'event' };

// compact: chỉ nút tắt/bật tiếng, không có thanh âm lượng (cho màn hình hẹp).
export function AudioControls({ className = '', compact = false, up = false }) {
  const settings = useSyncExternalStore(audio.subscribe, audio.getSettings);
  const Icon = settings.muted ? VolumeX : Volume2;
  const [panel, setPanel] = useState(null); // 'board' | 'music' | null
  const toggle = (name) => setPanel((p) => (p === name ? null : name));
  return (
    <div className={`relative flex items-center gap-2 rounded border border-mortar bg-stonework px-2 py-1.5 ${className}`}>
      <button
        type="button"
        className="text-bone hover:text-parchment"
        onClick={() => audio.update({ muted: !settings.muted })}
        aria-label={settings.muted ? 'Bật tiếng' : 'Tắt tiếng'}
        aria-pressed={settings.muted}
      >
        <Icon size={17} aria-hidden="true" />
      </button>
      {!compact && settings.musicSource !== 'youtube' && <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={settings.muted ? 0 : settings.music}
        onChange={(e) => audio.update({ music: Number(e.target.value), muted: false })}
        className="h-1 w-20 cursor-pointer accent-[#e0a43a]"
        aria-label="Âm lượng nhạc nền"
      />}
      <button
        type="button"
        className={`hover:text-parchment ${settings.musicSource === 'youtube' ? 'text-candle' : 'text-bone'}`}
        onClick={() => toggle('music')}
        aria-label="Chọn nhạc nền"
        aria-expanded={panel === 'music'}
        title="Chọn nhạc nền"
      >
        <Music size={17} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="text-bone hover:text-parchment"
        onClick={() => toggle('board')}
        aria-label="Bảng âm thanh"
        title="Bảng âm thanh"
      >
        <AudioLines size={17} aria-hidden="true" />
      </button>
      {panel === 'music' && <MusicMenu up={up} onClose={() => setPanel(null)} />}
      {panel === 'board' && <Soundboard onClose={() => setPanel(null)} />}
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
    const beast = [roll.attacker, roll.defender].find((r) => r?.kind === 'monster');
    const type = beast && (g.monsters[beast.id]?.type ?? null);
    if (type) audio.play(type, 'monster', { delay: 0.6 });
  });
  useOnChange(g ? g.lastCard?.seq ?? 0 : null, () => {
    audio.sfx('card');
    const id = g.lastCard?.cardId;
    if (id) audio.play(id, CARD_KIND[id.slice(0, 3)], { delay: 0.45 });
  });
  // Phòng mới được đặt: tiếng cửa rồi âm thanh riêng của phòng.
  const tileKeys = g ? Object.keys(g.board.tiles) : null;
  useOnChange(tileKeys ? tileKeys.length : null, () => {
    audio.sfx('door');
    const seen = seenTiles.current;
    const fresh = tileKeys.find((key) => !seen.has(key));
    if (fresh) audio.play(g.board.tiles[fresh].tileId, 'room', { delay: 1.1 });
  });
  const seenTiles = useRef(new Set());
  useEffect(() => {
    seenTiles.current = new Set(tileKeys ?? []);
  });
  // Tiếng bước chân khi ai đó đi sang phòng khác (đổi tầng qua cầu thang thì nhiều bước hơn).
  const positions = g
    ? Object.values(g.players).map((p) => `${p.id}@${p.pos ? `${p.pos.floor}:${p.pos.x}:${p.pos.y}` : '-'}`).sort().join('|')
    : null;
  const lastPositions = useRef(null);
  useEffect(() => {
    if (!g) {
      lastPositions.current = null;
      return;
    }
    const now = Object.fromEntries(Object.values(g.players).map((p) => [p.id, p.pos]));
    const before = lastPositions.current;
    lastPositions.current = now;
    if (!before) return;
    const moved = Object.values(g.players).filter((p) => p.alive && p.pos && before[p.id]
      && (p.pos.floor !== before[p.id].floor || p.pos.x !== before[p.id].x || p.pos.y !== before[p.id].y));
    if (!moved.length) return;
    const mover = moved.find((p) => p.id === g.you) ?? moved[0];
    const stairs = mover.pos.floor !== before[mover.id].floor;
    audio.footsteps({ steps: stairs ? 4 : 2, mine: mover.id === g.you, echo: mover.pos.floor === 'basement' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  // Quái vật mới xuất hiện, hoặc quái vật tham gia một trận đánh.
  const monsterIds = g ? Object.keys(g.monsters).sort().join(',') : null;
  const knownMonsters = useRef(null);
  useEffect(() => {
    if (!g) {
      knownMonsters.current = null;
      return;
    }
    const before = knownMonsters.current;
    knownMonsters.current = new Set(Object.keys(g.monsters));
    if (!before) return;
    const fresh = Object.values(g.monsters).find((m) => !before.has(m.id));
    if (fresh) audio.play(fresh.type, 'monster', { delay: 0.3 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monsterIds]);
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
