// Vehicles: parked cars, traffic that follows the road grid, police cruisers
// and the player's ride. Traffic cars pick a road, drive along it, stop at
// nothing, and swerve away from wrecks; the player can steal any of them.
import { TRAFFIC, WORLD } from './config.js';
import { clamp, distance, angleDiff } from './random.js';
import { hitsBuilding, randomRoadPoint } from './city.js';

let carId = 0;

export function makeCar(spec, x, y, angle, opts = {}) {
  carId += 1;
  return {
    id: carId,
    spec,
    x, y,
    angle,
    speed: 0,
    health: 100,
    driver: opts.driver || null, // 'player' | 'traffic' | 'police' | null (parked)
    owner: opts.owner || 'traffic',
    stolen: false,
    wrecked: false,
    color: opts.color || spec.color,
    // Traffic behaviour: which road axis it follows and which way.
    axis: opts.axis || 'x',
    dir: opts.dir || 1,
    roadLine: opts.roadLine ?? y,
    stuck: 0,
  };
}

/** Spawn the city's traffic + parked cars. */
export function spawnTraffic(random, city, content) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const spec = random.pick(content.CARS.filter((c) => c.id !== 'cruiser'));
    const p = randomRoadPoint(random, city);
    const axis = random.chance(0.5) ? 'x' : 'y';
    const dir = random.chance(0.5) ? 1 : -1;
    const angle = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const parked = random.chance(0.35);
    cars.push(makeCar(spec, p.x, p.y, angle, {
      driver: parked ? null : 'traffic',
      axis, dir,
      roadLine: axis === 'x' ? p.y : p.x,
    }));
  }
  return cars;
}

/** One traffic step: follow the road line, slow for cars ahead, respawn far away. */
export function updateTraffic(cars, dt, city, player, random) {
  for (const car of cars) {
    if (car.driver !== 'traffic' || car.wrecked) continue;
    const target = car.spec.topSpeed * 0.42;
    // Slow down when something is right ahead.
    let ahead = false;
    for (const other of cars) {
      if (other === car || other.wrecked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along > 0 && along < 90 && side < 26) { ahead = true; break; }
    }
    const pdx = player.x - car.x;
    const pdy = player.y - car.y;
    const pAlong = pdx * Math.cos(car.angle) + pdy * Math.sin(car.angle);
    const pSide = Math.abs(-pdx * Math.sin(car.angle) + pdy * Math.cos(car.angle));
    if (pAlong > 0 && pAlong < 80 && pSide < 26 && !player.inCar) ahead = true;
    car.speed += ((ahead ? 0 : target) - car.speed) * Math.min(1, dt * 1.6);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (hitsBuilding(city, nx, ny, 20)) {
      // Reached the end of the road: turn around and pick a new line.
      car.angle += Math.PI;
      car.dir *= -1;
      car.stuck = 0;
      continue;
    }
    car.x = nx;
    car.y = ny;
    // Wandered off the island: respawn on a fresh road near the player.
    if (car.x < 60 || car.y < 60 || car.x > WORLD.size - 60 || car.y > WORLD.size - 60) {
      const p = randomRoadPoint(random, city);
      car.x = p.x;
      car.y = p.y;
      car.speed = 0;
    }
    // Nudge back onto its road line so traffic stays in lane.
    const line = car.axis === 'x' ? car.y : car.x;
    const drift = car.roadLine - line;
    if (Math.abs(drift) > 2) {
      if (car.axis === 'x') car.y += clamp(drift, -30, 30) * dt;
      else car.x += clamp(drift, -30, 30) * dt;
    }
  }
  return cars;
}

/** Steal a car: the driver (if any) gets out and runs, the car is yours. */
export function stealCar(car, peds, random) {
  if (car.driver === 'traffic' && peds) {
    peds.push({
      x: car.x + 26, y: car.y + 26,
      angle: random.range(0, Math.PI * 2),
      speed: 0, state: 'flee', color: '#e5e7eb', fleeTime: 2.5,
    });
  }
  car.driver = null;
  car.stolen = true;
  return car;
}

/** Damage a car; returns true when it becomes a wreck. */
export function damageCar(car, amount) {
  if (car.wrecked) return true;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
    car.driver = null;
    return true;
  }
  return false;
}

export function carCount(cars) {
  return cars.filter((c) => !c.wrecked).length;
}

export function nearestCar(x, y, cars, maxDist = 120) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.wrecked) continue;
    const d = distance(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** Park a fresh car of a given spec at a road point (missions use this). */
export function spawnCarAt(random, content, specId, x, y, angle = 0) {
  const spec = content.CARS.find((c) => c.id === specId) || content.CARS[0];
  return makeCar(spec, x, y, angle, { driver: null, owner: 'mission' });
}
