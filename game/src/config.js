// All tuning numbers and colours in one place. The world is a fixed
// 2560x2560 island city; the renderer puts a camera window over it, so no
// rule below depends on the screen size.
export const WORLD = { size: 2560, road: 320, roadWidth: 96, block: 224 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Logical viewport the camera shows (the canvas is scaled to fit the window). */
export const VIEW = { width: 1440, height: 900 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 235,
  runSpeed: 300,
  health: 100,
  punchDamage: 12,
  punchRange: 34,
  punchArc: 1.1,
  punchCooldown: 0.38,
  pistolDamage: 34,
  pistolRange: 460,
  pistolCooldown: 0.26,
  startAmmo: 24,
  startCash: 250,
};

export const DEBT = 60000;

export const WANTED = {
  max: 5,
  decayDelay: 6,
  decayRate: 0.12,
  // stars -> number of chasing cruisers and foot cops
  cruisers: [0, 1, 2, 3, 4, 6],
  cops: [0, 1, 2, 3, 5, 8],
  bustRadius: 26,
  ramDamage: 9,
  arrestTime: 1.6,
};

export const TRAFFIC = { cars: 26, peds: 42, maxSpeed: 150 };

export const DAY = { length: 240, dusk: 0.72 };

export const PALETTE = {
  water: '#0d4d6e',
  waterDeep: '#093a55',
  sand: '#e8d29a',
  grass: '#2e6b3a',
  park: '#3f7d46',
  road: '#2b2f38',
  roadLine: '#d8c25a',
  sidewalk: '#4a4f5a',
  building: '#5a6274',
  buildingRoof: '#7d8698',
  neonPink: '#ff2e88',
  neonCyan: '#22d3ee',
  neonGold: '#f5b301',
  player: '#ff5a3c',
  playerDark: '#b32d16',
  cop: '#2f6df6',
  copCar: '#1d4ed8',
  text: '#f2f4f8',
  muted: '#9aa3b2',
  panel: 'rgba(12,16,24,0.82)',
  panelBorder: 'rgba(255,255,255,0.14)',
  cash: '#4ade80',
  danger: '#ef4444',
  gold: '#fbbf24',
};

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'verde-heat.save.v1';
export const BEST_KEY = 'verde-heat.best.v1';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_DISPLAY = '"Arial Black", "Segoe UI", system-ui, sans-serif';

/** Mission marker and objective colours, shared by the HUD and the renderer. */
export const MARKER = { mission: '#fbbf24', cash: '#4ade80', ammo: '#f59e0b', health: '#f87171', cop: '#60a5fa' };

/** How far ahead the minimap shows, in world units per minimap pixel. */
export const MINIMAP = { size: 172, scale: 2560 / 172 };
