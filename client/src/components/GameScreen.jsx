// Màn hình ván chơi: thanh trạng thái, bàn cờ ở giữa, hai cột thông tin hai bên.

import { useEffect, useState } from 'react';
import { BookOpen, Eye, Layers, LogOut, Skull, Trophy, UserRound } from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';
import { SIDE_LABEL } from '../lib/constants.js';
import { Button, Panel } from './ui.jsx';
import Board from './Board.jsx';
import TraitPanel from './TraitPanel.jsx';
import ActionPanel from './ActionPanel.jsx';
import HauntBook from './HauntBook.jsx';
import { AudioControls } from './AudioControls.jsx';
import { DiceTray, Inventory, LastCard, LogPanel, PlayerList } from './SidePanels.jsx';

const PHASE_LABEL = { explore: 'Khám phá', haunt: 'Haunt', ended: 'Kết thúc' };

function TopBar({ onOpenBook }) {
  const game = useGameStore((s) => s.game);
  const leave = useGameStore((s) => s.leave);
  const me = game.players[game.you];
  const dicePreview = Math.min(game.rules.maxDice, game.omensRevealed);
  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-mortar bg-ink/80 px-4 py-2">
      <span className="font-display text-lg tracking-[0.25em] text-candle">{game.code}</span>
      <span className={`rounded px-2 py-0.5 font-display text-xs tracking-widest uppercase
        ${game.phase === 'explore' ? 'bg-stonework text-bone' : 'bg-blood text-parchment'}`}>
        {PHASE_LABEL[game.phase]}
      </span>
      <span className="text-sm text-bone">Vòng {game.round}</span>
      <span
        className="flex items-center gap-1.5 text-sm text-violet-300"
        title={game.phase === 'explore'
          ? `Lần Haunt Roll kế tiếp sẽ đổ ${Math.min(game.rules.maxDice, dicePreview + 1)} xúc xắc, cần ${game.rules.hauntRollThreshold}+`
          : 'Số Điềm báo đã lật'}
      >
        <Eye size={15} aria-hidden="true" /> {game.omensRevealed} Điềm báo
      </span>
      <span className="flex items-center gap-1.5 text-sm text-bone" title="Số gạch còn lại trong chồng">
        <Layers size={15} aria-hidden="true" /> {game.stacks.tiles} gạch
      </span>
      {me && game.phase !== 'explore' && (
        <span className={`text-sm font-semibold ${me.side === 'traitor' ? 'text-red-400' : 'text-emerald-300'}`}>
          Bạn là {SIDE_LABEL[me.side]}
        </span>
      )}
      <span className="ml-auto flex items-center gap-2">
        <AudioControls />
        {game.haunt && (
          <Button variant="candle" onClick={onOpenBook}>
            <BookOpen size={16} aria-hidden="true" /> Sách Haunt
          </Button>
        )}
        <Button onClick={leave} title="Rời phòng">
          <LogOut size={16} aria-hidden="true" /> Rời
        </Button>
      </span>
    </header>
  );
}

function WinnerBanner() {
  const game = useGameStore((s) => s.game);
  const leave = useGameStore((s) => s.leave);
  const [hidden, setHidden] = useState(false);
  const me = game.players[game.you];
  const heroesWon = game.winner.side === 'heroes';
  const iWon = me && ((heroesWon && me.side === 'hero') || (!heroesWon && me.side === 'traitor'));
  const Icon = heroesWon ? Trophy : Skull;
  const title = heroesWon ? 'Những người sống sót chiến thắng' : 'Kẻ phản bội chiến thắng';

  // Thu gọn để xem lại bàn cờ sau khi ván kết thúc.
  if (hidden) {
    return (
      <div className="absolute inset-x-0 bottom-3 z-30 flex justify-center">
        <Button variant="candle" onClick={() => setHidden(false)}>
          <Icon size={16} aria-hidden="true" /> {title}
        </Button>
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/50 px-4">
      <div className={`pointer-events-auto max-w-lg rounded-md border-2 p-5 text-center shadow-2xl
        ${heroesWon ? 'border-candle bg-[#221c14]' : 'border-blood bg-[#1d0f0f]'}`}>
        <Icon size={34} className={`mx-auto ${heroesWon ? 'text-candle' : 'text-red-400'}`} aria-hidden="true" />
        <h2 className="mt-2 font-display text-2xl text-parchment">{title}</h2>
        <p className="mt-1 text-bone italic">{game.winner.reason}</p>
        {me && <p className="mt-2 font-semibold">{iWon ? 'Bạn đã thắng.' : 'Bạn đã thua.'}</p>}
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => setHidden(true)}>Xem bàn cờ</Button>
          <Button variant="primary" onClick={leave}>Về trang chủ</Button>
        </div>
      </div>
    </div>
  );
}

export default function GameScreen() {
  const game = useGameStore((s) => s.game);
  const catalog = useGameStore((s) => s.catalog);
  const [bookOpen, setBookOpen] = useState(false);
  const [inspectedId, setInspectedId] = useState(game.you ?? game.turnOrder[0]);

  // Tự mở sách đúng một lần khi Haunt bắt đầu (kể cả sau khi tải lại trang).
  const hauntId = game.haunt?.id;
  useEffect(() => {
    if (!hauntId) return;
    const key = `betrayal.bookSeen.${game.code}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Không có storage: cứ mở sách.
    }
    setBookOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hauntId]);

  const inspected = game.players[inspectedId] ?? game.players[game.turnOrder[0]];
  const inspectedCharacter = catalog.charactersById[inspected.characterId];

  return (
    <div className="flex h-full flex-col">
      <TopBar onOpenBook={() => setBookOpen(true)} />
      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[310px_minmax(0,1fr)_340px]">
        <aside className="thin-scroll flex min-h-0 flex-col gap-3 overflow-y-auto">
          <PlayerList inspectedId={inspected.id} onInspect={setInspectedId} />
          <Panel
            title={inspected.id === game.you ? 'Nhân vật của bạn' : inspected.name}
            icon={UserRound}
            action={<span className="truncate text-xs text-stone-500">{inspectedCharacter.name}</span>}
          >
            <TraitPanel player={inspected} character={inspectedCharacter} />
          </Panel>
          <Inventory />
        </aside>

        <main className="relative min-h-[420px]">
          <Board />
          {game.winner && <WinnerBanner />}
        </main>

        <aside className="flex min-h-0 flex-col gap-3">
          <div className="thin-scroll flex max-h-[62%] shrink-0 flex-col gap-3 overflow-y-auto">
            <ActionPanel />
            <DiceTray />
            <LastCard />
          </div>
          <LogPanel />
        </aside>
      </div>
      {bookOpen && game.haunt && <HauntBook onClose={() => setBookOpen(false)} />}
    </div>
  );
}
