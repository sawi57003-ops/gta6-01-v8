// The city of Cayo Verde: an island street grid, its seven districts, the
// beach and marina on the east edge, the docks on the west, and the buildings
// that fill every block. Everything is derived from the seed, so the same
// seed always builds the same city.
import { WORLD } from './config.js';
import { clamp } from './random.js';

const GRID = 8; // 8x8 blocks, roads every WORLD.road units
const MARGIN = 96; // land starts this far inside the world edge (water around it)

/** Build the static city geometry from a seeded random and the content catalogue. */
export function buildCity(random, content) {
  const buildings = [];
  const parks = [];
  const props = [];
  const roadSet = new Set();
  for (let i = 0; i <= GRID; i += 1) {
    roadSet.add(i * WORLD.road + MARGIN);
  }
  const roads = Array.from(roadSet).sort((a, b) => a - b);

  // One building (or park) per block, seeded per block so layouts are stable.
  for (let gx = 0; gx < GRID; gx += 1) {
    for (let gy = 0; gy < GRID; gy += 1) {
      const x0 = MARGIN + gx * WORLD.road + WORLD.roadWidth / 2 + 10;
      const y0 = MARGIN + gy * WORLD.road + WORLD.roadWidth / 2 + 10;
      const w = WORLD.block - 20;
      const h = WORLD.block - 20;
      const district = districtAtPoint(content, x0 + w / 2, y0 + h / 2);
      if (random.chance(0.14)) {
        parks.push({ x: x0, y: y0, w, h, district: district.id });
        for (let t = 0; t < 5; t += 1) {
          props.push({ kind: 'tree', x: random.range(x0 + 14, x0 + w - 14), y: random.range(y0 + 14, y0 + h - 14) });
        }
        continue;
      }
      const tall = district.id === 'downtown' || district.id === 'marina';
      const bw = random.range(w * 0.42, w * 0.8);
      const bh = random.range(h * 0.42, h * 0.8);
      const bx = x0 + (w - bw) / 2 + random.range(-12, 12);
      const by = y0 + (h - bh) / 2 + random.range(-12, 12);
      buildings.push({
        x: bx, y: by, w: bw, h: bh,
        height: tall ? random.int(3, 9) : random.int(1, 3),
        hue: random.pick(district.roofs),
        district: district.id,
        neon: district.id === 'downtown' || district.id === 'calle-sol',
      });
      if (random.chance(0.5)) {
        props.push({ kind: 'tree', x: random.range(x0 + 10, x0 + w - 10), y: random.range(y0 + 10, y0 + h - 10) });
      }
    }
  }

  // Marina piers and boats on the east water, dock cranes on the west.
  const boats = [];
  for (let i = 0; i < 7; i += 1) {
    boats.push({ x: WORLD.size - 46, y: 300 + i * 300 + random.range(-40, 40), angle: random.range(-0.2, 0.2), len: random.range(46, 78) });
  }
  const cranes = [];
  for (let i = 0; i < 3; i += 1) {
    cranes.push({ x: 44, y: 500 + i * 700, angle: random.range(-0.5, 0.5) });
  }

  return {
    roads, buildings, parks, props, boats, cranes,
    land: { x: MARGIN, y: MARGIN, w: WORLD.size - MARGIN * 2, h: WORLD.size - MARGIN * 2 },
    beach: { x: WORLD.size - MARGIN - 70, y: MARGIN, w: 70, h: WORLD.size - MARGIN * 2 },
  };
}

/** Which district a world point belongs to (content DISTRICTS carry rects). */
export function districtAtPoint(content, x, y) {
  for (const d of content.DISTRICTS) {
    if (x >= d.rect[0] && x < d.rect[0] + d.rect[2] && y >= d.rect[1] && y < d.rect[1] + d.rect[3]) return d;
  }
  return content.DISTRICTS[content.DISTRICTS.length - 1];
}

/** True when the point is on a road (or the beach promenade). */
export function isRoad(city, x, y) {
  const half = WORLD.roadWidth / 2;
  for (const r of city.roads) {
    if (Math.abs(x - r) < half || Math.abs(y - r) < half) return true;
  }
  return false;
}

/** True when the point is inside any building footprint. */
export function hitsBuilding(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

/** Nearest road centre to a point, used to snap spawns onto the street. */
export function nearestRoad(city, x, y) {
  let best = city.roads[0];
  let bestD = Infinity;
  for (const r of city.roads) {
    const d = Math.min(Math.abs(x - r), Math.abs(y - r));
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

/** A random point on a road, anywhere in the city. */
export function randomRoadPoint(random, city) {
  const horizontal = random.chance(0.5);
  const road = random.pick(city.roads);
  const along = random.range(city.land.x + 40, city.land.x + city.land.w - 40);
  return horizontal ? { x: along, y: road } : { x: road, y: along };
}

/** A random point inside a named district, on a road where possible. */
export function randomPointInDistrict(random, city, content, districtId) {
  const d = content.DISTRICTS.find((x) => x.id === districtId) || content.DISTRICTS[0];
  for (let tries = 0; tries < 24; tries += 1) {
    const x = random.range(d.rect[0] + 30, d.rect[0] + d.rect[2] - 30);
    const y = random.range(d.rect[1] + 30, d.rect[1] + d.rect[3] - 30);
    if (isRoad(city, x, y)) return { x, y };
  }
  return { x: d.rect[0] + d.rect[2] / 2, y: d.rect[1] + d.rect[3] / 2 };
}

export function clampToLand(x, y) {
  return {
    x: clamp(x, MARGIN, WORLD.size - MARGIN),
    y: clamp(y, MARGIN, WORLD.size - MARGIN),
  };
}
