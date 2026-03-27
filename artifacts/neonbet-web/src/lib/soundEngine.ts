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
  gain.gain.linearRampToValueAtTime(_enabled ? 0.35 : 0, ac.currentTime + 1.5);
  gain.connect(ac.destination);

  // Low sub pulse (60Hz)
  const osc1 = ac.createOscillator();
  osc1.type = "sine"; osc1.frequency.value = 60;
  const lfo1 = ac.createOscillator(); lfo1.frequency.value = 0.08;
  const lfo1Gain = ac.createGain(); lfo1Gain.gain.value = 8;
  lfo1.connect(lfo1Gain); lfo1Gain.connect(osc1.frequency);
  const g1 = ac.createGain(); g1.gain.value = 0.4; osc1.connect(g1); g1.connect(gain);
  lfo1.start();

  // Mid-low pulse (90Hz) - synth-like
  const osc2 = ac.createOscillator();
  osc2.type = "sine"; osc2.frequency.value = 90;
  const lfo2 = ac.createOscillator(); lfo2.frequency.value = 0.15;
  const lfo2Gain = ac.createGain(); lfo2Gain.gain.value = 12;
  lfo2.connect(lfo2Gain); lfo2Gain.connect(osc2.frequency);
  const g2 = ac.createGain(); g2.gain.value = 0.25; osc2.connect(g2); g2.connect(gain);
  lfo2.start();

  // Shimmer high (150Hz + 300Hz harmonics)
  const osc3 = ac.createOscillator();
  osc3.type = "sine"; osc3.frequency.value = 150;
  const g3 = ac.createGain(); g3.gain.value = 0.15; osc3.connect(g3); g3.connect(gain);

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

  // Quick whoosh (high-pass filtered noise)
  const bufSz = ac.sampleRate * 0.8;
  const noiseBuffer = ac.createBuffer(1, bufSz, ac.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufSz; i++) data[i] = Math.random() * 2 - 1;

  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ac.createBiquadFilter();
  noiseFilter.type = "highpass"; noiseFilter.frequency.setValueAtTime(2200, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.7, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(ac.destination);
  noise.start(now); noise.stop(now + 0.5);

  // Punchy sub boom (drop from 200Hz to 40Hz)
  const sub = ac.createOscillator();
  sub.type = "sine"; sub.frequency.setValueAtTime(200, now);
  sub.frequency.exponentialRampToValueAtTime(40, now + 0.25);
  const subGain = ac.createGain();
  subGain.gain.setValueAtTime(0.9, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  sub.connect(subGain); subGain.connect(ac.destination);
  sub.start(now); sub.stop(now + 0.4);

  // Quick mid-range snap (500Hz drop)
  const snap = ac.createOscillator();
  snap.type = "sine"; snap.frequency.setValueAtTime(500, now);
  snap.frequency.exponentialRampToValueAtTime(120, now + 0.12);
  const snapGain = ac.createGain();
  snapGain.gain.setValueAtTime(0.5, now);
  snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  snap.connect(snapGain); snapGain.connect(ac.destination);
  snap.start(now); snap.stop(now + 0.2);
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
