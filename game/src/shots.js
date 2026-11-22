// Screenshot scenes behind ?shot=start|play|chase|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (drive toward the mission marker, dodge buildings,
// shoot nothing), so the frame is what a short game really looks like and
// the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_COMPLETE } from './render.js';
import { startMission } from './missions.js';
import { addHeat } from './police.js';
import { randomPointInDistrict } from './city.js';

const SAMPLE = 1 / 30;

/** Steer toward the mission marker, or wander the roads when there is none.
 *  If the car is stuck against a building, reverse out and try a new angle. */
function autopilot(state) {
  const target = state.missions.target || { x: 1280, y: 1280 };
  if (!state._auto) state._auto = { x: state.player.x, y: state.player.y, t: 0, reverse: 0 };
  const auto = state._auto;
  auto.t += SAMPLE;
  if (auto.t >= 0.5) {
    const moved = Math.hypot(state.player.x - auto.x, state.player.y - auto.y);
    if (moved < 12 && state.player.inCar) auto.reverse = 0.9;
    auto.x = state.player.x;
    auto.y = state.player.y;
    auto.t = 0;
  }
  if (auto.reverse > 0) {
    auto.reverse -= SAMPLE;
    return { x: 1, y: -1 };
  }
  const dx = target.x - state.player.x;
  const dy = target.y - state.player.y;
  const want = Math.atan2(dy, dx);
  const car = state.player.inCar;
  const heading = car ? car.angle : state.player.angle;
  let diff = want - heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    x: diff > 0.25 ? 1 : diff < -0.25 ? -1 : 0,
    y: 1,
  };
}

/** Run the world forward `seconds` with the autopilot driving. */
function drive(state, seconds, hooks) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    state.input.axis = autopilot(state);
    if (hooks) hooks(state, i);
    state.step(STEP);
  }
}

/**
 * Set the game to the named scene and return the screen to draw over it and
 * the best cash to show.
 */
export function stageShot(name, state) {
  state.reset();
  if (name === 'start') {
    drive(state, 4, null);
    return { screen: SCREEN_TITLE, best: state.best };
  }
  if (name === 'play') {
    startMission(state.content, state.missions, state.random, state.city, 0);
    // Get into the nearest car first, then drive to the marker.
    const car = state.cars[0];
    if (car) {
      state.player.x = car.x;
      state.player.y = car.y;
      state.enterCar(car);
    }
    drive(state, 22, null);
    return { screen: SCREEN_PLAY, best: state.best };
  }
  if (name === 'chase') {
    startMission(state.content, state.missions, state.random, state.city, 0);
    const car = state.cars[1] || state.cars[0];
    // Stage the chase downtown, mid-city, so the frame catches the player
    // centred with cruisers on their tail — not pinned to the map edge.
    const spot = randomPointInDistrict(state.random, state.city, state.content, 'downtown');
    if (car) {
      car.x = spot.x;
      car.y = spot.y;
      car.angle = -Math.PI / 2;
      state.player.x = car.x;
      state.player.y = car.y;
      state.enterCar(car);
    }
    addHeat(state.wanted, 3, 0);
    // Point the getaway west, across the whole city, so the frame catches the
    // chase mid-flight instead of pinned against the beach.
    const farTarget = randomPointInDistrict(state.random, state.city, state.content, 'docks');
    state.missions.target = farTarget;
    state.missions.targets[0] = farTarget;
    drive(state, 9, (s) => {
      // Staging only: keep Lena alive and rolling so the frame stays a chase,
      // not a wreck — the real game has no such safety net.
      s.player.health = 100;
      if (!s.player.inCar) {
        const fresh = s.cars.find((c) => !c.wrecked && c.driver !== 'player');
        if (fresh) {
          s.player.x = fresh.x;
          s.player.y = fresh.y;
          s.enterCar(fresh);
        }
      } else if (s.player.inCar.health < 40) {
        s.player.inCar.health = 100;
      }
      if (s.time > 6 && s.wanted.stars < 3) addHeat(s.wanted, 1, s.time);
    });
    return { screen: SCREEN_PLAY, best: state.best };
  }
  // end: finish the week fast — pay off every mission, then show the complete screen.
  for (const mission of state.content.MISSIONS) {
    state.missions.done.push(mission.id);
    state.player.cash += mission.pay;
  }
  state.missions.allDone = true;
  state.missions.index = state.content.MISSIONS.length;
  drive(state, 6, null);
  return { screen: SCREEN_COMPLETE, best: state.player.cash };
}
