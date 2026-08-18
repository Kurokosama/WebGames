/* ============================================================
   CRIMSON TIDE — ISOMETRIC renderer (light / 2.5D)
   Simulation stays in cartesian world space; this projects to
   an isometric camera (RA3 / StarCraft style) with volumetric
   3D-looking assets and a bright daytime palette.
   ============================================================ */
'use strict';

const ISO_X = 0.72, ISO_Y = 0.40;   // 2.5D projection scale (≈ 1.8:1)
let dragStart = null, dragNow = null, mouseTile = { x: 0, y: 0 };

// ---------- projection ----------
function project(wx, wy, z) {
  z = (z || 0) + groundZ(wx, wy);   // ride the terrain elevation
  const dx = wx - cam.fx, dy = wy - cam.fy;
  return { x: (dx - dy) * ISO_X + canvas.width / 2, y: (dx + dy) * ISO_Y - z + canvas.height / 2 };
}
function unproject(sx, sy) {
  const a = (sx - canvas.width / 2) / ISO_X;   // dx - dy
  const b = (sy - canvas.height / 2) / ISO_Y;  // dx + dy
  return { x: cam.fx + (a + b) / 2, y: cam.fy + (b - a) / 2 };
}
function scrollByScreen(mvx, mvy) {
  const ddx = (mvx / ISO_X + mvy / ISO_Y) / 2, ddy = (mvy / ISO_Y - mvx / ISO_X) / 2;
  cam.fx = clamp(cam.fx + ddx, 0, WORLD_W); cam.fy = clamp(cam.fy + ddy, 0, WORLD_H);
}

// ---------- main ----------
function render() {
  if (!G) return;
  ctx.save();
  // sky gradient backdrop
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#bfe3f2'); sky.addColorStop(0.5, '#cfeccf'); sky.addColorStop(1, '#bcdca0');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (shake > 0.5) ctx.translate(rndf(-shake, shake), rndf(-shake, shake));

  drawTerrain();
  drawCloudShadows();
  drawDecals();

  // depth-sorted scene
  const scene = [];
  for (const b of G.buildings) scene.push({ k: b.x + b.y + b.def.height * 0.01, e: b, t: 'b' });
  for (const u of G.units) scene.push({ k: u.x + u.y + (u.def.flying ? 9000 : 0), e: u, t: 'u' });
  scene.sort((a, b) => a.k - b.k);
  for (const s of scene) { if (s.t === 'b') drawBuilding(s.e); else drawUnit(s.e); }

  drawBullets();
  drawFx();
  drawFog();
  drawPlacement();
  ctx.restore();
  drawSelectionBox();
  drawMinimap();
  updateHUD();
}

// ---------- iso primitives ----------
function tileDiamond(tx, ty) {
  const a = project(tx * TILE, ty * TILE), b = project((tx + 1) * TILE, ty * TILE);
  const c = project((tx + 1) * TILE, (ty + 1) * TILE), d = project(tx * TILE, (ty + 1) * TILE);
  return [a, b, c, d];
}
function poly(pts) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); }
// volumetric iso box centered at world (cx,cy), half-extents hw/hl, from z0..z1
function isoBox(cx, cy, hw, hl, z0, z1, top, left, right, stroke) {
  const b = [project(cx - hw, cy - hl, z0), project(cx + hw, cy - hl, z0), project(cx + hw, cy + hl, z0), project(cx - hw, cy + hl, z0)];
  const t = [project(cx - hw, cy - hl, z1), project(cx + hw, cy - hl, z1), project(cx + hw, cy + hl, z1), project(cx - hw, cy + hl, z1)];
  ctx.fillStyle = right; poly([b[1], b[2], t[2], t[1]]); ctx.fill();
  ctx.fillStyle = left; poly([b[3], b[2], t[2], t[3]]); ctx.fill();
  ctx.fillStyle = top; poly(t); ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; poly(t); ctx.stroke(); }
  return { b, t };
}
function shadowEllipse(wx, wy, rw, rh, alpha) {
  const p = project(wx, wy, 0);
  ctx.fillStyle = `rgba(40,55,35,${alpha || 0.22})`;
  ctx.beginPath(); ctx.ellipse(p.x, p.y, rw, rh, 0, 0, 7); ctx.fill();
}

// ---------- terrain (per-frame, viewport-culled, lit) ----------
let miniBase = null, miniFog = null, miniFogN = 0;
function invalidateTerrain() { miniBase = null; }
function projT(wx, wy, z) { const dx = wx - cam.fx, dy = wy - cam.fy; return { x: (dx - dy) * ISO_X + canvas.width / 2, y: (dx + dy) * ISO_Y - (z || 0) + canvas.height / 2 }; }
function elevZ(x, y) { return (inMap(x, y) ? ELEV[y][x] : 0) * ELEV_STEP; }
function visibleTileBounds() {
  const TL = unproject(0, 0), TR = unproject(canvas.width, 0), BL = unproject(0, canvas.height), BR = unproject(canvas.width, canvas.height);
  const pad = Math.ceil(MAX_OBJ_H / (ISO_Y * TILE)) + 2;   // extra rows so tall objects below screen still draw
  return { minX: Math.floor(Math.min(TL.x, TR.x, BL.x, BR.x) / TILE) - 2, maxX: Math.ceil(Math.max(TL.x, TR.x, BL.x, BR.x) / TILE) + 2,
    minY: Math.floor(Math.min(TL.y, TR.y, BL.y, BR.y) / TILE) - 2, maxY: Math.ceil(Math.max(TL.y, TR.y, BL.y, BR.y) / TILE) + pad };
}
const MAX_OBJ_H = 200;
const GRASS_PAL = [[120, 186, 94], [134, 200, 110], [110, 176, 86], [142, 206, 118]];
function tileRGB(t, x, y) {
  if (t === TERRAIN.SAND) return (x + y) % 2 ? [230, 214, 154] : [220, 204, 144];
  if (t === TERRAIN.SNOW) return (x + y) % 2 ? [236, 242, 250] : [224, 232, 244];
  if (t === TERRAIN.ORE || t === TERRAIN.DIRT) return (x + y) % 2 ? [158, 130, 76] : [146, 118, 66];
  if (t === TERRAIN.MOUNTAIN || t === TERRAIN.ROCK) return (x + y) % 2 ? [158, 152, 136] : [146, 140, 124];
  return GRASS_PAL[(x * 3 + y * 7) % 4];
}
function rgbMul(c, f) { return `rgb(${clamp(c[0] * f | 0, 0, 255)},${clamp(c[1] * f | 0, 0, 255)},${clamp(c[2] * f | 0, 0, 255)})`; }

function drawTerrain() {
  const v = visibleTileBounds(), sMin = v.minX + v.minY, sMax = v.maxX + v.maxY;
  for (let s = sMin; s <= sMax; s++) {
    const xlo = Math.max(v.minX, s - v.maxY), xhi = Math.min(v.maxX, s - v.minY);
    for (let x = xlo; x <= xhi; x++) { const y = s - x; if (inMap(x, y)) drawTile(x, y); }
  }
}
function cliffFace(x, y, z, nx, ny, right) {
  const nz = inMap(nx, ny) ? ELEV[ny][nx] * ELEV_STEP : z;
  if (nz >= z) return;
  if (right) { const a = (x + 1) * TILE, t1 = projT(a, y * TILE, z), t2 = projT(a, (y + 1) * TILE, z), b1 = projT(a, (y + 1) * TILE, nz), b2 = projT(a, y * TILE, nz);
    ctx.fillStyle = '#8d7d5b'; poly([t1, t2, b1, b2]); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.16)'; poly([projT(a, y * TILE, (z + nz) / 2), projT(a, (y + 1) * TILE, (z + nz) / 2), b1, b2]); ctx.fill(); }
  else { const yy = (y + 1) * TILE, t1 = projT(x * TILE, yy, z), t2 = projT((x + 1) * TILE, yy, z), b1 = projT((x + 1) * TILE, yy, nz), b2 = projT(x * TILE, yy, nz);
    ctx.fillStyle = '#6f6149'; poly([t1, t2, b1, b2]); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.22)'; poly([projT(x * TILE, yy, (z + nz) / 2), projT((x + 1) * TILE, yy, (z + nz) / 2), b1, b2]); ctx.fill(); }
}
function drawTile(x, y) {
  if (G.fog && FOG[y][x] === 0) return;
  const t = G.map[y][x], lv = ELEV[y][x], z = lv * ELEV_STEP;
  cliffFace(x, y, z, x + 1, y, true);
  cliffFace(x, y, z, x, y + 1, false);
  const dm = [projT(x * TILE, y * TILE, z), projT((x + 1) * TILE, y * TILE, z), projT((x + 1) * TILE, (y + 1) * TILE, z), projT(x * TILE, (y + 1) * TILE, z)];
  if (t === TERRAIN.WATER) {
    const wob = Math.sin((x + y) * 0.6 + G.tick * 0.05) * 12 | 0;
    ctx.fillStyle = `rgb(${64},${146 + wob},${198 + wob})`; poly(dm); ctx.fill();
    const shore = (inMap(x + 1, y) && G.map[y][x + 1] !== TERRAIN.WATER) || (inMap(x, y + 1) && G.map[y + 1][x] !== TERRAIN.WATER) || (inMap(x - 1, y) && G.map[y][x - 1] !== TERRAIN.WATER) || (inMap(x, y - 1) && G.map[y - 1][x] !== TERRAIN.WATER);
    if (shore) { ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; poly(dm); ctx.stroke(); }
    const hp = projT((x + .5) * TILE, (y + .5) * TILE, z); ctx.fillStyle = `rgba(255,255,255,${0.07 + 0.06 * Math.sin(G.tick * 0.06 + x + y)})`; ctx.beginPath(); ctx.ellipse(hp.x, hp.y, 10, 4, 0, 0, 7); ctx.fill();
  } else {
    let light = 0.82 + lv * 0.05;
    if (inMap(x, y - 1) && ELEV[y - 1][x] > lv) light -= 0.14;
    if (inMap(x - 1, y) && ELEV[y][x - 1] > lv) light -= 0.10;
    ctx.fillStyle = rgbMul(tileRGB(t, x, y), clamp(light, 0.5, 1.08)); poly(dm); ctx.fill();
  }
  ctx.strokeStyle = t === TERRAIN.WATER ? 'rgba(255,255,255,0.08)' : 'rgba(40,60,30,0.06)'; ctx.lineWidth = 1; poly(dm); ctx.stroke();
  if (t === TERRAIN.GRASS && (x * 5 + y * 3) % 5 === 0) { const p = projT((x + .5) * TILE, (y + .5) * TILE, z); ctx.strokeStyle = '#6fa84e'; ctx.lineWidth = 1.3; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(p.x + i * 3, p.y); ctx.lineTo(p.x + i * 3 + i, p.y - 5); ctx.stroke(); } }
  else if (t === TERRAIN.GRASS && (x * 7 + y * 5) % 23 === 0) { const p = projT((x + .5) * TILE, (y + .5) * TILE, z), c = ['#ff7eb0', '#ffe24a', '#ffffff'][(x + y) % 3]; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x, p.y - 2, 1.8, 0, 7); ctx.fill(); }
  else if (t === TERRAIN.SAND && (x * 7 + y) % 9 === 0) { const p = projT((x + .5) * TILE, (y + .5) * TILE, z); ctx.fillStyle = 'rgba(180,160,110,0.5)'; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 7); ctx.fill(); }
  else if (t === TERRAIN.SNOW && (x * 5 + y * 7) % 6 === 0) { const p = projT((x + .5) * TILE, (y + .5) * TILE, z), tw = 0.4 + 0.6 * Math.abs(Math.sin(G.tick * 0.07 + x + y)); ctx.fillStyle = `rgba(255,255,255,${tw})`; ctx.beginPath(); ctx.arc(p.x + ((x * 7) % 10) - 5, p.y - ((y * 5) % 6), 1.3, 0, 7); ctx.fill(); }
  if (isBridge(x, y)) drawBridge(x, y);
  else if (t === TERRAIN.ROCK) objRock(x, y);
  else if (t === TERRAIN.MOUNTAIN) objMountain(x, y);
  else if (t === TERRAIN.FOREST) { objTrees(x, y); if (Math.random() < 0.004) G.fx.push({ kind: 'leaf', x: (x + .5) * TILE + rndf(-8, 8), y: (y + .5) * TILE, z: 26, vz: -0.22, vx: rndf(-0.3, 0.3), vy: rndf(-0.2, 0.2), t: 70 + rnd(40), max: 110, col: ['#5aa34e', '#caa23a', '#357029'][rnd(3)] }); }
  else if (t === TERRAIN.SAND && (x * 13 + y * 5) % 37 === 0) objCactus(x, y);
  else if (t === TERRAIN.ORE) drawOreCrystals(x, y);
}
function drawBridge(x, y) {
  const horiz = isBridge(x - 1, y) || isBridge(x + 1, y);
  const cx = (x + .5) * TILE, cy = (y + .5) * TILE;
  // pylon shadows on the water
  ctx.fillStyle = 'rgba(20,40,60,0.25)'; const sp = projT(cx, cy, 0); ctx.beginPath(); ctx.ellipse(sp.x, sp.y, 16, 7, 0, 0, 7); ctx.fill();
  // deck (planks) at bridge height
  const z = BRIDGE_H, hw = TILE * 0.5, hl = TILE * 0.5;
  const deck = [projT(x * TILE, y * TILE, z), projT((x + 1) * TILE, y * TILE, z), projT((x + 1) * TILE, (y + 1) * TILE, z), projT(x * TILE, (y + 1) * TILE, z)];
  ctx.fillStyle = '#9c7a4e'; poly(deck); ctx.fill();
  // plank lines
  ctx.strokeStyle = 'rgba(80,55,30,0.6)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 5; i++) { const f = i / 5; if (horiz) { const a = projT((x + f) * TILE, y * TILE, z), b = projT((x + f) * TILE, (y + 1) * TILE, z); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } else { const a = projT(x * TILE, (y + f) * TILE, z), b = projT((x + 1) * TILE, (y + f) * TILE, z); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
  // railings along the two sides parallel to travel
  ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 2;
  const rail = (ax, ay, bx, by) => { const a0 = projT(ax, ay, z), a1 = projT(ax, ay, z + 7), b0 = projT(bx, by, z), b1 = projT(bx, by, z + 7); ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(b1.x, b1.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.stroke(); };
  if (horiz) { rail(x * TILE, y * TILE, (x + 1) * TILE, y * TILE); rail(x * TILE, (y + 1) * TILE, (x + 1) * TILE, (y + 1) * TILE); }
  else { rail(x * TILE, y * TILE, x * TILE, (y + 1) * TILE); rail((x + 1) * TILE, y * TILE, (x + 1) * TILE, (y + 1) * TILE); }
}
function objCactus(x, y) {
  const cx = (x + .5) * TILE, cy = (y + .5) * TILE; shadowEllipse(cx, cy, 5, 2.5, 0.16);
  const b = project(cx, cy, 0), t = project(cx, cy, 16); ctx.strokeStyle = '#4f8a3e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(t.x, t.y); ctx.stroke();
  const la = project(cx, cy, 9), lt = project(cx - 5, cy, 13), ra = project(cx, cy, 11), rt = project(cx + 5, cy, 15);
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(la.x, la.y); ctx.lineTo(lt.x, lt.y); ctx.moveTo(ra.x, ra.y); ctx.lineTo(rt.x, rt.y); ctx.stroke(); ctx.lineCap = 'butt';
}
function objRock(x, y) { const cx = (x + .5) * TILE, cy = (y + .5) * TILE; shadowEllipse(cx, cy, 12, 6, 0.18); const h = 10 + ((x * 7 + y * 3) % 8); isoBox(cx, cy, 9, 9, 0, h, '#d0cbbd', '#9d988b', '#b6b1a3', 'rgba(80,75,65,0.4)'); }
function objMountain(x, y) {
  const cx = (x + .5) * TILE, cy = (y + .5) * TILE;
  shadowEllipse(cx + 3, cy + 3, 26, 13, 0.22);
  const h = 60 + ((x * 5 + y * 7) % 48);
  isoBox(cx, cy, 18, 18, 0, h * 0.5, '#8d8676', '#615c4b', '#7a7463');
  isoBox(cx, cy - 1, 13, 13, h * 0.45, h * 0.8, '#9c9586', '#6e6857', '#8a8474');
  isoBox(cx, cy - 2, 7, 7, h * 0.75, h, '#aca596', '#79735f', '#9a9484');
  const peak = project(cx, cy - 2, h), m = project(cx, cy - 2, h * 0.78), b1 = project(cx - 7, cy + 6, h * 0.82), b2 = project(cx + 7, cy - 9, h * 0.82);
  ctx.fillStyle = '#f5f8fa'; poly([peak, b1, m, b2]); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(peak.x, peak.y, 3, 0, 7); ctx.fill();
}
function objTrees(x, y) {
  const cx = (x + .5) * TILE, cy = (y + .5) * TILE, n = 2 + ((x + y) % 2), spots = [[-7, -6], [6, 5], [8, -8], [-6, 7]];
  for (let i = 0; i < n; i++) {
    const ox = cx + spots[i][0], oy = cy + spots[i][1], sc = 0.85 + ((x * 3 + y + i) % 4) * 0.12, sway = Math.sin(G.tick * 0.04 + x * 0.6 + y * 0.3 + i) * 1.6;
    shadowEllipse(ox + 3, oy + 3, 7 * sc, 3.5 * sc, 0.16);
    const base = project(ox, oy, 0), tt = project(ox + sway * 0.3, oy, 14 * sc);
    ctx.strokeStyle = '#7a5436'; ctx.lineWidth = 3 * sc; ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(tt.x, tt.y); ctx.stroke();
    for (const [r, col] of [[20, '#357029'], [15, '#46893d'], [9, '#5aa34e']]) { const cc = project(ox + sway, oy, 16 * sc + (24 - r) * 0.7 * sc); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cc.x, cc.y, r * sc, r * 0.85 * sc, 0, 0, 7); ctx.fill(); }
    const hl = project(ox - 3 + sway, oy - 3, 30 * sc); ctx.fillStyle = 'rgba(165,228,142,0.55)'; ctx.beginPath(); ctx.ellipse(hl.x, hl.y, 5 * sc, 4 * sc, 0, 0, 7); ctx.fill();
  }
}
function drawCloudShadows() {
  ctx.save();
  for (const c of G.clouds) {
    const p = project(c.x, c.y, 0);
    if (p.x < -c.r || p.y < -c.r || p.x > canvas.width + c.r || p.y > canvas.height + c.r) continue;
    ctx.fillStyle = 'rgba(30,50,30,0.07)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, c.r, c.r * 0.5, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function drawDecals() {
  for (const d of G.decals) {
    if (G.fog && !visibleAt(d.x, d.y)) continue;
    const p = project(d.x, d.y, 0), a = Math.min(0.38, d.t / 140 * 0.38);
    ctx.fillStyle = `rgba(28,22,16,${a})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, d.r, d.r * 0.5, 0, 0, 7); ctx.fill();
  }
}
function drawOreCrystals(x, y) {
  const amt = MAP_ORE[y][x] / 150, n = Math.max(1, Math.ceil(amt * 4));
  for (let i = 0; i < n; i++) {
    const ox = (x + .3 + (i * 0.27) % 0.5) * TILE, oy = (y + .3 + (i * 0.41) % 0.5) * TILE;
    const h = 8 + (i % 3) * 4, p0 = project(ox, oy, 0), p1 = project(ox, oy, h);
    const glow = 0.7 + 0.3 * Math.sin(G.tick * 0.08 + i + x);
    ctx.fillStyle = `rgba(255,210,70,${glow})`;
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p0.x - 3, p0.y - 2); ctx.lineTo(p0.x, p0.y + 1); ctx.lineTo(p0.x + 3, p0.y - 2); ctx.fill();
    ctx.fillStyle = `rgba(255,240,160,${glow})`;
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p0.x, p0.y + 1); ctx.lineTo(p0.x + 3, p0.y - 2); ctx.fill();
  }
}

// ---------- buildings ----------
function drawBuilding(b) {
  if (G.fog && b.owner !== 0 && !visibleAt(b.x, b.y)) return;
  const cx = b.x, cy = b.y, hw = b.def.w * TILE / 2 - 3, hl = b.def.h * TILE / 2 - 3;
  const H = b.def.height + 6, col = G.players[b.owner].color;
  // soft drop shadow
  shadowEllipse(cx + 5, cy + 5, (b.def.w) * TILE * 0.42, (b.def.h) * TILE * 0.22, 0.18);
  // building base (concrete pad)
  const pad = [project(cx - hw - 3, cy - hl - 3), project(cx + hw + 3, cy - hl - 3), project(cx + hw + 3, cy + hl + 3), project(cx - hw - 3, cy + hl + 3)];
  ctx.fillStyle = '#d8d2c2'; poly(pad); ctx.fill();
  // main volume — light walls, faction-tinted roof
  const wallT = '#f4efe4', wallL = '#cfc8b8', wallR = '#e2dccd';
  const box = isoBox(cx, cy, hw, hl, 0, H, wallT, shade(wallL, -8), wallR, 'rgba(120,110,90,0.4)');
  // faction-colored roof cap
  const cap = [project(cx - hw, cy - hl, H + 0.1), project(cx + hw, cy - hl, H + 0.1), project(cx + hw, cy + hl, H + 0.1), project(cx - hw, cy + hl, H + 0.1)];
  ctx.fillStyle = tint(col, 0.55); poly(cap); ctx.fill();
  ctx.strokeStyle = shade(col, -30); ctx.lineWidth = 1.5; poly(cap); ctx.stroke();
  drawRoofDetail(b, cx, cy, hw, hl, H, col);
  if (b.hitFlash > 0) { ctx.globalAlpha = b.hitFlash / 6 * 0.5; ctx.fillStyle = '#fff'; poly(cap); ctx.fill(); ctx.globalAlpha = 1; }
  // construction shimmer
  if (b.constructing) {
    const k = b.buildT / b.buildDur;
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#7fd6ff'; poly(box.t); ctx.fill(); ctx.restore();
    const yb = project(cx, cy, H * k);
    ctx.strokeStyle = 'rgba(90,200,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(box.t[3].x, yb.y); ctx.lineTo(box.t[1].x, yb.y); ctx.stroke();
  }
  // selection ring
  if (G.selected.includes(b.id)) { ctx.strokeStyle = '#1d6b2e'; ctx.lineWidth = 2.5; poly([project(cx - hw - 4, cy - hl - 4), project(cx + hw + 4, cy - hl - 4), project(cx + hw + 4, cy + hl + 4), project(cx - hw - 4, cy + hl + 4)]); ctx.stroke(); }
  // rally line
  if (b.rally && G.selected.includes(b.id)) { const a = project(cx, cy, H), r = project(b.rally.x, b.rally.y); ctx.strokeStyle = col; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(r.x, r.y); ctx.stroke(); ctx.setLineDash([]); }
  // hp + range
  const top = project(cx, cy, H + 10);
  if (b.hp < b.maxHp && !b.constructing) hpBar(top.x - 18, top.y - 6, 36, b.hp / b.maxHp);
  if (b.def.role === 'defense' && G.selected.includes(b.id)) drawRangeRing(cx, cy, b.def.range * TILE, col);
}
function drawRoofDetail(b, cx, cy, hw, hl, H, col) {
  const role = b.def.role, top = project(cx, cy, H);
  ctx.save();
  if (role === 'yard') {
    // rotating radar dish + crane
    const a = b.anim * 0.04, e1 = project(cx, cy, H + 14), e2 = project(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, H + 10);
    ctx.strokeStyle = '#7a8088'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(e1.x, e1.y); ctx.stroke();
    ctx.fillStyle = '#cfd6dd'; ctx.beginPath(); ctx.ellipse(e1.x, e1.y, 7, 4, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#9fb0bc'; ctx.beginPath(); ctx.moveTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.stroke();
  } else if (role === 'power') {
    // cooling towers with steam
    for (const sx of [-hw * 0.5, hw * 0.5]) {
      isoBox(cx + sx, cy, 5, 5, H - 2, H + 10, '#eef0f0', '#c4c8c8', '#dadede');
      if (b.anim % 60 < 40) { const sp = project(cx + sx, cy, H + 12 + (b.anim % 30) * 0.4); ctx.fillStyle = `rgba(255,255,255,${0.5 - (b.anim % 30) / 60})`; ctx.beginPath(); ctx.arc(sp.x, sp.y, 4 + (b.anim % 30) * 0.2, 0, 7); ctx.fill(); }
    }
    const pulse = 0.4 + 0.4 * Math.sin(b.anim * 0.12); ctx.fillStyle = `rgba(90,200,255,${pulse})`; ctx.beginPath(); ctx.arc(top.x, top.y, 4, 0, 7); ctx.fill();
  } else if (role === 'refinery') {
    isoBox(cx, cy - hl * 0.4, hw * 0.7, hl * 0.25, H, H + 12, tint(col, 0.4), shade(col, -30), shade(col, -10));
    const o = (b.anim * 0.6) % (hw * 1.4);
    const beltP = project(cx - hw * 0.7 + o, cy + hl * 0.5, H + 1); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(beltP.x, beltP.y, 3, 0, 7); ctx.fill();
  } else if (role === 'factory') {
    isoBox(cx, cy, hw * 0.6, hl * 0.6, H, H + 8, '#e6e0d2', '#c2bcae', '#d4cebf');
    if (b.anim % 50 < 25) { const sp = project(cx, cy, H + 18); ctx.fillStyle = 'rgba(160,160,160,0.4)'; ctx.beginPath(); ctx.arc(sp.x, sp.y, 6, 0, 7); ctx.fill(); }
  } else if (role === 'lab') {
    const p = project(cx, cy, H + 12); const pulse = 0.5 + 0.5 * Math.sin(b.anim * 0.1);
    ctx.fillStyle = `rgba(120,255,230,${pulse})`; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7a8088'; ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(p.x, p.y); ctx.stroke();
  } else if (role === 'silo') {
    // storage dome with a fill gauge
    ctx.fillStyle = '#cdd2cf'; ctx.beginPath(); ctx.ellipse(top.x, top.y, hw * 0.7, hl * 0.5, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#9aa09c'; ctx.stroke();
    const pl = G.players[b.owner], fillFrac = pl ? clamp(pl.credits / pl.storageMax, 0, 1) : 0;
    ctx.fillStyle = '#ffce4a'; ctx.fillRect(top.x - hw * 0.5, top.y + 4, hw * fillFrac, 3);
  } else if (role === 'depot') {
    // repair crane that swings
    const a = Math.sin(b.anim * 0.05) * 0.5, e = project(cx + Math.cos(a) * 14, cy + Math.sin(a) * 8, H + 10);
    ctx.strokeStyle = '#7a8088'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    ctx.fillStyle = '#ffce4a'; ctx.beginPath(); ctx.arc(e.x, e.y, 3, 0, 7); ctx.fill();
  } else if (role === 'defense') {
    // turret base + rotating cannon (projected)
    ctx.fillStyle = shade(col, -10); ctx.beginPath(); ctx.ellipse(top.x, top.y, 9, 5, 0, 0, 7); ctx.fill();
    const len = b.def.w * TILE * 0.5, end = project(cx + Math.cos(b.turretAng) * len, cy + Math.sin(b.turretAng) * len, H + 3);
    const isBeam = b.key === 'tesla' || b.key === 'prism' || b.key === 'waveforce';
    ctx.strokeStyle = isBeam ? projColor(b.def.weapon) : '#5a5f66'; ctx.lineWidth = isBeam ? 5 : 4; ctx.lineCap = 'round';
    const muzzle = project(cx, cy, H + 4); ctx.beginPath(); ctx.moveTo(muzzle.x, muzzle.y); ctx.lineTo(end.x, end.y); ctx.stroke(); ctx.lineCap = 'butt';
    if (isBeam) { ctx.fillStyle = projColor(b.def.weapon); ctx.beginPath(); ctx.arc(end.x, end.y, 4, 0, 7); ctx.fill(); }
  }
  // glyph badge on roof
  ctx.fillStyle = 'rgba(40,50,40,0.85)'; ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(b.def.glyph, top.x, top.y + (role === 'defense' ? 0 : 0));
  // waving faction flag on major structures
  if (role === 'yard' || role === 'factory' || role === 'barracks') {
    const px = cx - hw + 5, py = cy - hl + 5, base = project(px, py, H), pole = project(px, py, H + 24);
    ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(pole.x, pole.y); ctx.stroke();
    const pts = [];
    for (let i = 0; i <= 6; i++) { const f = i / 6, wv = Math.sin(G.tick * 0.2 - i * 0.7) * 3 * f; pts.push(project(px + f * 15, py, H + 24 + wv)); }
    for (let i = 6; i >= 0; i--) { const f = i / 6, wv = Math.sin(G.tick * 0.2 - i * 0.7) * 3 * f; pts.push(project(px + f * 15, py, H + 17 + wv)); }
    ctx.fillStyle = col; poly(pts); ctx.fill();
  }
  ctx.restore();
}
function drawRangeRing(cx, cy, r, col) {
  ctx.strokeStyle = col + '66'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 32; i++) { const a = i / 32 * 7; const p = project(cx + Math.cos(a) * r, cy + Math.sin(a) * r); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
  ctx.stroke();
}

// ---------- units ----------
function drawUnit(u) {
  if (G.fog && u.owner !== 0 && !visibleAt(u.x, u.y)) return;
  if (u.cloaked && u.owner !== 0) return;
  const fly = u.def.flying ? 30 : 0, col = G.players[u.owner].color, r = u.def.r;
  shadowEllipse(u.x, u.y, r * 0.95, r * 0.5, u.def.flying ? 0.14 : 0.26);
  ctx.save();
  let alpha = u.cloaked ? 0.45 : 1;
  if (u.spawnT > 0) alpha *= 1 - u.spawnT / 18 * 0.8;   // fade/teleport in
  ctx.globalAlpha = alpha;
  const ch = u.def.chassis;
  if (ch === 'infantry') drawInfantry(u, col, r);
  else if (ch === 'tank') drawTank(u, col, r, false);
  else if (ch === 'mech') drawMech(u, col, r);
  else if (ch === 'artillery') drawArty(u, col, r);
  else if (ch === 'harvester') drawHarv(u, col, r);
  else if (ch === 'heli') drawHeli(u, col, r, fly);
  else if (ch === 'jet') drawJet(u, col, r, fly);
  else if (ch === 'airship') drawAirship(u, col, r, fly);
  ctx.restore();
  // damage flash
  if (u.hitFlash > 0) { const b = project(u.x, u.y, fly + r * 0.5); ctx.globalAlpha = u.hitFlash / 6 * 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(b.x, b.y, r * 0.9, r * 0.9, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  // spawn ring
  if (u.spawnT > 0) { const g = project(u.x, u.y, 0), k = u.spawnT / 18; ctx.strokeStyle = `rgba(120,220,255,${k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(g.x, g.y, (1 - k) * (r + 8) + 3, ((1 - k) * (r + 8) + 3) * 0.5, 0, 0, 7); ctx.stroke(); }
  // overlays
  const head = project(u.x, u.y, fly + r * 1.6);
  if (G.selected.includes(u.id)) { const g = project(u.x, u.y, 0), pr = r + 5 + Math.sin(G.tick * 0.15) * 1.6; ctx.strokeStyle = '#1d6b2e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(g.x, g.y, pr, pr * 0.55, 0, 0, 7); ctx.stroke(); }
  if (u.def.harvester && u.cargo > 0) { ctx.fillStyle = '#3a3a3a'; ctx.fillRect(head.x - r, head.y - 4, r * 2, 4); ctx.fillStyle = '#ffce4a'; ctx.fillRect(head.x - r, head.y - 4, (u.cargo / HARV_CAP) * r * 2, 4); }
  if ((u.hp < u.maxHp || SETTINGS.showHealthAlways) && (!G.fog || u.owner === 0 || visibleAt(u.x, u.y))) hpBar(head.x - r, head.y - 9, r * 2, u.hp / u.maxHp);
  if (u.vet > 0) drawChevrons(head.x, head.y - 12, u.vet);
}
function barrel(u, fromZ, len, col, w) {
  const a = u.turretAng, m = project(u.x, u.y, fromZ), e = project(u.x + Math.cos(a) * len, u.y + Math.sin(a) * len, fromZ - (u.recoil || 0));
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.lineCap = 'butt';
}
function drawSwim(u, col, r) {
  const t = G.tick * 0.3 + u.idlePhase;
  // V-shaped wake on the water surface
  const w = project(u.x, u.y, 0);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(w.x, w.y, r * 1.1, r * 0.55, 0, 0, 7); ctx.fill();
  // submerged torso + bobbing head above the surface
  const bob = Math.sin(t) * 1.2;
  const body = project(u.x, u.y, 2 + bob); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(body.x, body.y, r * 0.5, r * 0.38, 0, 0, 7); ctx.fill();
  const head = project(u.x, u.y, 6 + bob); ctx.fillStyle = '#f0d2a8'; ctx.beginPath(); ctx.arc(head.x, head.y, r * 0.3, 0, 7); ctx.fill();
  ctx.fillStyle = shade(col, -20); ctx.beginPath(); ctx.arc(head.x, head.y - 1, r * 0.32, Math.PI, 0); ctx.fill();
  // paddling arms
  ctx.strokeStyle = '#f0d2a8'; ctx.lineWidth = 2;
  for (const s of [1, -1]) { const ah = project(u.x + Math.cos(t * s) * r * 0.7, u.y + s * r * 0.3, 2 + bob); ctx.beginPath(); ctx.moveTo(body.x, body.y); ctx.lineTo(ah.x, ah.y); ctx.stroke(); }
}
function drawInfantry(u, col, r) {
  if (onWater(u.x, u.y)) { drawSwim(u, col, r); return; }
  const moving = u.state === 'move' || u.state === 'attackmove';
  const bob = moving ? Math.abs(Math.sin(u.legPhase * 0.3)) * 3 : Math.sin((G.tick + u.idlePhase) * 0.08) * 0.8;
  // legs
  const ls = moving ? Math.sin(u.legPhase * 0.3) * 3 : 0;
  const hip = project(u.x, u.y, 5), f1 = project(u.x - 2, u.y, 0), f2 = project(u.x + 2, u.y, 0);
  ctx.strokeStyle = '#3a3f33'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(f1.x - ls, f1.y); ctx.moveTo(hip.x, hip.y); ctx.lineTo(f2.x + ls, f2.y); ctx.stroke();
  // body
  const body = project(u.x, u.y, 10 + bob);
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(body.x, body.y, r * 0.5, r * 0.7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = shade(col, 30); ctx.beginPath(); ctx.ellipse(body.x - 1, body.y - 1, r * 0.32, r * 0.5, 0, 0, 7); ctx.fill();
  // head + helmet
  const head = project(u.x, u.y, 16 + bob);
  ctx.fillStyle = '#f0d2a8'; ctx.beginPath(); ctx.arc(head.x, head.y, r * 0.3, 0, 7); ctx.fill();
  ctx.fillStyle = shade(col, -20); ctx.beginPath(); ctx.arc(head.x, head.y - 1, r * 0.34, Math.PI, 0); ctx.fill();
  // weapon (projected aim)
  barrel(u, 11 + bob, r * 1.1, '#2c2c2c', 2.5);
}
function drawTank(u, col, r, mech) {
  // tracks
  isoBox(u.x, u.y, r * 0.85, r * 0.78, 0, 5, '#4a4a4a', '#2e2e2e', '#3a3a3a');
  // animated tread links along the sides
  const moving = u.state === 'move' || u.state === 'attackmove' || u.state === 'attack';
  const tp = ((u.legPhase * 0.6) % 7);
  for (let d = -r * 0.8; d < r * 0.8; d += 7) {
    const off = d + (moving ? tp : 0);
    const pa = project(u.x + Math.cos(u.bodyAng) * off - Math.sin(u.bodyAng) * r * 0.72, u.y + Math.sin(u.bodyAng) * off + Math.cos(u.bodyAng) * r * 0.72, 5);
    const pb = project(u.x + Math.cos(u.bodyAng) * off + Math.sin(u.bodyAng) * r * 0.72, u.y + Math.sin(u.bodyAng) * off - Math.cos(u.bodyAng) * r * 0.72, 5);
    ctx.fillStyle = '#262626'; ctx.fillRect(pa.x - 1, pa.y - 1, 2.5, 2.5); ctx.fillRect(pb.x - 1, pb.y - 1, 2.5, 2.5);
  }
  // hull volume
  isoBox(u.x, u.y, r * 0.7, r * 0.62, 5, 5 + r * 0.7, tint(col, 0.25), shade(col, -35), shade(col, -12), shade(col, -55));
  // turret
  const tz = 5 + r * 0.7;
  const turP = project(u.x, u.y, tz);
  ctx.fillStyle = shade(col, mech ? 0 : 15); ctx.beginPath(); ctx.ellipse(turP.x, turP.y, r * 0.5, r * 0.32, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = shade(col, -40); ctx.lineWidth = 1; ctx.stroke();
  barrel(u, tz - 1, r * 1.25, '#262626', 3.5);
  if (u.def.wpn && u.def.wpn.twin) barrel({ x: u.x, y: u.y, turretAng: u.turretAng + 0.12, recoil: u.recoil }, tz - 1, r * 1.15, '#262626', 3);
}
function drawMech(u, col, r) {
  // legs
  for (const s of [-1, 1]) { const foot = project(u.x + s * 5, u.y + 4, 0), knee = project(u.x + s * 4, u.y, r * 0.5); ctx.strokeStyle = shade(col, -35); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(foot.x, foot.y); ctx.lineTo(knee.x, knee.y); ctx.stroke(); }
  // torso volume
  isoBox(u.x, u.y, r * 0.55, r * 0.5, r * 0.5, r * 1.5, tint(col, 0.2), shade(col, -35), shade(col, -10), shade(col, -55));
  const sh = project(u.x, u.y, r * 1.4);
  ctx.fillStyle = '#2c2c2c'; ctx.font = (r * 1.1) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(u.def.glyph, sh.x, sh.y);
  barrel(u, r * 1.0, r * 1.3, '#3a3a3a', 4);
}
function drawArty(u, col, r) {
  for (const s of [-1, 1]) isoBox(u.x, u.y, r * 0.8, r * 0.7, 0, 5, '#444', '#262626', '#333');
  isoBox(u.x, u.y, r * 0.6, r * 0.5, 5, 5 + r * 0.5, tint(col, 0.2), shade(col, -35), shade(col, -10));
  barrel(u, 5 + r * 0.5, r * 1.6, '#333', 4);
  const a = u.turretAng, e = project(u.x + Math.cos(a) * r * 1.5, u.y + Math.sin(a) * r * 1.5, 5 + r * 0.5);
  ctx.fillStyle = projColor(u.def.wpn.type); ctx.beginPath(); ctx.arc(e.x, e.y, 3, 0, 7); ctx.fill();
}
function drawHarv(u, col, r) {
  for (const s of [-1, 1]) isoBox(u.x, u.y, r * 0.95, r * 0.85, 0, 6, '#3a3a3a', '#222', '#2c2c2c');
  isoBox(u.x, u.y, r * 0.8, r * 0.72, 6, 6 + r * 0.8, tint('#e0b84a', 0.3), shade('#c79a30', -20), shade('#d8ad3e', -5), shade('#a07c20', -10));
  // tinted cab stripe
  const cab = project(u.x - r * 0.4, u.y - r * 0.4, 6 + r * 0.8); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cab.x, cab.y, 3, 0, 7); ctx.fill();
  // scoop
  const a = u.bodyAng, sc = project(u.x + Math.cos(a) * r * 1.1, u.y + Math.sin(a) * r * 1.1, 4);
  ctx.fillStyle = '#8a8a8a'; ctx.beginPath(); ctx.arc(sc.x, sc.y, 5, 0, 7); ctx.fill();
  if (u.state === 'mining') { const sp = project(u.x + Math.cos(a) * r * 1.1, u.y + Math.sin(a) * r * 1.1, 6 + Math.sin(u.harvestTimer * 0.5) * 3); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(sp.x, sp.y, 3, 0, 7); ctx.fill(); }
}
function drawHeli(u, col, r, fly) {
  isoBox(u.x, u.y, r * 0.6, r * 0.4, fly, fly + r * 0.7, tint(col, 0.2), shade(col, -35), shade(col, -10));
  const nose = project(u.x, u.y, fly + r * 0.35);
  ctx.fillStyle = '#bfe0f0'; ctx.beginPath(); ctx.arc(nose.x, nose.y, r * 0.3, 0, 7); ctx.fill();
  // rotor blur
  const top = project(u.x, u.y, fly + r * 0.9), a = G.tick * 0.9;
  ctx.strokeStyle = 'rgba(120,140,160,0.5)'; ctx.lineWidth = 2;
  for (const off of [0, 1.57, 3.14, 4.71]) { const e = project(u.x + Math.cos(a + off) * r * 1.1, u.y + Math.sin(a + off) * r * 1.1, fly + r * 0.9); ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(e.x, e.y); ctx.stroke(); }
}
function drawJet(u, col, r, fly) {
  const a = u.target ? angTo(u, u.target) : u.bodyAng;
  const nose = project(u.x + Math.cos(a) * r, u.y + Math.sin(a) * r, fly), tail = project(u.x - Math.cos(a) * r, u.y - Math.sin(a) * r, fly);
  const lw = project(u.x - Math.cos(a) * r * 0.3 + Math.cos(a + 1.6) * r * 0.7, u.y - Math.sin(a) * r * 0.3 + Math.sin(a + 1.6) * r * 0.7, fly);
  const rw = project(u.x - Math.cos(a) * r * 0.3 + Math.cos(a - 1.6) * r * 0.7, u.y - Math.sin(a) * r * 0.3 + Math.sin(a - 1.6) * r * 0.7, fly);
  ctx.fillStyle = tint(col, 0.25); poly([nose, lw, tail, rw]); ctx.fill();
  ctx.strokeStyle = shade(col, -40); ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = `rgba(120,200,255,${0.5 + 0.5 * Math.sin(G.tick)})`; ctx.beginPath(); ctx.arc(tail.x, tail.y, 3, 0, 7); ctx.fill();
}
function drawAirship(u, col, r, fly) {
  const bob = Math.sin(G.tick * 0.04 + u.hover) * 4;
  const c = project(u.x, u.y, fly + bob);
  ctx.fillStyle = tint(col, 0.3); ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r * 0.55, 0, 0, 7); ctx.fill();
  ctx.fillStyle = tint(col, 0.5); ctx.beginPath(); ctx.ellipse(c.x - r * 0.2, c.y - r * 0.2, r * 0.55, r * 0.3, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = shade(col, -40); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r * 0.55, 0, 0, 7); ctx.stroke();
  const gondola = project(u.x, u.y, fly + bob - r * 0.6); ctx.fillStyle = '#555'; ctx.fillRect(gondola.x - r * 0.3, gondola.y, r * 0.6, r * 0.3);
}
function drawChevrons(x, y, vet) {
  ctx.fillStyle = vet === 2 ? '#ffce4a' : '#fff';
  for (let i = 0; i < vet; i++) { ctx.beginPath(); ctx.moveTo(x - 4 + i * 5, y); ctx.lineTo(x - 1 + i * 5, y + 3); ctx.lineTo(x + 2 + i * 5, y); ctx.lineTo(x - 1 + i * 5, y + 1.5); ctx.fill(); }
}
function hpBar(x, y, w, frac) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(x - 1, y - 1, w + 2, 5); ctx.fillStyle = frac > .5 ? '#3fb45e' : frac > .25 ? '#e0a020' : '#e04040'; ctx.fillRect(x, y, w * frac, 3); }

// ---------- color helpers ----------
function tint(hex, amt) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt); return `rgb(${r},${g},${b})`; }

// ---------- projectiles ----------
function drawBullets() {
  for (const p of G.bullets) {
    const z = p.arc || 0, scr = project(p.x, p.y, z), src = project(p.sx, p.sy, 0);
    if (p.type === 'prism' || p.type === 'beam') {
      ctx.strokeStyle = p.col; ctx.lineWidth = p.type === 'prism' ? 3.5 : 2.5; ctx.shadowColor = p.col; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(src.x, src.y - 8); ctx.lineTo(scr.x, scr.y); ctx.stroke(); ctx.shadowBlur = 0;
    } else if (p.type === 'tesla') {
      ctx.strokeStyle = p.col; ctx.lineWidth = 2; ctx.shadowColor = '#9cf'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.moveTo(src.x, src.y - 8);
      for (let i = 1; i <= 6; i++) { const t = i / 6; ctx.lineTo(src.x + (scr.x - src.x) * t + rndf(-6, 6), src.y - 8 + (scr.y - src.y + 8) * t + rndf(-6, 6)); }
      ctx.lineTo(scr.x, scr.y); ctx.stroke(); ctx.shadowBlur = 0;
    } else if (p.type === 'arc' || p.type === 'bomb') {
      shadowEllipse(p.x, p.y, 4, 2, 0.2);
      ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(scr.x, scr.y, 4, 0, 7); ctx.fill();
    } else {
      const tgt = project(p.tx, p.ty, 0), a = Math.atan2(tgt.y - scr.y, tgt.x - scr.x);
      ctx.strokeStyle = p.col; ctx.lineWidth = p.type === 'missile' ? 3 : 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(scr.x, scr.y); ctx.lineTo(scr.x - Math.cos(a) * 9, scr.y - Math.sin(a) * 9); ctx.stroke(); ctx.lineCap = 'butt';
      if (p.type === 'missile') { ctx.fillStyle = 'rgba(255,180,120,0.5)'; ctx.beginPath(); ctx.arc(scr.x - Math.cos(a) * 11, scr.y - Math.sin(a) * 11, 3, 0, 7); ctx.fill(); }
    }
  }
}

// ---------- fx ----------
function drawFx() {
  for (const f of G.fx) {
    const z = (f.kind === 'smoke' || f.kind === 'debris' || f.kind === 'leaf') ? (f.z || 0) : 0;
    const p = project(f.x, f.y, z), k = f.t / f.max;
    if (f.kind === 'boom') { ctx.globalAlpha = k; ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(p.x, p.y, f.r * (1.2 - k * 0.6), 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else if (f.kind === 'shock') { ctx.strokeStyle = `rgba(255,240,200,${k})`; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.ellipse(p.x, p.y, f.r * (1 - k), f.r * (1 - k) * 0.5, 0, 0, 7); ctx.stroke(); }
    else if (f.kind === 'spark') { ctx.globalAlpha = k; ctx.fillStyle = f.col; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); ctx.globalAlpha = 1; }
    else if (f.kind === 'debris') { ctx.globalAlpha = k; ctx.fillStyle = f.col; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); ctx.globalAlpha = 1; }
    else if (f.kind === 'smoke') { ctx.globalAlpha = k * 0.35; ctx.fillStyle = '#cfcfcf'; ctx.beginPath(); ctx.arc(p.x, p.y, f.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else if (f.kind === 'muzzle') { ctx.globalAlpha = k; ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(p.x, p.y - 6, 6 * k + 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else if (f.kind === 'ping') { ctx.strokeStyle = f.col || `rgba(40,120,60,${k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, (1 - k) * 18, (1 - k) * 9, 0, 0, 7); ctx.stroke(); }
    else if (f.kind === 'leaf') { ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = f.col; ctx.beginPath(); ctx.ellipse(p.x, p.y, 2.5, 1.4, f.t * 0.3, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else if (f.kind === 'ripple') { ctx.strokeStyle = `rgba(255,255,255,${k * 0.5})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(p.x, p.y, f.r, f.r * 0.5, 0, 0, 7); ctx.stroke(); }
  }
}

// ---------- fog ----------
function drawFog() {
  if (!G.fog) return;
  const TL = unproject(0, 0), BR = unproject(canvas.width, canvas.height), TR = unproject(canvas.width, 0), BL = unproject(0, canvas.height);
  const minX = Math.floor(Math.min(TL.x, TR.x, BL.x, BR.x) / TILE) - 1, maxX = Math.ceil(Math.max(TL.x, TR.x, BL.x, BR.x) / TILE) + 1;
  const minY = Math.floor(Math.min(TL.y, TR.y, BL.y, BR.y) / TILE) - 1, maxY = Math.ceil(Math.max(TL.y, TR.y, BL.y, BR.y) / TILE) + 1;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    if (!inMap(x, y)) continue; const f = FOG[y][x]; if (f === 2) continue;
    poly(tileDiamond(x, y));
    ctx.fillStyle = f === 1 ? 'rgba(70,80,95,0.32)' : 'rgba(214,224,232,0.92)';
    ctx.fill();
  }
}

// ---------- selection box (screen space) ----------
function drawSelectionBox() {
  if (!dragStart || !dragNow) return;
  const x = Math.min(dragStart.x, dragNow.x), y = Math.min(dragStart.y, dragNow.y);
  const w = Math.abs(dragStart.x - dragNow.x), h = Math.abs(dragStart.y - dragNow.y);
  ctx.strokeStyle = '#1d6b2e'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = 'rgba(40,160,70,0.12)'; ctx.fillRect(x, y, w, h);
}

// ---------- placement preview ----------
function drawPlacement() {
  if (!G.placing) return;
  const def = BUILDINGS[G.placing], tx = mouseTile.x - (def.w >> 1), ty = mouseTile.y - (def.h >> 1);
  const ok = canPlace(G.placing, tx, ty, 0);
  for (let y = ty; y < ty + def.h; y++) for (let x = tx; x < tx + def.w; x++) {
    poly(tileDiamond(x, y)); ctx.fillStyle = ok && inMap(x, y) ? 'rgba(60,200,110,0.5)' : 'rgba(220,70,70,0.5)'; ctx.fill();
    ctx.strokeStyle = ok ? '#2f8a52' : '#c04040'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // ghost volume
  const cx = (tx + def.w / 2) * TILE, cy = (ty + def.h / 2) * TILE;
  ctx.globalAlpha = 0.4; isoBox(cx, cy, def.w * TILE / 2 - 3, def.h * TILE / 2 - 3, 0, def.height + 6, ok ? '#bfeccb' : '#f0c0c0', '#9ec4a8', '#d0e8d6'); ctx.globalAlpha = 1;
}

// ---------- minimap (static base baked once; fog throttled) ----------
function buildMiniBase() {
  miniBase = document.createElement('canvas'); miniBase.width = 200; miniBase.height = 200;
  const c = miniBase.getContext('2d'), sx = 200 / MAP_W, sy = 200 / MAP_H;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = G.map[y][x], lv = ELEV[y][x]; let col;
    if (BRIDGE[y][x]) col = '#9c7a4e';
    else if (t === TERRAIN.ORE) col = '#d6ad3a'; else if (t === TERRAIN.WATER) col = '#6fb6df'; else if (t === TERRAIN.MOUNTAIN) col = '#b8b1a2'; else if (t === TERRAIN.ROCK) col = '#a8a094'; else if (t === TERRAIN.SAND) col = '#e3d39e'; else if (t === TERRAIN.SNOW) col = '#eaf0f8'; else if (t === TERRAIN.FOREST) col = '#3f7a3a'; else col = '#8fc468';
    c.fillStyle = col; c.fillRect(x * sx, y * sy, sx + 1, sy + 1);
    if (lv > 0 && t !== TERRAIN.WATER) { c.fillStyle = `rgba(255,255,255,${lv * 0.08})`; c.fillRect(x * sx, y * sy, sx + 1, sy + 1); }
  }
  miniFog = document.createElement('canvas'); miniFog.width = 200; miniFog.height = 200; miniFogN = -1;
}
function buildMiniFog() {
  const c = miniFog.getContext('2d'), sx = 200 / MAP_W, sy = 200 / MAP_H;
  c.clearRect(0, 0, 200, 200);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const f = FOG[y][x]; if (f === 2) continue;
    c.fillStyle = f === 0 ? '#cfd8dd' : 'rgba(70,80,95,0.35)';
    c.fillRect(x * sx, y * sy, sx + 1, sy + 1);
  }
}
function drawMinimap() {
  if (!miniBase) buildMiniBase();
  const sx = 200 / MAP_W, sy = 200 / MAP_H;
  mctx.drawImage(miniBase, 0, 0);
  for (const b of G.buildings) { if (G.fog && b.owner !== 0 && !visibleAt(b.x, b.y)) continue; mctx.fillStyle = G.players[b.owner].color; mctx.fillRect(b.tx * sx, b.ty * sy, b.def.w * sx + 1, b.def.h * sy + 1); }
  for (const u of G.units) { if (G.fog && u.owner !== 0 && !visibleAt(u.x, u.y)) continue; if (u.cloaked && u.owner !== 0) continue; mctx.fillStyle = G.players[u.owner].color; mctx.fillRect(u.x / TILE * sx - 1, u.y / TILE * sy - 1, 2.5, 2.5); }
  if (G.fog) { if (miniFogN !== ((G.tick / 6) | 0)) { miniFogN = (G.tick / 6) | 0; buildMiniFog(); } mctx.drawImage(miniFog, 0, 0); }
  const c = [unproject(0, 0), unproject(canvas.width, 0), unproject(canvas.width, canvas.height), unproject(0, canvas.height)];
  mctx.strokeStyle = '#1d6b2e'; mctx.lineWidth = 1.5; mctx.beginPath();
  c.forEach((p, i) => { const mx = p.x / TILE * sx, my = p.y / TILE * sy; if (i === 0) mctx.moveTo(mx, my); else mctx.lineTo(mx, my); });
  mctx.closePath(); mctx.stroke();
}
