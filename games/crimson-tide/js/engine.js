/* ============================================================
   CRIMSON TIDE — engine: simulation + rendering
   ============================================================ */
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');

let cam = { fx: WORLD_W / 2, fy: WORLD_H / 2 };
const keys = {};
let G = null;
let SETTINGS = loadSettings();
let KEYS = loadKeys();
let shake = 0;

// ---------- small utils ----------
function rnd(n) { return Math.floor(Math.random() * n); }
function rndf(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function inMap(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function lerpAng(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; return a + d * t; }
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = clamp(Math.round(r + amt), 0, 255); g = clamp(Math.round(g + amt), 0, 255); b = clamp(Math.round(b + amt), 0, 255);
  return `rgb(${r},${g},${b})`;
}
function getById(arr, i) { return arr.find(o => o.id === i); }

// ---------- localStorage ----------
function loadSettings() {
  try { return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem('ct_settings') || '{}')); }
  catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
}
function saveSettings() { localStorage.setItem('ct_settings', JSON.stringify(SETTINGS)); }
function loadKeys() {
  try { return Object.assign({}, DEFAULT_KEYS, JSON.parse(localStorage.getItem('ct_keys') || '{}')); }
  catch (e) { return Object.assign({}, DEFAULT_KEYS); }
}
function saveKeys() { localStorage.setItem('ct_keys', JSON.stringify(KEYS)); }

// ============================================================
//  MATCH SETUP
// ============================================================
let MAP_ORE, FOG, ELEV, BRIDGE; // ELEV: terrain height level; BRIDGE: bool per tile
function elevLevel(wx, wy) { const tx = (wx / TILE) | 0, ty = (wy / TILE) | 0; return inMap(tx, ty) ? ELEV[ty][tx] : 0; }
function isBridge(tx, ty) { return inMap(tx, ty) && BRIDGE && BRIDGE[ty][tx]; }
function groundZ(wx, wy) { const tx = (wx / TILE) | 0, ty = (wy / TILE) | 0; if (isBridge(tx, ty)) return BRIDGE_H; return (inMap(tx, ty) ? ELEV[ty][tx] : 0) * ELEV_STEP; }
function onForest(wx, wy) { const tx = (wx / TILE) | 0, ty = (wy / TILE) | 0; return inMap(tx, ty) && G.map[ty][tx] === TERRAIN.FOREST; }
function onWater(wx, wy) { const tx = (wx / TILE) | 0, ty = (wy / TILE) | 0; return inMap(tx, ty) && G.map[ty][tx] === TERRAIN.WATER && !isBridge(tx, ty); }
function canSwim(u) { return u.def.chassis === 'infantry'; }

function startMatch(cfg) {
  // cfg: { playerFaction, enemies:[faction...], difficulty, startCredits, fog, campaign, onWin, onLose, intro }
  const diff = DIFFICULTY[cfg.difficulty] || DIFFICULTY.normal;
  G = {
    tick: 0, running: true, over: false, paused: false,
    cfg, diff, fog: cfg.fog !== undefined ? cfg.fog : SETTINGS.fog,
    map: [], buildings: [], units: [], bullets: [], fx: [], decals: [], clouds: [],
    players: {}, selected: [], placing: null, buildQueue: {},
    nextId: 1, attackMove: false, rallyFlash: 0,
  };
  // players
  G.players[0] = mkPlayer(0, cfg.playerFaction, false, cfg.startCredits || START_DEF);
  let cx = 1;
  for (const f of cfg.enemies) {
    G.players[cx] = mkPlayer(cx, f, true, Math.round((cfg.enemyCredits || 5000) * diff.enemyMul));
    cx++;
  }
  generateMap();
  placeStartBases();
  for (let i = 0; i < 7; i++) G.clouds.push({ x: rnd(WORLD_W), y: rnd(WORLD_H), r: 90 + rnd(140), vx: rndf(0.15, 0.5), vy: rndf(-0.1, 0.1) });
  initFog();
  G.selected = [];
  computeVisibility();
  for (const pid in G.players) recalcPower(+pid);
  resize();
  buildSidebar();
}
const START_DEF = 6000;

function mkPlayer(pid, faction, isAI, credits) {
  const f = FACTIONS[faction];
  return {
    id: pid, faction, color: f.color, accent: f.accent, name: isAI ? f.short + ' AI' : 'You',
    credits, power: 0, powerMax: 0, storageMax: 10000, isAI,
    ai: { timer: rnd(60), mode: 'amass', attackSize: 0, base: null },
  };
}

// lightweight value-noise for organic regions
function makeNoise(scale) {
  const gw = Math.ceil(MAP_W / scale) + 2, gh = Math.ceil(MAP_H / scale) + 2, g = [];
  for (let y = 0; y < gh; y++) { const r = []; for (let x = 0; x < gw; x++) r.push(Math.random()); g.push(r); }
  return (x, y) => {
    const fx = x / scale, fy = y / scale, x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0, s = t => t * t * (3 - 2 * t);
    const a = g[y0][x0], b = g[y0][x0 + 1], c = g[y0 + 1][x0], d = g[y0 + 1][x0 + 1];
    const top = a + (b - a) * s(tx), bot = c + (d - c) * s(tx);
    return top + (bot - top) * s(ty);
  };
}
function blob(cx, cy, rad, set) {
  for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
    if (!inMap(x, y)) continue; const d = Math.hypot(x - cx, y - cy) + rndf(-1, 1);
    if (d <= rad) set(x, y);
  }
}
function generateMap() {
  G.map = []; MAP_ORE = []; ELEV = []; BRIDGE = [];
  for (let y = 0; y < MAP_H; y++) { const row = [], orow = [], erow = [], brow = []; for (let x = 0; x < MAP_W; x++) { row.push(TERRAIN.GRASS); orow.push(0); erow.push(0); brow.push(false); } G.map.push(row); MAP_ORE.push(orow); ELEV.push(erow); BRIDGE.push(brow); }
  const elev = makeNoise(13), ridge = makeNoise(6), detail = makeNoise(4), moist = makeNoise(9), temp = makeNoise(16);

  // base biomes + multi-level elevation from layered noise (more rugged depth)
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const e = elev(x, y) * 0.6 + ridge(x, y) * 0.28 + detail(x, y) * 0.12, m = moist(x, y), tp = temp(x, y);
    ELEV[y][x] = e > 0.8 ? 5 : e > 0.72 ? 4 : e > 0.64 ? 3 : e > 0.56 ? 2 : e > 0.48 ? 1 : 0;
    if (e > 0.82) G.map[y][x] = TERRAIN.MOUNTAIN;
    else if (e > 0.72) G.map[y][x] = TERRAIN.ROCK;
    else if (tp < 0.32 && e > 0.42) G.map[y][x] = TERRAIN.SNOW;       // cold biome → snowy plains/highlands
    else if (m < 0.32 && tp > 0.55 && e < 0.55) G.map[y][x] = TERRAIN.SAND;  // hot & dry → desert
    else G.map[y][x] = TERRAIN.GRASS;
  }
  // lakes in low + moist areas
  for (let i = 0; i < 13; i++) {
    const cx = 12 + rnd(MAP_W - 24), cy = 12 + rnd(MAP_H - 24);
    if (elev(cx, cy) < 0.5) blob(cx, cy, 4 + rnd(6), (x, y) => { if (G.map[y][x] !== TERRAIN.MOUNTAIN) G.map[y][x] = TERRAIN.WATER; });
  }
  // a winding river across the middle
  let ry = MAP_H / 2 + rnd(10) - 5;
  for (let x = 6; x < MAP_W - 6; x++) {
    ry += rnd(3) - 1; ry = clamp(ry, 8, MAP_H - 9);
    for (let w = -1; w <= 1; w++) { const yy = Math.round(ry) + w; if (inMap(x, yy) && G.map[yy][x] !== TERRAIN.MOUNTAIN) G.map[yy][x] = TERRAIN.WATER; }
  }
  // sandy shores around water
  for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
    if (G.map[y][x] !== TERRAIN.GRASS) continue;
    if (G.map[y][x - 1] === TERRAIN.WATER || G.map[y][x + 1] === TERRAIN.WATER || G.map[y - 1][x] === TERRAIN.WATER || G.map[y + 1][x] === TERRAIN.WATER)
      if (Math.random() < 0.7) G.map[y][x] = TERRAIN.SAND;
  }
  // forests in moist lowlands
  for (let i = 0; i < 55; i++) {
    const cx = 6 + rnd(MAP_W - 12), cy = 6 + rnd(MAP_H - 12);
    if (moist(cx, cy) > 0.5 && elev(cx, cy) < 0.64) blob(cx, cy, 2 + rnd(5), (x, y) => { if (G.map[y][x] === TERRAIN.GRASS && Math.random() < 0.82) G.map[y][x] = TERRAIN.FOREST; });
  }
  // ore fields on open ground, spread around the map
  const fields = [];
  for (let i = 0; i < 40; i++) fields.push([8 + rnd(MAP_W - 16), 8 + rnd(MAP_H - 16)]);
  for (const [fx, fy] of fields) blob(fx, fy, 3 + rnd(4), (x, y) => {
    if (G.map[y][x] === TERRAIN.GRASS || G.map[y][x] === TERRAIN.SAND || G.map[y][x] === TERRAIN.DIRT) { G.map[y][x] = TERRAIN.ORE; MAP_ORE[y][x] = 70 + rnd(110); }
  });
  // scattered boulders
  for (let i = 0; i < 210; i++) { const x = rnd(MAP_W), y = rnd(MAP_H); if (G.map[y][x] === TERRAIN.GRASS) G.map[y][x] = TERRAIN.ROCK; }
  // normalize elevation: water sits low, mountains stand tall
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (G.map[y][x] === TERRAIN.WATER) ELEV[y][x] = 0;
    else if (G.map[y][x] === TERRAIN.MOUNTAIN) ELEV[y][x] = ELEV_MAX;
  }
  genBridges();
  invalidateTerrain();
}
// build wooden bridges across narrow water crossings so ground armies can pass
function genBridges() {
  let made = 0, tries = 0;
  const span = (x, y, dx, dy) => {
    const tiles = []; let cx = x, cy = y;
    while (inMap(cx, cy) && G.map[cy][cx] === TERRAIN.WATER) { tiles.push([cx, cy]); cx += dx; cy += dy; if (tiles.length > 12) return null; }
    // must terminate on traversable land on the far side
    if (!inMap(cx, cy) || BLOCKING[G.map[cy][cx]]) return null;
    return tiles;
  };
  while (made < 14 && tries < 6000) {
    tries++;
    const x = 4 + rnd(MAP_W - 8), y = 4 + rnd(MAP_H - 8);
    if (G.map[y][x] !== TERRAIN.WATER || BRIDGE[y][x]) continue;
    const horiz = Math.random() < 0.5, d = horiz ? [1, 0] : [0, 1];
    const fwd = span(x, y, d[0], d[1]), back = span(x - d[0], y - d[1], -d[0], -d[1]);
    if (!fwd || !back) continue;
    const all = back.concat(fwd);
    if (all.length > 9) continue;
    for (const [bx, by] of all) BRIDGE[by][bx] = true;
    made++;
  }
}
function blocked(x, y) { return !inMap(x, y) || BLOCKING[G.map[y][x]]; }
// per-unit terrain traversal: air crosses anything; infantry may enter forests;
// vehicles cannot enter forest; nothing ground crosses water / mountain / rock
function canTraverse(u, x, y) {
  if (!inMap(x, y)) return false;
  if (u.def.flying) return true;
  if (isBridge(x, y)) return true;                        // anyone may cross a bridge
  const t = G.map[y][x];
  if (t === TERRAIN.MOUNTAIN || t === TERRAIN.ROCK) return false;
  if (t === TERRAIN.WATER) return canSwim(u);             // infantry can swim across
  if (t === TERRAIN.FOREST) return u.def.chassis === 'infantry';
  return true;
}
// nearest tile this unit can stand on, spiralling out from a world point
function nearestOpen(u, wx, wy) {
  const cx = (wx / TILE) | 0, cy = (wy / TILE) | 0;
  if (canTraverse(u, cx, cy)) return { x: wx, y: wy };
  for (let r = 1; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
    if (canTraverse(u, cx + dx, cy + dy)) return { x: (cx + dx + .5) * TILE, y: (cy + dy + .5) * TILE };
  }
  return { x: wx, y: wy };
}

function clearArea(tx, ty, w, h) {
  for (let y = ty - 1; y < ty + h + 1; y++) for (let x = tx - 1; x < tx + w + 1; x++)
    if (inMap(x, y) && G.map[y][x] !== TERRAIN.ORE) { G.map[y][x] = TERRAIN.GRASS; ELEV[y][x] = 0; }
}

// pick random, valid, well-separated base tiles for every player
function pickSpawns(n) {
  const margin = 8, footprint = 7;
  const valid = (bx, by) => {
    for (let y = by - 1; y <= by + footprint; y++) for (let x = bx - 1; x <= bx + footprint; x++) {
      if (!inMap(x, y)) return false;
      const t = G.map[y][x];
      if (t === TERRAIN.WATER || t === TERRAIN.MOUNTAIN) return false;   // don't spawn in lakes / on peaks
    }
    return true;
  };
  let minSep = (Math.min(MAP_W, MAP_H) - 2 * margin) * (n <= 2 ? 0.62 : 0.42);
  const spots = [];
  for (let attempt = 0; attempt < 4000 && spots.length < n; attempt++) {
    if (attempt > 0 && attempt % 800 === 0) minSep *= 0.82;            // relax if crowded
    const bx = margin + rnd(MAP_W - 2 * margin - footprint), by = margin + rnd(MAP_H - 2 * margin - footprint);
    if (!valid(bx, by)) continue;
    if (spots.every(s => Math.hypot(s[0] - bx, s[1] - by) >= minSep)) spots.push([bx, by]);
  }
  while (spots.length < n) spots.push([margin + rnd(MAP_W - 2 * margin), margin + rnd(MAP_H - 2 * margin)]);
  return spots;
}
function placeStartBases() {
  const pids = Object.keys(G.players).map(Number);
  const spots = pickSpawns(pids.length);
  // shuffle so the human player isn't always the same corner
  for (let i = spots.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = spots[i]; spots[i] = spots[j]; spots[j] = t; }
  pids.forEach((pid, idx) => {
    const [bx, by] = spots[idx % spots.length];
    const p = G.players[pid];
    clearArea(bx, by, 3, 3);
    const yard = placeBuilding('yard', bx, by, pid, true);
    p.ai.base = { x: yard.x, y: yard.y };
    clearArea(bx + 4, by, 2, 2);
    placeBuilding('power', bx + 4, by, pid, true);
    if (pid !== 0) {
      // prebuilt enemy base
      clearArea(bx, by + 4, 3, 3); placeBuilding('refinery', bx, by + 4, pid, true);
      clearArea(bx + 4, by + 3, 2, 2); placeBuilding('barracks', bx + 4, by + 3, pid, true);
      clearArea(bx + 4, by + 6, 2, 2); placeBuilding('power', bx + 4, by + 6, pid, true);
      spawnUnit('harvester', (bx + 1) * TILE, (by + 7) * TILE, pid);
      const def0 = defenseKey(p.faction, 0);
      clearArea(bx - 2, by + 2, 1, 1); placeBuilding(def0, bx - 2, by + 2, pid, true);
    } else {
      spawnUnit(starterInf(p.faction), (bx + 2) * TILE, (by + 4) * TILE, 0);
      spawnUnit(starterInf(p.faction), (bx + 3) * TILE, (by + 4) * TILE, 0);
      spawnUnit('harvester', (bx + 1) * TILE, (by + 4) * TILE, 0);
      cam.fx = clamp(yard.x, 0, WORLD_W); cam.fy = clamp(yard.y, 0, WORLD_H);
    }
  });
}
function defenseKey(faction, i) { return FACTIONS[faction].defenses[i]; }
function starterInf(faction) { return FACTIONS[faction].units.find(u => UNITS[u].chassis === 'infantry') || 'gi'; }

function initFog() {
  FOG = [];
  for (let y = 0; y < MAP_H; y++) { const r = []; for (let x = 0; x < MAP_W; x++) r.push(G.fog ? 0 : 2); FOG.push(r); }
}
function losClear(x0, y0, x1, y1) {
  // Bresenham; blocked by mountains strictly between the two tiles
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy, x = x0, y = y0;
  while (true) {
    if (!(x === x0 && y === y0) && !(x === x1 && y === y1)) { if (inMap(x, y) && VISION_BLOCK[G.map[y][x]]) return false; }
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err; if (e2 > -dy) { err -= dy; x += sx; } if (e2 < dx) { err += dy === 0 ? 0 : dx; y += sy; }
  }
}
function computeVisibility() {
  if (!G.fog) return;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (FOG[y][x] === 2) FOG[y][x] = 1;
  const reveal = (cx, cy, rad) => {
    const r2 = rad * rad;
    for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(MAP_H - 1, cy + rad); y++)
      for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(MAP_W - 1, cx + rad); x++) {
        const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > r2) continue;
        if (losClear(cx | 0, cy | 0, x, y)) FOG[y][x] = 2;
      }
  };
  for (const u of G.units) if (u.owner === 0) reveal(u.x / TILE, u.y / TILE, u.def.sight + (u.def.flying ? 2 : elevLevel(u.x, u.y)));
  for (const b of G.buildings) if (b.owner === 0) reveal(b.x / TILE, b.y / TILE, b.def.sight + elevLevel(b.x, b.y));
}
function tileVisible(tx, ty) { return !G.fog || (inMap(tx, ty) && FOG[ty][tx] === 2); }
function visibleAt(x, y) { return tileVisible(Math.floor(x / TILE), Math.floor(y / TILE)); }

// ============================================================
//  BUILDINGS
// ============================================================
function id() { return G.nextId++; }
function buildingAt(x, y) { return G.buildings.find(b => x >= b.tx && x < b.tx + b.def.w && y >= b.ty && y < b.ty + b.def.h); }
function hasBuilding(owner, role) { return G.buildings.some(b => b.owner === owner && b.def.role === role && !b.constructing); }
function hasBuildingKey(owner, key) { return G.buildings.some(b => b.owner === owner && b.key === key && !b.constructing); }

function canPlace(key, tx, ty, owner) {
  const def = BUILDINGS[key];
  for (let y = ty; y < ty + def.h; y++) for (let x = tx; x < tx + def.w; x++) {
    if (!inMap(x, y)) return false;
    if (!BUILDABLE[G.map[y][x]]) return false;
    if (buildingAt(x, y)) return false;
    if (G.units.some(u => !u.def.flying && Math.floor(u.x / TILE) === x && Math.floor(u.y / TILE) === y)) return false;
  }
  if (G.buildings.some(b => b.owner === owner)) {
    const cx = tx + def.w / 2, cy = ty + def.h / 2;
    if (!G.buildings.some(b => b.owner === owner && Math.abs(b.tx + b.def.w / 2 - cx) < 9 && Math.abs(b.ty + b.def.h / 2 - cy) < 9)) return false;
  }
  return true;
}
function placeBuilding(key, tx, ty, owner, instant) {
  const def = BUILDINGS[key];
  const b = {
    id: id(), kind: 'building', key, def, owner, tx, ty,
    x: (tx + def.w / 2) * TILE, y: (ty + def.h / 2) * TILE,
    hp: instant ? def.hp : def.hp * 0.25, maxHp: def.hp,
    cooldown: 0, rally: null, turretAng: rnd(7), anim: rnd(100), hitFlash: 0,
    constructing: instant ? 0 : 1, buildT: 0, buildDur: 70,
  };
  G.buildings.push(b);
  recalcPower(owner);
  if (def.role === 'refinery' && instant) spawnUnit('harvester', b.x, (ty + def.h + 1) * TILE, owner);
  return b;
}
function recalcPower(owner) {
  let p = 0, max = 0, store = 0;
  for (const b of G.buildings) { if (b.owner !== owner || b.constructing) continue; if (b.def.power > 0) max += b.def.power; else p += -b.def.power; if (b.def.storage) store += b.def.storage; }
  const pl = G.players[owner]; pl.power = p; pl.powerMax = max; pl.storageMax = store || 10000;
}
function addCredits(owner, amt) { const pl = G.players[owner]; pl.credits = Math.min(pl.storageMax, pl.credits + amt); }
function hasPower(owner) { return G.players[owner].powerMax >= G.players[owner].power; }

// ============================================================
//  UNITS
// ============================================================
function spawnUnit(key, x, y, owner) {
  const def = UNITS[key];
  const u = {
    id: id(), kind: 'unit', key, def, owner,
    x, y, tx: x, ty: y, hp: def.hp, maxHp: def.hp,
    state: 'idle', target: null, cooldown: 0,
    cargo: 0, mineTile: null, harvestTimer: 0,
    bodyAng: rnd(7), turretAng: rnd(7), legPhase: rnd(100), recoil: 0,
    cargoSlot: 0, kills: 0, vet: 0, hover: rndf(0, 6.28), guardX: null,
    cloaked: false, hitFlash: 0, spawnT: 18, idlePhase: rnd(100),
  };
  G.units.push(u);
  return u;
}
function vetMult(u) { return [1, 1.25, 1.55][u.vet] || 1; }
function addKill(u) { u.kills++; if (u.kills >= 5) u.vet = 2; else if (u.kills >= 2) u.vet = 1; }

// ============================================================
//  PRODUCTION
// ============================================================
function prereqMet(owner, def) { if (def.needs) for (const n of def.needs) if (!hasBuilding(owner, n)) return false; return true; }
function canAfford(owner, def) { return G.players[owner].credits >= def.cost; }
function buildableNow(owner, key, isB) {
  const def = isB ? BUILDINGS[key] : UNITS[key];
  if (!prereqMet(owner, def)) return false;
  if (isB) return true;
  return hasBuilding(owner, def.from);
}
function startProduction(key, isB) {
  const owner = 0, def = isB ? BUILDINGS[key] : UNITS[key];
  if (!buildableNow(owner, key, isB)) { flash('Prerequisite missing'); return; }
  const q = G.buildQueue[key];
  if (q && !q.ready) { if (canAfford(owner, def)) { G.players[owner].credits -= def.cost; q.count++; } else flash('Not enough credits'); return; }
  if (q && q.ready) { if (isB) G.placing = key; return; }
  if (!canAfford(owner, def)) { flash('Not enough credits'); return; }
  G.players[owner].credits -= def.cost;
  G.buildQueue[key] = { key, isB, progress: 0, total: def.build * 60, ready: false, count: 1 };
}
function updateProduction() {
  for (const k in G.buildQueue) {
    const q = G.buildQueue[k]; if (q.ready) continue;
    q.progress += hasPower(0) ? 1 : 0.4;
    if (q.progress >= q.total) { q.ready = true; if (!q.isB) deliverUnit(q); }
  }
}
function deliverUnit(q) {
  const def = UNITS[q.key];
  const src = G.buildings.find(b => b.owner === 0 && b.def.role === def.from && !b.constructing);
  let sx = 8 * TILE, sy = 60 * TILE;
  if (src) { sx = src.x; sy = (src.ty + src.def.h + 1) * TILE; }
  const u = spawnUnit(q.key, sx, sy, 0);
  if (src && src.rally) commandMove([u], src.rally.x, src.rally.y, false);
  q.count--;
  if (q.count > 0 && canAfford(0, def)) { G.players[0].credits -= def.cost; q.progress = 0; q.ready = false; }
  else delete G.buildQueue[q.key];
}

// ============================================================
//  COMMANDS
// ============================================================
function commandMove(units, wx, wy, attackMove) {
  units.forEach((u, i) => {
    const ring = Math.floor(i / 8), ang = (i % 8) * 0.785;
    const off = units.length > 1 ? (ring * 30 + 22) : 0;
    let tx = clamp(wx + Math.cos(ang) * off, 8, WORLD_W - 8), ty = clamp(wy + Math.sin(ang) * off, 8, WORLD_H - 8);
    const open = nearestOpen(u, tx, ty); tx = open.x; ty = open.y;   // don't send units into impassable terrain
    u.tx = tx; u.ty = ty;
    u.state = attackMove ? 'attackmove' : 'move';
    u.target = null; u.mineTile = null; u.guardX = null;
  });
}
function commandAttack(units, target) { units.forEach(u => { if (u.def.wpn) { u.target = target; u.state = 'attack'; u.mineTile = null; } }); }
function commandHarvest(units, tx, ty) { units.forEach(u => { if (u.def.harvester) { u.mineTile = { x: tx, y: ty }; u.state = 'toore'; } }); }
function commandStop(units) { units.forEach(u => { u.target = null; u.tx = u.x; u.ty = u.y; u.state = u.def.harvester ? 'idle' : 'idle'; }); }

// ============================================================
//  UPDATE
// ============================================================
function update() {
  if (!G || !G.running || G.over || G.paused) return;
  const steps = SETTINGS.gameSpeed || 1;
  for (let s = 0; s < steps; s++) stepSim();
}
function stepSim() {
  G.tick++;
  edgeScroll();
  updateProduction();
  for (const u of G.units) updateUnit(u);
  for (const b of G.buildings) updateBuilding(b);
  updateBullets();
  updateFx();
  for (const d of G.decals) d.t--;
  G.decals = G.decals.filter(d => d.t > 0);
  for (const c of G.clouds) { c.x += c.vx; c.y += c.vy; if (c.x > WORLD_W + c.r) c.x = -c.r; if (c.x < -c.r) c.x = WORLD_W + c.r; if (c.y > WORLD_H + c.r) c.y = -c.r; if (c.y < -c.r) c.y = WORLD_H + c.r; }
  cleanupDead();
  for (const pid in G.players) if (G.players[pid].isAI) updateAI(+pid);
  if (G.tick % 8 === 0) computeVisibility();
  if (shake > 0) shake *= 0.88;
  checkWin();
}

function findRefinery(owner, near) {
  const refs = G.buildings.filter(b => b.owner === owner && b.def.role === 'refinery' && !b.constructing);
  if (!refs.length) return null;
  refs.sort((a, b) => dist(a, near) - dist(b, near)); return refs[0];
}
function findOreNear(from) {
  const cx = Math.floor(from.x / TILE), cy = Math.floor(from.y / TILE);
  for (let r = 0; r < 45; r++) {
    let best = null, bd = 1e9;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (!inMap(x, y) || G.map[y][x] !== TERRAIN.ORE || MAP_ORE[y][x] <= 0) continue;
      const d = Math.abs(x - cx) + Math.abs(y - cy); if (d < bd) { bd = d; best = { x, y }; }
    }
    if (best) return best;
  }
  return null;
}

function updateUnit(u) {
  if (u.cooldown > 0) u.cooldown--;
  if (u.recoil > 0) u.recoil *= 0.8;
  if (u.hitFlash > 0) u.hitFlash--;
  if (u.spawnT > 0) u.spawnT--;
  // low-HP smoke for big machines
  if (u.hp < u.maxHp * 0.35 && u.def.r >= 13 && G.tick % 12 === 0) G.fx.push({ kind: 'smoke', x: u.x + rndf(-4, 4), y: u.y, z: u.def.r, vz: 0.6, t: 30 + rnd(20), max: 50, r: 4 + rnd(4) });
  // elite self-heal
  if (u.vet >= 2 && u.hp < u.maxHp && G.tick % 30 === 0) u.hp = Math.min(u.maxHp, u.hp + 2);
  // stealth cloak when idle
  if (u.def.stealth) u.cloaked = (u.state === 'idle' || u.state === 'guard') && !u.target;

  if (u.def.harvester) { updateHarvester(u); return; }

  // auto-acquire
  if (u.def.wpn && (u.state === 'idle' || u.state === 'guard' || u.state === 'attackmove')) {
    const e = acquireTarget(u);
    if (e) { u.target = e; if (u.state !== 'attackmove') u.state = 'attack'; else u.attackTarget = e; }
  }

  if (u.state === 'attack' && u.target) { engage(u, u.target, () => { u.state = 'idle'; u.target = null; }); return; }

  if (u.state === 'attackmove') {
    if (u.attackTarget && alive(u.attackTarget) && dist(u, u.attackTarget) <= u.def.wpn.range * TILE + 30) { engage(u, u.attackTarget, () => { u.attackTarget = null; }); return; }
    u.attackTarget = null;
    moveStep(u, u.tx, u.ty, () => { u.state = 'idle'; });
    return;
  }
  if (u.state === 'move') moveStep(u, u.tx, u.ty, () => { u.state = 'idle'; });
}

function engage(u, t, onDone) {
  if (!alive(t)) { onDone(); return; }
  const wpn = u.def.wpn, d = dist(u, t);
  const highGround = !u.def.flying && elevLevel(u.x, u.y) > elevLevel(t.x, t.y);
  const range = wpn.range * TILE * (highGround ? HIGH_GROUND : 1);
  if (wpn.minRange && d < wpn.minRange * TILE) { // back up (artillery)
    const a = angTo(t, u); moveStep(u, u.x + Math.cos(a) * 40, u.y + Math.sin(a) * 40, () => {}); return;
  }
  if (d <= range) {
    const a = angTo(u, t);
    u.turretAng = lerpAng(u.turretAng, a, 0.2);
    u.bodyAng = lerpAng(u.bodyAng, a, 0.08);
    if (Math.abs(((a - u.turretAng + Math.PI) % (Math.PI * 2)) - Math.PI) < 0.25 && u.cooldown <= 0) {
      fireWeapon(u, t); u.cooldown = wpn.rof;
    }
  } else moveStep(u, t.x, t.y);
}

function acquireTarget(u) {
  const wpn = u.def.wpn; if (!wpn) return null;
  const rng = (u.state === 'attackmove' ? wpn.range + 1 : wpn.range + 1.5) * TILE;
  let best = null, bd = rng;
  const consider = (e) => {
    if (e.owner === u.owner || e.hp <= 0) return;
    if (e.kind === 'unit' && e.def.flying && !canHitAir(wpn)) return;
    if (e.kind === 'unit' && e.cloaked && dist(u, e) > 2.5 * TILE) return;
    if (G.fog && u.owner === 0 && !visibleAt(e.x, e.y)) {}
    const d = dist(u, e); if (d < bd) { bd = d; best = e; }
  };
  for (const e of G.units) consider(e);
  for (const e of G.buildings) consider(e);
  return best;
}
function canHitAir(wpn) { return wpn.vs.air > 0; }

function updateHarvester(u) {
  u.cargo = u.cargo || 0;
  if (u.state === 'move') { moveStep(u, u.tx, u.ty, () => { u.state = 'idle'; }); return; }
  if (u.state === 'idle') u.state = u.cargo >= HARV_CAP ? 'toref' : 'toore';
  if (u.state === 'toore') {
    if (!u.mineTile || !inMap(u.mineTile.x, u.mineTile.y) || G.map[u.mineTile.y][u.mineTile.x] !== TERRAIN.ORE) {
      u.mineTile = findOreNear(u); if (!u.mineTile) { u.state = 'idle'; return; }
    }
    moveStep(u, (u.mineTile.x + .5) * TILE, (u.mineTile.y + .5) * TILE, () => { u.state = 'mining'; });
  } else if (u.state === 'mining') {
    u.harvestTimer++;
    if (u.harvestTimer % 7 === 0 && u.cargo < HARV_CAP) {
      const mt = u.mineTile;
      if (mt && MAP_ORE[mt.y][mt.x] > 0) { MAP_ORE[mt.y][mt.x] -= 5; u.cargo += ORE_VALUE; if (MAP_ORE[mt.y][mt.x] <= 0) G.map[mt.y][mt.x] = TERRAIN.GRASS; }
      else { u.mineTile = null; u.state = 'toore'; }
    }
    if (u.cargo >= HARV_CAP) u.state = 'toref';
  } else if (u.state === 'toref') {
    const ref = findRefinery(u.owner, u); if (!ref) { u.state = 'idle'; return; }
    moveStep(u, ref.x, (ref.ty + ref.def.h) * TILE, () => { u.state = 'unloading'; });
  } else if (u.state === 'unloading') {
    if (u.cargo > 0) { const g = Math.min(u.cargo, 30); u.cargo -= g; addCredits(u.owner, g); }
    else u.state = 'toore';
  }
}

function moveStep(u, wx, wy, onArrive) {
  const dx = wx - u.x, dy = wy - u.y, d = Math.hypot(dx, dy);
  let sp = u.def.speed * 1.7;
  if (!u.def.flying) {
    if (onWater(u.x, u.y)) { sp *= SWIM_SPEED; if (G.tick % 9 === 0) G.fx.push({ kind: 'ripple', x: u.x, y: u.y, r: 3, t: 22, max: 22 }); }
    else if (inMap((u.x / TILE) | 0, (u.y / TILE) | 0) && G.map[(u.y / TILE) | 0][(u.x / TILE) | 0] === TERRAIN.SNOW) sp *= SNOW_SPEED;
  }
  if (d < sp + 2) { if (onArrive) onArrive(); return; }
  let nx = dx / d, ny = dy / d;
  if (!u.def.flying) {
    const ax = Math.floor((u.x + nx * (u.def.r + 6)) / TILE), ay = Math.floor((u.y + ny * (u.def.r + 6)) / TILE);
    const tile = buildingAt(ax, ay);
    if ((tile && tile.hp > 0) || !canTraverse(u, ax, ay)) { const px = -ny, py = nx; nx = nx * .35 + px * .95; ny = ny * .35 + py * .95; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m; }
    // unit separation
    for (const o of G.units) { if (o === u || o.def.flying) continue; const dd = dist(u, o); if (dd < u.def.r + o.def.r - 2 && dd > 0.1) { nx += (u.x - o.x) / dd * 0.5; ny += (u.y - o.y) / dd * 0.5; } }
  }
  const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
  u.bodyAng = lerpAng(u.bodyAng, Math.atan2(ny, nx), 0.18);
  u.x = clamp(u.x + nx * sp, 6, WORLD_W - 6);
  u.y = clamp(u.y + ny * sp, 6, WORLD_H - 6);
  u.legPhase += sp;
}

function alive(o) { if (!o) return false; return o.kind === 'unit' ? (G.units.includes(o) && o.hp > 0) : (G.buildings.includes(o) && o.hp > 0); }

// ---------- weapons / damage ----------
function fireWeapon(u, t) {
  const wpn = u.def.wpn;
  u.recoil = 4;
  const a = u.turretAng;
  const highGround = !u.def.flying && elevLevel(u.x, u.y) > elevLevel(t.x, t.y);
  const mult = vetMult(u) * (highGround ? HIGH_GROUND : 1);
  const muzzleX = u.x + Math.cos(a) * (u.def.r + 4), muzzleY = u.y + Math.sin(a) * (u.def.r + 4);
  spawnProjectile(muzzleX, muzzleY, t, u.owner, wpn, mult, u);
  if (wpn.twin) setTimeout(() => { if (alive(u) && alive(t)) spawnProjectile(u.x + Math.cos(a) * (u.def.r + 4), u.y + Math.sin(a) * (u.def.r + 4), t, u.owner, wpn, vetMult(u), u); }, 80);
  G.fx.push({ kind: 'muzzle', x: muzzleX, y: muzzleY, t: 5, max: 5, a, col: '#ffe28a' });
  if (wpn.type === 'arc' || wpn.type === 'bomb') shake = Math.max(shake, 3);
}
function spawnProjectile(x, y, t, owner, wpn, mult, src) {
  const p = { x, y, sx: x, sy: y, target: t, owner, dmg: wpn.damage * mult, vs: wpn.vs, splash: wpn.splash || 0,
    type: wpn.type, speed: projSpeed(wpn.type), col: projColor(wpn.type), prog: 0, src };
  if (wpn.type === 'arc' || wpn.type === 'bomb') { p.tx0 = t.x; p.ty0 = t.y; p.dur = Math.max(28, dist({ x, y }, t) / 7); }
  G.bullets.push(p);
}
function projSpeed(type) { return { bullet: 12, shell: 10, missile: 7, prism: 30, tesla: 30, beam: 26, flak: 11, wave: 9, arc: 0, bomb: 0 }[type] || 10; }
function projColor(type) { return { bullet: '#ffd24a', shell: '#ffb24a', missile: '#ff8a5a', prism: '#7affff', tesla: '#aaccff', beam: '#ff5aa0', flak: '#ffce4a', wave: '#5affc8', arc: '#ff9a4a', bomb: '#ff6a4a' }[type] || '#fff'; }

function damageTarget(t, baseDmg, vs, attacker) {
  const armor = t.kind === 'building' ? 'bldg' : t.def.armor;
  let mult = vs ? (vs[armor] !== undefined ? vs[armor] : 1) : 1;
  if (mult <= 0) return;
  // forest cover protects ground units inside it
  if (t.kind === 'unit' && !t.def.flying && onForest(t.x, t.y)) mult *= FOREST_COVER;
  t.hp -= baseDmg * mult;
  t.hitFlash = 6;
  if (t.hp <= 0 && attacker && attacker.kind === 'unit' && alive(attacker)) addKill(attacker);
}
function applySplash(x, y, radius, dmg, vs, owner, attacker) {
  const r = radius * TILE;
  const hit = (e) => { if (e.owner === owner || e.hp <= 0) return; if (e.kind === 'unit' && e.def.flying) return; const d = dist({ x, y }, e); if (d <= r) damageTarget(e, dmg * (1 - d / r * 0.5), vs, attacker); };
  for (const e of G.units) hit(e);
  for (const e of G.buildings) hit(e);
}

function updateBullets() {
  for (const p of G.bullets) {
    if (p.type === 'arc' || p.type === 'bomb') {
      p.prog++;
      const k = p.prog / p.dur;
      const tx = p.target && alive(p.target) ? p.target.x : p.tx0;
      const ty = p.target && alive(p.target) ? p.target.y : p.ty0;
      p.x = p.sx + (tx - p.sx) * k; p.y = p.sy + (ty - p.sy) * k;
      p.arc = Math.sin(k * Math.PI) * (p.type === 'bomb' ? 30 : 70);
      if (k >= 1) { p.hit = true; bigExplosion(p.x, p.y, p.type === 'bomb' ? 1.5 : 1); applySplash(p.x, p.y, p.splash, p.dmg, p.vs, p.owner, p.src); shake = Math.max(shake, 7); }
      continue;
    }
    if (p.target && alive(p.target)) { p.tx = p.target.x; p.ty = p.target.y; } else if (p.tx === undefined) { p.tx = p.x; p.ty = p.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    if (d < p.speed) {
      p.hit = true;
      if (p.target && alive(p.target)) {
        damageTarget(p.target, p.dmg, p.vs, p.src);
        smallExplosion(p.tx, p.ty, p.col);
        if (p.splash) applySplash(p.tx, p.ty, p.splash, p.dmg * 0.6, p.vs, p.owner, p.src);
      }
    } else { p.x += dx / d * p.speed; p.y += dy / d * p.speed; }
  }
  G.bullets = G.bullets.filter(p => !p.hit);
}

function updateBuilding(b) {
  if (b.cooldown > 0) b.cooldown--;
  if (b.hitFlash > 0) b.hitFlash--;
  b.anim++;
  // damaged buildings belch smoke
  if (!b.constructing && b.hp < b.maxHp * 0.4 && G.tick % 10 === 0) G.fx.push({ kind: 'smoke', x: b.x + rndf(-b.def.w * 6, b.def.w * 6), y: b.y, z: b.def.height + 4, vz: 0.8, t: 45 + rnd(25), max: 70, r: 6 + rnd(6) });
  // Service Depot slowly repairs nearby friendly vehicles
  if (b.def.repair && !b.constructing && G.tick % 12 === 0) {
    for (const u of G.units) { if (u.owner === b.owner && u.def.armor === 'veh' && u.hp < u.maxHp && dist(u, b) < 6.5 * TILE) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.015 + 2); G.fx.push({ kind: 'spark', x: u.x, y: u.y, vx: rndf(-1, 1), vy: rndf(-1.5, -.3), t: 8, max: 8, col: '#7fffd0' }); } }
  }
  if (b.constructing) { b.buildT++; b.hp = Math.min(b.maxHp, b.def.hp * (0.25 + 0.75 * b.buildT / b.buildDur)); if (b.buildT >= b.buildDur) { b.constructing = 0; recalcPower(b.owner); if (b.def.role === 'refinery') spawnUnit('harvester', b.x, (b.ty + b.def.h + 1) * TILE, b.owner); } return; }
  if (b.def.role === 'defense' && b.hp > 0) {
    const e = acquireForBuilding(b);
    if (e) {
      const a = angTo(b, e); b.turretAng = lerpAng(b.turretAng, a, 0.2);
      if (b.cooldown <= 0 && Math.abs(((a - b.turretAng + Math.PI) % 6.283) - Math.PI) < 0.3) {
        const wpn = { damage: b.def.damage, range: b.def.range, rof: b.def.rof, splash: b.def.splash || 0, vs: b.def.vs, type: b.def.weapon };
        spawnProjectile(b.x, b.y, e, b.owner, wpn, 1, b); b.cooldown = b.def.rof;
        G.fx.push({ kind: 'muzzle', x: b.x, y: b.y - b.def.height, t: 5, max: 5, a, col: '#ffe28a' });
      }
    }
  }
}
function acquireForBuilding(b) {
  let best = null, bd = b.def.range * TILE;
  const consider = (e) => { if (e.owner === b.owner || e.hp <= 0) return; if (e.kind === 'unit' && e.def.flying && b.def.vs.air <= 0) return; if (e.kind === 'unit' && e.cloaked) return; const d = dist(b, e); if (d < bd) { bd = d; best = e; } };
  for (const e of G.units) consider(e);
  return best;
}

// ---------- fx ----------
function smallExplosion(x, y, col) { G.fx.push({ kind: 'boom', x, y, t: 12, max: 12, r: 10, col: col || '#ffb04a' }); for (let i = 0; i < 4; i++) G.fx.push({ kind: 'spark', x, y, vx: rndf(-2, 2), vy: rndf(-2, 2), t: 8 + rnd(6), max: 14, col: col || '#ffd060' }); }
function bigExplosion(x, y, scale) {
  scale = scale || 1;
  G.fx.push({ kind: 'shock', x, y, t: 14, max: 14, r: 30 * scale });
  for (let i = 0; i < 10 * scale; i++) G.fx.push({ kind: 'boom', x: x + rndf(-18, 18) * scale, y: y + rndf(-18, 18) * scale, t: 10 + rnd(16), max: 26, r: 8 + rnd(10), col: ['#ffefa0', '#ff8a3a', '#ff5a2a'][rnd(3)] });
  for (let i = 0; i < 14 * scale; i++) G.fx.push({ kind: 'debris', x, y, vx: rndf(-2, 2), vy: rndf(-2, 2), z: 6, vz: rndf(2, 5), t: 20 + rnd(20), max: 40, col: '#7a6a55' });
  for (let i = 0; i < 6; i++) G.fx.push({ kind: 'smoke', x: x + rndf(-10, 10), y: y + rndf(-6, 6), z: 4, vz: 0.7, t: 40 + rnd(30), max: 70, r: 8 + rnd(8) });
}
function updateFx() {
  for (const f of G.fx) {
    f.t--;
    if (f.vx !== undefined) { f.x += f.vx; f.y += f.vy; }
    if (f.kind === 'debris') { f.z = (f.z || 0) + (f.vz || 0); f.vz = (f.vz || 2) - 0.3; if (f.z < 0) f.z = 0; }
    if (f.kind === 'smoke') { f.z = (f.z || 0) + (f.vz || 0); f.r += 0.2; }
    if (f.kind === 'leaf') { f.z = (f.z || 0) + f.vz; f.x += Math.sin(f.t * 0.2) * 0.4; if (f.z < 0) { f.z = 0; f.vz = 0; } }
    if (f.kind === 'ripple') { f.r += 0.5; }
  }
  G.fx = G.fx.filter(f => f.t > 0);
}

function addScorch(x, y, r) { G.decals.push({ x, y, r, t: 600, max: 600 }); if (G.decals.length > 60) G.decals.shift(); }
function cleanupDead() {
  for (const u of G.units) if (u.hp <= 0) { bigExplosion(u.x, u.y, u.def.r > 14 ? 1.3 : 0.8); addScorch(u.x, u.y, u.def.r * 0.9); }
  let powerDirty = false;
  for (const b of G.buildings) if (b.hp <= 0) { bigExplosion(b.x, b.y, 1.6); addScorch(b.x, b.y, b.def.w * TILE * 0.4); shake = Math.max(shake, 9); powerDirty = true; }
  const before = G.units.length;
  G.units = G.units.filter(u => u.hp > 0);
  G.buildings = G.buildings.filter(b => b.hp > 0);
  G.selected = G.selected.filter(i => getById(G.units, i) || getById(G.buildings, i));
  if (powerDirty) for (const pid in G.players) recalcPower(+pid);
}

// ============================================================
//  AI — a smarter (not stronger) commander: economy-aware,
//  reactive to threats, proactive with counters & grouped pushes.
// ============================================================
function unitValue(u) { return u.hp * 0.5 + (u.def.wpn ? u.def.wpn.damage * 4 : 0); }
function aiArmy(pid) { return G.units.filter(u => u.owner === pid && u.def.wpn && !u.def.harvester); }
function aiStrength(arr) { let s = 0; for (const u of arr) s += unitValue(u); return s; }
function aiCount(pid, role) { return G.buildings.filter(b => b.owner === pid && b.def.role === role && !b.constructing).length; }
function aiHarvesters(pid) { return G.units.filter(u => u.owner === pid && u.def.harvester).length; }

// what is the enemy fielding? returns normalised inf/veh/air pressure
function aiEnemyComposition(pid) {
  let inf = 0, veh = 0, air = 0;
  for (const u of G.units) { if (u.owner === pid || !u.def.wpn) continue; if (u.def.flying) air++; else if (u.def.armor === 'inf') inf++; else veh++; }
  const tot = inf + veh + air + 3;
  return { inf: (inf + 1) / tot, veh: (veh + 1) / tot, air: (air + 0.5) / tot };
}
// strength of enemy units threatening this AI's base
function aiThreat(pid) {
  const bs = G.buildings.filter(b => b.owner === pid); if (!bs.length) return 0;
  let s = 0;
  for (const u of G.units) { if (u.owner === pid || !u.def.wpn || u.def.harvester) continue; for (const b of bs) { if (dist(u, b) < 18 * TILE) { s += unitValue(u); break; } } }
  return s;
}
function aiNearestEnemyBuilding(pid, from) {
  let best = null, bd = 1e9;
  for (const b of G.buildings) { if (b.owner === pid) continue; const d = dist(b, from); if (d < bd) { bd = d; best = b; } }
  return best;
}
function aiStagePoint(pid, yard) {
  const tgt = aiNearestEnemyBuilding(pid, yard) || yard;
  return { x: yard.x + (tgt.x - yard.x) * 0.32, y: yard.y + (tgt.y - yard.y) * 0.32 };
}
function aiPickTarget(pid, from) {
  // prefer enemy economy, then production, then any building, then units
  const score = (b) => { const r = b.def.role; let s = r === 'refinery' || r === 'silo' ? 5 : r === 'yard' ? 4 : (r === 'factory' || r === 'barracks' || r === 'lab') ? 3 : r === 'defense' ? 1 : 2; return s * 1000 - dist(b, from) / TILE; };
  let best = null, bs = -1e9;
  for (const b of G.buildings) { if (b.owner === pid) continue; if (G.fog) {} const v = score(b); if (v > bs) { bs = v; best = b; } }
  if (best) return best;
  let bu = null, bd = 1e9;
  for (const u of G.units) { if (u.owner === pid) continue; const d = dist(u, from); if (d < bd) { bd = d; bu = u; } }
  return bu;
}

function aiFindSpot(pid, yard, key, def) {
  const enemy = aiNearestEnemyBuilding(pid, yard);
  for (let t = 0; t < 60; t++) {
    let tx, ty;
    if (def.role === 'defense' && enemy && t < 40) { const dx = Math.sign(enemy.tx - yard.tx) || 1, dy = Math.sign(enemy.ty - yard.ty) || 1; tx = yard.tx + dx * (4 + rnd(9)) + rnd(6) - 3; ty = yard.ty + dy * (4 + rnd(9)) + rnd(6) - 3; }
    else { tx = yard.tx + rnd(24) - 12; ty = yard.ty + rnd(24) - 12; }
    if (canPlace(key, tx, ty, pid)) return { x: tx, y: ty };
  }
  return null;
}
// decide the single most useful structure to build right now
function aiBuildGoal(pid) {
  const p = G.players[pid], has = r => aiCount(pid, r) > 0, threat = aiThreat(pid) > 0;
  const powerLow = p.powerMax - p.power < 30;
  if (powerLow) return 'power';
  if (!has('refinery')) return 'refinery';
  if (!has('barracks')) return 'barracks';
  if (threat && aiCount(pid, 'defense') < aiCount(pid, 'refinery') + 1) return defenseKey(p.faction, has('lab') ? 1 : 0);
  if (!has('factory')) return 'factory';
  if (aiHarvesters(pid) >= aiCount(pid, 'refinery') * 2 && aiCount(pid, 'refinery') < 3 && p.credits > 2600) return 'refinery';
  if (p.credits > p.storageMax * 0.85 && p.storageMax < 18000) return 'silo';
  if (!has('lab') && has('factory') && p.credits > 2000) return 'lab';
  if (!has('depot') && has('factory') && aiCount(pid, 'factory') >= 1 && p.credits > 1600) return 'depot';
  if (aiCount(pid, 'defense') < 2 + aiCount(pid, 'refinery')) return defenseKey(p.faction, has('lab') ? 1 : 0);
  if (p.credits > 2500) return 'power';
  return null;
}
// pick the unit that best counters what the enemy fields
function aiTrainChoice(pid) {
  const roster = FACTIONS[G.players[pid].faction].units.filter(k => { const d = UNITS[k]; return !d.harvester && !d.engineer && hasBuilding(pid, d.from) && prereqMet(pid, d); });
  if (!roster.length) return null;
  const comp = aiEnemyComposition(pid);
  let best = null, bestScore = -1e9;
  for (const k of roster) {
    const d = UNITS[k], w = d.wpn; let score = rndf(0, 0.4);
    if (w) score += (w.vs.air || 0) * comp.air * 1.4 + (w.vs.veh || 0) * comp.veh + (w.vs.inf || 0) * comp.inf;
    if (d.cost > G.players[pid].credits) score -= 5;
    if (score > bestScore) { bestScore = score; best = k; }
  }
  return best;
}

function updateAI(pid) {
  const p = G.players[pid], ai = p.ai, diff = G.diff; ai.timer++;
  const yard = G.buildings.find(b => b.owner === pid && b.def.role === 'yard');
  if (!yard) return;

  // ---- construction (priority-driven) ----
  if (ai.timer % diff.aiBuild === 0) {
    const goal = aiBuildGoal(pid);
    if (goal) { const def = BUILDINGS[goal]; if (canAfford(pid, def) && prereqMet(pid, def)) { const spot = aiFindSpot(pid, yard, goal, def); if (spot) { p.credits -= def.cost; placeBuilding(goal, spot.x, spot.y, pid, false); } } }
  }
  // ---- economy: keep harvesters topped up ----
  if (ai.timer % 120 === 0) {
    const refs = G.buildings.filter(b => b.owner === pid && b.def.role === 'refinery' && !b.constructing);
    const target = Math.min(refs.length * 2, 6);
    if (aiHarvesters(pid) < target && canAfford(pid, UNITS.harvester) && refs.length) { p.credits -= UNITS.harvester.cost; const r = refs[rnd(refs.length)]; spawnUnit('harvester', r.x, (r.ty + r.def.h) * TILE, pid); }
  }
  // ---- training: counter the enemy's composition ----
  if (ai.timer % diff.aiTrain === 0) {
    const k = aiTrainChoice(pid);
    if (k) { const def = UNITS[k]; if (canAfford(pid, def)) { const src = G.buildings.find(b => b.owner === pid && b.def.role === def.from && !b.constructing); if (src) { p.credits -= def.cost; spawnUnit(k, src.x, (src.ty + src.def.h + 1) * TILE, pid); } } }
  }
  // difficulty income (unchanged — smarter, not richer)
  if (ai.timer % 60 === 0) addCredits(pid, Math.round(8 * diff.aiIncome));

  // ---- army command: amass / attack / defend ----
  if (ai.timer % 24 === 0) aiCommand(pid, yard);
}

function aiCommand(pid, yard) {
  const p = G.players[pid], ai = p.ai, diff = G.diff;
  const army = aiArmy(pid);
  const threat = aiThreat(pid);
  const myStr = aiStrength(army);

  // threat overrides everything: defend home
  if (threat > myStr * 0.35 && threat > 40) {
    ai.mode = 'defend';
    for (const u of army) { if (u.state === 'attack') continue; if (dist(u, yard) > 9 * TILE) { u.tx = yard.x + rndf(-90, 90); u.ty = yard.y + rndf(-90, 90); u.state = 'attackmove'; } }
    return;
  }
  if (ai.mode === 'defend' && threat <= 0) ai.mode = 'amass';

  if (ai.mode === 'attack') {
    // retreat if the push has been gutted
    if (army.length < ai.attackSize * 0.4 || army.length < 2) { ai.mode = 'amass'; for (const u of army) { u.target = null; u.state = 'attackmove'; u.tx = yard.x + rndf(-60, 60); u.ty = yard.y + rndf(-60, 60); } return; }
    // re-target idle attackers
    for (const u of army) { if (u.state !== 'attack' || !u.target || !alive(u.target)) { const t = aiPickTarget(pid, u); if (t) { u.target = t; u.state = 'attack'; } } }
    return;
  }

  // amass: gather at staging, commit when strong enough and not outmatched at the front
  const stage = aiStagePoint(pid, yard);
  for (const u of army) { if (u.state === 'idle' || u.state === 'guard') { if (dist(u, stage) > 6 * TILE) { u.tx = stage.x + rndf(-70, 70); u.ty = stage.y + rndf(-70, 70); u.state = 'attackmove'; } } }
  const launchSize = diff.aiArmy + 4;
  if (army.length >= launchSize) {
    const enemyDefStr = aiEnemyFrontStrength(pid);
    if (myStr > enemyDefStr * 0.85 || army.length >= launchSize + 6) {
      const tgt = aiPickTarget(pid, stage);
      if (tgt) { for (const u of army) { u.target = tgt; u.state = 'attack'; } ai.mode = 'attack'; ai.attackSize = army.length; }
    }
  }
}
// rough strength the enemy can muster to defend the chosen target area
function aiEnemyFrontStrength(pid) {
  const tgt = aiPickTarget(pid, G.players[pid].ai.base || { x: WORLD_W / 2, y: WORLD_H / 2 });
  if (!tgt) return 0;
  let s = 0;
  for (const u of G.units) { if (u.owner === pid || !u.def.wpn) continue; if (dist(u, tgt) < 22 * TILE) s += unitValue(u); }
  for (const b of G.buildings) { if (b.owner === pid || b.def.role !== 'defense') continue; if (dist(b, tgt) < 12 * TILE) s += b.def.damage * 6; }
  return s;
}

function checkWin() {
  const playerAlive = G.buildings.some(b => b.owner === 0) || G.units.some(u => u.owner === 0);
  let enemyAlive = false;
  for (const pid in G.players) { if (+pid === 0) continue; if (G.buildings.some(b => b.owner === +pid) || G.units.some(u => u.owner === +pid && !u.def.harvester)) enemyAlive = true; }
  if (!enemyAlive) endMatch(true);
  else if (!playerAlive) endMatch(false);
}
function endMatch(won) {
  if (G.over) return; G.over = true; G.running = false;
  onMatchEnd(won);
}

// resize handled in menu/main
function resize() {
  canvas.width = window.innerWidth - 230;
  canvas.height = window.innerHeight - 40;
}
window.addEventListener('resize', () => { if (G) resize(); });
