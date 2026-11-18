// Bảng âm thanh: bấm vào thẻ để nghe âm thanh của từng Vật phẩm, Sự kiện, Điềm báo, Quái vật và Phòng.
// Cùng các âm thanh tự phát trong ván (khi rút bài, mở phòng, quái vật xuất hiện).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Ghost, Search, X } from 'lucide-react';
import { audio } from '../lib/audio.js';
import { useGameStore } from '../store/useGameStore.js';
import { Art } from './ui.jsx';

// Quái vật của các kịch bản (theo loại, khớp với monster.type ở server).
const MONSTERS = [
  { id: 'wraith', name: 'Vong hồn' },
  { id: 'nhap-trang', name: 'Quỷ nhập tràng' },
  { id: 'ma-da', name: 'Ma da' },
  { id: 'ma-lai', name: 'Đầu ma lai' },
  { id: 'co-hon', name: 'Cô hồn' },
  { id: 'ma-giu-cua', name: 'Ma giữ của' },
];

const TABS = [
  { id: 'item', label: 'Vật phẩm' },
  { id: 'event', label: 'Sự kiện' },
  { id: 'omen', label: 'Điềm báo' },
  { id: 'monster', label: 'Quái vật' },
  { id: 'room', label: 'Phòng' },
];

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

export default function Soundboard({ onClose }) {
  const catalog = useGameStore((s) => s.catalog);
  const media = useGameStore((s) => s.media);
  const [tab, setTab] = useState('item');
  const [query, setQuery] = useState('');
  const [playing, setPlaying] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const entries = useMemo(() => {
    const cards = catalog?.cards ?? [];
    const lists = {
      item: cards.filter((c) => c.type === 'item').map((c) => ({ id: c.id, name: c.name, art: media.cards?.[c.id] })),
      event: cards.filter((c) => c.type === 'event').map((c) => ({ id: c.id, name: c.name, art: media.cards?.[c.id] })),
      omen: cards.filter((c) => c.type === 'omen').map((c) => ({ id: c.id, name: c.name, art: media.cards?.[c.id] })),
      monster: MONSTERS,
      room: (catalog?.tiles ?? []).map((t) => ({ id: t.id, name: t.name, art: media.tiles?.[t.id] })),
    };
    const q = fold(query.trim());
    if (!q) return lists[tab];
    // Có từ khoá thì tìm trên mọi nhóm.
    return TABS.flatMap((t) => lists[t.id].filter((e) => fold(e.name).includes(q)).map((e) => ({ ...e, kind: t.id })));
  }, [catalog, media, tab, query]);

  const play = (entry) => {
    audio.play(entry.id, entry.kind ?? tab, { force: true });
    setPlaying(entry.id);
    setTimeout(() => setPlaying((p) => (p === entry.id ? null : p)), 900);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="soundboard-title"
        className="flex max-h-full w-full max-w-3xl flex-col rounded-md border-2 border-[#6b5a3c] bg-[#1b1611] shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-mortar px-4 py-3">
          <h2 id="soundboard-title" className="font-display text-xl text-parchment">Bảng âm thanh</h2>
          <label className="ml-auto flex items-center gap-1.5 rounded border border-mortar bg-black/30 px-2 py-1">
            <Search size={15} className="text-stone-500" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm…"
              className="w-28 bg-transparent text-sm text-parchment outline-none placeholder:text-stone-600 sm:w-40"
              aria-label="Tìm âm thanh"
            />
          </label>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded p-1 text-bone hover:bg-black/40" aria-label="Đóng bảng âm thanh">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {!query && (
          <div role="tablist" aria-label="Nhóm âm thanh" className="flex gap-1 overflow-x-auto border-b border-mortar px-3 pt-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-t px-3 py-1.5 text-sm ${tab === t.id ? 'bg-candle/20 text-candle' : 'text-bone hover:text-parchment'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="thin-scroll grid grid-cols-3 gap-2 overflow-y-auto p-3 sm:grid-cols-4 md:grid-cols-5">
          {entries.map((e) => (
            <button
              key={`${e.kind ?? tab}:${e.id}`}
              type="button"
              onClick={() => play(e)}
              className={`group relative flex aspect-square flex-col overflow-hidden rounded border bg-black/40 text-left transition
                ${playing === e.id ? 'border-candle shadow-[0_0_14px_rgba(224,164,58,0.6)]' : 'border-mortar hover:border-candle/70'}`}
            >
              <span className="flex flex-1 items-center justify-center overflow-hidden">
                {e.art ? (
                  <Art src={e.art} className="h-full w-full object-cover opacity-80 group-hover:opacity-100" />
                ) : (
                  <Ghost size={34} className="text-stone-500 group-hover:text-parchment" aria-hidden="true" />
                )}
              </span>
              <span className="bg-black/70 px-1.5 py-1 text-xs leading-tight text-parchment">{e.name}</span>
            </button>
          ))}
          {!entries.length && <p className="col-span-full py-6 text-center text-sm text-stone-500">Không tìm thấy.</p>}
        </div>
        <p className="border-t border-mortar px-4 py-2 text-xs text-stone-500">
          Trong ván, âm thanh tự phát khi rút bài, mở phòng mới và khi quái vật xuất hiện hay giao chiến.
        </p>
      </section>
    </div>
  );
}
