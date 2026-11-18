// Âm thanh riêng cho từng lá bài, căn phòng và quái vật – tất cả TỔNG HỢP bằng Web Audio API
// (không dùng file ghi âm nào), lấy cảm hứng từ kiểu «soundboard» của các ván Betrayal ngoài đời.
//
// Mỗi âm thanh là một hàm (k, t) => void, trong đó k là bộ «nhạc cụ» bên dưới và t là thời điểm bắt đầu.
// Muốn thay bằng file ghi âm của riêng bạn: khai báo audio.sounds[<id>] trong public/media/manifest.json.

const rand = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ bộ nhạc cụ

export function makeKit(ctx, out, noise) {
  // Một nốt dao động có thể trượt cao độ, rung (vibrato) và lọc.
  const osc = (t, { type = 'sine', f, to, dur, level = 0.2, attack = 0.01, vib = 0, vibRate = 6, filter, q = 1, pan = 0 }) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to && to !== f) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    if (vib) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = vibRate;
      const depth = ctx.createGain();
      depth.gain.value = vib;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const bq = ctx.createBiquadFilter();
      bq.type = filter.type ?? 'lowpass';
      bq.frequency.value = filter.f;
      bq.Q.value = q;
      node = node.connect(bq);
    }
    node = node.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  // Nhiễu trắng qua bộ lọc; tần số lọc có thể trượt (from → to).
  const hiss = (t, { dur, from = 1000, to, type = 'bandpass', q = 1, level = 0.3, attack = 0.005 }) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const bq = ctx.createBiquadFilter();
    bq.type = type;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(from, t);
    if (to && to !== from) bq.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bq).connect(g).connect(out);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  };

  const k = {
    osc, hiss,
    bell: (t, f, dur = 3, level = 0.15) => {
      osc(t, { f, dur, level });
      osc(t, { f: f * 2.76, dur: dur * 0.5, level: level * 0.35 });
      osc(t, { f: f * 5.4, dur: dur * 0.25, level: level * 0.15 });
    },
    chime: (t, notes, gap = 0.18, level = 0.12) => notes.forEach((f, i) => k.bell(t + i * gap, f, 2.2, level)),
    musicBox: (t, notes, gap = 0.28) => notes.forEach((f, i) => {
      osc(t + i * gap, { f, dur: 1.2, level: 0.13, type: 'triangle' });
      osc(t + i * gap, { f: f * 4, dur: 0.25, level: 0.03 });
    }),
    creak: (t, pitch = 1, len = 14) => {
      for (let i = 0; i < len; i++) {
        osc(t + i * 0.045 + rand(0, 0.01), { type: 'sawtooth', f: (80 + i * 5 + rand(-6, 6)) * pitch, dur: 0.07, level: 0.07, filter: { f: 900 }, q: 4 });
      }
    },
    knock: (t, n = 3, gap = 0.22) => {
      for (let i = 0; i < n; i++) {
        hiss(t + i * gap, { dur: 0.09, from: 320, q: 3, level: 0.7 });
        osc(t + i * gap, { f: 160, to: 90, dur: 0.12, level: 0.35 });
      }
    },
    steps: (t, n = 5, gap = 0.42, level = 0.5) => {
      for (let i = 0; i < n; i++) {
        hiss(t + i * gap + rand(0, 0.03), { dur: 0.11, from: 180, type: 'lowpass', level });
        osc(t + i * gap, { f: 90, to: 55, dur: 0.1, level: level * 0.4 });
      }
    },
    whisper: (t, dur = 1.6, level = 0.12) => {
      for (let x = 0; x < dur; x += rand(0.08, 0.22)) {
        hiss(t + x, { dur: rand(0.08, 0.25), from: rand(2200, 5200), q: rand(3, 8), level, attack: 0.03 });
      }
    },
    wind: (t, dur = 2.5, level = 0.25) => {
      hiss(t, { dur, from: 300, to: 1100, q: 2, level, attack: dur * 0.4 });
      hiss(t + dur * 0.3, { dur: dur * 0.7, from: 900, to: 350, q: 3, level: level * 0.7, attack: 0.3 });
    },
    wail: (t, f = 520, dur = 2.2, level = 0.12) => {
      osc(t, { f, to: f * 1.5, dur: dur * 0.5, level, attack: 0.4, vib: 14, vibRate: 5.5 });
      osc(t + dur * 0.45, { f: f * 1.5, to: f * 0.7, dur: dur * 0.6, level, attack: 0.1, vib: 18, vibRate: 5 });
    },
    scream: (t, level = 0.12) => {
      osc(t, { type: 'sawtooth', f: 700, to: 1500, dur: 0.35, level, filter: { type: 'bandpass', f: 1800 }, q: 2, vib: 40, vibRate: 11 });
      osc(t + 0.3, { type: 'sawtooth', f: 1500, to: 600, dur: 0.9, level, filter: { type: 'bandpass', f: 1500 }, q: 2, vib: 50, vibRate: 9 });
    },
    growl: (t, dur = 1.2, f = 62, level = 0.35) => {
      osc(t, { type: 'sawtooth', f, to: f * 0.8, dur, level, attack: 0.15, vib: 9, vibRate: 23, filter: { f: 500 } });
      hiss(t, { dur, from: 260, type: 'lowpass', level: level * 0.5, attack: 0.2 });
    },
    heartbeat: (t, n = 4, gap = 0.8, level = 0.6) => {
      for (let i = 0; i < n; i++) {
        osc(t + i * gap, { f: 62, to: 34, dur: 0.2, level });
        osc(t + i * gap + 0.25, { f: 58, to: 32, dur: 0.18, level: level * 0.7 });
      }
    },
    thunder: (t, level = 0.6) => {
      hiss(t, { dur: 0.25, from: 2500, type: 'lowpass', level });
      hiss(t + 0.1, { dur: 2.8, from: 400, to: 90, type: 'lowpass', level: level * 0.8, attack: 0.15 });
      osc(t, { f: 48, to: 30, dur: 2.5, level: level * 0.5 });
    },
    glass: (t, level = 0.12) => {
      hiss(t, { dur: 0.3, from: 6000, type: 'highpass', level: level * 2 });
      for (let i = 0; i < 9; i++) osc(t + rand(0, 0.35), { f: rand(2500, 6500), dur: rand(0.2, 0.6), level });
    },
    drip: (t, n = 4, gap = 0.5) => {
      for (let i = 0; i < n; i++) osc(t + i * gap + rand(0, 0.15), { f: rand(900, 1300), to: 2600, dur: 0.07, level: 0.25 });
    },
    splash: (t, level = 0.4) => {
      hiss(t, { dur: 0.9, from: 3000, to: 300, type: 'lowpass', level });
      for (let i = 0; i < 6; i++) osc(t + rand(0.1, 0.7), { f: rand(500, 900), to: 1800, dur: 0.06, level: 0.12 });
    },
    bubbles: (t, n = 10, dur = 1.5) => {
      for (let i = 0; i < n; i++) osc(t + rand(0, dur), { f: rand(300, 700), to: rand(900, 1600), dur: 0.08, level: 0.13 });
    },
    metal: (t, f = 220, level = 0.12) => {
      for (const r of [1, 2.41, 3.83, 5.1]) osc(t, { type: 'square', f: f * r, dur: 1.4 / r + 0.3, level: level / r, filter: { f: 4000 } });
      hiss(t, { dur: 0.06, from: 3000, level: 0.4 });
    },
    gunshot: (t) => {
      hiss(t, { dur: 0.35, from: 2500, to: 400, type: 'lowpass', level: 1 });
      osc(t, { f: 120, to: 40, dur: 0.3, level: 0.6 });
      hiss(t + 0.15, { dur: 1.4, from: 600, to: 150, type: 'lowpass', level: 0.15, attack: 0.05 });
    },
    swoosh: (t, up = true, level = 0.3) => hiss(t, { dur: 0.35, from: up ? 400 : 3500, to: up ? 3500 : 400, q: 2, level, attack: 0.15 }),
    chop: (t) => {
      k.swoosh(t, false, 0.25);
      hiss(t + 0.3, { dur: 0.15, from: 900, q: 1.5, level: 0.8 });
      osc(t + 0.3, { f: 150, to: 60, dur: 0.2, level: 0.5 });
    },
    bark: (t, n = 2) => {
      for (let i = 0; i < n; i++) {
        osc(t + i * 0.32, { type: 'sawtooth', f: 520, to: 300, dur: 0.14, level: 0.25, filter: { type: 'bandpass', f: 900 }, q: 2 });
        hiss(t + i * 0.32, { dur: 0.12, from: 1200, q: 2, level: 0.3 });
      }
    },
    laugh: (t, f = 620, n = 4) => {
      for (let i = 0; i < n; i++) osc(t + i * 0.17, { type: 'triangle', f: f * (1 - i * 0.04), to: f * 0.8, dur: 0.13, level: 0.12, vib: 25, vibRate: 30 });
    },
    coin: (t) => {
      osc(t, { f: 1975, dur: 0.12, level: 0.15, type: 'square', filter: { f: 5000 } });
      osc(t + 0.08, { f: 2637, dur: 0.6, level: 0.12, type: 'square', filter: { f: 5000 } });
    },
    tick: (t, n = 6, gap = 0.5) => {
      for (let i = 0; i < n; i++) hiss(t + i * gap, { dur: 0.03, from: i % 2 ? 2500 : 3200, q: 8, level: 0.6 });
    },
    breath: (t, n = 2, level = 0.25) => {
      for (let i = 0; i < n; i++) {
        hiss(t + i * 1.3, { dur: 0.7, from: 700, to: 1100, type: 'bandpass', q: 0.8, level, attack: 0.4 });
        hiss(t + i * 1.3 + 0.7, { dur: 0.6, from: 900, to: 500, type: 'bandpass', q: 0.8, level: level * 0.7, attack: 0.2 });
      }
    },
    rustle: (t, dur = 0.8, level = 0.15) => {
      for (let x = 0; x < dur; x += rand(0.03, 0.08)) hiss(t + x, { dur: 0.05, from: rand(2000, 4000), q: 1, level });
    },
    page: (t, n = 3) => {
      for (let i = 0; i < n; i++) k.swoosh(t + i * 0.3, true, 0.18);
    },
    fire: (t, dur = 2) => {
      hiss(t, { dur, from: 500, type: 'lowpass', level: 0.25, attack: 0.3 });
      for (let i = 0; i < 18; i++) hiss(t + rand(0, dur), { dur: 0.02, from: rand(2000, 6000), type: 'highpass', level: 0.4 });
    },
    shimmer: (t, base = 880, n = 7) => {
      for (let i = 0; i < n; i++) osc(t + i * 0.07, { f: base * 2 ** (i / 4), dur: 1.2, level: 0.06, pan: (i % 2 ? 0.4 : -0.4) });
    },
    stinger: (t, level = 0.08) => {
      for (const f of [110, 116.5, 155.6, 164.8, 233]) {
        osc(t, { type: 'sawtooth', f, to: f * 1.02, dur: 2.2, level, attack: 0.02, filter: { f: 2500 } });
      }
      hiss(t, { dur: 0.4, from: 3000, q: 0.7, level: 0.25 });
    },
    organ: (t, chord, dur = 2.5, level = 0.07) => {
      for (const f of chord) {
        osc(t, { type: 'square', f, dur, level, attack: 0.25, filter: { f: 1600 } });
        osc(t, { f: f * 2, dur, level: level * 0.6, attack: 0.25 });
      }
    },
    drone: (t, f = 55, dur = 3, level = 0.2) => osc(t, { type: 'sawtooth', f, to: f * 0.97, dur, level, attack: 0.6, filter: { f: 300 } }),
    crunch: (t, n = 6) => {
      for (let i = 0; i < n; i++) hiss(t + i * 0.07 + rand(0, 0.03), { dur: 0.05, from: rand(400, 1400), q: 1, level: 0.6 });
    },
    sip: (t) => {
      k.bubbles(t, 5, 0.5);
      hiss(t + 0.5, { dur: 0.3, from: 900, q: 1, level: 0.15, attack: 0.1 });
    },
    cough: (t) => {
      hiss(t, { dur: 0.18, from: 500, q: 1, level: 0.6 });
      hiss(t + 0.3, { dur: 0.15, from: 450, q: 1, level: 0.45 });
    },
    slam: (t) => {
      hiss(t, { dur: 0.25, from: 300, type: 'lowpass', level: 1 });
      osc(t, { f: 70, to: 35, dur: 0.4, level: 0.6 });
    },
    sting: (t) => osc(t, { type: 'sawtooth', f: 1200, to: 180, dur: 0.5, level: 0.1, filter: { f: 3000 } }),
  };
  return k;
}

// Nốt nhạc dùng nhiều (Hz).
const N = { A3: 220, C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784, A5: 880, C6: 1046.5 };

// ------------------------------------------------------------------ âm thanh từng thứ

export const SOUNDS = {
  // Điềm báo
  'om-leather-journal': (k, t) => { k.page(t, 3); k.whisper(t + 0.8, 1.2); },
  'om-porcelain-mask': (k, t) => { k.osc(t, { f: 1800, dur: 1.5, level: 0.08 }); k.laugh(t + 0.4, 700, 5); k.stinger(t + 1.4, 0.04); },
  'om-ritual-knife': (k, t) => { k.osc(t, { type: 'sawtooth', f: 3000, to: 6000, dur: 0.6, level: 0.05, filter: { type: 'highpass', f: 2500 } }); k.chime(t + 0.6, [N.A3 * 0.5, N.A3 * 0.53], 0.3, 0.2); },
  'om-engraved-ring': (k, t) => { k.osc(t, { f: 2800, dur: 2, level: 0.1, vib: 6 }); k.bell(t + 0.3, N.E5, 2.5, 0.1); },
  'om-stray-dog': (k, t) => { k.growl(t, 0.9, 110, 0.25); k.bark(t + 1, 2); },
  'om-crystal-orb': (k, t) => { k.shimmer(t, 700, 9); k.drone(t, 110, 2.5, 0.06); },
  'om-cracked-skull': (k, t) => { k.crunch(t, 4); k.wail(t + 0.5, 300, 2, 0.08); },
  'om-silver-necklace': (k, t) => { k.chime(t, [N.E5, N.G5, N.B4 * 2], 0.12, 0.08); k.rustle(t + 0.4, 0.4, 0.08); },
  'om-girl-in-mirror': (k, t) => { k.glass(t, 0.06); k.musicBox(t + 0.5, [N.E5, N.D5, N.C5, N.D5, N.E5, N.E5]); k.laugh(t + 2.2, 900, 3); },

  // Vật phẩm
  'it-fire-axe': (k, t) => k.chop(t),
  'it-old-revolver': (k, t) => { k.knock(t, 1); k.tick(t + 0.2, 2, 0.15); k.gunshot(t + 0.7); },
  'it-first-aid': (k, t) => { k.rustle(t, 0.5); k.osc(t + 0.6, { f: N.C5, dur: 0.4, level: 0.12 }); k.osc(t + 0.75, { f: N.G5, dur: 0.6, level: 0.12 }); },
  'it-calming-tea': (k, t) => { k.bubbles(t, 8, 1); k.sip(t + 1.1); },
  'it-charm': (k, t) => { k.shimmer(t, 1200, 6); k.bell(t + 0.2, N.A4, 2.5, 0.08); },
  'it-soft-shoes': (k, t) => k.steps(t, 5, 0.35, 0.15),
  'it-magnifier': (k, t) => { k.swoosh(t, true, 0.12); k.osc(t + 0.3, { f: 2400, dur: 0.3, level: 0.08 }); },
  'it-leather-gloves': (k, t) => { k.rustle(t, 0.9, 0.12); k.creak(t + 0.9, 3, 5); },
  'it-strong-liquor': (k, t) => { k.osc(t, { f: 150, to: 600, dur: 0.12, level: 0.3 }); k.bubbles(t + 0.2, 12, 1.2); k.cough(t + 1.6); },
  'it-bone-dice': (k, t) => { for (let i = 0; i < 10; i++) k.hiss(t + i * 0.06 + rand(0, 0.02), { dur: 0.03, from: rand(1200, 2400), q: 6, level: 0.5 }); },

  // Sự kiện
  'ev-whispers': (k, t) => k.whisper(t, 2.4, 0.14),
  'ev-rotten-floor': (k, t) => { k.creak(t, 0.8, 10); k.crunch(t + 0.6, 6); k.slam(t + 1.1); },
  'ev-cold-hand': (k, t) => { k.wind(t, 1.4, 0.15); k.osc(t + 0.5, { f: 3200, to: 2000, dur: 1, level: 0.05 }); k.heartbeat(t + 1, 2, 0.5, 0.5); },
  'ev-portrait': (k, t) => { k.creak(t, 1.4, 6); k.stinger(t + 0.6, 0.05); },
  'ev-quiet-moment': (k, t) => k.musicBox(t, [N.C5, N.E5, N.G5, N.E5, N.C6]),
  'ev-lights-out': (k, t) => { k.wind(t, 1.2, 0.3); k.hiss(t + 0.9, { dur: 0.15, from: 1500, q: 2, level: 0.4 }); k.heartbeat(t + 1.3, 3, 0.7, 0.4); },
  'ev-trapdoor': (k, t) => { k.creak(t, 0.7, 8); k.swoosh(t + 0.5, false, 0.35); k.slam(t + 1); },
  'ev-music-box': (k, t) => k.musicBox(t, [N.A4, N.C5, N.E5, N.A5, N.G5, N.E5, N.D5 * 0.94], 0.33),
  'ev-familiar-scent': (k, t) => { k.breath(t, 1, 0.2); k.chime(t + 0.8, [N.F4, N.A4, N.C5], 0.2, 0.06); },
  'ev-bite': (k, t) => { k.growl(t, 0.5, 90, 0.2); k.crunch(t + 0.4, 3); k.scream(t + 0.6, 0.06); },
  'ev-hidden-drawer': (k, t) => { k.hiss(t, { dur: 0.6, from: 400, to: 900, q: 1, level: 0.25, attack: 0.1 }); k.knock(t + 0.6, 1); k.shimmer(t + 0.8, 1400, 4); },
  'ev-waking-nightmare': (k, t) => { k.drone(t, 41, 2.5, 0.25); k.stinger(t + 0.2, 0.06); k.scream(t + 1.3, 0.08); },

  // Quái vật (theo loại)
  wraith: (k, t) => { k.wail(t, 400, 2.4, 0.14); k.wind(t, 2.2, 0.15); },
  'nhap-trang': (k, t) => { k.creak(t, 0.6, 12); k.knock(t + 0.4, 3, 0.3); k.growl(t + 1.2, 1, 55, 0.25); },
  'ma-da': (k, t) => { k.splash(t, 0.35); k.bubbles(t + 0.4, 10, 1.4); k.wail(t + 0.6, 300, 1.8, 0.08); },
  'ma-lai': (k, t) => { k.swoosh(t, true, 0.3); k.osc(t, { type: 'sawtooth', f: 180, to: 240, dur: 1.5, level: 0.08, vib: 30, vibRate: 13, filter: { f: 1200 } }); k.drip(t + 0.6, 3, 0.35); },
  'co-hon': (k, t) => { k.whisper(t, 1.8, 0.12); k.wail(t + 0.3, 600, 1.8, 0.07); k.wail(t + 0.7, 450, 1.6, 0.06); },
  'ma-giu-cua': (k, t) => { k.laugh(t, 800, 4); k.coin(t + 0.8); k.coin(t + 1.1); k.whisper(t + 1.3, 0.8, 0.1); },

  // Phòng (phát khi phòng được khám phá)
  'entrance-hall': (k, t) => k.organ(t, [N.C4, N.E4 * 0.95, N.G4], 2),
  foyer: (k, t) => k.tick(t, 4, 0.5),
  'grand-staircase': (k, t) => k.steps(t, 4, 0.35, 0.3),
  'upper-landing': (k, t) => k.creak(t, 1.2, 8),
  'basement-landing': (k, t) => k.drip(t, 3, 0.6),
  'dining-room': (k, t) => { k.chime(t, [N.C6, N.A5 * 1.5], 0.25, 0.05); k.knock(t + 0.4, 1); },
  'game-room': (k, t) => { k.knock(t, 2, 0.12); k.laugh(t + 0.5, 700, 3); },
  attic: (k, t) => { k.wind(t, 2, 0.2); k.creak(t + 0.5, 1.3, 6); },
  'master-bedroom': (k, t) => { k.tick(t, 4, 0.5); k.breath(t + 0.3, 1, 0.12); },
  crypt: (k, t) => { k.drone(t, 49, 2.5, 0.22); k.slam(t + 0.4); },
  'ritual-chamber': (k, t) => { k.organ(t, [110, 116.5, 164.8], 2.5, 0.05); k.whisper(t + 0.5, 1.5, 0.1); },
  'servants-quarters': (k, t) => { k.rustle(t, 0.6); k.steps(t + 0.6, 3, 0.3, 0.2); },
  'abandoned-room': (k, t) => k.wind(t, 2, 0.15),
  'mirror-gallery': (k, t) => { k.shimmer(t, 1500, 5); k.glass(t + 0.6, 0.03); },
  conservatory: (k, t) => { k.drip(t, 4, 0.4); k.rustle(t + 0.3, 1, 0.08); },
  ballroom: (k, t) => k.musicBox(t, [N.G4, N.C5, N.E5, N.C5, N.G4], 0.3),
  bedroom: (k, t) => k.creak(t, 1.6, 5),
  nursery: (k, t) => { k.musicBox(t, [N.E5, N.D5, N.C5], 0.4); k.laugh(t + 1.2, 900, 2); },
  'creaky-hallway': (k, t) => k.creak(t, 1, 16),
  'dusty-hallway': (k, t) => { k.cough(t); k.wind(t + 0.3, 1.5, 0.1); },
  'wine-cellar': (k, t) => { k.drip(t, 2, 0.5); k.chime(t + 0.5, [N.A5 * 1.2], 0.2, 0.05); },
  'furnace-room': (k, t) => k.fire(t, 2.2),
  tower: (k, t) => { k.wind(t, 2.5, 0.25); k.bell(t + 0.6, 110, 4, 0.15); },
  garden: (k, t) => { k.wind(t, 2, 0.12); k.osc(t + 0.5, { f: 2600, to: 3400, dur: 0.15, level: 0.04 }); k.osc(t + 0.8, { f: 2600, to: 3300, dur: 0.15, level: 0.04 }); },
  kitchen: (k, t) => { k.metal(t, 330, 0.06); k.bubbles(t + 0.3, 8, 1.2); },
  storeroom: (k, t) => { k.knock(t, 1); k.rustle(t + 0.2, 0.6); },
  larder: (k, t) => k.drip(t, 3, 0.4),
  study: (k, t) => { k.page(t, 2); k.tick(t + 0.4, 4, 0.5); },
  vault: (k, t) => { k.metal(t, 110, 0.12); k.coin(t + 0.8); },
  'sewing-room': (k, t) => { for (let i = 0; i < 12; i++) k.knock(t + i * 0.08, 1); },
  workshop: (k, t) => { k.metal(t, 180, 0.08); k.knock(t + 0.5, 2, 0.25); },
  library: (k, t) => { k.page(t, 2); k.whisper(t + 0.6, 1, 0.06); },
  chapel: (k, t) => { k.organ(t, [N.F4, N.A4, N.C5], 2.5, 0.06); k.bell(t + 0.2, N.F4 / 2, 4, 0.1); },
  gym: (k, t) => { k.slam(t); k.breath(t + 0.3, 1, 0.15); },
  tunnel: (k, t) => { k.drip(t, 3, 0.5); k.steps(t + 0.3, 3, 0.45, 0.2); },
};

// Âm thanh lấy từ thẻ bài / ô gạch / loại quái vật; không có thì dùng âm chung theo loại.
export const FALLBACK = {
  omen: (k, t) => k.stinger(t, 0.05),
  item: (k, t) => k.shimmer(t, 900, 4),
  event: (k, t) => k.whisper(t, 1.2),
  monster: (k, t) => k.growl(t),
  room: (k, t) => k.creak(t),
};
