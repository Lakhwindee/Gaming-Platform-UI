import { Audio } from "expo-av";

let ambientSound: Audio.Sound | null = null;
let blastSound: Audio.Sound | null = null;
let cashoutSound: Audio.Sound | null = null;
let _enabled = true;
let _loaded = false;

export function setSoundEnabled(on: boolean) {
  _enabled = on;
  if (!on) {
    ambientSound?.setVolumeAsync(0);
  } else {
    ambientSound?.setVolumeAsync(0.55);
  }
}

export function isSoundEnabled() { return _enabled; }

export async function loadSounds() {
  if (_loaded) return;
  _loaded = true;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
    const [a, b, c] = await Promise.all([
      Audio.Sound.createAsync(require("../assets/sounds/ambient.wav"), {
        isLooping: true, volume: 0.55, shouldPlay: false,
      }),
      Audio.Sound.createAsync(require("../assets/sounds/blast.wav"), {
        isLooping: false, volume: 0.9, shouldPlay: false,
      }),
      Audio.Sound.createAsync(require("../assets/sounds/cashout.wav"), {
        isLooping: false, volume: 0.85, shouldPlay: false,
      }),
    ]);
    ambientSound  = a.sound;
    blastSound    = b.sound;
    cashoutSound  = c.sound;
  } catch (e) {
    console.warn("Sound load failed:", e);
  }
}

export async function startAmbient() {
  if (!_enabled || !ambientSound) return;
  try {
    const status = await ambientSound.getStatusAsync();
    if (status.isLoaded && !status.isPlaying) {
      await ambientSound.setVolumeAsync(0.55);
      await ambientSound.playAsync();
    }
  } catch {}
}

export async function stopAmbient() {
  try { await ambientSound?.stopAsync(); } catch {}
}

export async function playBlast() {
  if (!blastSound) return;
  try {
    await blastSound.setPositionAsync(0);
    await blastSound.setVolumeAsync(_enabled ? 0.9 : 0);
    await blastSound.playAsync();
  } catch {}
}

export async function playCashout() {
  if (!cashoutSound) return;
  try {
    await cashoutSound.setPositionAsync(0);
    await cashoutSound.setVolumeAsync(_enabled ? 0.85 : 0);
    await cashoutSound.playAsync();
  } catch {}
}
