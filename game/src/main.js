// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between seven screens:
// title, play, paused, jobs, busted, wasted and complete.
//
// ?seed=N fixes the city. ?shot=start|play|chase|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, VIEW, DEBT, PLAYER, WORLD } from './config.js';
import { createRandom, clamp, distance } from './random.js';
import { CONTENT } from './content.js';
import { buildCity, randomPointInDistrict } from './city.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_PUNCH, ACTION_SHOOT, ACTION_JOBS, ACTION_RADIO, ACTION_NIGHT, ACTION_MUTE } from './input.js';
import { createPlayer, updateOnFoot, updateDriving, hurtPlayer, healPlayer, canPunch, canShoot, nearestEnterableCar, enterCar, exitCar } from './player.js';
import { spawnTraffic, updateTraffic, stealCar, damageCar } from './vehicles.js';
import { createWanted, addHeat, updateWanted, spawnCruiser, spawnCop, updateCruiser, updateCop, wantedForce, anyPoliceNear } from './police.js';
import { spawnPeds, updatePeds, checkPedHits, revivePeds } from './peds.js';
import { createMissionState, currentMission, startMission, updateMission, debtLeft } from './missions.js';
import { createCombat, firePistol, punch, updateBullets, spawnPickups, collectPickups } from './combat.js';
import { createAudio, unlockAudio, setMuted, setStation, sfxShot, sfxPunch, sfxPickup, sfxCrash, sfxMission, sfxBusted, updateAmbient, updateMusic } from './audio.js';
import { saveGame, loadGame, applySave, readBest, saveBest } from './save.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_JOBS, SCREEN_BUSTED, SCREEN_WASTED, SCREEN_COMPLETE } from './render.js';
import { drawHUD, drawJobs } from './hud.js';
import { missionList } from './missions.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;
const AUTOSAVE_EVERY = 10;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
renderer.resize(VIEW.width, VIEW.height);

function makeState(seedValue) {
  const random = createRandom(seedValue);
  const city = buildCity(random, CONTENT);
  const start = randomPointInDistrict(random, city, CONTENT, 'marina');
  const player = createPlayer(start.x, start.y);
  const state = {
    seed: seedValue,
    random,
    city,
    content: CONTENT,
    player,
    cars: spawnTraffic(random, city, CONTENT),
    cruisers: [],
    cops: [],
    peds: spawnPeds(random, city),
    pickups: spawnPickups(random, city, CONTENT),
    combat: createCombat(),
    wanted: createWanted(),
    missions: createMissionState(CONTENT),
    audio: createAudio(),
    debt: DEBT,
    time: 0,
    timeOfDay: 0.33, // 08:00
    clock: '08:00',
    night: false,
    raining: false,
    rainTimer: 40,
    best: readBest(),
    saveLoaded: false,
    screen: SCREEN_TITLE,
    input: { axis: { x: 0, y: 0 }, sprint: false, punch: false, shoot: false },
    saveTimer: 0,
    missionDelay: 0,
    startPoint: start,
  };
  state.enterCar = (car) => {
    stealCar(car, state.peds, state.random);
    enterCar(state.player, car);
  };
  // stepWorld always runs against THIS state object, so a reset that swaps
  // the fields underneath keeps every closure pointing at the live state.
  state.step = (dt) => stepWorld(state, dt);
  state.reset = () => {
    const fresh = makeState(seedValue);
    for (const key of Object.keys(fresh)) {
      if (key === 'enterCar' || key === 'reset' || key === 'step') continue;
      state[key] = fresh[key];
    }
    state.time = 0;
    state.screen = SCREEN_TITLE;
  };
  return state;
}

function stepWorld(state, dt) {
  state.time += dt;
  state.timeOfDay = (state.timeOfDay + dt / 240) % 1;
  const hour = Math.floor(state.timeOfDay * 24);
  const minute = Math.floor((state.timeOfDay * 24 - hour) * 60);
  state.clock = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  state.night = state.timeOfDay > 0.78 || state.timeOfDay < 0.22;
  // Rain comes and goes on a seeded schedule.
  state.rainTimer -= dt;
  if (state.rainTimer <= 0) {
    state.raining = !state.raining;
    state.rainTimer = state.raining ? state.random.range(14, 26) : state.random.range(40, 90);
  }
  if (state.missions.messageTime > 0) state.missions.messageTime -= dt;

  const input = state.input;
  const player = state.player;

  // --- movement ---
  if (player.inCar) {
    if (input.punch) player.inCar.speed *= Math.max(0, 1 - 3.2 * dt); // Space = handbrake
    updateDriving(player, player.inCar, input.axis, dt, state.city);
    if (player.inCar.wrecked) {
      exitCar(player);
      state.missions.message = 'Your car is wrecked — find another ride.';
      state.missions.messageTime = 4;
    }
  } else {
    updateOnFoot(player, input.axis, dt, state.city, input.sprint);
  }
  input.punch = false;
  input.shoot = false;

  // --- combat ---
  if (state.punchQueued && !player.inCar && canPunch(player)) {
    if (punch(state.combat, player, state.cops, state.peds, state.cars)) {
      sfxPunch(state.audio);
      addHeat(state.wanted, 1, state.time);
    }
  }
  if (state.shootQueued && !player.inCar && canShoot(player)) {
    if (firePistol(state.combat, player, player.angle)) {
      sfxShot(state.audio);
      addHeat(state.wanted, 1, state.time);
    }
  }
  state.punchQueued = false;
  state.shootQueued = false;
  const bulletEvents = updateBullets(state.combat, dt, state.cops, state.cars, state.peds);
  for (const e of bulletEvents) {
    if (e.type === 'copDown' || e.type === 'pedDown') addHeat(state.wanted, 1, state.time);
    if (e.type === 'carWrecked') sfxCrash(state.audio);
  }
  const pickup = collectPickups(state.pickups, player);
  if (pickup) sfxPickup(state.audio, pickup.kind);

  // --- traffic, peds, police ---
  updateTraffic(state.cars, dt, state.city, player, state.random);
  updatePeds(state.peds, dt, state.city, player, state.combat.danger);
  revivePeds(state.peds, dt);
  const dropped = checkPedHits(state.peds, player);
  if (dropped > 0) {
    player.cash += dropped;
    addHeat(state.wanted, 1, state.time);
  }

  const visible = anyPoliceNear(state.cruisers, state.cops, player);
  updateWanted(state.wanted, dt, state.time, visible);
  const force = wantedForce(state.wanted.stars);
  while (state.cruisers.length < force.cruisers) {
    state.cruisers.push(spawnCruiser(state.random, state.city, state.content, player));
  }
  while (state.cops.length < force.cops) {
    state.cops.push(spawnCop(state.random, state.city, player));
  }
  // Heat faded: send the surplus home.
  if (state.cruisers.length > force.cruisers) state.cruisers.length = force.cruisers;
  if (state.cops.length > force.cops) state.cops.length = force.cops;
  for (const cruiser of state.cruisers) {
    if (updateCruiser(cruiser, player, dt, state.city) === 'ram') {
      if (player.inCar) {
        if (damageCar(player.inCar, 12)) sfxCrash(state.audio);
      } else if (hurtPlayer(player, 9)) {
        sfxCrash(state.audio);
      }
    }
  }
  for (const cop of state.cops) {
    if (cop.knocked > 0) { cop.knocked -= dt; continue; }
    if (updateCop(cop, player, dt) === 'arrest') {
      state.screen = SCREEN_BUSTED;
      sfxBusted(state.audio);
    }
  }

  // --- missions ---
  if (!state.missions.active && !state.missions.allDone) {
    state.missionDelay -= dt;
    if (state.missionDelay <= 0) {
      const mission = startMission(state.content, state.missions, state.random, state.city, state.time);
      if (mission && (mission.id === 'getaway' || mission.id === 'big-one')) {
        addHeat(state.wanted, mission.id === 'getaway' ? 3 : 4, state.time);
      }
    }
  }
  const missionEvent = updateMission(state.content, state.missions, player, state.time);
  if (missionEvent) {
    if (missionEvent.event === 'complete' || missionEvent.event === 'allDone') {
      sfxMission(state.audio);
      state.missionDelay = 2.5;
      if (missionEvent.event === 'allDone') {
        state.screen = SCREEN_COMPLETE;
        if (player.cash > state.best) {
          state.best = player.cash;
          saveBest(state.best);
        }
      }
    }
  }

  // --- health / death ---
  if (player.health <= 0 && state.screen === SCREEN_PLAY) {
    state.screen = SCREEN_WASTED;
    sfxBusted(state.audio);
  }

  // --- audio + autosave ---
  updateAmbient(state.audio, player.inCar ? player.inCar.speed : player.speed, state.wanted.stars);
  updateMusic(state.audio, dt, state.content.STATIONS);
  state.saveTimer += dt;
  if (state.saveTimer >= AUTOSAVE_EVERY) {
    state.saveTimer = 0;
    saveGame(state);
  }
}

const state = makeState(seed);
const saved = loadGame();
if (saved) {
  applySave(state, saved);
  state.saveLoaded = true;
}

function respawnAfterFail() {
  state.player.health = PLAYER.health;
  state.player.cash = Math.max(0, state.player.cash - 1000);
  state.wanted.stars = 0;
  state.wanted.heat = 0;
  state.cruisers = [];
  state.cops = [];
  if (state.player.inCar) exitCar(state.player);
  state.player.x = state.startPoint.x;
  state.player.y = state.startPoint.y;
  state.screen = SCREEN_PLAY;
  saveGame(state);
}

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    // Snap the camera onto the player: the shot paints only twice, so the
    // usual smooth follow would leave the player off-frame.
    renderer.camera.x = clamp(state.player.x - VIEW.width / 2, 0, WORLD.size - VIEW.width);
    renderer.camera.y = clamp(state.player.y - VIEW.height / 2, 0, WORLD.size - VIEW.height);
    renderer.draw(state, scene.screen, scene.best);
    if (scene.screen === SCREEN_PLAY) drawHUD(renderer.ctx, state, VIEW);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = state.best;
  let accumulator = 0;
  let last = performance.now();

  function setStatus(text) {
    status.textContent = text;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    state.input.axis = input.axis();
    state.input.sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    if (input.wasPressed(ACTION_PUNCH)) state.punchQueued = true;
    if (input.wasPressed(ACTION_SHOOT)) state.shootQueued = true;

    if (input.wasPressed(ACTION_MUTE)) {
      setMuted(state.audio, !state.audio.muted);
    }
    if (input.wasPressed(ACTION_RADIO)) {
      setStation(state.audio, state.audio.station + 1, state.content.STATIONS.length);
      unlockAudio(state.audio);
    }
    if (input.wasPressed(ACTION_NIGHT)) {
      state.timeOfDay = state.night ? 0.33 : 0.85;
    }

    if (screen === SCREEN_TITLE) {
      if (input.wasPressed(ACTION_CONFIRM) || input.anyMove()) {
        unlockAudio(state.audio);
        screen = SCREEN_PLAY;
        state.screen = SCREEN_PLAY;
        state.missionDelay = 0.5;
        setStatus('Playing Verde Heat');
      }
    } else if (screen === SCREEN_PLAY) {
      if (input.wasPressed(ACTION_PAUSE)) {
        screen = SCREEN_PAUSED;
        state.screen = SCREEN_PAUSED;
        saveGame(state);
      } else if (input.wasPressed(ACTION_JOBS)) {
        screen = SCREEN_JOBS;
        state.screen = SCREEN_JOBS;
      } else if (input.wasPressed(ACTION_ENTER_CAR)) {
        unlockAudio(state.audio);
        if (state.player.inCar) {
          exitCar(state.player);
        } else {
          const car = nearestEnterableCar(state.player, state.cars);
          if (car) {
            state.enterCar(car);
            if (car.stolen) addHeat(state.wanted, 1, state.time);
          }
        }
      }
      accumulator += elapsed;
      while (accumulator >= STEP) {
        state.step(STEP);
        accumulator -= STEP;
        if (state.screen !== SCREEN_PLAY) {
          screen = state.screen;
          break;
        }
      }
      if (state.player.cash > best) {
        best = state.player.cash;
        state.best = best;
        saveBest(best);
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.wasPressed(ACTION_PAUSE) || input.wasPressed(ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        state.screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_JOBS) {
      if (input.wasPressed(ACTION_JOBS) || input.wasPressed(ACTION_PAUSE) || input.wasPressed(ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        state.screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (input.wasPressed(ACTION_CONFIRM)) respawnAfterFail();
    } else if (screen === SCREEN_COMPLETE) {
      if (input.wasPressed(ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        state.screen = SCREEN_PLAY;
      }
      accumulator += elapsed;
      while (accumulator >= STEP) {
        state.step(STEP);
        accumulator -= STEP;
      }
    }

    renderer.draw(state, screen, best);
    if (screen === SCREEN_PLAY) drawHUD(renderer.ctx, state, VIEW);
    if (screen === SCREEN_JOBS) drawJobs(renderer.ctx, state, VIEW, missionList(state.content, state.missions));
    input.endFrame();
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
