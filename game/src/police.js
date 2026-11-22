// The wanted system: stars rise when Lena is seen committing crimes, police
// cruisers chase and ram, foot cops close in to arrest. Break line of sight,
// stay clean for a while, and the heat fades — or pay a bribe at the docks.
import { WANTED, WORLD } from './config.js';
import { clamp, distance, angleDiff } from './random.js';
import { randomRoadPoint } from './city.js';
import { makeCar } from './vehicles.js';

export function createWanted() {
  return { stars: 0, heat: 0, lastCrime: -999, quietTime: 0, busted: 0 };
}

export function addHeat(wanted, stars, now) {
  wanted.stars = clamp(wanted.stars + stars, 0, WANTED.max);
  wanted.heat = 1;
  wanted.lastCrime = now;
  wanted.quietTime = 0;
}

/** Heat decays only after the player has been quiet for a while. */
export function updateWanted(wanted, dt, now, playerVisible) {
  if (wanted.stars === 0) return;
  if (now - wanted.lastCrime > WANTED.decayDelay && !playerVisible) {
    wanted.quietTime += dt;
    wanted.heat = Math.max(0, wanted.heat - WANTED.decayRate * dt);
    if (wanted.heat <= 0) {
      wanted.stars = Math.max(0, wanted.stars - 1);
      wanted.heat = wanted.stars > 0 ? 1 : 0;
      wanted.quietTime = 0;
    }
  } else {
    wanted.quietTime = 0;
  }
}

export function spawnCruiser(random, city, content, player) {
  const spec = content.CARS.find((c) => c.id === 'cruiser');
  // Spawn on a road a little way from the player, so the chase is fair.
  let p = randomRoadPoint(random, city);
  let tries = 0;
  while (distance(p.x, p.y, player.x, player.y) < 420 && tries < 12) {
    p = randomRoadPoint(random, city);
    tries += 1;
  }
  const angle = Math.atan2(player.y - p.y, player.x - p.x);
  return makeCar(spec, p.x, p.y, angle, { driver: 'police', owner: 'police', color: spec.color });
}

export function spawnCop(random, city, player) {
  const angle = random.range(0, Math.PI * 2);
  const d = random.range(300, 460);
  return {
    x: clamp(player.x + Math.cos(angle) * d, 120, WORLD.size - 120),
    y: clamp(player.y + Math.sin(angle) * d, 120, WORLD.size - 120),
    angle,
    speed: 0,
    state: 'chase',
    color: '#1d4ed8',
    arrest: 0,
  };
}

/** Steer one cruiser at the player; returns 'ram' on a hard contact. */
export function updateCruiser(cruiser, player, dt, city) {
  const target = Math.atan2(player.y - cruiser.y, player.x - cruiser.x);
  cruiser.angle += clamp(angleDiff(cruiser.angle, target), -2.6 * dt, 2.6 * dt);
  const want = cruiser.spec.topSpeed * 0.62;
  cruiser.speed += (want - cruiser.speed) * Math.min(1, dt * 1.2);
  cruiser.x += Math.cos(cruiser.angle) * cruiser.speed * dt;
  cruiser.y += Math.sin(cruiser.angle) * cruiser.speed * dt;
  const d = distance(cruiser.x, cruiser.y, player.x, player.y);
  if (d < 46 && Math.abs(cruiser.speed) > 60) {
    // Ram: shove the player and slow the cruiser down.
    cruiser.speed *= 0.4;
    return 'ram';
  }
  return null;
}

/** A foot cop closes in; returns 'arrest' when it holds the player long enough. */
export function updateCop(cop, player, dt) {
  const d = distance(cop.x, cop.y, player.x, player.y);
  const target = Math.atan2(player.y - cop.y, player.x - cop.x);
  cop.angle = target;
  if (d > WANTED.bustRadius) {
    const speed = player.inCar ? 235 : 205;
    cop.x += Math.cos(target) * speed * dt;
    cop.y += Math.sin(target) * speed * dt;
    cop.arrest = 0;
  } else {
    cop.arrest += dt;
    if (cop.arrest >= WANTED.arrestTime) return 'arrest';
  }
  return null;
}

/** How many cruisers / cops the current wanted level calls for. */
export function wantedForce(stars) {
  return {
    cruisers: WANTED.cruisers[clamp(stars, 0, WANTED.max)],
    cops: WANTED.cops[clamp(stars, 0, WANTED.max)],
  };
}

/** A bribe clears the heat for a price; returns false when unaffordable. */
export function payBribe(player, wanted) {
  const cost = 500 * wanted.stars;
  if (wanted.stars === 0 || player.cash < cost) return false;
  player.cash -= cost;
  wanted.stars = 0;
  wanted.heat = 0;
  return true;
}

/** True when any police unit can currently see the player (line of sight is
 *  approximated by distance here: the city is flat and the streets are open). */
export function anyPoliceNear(cruisers, cops, player, range = 700) {
  for (const c of cruisers) if (distance(c.x, c.y, player.x, player.y) < range) return true;
  for (const c of cops) if (distance(c.x, c.y, player.x, player.y) < range) return true;
  return false;
}
