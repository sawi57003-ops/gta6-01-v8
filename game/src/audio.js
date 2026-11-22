// Synthesised sound: no audio files. A WebAudio engine hum, a two-tone
// police siren, gunshots, punches, pickups, and four radio stations that play
// different generative patterns — Latin pop, synthwave, talk radio and bass.
import { clamp } from './random.js';

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    station: 0,
    muted: false,
    musicTimer: 0,
    nextNote: 0,
    step: 0,
  };
  return audio;
}

function ensure(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return true;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.5;
    audio.master.connect(audio.ctx.destination);
    audio.musicGain = audio.ctx.createGain();
    audio.musicGain.gain.value = 0.16;
    audio.musicGain.connect(audio.master);
    audio.sfxGain = audio.ctx.createGain();
    audio.sfxGain.gain.value = 0.5;
    audio.sfxGain.connect(audio.master);
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 50;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'triangle';
    audio.sirenOsc.frequency.value = 700;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    return true;
  } catch {
    return false;
  }
}

export function unlockAudio(audio) {
  ensure(audio);
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
}

export function setStation(audio, index, count) {
  audio.station = ((index % count) + count) % count;
  audio.step = 0;
  audio.nextNote = 0;
}

function blip(audio, freq, dur, type, vol, when = 0) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime + when;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(audio.sfxGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function sfxShot(audio) {
  if (!ensure(audio)) return;
  blip(audio, 180, 0.12, 'square', 0.5);
  blip(audio, 90, 0.18, 'sawtooth', 0.35);
}

export function sfxPunch(audio) {
  if (!ensure(audio)) return;
  blip(audio, 120, 0.09, 'sine', 0.6);
}

export function sfxPickup(audio, kind) {
  if (!ensure(audio)) return;
  const base = kind === 'cash' ? 880 : kind === 'ammo' ? 620 : 520;
  blip(audio, base, 0.09, 'sine', 0.4);
  blip(audio, base * 1.5, 0.12, 'sine', 0.4, 0.08);
}

export function sfxCrash(audio) {
  if (!ensure(audio)) return;
  blip(audio, 70, 0.3, 'sawtooth', 0.6);
}

export function sfxMission(audio) {
  if (!ensure(audio)) return;
  [523, 659, 784, 1046].forEach((f, i) => blip(audio, f, 0.16, 'triangle', 0.4, i * 0.09));
}

export function sfxBusted(audio) {
  if (!ensure(audio)) return;
  [392, 330, 262, 196].forEach((f, i) => blip(audio, f, 0.22, 'triangle', 0.4, i * 0.14));
}

/** Continuous sounds: engine pitch follows speed, siren wails with the heat. */
export function updateAmbient(audio, speed, wantedStars) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  audio.engineGain.gain.setTargetAtTime(clamp(Math.abs(speed) / 700, 0, 0.09), t, 0.1);
  audio.engineOsc.frequency.setTargetAtTime(46 + Math.abs(speed) * 0.35, t, 0.1);
  if (wantedStars > 0) {
    audio.sirenGain.gain.setTargetAtTime(0.05, t, 0.2);
    const phase = (t % 1.1) < 0.55 ? 660 : 880;
    audio.sirenOsc.frequency.setTargetAtTime(phase, t, 0.05);
  } else {
    audio.sirenGain.gain.setTargetAtTime(0, t, 0.2);
  }
}

// Generative radio: each station is a scale + a rhythm; notes are scheduled
// a bar ahead so the music never stutters.
const STATION_PATTERNS = [
  { scale: [0, 3, 5, 7, 10], base: 220, bpm: 112, wave: 'triangle' }, // Radio Verde (Latin)
  { scale: [0, 2, 3, 7, 8, 10], base: 110, bpm: 96, wave: 'sawtooth' }, // Neon FM (synthwave)
  { scale: [0, 5, 7], base: 330, bpm: 80, wave: 'sine' }, // Cayo Talk (sparse, talky)
  { scale: [0, 3, 5, 6, 10], base: 55, bpm: 128, wave: 'square' }, // Bass Bay (hip-hop)
];

export function updateMusic(audio, dt, stations) {
  if (!ensure(audio)) return;
  // Station 2 is talk radio: mostly a soft bed under the presenter's murmur.
  const pattern = STATION_PATTERNS[audio.station % STATION_PATTERNS.length];
  const beat = 60 / pattern.bpm / 2;
  audio.nextNote -= dt;
  if (audio.nextNote > 0) return;
  audio.nextNote = beat;
  audio.step += 1;
  const degree = pattern.scale[audio.step % pattern.scale.length];
  const octave = audio.step % 8 === 0 ? 2 : 1;
  const freq = pattern.base * Math.pow(2, degree / 12) * octave;
  const t = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = pattern.wave;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.9);
  osc.connect(gain);
  gain.connect(audio.musicGain);
  osc.start(t);
  osc.stop(t + beat);
  // A bass note on the downbeat.
  if (audio.step % 4 === 0) {
    const bass = audio.ctx.createOscillator();
    const bg = audio.ctx.createGain();
    bass.type = 'sine';
    bass.frequency.value = pattern.base / 2;
    bg.gain.setValueAtTime(0.7, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + beat * 1.8);
    bass.connect(bg);
    bg.connect(audio.musicGain);
    bass.start(t);
    bass.stop(t + beat * 2);
  }
}
