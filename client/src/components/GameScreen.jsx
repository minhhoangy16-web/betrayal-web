// Màn hình ván chơi.
//  - Màn hình rộng (từ 1024px): ba cột – thông tin bên trái, bàn cờ ở giữa, hành động và nhật ký bên phải.
//  - Điện thoại / màn hình hẹp: bàn cờ ở trên, bên dưới là các tab (Lượt, Nhân vật, Túi đồ, Nhật ký);
//    tự chuyển về tab Lượt khi tới lượt bạn.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Backpack, BookOpen, Eye, Layers, LogOut, ScrollText, Skull, Swords, Trophy, UserRound } from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';
import { SIDE_LABEL } from '../lib/constants.js';
import { Button } from './ui.jsx';
import Board from './Board.jsx';
import CharacterSheet from './TraitPanel.jsx';
import ActionPanel from './ActionPanel.jsx';
import HauntBook from './HauntBook.jsx';
import DisconnectBanner from './DisconnectBanner.jsx';
import { CardViewer } from './TableEffects.jsx';
import { AudioControls, useTurnAlert } from './AudioControls.jsx';
import { DiceTray, Inventory, LastCard, LogPanel, PlayerList } from './SidePanels.jsx';

const PHASE_LABEL = { explore: 'Khám phá', haunt: 'Haunt', ended: 'Kết thúc' };
const WIDE_QUERY = '(min-width: 1024px)';

function useIsWide() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(WIDE_QUERY);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(WIDE_QUERY).matches,
  );
}

function TopBar({ onOpenBook, wide }) {
  const game = useGameStore((s) => s.game);
  const leave = useGameStore((s) => s.leave);
  const me = game.players[game.you];
  const dicePreview = Math.min(game.rules.maxDice, game.omensRevealed);
  return (
    <header className="flex items-center gap-x-3 border-b border-mortar bg-ink/80 px-3 py-2 lg:flex-wrap lg:gap-x-5 lg:gap-y-1 lg:px-4">
      <span className="font-display text-base tracking-[0.15em] text-candle lg:text-lg lg:tracking-[0.25em]">{game.code}</span>
      <span className={`rounded px-2 py-0.5 font-display text-xs tracking-widest uppercase
        ${game.phase === 'explore' ? 'bg-stonework text-bone' : 'bg-blood text-parchment'}`}>
        {PHASE_LABEL[game.phase]}
      </span>
      <span className="text-sm whitespace-nowrap text-bone">{wide ? `Vòng ${game.round}` : `V${game.round}`}</span>
      <span
        className="flex items-center gap-1.5 text-sm text-violet-300"
        title={game.phase === 'explore'
          ? `Lần Haunt Roll kế tiếp sẽ đổ ${Math.min(game.rules.maxDice, dicePreview + 1)} xúc xắc, cần ${game.rules.hauntRollThreshold}+`
          : 'Số Điềm báo đã lật'}
      >
        <Eye size={15} aria-hidden="true" /> {game.omensRevealed}<span className="hidden sm:inline"> Điềm báo</span>
      </span>
      <span className="hidden items-center gap-1.5 text-sm text-bone sm:flex" title="Số gạch còn lại trong chồng">
        <Layers size={15} aria-hidden="true" /> {game.stacks.tiles} gạch
      </span>
      {me && game.phase !== 'explore' && (
        <span className={`text-sm font-semibold ${me.side === 'traitor' ? 'text-red-400' : 'text-emerald-300'}`}>
          {wide ? `Bạn là ${SIDE_LABEL[me.side]}` : SIDE_LABEL[me.side]}
        </span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1.5 lg:gap-2">
        <AudioControls compact={!wide} />
        {game.haunt && (
          <Button variant="candle" onClick={onOpenBook} aria-label="Sách Haunt">
            <BookOpen size={16} aria-hidden="true" /><span className="hidden sm:inline">Sách Haunt</span>
          </Button>
        )}
        <Button onClick={leave} title="Rời phòng" aria-label="Rời phòng">
          <LogOut size={16} aria-hidden="true" /><span className="hidden sm:inline">Rời</span>
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
      <div className="absolute inset-x-0 bottom-3 z-[60] flex justify-center">
        <Button variant="candle" onClick={() => setHidden(false)}>
          <Icon size={16} aria-hidden="true" /> {title}
        </Button>
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
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

function CharacterPanel({ inspected, character, isMe }) {
  return <CharacterSheet player={inspected} character={character} isMe={isMe} />;
}

const TABS = [
  { id: 'turn', label: 'Lượt', icon: Swords },
  { id: 'stats', label: 'Nhân vật', icon: UserRound },
  { id: 'bag', label: 'Túi đồ', icon: Backpack },
  { id: 'log', label: 'Nhật ký', icon: ScrollText },
];

export default function GameScreen() {
  const game = useGameStore((s) => s.game);
  const catalog = useGameStore((s) => s.catalog);
  const wide = useIsWide();
  const [bookOpen, setBookOpen] = useState(false);
  const [inspectedId, setInspectedId] = useState(game.you ?? game.turnOrder[0]);
  const [tab, setTab] = useState('turn');

  // Cần bạn hành động (tới lượt, hoặc được hỏi đổ xúc xắc / chia sát thương…).
  const needsMe = game.legal.length > 0 && !game.winner;
  useTurnAlert(needsMe);
  const wasNeeded = useRef(needsMe);
  useEffect(() => {
    if (needsMe && !wasNeeded.current) setTab('turn');
    wasNeeded.current = needsMe;
  }, [needsMe]);

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
  const me = game.players[game.you];
  const bagCount = me?.cards.length ?? 0;

  const boardArea = (
    <main className={`relative ${wide ? 'min-h-[420px]' : 'h-[50dvh] min-h-[280px] shrink-0 px-2 pt-2'}`}>
      <Board />
      {game.winner && <WinnerBanner />}
    </main>
  );

  return (
    <div className="flex h-full flex-col">
      <TopBar onOpenBook={() => setBookOpen(true)} wide={wide} />
      <DisconnectBanner />
      {wide ? (
        <div className="grid min-h-0 flex-1 grid-cols-[310px_minmax(0,1fr)_340px] gap-3 p-3">
          <aside className="thin-scroll flex min-h-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
            <PlayerList inspectedId={inspected.id} onInspect={setInspectedId} />
            <CharacterPanel inspected={inspected} character={inspectedCharacter} isMe={inspected.id === game.you} />
            <Inventory />
          </aside>
          {boardArea}
          <aside className="flex min-h-0 flex-col gap-3">
            <div className="thin-scroll flex max-h-[62%] shrink-0 flex-col gap-3 overflow-y-auto">
              <ActionPanel />
              <LastCard />
              <DiceTray />
            </div>
            <LogPanel />
          </aside>
        </div>
      ) : (
        <>
          {boardArea}
          <nav className="mt-2 flex shrink-0 border-y border-mortar bg-ink/90" role="tablist" aria-label="Bảng thông tin">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[12px]
                  ${tab === id ? 'bg-stonework text-candle' : 'text-bone'}`}
              >
                <Icon size={17} aria-hidden="true" />
                {label}
                {id === 'turn' && needsMe && tab !== 'turn' && (
                  <span className="absolute top-1 right-[calc(50%-18px)] h-2.5 w-2.5 rounded-full bg-red-500" aria-label="Tới lượt bạn" />
                )}
                {id === 'bag' && bagCount > 0 && (
                  <span className="absolute top-1 right-[calc(50%-20px)] rounded-full bg-mortar px-1 text-[10px] text-parchment">{bagCount}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-2" role="tabpanel">
            {tab === 'turn' && (
              <div className="flex flex-col gap-2">
                <ActionPanel />
                <LastCard />
                <DiceTray />
              </div>
            )}
            {tab === 'stats' && (
              <div className="flex flex-col gap-2">
                <PlayerList inspectedId={inspected.id} onInspect={setInspectedId} />
                <CharacterPanel inspected={inspected} character={inspectedCharacter} isMe={inspected.id === game.you} />
              </div>
            )}
            {tab === 'bag' && <Inventory />}
            {tab === 'log' && <div className="flex h-full min-h-[240px] flex-col"><LogPanel /></div>}
          </div>
        </>
      )}
      {bookOpen && game.haunt && <HauntBook onClose={() => setBookOpen(false)} />}
      <CardViewer />
    </div>
  );
}
