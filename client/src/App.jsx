import { useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useGameStore } from './store/useGameStore.js';
import { Home, LobbyRoom } from './components/Lobby.jsx';
import GameScreen from './components/GameScreen.jsx';
import { Button } from './components/ui.jsx';
import { AudioControls, useGameAudio } from './components/AudioControls.jsx';

function Toasts() {
  const toasts = useGameStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded border px-4 py-2 shadow-lg
            ${t.kind === 'error' ? 'border-red-800 bg-[#2b1111] text-red-100' : 'border-mortar bg-stonework text-parchment'}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Centered({ children }) {
  return <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">{children}</div>;
}

export default function App() {
  const init = useGameStore((s) => s.init);
  const connected = useGameStore((s) => s.connected);
  const catalog = useGameStore((s) => s.catalog);
  const catalogError = useGameStore((s) => s.catalogError);
  const loadCatalog = useGameStore((s) => s.loadCatalog);
  const session = useGameStore((s) => s.session);
  const lobby = useGameStore((s) => s.lobby);
  const game = useGameStore((s) => s.game);

  useEffect(() => {
    init();
  }, [init]);
  useGameAudio();

  const inGame = Boolean(catalog && session && lobby && lobby.status !== 'lobby' && game);

  let screen;
  if (!catalog) {
    screen = catalogError ? (
      <Centered>
        <WifiOff size={30} className="text-ember" aria-hidden="true" />
        <p>{catalogError}</p>
        <p className="text-sm text-bone">Máy chủ có thể đang khởi động lại – chờ khoảng một phút rồi thử lại.</p>
        <Button onClick={loadCatalog}>Thử lại</Button>
      </Centered>
    ) : (
      <Centered><p className="flicker text-bone italic">Đang thắp nến…</p></Centered>
    );
  } else if (session && lobby && lobby.status !== 'lobby' && game) {
    screen = <GameScreen />;
  } else if (session && lobby && lobby.status === 'lobby') {
    screen = <LobbyRoom />;
  } else if (session) {
    screen = <Centered><p className="flicker text-bone italic">Đang quay lại phòng {session.code}…</p></Centered>;
  } else {
    screen = <Home />;
  }

  return (
    <>
      {catalog && !connected && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-blood py-1 text-sm text-parchment" role="alert">
          <WifiOff size={15} aria-hidden="true" /> Mất kết nối với máy chủ – đang thử kết nối lại…
        </div>
      )}
      {screen}
      {/* Trong ván, nút âm thanh nằm trên thanh trạng thái. */}
      {!inGame && <AudioControls className="fixed bottom-3 left-3 z-40" />}
      <Toasts />
    </>
  );
}
