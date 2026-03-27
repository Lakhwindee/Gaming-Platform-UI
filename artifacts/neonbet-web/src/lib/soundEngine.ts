// Piano/guitar style sound engine for crash game
let ctx: AudioContext | null = null;
let ambientInterval: ReturnType<typeof setInterval> | null = null;
let ambientGain: GainNode | null = null;
let _enabled = true;

if (typeof document !== 'undefined') {
  const unlock = () => {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  };
  document.addEventListener('click', unlock, { once: true, passive: true });
  document.addEventListener('touchstart', unlock, { once: true, passive: true });
  document.addEventListener('keydown', unlock, { once: true, passive: true });
}

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setSoundEnabled(on: boolean) {
  _enabled = on;
  if (ambientGain) ambientGain.gain.setTargetAtTime(on ? 0.28 : 0, getCtx().currentTime, 0.3);
}
export function isSoundEnabled() { return _enabled; }

// Am – F – C – G chord progression (piano arpeggio style)
const CHORDS = [
  [220.00, 261.63, 329.63], // Am  (A3, C4, E4)
  [174.61, 220.00, 261.63], // F   (F3, A3, C4)
  [261.63, 329.63, 392.00], // C   (C4, E4, G4)
  [196.00, 246.94, 293.66], // G   (G3, B3, D4)
];
let chordIdx = 0;

function playChord(ac: AudioContext, master: GainNode) {
  const now = ac.currentTime;
  const chord = CHORDS[chordIdx % CHORDS.length];
  chordIdx++;

  // Bass note — one octave below root, hits first
  const bassFreq = chord[0] / 2;
  const bassOsc = ac.createOscillator();
  bassOsc.type = 'sine';
  bassOsc.frequency.value = bassFreq;
  const bassEnv = ac.createGain();
  bassEnv.gain.setValueAtTime(0, now);
  bassEnv.gain.linearRampToValueAtTime(0.45, now + 0.02);
  bassEnv.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  bassOsc.connect(bassEnv); bassEnv.connect(master);
  bassOsc.start(now); bassOsc.stop(now + 1.4);

  // Arpeggio — stagger each note (guitar strum feel)
  chord.forEach((freq, i) => {
    const delay = i * 0.07;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const harmonic = ac.createOscillator();
    harmonic.type = 'triangle';
    harmonic.frequency.value = freq * 2;

    const env = ac.createGain();
    env.gain.setValueAtTime(0, now + delay);
    env.gain.linearRampToValueAtTime(0.32, now + delay + 0.015);
    env.gain.exponentialRampToValueAtTime(0.10, now + delay + 0.3);
    env.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.6);

    const harmGain = ac.createGain(); harmGain.gain.value = 0.15;

    osc.connect(env); env.connect(master);
    harmonic.connect(harmGain); harmGain.connect(env);
    osc.start(now + delay); osc.stop(now + delay + 1.8);
    harmonic.start(now + delay); harmonic.stop(now + delay + 1.8);
  });
}

// ── AMBIENT: Piano/guitar chord loop ─────────────────────────────────────────
export function startAmbient() {
  if (ambientInterval) return;
  if (!_enabled) return;
  const ac = getCtx();
  const master = ac.createGain();
  master.gain.setValueAtTime(0, ac.currentTime);
  master.gain.linearRampToValueAtTime(0.28, ac.currentTime + 1.5);
  master.connect(ac.destination);
  ambientGain = master;
  playChord(ac, master);
  ambientInterval = setInterval(() => {
    if (!ambientGain) return;
    const a = getCtx();
    if (a.state === 'suspended') a.resume().catch(() => {});
    playChord(a, ambientGain);
  }, 1800);
}

export function stopAmbient() {
  if (ambientInterval) { clearInterval(ambientInterval); ambientInterval = null; }
  if (!ambientGain) return;
  const ac = getCtx();
  ambientGain.gain.setTargetAtTime(0, ac.currentTime, 0.5);
  const g = ambientGain; ambientGain = null;
  setTimeout(() => { try { g.disconnect(); } catch {} }, 2500);
  chordIdx = 0;
}

// No-op: kept for API compatibility
export function updateAmbientMult(_mult: number) {}

// ── BLAST: Sharp impact on crash ──────────────────────────────────────────────
export function playBlast() {
  if (!_enabled) return;
  const ac = getCtx();
  if (ac.state === 'suspended') { ac.resume().then(() => _doBlast(ac)).catch(() => {}); return; }
  _doBlast(ac);
}

function _doBlast(ac: AudioContext) {
  const now = ac.currentTime;

  // Sub thud
  const sub = ac.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(90, now);
  sub.frequency.exponentialRampToValueAtTime(30, now + 0.3);
  const subGain = ac.createGain();
  subGain.gain.setValueAtTime(1.2, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  sub.connect(subGain); subGain.connect(ac.destination);
  sub.start(now); sub.stop(now + 0.45);

  // Sharp crack
  const crack = ac.createOscillator();
  crack.type = 'sine';
  crack.frequency.setValueAtTime(400, now);
  crack.frequency.exponentialRampToValueAtTime(80, now + 0.08);
  const crackGain = ac.createGain();
  crackGain.gain.setValueAtTime(0.7, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  crack.connect(crackGain); crackGain.connect(ac.destination);
  crack.start(now); crack.stop(now + 0.12);

  // Noise burst
  const bufSz = Math.floor(ac.sampleRate * 0.35);
  const nb = ac.createBuffer(1, bufSz, ac.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < bufSz; i++) d[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource(); noise.buffer = nb;
  const nf = ac.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1200;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.5, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  noise.connect(nf); nf.connect(ng); ng.connect(ac.destination);
  noise.start(now); noise.stop(now + 0.35);
}

// ── CASHOUT: Cute win sound ───────────────────────────────────────────────────
export function playCashout() {
  if (!_enabled) return;
  const ac = getCtx();
  if (ac.state === 'suspended') { ac.resume().then(() => _doCashout(ac)).catch(() => {}); return; }
  _doCashout(ac);
}

function _doCashout(ac: AudioContext) {
  const now = ac.currentTime;

  // Rising "wheee" glide
  const glide = ac.createOscillator();
  glide.type = 'sine';
  glide.frequency.setValueAtTime(300, now);
  glide.frequency.exponentialRampToValueAtTime(1200, now + 0.18);
  const glideGain = ac.createGain();
  glideGain.gain.setValueAtTime(0, now);
  glideGain.gain.linearRampToValueAtTime(0.28, now + 0.02);
  glideGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  glide.connect(glideGain); glideGain.connect(ac.destination);
  glide.start(now); glide.stop(now + 0.25);

  // C-E-G-C major arpeggio
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const t = now + 0.12 + i * 0.09;
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 1.005;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.38, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    const g2 = ac.createGain(); g2.gain.value = 0.4;
    o.connect(g); g.connect(ac.destination);
    o2.connect(g2); g2.connect(g);
    o.start(t); o.stop(t + 0.5);
    o2.start(t); o2.stop(t + 0.5);
  });

  // Sparkle twinkling
  const sparkle = [2093, 2637, 3136, 2637, 3136, 2093, 3520];
  const sStart = now + 0.12 + notes.length * 0.09 + 0.05;
  sparkle.forEach((freq, i) => {
    const t = sStart + i * 0.045;
    const s = ac.createOscillator(); s.type = 'sine'; s.frequency.value = freq;
    const sg = ac.createGain();
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(0.15, t + 0.008);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    s.connect(sg); sg.connect(ac.destination);
    s.start(t); s.stop(t + 0.12);
  });

  // Final chord
  const chordT = sStart + sparkle.length * 0.045 + 0.02;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.22, chordT);
    g.gain.exponentialRampToValueAtTime(0.001, chordT + 1.0);
    o.connect(g); g.connect(ac.destination);
    o.start(chordT); o.stop(chordT + 1.1);
  });
}
