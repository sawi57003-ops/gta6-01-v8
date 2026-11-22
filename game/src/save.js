// Save / load: cash, debt progress, missions done, best score and settings,
// kept in localStorage under one key so a refresh never loses Lena's week.
import { SAVE_KEY, BEST_KEY } from './config.js';

export function saveGame(state) {
  const data = {
    version: 1,
    cash: state.player.cash,
    health: state.player.health,
    ammo: state.player.ammo,
    missionsDone: state.missions.done,
    missionIndex: state.missions.index,
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    station: state.audio.station,
    night: state.night,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off; nothing to clear then.
  }
}

export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Private windows: the best score lasts this visit only.
  }
}

/** Apply a loaded save onto a fresh game state. */
export function applySave(state, data) {
  if (!data) return false;
  state.player.cash = data.cash ?? state.player.cash;
  state.player.health = data.health ?? state.player.health;
  state.player.ammo = data.ammo ?? state.player.ammo;
  state.missions.done = Array.isArray(data.missionsDone) ? data.missionsDone.slice() : [];
  state.missions.index = data.missionIndex ?? 0;
  // A save from a finished week restarts the story, not a completed one.
  if (state.missions.done.length >= 6) {
    state.missions.done = [];
    state.missions.index = 0;
  }
  if (typeof data.x === 'number' && typeof data.y === 'number') {
    state.player.x = data.x;
    state.player.y = data.y;
  }
  if (typeof data.station === 'number') state.audio.station = data.station;
  if (typeof data.night === 'boolean') state.night = data.night;
  return true;
}
