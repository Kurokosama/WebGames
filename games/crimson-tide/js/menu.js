/* ============================================================
   CRIMSON TIDE — menus, settings, campaign, flow, main loop
   ============================================================ */
'use strict';

const screens = {};
['home', 'skirmish', 'campaign', 'settings', 'keybinds', 'howto', 'briefing', 'result'].forEach(s => screens[s] = document.getElementById('screen-' + s));
let currentScreen = 'home';
let menuMode = true;
let campaignProgress = +(localStorage.getItem('ct_campaign') || 1);
let pendingMatch = null;

function showScreen(name) {
  for (const k in screens) screens[k].classList.toggle('hidden', k !== name);
  document.getElementById('menu-root').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  currentScreen = name; menuMode = true;
  if (name === 'campaign') renderCampaign();
  if (name === 'settings') renderSettings();
  if (name === 'keybinds') renderKeybinds();
  if (name === 'skirmish') renderSkirmish();
}
function enterGame() {
  document.getElementById('menu-root').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  menuMode = false;
}

// ---------- Home ----------
function buildHome() {
  document.getElementById('btn-skirmish').onclick = () => showScreen('skirmish');
  document.getElementById('btn-campaign').onclick = () => showScreen('campaign');
  document.getElementById('btn-settings').onclick = () => showScreen('settings');
  document.getElementById('btn-howto').onclick = () => showScreen('howto');
  document.querySelectorAll('.back-home').forEach(b => b.onclick = () => showScreen('home'));
}

// ---------- Skirmish ----------
let skState = { faction: 'allies', enemies: 1, difficulty: SETTINGS.difficulty, fog: SETTINGS.fog };
function renderSkirmish() {
  const fc = document.getElementById('sk-factions'); fc.innerHTML = '';
  for (const k in FACTIONS) {
    const f = FACTIONS[k];
    const d = document.createElement('div');
    d.className = 'fcard' + (skState.faction === k ? ' sel' : '');
    d.style.borderColor = f.color;
    d.innerHTML = `<div class="fc-name" style="color:${f.color}">${f.name}</div><div class="fc-desc">${f.desc}</div>
      <div class="fc-units">${f.units.map(u => UNITS[u].glyph).join(' ')}</div>`;
    d.onclick = () => { skState.faction = k; renderSkirmish(); };
    fc.appendChild(d);
  }
  renderChoice('sk-enemies', [['1', 1], ['2', 2], ['3', 3]], skState.enemies, v => { skState.enemies = v; renderSkirmish(); });
  renderChoice('sk-diff', Object.keys(DIFFICULTY).map(k => [DIFFICULTY[k].label, k]), skState.difficulty, v => { skState.difficulty = v; renderSkirmish(); });
  renderChoice('sk-fog', [['On', true], ['Off', false]], skState.fog, v => { skState.fog = v; renderSkirmish(); });
  document.getElementById('sk-start').onclick = startSkirmish;
}
function renderChoice(id, opts, cur, cb) {
  const el = document.getElementById(id); el.innerHTML = '';
  for (const [label, val] of opts) {
    const b = document.createElement('button');
    b.className = 'chip' + (val === cur ? ' sel' : '');
    b.textContent = label; b.onclick = () => cb(val);
    el.appendChild(b);
  }
}
function startSkirmish() {
  const enemyFactions = []; const pool = Object.keys(FACTIONS).filter(f => f !== skState.faction);
  for (let i = 0; i < skState.enemies; i++) enemyFactions.push(pool[i % pool.length]);
  enterGame();
  startMatch({ playerFaction: skState.faction, enemies: enemyFactions, difficulty: skState.difficulty,
    startCredits: Math.round(6000 * DIFFICULTY[skState.difficulty].startMul), enemyCredits: 5000, fog: skState.fog,
    campaign: false, objective: 'Skirmish — destroy all enemy forces' });
}

// ---------- Campaign ----------
function renderCampaign() {
  const list = document.getElementById('cmp-list'); list.innerHTML = '';
  CAMPAIGN.forEach(m => {
    const locked = m.id > campaignProgress;
    const done = m.id < campaignProgress;
    const d = document.createElement('div');
    d.className = 'mission' + (locked ? ' locked' : '');
    const f = FACTIONS[m.faction];
    d.innerHTML = `<div class="m-no">${locked ? '🔒' : done ? '✔' : '▶'}</div>
      <div class="m-main"><div class="m-name">Mission ${m.id}: ${m.name}</div>
      <div class="m-sub" style="color:${f.color}">${f.name} · vs ${m.enemies.map(e => FACTIONS[e].short).join(', ')} · ${DIFFICULTY[m.difficulty].label}</div></div>`;
    if (!locked) d.onclick = () => showBriefing(m);
    list.appendChild(d);
  });
}
function showBriefing(m) {
  pendingMatch = m;
  const f = FACTIONS[m.faction];
  document.getElementById('brief-title').textContent = `Mission ${m.id}: ${m.name}`;
  document.getElementById('brief-title').style.color = f.color;
  document.getElementById('brief-faction').textContent = `Commanding: ${f.name}`;
  document.getElementById('brief-text').textContent = m.brief;
  document.getElementById('brief-enemies').textContent = 'Hostiles: ' + m.enemies.map(e => FACTIONS[e].name).join(', ');
  showScreen('briefing');
}
function startCampaignMission() {
  const m = pendingMatch;
  enterGame();
  startMatch({ playerFaction: m.faction, enemies: m.enemies, difficulty: m.difficulty,
    startCredits: m.startCredits, enemyCredits: 5000, fog: SETTINGS.fog, campaign: true, missionId: m.id,
    objective: `Mission ${m.id}: destroy all hostile forces` });
}

// ---------- Settings ----------
function renderSettings() {
  renderChoice('set-diff', Object.keys(DIFFICULTY).map(k => [DIFFICULTY[k].label, k]), SETTINGS.difficulty, v => { SETTINGS.difficulty = v; saveSettings(); renderSettings(); });
  renderChoice('set-fog', [['On', true], ['Off', false]], SETTINGS.fog, v => { SETTINGS.fog = v; saveSettings(); renderSettings(); });
  renderChoice('set-speed', [['0.5×', 0.5], ['1×', 1], ['1.5×', 1.5], ['2×', 2]].map(([l, v]) => [l, v]), SETTINGS.gameSpeed, v => { SETTINGS.gameSpeed = v; saveSettings(); renderSettings(); });
  renderChoice('set-edge', [['On', true], ['Off', false]], SETTINGS.edgeScroll, v => { SETTINGS.edgeScroll = v; saveSettings(); renderSettings(); });
  renderChoice('set-scroll', [['Slow', 10], ['Normal', 16], ['Fast', 24]], SETTINGS.scrollSpeed, v => { SETTINGS.scrollSpeed = v; saveSettings(); renderSettings(); });
  renderChoice('set-hp', [['On', true], ['Off', false]], SETTINGS.showHealthAlways, v => { SETTINGS.showHealthAlways = v; saveSettings(); renderSettings(); });
  document.getElementById('btn-keybinds').onclick = () => showScreen('keybinds');
  document.getElementById('btn-reset-progress').onclick = () => { if (confirm('Reset campaign progress?')) { campaignProgress = 1; localStorage.setItem('ct_campaign', '1'); flash && 0; alert('Campaign progress reset.'); } };
}

// ---------- Keybinds ----------
function renderKeybinds() {
  const list = document.getElementById('kb-list'); list.innerHTML = '';
  for (const action in KEYS) {
    const row = document.createElement('div'); row.className = 'kb-row';
    row.innerHTML = `<span class="kb-label">${KEY_LABELS[action]}</span>`;
    const btn = document.createElement('button'); btn.className = 'kb-key'; btn.textContent = keyName(KEYS[action]);
    btn.onclick = () => { capturingKey = action; btn.textContent = '...press a key'; btn.classList.add('capturing'); };
    row.appendChild(btn); list.appendChild(row);
  }
  document.getElementById('kb-reset').onclick = () => { KEYS = Object.assign({}, DEFAULT_KEYS); saveKeys(); renderKeybinds(); };
}
function keyName(k) { return k === ' ' ? 'Space' : k === 'escape' ? 'Esc' : k.length === 1 ? k.toUpperCase() : k; }
function applyKeyCapture(k) {
  if (k === 'escape' && capturingKey !== 'deselect') { /* allow esc to set */ }
  // avoid duplicate: clear any other action using this key
  for (const a in KEYS) if (KEYS[a] === k && a !== capturingKey) KEYS[a] = '';
  KEYS[capturingKey] = k; capturingKey = null; saveKeys(); renderKeybinds();
}

// ---------- Result ----------
function onMatchEnd(won) {
  const isCampaign = G.cfg.campaign;
  let advanced = false;
  if (won && isCampaign && G.cfg.missionId === campaignProgress && campaignProgress < CAMPAIGN.length) {
    campaignProgress++; localStorage.setItem('ct_campaign', String(campaignProgress)); advanced = true;
  } else if (won && isCampaign && G.cfg.missionId >= CAMPAIGN.length) {
    if (campaignProgress <= CAMPAIGN.length) { campaignProgress = CAMPAIGN.length + 1; localStorage.setItem('ct_campaign', String(campaignProgress)); }
  }
  document.getElementById('res-title').textContent = won ? 'VICTORY' : 'DEFEAT';
  document.getElementById('res-title').className = won ? 'win' : 'lose';
  let msg = won ? 'All hostile forces eliminated. The battlefield is yours.' : 'Your forces have been wiped out.';
  if (won && isCampaign && advanced && campaignProgress <= CAMPAIGN.length) msg += ` Mission ${campaignProgress} unlocked.`;
  if (won && isCampaign && G.cfg.missionId >= CAMPAIGN.length) msg = 'Campaign complete, Commander. Total victory across every front!';
  document.getElementById('res-text').textContent = msg;
  const next = document.getElementById('res-next');
  next.classList.toggle('hidden', !(won && isCampaign && campaignProgress <= CAMPAIGN.length && G.cfg.missionId < CAMPAIGN.length));
  showScreen('result');
}
function setupResultButtons() {
  document.getElementById('res-retry').onclick = () => {
    if (G.cfg.campaign) { pendingMatch = CAMPAIGN[G.cfg.missionId - 1]; startCampaignMission(); }
    else startSkirmish();
  };
  document.getElementById('res-next').onclick = () => { pendingMatch = CAMPAIGN[campaignProgress - 1]; startCampaignMission(); };
  document.getElementById('res-menu').onclick = () => showScreen('home');
}

// ---------- in-game menu button ----------
function setupInGameButtons() {
  document.getElementById('btn-pause').onclick = () => { G.paused = !G.paused; document.getElementById('btn-pause').textContent = G.paused ? '▶' : '⏸'; };
  document.getElementById('btn-quit').onclick = () => { if (confirm('Abandon battle and return to menu?')) { G.running = false; G.over = true; showScreen('home'); } };
}

// ============================================================
//  MENU BACKGROUND ANIMATION
// ============================================================
const bgCanvas = document.getElementById('menu-bg');
const bgctx = bgCanvas.getContext('2d');
let bgParticles = [], bgBirds = [], bgDust = [], bgInit = false;
function initBg() {
  bgParticles = []; for (let i = 0; i < 7; i++) bgParticles.push({ x: Math.random(), y: rndf(0.05, 0.4), s: rndf(0.7, 1.6), v: rndf(0.00004, 0.00014) });
  bgBirds = []; for (let i = 0; i < 6; i++) bgBirds.push({ x: Math.random(), y: rndf(0.16, 0.42), s: rndf(0.5, 0.9), v: rndf(0.0005, 0.0013), p: Math.random() * 6 });
  bgDust = []; for (let i = 0; i < 46; i++) bgDust.push({ x: Math.random(), y: Math.random(), s: rndf(0.5, 1.7), vy: rndf(-0.00009, -0.00003), vx: rndf(-0.00006, 0.00006) });
  bgInit = true;
}
// drawing helpers (menu only)
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function shadeC(hex, amt) { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, v + amt)); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function tintC(hex, a) { const n = parseInt(hex.slice(1), 16); const f = v => Math.round(v + (255 - v) * a); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function cloud(c, x, y, s) { c.fillStyle = 'rgba(255,255,255,0.85)'; for (const [ox, oy, r] of [[0, 0, 34], [32, 7, 25], [-32, 8, 23], [12, -11, 22], [-12, -6, 20]]) { c.beginPath(); c.arc(x + ox * s, y + oy * s, r * s, 0, 7); c.fill(); } }
function ridgeLine(c, w, h, baseY, col, amp, n, seed, snow) {
  c.fillStyle = col; c.beginPath(); c.moveTo(0, h); c.lineTo(0, baseY);
  const pts = [];
  for (let i = 0; i <= n; i++) { const x = (i / n) * w, y = baseY - (0.5 + 0.5 * Math.sin(i * 1.7 + seed)) * amp - ((i % 2) ? amp * 0.35 : 0); pts.push([x, y]); c.lineTo(x, y); }
  c.lineTo(w, baseY); c.lineTo(w, h); c.closePath(); c.fill();
  if (snow) { c.fillStyle = 'rgba(255,255,255,0.75)'; for (const [x, y] of pts) { if (y < baseY - amp * 0.6) { c.beginPath(); c.moveTo(x, y); c.lineTo(x - amp * 0.18, y + amp * 0.28); c.lineTo(x + amp * 0.18, y + amp * 0.28); c.fill(); } } }
}
function isoGroundBlob(c, cx, cy, rw, rh, col) { c.fillStyle = col; c.beginPath(); c.ellipse(cx, cy, rw, rh, 0, 0, 7); c.fill(); }
function menuTank(c, x, y, s, col, ta, tp) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = 'rgba(20,40,20,0.22)'; c.beginPath(); c.ellipse(0, 6, 19, 8, 0, 0, 7); c.fill();
  c.fillStyle = '#333'; rr(c, -16, -7, 32, 17, 3); c.fill();
  c.fillStyle = '#1f1f1f'; for (let i = -14; i < 13; i += 5) c.fillRect(i + (tp % 5), -8, 2.5, 17);
  c.fillStyle = col; rr(c, -13, -10, 26, 19, 3); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.18)'; rr(c, -13, -10, 26, 8, 3); c.fill();
  c.save(); c.rotate(ta); c.fillStyle = shadeC(col, 18); c.beginPath(); c.arc(0, 0, 8, 0, 7); c.fill(); c.strokeStyle = shadeC(col, -40); c.lineWidth = 1; c.stroke(); c.fillStyle = '#222'; c.fillRect(0, -2, 22, 4); c.restore();
  c.restore();
}
function menuHarvester(c, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = 'rgba(20,40,20,0.22)'; c.beginPath(); c.ellipse(0, 7, 20, 8, 0, 0, 7); c.fill();
  c.fillStyle = '#333'; rr(c, -18, -6, 36, 17, 3); c.fill();
  c.fillStyle = '#d6a93a'; rr(c, -16, -12, 30, 22, 4); c.fill();
  c.fillStyle = shadeC('#d6a93a', 25); rr(c, -16, -12, 30, 8, 4); c.fill();
  c.fillStyle = col; c.beginPath(); c.arc(-9, -6, 3, 0, 7); c.fill();
  c.fillStyle = '#888'; c.beginPath(); c.moveTo(14, -8); c.lineTo(22, -4); c.lineTo(22, 6); c.lineTo(14, 9); c.fill();
  c.restore();
}
function menuBase(c, x, y, s, col, T) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = 'rgba(20,40,20,0.25)'; c.beginPath(); c.ellipse(6, 26, 52, 18, 0, 0, 7); c.fill();
  // iso pad
  c.fillStyle = '#d8d2c2'; c.beginPath(); c.moveTo(0, 30); c.lineTo(54, 4); c.lineTo(108, 30); c.lineTo(54, 56); c.fill();
  // walls
  c.fillStyle = '#cfc8b8'; c.beginPath(); c.moveTo(8, 26); c.lineTo(54, 0); c.lineTo(54, -34); c.lineTo(8, -8); c.fill();
  c.fillStyle = '#e2dccd'; c.beginPath(); c.moveTo(54, 0); c.lineTo(100, 26); c.lineTo(100, -8); c.lineTo(54, -34); c.fill();
  // roof
  c.fillStyle = '#f4efe4'; c.beginPath(); c.moveTo(8, -8); c.lineTo(54, -34); c.lineTo(100, -8); c.lineTo(54, 18); c.fill();
  c.fillStyle = tintC(col, 0.5); c.beginPath(); c.moveTo(20, -8); c.lineTo(54, -27); c.lineTo(88, -8); c.lineTo(54, 11); c.fill();
  // rotating radar
  const a = T * 0.0015; c.strokeStyle = '#7a8088'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(54, -2); c.lineTo(54, -22); c.stroke();
  c.save(); c.translate(54, -24); c.rotate(a); c.fillStyle = '#cfd6dd'; c.beginPath(); c.ellipse(8, 0, 8, 4, 0, 0, 7); c.fill(); c.restore();
  // waving flag
  c.strokeStyle = '#9a9a9a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(20, -8); c.lineTo(20, -40); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(20, -40);
  for (let i = 0; i <= 6; i++) { const f = i / 6; c.lineTo(20 + f * 22, -40 + Math.sin(T * 0.006 - i * 0.7) * 3 * f); }
  for (let i = 6; i >= 0; i--) { const f = i / 6; c.lineTo(20 + f * 22, -30 + Math.sin(T * 0.006 - i * 0.7) * 3 * f); }
  c.fill();
  c.restore();
}
function menuHeli(c, x, y, s, col, T) {
  const bob = Math.sin(T * 0.003) * 6;
  c.save(); c.translate(x, y + bob); c.scale(s, s);
  c.fillStyle = 'rgba(20,40,20,0.12)'; c.beginPath(); c.ellipse(0, 70 - bob, 22, 7, 0, 0, 7); c.fill();
  c.fillStyle = col; rr(c, -16, -8, 30, 16, 8); c.fill();
  c.fillStyle = '#bfe0f0'; c.beginPath(); c.arc(-12, 0, 7, 0, 7); c.fill();
  c.fillStyle = shadeC(col, -30); c.fillRect(12, -3, 22, 6);
  const ra = T * 0.04; c.strokeStyle = 'rgba(120,140,160,0.5)'; c.lineWidth = 2;
  for (const o of [0, 1.57, 3.14, 4.71]) { c.beginPath(); c.moveTo(0, -9); c.lineTo(Math.cos(ra + o) * 30, -9 + Math.sin(ra + o) * 8); c.stroke(); }
  c.restore();
}
function menuTree(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = 'rgba(20,40,20,0.2)'; c.beginPath(); c.ellipse(3, 4, 11, 4, 0, 0, 7); c.fill();
  c.strokeStyle = '#7a5436'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 4); c.lineTo(0, -14); c.stroke();
  for (const [r, col, oy] of [[18, '#357029', -14], [13, '#46893d', -20], [8, '#5aa34e', -26]]) { c.fillStyle = col; c.beginPath(); c.ellipse(0, oy, r, r * 0.85, 0, 0, 7); c.fill(); }
  c.restore();
}
function menuOre(c, x, y, s, T) {
  c.save(); c.translate(x, y); c.scale(s, s);
  for (let i = 0; i < 7; i++) { const ox = (i % 4) * 12 - 18, oy = ((i / 4) | 0) * 10 - 3, gl = 0.6 + 0.4 * Math.sin(T * 0.004 + i); c.fillStyle = `rgba(255,210,70,${gl})`; c.beginPath(); c.moveTo(ox, oy - 8); c.lineTo(ox - 4, oy); c.lineTo(ox, oy + 2); c.lineTo(ox + 4, oy); c.fill(); }
  c.restore();
}
function drawDiorama(c, w, h, T) {
  const gy = h * 0.84;
  c.save();
  // soft fade so it sits behind the UI
  c.globalAlpha = 0.92;
  // grassy ground band
  const gr = c.createLinearGradient(0, gy - 40, 0, h); gr.addColorStop(0, '#9ace74'); gr.addColorStop(1, '#7bb35a');
  c.fillStyle = gr; c.beginPath(); c.moveTo(0, h); c.lineTo(0, gy);
  for (let x = 0; x <= w; x += 50) c.lineTo(x, gy + Math.sin(x * 0.004 + 2) * 12);
  c.lineTo(w, h); c.closePath(); c.fill();
  // elements positioned across the band
  menuBase(c, w * 0.13, gy - 6, 1.0, '#4f9dff', T);
  menuTree(c, w * 0.30, gy + 6, 1.1); menuTree(c, w * 0.345, gy + 14, 0.85); menuTree(c, w * 0.74, gy + 10, 1.0);
  menuOre(c, w * 0.80, gy + 16, 1.0, T);
  // patrolling tanks
  const t1 = w * 0.44 + Math.sin(T * 0.00018) * w * 0.06;
  menuTank(c, t1, gy + 8, 1.0, '#4f9dff', Math.sin(T * 0.0006) * 0.8, T * 0.05);
  const t2 = w * 0.60 + Math.sin(T * 0.00022 + 2) * w * 0.05;
  menuTank(c, t2, gy + 18, 1.05, '#ff5b5b', 2.4 + Math.sin(T * 0.0005) * 0.6, T * 0.06);
  // harvester trundling to the ore
  menuHarvester(c, w * 0.70 + Math.sin(T * 0.0002) * w * 0.03, gy + 22, 0.95, '#e0a020');
  // hovering helicopter
  menuHeli(c, w * 0.52, gy - 90, 1.1, '#ff5b5b', T);
  c.restore();
}
function drawBg() {
  bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight;
  const w = bgCanvas.width, h = bgCanvas.height, c = bgctx, T = Date.now();
  if (!bgInit) initBg();
  // sky
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#a4daf2'); g.addColorStop(0.42, '#cdecd2'); g.addColorStop(0.72, '#c2e3a6'); g.addColorStop(1, '#a6d47f');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // sun + rotating rays
  const sx = w * 0.83, sy = h * 0.19;
  const sun = c.createRadialGradient(sx, sy, 8, sx, sy, 340);
  sun.addColorStop(0, 'rgba(255,250,210,0.95)'); sun.addColorStop(0.5, 'rgba(255,245,190,0.28)'); sun.addColorStop(1, 'rgba(255,245,190,0)');
  c.fillStyle = sun; c.fillRect(0, 0, w, h);
  c.save(); c.translate(sx, sy); c.rotate(T * 0.00003); c.globalAlpha = 0.09; c.fillStyle = '#fff7d0';
  for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(460, 46); c.lineTo(460, -46); c.fill(); }
  c.restore();
  c.fillStyle = '#fffbe6'; c.beginPath(); c.arc(sx, sy, 44, 0, 7); c.fill();
  // parallax mountain ranges
  ridgeLine(c, w, h, h * 0.5, '#a7c0cf', 130, 9, 0.5, true);
  ridgeLine(c, w, h, h * 0.58, '#9ab9a6', 100, 11, 2.3, false);
  // rolling hills
  c.fillStyle = 'rgba(120,180,95,0.6)'; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 40) c.lineTo(x, h * 0.68 + Math.sin(x * 0.004 + 1) * 26); c.lineTo(w, h); c.closePath(); c.fill();
  c.fillStyle = 'rgba(96,165,78,0.7)'; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 40) c.lineTo(x, h * 0.76 + Math.sin(x * 0.005 + 3) * 20); c.lineTo(w, h); c.closePath(); c.fill();
  // clouds
  for (const p of bgParticles) { p.x += p.v; if (p.x > 1.25) p.x = -0.25; cloud(c, p.x * w, p.y * h, p.s); }
  // birds
  c.strokeStyle = 'rgba(50,70,80,0.5)'; c.lineWidth = 2;
  for (const b of bgBirds) { b.x += b.v; if (b.x > 1.2) b.x = -0.2; const bx = b.x * w, by = b.y * h + Math.sin(T * 0.002 + b.p) * 8, fl = Math.sin(T * 0.012 + b.p) * 5 + 6; c.beginPath(); c.moveTo(bx - 9 * b.s, by); c.quadraticCurveTo(bx, by - fl * b.s, bx, by - 2 * b.s); c.quadraticCurveTo(bx, by - fl * b.s, bx + 9 * b.s, by); c.stroke(); }
  // foreground battlefield diorama
  drawDiorama(c, w, h, T);
  // floating dust motes
  for (const d of bgDust) { d.x += d.vx; d.y += d.vy; if (d.y < 0) { d.y = 1; d.x = Math.random(); } c.fillStyle = `rgba(255,255,255,${0.16 * d.s})`; c.beginPath(); c.arc(d.x * w, d.y * h, d.s * 1.4, 0, 7); c.fill(); }
}

// ============================================================
//  MAIN LOOP — fixed-timestep sim, decoupled rendering
//  A Web Worker drives the clock so the simulation keeps running
//  smoothly even when the browser tab is hidden / unfocused.
// ============================================================
const SIM_STEP = 1000 / 60;          // ms per logic tick
let simLast = performance.now(), simAcc = 0;
function advanceSim(now) {
  let dt = now - simLast; simLast = now;
  if (dt < 0) dt = 0; else if (dt > 250) dt = 250;   // clamp after long stalls
  if (menuMode || !G || !G.running || G.over || G.paused) return;
  simAcc += dt * (SETTINGS.gameSpeed || 1);
  let steps = 0;
  while (simAcc >= SIM_STEP && steps < 8) { stepSim(); simAcc -= SIM_STEP; steps++; }
  if (simAcc > SIM_STEP * 8) simAcc = 0;              // drop backlog
}

// background ticker — worker setInterval is not throttled in hidden tabs
let tickWorker = null;
try {
  const blob = new Blob(['setInterval(function(){postMessage(0);},16);'], { type: 'text/javascript' });
  tickWorker = new Worker(URL.createObjectURL(blob));
  tickWorker.onmessage = () => advanceSim(performance.now());
} catch (e) { setInterval(() => advanceSim(performance.now()), 16); }

// render as fast as the display allows (only when visible)
function frame() {
  advanceSim(performance.now());
  if (menuMode) drawBg(); else if (G) render();
  requestAnimationFrame(frame);
}
const loop = frame;

// ============================================================
//  BOOT
// ============================================================
buildHome();
setupResultButtons();
setupInGameButtons();
document.getElementById('brief-start').onclick = startCampaignMission;
document.getElementById('brief-back').onclick = () => showScreen('campaign');
initBg();
showScreen('home');
loop();
