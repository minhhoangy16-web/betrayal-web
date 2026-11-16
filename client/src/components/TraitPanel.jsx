// Bảng chỉ số nhân vật: 4 thanh trượt 8 nấc, đầu lâu ở đáy, có đánh dấu mức khởi đầu.

import { Skull } from 'lucide-react';
import { TRAITS, TRAIT_LABEL } from '../lib/constants.js';
import { TraitIcon } from './ui.jsx';

function TraitTrack({ trait, track, start, index }) {
  const dead = index < 0;
  const critical = index === 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-bone">
          <TraitIcon trait={trait} size={14} />
          {TRAIT_LABEL[trait]}
        </span>
        {critical && <span className="text-xs tracking-wide text-ember uppercase">Nguy kịch</span>}
      </div>
      <ol className="flex gap-1" aria-label={`${TRAIT_LABEL[trait]}: ${dead ? 'đầu lâu' : track[index]}`}>
        <li
          className={`flex h-8 w-8 items-center justify-center rounded border
            ${dead ? 'border-red-500 bg-blood text-parchment' : 'border-mortar bg-ink text-stone-600'}`}
          title="Đầu lâu – chạm tới đây sau khi Haunt bắt đầu là chết"
        >
          <Skull size={15} aria-hidden="true" />
        </li>
        {track.map((value, i) => {
          const current = i === index;
          const isStart = i === start;
          return (
            <li
              key={i}
              title={isStart ? 'Mức khởi đầu' : undefined}
              className={`relative flex h-8 flex-1 items-center justify-center rounded border font-display text-sm
                ${current
                  ? 'border-candle bg-blood font-bold text-parchment shadow-[0_0_8px_rgba(224,164,58,0.55)]'
                  : i < index
                    ? 'border-mortar bg-stonework text-bone'
                    : 'border-mortar/60 bg-ink text-stone-600'}`}
            >
              {value}
              {isStart && <span className="absolute -bottom-1 h-1 w-3 rounded-full bg-emerald-500" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function TraitPanel({ player, character }) {
  return (
    <div className="space-y-3 p-3">
      {TRAITS.map((trait) => (
        <TraitTrack
          key={trait}
          trait={trait}
          track={character.traits[trait].track}
          start={character.traits[trait].start}
          index={player.traits[trait]}
        />
      ))}
      <p className="flex items-center gap-2 text-xs text-stone-500">
        <span className="inline-block h-1 w-3 rounded-full bg-emerald-500" aria-hidden="true" /> mức khởi đầu
      </p>
    </div>
  );
}
