// Procedural sound engine — piano/guitar style ambient
let ctx: AudioContext | null = null;
let ambientInterval: ReturnType<typeof setInterval> | null = null;
let ambientGain: GainNode | null = null;
let _enabled = true;
let _unlocked = false;

// Unlock AudioContext on first user interaction (browser policy)
if (typeof document !== 'undefined') {
  const unlock = () => {
    _unlocked = true;
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
  if (ambientGain) {
    ambientGain.gain.setTargetAtTime(on ? 0.28 : 0, getCtx().currentTime, 0.3);
  }
}
export function isSoundEnabled() { return _enabled; }

// Piano note using sine wave with quick attack, slow decay
function playPianoNote(ac: AudioContext, freq: number, gain: number, startTime: number, duration: number) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;

  // Add a tiny bit of harmonic (triangle) for piano-like tone
  const osc2 = ac.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = freq * 2;

  const env = ac.createGain();
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(gain, startTime + 0.01);         // fast attack
  env.gain.exponentialRampToValueAtTime(gain * 0.6, startTime + 0.08); // slight drop
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration); // long decay

  const env2 = ac.createGain(); env2.gain.value = 0.15;

  osc.connect(env); env.connect(ac.destination);
  osc2.connect(env2); env2.connect(env);
  osc.start(startTime); osc.stop(startTime + duration);
  osc2.start(startTime); osc2.stop(startTime + duration);
}

// Am – F – C – G chord progression (piano arpeggio)
// Frequencies in Hz: A3=220, C4=261.63, E4=329.63, F3=174.61, G3=196, G4=392
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

  // Arpeggio — stagger each note slightly (guitar strum feel)
  chord.forEach((freq, i) => {
    const delay = i * 0.06;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const harmonic = ac.createOscillator();
    harmonic.type = 'triangle';
    harmonic.frequency.value = freq * 2;

    const env = ac.createGain();
    env.gain.setValueAtTime(0, now + delay);
    env.gain.linearRampToValueAtTime(0.35, now + delay + 0.015);
    env.gain.exponentialRampToValueAtTime(0.12, now + delay + 0.3);
    env.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.6);

    const harmGain = ac.createGain(); harmGain.gain.value = 0.18;

    osc.connect(env); env.connect(master);
    harmonic.connect(harmGain); harmGain.connect(env);
    osc.start(now + delay); osc.stop(now + delay + 1.8);
    harmonic.start(now + delay); harmonic.stop(now + delay + 1.8);
  });

  // Bass note — one octave below root
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

  // Play first chord immediately, then repeat every 1.8s
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

// ── BLAST: Sharp impact ───────────────────────────────────────────────────────
export function playBlast() {
  if (!_enabled) return;
  const ac = getCtx();
  const doPlay = () => _doBlast(ac);
  if (ac.state === 'suspended') { ac.resume().then(doPlay).catch(() => {}); return; }
  doPlay();
}

function _doBlast(ac: AudioContext) {
  const now = ac.currentTime;

  // Low sub thud
  const sub = ac.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(90, now);
  sub.frequency.exponentialRampToValueAtTime(30, now + 0.3);
  const subGain = ac.createGain();
  subGain.gain.setValueAtTime(1.0, now);
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

  // White noise burst
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

// ── CASHOUT: Success chime (piano notes going up) ─────────────────────────────
export function playCashout() {
  if (!_enabled) return;
  const ac = getCtx();
  const doPlay = () => _doCashout(ac);
  if (ac.state === 'suspended') { ac.resume().then(doPlay).catch(() => {}); return; }
  doPlay();
}

function _doCashout(ac: AudioContext) {
  // Rising piano arpeggio — C E G C (major chord up)
  const notes = [261.63, 329.63, 392.00, 523.25];
  notes.forEach((freq, i) => {
    playPianoNote(ac, freq, 0.5, ac.currentTime + i * 0.1, 1.2 - i * 0.1);
  });
}
