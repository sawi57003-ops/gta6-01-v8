// The player: Lena Cruz on foot and behind the wheel. On foot she walks,
// runs (Shift), punches and shoots; in a car the same keys steer, brake and
// accelerate, and the car itself becomes the weapon.
import { PLAYER, WORLD } from './config.js';
import { clamp, distance } from './random.js';
import { hitsBuilding, clampToLand } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    speed: 0,
    health: PLAYER.health,
    cash: PLAYER.startCash,
    ammo: PLAYER.startAmmo,
    inCar: null,
    punchCooldown: 0,
    shootCooldown: 0,
    hurtFlash: 0,
    arrest: 0,
    running: false,
  };
}

/** Move on foot; returns true when the player actually moved. */
export function updateOnFoot(player, axis, dt, city, sprint) {
  const speed = sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(axis.x, axis.y) || 1;
  const vx = (axis.x / len) * speed * (axis.x || axis.y ? 1 : 0);
  const vy = (axis.y / len) * speed * (axis.x || axis.y ? 1 : 0);
  if (axis.x || axis.y) player.angle = Math.atan2(vy, vx);
  const nx = player.x + vx * dt;
  const ny = player.y + vy * dt;
  // Slide along buildings: try x and y separately so corners don't stick.
  if (!hitsBuilding(city, nx, player.y, PLAYER.radius)) player.x = nx;
  if (!hitsBuilding(city, player.x, ny, PLAYER.radius)) player.y = ny;
  const clamped = clampToLand(player.x, player.y);
  player.x = clamped.x;
  player.y = clamped.y;
  player.speed = Math.hypot(vx, vy);
  player.running = sprint && (axis.x || axis.y);
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
  return player.speed > 1;
}

/** Drive the car the player is in. `axis.y` is throttle, `axis.x` is steering. */
export function updateDriving(player, car, axis, dt, city) {
  const spec = car.spec;
  const forward = axis.y;
  const steer = axis.x;
  // Steering only bites while the car is moving; reverse is slower.
  const steerPower = 2.1 * clamp(Math.abs(car.speed) / 60, 0.25, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steer * steerPower * dt * (forward !== 0 ? 1 : 0.35);
  const accel = forward > 0 ? spec.accel : forward < 0 ? -spec.accel * 0.55 : 0;
  car.speed += accel * dt;
  // Drag + rolling resistance; handbrake (Space) stops the car hard.
  car.speed -= car.speed * 0.55 * dt;
  if (Math.abs(car.speed) < 4 && forward === 0) car.speed = 0;
  car.speed = clamp(car.speed, -spec.topSpeed * 0.45, spec.topSpeed);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = hitsBuilding(city, nx, ny, 22);
  if (hit) {
    // Bounce off the wall and lose speed; a hard hit hurts the car, not Lena.
    car.speed *= -0.25;
    car.health -= Math.min(14, Math.abs(car.speed) * 0.05 + 3);
  } else {
    car.x = nx;
    car.y = ny;
  }
  const clamped = clampToLand(car.x, car.y);
  car.x = clamped.x;
  car.y = clamped.y;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = Math.abs(car.speed);
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
  return car;
}

export function hurtPlayer(player, amount) {
  if (player.hurtFlash > 0.4) return false;
  player.health = Math.max(0, player.health - amount);
  player.hurtFlash = 0.6;
  return true;
}

export function healPlayer(player, amount) {
  player.health = Math.min(PLAYER.health, player.health + amount);
}

export function canPunch(player) {
  return player.punchCooldown <= 0;
}

export function canShoot(player) {
  return player.shootCooldown <= 0 && player.ammo > 0;
}

/** The nearest car the player could get into, within reach. */
export function nearestEnterableCar(player, cars, maxDist = 64) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.wrecked) continue;
    const d = distance(player.x, player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(player, car) {
  player.inCar = car;
  car.driver = 'player';
  car.stolen = car.stolen || car.owner !== 'player';
}

export function exitCar(player) {
  const car = player.inCar;
  if (!car) return null;
  player.inCar = null;
  car.driver = null;
  car.speed = 0;
  // Step out to the side of the car.
  const side = Math.PI / 2;
  player.x = car.x + Math.cos(car.angle + side) * 30;
  player.y = car.y + Math.sin(car.angle + side) * 30;
  return car;
}

/** True when the player is driving fast enough for a ram to count as a hit. */
export function isRamming(player) {
  return player.inCar !== null && Math.abs(player.inCar.speed) > 180;
}
