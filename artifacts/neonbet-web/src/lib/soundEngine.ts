// Web Audio API procedural sound engine
let ctx: AudioContext | null = null;
let ambientNodes: { osc1: OscillatorNode; osc2: OscillatorNode; osc3: OscillatorNode; gain: GainNode } | null = null;
let _enabled = true;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setSoundEnabled(on: boolean) {
  _enabled = on;
  if (ambientNodes) {
    ambientNodes.gain.gain.setTargetAtTime(on ? 0.45 : 0, getCtx().currentTime, 0.3);
  }
}
export function isSoundEnabled() { return _enabled; }

export function startAmbient() {
  if (ambientNodes) return;
  const ac = getCtx();
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(_enabled ? 0.45 : 0, ac.currentTime + 2);
  gain.connect(ac.destination);

  // Bass drone 55Hz
  const osc1 = ac.createOscillator();
  osc1.type = "sine"; osc1.frequency.value = 55;
  const g1 = ac.createGain(); g1.gain.value = 0.55; osc1.connect(g1); g1.connect(gain);

  // Mid 110Hz slowly modulated
  const osc2 = ac.createOscillator();
  osc2.type = "triangle"; osc2.frequency.value = 110;
  const lfo = ac.createOscillator(); lfo.frequency.value = 0.12; lfo.type = "sine";
  const lfoGain = ac.createGain(); lfoGain.gain.value = 3;
  lfo.connect(lfoGain); lfoGain.connect(osc2.frequency);
  const g2 = ac.createGain(); g2.gain.value = 0.30; osc2.connect(g2); g2.connect(gain);
  lfo.start();

  // High shimmer 220Hz very low
  const osc3 = ac.createOscillator();
  osc3.type = "sine"; osc3.frequency.value = 220;
  const lfo2 = ac.createOscillator(); lfo2.frequency.value = 0.07; lfo2.type = "sine";
  const lfoGain2 = ac.createGain(); lfoGain2.gain.value = 5;
  lfo2.connect(lfoGain2); lfoGain2.connect(osc3.frequency);
  const g3 = ac.createGain(); g3.gain.value = 0.12; osc3.connect(g3); g3.connect(gain);
  lfo2.start();

  osc1.start(); osc2.start(); osc3.start();
  ambientNodes = { osc1, osc2, osc3, gain };
}

export function stopAmbient() {
  if (!ambientNodes) return;
  const ac = getCtx();
  ambientNodes.gain.gain.setTargetAtTime(0, ac.currentTime, 0.5);
  setTimeout(() => {
    try { ambientNodes?.osc1.stop(); ambientNodes?.osc2.stop(); ambientNodes?.osc3.stop(); } catch {}
    ambientNodes = null;
  }, 1500);
}

export function playBlast() {
  if (!_enabled) return;
  const ac = getCtx();
  const now = ac.currentTime;

  // White noise burst
  const bufSz = ac.sampleRate * 2;
  const noiseBuffer = ac.createBuffer(1, bufSz, ac.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufSz; i++) data[i] = Math.random() * 2 - 1;

  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ac.createBiquadFilter();
  noiseFilter.type = "lowpass"; noiseFilter.frequency.setValueAtTime(1200, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(80, now + 1.2);
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.6, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
  noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(ac.destination);
  noise.start(now); noise.stop(now + 2);

  // Sub thud
  const sub = ac.createOscillator();
  sub.type = "sine"; sub.frequency.setValueAtTime(160, now);
  sub.frequency.exponentialRampToValueAtTime(40, now + 0.4);
  const subGain = ac.createGain();
  subGain.gain.setValueAtTime(0.8, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  sub.connect(subGain); subGain.connect(ac.destination);
  sub.start(now); sub.stop(now + 0.6);

  // Crack
  const crack = ac.createOscillator();
  crack.type = "sawtooth"; crack.frequency.setValueAtTime(400, now);
  crack.frequency.exponentialRampToValueAtTime(50, now + 0.15);
  const crackGain = ac.createGain();
  crackGain.gain.setValueAtTime(0.5, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  crack.connect(crackGain); crackGain.connect(ac.destination);
  crack.start(now); crack.stop(now + 0.25);
}

export function playCashout() {
  if (!_enabled) return;
  const ac = getCtx();
  const now = ac.currentTime;
  [0, 0.12, 0.22].forEach((delay, i) => {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = [660, 880, 1320][i];
    const g = ac.createGain();
    g.gain.setValueAtTime(0, now + delay);
    g.gain.linearRampToValueAtTime(0.4, now + delay + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.6);
    osc.connect(g); g.connect(ac.destination);
    osc.start(now + delay); osc.stop(now + delay + 0.7);
  });
}
