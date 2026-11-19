// Cửa sổ xem túi đồ của một người chơi (bấm vào avatar trong danh sách người chơi hoặc trên bàn cờ).
// Thẻ trong túi là thông tin công khai; vật của kịch bản đang cầm cũng hiện ở đây.
// Chỉ xem: muốn dùng / trao thẻ thì dùng bảng «Túi đồ» của chính mình.

import { useEffect, useRef } from 'react';
import { Backpack, Skull, X } from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';
import { CARD_TYPE_LABEL, TRAITS, TRAIT_LABEL, mediaUrl } from '../lib/constants.js';
import { Art, PlayerToken, TraitIcon } from './ui.jsx';

const TYPE_TINT = { omen: 'text-violet-300', item: 'text-emerald-300', event: 'text-amber-300' };

export default function PlayerBag() {
  const playerId = useGameStore((s) => s.bagPlayerId);
  const game = useGameStore((s) => s.game);
  const catalog = useGameStore((s) => s.catalog);
  const cardImages = useGameStore((s) => s.media.cards);
  const viewCard = useGameStore((s) => s.viewCard);
  const viewBag = useGameStore((s) => s.viewBag);
  const closeRef = useRef(null);
  const close = () => viewBag(null);

  useEffect(() => {
    if (!playerId) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => {
      // Đang xem to một thẻ thì Esc đóng thẻ trước.
      if (e.key === 'Escape' && !useGameStore.getState().viewCardId) viewBag(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playerId, viewBag]);

  const player = playerId ? game?.players[playerId] : null;
  if (!player) return null;
  const character = catalog.charactersById[player.characterId];
  const carried = game.haunt?.data?.carried?.[player.id] ?? [];
  const isMe = player.id === game.you;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-bag-title"
        className="thin-scroll relative max-h-full w-full max-w-md overflow-y-auto rounded-md border-2 border-[#6b5a3c] bg-[#221c14] p-5 shadow-2xl"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          className="absolute top-3 right-3 rounded p-1 text-bone hover:bg-black/40"
          aria-label="Đóng"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <header className="flex items-center gap-3 pr-8">
          <PlayerToken player={player} character={character} size={44} />
          <div className="min-w-0">
            <h2 id="player-bag-title" className="flex items-center gap-2 font-display text-xl text-parchment">
              <Backpack size={18} className="text-candle" aria-hidden="true" />
              Túi đồ của {isMe ? 'bạn' : player.name}
            </h2>
            <p className="text-sm text-bone">
              {character?.name}
              {!player.alive && <span className="ml-1 inline-flex items-center gap-1 text-stone-500"><Skull size={13} aria-hidden="true" /> đã chết</span>}
              {player.escaped && <span className="text-emerald-300"> · đã thoát</span>}
            </p>
          </div>
        </header>

        {player.alive && (
          <div className="mt-3 grid grid-cols-4 gap-2 rounded border border-mortar/60 bg-black/20 p-2 text-center text-sm">
            {TRAITS.map((t) => (
              <span key={t} className="flex flex-col items-center">
                <span className="flex items-center gap-1 text-[11px] text-stone-400">
                  <TraitIcon trait={t} size={11} /> {TRAIT_LABEL[t]}
                </span>
                <strong className="font-display text-parchment">{player.traitValues[t]}</strong>
              </span>
            ))}
          </div>
        )}

        {carried.length > 0 && (
          <div className="mt-3 rounded border border-candle/50 bg-candle/10 px-3 py-2 text-sm">
            <span className="font-semibold text-candle">Vật của kịch bản: </span>
            <span className="text-parchment">{carried.join(', ')}</span>
          </div>
        )}

        <h3 className="mt-4 font-display text-sm tracking-widest text-bone uppercase">Thẻ ({player.cards.length})</h3>
        {player.hiddenOmens > 0 && (
          <p className="mt-1 text-sm text-violet-300 italic">+ {player.hiddenOmens} thẻ Điềm báo bị giấu với bạn.</p>
        )}
        {player.cards.length === 0 ? (
          <p className="mt-1 text-sm text-stone-500 italic">Chưa có thẻ nào.</p>
        ) : (
          <ul className="mt-1 divide-y divide-mortar/60">
            {player.cards.map((cardId) => {
              const card = catalog.cardsById[cardId];
              return (
                <li key={cardId}>
                  <button
                    type="button"
                    onClick={() => viewCard(cardId)}
                    className="flex w-full gap-3 py-2 text-left hover:bg-black/20"
                    aria-label={`Xem thẻ ${card.name}`}
                  >
                    <Art src={mediaUrl(cardImages[cardId])} className="h-14 w-14 shrink-0 rounded object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-sm text-parchment">{card.name}</span>
                        <span className={`shrink-0 text-[11px] tracking-wider uppercase ${TYPE_TINT[card.type]}`}>
                          {CARD_TYPE_LABEL[card.type]}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-sm leading-snug text-bone">{card.text}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {isMe && <p className="mt-3 text-xs text-stone-500">Muốn dùng hoặc trao thẻ, mở bảng «Túi đồ» của bạn.</p>}
      </section>
    </div>
  );
}
