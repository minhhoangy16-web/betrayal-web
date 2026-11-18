// Bảng tình hình kịch bản: các thanh đo (đồng hồ, số người chết…) và ghi chú công khai.
// Dữ liệu do server lọc sẵn theo người xem (haunt.data = publicData của kịch bản).

import { Gauge } from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';
import { Panel } from './ui.jsx';

const TONE = {
  danger: 'bg-blood',
  good: 'bg-emerald-600',
  neutral: 'bg-candle',
  info: 'bg-sky-600',
};

export function HauntMeters({ data }) {
  const meters = data?.meters ?? [];
  const notes = data?.notes ?? [];
  if (!meters.length && !notes.length) return null;
  return (
    <div className="space-y-2.5">
      {meters.map((m) => {
        const pct = m.max ? Math.min(100, Math.round((m.value / m.max) * 100)) : 0;
        return (
          <div key={m.id}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-bone">{m.label}</span>
              <strong className="font-display text-parchment">
                {m.value}
                {m.max ? <span className="text-stone-500">/{m.max}</span> : null}
              </strong>
            </div>
            <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-black/50" role="meter"
              aria-label={m.label} aria-valuenow={m.value} aria-valuemin={0} aria-valuemax={m.max ?? m.value}>
              <div className={`h-full ${TONE[m.tone] ?? TONE.neutral} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
              {(m.marksAt ?? []).map((at) => (
                <span key={at} className="absolute top-0 h-full w-px bg-parchment/60" style={{ left: `${(at / m.max) * 100}%` }} />
              ))}
            </div>
          </div>
        );
      })}
      {notes.length > 0 && (
        <ul className="space-y-1 text-sm leading-snug text-bone">
          {notes.map((n) => <li key={n}>• {n}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function HauntStatus() {
  const haunt = useGameStore((s) => s.game?.haunt);
  const data = haunt?.data;
  if (!haunt || (!data?.meters?.length && !data?.notes?.length)) return null;
  return (
    <Panel title={haunt.name} icon={Gauge}>
      <div className="px-3 py-3">
        <HauntMeters data={data} />
      </div>
    </Panel>
  );
}
