// Màn hình ngoài ván chơi: trang chủ (tạo / vào phòng) và phòng chờ (chọn nhân vật).

import { useState } from 'react';
import { Check, Copy, Crown, DoorOpen, LogOut, Play, UserX, Users, WifiOff } from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';
import { Art, Button, Panel, TraitIcon } from './ui.jsx';
import { TRAITS, TRAIT_LABEL, mediaUrl } from '../lib/constants.js';
import { SCENARIO_ICON, ScenarioFace } from './ScenarioCard.jsx';

const inputClass =
  'w-full rounded border border-mortar bg-ink px-3 py-2 text-parchment placeholder:text-stone-600 ' +
  'focus:border-candle focus:outline-none';

export function Home() {
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const connected = useGameStore((s) => s.connected);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };
  const hasName = name.trim().length > 0;

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="flicker text-center font-display text-4xl font-bold tracking-[0.2em] text-parchment">
        NGÔI NHÀ
        <span className="mt-1 block text-lg tracking-[0.5em] text-blood">TRÊN ĐỒI</span>
      </h1>
      <p className="mt-4 text-center text-bone italic">
        Ba đến sáu người bước qua cánh cửa. Một người sẽ không còn đứng về phía các bạn.
      </p>

      <Panel className="mt-8 p-5">
        <label className="block text-sm text-bone" htmlFor="player-name">Tên của bạn</label>
        <input
          id="player-name"
          className={`${inputClass} mt-1`}
          value={name}
          maxLength={20}
          placeholder="Ví dụ: An"
          onChange={(e) => setName(e.target.value)}
        />

        <Button
          variant="primary"
          className="mt-4 w-full py-2.5"
          disabled={!hasName || busy || !connected}
          onClick={() => run(() => createRoom(name))}
        >
          <DoorOpen size={18} aria-hidden="true" /> Tạo phòng mới
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs tracking-widest text-stone-500 uppercase">
          <span className="h-px flex-1 bg-mortar" /> hoặc <span className="h-px flex-1 bg-mortar" />
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (hasName && code.trim()) run(() => joinRoom(code, name));
          }}
        >
          <input
            className={`${inputClass} font-display tracking-[0.3em] uppercase`}
            value={code}
            maxLength={5}
            placeholder="MÃ PHÒNG"
            aria-label="Mã phòng"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <Button type="submit" className="shrink-0 px-4" disabled={!hasName || code.trim().length < 5 || busy || !connected}>
            Vào phòng
          </Button>
        </form>
      </Panel>
    </main>
  );
}

function CharacterCard({ character, owner, mine, disabled, onPick }) {
  const portrait = useGameStore((s) => s.media.portraits?.[character.id]);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      aria-pressed={mine}
      className={`overflow-hidden rounded-md border p-3 text-left transition-colors
        ${mine ? 'border-candle bg-stonework' : 'border-mortar bg-crypt hover:border-bone'}
        disabled:opacity-45 disabled:hover:border-mortar`}
    >
      <div
        className="relative -mx-3 -mt-3 mb-1 aspect-[5/4] overflow-hidden rounded-t-md"
        style={{ backgroundColor: character.color, borderBottom: `3px solid ${character.color}` }}
      >
        <Art src={mediaUrl(portrait)} className="absolute inset-0 h-full w-full object-cover object-[50%_20%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-1.5 px-2 text-center">
          <div className="truncate font-display text-base font-bold text-white uppercase [text-shadow:0_2px_5px_#000]">{character.name}</div>
          <div className="text-xs text-bone">{character.age} tuổi</div>
        </div>
      </div>
      <p className="mt-2 min-h-10 text-sm leading-snug text-bone italic">{character.bio}</p>
      <dl className="mt-2 grid grid-cols-4 gap-1 text-center">
        {TRAITS.map((trait) => {
          const { track, start } = character.traits[trait];
          return (
            <div key={trait} className="rounded bg-ink py-1" title={`${TRAIT_LABEL[trait]}: ${track.join(' · ')}`}>
              <dt className="flex justify-center text-stone-500"><TraitIcon trait={trait} size={13} /></dt>
              <dd className="font-display text-sm text-parchment">{track[start]}</dd>
            </div>
          );
        })}
      </dl>
      <div className="mt-2 h-5 text-xs">
        {owner && (
          <span className={mine ? 'flex items-center gap-1 text-candle' : 'text-stone-500'}>
            {mine && <Check size={13} aria-hidden="true" />}
            {mine ? 'Bạn đã chọn' : `${owner.name} đã chọn`}
          </span>
        )}
      </div>
    </button>
  );
}

// Chọn thẻ kịch bản: chủ phòng bấm chọn, người khác chỉ xem. 'random' = rút ngẫu nhiên khi bắt đầu.
function ScenarioPicker({ isHost }) {
  const catalog = useGameStore((s) => s.catalog);
  const lobby = useGameStore((s) => s.lobby);
  const setScenario = useGameStore((s) => s.setScenario);
  const [preview, setPreview] = useState(null);
  const current = lobby.scenarioId ?? 'random';
  const options = [
    { id: 'random', title: 'Ngẫu nhiên', tagline: 'Rút một thẻ kịch bản khi bắt đầu ván.', icon: 'random' },
    ...(catalog.scenarios ?? []),
  ];
  return (
    <Panel title="Thẻ kịch bản" icon={SCENARIO_ICON.scroll}>
      <ul className="divide-y divide-mortar/60">
        {options.map((sc) => {
          const Icon = SCENARIO_ICON[sc.icon] ?? SCENARIO_ICON.scroll;
          const on = current === sc.id;
          return (
            <li key={sc.id} className={`flex items-start gap-2 px-3 py-2 ${on ? 'bg-candle/10' : ''}`}>
              <button type="button" disabled={!isHost} onClick={() => setScenario(sc.id)}
                className={`flex min-w-0 flex-1 items-start gap-2 text-left ${isHost ? 'hover:text-parchment' : 'cursor-default'}`}
                aria-pressed={on}>
                <Icon size={16} className={`mt-0.5 shrink-0 ${on ? 'text-candle' : 'text-stone-500'}`} aria-hidden="true" />
                <span className="min-w-0">
                  <span className={`block text-sm ${on ? 'text-candle' : 'text-bone'}`}>{sc.title}</span>
                  {on && <span className="block text-xs text-stone-500">{sc.tagline}</span>}
                </span>
              </button>
              {sc.story && (
                <button type="button" className="shrink-0 text-xs text-stone-500 underline hover:text-parchment" onClick={() => setPreview(sc)}>
                  Đọc
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {!isHost && <p className="px-3 pb-2 text-xs text-stone-500">Chủ phòng chọn kịch bản.</p>}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3" onClick={(e) => e.target === e.currentTarget && setPreview(null)}>
          <div role="dialog" aria-modal="true" aria-label={preview.title} className="thin-scroll max-h-full w-full max-w-xl overflow-y-auto">
            <ScenarioFace scenario={preview} />
            <div className="mt-3 flex justify-center gap-2">
              {isHost && <Button variant="primary" onClick={() => { setScenario(preview.id); setPreview(null); }}>Chọn kịch bản này</Button>}
              <Button onClick={() => setPreview(null)}>Đóng</Button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function LobbyRoom() {
  const lobby = useGameStore((s) => s.lobby);
  const session = useGameStore((s) => s.session);
  const catalog = useGameStore((s) => s.catalog);
  const selectCharacter = useGameStore((s) => s.selectCharacter);
  const startGame = useGameStore((s) => s.startGame);
  const leave = useGameStore((s) => s.leave);
  const kick = useGameStore((s) => s.kick);
  const [copied, setCopied] = useState(false);

  const me = lobby.players.find((p) => p.id === session.playerId);
  const isHost = lobby.hostId === session.playerId;
  const missing = lobby.players.filter((p) => !p.characterId).length;
  const need = Math.max(0, lobby.minPlayers - lobby.players.length);
  const canStart = isHost && need === 0 && missing === 0;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(lobby.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Không có quyền clipboard: người chơi tự chép mã đang hiển thị.
    }
  };

  let hint = 'Chờ chủ phòng bắt đầu.';
  if (need > 0) hint = `Cần thêm ${need} người chơi nữa (tối thiểu ${lobby.minPlayers}).`;
  else if (missing > 0) hint = `Còn ${missing} người chưa chọn nhân vật.`;
  else if (isHost) hint = 'Mọi người đã sẵn sàng.';

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm tracking-widest text-stone-500 uppercase">Mã phòng</p>
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-3 font-display text-4xl font-bold tracking-[0.3em] text-candle"
            title="Bấm để chép mã phòng"
          >
            {lobby.code}
            {copied ? <Check size={20} aria-hidden="true" /> : <Copy size={20} className="text-stone-500" aria-hidden="true" />}
          </button>
        </div>
        <Button onClick={leave}><LogOut size={16} aria-hidden="true" /> Rời phòng</Button>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Panel title={`Người chơi ${lobby.players.length}/${lobby.maxPlayers}`} icon={Users}>
            <ul className="divide-y divide-mortar/60">
              {lobby.players.map((p) => {
                const character = catalog.charactersById[p.characterId];
                return (
                  <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                    <span
                      className="h-6 w-6 shrink-0 rounded-full border-2 border-black/70"
                      style={{ backgroundColor: character?.color ?? '#44403c' }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate">
                        {p.id === lobby.hostId && <Crown size={14} className="shrink-0 text-candle" aria-label="Chủ phòng" />}
                        <span className="truncate">{p.name}</span>
                        {p.id === session.playerId && <span className="text-xs text-stone-500">(bạn)</span>}
                      </div>
                      <div className="truncate text-xs text-stone-500">{character?.name ?? 'Chưa chọn nhân vật'}</div>
                    </div>
                    {!p.connected && <WifiOff size={15} className="text-ember" aria-label="Mất kết nối" />}
                    {isHost && p.id !== session.playerId && (
                      <button
                        type="button"
                        className="text-stone-500 hover:text-red-400"
                        onClick={() => kick(p.id)}
                        aria-label={`Mời ${p.name} ra khỏi phòng`}
                      >
                        <UserX size={16} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <ScenarioPicker isHost={isHost} />

          <div>
            {isHost && (
              <Button variant="primary" className="w-full py-2.5" disabled={!canStart} onClick={startGame}>
                <Play size={17} aria-hidden="true" /> Bắt đầu ván chơi
              </Button>
            )}
            <p className="mt-2 text-center text-sm text-bone">{hint}</p>
          </div>
        </div>

        <section>
          <h2 className="mb-3 font-display text-sm tracking-widest text-bone uppercase">Chọn nhân vật</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.characters.map((character) => {
              const owner = lobby.players.find((p) => p.characterId === character.id);
              const mine = me?.characterId === character.id;
              return (
                <CharacterCard
                  key={character.id}
                  character={character}
                  owner={owner}
                  mine={mine}
                  disabled={Boolean(owner) && !mine}
                  onPick={() => selectCharacter(mine ? null : character.id)}
                />
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
