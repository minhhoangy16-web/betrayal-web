// Thẻ kịch bản: lý do cả nhóm bước vào ngôi nhà. Hiện ra khi ván bắt đầu (mỗi máy một lần),
// mở lại được bằng nút «Kịch bản» trên thanh trạng thái. Kèm bảng Haunt riêng của thẻ.

import { useEffect, useRef, useState } from 'react';
import { CloudRain, Dices, Flame, Moon, ScrollText, Search, Video, X } from 'lucide-react';
import { useGameStore } from '../store/useGameStore.js';

export const SCENARIO_ICON = { scroll: ScrollText, video: Video, rain: CloudRain, search: Search, flame: Flame, moon: Moon, random: Dices };

const PAPER = {
  backgroundColor: '#e6d6ad',
  backgroundImage:
    'radial-gradient(ellipse at 50% 40%, rgba(255,250,235,0.55) 0%, rgba(0,0,0,0) 60%), ' +
    'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(80,50,20,0.35) 100%)',
  color: '#24190a',
};

function HauntTable({ scenario }) {
  const catalog = useGameStore((s) => s.catalog);
  const names = Object.fromEntries((catalog.haunts ?? []).map((h) => [h.id, h.name]));
  return (
    <table className="mt-2 w-full text-left text-sm">
      <thead>
        <tr className="border-b border-[#8a6a3a]/60 text-xs tracking-wide uppercase opacity-70">
          <th className="py-1 pr-2 font-normal">Điềm báo</th>
          <th className="py-1 pr-2 font-normal">Tầng trệt / trên</th>
          <th className="py-1 font-normal">Tầng hầm</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(scenario.table).map(([omenId, [upper, basement]]) => (
          <tr key={omenId} className="border-b border-[#8a6a3a]/25">
            <td className="py-1 pr-2 font-semibold">{catalog.cardsById[omenId]?.name ?? omenId}</td>
            <td className="py-1 pr-2">{names[upper] ?? upper}</td>
            <td className="py-1">{names[basement] ?? basement}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ScenarioFace({ scenario, showTable = true }) {
  const [table, setTable] = useState(false);
  const Icon = SCENARIO_ICON[scenario.icon] ?? ScrollText;
  return (
    <div className="rounded-md border-4 border-double border-[#7a5a2a] p-5 shadow-2xl sm:p-7" style={PAPER}>
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#7a5a2a] bg-[#24190a] text-[#e6d6ad]">
          <Icon size={28} aria-hidden="true" />
        </span>
        <p className="mt-3 text-xs tracking-[0.35em] uppercase opacity-70">Thẻ kịch bản</p>
        <h2 className="font-display text-2xl font-bold tracking-wide uppercase sm:text-3xl">{scenario.title}</h2>
        <p className="mt-1 italic opacity-80">{scenario.tagline}</p>
      </div>
      <div className="mx-auto my-4 h-px w-2/3 bg-[#7a5a2a]/60" />
      <p className="leading-relaxed">{scenario.story}</p>
      <p className="mt-4 rounded border border-[#7a5a2a]/50 bg-[#7a5a2a]/10 px-3 py-2">
        <strong>Vì sao các bạn ở đây:</strong> {scenario.purpose}
      </p>
      {showTable && (
        <div className="mt-4">
          <button type="button" onClick={() => setTable((t) => !t)} className="text-sm font-semibold underline decoration-dotted underline-offset-4">
            {table ? 'Ẩn bảng Haunt' : 'Xem bảng Haunt của kịch bản này'}
          </button>
          {table && (
            <>
              <p className="mt-2 text-sm opacity-80">
                Khi Haunt Roll thành công, Haunt nổ ra tuỳ thẻ Điềm báo vừa rút và tầng của căn phòng.
                Trục vong cần từ 4 người; ít hơn thì lấy ô ở cột còn lại.
              </p>
              <HauntTable scenario={scenario} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScenarioCard({ onClose }) {
  const scenarioId = useGameStore((s) => s.game?.scenarioId);
  const scenario = useGameStore((s) => s.catalog?.scenarios?.find((sc) => sc.id === scenarioId));
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!scenario) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <article role="dialog" aria-modal="true" aria-label={`Thẻ kịch bản: ${scenario.title}`}
        className="thin-scroll relative max-h-full w-full max-w-xl overflow-y-auto">
        <button type="button" onClick={onClose} className="absolute top-2 right-2 z-10 rounded p-1 text-[#24190a] hover:bg-black/10" aria-label="Đóng">
          <X size={20} aria-hidden="true" />
        </button>
        <ScenarioFace scenario={scenario} />
        <div className="mt-3 text-center">
          <button ref={closeRef} type="button" onClick={onClose}
            className="rounded border border-candle bg-blood px-6 py-2 font-display tracking-widest text-parchment uppercase hover:brightness-110">
            Bước vào nhà
          </button>
        </div>
      </article>
    </div>
  );
}

// Hiện thẻ kịch bản một lần khi vào ván (nhớ theo mã phòng trên máy này).
export function useScenarioIntro(code, scenarioId) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!code || !scenarioId) return;
    const key = `betrayal.scenarioSeen.${code}.${scenarioId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Không có sessionStorage: vẫn hiện thẻ.
    }
    setOpen(true);
  }, [code, scenarioId]);
  return [open, setOpen];
}
