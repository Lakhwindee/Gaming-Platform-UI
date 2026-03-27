// Web Audio API procedural sound engine
let ctx: AudioContext | null = null;
let ambientNodes: { osc1: OscillatorNode; osc2: OscillatorNode; osc3: OscillatorNode; gain: GainNode } | null = null;
let _enabled = true;
let _unlocked = false;

// Unlock AudioContext on first user interaction (browser policy)
function setupUnlock() {
  if (typeof document === 'undefined') return;
  const unlock = () => {
    _unlocked = true;
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  };
  document.addEventListener('click', unlock, { once: true, passive: true });
  document.addEventListener('touchstart', unlock, { once: true, passive: true });
  document.addEventListener('keydown', unlock, { once: true, passive: true });
}
setupUnlock();

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setSoundEnabled(on: boolean) {
  _enabled = on;
  if (ambientNodes) {
    ambientNodes.gain.gain.setTargetAtTime(on ? 0.35 : 0, getCtx().currentTime, 0.3);
  }
}
export function isSoundEnabled() { return _enabled; }

export function startAmbient() {
  if (ambientNodes) return;
  if (!_enabled) return;
  const ac = getCtx();
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0.35, ac.currentTime + 1.5);
  gain.connect(ac.destination);

  // Low sub pulse 60Hz
  const osc1 = ac.createOscillator();
  osc1.type = 'sine'; osc1.frequency.value = 60;
  const lfo1 = ac.createOscillator(); lfo1.frequency.value = 0.08; lfo1.type = 'sine';
  const lfo1Gain = ac.createGain(); lfo1Gain.gain.value = 8;
  lfo1.connect(lfo1Gain); lfo1Gain.connect(osc1.frequency);
  const g1 = ac.createGain(); g1.gain.value = 0.4; osc1.connect(g1); g1.connect(gain);
  lfo1.start();

  // Mid synth pulse 90Hz
  const osc2 = ac.createOscillator();
  osc2.type = 'sine'; osc2.frequency.value = 90;
  const lfo2 = ac.createOscillator(); lfo2.frequency.value = 0.15; lfo2.type = 'sine';
  const lfo2Gain = ac.createGain(); lfo2Gain.gain.value = 12;
  lfo2.connect(lfo2Gain); lfo2Gain.connect(osc2.frequency);
  const g2 = ac.createGain(); g2.gain.value = 0.25; osc2.connect(g2); g2.connect(gain);
  lfo2.start();

  // High shimmer 150Hz
  const osc3 = ac.createOscillator();
  osc3.type = 'sine'; osc3.frequency.value = 150;
  const g3 = ac.createGain(); g3.gain.value = 0.15; osc3.connect(g3); g3.connect(gain);

  osc1.start(); osc2.start(); osc3.start();
  ambientNodes = { osc1, osc2, osc3, gain };
}

export function stopAmbient() {
  if (!ambientNodes) return;
  const ac = getCtx();
  ambientNodes.gain.gain.setTargetAtTime(0, ac.currentTime, 0.5);
  const nodes = ambientNodes;
  ambientNodes = null;
  setTimeout(() => {
    try { nodes.osc1.stop(); nodes.osc2.stop(); nodes.osc3.stop(); } catch {}
  }, 1500);
}

export function playBlast() {
  if (!_enabled) return;
  const ac = getCtx();
  if (ac.state === 'suspended') {
    ac.resume().then(() => _doBlast(ac)).catch(() => {});
    return;
  }
  _doBlast(ac);
}

function _doBlast(ac: AudioContext) {
  const now = ac.currentTime;

  // Whoosh noise burst
  const bufSz = ac.sampleRate * 0.6;
  const noiseBuffer = ac.createBuffer(1, bufSz, ac.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufSz; i++) data[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ac.createBiquadFilter();
  noiseFilter.type = 'highpass'; noiseFilter.frequency.setValueAtTime(2500, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(800, now + 0.2);
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.8, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(ac.destination);
  noise.start(now); noise.stop(now + 0.5);

  // Sub boom 200→40Hz
  const sub = ac.createOscillator();
  sub.type = 'sine'; sub.frequency.setValueAtTime(220, now);
  sub.frequency.exponentialRampToValueAtTime(38, now + 0.28);
  const subGain = ac.createGain();
  subGain.gain.setValueAtTime(1.0, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  sub.connect(subGain); subGain.connect(ac.destination);
  sub.start(now); sub.stop(now + 0.45);

  // Sharp crack 500→100Hz
  const snap = ac.createOscillator();
  snap.type = 'sine'; snap.frequency.setValueAtTime(550, now);
  snap.frequency.exponentialRampToValueAtTime(100, now + 0.1);
  const snapGain = ac.createGain();
  snapGain.gain.setValueAtTime(0.6, now);
  snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  snap.connect(snapGain); snapGain.connect(ac.destination);
  snap.start(now); snap.stop(now + 0.15);
}

export function playCashout() {
  if (!_enabled) return;
  const ac = getCtx();
  if (ac.state === 'suspended') {
    ac.resume().then(() => _doCashout(ac)).catch(() => {});
    return;
  }
  _doCashout(ac);
}

function _doCashout(ac: AudioContext) {
  const now = ac.currentTime;
  [0, 0.12, 0.24].forEach((delay, i) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = [660, 880, 1320][i];
    const g = ac.createGain();
    g.gain.setValueAtTime(0, now + delay);
    g.gain.linearRampToValueAtTime(0.45, now + delay + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.55);
    osc.connect(g); g.connect(ac.destination);
    osc.start(now + delay); osc.stop(now + delay + 0.65);
  });
}
