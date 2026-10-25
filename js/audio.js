/* SkyDispatch · Web Audio 音效（纯合成，无素材依赖） */
(function () {
  window.SD = window.SD || {};
  const SD = window.SD;

  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem('sd-muted') === '1'; } catch (e) { /* 隐私模式下忽略 */ }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function tone(freq, dur, opts) {
    if (muted || !ensure()) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.type = (opts && opts.type) || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts && opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t + dur);
    g.gain.setValueAtTime((opts && opts.vol) || 1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol) {
    if (muted || !ensure()) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = vol || 0.5;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
  }

  function seq(notes, gap, opts) {
    notes.forEach(([f, d], i) => setTimeout(() => tone(f, d, opts), i * gap));
  }

  SD.audio = {
    unlock() { ensure(); },
    setMuted(m) {
      muted = m;
      try { localStorage.setItem('sd-muted', m ? '1' : '0'); } catch (e) { /* 忽略 */ }
    },
    isMuted() { return muted; },
    approve() { seq([[520, 0.07], [780, 0.09]], 70, { type: 'triangle' }); },
    reject() { tone(220, 0.12, { type: 'sawtooth', vol: 0.5 }); },
    deliver(mult) {
      const base = 620 * (mult >= 3 ? 1.5 : mult === 2 ? 1.25 : 1);
      seq([[base, 0.06], [base * 1.335, 0.09]], 55, { type: 'triangle' });
    },
    expire() { tone(300, 0.28, { type: 'sawtooth', vol: 0.5, slide: 140 }); },
    crash() { noise(0.35, 0.7); tone(110, 0.3, { type: 'square', vol: 0.35, slide: 55 }); },
    warn() { seq([[880, 0.09], [880, 0.09]], 140, { type: 'square', vol: 0.35 }); },
    shield() { seq([[660, 0.08], [990, 0.14]], 80, { type: 'sine' }); },
    phase() { tone(440, 0.35, { type: 'sine', slide: 880 }); },
    tick() { tone(1200, 0.05, { type: 'square', vol: 0.3 }); },
    start() { seq([[440, 0.09], [550, 0.09], [660, 0.16]], 90, { type: 'triangle' }); },
    over(shutdown) {
      if (shutdown) seq([[440, 0.2], [330, 0.2], [220, 0.4]], 180, { type: 'sawtooth', vol: 0.5 });
      else seq([[660, 0.12], [520, 0.12], [780, 0.3]], 120, { type: 'triangle' });
    },
  };
})();
