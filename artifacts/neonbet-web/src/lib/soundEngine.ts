// Game sound engine — casino/crash game style
let ctx: AudioContext | null = null;
let ambientNodes: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null;
let _enabled = true;

// Unlock AudioContext on first user interaction (browser policy)
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
  if (ambientNodes) {
    ambientNodes.gain.gain.setTargetAtTime(on ? 0.18 : 0, getCtx().currentTime, 0.3);
  }
}
export function isSoundEnabled() { return _enabled; }

// ── AMBIENT: Tense rising electronic drone ────────────────────────────────────
// Plays during the flying phase — a pulsing, building casino tension sound
export function startAmbient() {
  if (ambientNodes) return;
  if (!_enabled) return;
  const ac = getCtx();
  if (ac.state === 'suspended') { ac.resume().then(() => _startAmbient(ac)).catch(() => {}); return; }
  _startAmbient(ac);
}

function _startAmbient(ac: AudioContext) {
  const now = ac.currentTime;

  // Main drone oscillator — sawtooth for electronic feel
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(55, now); // A1 — deep bass

  // LFO for tremolo/pulse effect (fast pulse for tension)
  const lfo = ac.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 6; // 6Hz pulse

  const lfoGain = ac.createGain();
  lfoGain.gain.value = 0.07;

  // Lowpass filter to soften the sawtooth
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400, now);
  filter.frequency.linearRampToValueAtTime(900, now + 30); // slowly opens up — builds tension

  // Master gain with fade in
  const masterGain = ac.createGain();
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(0.18, now + 1.2);

  // Second harmony osc — fifth above (adds richness)
  const osc2 = ac.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(82.4, now); // E2 — perfect fifth

  const osc2Gain = ac.createGain();
  osc2Gain.gain.value = 0.4;

  lfo.connect(lfoGain);
  lfoGain.connect(masterGain.gain);
  osc.connect(filter);
  filter.connect(masterGain);
  osc2.connect(osc2Gain);
  osc2Gain.connect(masterGain);
  masterGain.connect(ac.destination);

  osc.start(now); osc2.start(now); lfo.start(now);

  ambientNodes = { osc, gain: masterGain, lfo };
}

export function stopAmbient() {
  if (!ambientNodes) return;
  const ac = getCtx();
  const now = ac.currentTime;
  ambientNodes.gain.gain.setTargetAtTime(0, now, 0.15);
  const nodes = ambientNodes;
  ambientNodes = null;
  setTimeout(() => {
    try { nodes.osc.stop(); nodes.lfo.stop(); nodes.gain.disconnect(); } catch {}
  }, 800);
}

// Update drone pitch as multiplier rises (tension builds)
export function updateAmbientMult(mult: number) {
  if (!ambientNodes || !_enabled) return;
  const ac = getCtx();
  // Subtly raise base frequency as mult increases (adds tension)
  const baseFreq = 55 * Math.pow(1.008, Math.max(0, mult - 1) * 10);
  ambientNodes.osc.frequency.setTargetAtTime(Math.min(baseFreq, 110), ac.currentTime, 0.5);
}

// ── BLAST: Heavy crash explosion ──────────────────────────────────────────────
export function playBlast() {
  if (!_enabled) return;
  const ac = getCtx();
  if (ac.state === 'suspended') { ac.resume().then(() => _doBlast(ac)).catch(() => {}); return; }
  _doBlast(ac);
}

function _doBlast(ac: AudioContext) {
  const now = ac.currentTime;

  // Layer 1: Deep sub boom
  const sub = ac.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(80, now);
  sub.frequency.exponentialRampToValueAtTime(20, now + 0.5);
  const subGain = ac.createGain();
  subGain.gain.setValueAtTime(1.4, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  sub.connect(subGain); subGain.connect(ac.destination);
  sub.start(now); sub.stop(now + 0.65);

  // Layer 2: Mid-range punch
  const mid = ac.createOscillator();
  mid.type = 'square';
  mid.frequency.setValueAtTime(200, now);
  mid.frequency.exponentialRampToValueAtTime(60, now + 0.15);
  const midGain = ac.createGain();
  midGain.gain.setValueAtTime(0.6, now);
  midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  mid.connect(midGain); midGain.connect(ac.destination);
  mid.start(now); mid.stop(now + 0.2);

  // Layer 3: Wide noise burst (explosion texture)
  const bufSz = Math.floor(ac.sampleRate * 0.5);
  const nb = ac.createBuffer(1, bufSz, ac.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < bufSz; i++) d[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource(); noise.buffer = nb;

  // Low-cut + high-cut for explosion texture
  const loCut = ac.createBiquadFilter(); loCut.type = 'highpass'; loCut.frequency.value = 80;
  const hiCut = ac.createBiquadFilter(); hiCut.type = 'lowpass'; hiCut.frequency.value = 3000;

  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.9, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  noise.connect(loCut); loCut.connect(hiCut); hiCut.connect(ng); ng.connect(ac.destination);
  noise.start(now); noise.stop(now + 0.5);

  // Layer 4: High snap (the "crack" of the crash)
  const snap = ac.createOscillator();
  snap.type = 'sine';
  snap.frequency.setValueAtTime(800, now);
  snap.frequency.exponentialRampToValueAtTime(150, now + 0.06);
  const snapGain = ac.createGain();
  snapGain.gain.setValueAtTime(0.8, now);
  snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
  snap.connect(snapGain); snapGain.connect(ac.destination);
  snap.start(now); snap.stop(now + 0.08);
}

// ── CASHOUT: Coin shower win sound ────────────────────────────────────────────
export function playCashout() {
  if (!_enabled) return;
  const ac = getCtx();
  if (ac.state === 'suspended') { ac.resume().then(() => _doCashout(ac)).catch(() => {}); return; }
  _doCashout(ac);
}

function _doCashout(ac: AudioContext) {
  const now = ac.currentTime;

  // ① Cute rising "wheee" glide — playful portamento
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

  // ② Happy ascending notes — C-E-G-C major arpeggio (classic win jingle)
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const t = now + 0.12 + i * 0.09;

    // Main note — sine for softness
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;

    // Slight detune copy for warmth
    const o2 = ac.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 1.005;

    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.38, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    const g2 = ac.createGain(); g2.gain.value = 0.4;

    o.connect(g); g.connect(ac.destination);
    o2.connect(g2); g2.connect(g);
    o.start(t); o.stop(t + 0.5);
    o2.start(t); o2.stop(t + 0.5);
  });

  // ③ Sparkle twinkling at the end — high-pitched fairy dust
  const sparkleFreqs = [2093, 2637, 3136, 2637, 3136, 2093, 3520];
  const sparkleStart = now + 0.12 + notes.length * 0.09 + 0.05;
  sparkleFreqs.forEach((freq, i) => {
    const t = sparkleStart + i * 0.045;
    const s = ac.createOscillator();
    s.type = 'sine';
    s.frequency.value = freq;
    const sg = ac.createGain();
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(0.15, t + 0.008);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    s.connect(sg); sg.connect(ac.destination);
    s.start(t); s.stop(t + 0.12);
  });

  // ④ Final soft "ding" chord — warm and satisfying conclusion
  const chordT = sparkleStart + sparkleFreqs.length * 0.045 + 0.02;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.22, chordT);
    g.gain.exponentialRampToValueAtTime(0.001, chordT + 1.0);
    o.connect(g); g.connect(ac.destination);
    o.start(chordT); o.stop(chordT + 1.1);
  });
}
