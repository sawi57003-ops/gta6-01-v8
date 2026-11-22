// Pedestrians: the life of the street. They stroll the sidewalks, cross
// roads, scatter when a car barrels at them or a shot rings out, and a few of
// them drop cash when startled — Cayo Verde is not a gentle city.
import { TRAFFIC } from './config.js';
import { distance } from './random.js';
import { randomRoadPoint, hitsBuilding } from './city.js';

const SKINS = ['#f59e0b', '#a78bfa', '#34d399', '#f472b6', '#93c5fd', '#fdba74', '#c084fc', '#86efac'];

export function spawnPeds(random, city) {
  const peds = [];
  for (let i = 0; i < TRAFFIC.peds; i += 1) {
    const p = randomRoadPoint(random, city);
    peds.push({
      x: p.x + random.range(-30, 30),
      y: p.y + random.range(-30, 30),
      angle: random.range(0, Math.PI * 2),
      speed: 0,
      state: 'walk',
      color: random.pick(SKINS),
      walkSpeed: random.range(38, 62),
      wander: random.range(1, 5),
      fleeTime: 0,
    });
  }
  return peds;
}

export function updatePeds(peds, dt, city, player, danger) {
  for (const ped of peds) {
    if (ped.state === 'flee') {
      ped.fleeTime -= dt;
      if (ped.fleeTime <= 0) ped.state = 'walk';
    }
    // Flee from the player when they are driving fast or a shot was fired.
    const d = distance(ped.x, ped.y, player.x, player.y);
    const threat = danger > 0 || (player.inCar && Math.abs(player.inCar.speed) > 200);
    if (threat && d < 260) {
      ped.state = 'flee';
      ped.fleeTime = 1.6;
      ped.angle = Math.atan2(ped.y - player.y, ped.x - player.x);
    } else if (ped.state === 'walk') {
      ped.wander -= dt;
      if (ped.wander <= 0) {
        ped.wander = Math.random() * 4 + 1;
        ped.angle = Math.random() * Math.PI * 2;
      }
    }
    const speed = ped.state === 'flee' ? ped.walkSpeed * 3.1 : ped.walkSpeed;
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    if (!hitsBuilding(city, nx, ny, 8)) {
      ped.x = nx;
      ped.y = ny;
    } else {
      ped.angle += Math.PI / 2;
    }
    if (ped.x < 100) ped.x = 100;
    if (ped.y < 100) ped.y = 100;
    if (ped.x > 2460) ped.x = 2460;
    if (ped.y > 2460) ped.y = 2460;
  }
  return peds;
}

/** Peds hit by a speeding car: they fall and drop a little cash. Returns the cash dropped. */
export function checkPedHits(peds, player) {
  let cash = 0;
  if (!player.inCar || Math.abs(player.inCar.speed) < 170) return 0;
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    const d = distance(ped.x, ped.y, player.x, player.y);
    if (d < 30) {
      ped.state = 'down';
      ped.fleeTime = 6;
      cash += 40;
    }
  }
  return cash;
}

export function revivePeds(peds, dt) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.fleeTime -= dt;
      if (ped.fleeTime <= 0) {
        ped.state = 'walk';
        ped.wander = 1;
      }
    }
  }
}

/** Count peds currently on their feet, for the HUD's street-life line. */
export function pedsUp(peds) {
  let n = 0;
  for (const ped of peds) if (ped.state !== 'down') n += 1;
  return n;
}
