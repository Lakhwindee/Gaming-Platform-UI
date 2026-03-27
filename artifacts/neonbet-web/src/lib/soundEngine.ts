// Procedural sound engine — heavy industrial / foghorn style
let ctx: AudioContext | null = null;
let ambientNodes: OscillatorNode[] | null = null;
let ambientGain: GainNode | null = null;
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
  if (ambientGain) {
    ambientGain.gain.setTargetAtTime(on ? 0.4 : 0, getCtx().currentTime, 0.3);
  }
}
export function isSoundEnabled() { return _enabled; }

// ── AMBIENT: Heavy deep engine drone ─────────────────────────────────────────
export function startAmbient() {
  if (ambientNodes) return;
  if (!_enabled) return;
  const ac = getCtx();
  const now = ac.currentTime;

  const master = ac.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.4, now + 2.0);
  master.connect(ac.destination);
  ambientGain = master;

  const oscs: OscillatorNode[] = [];

  // Very deep sub rumble — 45Hz
  const sub = ac.createOscillator();
  sub.type = 'sawtooth';
  sub.frequency.value = 45;
  const subFilter = ac.createBiquadFilter();
  subFilter.type = 'lowpass';
  subFilter.frequency.value = 120;
  subFilter.Q.value = 2;
  const subGain = ac.createGain(); subGain.gain.value = 0.6;
  sub.connect(subFilter); subFilter.connect(subGain); subGain.connect(master);
  sub.start(); oscs.push(sub);

  // Slow wobble LFO on sub (0.05Hz — very slow)
  const lfo = ac.createOscillator(); lfo.frequency.value = 0.05; lfo.type = 'sine';
  const lfoG = ac.createGain(); lfoG.gain.value = 3;
  lfo.connect(lfoG); lfoG.connect(sub.frequency); lfo.start(); oscs.push(lfo);

  // Mid drone 90Hz — slightly detuned for thickness
  const mid = ac.createOscillator();
  mid.type = 'sawtooth';
  mid.frequency.value = 90.7;
  const midFilter = ac.createBiquadFilter();
  midFilter.type = 'lowpass'; midFilter.frequency.value = 200;
  const midGain = ac.createGain(); midGain.gain.value = 0.25;
  mid.connect(midFilter); midFilter.connect(midGain); midGain.connect(master);
  mid.start(); oscs.push(mid);

  // Heavy rumble noise layer
  const bufSz = Math.floor(ac.sampleRate * 2);
  const noiseBuffer = ac.createBuffer(1, bufSz, ac.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufSz; i++) data[i] = Math.random() * 2 - 1;
  const noiseSrc = ac.createBufferSource();
  noiseSrc.buffer = noiseBuffer; noiseSrc.loop = true;
  const noiseFilter = ac.createBiquadFilter();
  noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 80;
  const noiseGain = ac.createGain(); noiseGain.gain.value = 0.12;
  noiseSrc.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(master);
  noiseSrc.start();

  ambientNodes = oscs;
}

export function stopAmbient() {
  if (!ambientNodes || !ambientGain) return;
  const ac = getCtx();
  ambientGain.gain.setTargetAtTime(0, ac.currentTime, 0.4);
  const nodes = ambientNodes;
  const g = ambientGain;
  ambientNodes = null;
  ambientGain = null;
  setTimeout(() => {
    nodes.forEach(n => { try { n.stop(); } catch {} });
    g.disconnect();
  }, 2000);
}

// ── BLAST: Heavy foghorn BOOM ─────────────────────────────────────────────────
export function playBlast() {
  if (!_enabled) return;
  const ac = getCtx();
  const doPlay = () => _doBlast(ac);
  if (ac.state === 'suspended') { ac.resume().then(doPlay).catch(() => {}); return; }
  doPlay();
}

function _doBlast(ac: AudioContext) {
  const now = ac.currentTime;

  // ── Layer 1: Sub-bass punch — deep 55→20Hz sweep (the THUD) ──────────────
  const thud = ac.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(65, now);
  thud.frequency.exponentialRampToValueAtTime(22, now + 0.35);
  const thudGain = ac.createGain();
  thudGain.gain.setValueAtTime(1.4, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  thud.connect(thudGain); thudGain.connect(ac.destination);
  thud.start(now); thud.stop(now + 0.55);

  // ── Layer 2: Foghorn tone — 110Hz held for 0.4s then decay ───────────────
  const foghorn = ac.createOscillator();
  foghorn.type = 'sawtooth';
  foghorn.frequency.value = 110;
  const fogFilter = ac.createBiquadFilter();
  fogFilter.type = 'lowpass'; fogFilter.frequency.value = 300;
  const fogGain = ac.createGain();
  fogGain.gain.setValueAtTime(0, now);
  fogGain.gain.linearRampToValueAtTime(0.9, now + 0.03);
  fogGain.gain.setValueAtTime(0.9, now + 0.28);
  fogGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
  foghorn.connect(fogFilter); fogFilter.connect(fogGain); fogGain.connect(ac.destination);
  foghorn.start(now); foghorn.stop(now + 0.8);

  // ── Layer 3: Detuned foghorn second harmonic for body ────────────────────
  const foghorn2 = ac.createOscillator();
  foghorn2.type = 'sawtooth';
  foghorn2.frequency.value = 112.5;
  const fogFilter2 = ac.createBiquadFilter();
  fogFilter2.type = 'lowpass'; fogFilter2.frequency.value = 280;
  const fogGain2 = ac.createGain();
  fogGain2.gain.setValueAtTime(0, now);
  fogGain2.gain.linearRampToValueAtTime(0.55, now + 0.04);
  fogGain2.gain.setValueAtTime(0.55, now + 0.25);
  fogGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
  foghorn2.connect(fogFilter2); fogFilter2.connect(fogGain2); fogGain2.connect(ac.destination);
  foghorn2.start(now); foghorn2.stop(now + 0.75);

  // ── Layer 4: Heavy noise burst (explosion air) ────────────────────────────
  const bufSz = Math.floor(ac.sampleRate * 0.8);
  const nb = ac.createBuffer(1, bufSz, ac.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < bufSz; i++) d[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource(); noise.buffer = nb;
  const nf = ac.createBiquadFilter(); nf.type = 'bandpass';
  nf.frequency.setValueAtTime(180, now); nf.Q.value = 0.8;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.6, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  noise.connect(nf); nf.connect(ng); ng.connect(ac.destination);
  noise.start(now); noise.stop(now + 0.6);
}

// ── CASHOUT: Heavy satisfying CHING ──────────────────────────────────────────
export function playCashout() {
  if (!_enabled) return;
  const ac = getCtx();
  const doPlay = () => _doCashout(ac);
  if (ac.state === 'suspended') { ac.resume().then(doPlay).catch(() => {}); return; }
  doPlay();
}

function _doCashout(ac: AudioContext) {
  const now = ac.currentTime;

  // Heavy metallic CHING — 3 stacked metallic partials
  const freqs = [420, 840, 1260];
  freqs.forEach((freq, i) => {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const dist = ac.createWaveShaper();
    const curve = new Float32Array(256);
    for (let j = 0; j < 256; j++) {
      const x = (j * 2) / 256 - 1;
      curve[j] = x * (Math.abs(x) + 0.6) / (x * x * 0.3 + 1);
    }
    dist.curve = curve;
    const g = ac.createGain();
    const delay = i * 0.06;
    g.gain.setValueAtTime(0, now + delay);
    g.gain.linearRampToValueAtTime(0.55 - i * 0.12, now + delay + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.9 - i * 0.1);
    osc.connect(dist); dist.connect(g); g.connect(ac.destination);
    osc.start(now + delay); osc.stop(now + delay + 1.0);
  });

  // Low thud underneath for weight
  const bass = ac.createOscillator();
  bass.type = 'sine'; bass.frequency.value = 80;
  const bassGain = ac.createGain();
  bassGain.gain.setValueAtTime(0.7, now);
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  bass.connect(bassGain); bassGain.connect(ac.destination);
  bass.start(now); bass.stop(now + 0.2);
}
