// Âm thanh của game.
//
// Mặc định mọi thứ được TỔNG HỢP bằng Web Audio API (không cần file nào): một lớp nhạc nền
// ambient đổi theo giai đoạn (sảnh chờ / khám phá / Haunt / kết thúc) và các hiệu ứng ngắn.
// Muốn dùng file nhạc của riêng bạn: khai báo trong public/media/manifest.json – file có trong
// manifest sẽ thay cho phần tổng hợp tương ứng (xem public/media/README.md).

const STORE_KEY = 'betrayal.audio';
const DEFAULTS = { music: 0.6, sfx: 0.7, muted: false };

// Thông số nhạc nền tổng hợp cho từng giai đoạn.
//   root: tần số gốc (Hz) | intervals: tỉ lệ các nốt của hợp âm nền | cutoff: độ "tối" của âm
//   wind: âm lượng tiếng gió | bells: [min, max] giây giữa hai tiếng chuông, scale: tỉ lệ cao độ
//   heartbeat: âm lượng nhịp tim (0 = tắt)
const MOODS = {
  lobby: { root: 55, intervals: [1, 1.5, 2], cutoff: 360, wind: 0.04, bells: [10, 18], scale: [1, 1.2, 1.5, 1.8], heartbeat: 0 },
  explore: { root: 49, intervals: [1, 1.498, 2.004], cutoff: 420, wind: 0.08, bells: [7, 15], scale: [1, 1.189, 1.335, 1.498, 1.782], heartbeat: 0 },
  haunt: { root: 41.2, intervals: [1, 1.0595, 1.414, 2.01], cutoff: 640, wind: 0.13, bells: [4, 9], scale: [1, 1.0595, 1.414, 1.888], heartbeat: 0.55 },
  ended: { root: 65.4, intervals: [1, 1.26, 1.5], cutoff: 520, wind: 0.03, bells: [6, 11], scale: [1, 1.26, 1.5, 2], heartbeat: 0 },
};

const rand = (a, b) => a + Math.random() * (b - a);

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY)) };
  } catch {
    return { ...DEFAULTS };
  }
}

class AudioEngine {
  settings = loadSettings();
  manifest = { music: {}, sfx: {} };
  listeners = new Set();
  ctx = null;
  mood = null;
  track = null;
  resolveUrl = (path) => path;

  // ---------------------------------------------------------------- cài đặt (cho React)

  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSettings = () => this.settings;

  update(patch) {
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.settings));
    } catch {
      // Không lưu được cũng không sao.
    }
    this.applyVolumes();
    this.listeners.forEach((fn) => fn());
  }

  applyVolumes() {
    if (!this.ctx) return;
    const { music, sfx, muted } = this.settings;
    const now = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(muted ? 0 : music, now, 0.05);
    this.sfxBus.gain.setTargetAtTime(muted ? 0 : sfx, now, 0.05);
  }

  setManifest(audio, resolveUrl) {
    this.manifest = { music: audio?.music ?? {}, sfx: audio?.sfx ?? {} };
    if (resolveUrl) this.resolveUrl = resolveUrl;
    // Nếu nhạc nền đang chạy là bản tổng hợp mà manifest có file cho nó thì chuyển sang file.
    if (this.ctx && this.mood && this.manifest.music[this.mood]) this.startMood();
  }

  // ---------------------------------------------------------------- khởi động

  // Trình duyệt chỉ cho phát tiếng sau một thao tác của người dùng; gọi hàm này trong pointerdown/keydown.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.ctx.destination);
      this.sfxBus.connect(this.ctx.destination);
      this.musicBus.gain.value = 0;
      this.sfxBus.gain.value = 0;
      this.noise = this.makeNoise();
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.mood && !this.track) this.startMood();
  }

  makeNoise() {
    const length = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // ---------------------------------------------------------------- nhạc nền

  setMood(mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (this.ctx) this.startMood();
  }

  startMood() {
    this.track?.stop(2.5);
    const file = this.manifest.music[this.mood];
    this.track = file ? this.playFile(file, this.mood) : this.playGenerated(MOODS[this.mood]);
  }

  // Phát file nhạc lặp lại; nếu file lỗi (thiếu, sai định dạng) thì quay về bản tổng hợp.
  playFile(path, mood) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.musicBus);
    const el = new Audio(this.resolveUrl(path));
    el.loop = true;
    el.crossOrigin = 'anonymous';
    ctx.createMediaElementSource(el).connect(out);
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    let stopped = false;
    const fallback = () => {
      if (stopped || this.mood !== mood) return;
      console.warn(`[audio] Không phát được ${path} – dùng nhạc tổng hợp.`);
      this.track = this.playGenerated(MOODS[mood]);
    };
    el.addEventListener('error', fallback, { once: true });
    el.play().catch(() => {});
    return {
      kind: 'file',
      stop: (fade) => {
        stopped = true;
        out.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
        setTimeout(() => { el.pause(); out.disconnect(); }, fade * 1000 + 200);
      },
    };
  }

  playGenerated(mood) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const nodes = [];
    const timers = new Set();
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, now, 1.2);
    out.connect(this.musicBus);

    // Hợp âm nền: các sóng răng cưa lệch tông nhẹ, lọc thông thấp, tần số cắt dao động rất chậm.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mood.cutoff;
    filter.Q.value = 1.2;
    filter.connect(out);
    for (const ratio of mood.intervals) {
      for (const detune of [-7, 6]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = mood.root * ratio;
        osc.detune.value = detune + rand(-2, 2);
        const g = ctx.createGain();
        g.gain.value = 0.22 / mood.intervals.length;
        osc.connect(g).connect(filter);
        osc.start();
        nodes.push(osc);
      }
    }
    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.05;
    const sweepDepth = ctx.createGain();
    sweepDepth.gain.value = mood.cutoff * 0.45;
    sweep.connect(sweepDepth).connect(filter.frequency);
    sweep.start();
    nodes.push(sweep);

    // Tiếng gió: nhiễu trắng qua bộ lọc dải có tần số trôi chậm.
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 520;
    band.Q.value = 0.9;
    const windGain = ctx.createGain();
    windGain.gain.value = mood.wind;
    wind.connect(band).connect(windGain).connect(out);
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.08;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 320;
    gust.connect(gustDepth).connect(band.frequency);
    wind.start();
    gust.start();
    nodes.push(wind, gust);

    const later = (seconds, fn) => {
      const id = setTimeout(() => { timers.delete(id); fn(); }, seconds * 1000);
      timers.add(id);
    };

    // Tiếng chuông xa: một nốt sin tắt dần, cao độ ngẫu nhiên trong thang âm của giai đoạn.
    const bell = () => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = mood.root * 8 * mood.scale[Math.floor(Math.random() * mood.scale.length)];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 5.2);
      later(rand(...mood.bells), bell);
    };
    later(rand(2, mood.bells[0]), bell);

    // Nhịp tim (chỉ trong Haunt): hai tiếng thụp trầm liên tiếp.
    if (mood.heartbeat > 0) {
      const thump = (t, level) => {
        const osc = ctx.createOscillator();
        osc.frequency.setValueAtTime(62, t);
        osc.frequency.exponentialRampToValueAtTime(34, t + 0.16);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(level, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.connect(g).connect(out);
        osc.start(t);
        osc.stop(t + 0.25);
      };
      const beat = () => {
        const t = ctx.currentTime + 0.02;
        thump(t, mood.heartbeat);
        thump(t + 0.27, mood.heartbeat * 0.7);
        later(1.15, beat);
      };
      later(1.5, beat);
    }

    return {
      kind: 'generated',
      stop: (fade) => {
        timers.forEach(clearTimeout);
        timers.clear();
        out.gain.cancelScheduledValues(ctx.currentTime);
        out.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
        setTimeout(() => {
          nodes.forEach((n) => { try { n.stop(); } catch { /* đã dừng */ } });
          out.disconnect();
        }, fade * 1000 + 200);
      },
    };
  }

  // ---------------------------------------------------------------- hiệu ứng

  // name: 'dice' | 'card' | 'door' | 'hit' | 'haunt' | 'end' | 'turn'
  sfx(name, options = {}) {
    if (!this.ctx || this.settings.muted || this.ctx.state !== 'running') return;
    const file = this.manifest.sfx[name];
    if (file) {
      const el = new Audio(this.resolveUrl(file));
      el.volume = this.settings.sfx;
      el.play().catch(() => this.synth(name, options));
      return;
    }
    this.synth(name, options);
  }

  burst(t, duration, frequency, q, level) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = frequency;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + duration + 0.02);
    return f;
  }

  tone(t, { type = 'sine', from, to = from, duration, level, attack = 0.01 }) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  synth(name, { count = 3 } = {}) {
    const t = this.ctx.currentTime + 0.01;
    switch (name) {
      case 'dice': {
        // Mỗi viên xúc xắc là vài tiếng lách cách ngắn.
        const clicks = Math.min(8, Math.max(1, count)) * 2 + 2;
        for (let i = 0; i < clicks; i++) this.burst(t + i * 0.045 + rand(0, 0.02), 0.035, rand(1800, 3600), 6, 0.5);
        break;
      }
      case 'card': {
        const f = this.burst(t, 0.28, 900, 1.4, 0.35);
        f.frequency.exponentialRampToValueAtTime(3400, t + 0.25);
        break;
      }
      case 'door':
        this.tone(t, { type: 'sawtooth', from: 85, to: 150, duration: 0.55, level: 0.07, attack: 0.08 });
        this.tone(t + 0.5, { type: 'sawtooth', from: 150, to: 70, duration: 0.5, level: 0.06, attack: 0.05 });
        this.burst(t + 0.95, 0.12, 180, 1, 0.5);
        break;
      case 'hit':
        this.tone(t, { from: 130, to: 42, duration: 0.3, level: 0.6 });
        this.burst(t, 0.09, 700, 0.8, 0.4);
        break;
      case 'haunt':
        this.tone(t, { from: 58, to: 27, duration: 3.5, level: 0.7, attack: 0.05 });
        for (const ratio of [1, 1.0595, 1.414]) {
          this.tone(t + 0.2, { type: 'sawtooth', from: 110 * ratio, to: 220 * ratio, duration: 3, level: 0.06, attack: 1.8 });
        }
        this.burst(t, 1.6, 240, 0.6, 0.5);
        break;
      case 'turn':
        // Hai tiếng chuông ngắn, đủ rõ để nghe thấy khi đang ở tab khác.
        this.tone(t, { from: 784, duration: 0.5, level: 0.22 });
        this.tone(t + 0.16, { from: 1046, duration: 0.7, level: 0.2 });
        break;
      case 'end':
        [1, 1.26, 1.5, 2].forEach((ratio, i) => this.tone(t + i * 0.22, { from: 196 * ratio, duration: 2.4, level: 0.14 }));
        break;
      default:
        break;
    }
  }
}

export const audio = new AudioEngine();
