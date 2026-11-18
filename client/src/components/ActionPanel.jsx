// Bảng hành động theo ngữ cảnh. Mọi nút đều sinh ra từ game.legal do server gửi,
// nên giao diện không bao giờ cho bấm một hành động mà server sẽ từ chối.

import { useEffect, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Dices, Flame, Footprints, Ghost, Hourglass, Layers,
  Minus, Package, Plus, RotateCw, Swords,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';
import { DAMAGE_LABEL, DIRS, TRAIT_LABEL } from '../lib/constants.js';
import { Button, TraitIcon } from './ui.jsx';

const DIR_ICONS = [ArrowUp, ArrowRight, ArrowDown, ArrowLeft];

function Section({ title, children }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs tracking-widest text-stone-500 uppercase">{title}</h3>
      {children}
    </div>
  );
}

// Bàn phím hướng cho các bước đi qua cửa + nút cầu thang.
function MovePad({ moves, catalog, onMove }) {
  const byDir = Object.fromEntries(moves.filter((m) => m.dir !== undefined && m.dir !== null).map((m) => [m.dir, m]));
  const links = moves.filter((m) => m.linkTo);
  const cell = (dir) => {
    const Icon = DIR_ICONS[dir];
    const move = byDir[dir];
    return (
      <Button
        className="h-10 w-10 p-0!"
        variant={move?.discover ? 'candle' : 'ghost'}
        disabled={!move}
        onClick={() => onMove(move)}
        aria-label={`${move?.discover ? 'Mở cửa' : 'Đi'} hướng ${DIRS[dir].label}`}
        title={move ? (move.discover ? `Mở cửa hướng ${DIRS[dir].label}` : `Đi hướng ${DIRS[dir].label}`) : undefined}
      >
        <Icon size={18} aria-hidden="true" />
      </Button>
    );
  };
  return (
    <div className="flex items-center gap-4">
      <div className="grid grid-cols-3 gap-1">
        <span />{cell(0)}<span />
        {cell(3)}<span className="flex items-center justify-center text-stone-600"><Footprints size={16} aria-hidden="true" /></span>{cell(1)}
        <span />{cell(2)}<span />
      </div>
      {links.length > 0 && (
        <div className="flex flex-1 flex-col gap-1">
          {links.map((m) => (
            <Button key={m.linkTo} className="justify-start text-left" onClick={() => onMove(m)}>
              <Layers size={15} aria-hidden="true" /> {catalog.tilesById[m.linkTo].name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function DamageAllocator({ pending, onConfirm }) {
  const [alloc, setAlloc] = useState(() => Object.fromEntries(pending.traits.map((t) => [t, 0])));
  const sum = Object.values(alloc).reduce((a, b) => a + b, 0);
  const left = pending.amount - sum;
  const change = (trait, delta) => setAlloc((a) => ({ ...a, [trait]: a[trait] + delta }));
  return (
    <div className="space-y-2">
      <p>
        Bạn chịu <strong className="text-red-400">{pending.amount}</strong> sát thương {DAMAGE_LABEL[pending.damageType]}.
        Chia cho các chỉ số (còn <strong>{left}</strong> nấc):
      </p>
      {pending.traits.map((trait) => (
        <div key={trait} className="flex items-center gap-2">
          <span className="flex flex-1 items-center gap-1.5"><TraitIcon trait={trait} size={15} /> {TRAIT_LABEL[trait]}</span>
          <Button className="h-8 w-8 p-0!" disabled={alloc[trait] === 0} onClick={() => change(trait, -1)} aria-label={`Bớt ${TRAIT_LABEL[trait]}`}>
            <Minus size={15} aria-hidden="true" />
          </Button>
          <span className="w-6 text-center font-display">{alloc[trait]}</span>
          <Button
            className="h-8 w-8 p-0!"
            disabled={left === 0 || alloc[trait] >= pending.capacity[trait]}
            onClick={() => change(trait, 1)}
            aria-label={`Thêm ${TRAIT_LABEL[trait]}`}
          >
            <Plus size={15} aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button variant="primary" className="w-full" disabled={left !== 0} onClick={() => onConfirm(alloc)}>
        <Check size={16} aria-hidden="true" /> Xác nhận
      </Button>
    </div>
  );
}

function PendingPrompt({ game, catalog, act }) {
  const pending = game.pending;
  const who = game.players[pending.playerId];
  if (pending.playerId !== game.you) {
    const what = {
      placeTile: 'xoay và đặt gạch', roll: 'đổ xúc xắc', allocateDamage: 'chia sát thương', chooseTrait: 'chọn chỉ số',
      choose: pending.secret ? 'quyết định (bí mật)' : `quyết định: ${pending.label}`,
    }[pending.type];
    return (
      <p className="flex items-center gap-2 text-bone italic">
        <Hourglass size={16} className="shrink-0" aria-hidden="true" /> Đang chờ {who.name} {what}…
      </p>
    );
  }
  if (pending.type === 'choose') {
    return (
      <div className="space-y-2">
        <p className="font-semibold text-candle">{pending.label}</p>
        {pending.secret && <p className="text-xs text-stone-500">Chỉ mình bạn thấy lựa chọn này.</p>}
        {pending.options.some((o) => o.pos) && (
          <p className="text-xs text-stone-500">Có thể bấm thẳng vào phòng sáng viền trên bàn cờ.</p>
        )}
        <div className="grid gap-1.5">
          {pending.options.map((o) => (
            <Button key={o.id} disabled={o.disabled} onClick={() => act({ type: 'choose', optionId: o.id })}
              className="justify-start text-left">
              <span className="flex-1">{o.label}</span>
              {o.hint && <span className="text-xs text-stone-500">{o.hint}</span>}
            </Button>
          ))}
        </div>
      </div>
    );
  }
  if (pending.type === 'placeTile') {
    const def = catalog.tilesById[pending.tileId];
    const list = pending.validRotations;
    const next = list[(list.indexOf(pending.rotation) + 1) % list.length];
    return (
      <div className="space-y-2">
        <p>Bạn rút được <strong className="text-candle">{def.name}</strong>. Xoay sao cho cửa nối với phòng vừa rời rồi đặt xuống.</p>
        {def.text && <p className="text-sm text-bone italic">{def.text}</p>}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={list.length < 2} onClick={() => act({ type: 'rotateTile', rotation: next })}>
            <RotateCw size={16} aria-hidden="true" /> Xoay
          </Button>
          <Button variant="primary" className="flex-1" onClick={() => act({ type: 'placeTile', rotation: pending.rotation })}>
            <Check size={16} aria-hidden="true" /> Đặt gạch
          </Button>
        </div>
      </div>
    );
  }
  if (pending.type === 'roll') {
    const count = pending.trait ? game.players[game.you].traitValues[pending.trait] + pending.bonus : pending.dice;
    return (
      <div className="space-y-2">
        <p>
          <strong className="text-candle">{pending.label}</strong>: đổ{' '}
          {pending.trait ? `${TRAIT_LABEL[pending.trait]} (${count} xúc xắc)` : `${count} xúc xắc`}.
        </p>
        <Button variant="primary" className="w-full py-2" onClick={() => act({ type: 'roll' })}>
          <Dices size={18} aria-hidden="true" /> Đổ xúc xắc
        </Button>
      </div>
    );
  }
  if (pending.type === 'allocateDamage') {
    // key: tạo lại bộ đếm khi có một lượt sát thương mới.
    const key = `${pending.damageType}:${pending.amount}:${game.log.at(-1)?.seq ?? 0}`;
    return <DamageAllocator key={key} pending={pending} onConfirm={(allocation) => act({ type: 'allocateDamage', allocation })} />;
  }
  return (
    <div className="space-y-2">
      <p>Chọn một chỉ số để tăng {pending.amount} nấc:</p>
      <div className="grid grid-cols-2 gap-2">
        {pending.options.map((trait) => (
          <Button key={trait} onClick={() => act({ type: 'chooseTrait', trait })}>
            <TraitIcon trait={trait} size={15} /> {TRAIT_LABEL[trait]}
          </Button>
        ))}
      </div>
    </div>
  );
}

function targetName(game, action) {
  return action.targetType === 'monster' ? game.monsters[action.targetId]?.name : game.players[action.targetId]?.name;
}

function ExplorerActions({ game, catalog, act }) {
  const legal = game.legal;
  const moves = legal.filter((a) => a.type === 'move');
  const attacks = legal.filter((a) => a.type === 'attack');
  const specials = legal.filter((a) => a.type === 'special');
  const pickups = legal.filter((a) => a.type === 'pickupItem');
  return (
    <div className="space-y-4">
      <Section title={`Di chuyển – còn ${game.turn.movesLeft} bước`}>
        <MovePad moves={moves} catalog={catalog} onMove={act} />
      </Section>

      {specials.length > 0 && (
        <Section title="Hành động đặc biệt">
          <div className="flex flex-col gap-1">
            {specials.map((a) => (
              <Button key={`${a.actionId}:${a.trait}`} variant="candle" className="justify-start text-left" onClick={() => act(a)}>
                <Flame size={15} className="shrink-0" aria-hidden="true" /> {a.label}
              </Button>
            ))}
          </div>
        </Section>
      )}

      {attacks.length > 0 && (
        <Section title="Tấn công (mỗi lượt một lần)">
          <div className="flex flex-col gap-1">
            {attacks.map((a) => (
              <Button
                key={`${a.targetId}:${a.trait}:${a.weaponCardId}`}
                variant="primary"
                className="justify-start text-left"
                onClick={() => act(a)}
              >
                <Swords size={15} className="shrink-0" aria-hidden="true" />
                <span>
                  {targetName(game, a)} · {TRAIT_LABEL[a.trait]}
                  {a.weaponCardId && ` · ${catalog.cardsById[a.weaponCardId].name}`}
                </span>
              </Button>
            ))}
          </div>
        </Section>
      )}

      {pickups.length > 0 && (
        <Section title="Trên sàn phòng này">
          <div className="flex flex-col gap-1">
            {pickups.map((a) => (
              <Button key={a.cardId} className="justify-start text-left" onClick={() => act(a)}>
                <Package size={15} className="shrink-0" aria-hidden="true" /> Nhặt «{catalog.cardsById[a.cardId].name}»
              </Button>
            ))}
          </div>
        </Section>
      )}

      <Button className="w-full" onClick={() => act({ type: 'endTurn' })}>Kết thúc lượt</Button>
    </div>
  );
}

function MonsterActions({ game, catalog, act }) {
  const selectedMonsterId = useGameStore((s) => s.selectedMonsterId);
  const selectMonster = useGameStore((s) => s.selectMonster);
  const monsters = Object.values(game.monsters);
  const selected = game.monsters[selectedMonsterId] ? selectedMonsterId : null;

  // Đầu lượt quái vật: tự chọn con đầu tiên còn hành động được.
  const firstActive = monsters.find((m) => !m.stunned)?.id ?? null;
  useEffect(() => {
    if (!selected && firstActive) selectMonster(firstActive);
  }, [selected, firstActive, selectMonster]);
  const moves = game.legal.filter((a) => a.type === 'monsterMove' && a.monsterId === selected);
  const attacks = game.legal.filter((a) => a.type === 'monsterAttack' && a.monsterId === selected);
  return (
    <div className="space-y-4">
      <Section title="Quái vật của bạn">
        <div className="flex flex-col gap-1">
          {monsters.map((m) => {
            const slot = game.turn.monsters[m.id];
            const tile = game.board.tiles[`${m.pos.floor}:${m.pos.x}:${m.pos.y}`];
            return (
              <button
                key={m.id}
                type="button"
                disabled={m.stunned}
                aria-pressed={m.id === selected}
                onClick={() => selectMonster(m.id)}
                className={`flex items-center gap-2 rounded border px-2 py-1.5 text-left text-[15px]
                  ${m.id === selected ? 'border-candle bg-stonework' : 'border-mortar bg-ink hover:border-bone'}
                  disabled:opacity-45`}
              >
                <Ghost size={16} className="shrink-0" aria-hidden="true" />
                <span className="flex-1">
                  {m.name}
                  <span className="block text-xs text-stone-500">{catalog.tilesById[tile.tileId].name}</span>
                </span>
                <span className="text-xs text-bone">
                  {m.stunned ? 'choáng' : `${slot?.movesLeft ?? 0} bước${slot?.attacked ? ' · đã đánh' : ''}`}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {selected ? (
        <>
          <Section title="Di chuyển quái vật">
            <MovePad moves={moves} catalog={catalog} onMove={act} />
          </Section>
          {attacks.length > 0 && (
            <Section title="Tấn công">
              <div className="flex flex-col gap-1">
                {attacks.map((a) => (
                  <Button key={a.targetId} variant="primary" className="justify-start" onClick={() => act(a)}>
                    <Swords size={15} aria-hidden="true" /> {game.players[a.targetId].name}
                  </Button>
                ))}
              </div>
            </Section>
          )}
        </>
      ) : (
        <p className="text-sm text-bone italic">Chọn một quái vật ở trên hoặc trên bàn cờ để điều khiển.</p>
      )}

      <Button className="w-full" onClick={() => act({ type: 'endMonsterTurn' })}>Kết thúc lượt quái vật</Button>
    </div>
  );
}

export default function ActionPanel() {
  const game = useGameStore((s) => s.game);
  const catalog = useGameStore((s) => s.catalog);
  const act = useGameStore((s) => s.act);

  const current = game.players[game.turn.playerId];
  const mine = game.turn.playerId === game.you;
  const me = game.players[game.you];

  let body;
  if (game.winner) {
    body = <p className="text-bone italic">Ván chơi đã kết thúc.</p>;
  } else if (game.pending) {
    body = <PendingPrompt game={game} catalog={catalog} act={act} />;
  } else if (mine && game.turn.phase === 'monsters') {
    body = <MonsterActions game={game} catalog={catalog} act={act} />;
  } else if (mine) {
    body = <ExplorerActions game={game} catalog={catalog} act={act} />;
  } else {
    body = (
      <p className="flex items-center gap-2 text-bone italic">
        <Hourglass size={16} className="shrink-0" aria-hidden="true" />
        {game.turn.phase === 'monsters' ? `${current.name} đang điều khiển quái vật…` : `Đang là lượt của ${current.name}…`}
        {me && !me.alive && ' (Nhân vật của bạn đã chết.)'}
        {me?.alive && me.escaped && ' (Bạn đã thoát khỏi ngôi nhà.)'}
      </p>
    );
  }

  const heading = game.winner
    ? 'Kết thúc'
    : mine
      ? game.turn.phase === 'monsters' ? 'Lượt quái vật của bạn' : 'Lượt của bạn'
      : `Lượt của ${current.name}`;

  return (
    <section className={`rounded-md border bg-crypt/90 ${mine && !game.winner ? 'border-candle/70' : 'border-mortar'}`}>
      <header className="border-b border-mortar px-3 py-2">
        <h2 className="font-display text-sm tracking-widest text-parchment uppercase">{heading}</h2>
      </header>
      <div className="p-3 text-[15px]">{body}</div>
    </section>
  );
}
