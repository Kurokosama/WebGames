/* ============================================================
   CRIMSON TIDE — input + in-game HUD
   ============================================================ */
'use strict';

function screenToWorld(mx, my) { return unproject(mx, my); }

canvas.addEventListener('mousedown', e => {
  if (!G || G.over) return;
  const mx = e.offsetX, my = e.offsetY;
  if (e.button === 0) {
    if (G.placing) { doPlace(mx, my); return; }
    dragStart = { x: mx, y: my }; dragNow = { x: mx, y: my };
  } else if (e.button === 2) rightClick(mx, my);
});
canvas.addEventListener('mousemove', e => {
  if (!G) return;
  const w = screenToWorld(e.offsetX, e.offsetY);
  mouseTile = { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
  if (dragStart) dragNow = { x: e.offsetX, y: e.offsetY };
});
window.addEventListener('mouseup', e => { if (e.button === 0 && dragStart && G) finishDrag(e.shiftKey); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); }, { passive: false });

function finishDrag(additive) {
  const a = dragStart, b = dragNow; dragStart = dragNow = null;
  if (!a || !b) return;
  const dd = Math.hypot(a.x - b.x, a.y - b.y);
  if (!additive) G.selected = [];
  if (dd < 6) {
    const w = screenToWorld(a.x, a.y); let picked = null, pbest = 1e9;
    for (const u of G.units) { if (u.owner !== 0) continue; const p = project(u.x, u.y, u.def.flying ? 30 : 8), d = Math.hypot(p.x - a.x, p.y - a.y); if (d < u.def.r + 8 && d < pbest) { pbest = d; picked = u; } }
    if (!picked) { const bld = buildingAt(Math.floor(w.x / TILE), Math.floor(w.y / TILE)); if (bld && bld.owner === 0) picked = bld; }
    if (picked && !G.selected.includes(picked.id)) G.selected.push(picked.id);
  } else {
    const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    for (const u of G.units) {
      if (u.owner !== 0) continue;
      const p = project(u.x, u.y, u.def.flying ? 30 : 8);
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && !G.selected.includes(u.id)) G.selected.push(u.id);
    }
  }
  refreshSelInfo();
}

function rightClick(mx, my) {
  if (G.placing) { G.placing = null; return; }
  const w = screenToWorld(mx, my);
  const sel = selectedObjs();
  for (const b of sel.filter(s => s.kind === 'building')) b.rally = { x: w.x, y: w.y };
  const units = sel.filter(s => s.kind === 'unit' && s.owner === 0);
  if (!units.length) return;
  let enemy = null, ebest = 1e9;
  for (const u of G.units) {
    if (u.owner === 0 || u.cloaked || (G.fog && !visibleAt(u.x, u.y))) continue;
    const p = project(u.x, u.y, u.def.flying ? 30 : 8), d = Math.hypot(p.x - mx, p.y - my);
    if (d < u.def.r + 8 && d < ebest) { ebest = d; enemy = u; }
  }
  if (!enemy) { const bld = buildingAt(mouseTile.x, mouseTile.y); if (bld && bld.owner !== 0) enemy = bld; }
  if (enemy) { commandAttack(units, enemy); pingFx(w.x, w.y, '#ff6a6a'); return; }
  if (inMap(mouseTile.x, mouseTile.y) && G.map[mouseTile.y][mouseTile.x] === TERRAIN.ORE && units.some(u => u.def.harvester)) {
    commandHarvest(units.filter(u => u.def.harvester), mouseTile.x, mouseTile.y);
    commandMove(units.filter(u => !u.def.harvester), w.x, w.y, false);
  } else commandMove(units, w.x, w.y, G.attackMove);
  G.attackMove = false;
  pingFx(w.x, w.y, '#7dff9b');
}
function pingFx(x, y, col) { for (let i = 0; i < 2; i++) G.fx.push({ kind: 'ping', x, y, t: 16 - i * 4, max: 16, col }); }
function selectedObjs() { return G.selected.map(i => getById(G.units, i) || getById(G.buildings, i)).filter(Boolean); }

function doPlace(mx, my) {
  const def = BUILDINGS[G.placing];
  const tx = mouseTile.x - (def.w >> 1), ty = mouseTile.y - (def.h >> 1);
  if (canPlace(G.placing, tx, ty, 0)) { placeBuilding(G.placing, tx, ty, 0, false); delete G.buildQueue[G.placing]; G.placing = null; }
  else flash('Cannot build there');
}

// minimap navigation
mini.addEventListener('mousedown', e => {
  if (!G) return;
  const r = mini.getBoundingClientRect();
  const fx = (e.clientX - r.left) / 200, fy = (e.clientY - r.top) / 200;
  cam.fx = clamp(fx * WORLD_W, 0, WORLD_W); cam.fy = clamp(fy * WORLD_H, 0, WORLD_H);
});

// keyboard
let capturingKey = null; // for keybind UI
window.addEventListener('keydown', e => {
  if (capturingKey) { e.preventDefault(); applyKeyCapture(e.key.toLowerCase()); return; }
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (!G || G.over) return;
  if (k === KEYS.deselect) { if (G.placing) G.placing = null; else G.selected = []; refreshSelInfo(); }
  else if (k === KEYS.stop) commandStop(selectedObjs().filter(s => s.kind === 'unit'));
  else if (k === KEYS.selectAll) { G.selected = G.units.filter(u => u.owner === 0 && u.def.wpn && !u.def.harvester).map(u => u.id); refreshSelInfo(); }
  else if (k === KEYS.attackMove) { G.attackMove = true; flash('Attack-Move: right-click destination'); }
  else if (k === KEYS.tabBuild) switchTab('build');
  else if (k === KEYS.tabUnits) switchTab('units');
  else if (k === 'p') G.paused = !G.paused;
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

function edgeScroll() {
  const sp = (SETTINGS.scrollSpeed || 16) * 1.4;
  let mvx = 0, mvy = 0;
  if (keys[KEYS.scrollLeft] || keys['arrowleft']) mvx -= sp;
  if (keys[KEYS.scrollRight] || keys['arrowright']) mvx += sp;
  if (keys[KEYS.scrollUp] || keys['arrowup']) mvy -= sp;
  if (keys[KEYS.scrollDown] || keys['arrowdown']) mvy += sp;
  if (SETTINGS.edgeScroll && mouseInCanvas) {
    if (edgeMouse.x < 24) mvx -= sp; else if (edgeMouse.x > canvas.width - 24) mvx += sp;
    if (edgeMouse.y < 24) mvy -= sp; else if (edgeMouse.y > canvas.height - 24) mvy += sp;
  }
  if (mvx || mvy) scrollByScreen(mvx, mvy);
}
let mouseInCanvas = false, edgeMouse = { x: 0, y: 0 };
canvas.addEventListener('mouseenter', () => mouseInCanvas = true);
canvas.addEventListener('mouseleave', () => mouseInCanvas = false);
canvas.addEventListener('mousemove', e => { edgeMouse = { x: e.offsetX, y: e.offsetY }; });

// ============================================================
//  HUD / SIDEBAR
// ============================================================
let flashTimer = 0;
function flash(msg) { const el = document.getElementById('status-msg'); if (el) { el.textContent = msg; flashTimer = 200; } }

function updateHUD() {
  const p = G.players[0];
  setText('credits', Math.floor(p.credits));
  setText('credits-cap', '/ ' + p.storageMax);
  const cb = document.getElementById('credits-box'); if (cb) cb.style.color = p.credits >= p.storageMax ? '#d8920f' : '';
  setText('power', p.power); setText('power-max', p.powerMax);
  const pb = document.getElementById('power-box'); if (pb) pb.style.color = hasPower(0) ? '' : '#ff7a6a';
  setText('unit-count', G.units.filter(u => u.owner === 0 && !u.def.harvester).length);
  if (flashTimer > 0) { flashTimer--; if (flashTimer === 0) setText('status-msg', G.cfg.objective || 'Destroy all enemy forces'); }
  updateCardStates();
  if (G.tick % 15 === 0) refreshSelInfo();
}
function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }

function buildSidebar() {
  const f = FACTIONS[G.cfg.playerFaction];
  const bl = document.getElementById('build-list'), ul = document.getElementById('unit-list');
  bl.innerHTML = ''; ul.innerHTML = '';
  const bkeys = [...CORE_BUILDINGS, ...f.defenses];
  for (const k of bkeys) bl.appendChild(makeCard(k, true));
  for (const k of ['harvester', 'engineer', ...f.units]) ul.appendChild(makeCard(k, false));
  setText('faction-name', f.name);
  document.getElementById('topbar').style.borderColor = f.color;
}
function makeCard(key, isB) {
  const def = isB ? BUILDINGS[key] : UNITS[key];
  const c = document.createElement('div');
  c.className = 'card'; c.dataset.key = key; c.dataset.b = isB;
  c.innerHTML = `<div class="glyph">${def.glyph}</div><div class="nm">${def.name}</div><div class="cost">⛁${def.cost}</div><div class="badge"></div><div class="prog"></div>`;
  c.onmouseenter = () => showTooltip(def, isB);
  c.onmouseleave = hideTooltip;
  c.onclick = () => startProduction(key, isB);
  return c;
}
function updateCardStates() {
  document.querySelectorAll('.card').forEach(card => {
    const key = card.dataset.key, isB = card.dataset.b === 'true';
    const def = isB ? BUILDINGS[key] : UNITS[key];
    const q = G.buildQueue[key];
    const able = buildableNow(0, key, isB);
    const afford = G.players[0].credits >= def.cost;
    card.classList.toggle('locked', !able);
    card.classList.toggle('poor', able && !afford && !q);
    card.classList.toggle('active', G.placing === key);
    const prog = card.querySelector('.prog'), badge = card.querySelector('.badge');
    if (q) {
      prog.style.width = Math.min(100, q.progress / q.total * 100) + '%';
      prog.classList.toggle('ready', q.ready);
      badge.textContent = q.ready ? (isB ? 'PLACE' : '') : (q.count > 1 ? '×' + q.count : Math.ceil((q.total - q.progress) / 60) + 's');
    } else { prog.style.width = '0'; prog.classList.remove('ready'); badge.textContent = ''; }
  });
}

let tipEl;
function showTooltip(def, isB) {
  if (!tipEl) { tipEl = document.getElementById('tooltip'); }
  let html = `<b>${def.name}</b> <span class="tcost">⛁${def.cost}</span>`;
  if (isB) {
    if (def.role === 'power') html += `<br>Supplies +${def.power} power`;
    else if (def.role === 'defense') html += `<br>Auto-defense · DMG ${def.damage} · RNG ${def.range}`;
    else if (def.role === 'silo') html += `<br>+${def.storage} credit storage`;
    else if (def.role === 'depot') html += `<br>Repairs nearby vehicles`;
    else if (def.role === 'refinery') html += `<br>Processes ore · +${def.storage} storage`;
    else if (def.needs) html += `<br>Requires: ${def.needs.map(n => BUILDINGS[n].name).join(', ')}`;
    html += `<br>HP ${def.hp} · Power ${def.power >= 0 ? '+' : ''}${def.power}`;
    if (def.needs && def.role !== 'silo' && def.role !== 'depot' && def.role !== 'refinery') html += `<br><span style="opacity:.7">Needs ${def.needs.map(n => BUILDINGS[n].name).join(', ')}</span>`;
  } else {
    html += `<br>HP ${def.hp} · ${def.armor.toUpperCase()} armor`;
    if (def.wpn) html += `<br>DMG ${def.wpn.damage} · RNG ${def.wpn.range}${def.wpn.splash ? ' · splash' : ''}`;
    if (def.harvester) html += `<br>Mines ore for credits`;
    if (def.engineer) html += `<br>Support unit`;
    if (def.flying) html += `<br>✈ Flying`;
    if (def.stealth) html += `<br>👁 Cloaks when idle`;
    if (def.needs) html += `<br>Requires: ${def.needs.map(n => BUILDINGS[n].name).join(', ')}`;
  }
  tipEl.innerHTML = html; tipEl.classList.remove('hidden');
}
function hideTooltip() { if (tipEl) tipEl.classList.add('hidden'); }

function refreshSelInfo() {
  const el = document.getElementById('sel-info'); if (!el) return;
  const sel = selectedObjs();
  if (!sel.length) { el.innerHTML = '<span class="hint">Drag to select · Right-click to command · Q select army · F attack-move · X stop</span>'; return; }
  if (sel.length === 1) {
    const s = sel[0]; let x = '';
    if (s.def.harvester) x = `<br>Cargo <b>${Math.floor(s.cargo)}</b>/${HARV_CAP}`;
    else if (s.def.wpn) x = `<br>DMG <b>${s.def.wpn.damage}</b> · RNG <b>${s.def.wpn.range}</b>${s.vet ? ' · ' + ['','Veteran','Elite'][s.vet] : ''}`;
    if (s.kind === 'building' && (s.def.role === 'barracks' || s.def.role === 'factory' || s.def.role === 'refinery')) x += `<br><span class="hint">Right-click to set rally</span>`;
    el.innerHTML = `<div class="si-name">${s.def.glyph} <b>${s.def.name}</b></div>HP <b>${Math.ceil(s.hp)}</b>/${s.maxHp}${x}`;
  } else {
    const counts = {}; for (const s of sel) counts[s.def.name] = (counts[s.def.name] || 0) + 1;
    el.innerHTML = `<div class="si-name"><b>${sel.length} selected</b></div>` + Object.entries(counts).map(([n, c]) => `${c}× ${n}`).join('<br>');
  }
}

function switchTab(which) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === which));
  document.getElementById('build-list').classList.toggle('hidden', which !== 'build');
  document.getElementById('unit-list').classList.toggle('hidden', which !== 'units');
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => switchTab(t.dataset.tab));
