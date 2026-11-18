// Bàn cờ dạng lưới theo từng tầng, có thể kéo (pan) và phóng to/thu nhỏ (zoom).
// Bấm vào ô phát sáng để di chuyển / mở cửa; server quyết định mọi thứ còn lại.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Ban, Box, Check, Coins, DoorOpen, Droplets, Flame, Flower2, Ghost, Landmark, Locate, Minus, Package, PersonStanding,
  Plus, RotateCw, Shovel, Sparkles, Zap,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';
import { DIRS, FLOORS, FLOOR_LABEL, TILE_SIZE, mediaUrl, posKey, rotatedDoors } from '../lib/constants.js';
import { Art, PlayerToken, SymbolIcon } from './ui.jsx';
import TableEffects from './TableEffects.jsx';

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Vị trí vạch cửa trên từng cạnh của ô.
const DOOR_STYLE = [
  { top: -3, left: '50%', width: 34, height: 7, transform: 'translateX(-50%)' },
  { right: -3, top: '50%', width: 7, height: 34, transform: 'translateY(-50%)' },
  { bottom: -3, left: '50%', width: 34, height: 7, transform: 'translateX(-50%)' },
  { left: -3, top: '50%', width: 7, height: 34, transform: 'translateY(-50%)' },
];

// Dấu hiệu kịch bản trên phòng (haunt.data.marks), server đã lọc theo người xem.
const MARK_ICON = {
  coffin: [Box, 'text-stone-200'], flood: [Droplets, 'text-sky-300'], ash: [Ban, 'text-stone-300'], clear: [Check, 'text-emerald-300'],
  dug: [Shovel, 'text-amber-200'], charm: [Sparkles, 'text-fuchsia-300'], revealed: [Zap, 'text-red-300'],
  body: [PersonStanding, 'text-red-400'], altar: [Landmark, 'text-violet-300'], offering: [Flower2, 'text-amber-300'],
  gold: [Coins, 'text-yellow-300'], exit: [DoorOpen, 'text-emerald-300'], token: [Package, 'text-candle'],
};

function RoomMarks({ marks }) {
  return marks.map((m, i) => {
    const [Icon, tint] = MARK_ICON[m.kind] ?? MARK_ICON.token;
    return (
      <span key={`${m.kind}-${i}`} title={m.label} className={`rounded-full bg-black/60 p-0.5 ${tint}`}>
        <Icon size={14} aria-label={m.label} />
      </span>
    );
  });
}

const SYMBOL_TINT = { omen: 'text-violet-300', event: 'text-amber-300', item: 'text-emerald-300' };

function TileFace({ def, rotation, ghost = false, children }) {
  const doors = rotatedDoors(def, rotation);
  // Ảnh của gạch (nếu có trong manifest) được vẽ ở góc xoay 0 và xoay theo gạch.
  const image = useGameStore((s) => s.media.tiles[def.id]);
  return (
    <div
      className={`absolute inset-1 rounded-sm border-2 p-1.5
        ${ghost ? 'border-dashed border-candle bg-stonework/70' : 'border-[#4a3f39] bg-stonework shadow-lg shadow-black/60'}`}
    >
      <Art
        src={mediaUrl(image)}
        className={`absolute inset-0 h-full w-full rounded-[1px] object-cover ${ghost ? 'opacity-60' : ''}`}
        style={{ transform: `rotate(${rotation * 90}deg)` }}
      />
      {doors.map((dir) => (
        <span key={dir} className="absolute rounded-sm bg-candle/90" style={DOOR_STYLE[dir]} aria-hidden="true" />
      ))}
      <div className="relative flex items-start justify-between gap-1">
        <span className={`font-display text-[11px] leading-tight text-parchment ${image ? 'rounded-sm bg-black/65 px-1' : ''}`}>
          {def.name}
        </span>
        {def.symbol && (
          <span className={`shrink-0 ${image ? 'rounded-full bg-black/65 p-0.5' : ''}`}>
            <SymbolIcon symbol={def.symbol} size={15} className={SYMBOL_TINT[def.symbol]} />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function Board() {
  const game = useGameStore((s) => s.game);
  const catalog = useGameStore((s) => s.catalog);
  const act = useGameStore((s) => s.act);
  const selectedMonsterId = useGameStore((s) => s.selectedMonsterId);
  const selectMonster = useGameStore((s) => s.selectMonster);
  const viewBag = useGameStore((s) => s.viewBag);

  const me = game.players[game.you] ?? null;
  const pending = game.pending;
  const myPlacement = pending?.type === 'placeTile' && pending.playerId === game.you;

  const [floor, setFloor] = useState(me?.pos?.floor ?? 'ground');
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const containerRef = useRef(null);
  const drag = useRef(null);
  const suppressClick = useRef(false);

  const centerOn = useCallback((pos, scale) => {
    const el = containerRef.current;
    if (!el) return;
    setView((v) => {
      const s = scale ?? v.scale;
      return {
        scale: s,
        x: el.clientWidth / 2 - (pos.x + 0.5) * TILE_SIZE * s,
        y: el.clientHeight / 2 - (pos.y + 0.5) * TILE_SIZE * s,
      };
    });
  }, []);

  // Lần đầu: đưa quân của mình vào giữa khung nhìn. Màn hình hẹp (điện thoại) thì thu nhỏ sẵn.
  useLayoutEffect(() => {
    const narrow = (containerRef.current?.clientWidth ?? 1000) < 640;
    centerOn(me?.pos ?? { x: 0, y: 0 }, narrow ? 0.7 : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tự chuyển tab khi quân của mình đổi tầng.
  const myFloor = me?.pos?.floor;
  const myX = me?.pos?.x;
  const myY = me?.pos?.y;
  useEffect(() => {
    if (!myFloor) return;
    setFloor(myFloor);
    centerOn({ x: myX, y: myY });
    // Chỉ chạy khi đổi tầng, không chạy mỗi bước đi (để không giật khung nhìn).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myFloor]);

  // Khi mình phải đặt gạch, đưa ô đó vào tầm nhìn.
  const placementKey = myPlacement ? `${pending.floor}:${pending.x}:${pending.y}` : null;
  useEffect(() => {
    if (!placementKey) return;
    setFloor(pending.floor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementKey]);

  // Trong lượt quái vật: theo dõi quái vật đang được chọn (thường ở tầng khác với quân của mình).
  const myMonsterTurn = game.turn.phase === 'monsters' && game.turn.playerId === game.you;
  const chosen = myMonsterTurn ? game.monsters[selectedMonsterId] : null;
  const chosenFloor = chosen?.pos.floor;
  useEffect(() => {
    if (!chosen) return;
    setFloor(chosen.pos.floor);
    centerOn(chosen.pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen?.id, chosenFloor]);

  // Zoom bằng con lăn, giữ nguyên điểm dưới con trỏ. Phải đăng ký non-passive để chặn cuộn trang.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((v) => {
        const scale = clamp(v.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12), MIN_SCALE, MAX_SCALE);
        const k = scale / v.scale;
        return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (factor) => {
    const el = containerRef.current;
    const px = el.clientWidth / 2;
    const py = el.clientHeight / 2;
    setView((v) => {
      const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      const k = scale / v.scale;
      return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  };

  // Kéo để di chuyển khung nhìn. Chỉ coi là kéo khi vượt quá 5px, để cú bấm vào ô vẫn hoạt động.
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, originX: view.x, originY: view.y, moved: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) {
      d.moved = true;
      containerRef.current?.setPointerCapture?.(e.pointerId);
    }
    setView((v) => ({ ...v, x: d.originX + dx, y: d.originY + dy }));
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.moved) {
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 0);
      containerRef.current?.releasePointerCapture?.(e.pointerId);
    }
    drag.current = null;
  };
  const guarded = (fn) => () => {
    if (!suppressClick.current) fn();
  };

  // Đang phải chọn một phòng: tự chuyển sang tầng có lựa chọn nếu tầng đang xem không có.
  const chooseFloors = pending?.type === 'choose' && pending.playerId === game.you
    ? [...new Set(pending.options.filter((o) => o.pos && !o.disabled).map((o) => o.pos.floor))].join(',')
    : '';
  useEffect(() => {
    const floors = chooseFloors ? chooseFloors.split(',') : [];
    if (floors.length && !floors.includes(floor)) setFloor(floors[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chooseFloors]);

  // Các ô có thể bấm: bước đi của mình, hoặc của quái vật đang được chọn.
  const targets = useMemo(() => {
    const out = {};
    const add = (origin, action) => {
      if (action.dir === undefined || action.dir === null || origin.floor !== floor) return;
      const cell = { floor, x: origin.x + DIRS[action.dir].dx, y: origin.y + DIRS[action.dir].dy };
      out[posKey(cell)] = { cell, action };
    };
    if (pending?.type === 'choose' && pending.playerId === game.you) {
      for (const o of pending.options) {
        if (o.pos && !o.disabled && o.pos.floor === floor) {
          out[posKey(o.pos)] = { cell: o.pos, action: { type: 'choose', optionId: o.id }, label: o.label };
        }
      }
      return out;
    }
    for (const action of game.legal) {
      if (action.type === 'move' && me?.pos) add(me.pos, action);
      if (action.type === 'monsterMove' && action.monsterId === selectedMonsterId) {
        const monster = game.monsters[action.monsterId];
        if (monster) add(monster.pos, action);
      }
    }
    return out;
  }, [game.legal, game.monsters, me, floor, selectedMonsterId, pending]);

  const tiles = Object.values(game.board.tiles).filter((t) => t.floor === floor);
  // Không vẽ người đã thoát hoặc bị giấu vị trí (pos = null).
  const players = Object.values(game.players).filter((p) => p.pos && !p.escaped);
  const marks = game.haunt?.data?.marks ?? {};
  const monsters = Object.values(game.monsters);
  const controllable = new Set(game.legal.filter((a) => a.type.startsWith('monster')).map((a) => a.monsterId));
  const actorId = pending ? pending.playerId : game.turn.playerId;

  const countOnFloor = (f) => players.filter((p) => p.alive && p.pos?.floor === f).length;
  // Số phòng đã đặt ở mỗi tầng (để hiện «Đã đặt X/Y»).
  const placedOn = (f) => Object.values(game.board.tiles).filter((t) => t.floor === f).length;

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-md border border-mortar">
      <div
        ref={containerRef}
        className="board-surface h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          {tiles.map((tile) => {
            const def = catalog.tilesById[tile.tileId];
            const key = posKey(tile);
            const target = targets[key];
            const here = players.filter((p) => posKey(p.pos) === key);
            const monstersHere = monsters.filter((m) => posKey(m.pos) === key);
            return (
              <div
                key={key}
                className="absolute"
                style={{ left: tile.x * TILE_SIZE, top: tile.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
              >
                <TileFace def={def} rotation={tile.rotation}>
                  <div className="absolute inset-x-1.5 bottom-1.5 flex flex-wrap items-end gap-1">
                    {here.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="rounded-full"
                        onClick={guarded(() => viewBag(p.id))}
                        aria-label={`Xem túi đồ của ${p.name}`}
                      >
                        <PlayerToken
                          player={p}
                          character={catalog.charactersById[p.characterId]}
                          size={26}
                          active={p.id === actorId}
                          title={`${p.name} – bấm để xem túi đồ`}
                        />
                      </button>
                    ))}
                    {monstersHere.map((m) => {
                      const mine = controllable.has(m.id);
                      const selected = m.id === selectedMonsterId;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={!mine}
                          title={`${m.name}${m.stunned ? ' (choáng)' : ''}`}
                          onClick={guarded(() => selectMonster(m.id))}
                          className={`flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 bg-slate-200 text-slate-900
                            ${selected ? 'border-candle shadow-[0_0_10px_rgba(224,164,58,0.9)]' : 'border-black/70'}
                            ${m.stunned ? 'opacity-40' : ''} disabled:cursor-default`}
                        >
                          <Ghost size={16} aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                  <div className="absolute top-7 right-1.5 flex flex-col items-end gap-1">
                    {marks[key] && <RoomMarks marks={marks[key]} />}
                    {tile.sealed && (
                      <span title="Đã yểm bùa" className="flicker text-candle"><Flame size={16} aria-label="Đã yểm bùa" /></span>
                    )}
                    {tile.items.length > 0 && (
                      <span title={`${tile.items.length} thẻ nằm trên sàn`} className="flex items-center gap-0.5 text-xs text-emerald-300">
                        <Package size={13} aria-hidden="true" />{tile.items.length}
                      </span>
                    )}
                  </div>
                </TileFace>
                {target && (
                  <button
                    type="button"
                    onClick={guarded(() => act(target.action))}
                    className="absolute inset-1 rounded-sm border-2 border-candle bg-candle/10 hover:bg-candle/25"
                    aria-label={target.label ? `Chọn ${target.label}` : `Đi tới ${def.name}`}
                  />
                )}
              </div>
            );
          })}

          {/* Ô trống sau cánh cửa chưa mở. */}
          {Object.entries(targets).map(([key, { cell, action }]) => {
            if (game.board.tiles[key]) return null;
            return (
              <button
                key={key}
                type="button"
                onClick={guarded(() => act(action))}
                className="absolute flex flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed
                  border-candle/70 bg-candle/5 text-candle hover:bg-candle/15"
                style={{
                  left: cell.x * TILE_SIZE + 4, top: cell.y * TILE_SIZE + 4,
                  width: TILE_SIZE - 8, height: TILE_SIZE - 8,
                }}
              >
                <DoorOpen size={22} aria-hidden="true" />
                <span className="font-display text-[11px] tracking-wider uppercase">Mở cửa</span>
              </button>
            );
          })}

          {/* Gạch vừa rút, đang chờ xoay và đặt. */}
          {pending?.type === 'placeTile' && pending.floor === floor && (
            <div
              className="absolute"
              style={{ left: pending.x * TILE_SIZE, top: pending.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
            >
              <TileFace def={catalog.tilesById[pending.tileId]} rotation={pending.rotation} ghost>
                {myPlacement && pending.validRotations.length > 1 && (
                  <button
                    type="button"
                    className="absolute inset-0 flex items-center justify-center text-candle"
                    aria-label="Xoay gạch"
                    onClick={guarded(() => {
                      const list = pending.validRotations;
                      act({ type: 'rotateTile', rotation: list[(list.indexOf(pending.rotation) + 1) % list.length] });
                    })}
                  >
                    <RotateCw size={30} aria-hidden="true" />
                  </button>
                )}
              </TileFace>
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-2 left-2 flex gap-1 rounded-md border border-mortar bg-ink/90 p-1" role="tablist" aria-label="Tầng">
        {FLOORS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={f === floor}
            onClick={() => setFloor(f)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-display text-xs tracking-wider uppercase
              ${f === floor ? 'bg-blood text-parchment' : 'text-bone hover:bg-stonework'}`}
          >
            <span className="flex flex-col items-start leading-tight">
              {FLOOR_LABEL[f]}
              <span
                className="font-sans text-[10px] tracking-normal normal-case opacity-80"
                title={`Đã đặt ${placedOn(f)} phòng ở ${FLOOR_LABEL[f]}. Chồng gạch còn ${game.stacks.tilesByFloor?.[f] ?? 0} gạch đặt được ở tầng này (một số gạch đặt được ở nhiều tầng).`}
              >
                Đã đặt {placedOn(f)}/{placedOn(f) + (game.stacks.tilesByFloor?.[f] ?? 0)}
              </span>
            </span>
            {countOnFloor(f) > 0 && (
              <span className="rounded-full bg-black/50 px-1.5 text-[10px] text-parchment">{countOnFloor(f)}</span>
            )}
          </button>
        ))}
      </div>

      <TableEffects />

      <div className="absolute right-2 bottom-2 flex flex-col gap-1 rounded-md border border-mortar bg-ink/90 p-1">
        <button type="button" className="rounded p-1.5 text-bone hover:bg-stonework" onClick={() => zoomBy(1.25)} aria-label="Phóng to">
          <Plus size={17} aria-hidden="true" />
        </button>
        <button type="button" className="rounded p-1.5 text-bone hover:bg-stonework" onClick={() => zoomBy(0.8)} aria-label="Thu nhỏ">
          <Minus size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="rounded p-1.5 text-bone hover:bg-stonework"
          aria-label="Về vị trí của tôi"
          onClick={() => {
            if (me?.pos) setFloor(me.pos.floor);
            centerOn(me?.pos ?? { x: 0, y: 0 });
          }}
        >
          <Locate size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
