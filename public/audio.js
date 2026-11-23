// Procedural chill lo-fi music + sound effects, all generated live with Web Audio (no files needed).
window.Sound = (function () {
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const cfg = Object.assign({ music: 0.45, sfx: 0.8, musicOn: true, sfxOn: true }, store.get('ss_audio', {}));
  let ctx, master, musicBus, sfxBus, lp, reverb, crackleSrc, schedTimer, nextTime = 0, step = 0, bar = 0, playing = false;
  let noiseBuf;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const BPM = 74, STEP = 60 / BPM / 4;
  // Fmaj7 – Em7 – Dm7 – Cmaj7 (warm and lazy), second half swaps in Am7 – G6
  const PROG = [
    { root: 41, ch: [53, 57, 60, 64] },
    { root: 40, ch: [52, 55, 59, 62] },
    { root: 38, ch: [50, 53, 57, 60] },
    { root: 36, ch: [48, 52, 55, 59] },
    { root: 41, ch: [53, 57, 60, 64] },
    { root: 40, ch: [52, 55, 59, 62] },
    { root: 45, ch: [52, 55, 57, 60] },
    { root: 43, ch: [50, 52, 55, 59] },
  ];
  const SCALE = [72, 74, 76, 79, 81, 84];

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicBus = ctx.createGain(); sfxBus = ctx.createGain();
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.3;
    musicBus.connect(lp); lp.connect(master);
    sfxBus.connect(master);
    // reverb
    reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.28; reverb.connect(wet); wet.connect(lp);
    // noise buffer
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    applyVolumes();
    if (cfg.musicOn) startMusic();
  }
  function applyVolumes() {
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(cfg.musicOn ? cfg.music * 0.55 : 0, ctx.currentTime, 0.15);
    sfxBus.gain.setTargetAtTime(cfg.sfxOn ? cfg.sfx : 0, ctx.currentTime, 0.05);
  }

  // ---------------- music voices
  function env(g, t, a, peak, d, sustain = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
  }
  function pad(notes, t, dur) {
    for (const n of notes) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'triangle'; o.frequency.value = mtof(n); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = 900;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.028, t + 0.6);
        g.gain.setValueAtTime(0.028, t + dur - 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
        o.connect(f); f.connect(g); g.connect(musicBus); g.connect(reverb);
        o.start(t); o.stop(t + dur + 0.5);
      }
    }
  }
  function keys(n, t, vel = 1) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
    o.type = 'sine'; o.frequency.value = mtof(n);
    o2.type = 'sine'; o2.frequency.value = mtof(n) * 2; g2.gain.value = mtof(n) * 0.6;
    o2.connect(g2); g2.connect(o.frequency); // gentle FM for an electric-piano bell
    env(g, t, 0.01, 0.07 * vel, 1.3);
    o.connect(g); g.connect(musicBus); g.connect(reverb);
    o.start(t); o2.start(t); o.stop(t + 1.5); o2.stop(t + 1.5);
  }
  function bass(n, t, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = mtof(n);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    env(g, t, 0.003, 0.32, 0.3);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.35);
  }
  function noise(t, dur, type, freq, gain, bus, q = 0.8) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    env(g, t, 0.002, gain, dur);
    s.connect(f); f.connect(g); g.connect(bus || musicBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    return g;
  }
  function snare(t) { const g = noise(t, 0.22, 'bandpass', 1700, 0.09); g.connect(reverb); }
  function hat(t, open) { noise(t, open ? 0.12 : 0.035, 'highpass', 7500, 0.035); }
  function crackle() {
    // sparse vinyl crackle
    const len = ctx.sampleRate * 4, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.8 : (Math.random() * 2 - 1) * 0.012;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = b; s.loop = true; f.type = 'bandpass'; f.frequency.value = 2500; g.gain.value = 0.35;
    s.connect(f); f.connect(g); g.connect(musicBus); s.start();
    return s;
  }

  function scheduleStep(t) {
    const s = step % 16;
    const chord = PROG[bar % PROG.length];
    const swing = s % 2 === 1 ? STEP * 0.18 : 0;
    const tt = t + swing;
    if (s === 0) { pad(chord.ch, t, STEP * 16); bass(chord.root, t, STEP * 6); }
    if (s === 10) bass(chord.root + 12, tt, STEP * 4);
    if (s === 14 && bar % 2) bass(chord.root + 7, tt, STEP * 2);
    if (s === 0 || s === 7 || (s === 10 && bar % 2 === 0)) kick(tt);
    if (s === 4 || s === 12) snare(tt);
    if (s % 2 === 0) hat(tt, s === 14);
    else if (Math.random() < 0.25) hat(tt);
    if (s === 2 || s === 8) {
      const ch = chord.ch.map((n) => n + 12);
      ch.forEach((n, i) => { if (Math.random() < 0.8) keys(n, tt + i * 0.025, 0.7); });
    }
    if ((s === 6 || s === 11 || s === 13) && Math.random() < 0.35) keys(SCALE[Math.floor(Math.random() * SCALE.length)], tt, 0.9);
    step++;
    if (step % 16 === 0) bar++;
  }
  function tick() {
    while (nextTime < ctx.currentTime + 0.15) { scheduleStep(nextTime); nextTime += STEP; }
  }
  function startMusic() {
    if (!ctx || playing) return;
    playing = true; step = 0; nextTime = ctx.currentTime + 0.1;
    crackleSrc = crackle();
    schedTimer = setInterval(tick, 30);
  }
  function stopMusic() {
    playing = false; clearInterval(schedTimer);
    if (crackleSrc) { try { crackleSrc.stop(); } catch (e) {} crackleSrc = null; }
  }

  // ---------------- sound effects
  function tone(freq, t0, dur, type = 'sine', gain = 0.2, slideTo, a = 0.005) {
    if (!ctx) return;
    const t = ctx.currentTime + t0;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env(g, t, a, gain, dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + a + 0.05);
  }
  const sfxNoise = (t0, dur, type, f, gain, q) => ctx && noise(ctx.currentTime + t0, dur, type, f, gain, sfxBus, q);
  const fx = {
    click: () => tone(1200, 0, 0.03, 'sine', 0.08),
    select: () => { tone(740, 0, 0.06, 'triangle', 0.12); sfxNoise(0, 0.04, 'highpass', 4000, 0.05); },
    flip: () => { sfxNoise(0, 0.07, 'bandpass', 2600, 0.25, 1.2); tone(500, 0, 0.04, 'triangle', 0.06, 900); },
    deal: () => { for (let i = 0; i < 6; i++) sfxNoise(i * 0.07, 0.05, 'bandpass', 2400 + i * 120, 0.2, 1.4); },
    set: () => { tone(523, 0, 0.18, 'triangle', 0.16); tone(659, 0.07, 0.18, 'triangle', 0.16); tone(784, 0.14, 0.35, 'triangle', 0.18); sfxNoise(0, 0.08, 'bandpass', 1800, 0.2); },
    discard: () => { sfxNoise(0, 0.14, 'lowpass', 1400, 0.3); tone(220, 0, 0.12, 'sine', 0.08, 140); },
    yourTurn: () => { [1046, 1318, 1568, 2093].forEach((f, i) => { tone(f, i * 0.09, 0.9, 'sine', 0.13); tone(f * 2.01, i * 0.09, 0.4, 'sine', 0.03); }); },
    challenge: () => { tone(98, 0, 0.5, 'sawtooth', 0.12, 196); tone(147, 0.02, 0.5, 'sawtooth', 0.08, 294); sfxNoise(0, 0.3, 'lowpass', 600, 0.4); },
    counter: () => { tone(330, 0, 0.12, 'square', 0.08, 494); sfxNoise(0, 0.12, 'bandpass', 1200, 0.25, 2); },
    steal: () => { sfxNoise(0, 0.06, 'highpass', 5000, 0.2); tone(1975, 0.02, 0.08, 'square', 0.06); tone(2637, 0.1, 0.5, 'square', 0.06); tone(1318, 0.1, 0.5, 'sine', 0.12); [0, 0.08, 0.16, 0.24].forEach((d) => tone(3000 + Math.random() * 1500, 0.12 + d, 0.08, 'sine', 0.05)); },
    robbed: () => { tone(440, 0, 0.6, 'sawtooth', 0.09, 110); tone(330, 0.08, 0.6, 'sawtooth', 0.06, 82); },
    defended: () => { tone(392, 0, 0.12, 'triangle', 0.15); tone(587, 0.1, 0.4, 'triangle', 0.16); sfxNoise(0, 0.1, 'bandpass', 3000, 0.15); },
    chat: () => tone(660, 0, 0.07, 'sine', 0.1, 990),
    react: () => tone(880, 0, 0.1, 'triangle', 0.08, 1320),
    join: () => { tone(587, 0, 0.12, 'sine', 0.12); tone(880, 0.1, 0.25, 'sine', 0.12); },
    tick: () => tone(1500, 0, 0.03, 'square', 0.04),
    error: () => { tone(200, 0, 0.12, 'square', 0.06); tone(160, 0.1, 0.15, 'square', 0.06); },
    roundEnd: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.6, 'triangle', 0.14)); },
    win: () => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.11, 0.5, 'triangle', 0.15)); [523, 659, 784].forEach((f) => tone(f, 0.85, 1.4, 'sine', 0.1)); },
  };

  return {
    init,
    play(name) { if (!ctx || !cfg.sfxOn) return; try { fx[name] && fx[name](); } catch (e) {} },
    cfg,
    set(k, v) {
      cfg[k] = v; store.set('ss_audio', cfg);
      if (!ctx) return;
      if (k === 'musicOn') { if (v) startMusic(); }
      applyVolumes();
    },
    get musicPlaying() { return playing && cfg.musicOn; },
    stopMusic,
  };
})();
