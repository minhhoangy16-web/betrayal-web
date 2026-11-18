// Thanh báo khi người cần hành động đang mất kết nối: đếm ngược tới lúc tự bỏ lượt,
// và nút "Bỏ qua lượt" cho chủ phòng.

import { useEffect, useState } from 'react';
import { SkipForward, WifiOff } from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';
import { Button } from './ui.jsx';

export default function DisconnectBanner() {
  const lobby = useGameStore((s) => s.lobby);
  const session = useGameStore((s) => s.session);
  const game = useGameStore((s) => s.game);
  const skipTurn = useGameStore((s) => s.skipTurn);
  const autoSkip = lobby?.autoSkip;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!autoSkip) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [autoSkip]);

  if (!autoSkip || game?.winner) return null;
  const name = game?.players[autoSkip.playerId]?.name ?? 'Một người chơi';
  const seconds = Math.max(0, Math.ceil((autoSkip.deadline - now) / 1000));
  const isHost = lobby.hostId === session?.playerId;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-red-900 bg-[#2b1111] px-3 py-1.5 text-sm text-red-100" role="status">
      <WifiOff size={15} className="shrink-0" aria-hidden="true" />
      <span>
        <strong>{name}</strong> mất kết nối. {seconds > 0 ? `Tự bỏ lượt sau ${seconds} giây` : 'Đang bỏ lượt'} nếu không quay lại.
      </span>
      {isHost && (
        <Button className="px-2! py-0.5! text-sm" onClick={skipTurn}>
          <SkipForward size={14} aria-hidden="true" /> Bỏ qua lượt ngay
        </Button>
      )}
    </div>
  );
}
