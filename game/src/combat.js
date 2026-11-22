// Combat: fists, pistol, bullets, and the pickups scattered through the
// city. Shooting is loud — every shot is a crime the police can hear.
import { PLAYER } from './config.js';
import { distance, angleDiff } from './random.js';
import { randomRoadPoint } from './city.js';

export function createCombat() {
  return { bullets: [], flashes: [], danger: 0 };
}

/** Fire the pistol toward an angle; returns false when there is no ammo. */
export function firePistol(combat, player, angle) {
  if (player.ammo <= 0) return false;
  player.ammo -= 1;
  player.shootCooldown = PLAYER.pistolCooldown;
  combat.bullets.push({
    x: player.x + Math.cos(angle) * 20,
    y: player.y + Math.sin(angle) * 20,
    angle,
    speed: 900,
    life: PLAYER.pistolRange / 900,
    damage: PLAYER.pistolDamage,
    fromPlayer: true,
  });
  combat.flashes.push({ x: player.x + Math.cos(angle) * 26, y: player.y + Math.sin(angle) * 26, t: 0.07 });
  combat.danger = 1.2;
  return true;
}

/** Throw a punch: hits cops, peds and cars in a short arc ahead. */
export function punch(combat, player, cops, peds, cars) {
  player.punchCooldown = PLAYER.punchCooldown;
  combat.danger = Math.max(combat.danger, 0.6);
  let hit = false;
  const reach = PLAYER.punchRange;
  function inArc(x, y) {
    const d = distance(player.x, player.y, x, y);
    if (d > reach + 12) return false;
    return Math.abs(angleDiff(player.angle, Math.atan2(y - player.y, x - player.x))) < PLAYER.punchArc;
  }
  for (const cop of cops) {
    if (inArc(cop.x, cop.y)) {
      cop.arrest = 0;
      cop.x += Math.cos(player.angle) * 46;
      cop.y += Math.sin(player.angle) * 46;
      cop.knocked = 1.2;
      hit = true;
    }
  }
  for (const ped of peds) {
    if (ped.state !== 'down' && inArc(ped.x, ped.y)) {
      ped.state = 'down';
      ped.fleeTime = 4;
      hit = true;
    }
  }
  for (const car of cars) {
    if (!car.wrecked && inArc(car.x, car.y)) {
      car.health -= PLAYER.punchDamage;
      if (car.health <= 0) { car.health = 0; car.wrecked = true; car.speed = 0; }
      hit = true;
    }
  }
  return hit;
}

export function updateBullets(combat, dt, cops, cars, peds) {
  const events = [];
  for (const b of combat.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    for (const cop of cops) {
      if (cop.knocked > 0) continue;
      if (distance(b.x, b.y, cop.x, cop.y) < 18) {
        cop.knocked = 2.5;
        cop.arrest = 0;
        b.life = 0;
        events.push({ type: 'copDown' });
      }
    }
    for (const car of cars) {
      if (car.wrecked) continue;
      if (distance(b.x, b.y, car.x, car.y) < 30) {
        car.health -= b.damage;
        if (car.health <= 0) {
          car.health = 0;
          car.wrecked = true;
          car.speed = 0;
          car.driver = null;
          events.push({ type: 'carWrecked', car });
        }
        b.life = 0;
      }
    }
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      if (distance(b.x, b.y, ped.x, ped.y) < 12) {
        ped.state = 'down';
        ped.fleeTime = 5;
        b.life = 0;
        events.push({ type: 'pedDown' });
      }
    }
  }
  combat.bullets = combat.bullets.filter((b) => b.life > 0);
  for (const f of combat.flashes) f.t -= dt;
  combat.flashes = combat.flashes.filter((f) => f.t > 0);
  if (combat.danger > 0) combat.danger -= dt;
  return events;
}

/** Scatter cash / ammo / health pickups around the city. */
export function spawnPickups(random, city, content) {
  const pickups = [];
  const kinds = ['cash', 'ammo', 'health'];
  for (let i = 0; i < 36; i += 1) {
    const kind = kinds[i % kinds.length];
    const p = randomRoadPoint(random, city);
    pickups.push({
      x: p.x + random.range(-46, 46),
      y: p.y + random.range(-46, 46),
      kind,
      amount: kind === 'cash' ? random.int(50, 300) : kind === 'ammo' ? random.int(8, 18) : random.int(20, 40),
      taken: false,
      bob: random.range(0, Math.PI * 2),
    });
  }
  return pickups;
}

/** Collect a pickup the player walks or drives over; returns the pickup or null. */
export function collectPickups(pickups, player) {
  for (const p of pickups) {
    if (p.taken) continue;
    if (distance(p.x, p.y, player.x, player.y) < 34) {
      p.taken = true;
      if (p.kind === 'cash') player.cash += p.amount;
      if (p.kind === 'ammo') player.ammo += p.amount;
      if (p.kind === 'health') player.health = Math.min(PLAYER.health, player.health + p.amount);
      return p;
    }
  }
  return null;
}
