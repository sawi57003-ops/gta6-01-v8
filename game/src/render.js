// The renderer: a camera that follows Lena, the island drawn top-down
// (water, sand, parks, roads, buildings with neon), every car, ped, cop and
// pickup, day/night light and rain — then the title / pause / busted /
// wasted / complete screens on top.
import { PALETTE, FONT, FONT_DISPLAY, WORLD, VIEW } from './config.js';
import { clamp, lerp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_JOBS = 'jobs';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const camera = { x: 0, y: 0 };
  return {
    ctx,
    camera,
    resize(w, h) {
      canvas.width = w;
      canvas.height = h;
    },
    draw(state, screen, best) {
      drawFrame(ctx, state, screen, best, camera);
    },
  };
}

function drawFrame(ctx, state, screen, best, camera) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const scale = Math.min(w / VIEW.width, h / VIEW.height);
  const ox = (w - VIEW.width * scale) / 2;
  const oy = (h - VIEW.height * scale) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05080d';
  ctx.fillRect(0, 0, w, h);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);

  // Camera follows the player, clamped to the world.
  const targetX = clamp(state.player.x - VIEW.width / 2, 0, WORLD.size - VIEW.width);
  const targetY = clamp(state.player.y - VIEW.height / 2, 0, WORLD.size - VIEW.height);
  camera.x = lerp(camera.x, targetX, 0.12);
  camera.y = lerp(camera.y, targetY, 0.12);
  if (screen === SCREEN_TITLE) {
    camera.x = clamp(state.city.land.x + 500, 0, WORLD.size - VIEW.width);
    camera.y = clamp(state.city.land.y + 300, 0, WORLD.size - VIEW.height);
  }

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawWorld(ctx, state);
  drawPickups(ctx, state);
  drawMissionMarker(ctx, state);
  drawCars(ctx, state);
  drawPeds(ctx, state);
  drawCops(ctx, state);
  drawPlayer(ctx, state);
  drawBullets(ctx, state);
  ctx.restore();

  // Night tint + rain over everything.
  if (state.night) {
    ctx.fillStyle = 'rgba(8,12,38,0.42)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  } else if (state.timeOfDay > 0.72) {
    ctx.fillStyle = 'rgba(30,16,60,0.18)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  if (state.raining) drawRain(ctx, state);

  if (screen === SCREEN_TITLE) drawTitle(ctx, state, best);
  if (screen === SCREEN_PAUSED) drawCenter(ctx, 'PAUSED', 'P to resume · progress is saved');
  if (screen === SCREEN_BUSTED) drawCenter(ctx, 'BUSTED', 'The Cayo Verde PD took you in. Cash lost: $1,000. Press Enter to try again.');
  if (screen === SCREEN_WASTED) drawCenter(ctx, 'WASTED', 'Lena is down. The syndicate is not patient. Press Enter to try again.');
  if (screen === SCREEN_COMPLETE) {
    drawCenter(ctx, 'DEBT PAID', 'All six jobs done. Lena Cruz is free — $8,000 to spare. Press Enter to keep driving.');
  }
}

function drawWorld(ctx, state) {
  const { city } = state;
  // Water everywhere, then the island.
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(0, 0, WORLD.size, WORLD.size);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, 0, WORLD.size, WORLD.size);
  // Island base: grass.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(city.land.x, city.land.y, city.land.w, city.land.h);
  // Beach strip on the east edge.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(city.beach.x, city.beach.y, city.beach.w, city.beach.h);
  // Marina piers + boats.
  ctx.fillStyle = '#8a6d3b';
  for (let i = 0; i < 4; i += 1) ctx.fillRect(WORLD.size - 150, 260 + i * 560, 110, 14);
  for (const boat of city.boats) {
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(0, 0, boat.len / 2, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(-boat.len / 4, -5, boat.len / 2, 10);
    ctx.restore();
  }
  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  // Roads: asphalt + centre dashes.
  ctx.fillStyle = PALETTE.road;
  for (const r of city.roads) {
    ctx.fillRect(city.land.x, r - WORLD.roadWidth / 2, city.land.w, WORLD.roadWidth);
    ctx.fillRect(r - WORLD.roadWidth / 2, city.land.y, WORLD.roadWidth, city.land.h);
  }
  ctx.fillStyle = PALETTE.roadLine;
  for (const r of city.roads) {
    for (let d = city.land.x + 40; d < city.land.x + city.land.w - 40; d += 64) {
      ctx.fillRect(d, r - 2, 30, 4);
      ctx.fillRect(r - 2, d, 4, 30);
    }
  }
  // Sidewalk edges.
  ctx.strokeStyle = PALETTE.sidewalk;
  ctx.lineWidth = 6;
  for (const r of city.roads) {
    ctx.strokeRect(city.land.x, r - WORLD.roadWidth / 2, city.land.w, WORLD.roadWidth);
    ctx.strokeRect(r - WORLD.roadWidth / 2, city.land.y, WORLD.roadWidth, city.land.h);
  }
  // Buildings with a fake height shadow and a roof.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 8, b.y + 8 + b.height * 2, b.w, b.h);
    ctx.fillStyle = b.hue;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let wx = b.x + 12; wx < b.x + b.w - 12; wx += 26) {
      for (let wy = b.y + 24; wy < b.y + b.h - 12; wy += 26) {
        ctx.fillRect(wx, wy, 12, 14);
      }
    }
    if (b.neon) {
      ctx.strokeStyle = b.district === 'downtown' ? PALETTE.neonCyan : PALETTE.neonPink;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
  }
  // Trees and dock cranes.
  for (const p of city.props) {
    if (p.kind !== 'tree') continue;
    ctx.fillStyle = '#1d5c2a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f9d4e';
    ctx.beginPath();
    ctx.arc(p.x - 3, p.y - 3, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 5;
  for (const c of city.cranes) {
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.cos(c.angle) * 90, c.y + Math.sin(c.angle) * 90);
    ctx.stroke();
  }
}

function drawPickups(ctx, state) {
  const t = state.time * 2;
  for (const p of state.pickups) {
    if (p.taken) continue;
    const bob = Math.sin(t + p.bob) * 3;
    const color = p.kind === 'cash' ? '#4ade80' : p.kind === 'ammo' ? '#f59e0b' : '#f87171';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b1220';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.kind === 'cash' ? '$' : p.kind === 'ammo' ? 'A' : '+', p.x, p.y + bob + 4);
  }
}

function drawMissionMarker(ctx, state) {
  const target = state.missions.target;
  if (!target) return;
  const pulse = 1 + Math.sin(state.time * 4) * 0.15;
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 8, 0, Math.PI * 2);
  ctx.fill();
  // A guide line from the player to the marker, faint.
  ctx.strokeStyle = 'rgba(251,191,36,0.25)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(state.player.x, state.player.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawCarShape(ctx, car) {
  const spec = car.spec;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-26, -12 + 4, 52, 28);
  ctx.fillStyle = car.wrecked ? '#3f3f46' : car.color;
  roundRectPath(ctx, -26, -13, 52, 26, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(-8, -11, 18, 22);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(14, -11, 6, 22);
  if (car.spec.id === 'cruiser') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-4, -13, 8, 4);
    ctx.fillRect(-4, 9, 8, 4);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-22, -13, 6, 5);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(-22, 8, 6, 5);
  }
  if (car.wrecked) {
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, -10);
    ctx.lineTo(20, 10);
    ctx.moveTo(20, -10);
    ctx.lineTo(-20, 10);
    ctx.stroke();
  }
  ctx.restore();
  if (car.driver === 'player') {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(car.x, car.y, 34, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawCars(ctx, state) {
  for (const car of state.cars) drawCarShape(ctx, car);
  for (const car of state.cruisers) drawCarShape(ctx, car);
}

function drawPeds(ctx, state) {
  for (const ped of state.peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.arc(5, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawCops(ctx, state) {
  for (const cop of state.cops) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    if (cop.knocked > 0) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(cop.angle);
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(5, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      if (cop.arrest > 0) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', 0, -18);
      }
    }
    ctx.restore();
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.inCar) return; // drawn as part of the car
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  if (p.hurtFlash > 0) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(state.time * 30);
  }
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(7, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(10, -3, 8, 6);
  ctx.restore();
}

function drawBullets(ctx, state) {
  ctx.fillStyle = '#fef08a';
  for (const b of state.combat.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillRect(-8, -2, 16, 4);
    ctx.restore();
  }
  for (const f of state.combat.flashes) {
    ctx.fillStyle = 'rgba(254,240,138,0.9)';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRain(ctx, state) {
  ctx.strokeStyle = 'rgba(174,194,224,0.4)';
  ctx.lineWidth = 1;
  const t = state.time * 900;
  for (let i = 0; i < 90; i += 1) {
    const x = ((i * 173 + t) % VIEW.width);
    const y = ((i * 97 + t * 1.7) % VIEW.height);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y + 14);
    ctx.stroke();
  }
}

function drawTitle(ctx, state, best) {
  ctx.fillStyle = 'rgba(5,8,14,0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.neonPink;
  ctx.font = `900 92px ${FONT_DISPLAY}`;
  ctx.fillText('VERDE', VIEW.width / 2, 250);
  ctx.fillStyle = PALETTE.neonCyan;
  ctx.fillText('HEAT', VIEW.width / 2, 340);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText('CAYO VERDE  ·  one week  ·  six jobs  ·  $60,000 of debt', VIEW.width / 2, 392);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 17px ${FONT}`;
  ctx.fillText('Lena Cruz owes the Del Toro syndicate. Drive, run, collect — and stay free.', VIEW.width / 2, 424);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText('Press ENTER to start  ·  WASD move  ·  E steal a car  ·  F shoot', VIEW.width / 2, 500);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 15px ${FONT}`;
  ctx.fillText('Progress saves automatically. Radio: R. Night: N. Jobs: M.', VIEW.width / 2, 532);
  if (best > 0) {
    ctx.fillStyle = PALETTE.cash;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(`Best cash in one run: $${best.toLocaleString('en-US')}`, VIEW.width / 2, 566);
  }
  if (state.saveLoaded) {
    ctx.fillStyle = PALETTE.cash;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText('Save found — your week continues where you left it.', VIEW.width / 2, 592);
  }
}

function drawCenter(ctx, title, sub) {
  ctx.fillStyle = 'rgba(5,8,14,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = title === 'BUSTED' ? '#60a5fa' : title === 'WASTED' ? PALETTE.danger : PALETTE.gold;
  ctx.font = `900 64px ${FONT_DISPLAY}`;
  ctx.fillText(title, VIEW.width / 2, VIEW.height / 2 - 20);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 19px ${FONT}`;
  ctx.fillText(sub, VIEW.width / 2, VIEW.height / 2 + 24);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
