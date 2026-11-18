// Bảng nhân vật: chân dung lớn có tên đè lên, số thẻ đang giữ, rồi hai nhóm chỉ số
// (Thể chất: Tốc độ, Sức mạnh – Trí óc: Tri thức, Tinh thần). Mỗi chỉ số là một hàng 8 nấc:
// đầu lâu ở đầu hàng, nấc thấp nhất (nguy kịch) màu đỏ, mức khởi đầu màu xanh,
// nấc hiện tại có khung đỏ.

import { Eye, Package, Skull } from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';
import { SIDE_LABEL, TRAIT_LABEL, mediaUrl } from '../lib/constants.js';
import { Art } from './ui.jsx';

const GROUPS = [
  { label: 'Thể chất', traits: ['speed', 'might'] },
  { label: 'Trí óc', traits: ['knowledge', 'sanity'] },
];

// Vệt mực loang theo màu nhân vật phía sau chân dung.
function splatter(color) {
  return [
    `radial-gradient(circle at 18% 30%, ${color}cc 0 9%, transparent 10%)`,
    `radial-gradient(circle at 82% 22%, ${color}aa 0 6%, transparent 7%)`,
    `radial-gradient(circle at 70% 70%, ${color}99 0 12%, transparent 13%)`,
    `radial-gradient(circle at 10% 80%, ${color}88 0 5%, transparent 6%)`,
    `radial-gradient(ellipse at 50% 60%, ${color}66, transparent 70%)`,
  ].join(', ');
}

function Header({ player, character, isMe }) {
  const portrait = useGameStore((s) => s.media.portraits?.[character.id]);
  const cardsById = useGameStore((s) => s.catalog.cardsById);
  const phase = useGameStore((s) => s.game?.phase);
  const omens = player.cards.filter((id) => cardsById[id]?.type === 'omen').length;
  const items = player.cards.length - omens;
  return (
    <div className="relative h-48 overflow-hidden" style={{ backgroundColor: '#140d0c', backgroundImage: splatter(character.color) }}>
      <Art
        src={mediaUrl(portrait)}
        className={`absolute inset-0 h-full w-full object-cover object-[50%_20%] ${player.alive ? '' : 'grayscale opacity-60'}`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d0a09] via-[#0d0a09]/25 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/50 to-transparent" />

      {phase && phase !== 'explore' && player.side !== 'explorer' && (
        <span className={`absolute top-2 left-2 rounded px-2 py-0.5 font-display text-[11px] tracking-wider uppercase
          ${player.side === 'traitor' ? 'bg-blood text-parchment' : 'bg-emerald-900/90 text-emerald-100'}`}>
          {SIDE_LABEL[player.side]}
        </span>
      )}

      {/* Số thẻ đang giữ, giống hai chồng thẻ nhỏ ở góc. */}
      <div className="absolute top-2 right-2 flex gap-1.5">
        {[
          { n: omens, label: 'Điềm báo', Icon: Eye, bg: '#3d4a2a', edge: '#9aa874' },
          { n: items, label: 'Vật phẩm', Icon: Package, bg: '#5a1d1d', edge: '#c26b5a' },
        ].map(({ n, label, Icon, bg, edge }) => (
          <span
            key={label}
            title={`${n} thẻ ${label}`}
            className="flex h-12 w-9 flex-col items-center justify-center rounded border-2 text-parchment shadow-lg"
            style={{ backgroundColor: bg, borderColor: edge }}
          >
            <Icon size={15} aria-hidden="true" />
            <span className="font-display text-sm leading-none font-bold">{n}</span>
          </span>
        ))}
      </div>

      {!player.alive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-parchment">
          <Skull size={46} aria-hidden="true" />
          <span className="font-display tracking-[0.3em] uppercase">Đã chết</span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-2 px-3 text-center">
        <h3 className="font-display text-xl leading-tight font-bold tracking-wide text-white uppercase [text-shadow:0_2px_6px_#000,0_0_2px_#000]">
          {character.name}
        </h3>
        <p className="text-xs text-bone [text-shadow:0_1px_3px_#000]">
          {player.name}{isMe ? ' (bạn)' : ''} · {character.age} tuổi
        </p>
      </div>
    </div>
  );
}

function TraitRow({ trait, track, start, index }) {
  const dead = index < 0;
  return (
    <div className="bg-black/30 px-3 pt-1.5 pb-2">
      <div className="mb-0.5 font-display text-[11px] font-bold tracking-[0.15em] text-bone uppercase">{TRAIT_LABEL[trait]}</div>
      <ol className="grid grid-cols-9 items-center gap-0.5" aria-label={`${TRAIT_LABEL[trait]}: ${dead ? 'đã chạm đầu lâu' : track[index]}`}>
        <li
          className={`flex h-8 items-center justify-center rounded-sm ${dead ? 'border-2 border-red-500 bg-black text-red-400' : 'text-parchment/90'}`}
          title="Đầu lâu – chạm tới đây sau khi Haunt bắt đầu là chết"
        >
          <Skull size={19} aria-hidden="true" />
        </li>
        {track.map((value, i) => {
          const current = i === index;
          const critical = i === 0;
          const isStart = i === start;
          const color = critical ? 'text-red-500' : isStart ? 'text-emerald-400' : 'text-parchment';
          return (
            <li
              key={i}
              title={critical ? 'Nguy kịch' : isStart ? 'Mức khởi đầu' : undefined}
              className={`flex h-8 items-center justify-center rounded-sm font-display text-lg font-bold ${color}
                ${current ? 'border-2 border-red-600 bg-black shadow-[0_0_8px_rgba(220,38,38,0.45)]' : ''}
                ${i < index || current ? '' : 'opacity-60'}`}
            >
              {value}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function CharacterSheet({ player, character, isMe = false }) {
  return (
    <section className="shrink-0 overflow-hidden rounded-lg border-2 border-[#8a6a2b]/80 bg-[#141010]">
      <Header player={player} character={character} isMe={isMe} />
      {GROUPS.map((group) => (
        <div key={group.label}>
          <div className="bg-gradient-to-r from-[#9b1c22] via-[#7a1418] to-[#7a1418]/0 px-3 py-1 font-display text-sm font-bold tracking-[0.15em] text-parchment uppercase">
            {group.label}
          </div>
          <div className="flex flex-col gap-px py-1">
            {group.traits.map((trait) => (
              <TraitRow
                key={trait}
                trait={trait}
                track={character.traits[trait].track}
                start={character.traits[trait].start}
                index={player.traits[trait]}
              />
            ))}
          </div>
        </div>
      ))}
      <p className="flex items-center justify-center gap-3 px-3 pb-2 text-[11px] text-stone-500">
        <span><span className="font-bold text-red-500">đỏ</span> nguy kịch</span>
        <span><span className="font-bold text-emerald-400">xanh</span> khởi đầu</span>
        <span><span className="rounded-sm border border-red-600 px-1 text-parchment">khung</span> hiện tại</span>
      </p>
    </section>
  );
}
