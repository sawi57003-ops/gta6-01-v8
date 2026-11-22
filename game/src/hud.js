// The HUD: cash, debt, health, ammo, wanted stars, district, current job,
// radio station, the clock, and a live minimap. All of it is drawn on the
// same canvas as the world, so the game needs no DOM at all.
import { PALETTE, FONT, FONT_DISPLAY, MINIMAP, MARKER } from './config.js';
import { districtAtPoint } from './city.js';
import { debtLeft, currentMission } from './missions.js';

export function drawHUD(ctx, state, view) {
  const { player, wanted, content } = state;
  const debt = debtLeft(content, state.missions, state.debt);
  const district = districtAtPoint(content, player.x, player.y);
  const mission = currentMission(content, state.missions);

  // Top-left panel: cash, debt, health, ammo.
  panel(ctx, 14, 14, 268, 118);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 22px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`$${player.cash.toLocaleString('en-US')}`, 28, 44);
  ctx.fillStyle = PALETTE.danger;
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText(`DEBT  $${debt.toLocaleString('en-US')}`, 28, 66);
  // Health bar.
  bar(ctx, 28, 78, 150, 12, player.health / 100, player.health > 30 ? '#4ade80' : '#ef4444');
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText(`HP ${Math.ceil(player.health)}`, 186, 89);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(`AMMO ${player.ammo}`, 28, 116);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 12px ${FONT}`;
  const carName = player.inCar ? player.inCar.spec.name : 'ON FOOT';
  ctx.fillText(carName, 110, 116);

  // Top-centre: wanted stars.
  const stars = wanted.stars;
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#fbbf24' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', view.width / 2 - 60 + i * 30, 44);
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText(district.name.toUpperCase(), view.width / 2, 64);
  ctx.fillText(state.clock, view.width / 2, 80);

  // Top-right: radio + minimap.
  const station = content.STATIONS[state.audio.station % content.STATIONS.length];
  panel(ctx, view.width - 202, 14, 188, 44);
  ctx.fillStyle = station.color;
  ctx.font = `700 14px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`♪ ${station.name}`, view.width - 190, 33);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText(`${station.genre}  ·  R = next`, view.width - 190, 50);
  drawMinimap(ctx, state, view.width - MINIMAP.size - 14, 66);

  // Bottom-left: current job.
  if (mission && state.missions.active) {
    panel(ctx, 14, view.height - 86, 420, 72);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(`JOB: ${mission.title}  ·  $${mission.pay.toLocaleString('en-US')}`, 28, view.height - 58);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `500 13px ${FONT}`;
    const target = state.missions.target;
    const dist = target ? Math.round(Math.hypot(target.x - player.x, target.y - player.y)) : 0;
    ctx.fillText(`${mission.stageText[state.missions.stage] || mission.brief}  (${dist}m)`, 28, view.height - 36);
  } else if (mission) {
    panel(ctx, 14, view.height - 86, 420, 72);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(`NEXT JOB: ${mission.title}  ·  $${mission.pay.toLocaleString('en-US')}`, 28, view.height - 58);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 13px ${FONT}`;
    ctx.fillText('Follow the gold marker — the job starts itself.', 28, view.height - 36);
  }

  // Toast message.
  if (state.missions.messageTime > 0 && state.missions.message) {
    ctx.textAlign = 'center';
    ctx.font = `600 17px ${FONT}`;
    const w = ctx.measureText(state.missions.message).width + 36;
    panel(ctx, view.width / 2 - w / 2, view.height - 150, w, 40);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(state.missions.message, view.width / 2, view.height - 123);
  }

  // Bottom-right: controls reminder.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('WASD move/drive · E car · Space punch · F shoot · M jobs · P pause · R radio · N night', view.width - 14, view.height - 14);

  if (state.raining) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(147,197,253,0.9)';
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText('☂ rain — roads are slick', 14, view.height - 100);
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelBorder;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, Math.max(4, w * frac), h, 4);
    ctx.fill();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawMinimap(ctx, state, x, y) {
  const size = MINIMAP.size;
  const scale = size / 2560;
  panel(ctx, x - 6, y - 6, size + 12, size + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.fillStyle = '#0b1e2e';
  ctx.fillRect(x, y, size, size);
  // Land, beach and roads.
  ctx.fillStyle = '#274d2f';
  ctx.fillRect(x + 8, y + 8, size - 16, size - 16);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(x + size - 14, y + 8, 6, size - 16);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (const r of state.city.roads) {
    ctx.fillRect(x + r * scale, y, 2, size);
    ctx.fillRect(x, y + r * scale, size, 2);
  }
  // Mission marker.
  if (state.missions.target) {
    ctx.fillStyle = MARKER.mission;
    ctx.beginPath();
    ctx.arc(x + state.missions.target.x * scale, y + state.missions.target.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#60a5fa';
  for (const c of state.cruisers) ctx.fillRect(x + c.x * scale - 2, y + c.y * scale - 2, 4, 4);
  // Player.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + state.player.x * scale, y + state.player.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(x + state.player.x * scale, y + state.player.y * scale, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The jobs list screen (M). */
export function drawJobs(ctx, state, view, list) {
  ctx.fillStyle = 'rgba(6,10,18,0.86)';
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `800 34px ${FONT_DISPLAY}`;
  ctx.fillText('JOBS — DEL TORO SYNDICATE', 90, 110);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 16px ${FONT}`;
  ctx.fillText(`Debt: $${debtLeft(state.content, state.missions, state.debt).toLocaleString('en-US')}  ·  Cash: $${state.player.cash.toLocaleString('en-US')}`, 90, 142);
  let y = 190;
  for (const job of list) {
    const mark = job.status === 'done' ? '✓ DONE' : job.status === 'current' ? '▶ NEXT' : '· LOCKED';
    ctx.fillStyle = job.status === 'current' ? PALETTE.gold : job.status === 'done' ? '#4ade80' : PALETTE.muted;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(`${job.title} — $${job.pay.toLocaleString('en-US')}   ${mark}`, 90, y);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText(job.brief, 90, y + 24);
    y += 62;
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 15px ${FONT}`;
  ctx.fillText('M or Esc to close · the next job starts itself at the gold marker', 90, y + 20);
}

/** Small centred banner used for mission stage changes. */
export function drawBanner(ctx, view, text, sub) {
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `800 30px ${FONT_DISPLAY}`;
  ctx.fillText(text, view.width / 2, 150);
  if (sub) {
    ctx.fillStyle = PALETTE.text;
    ctx.font = `500 16px ${FONT}`;
    ctx.fillText(sub, view.width / 2, 178);
  }
}
