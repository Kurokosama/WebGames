/* ============================================================
   CRIMSON TIDE — game data: factions, units, buildings, campaign
   ============================================================ */
'use strict';

const TILE = 36;
const MAP_W = 160, MAP_H = 160;
const WORLD_W = MAP_W * TILE, WORLD_H = MAP_H * TILE;
const TERRAIN = { GRASS: 0, ROCK: 1, ORE: 2, WATER: 3, SAND: 4, MOUNTAIN: 5, FOREST: 6, DIRT: 7, SNOW: 8 };
// terrain that blocks ground movement / building
const BLOCKING = { 1: true, 3: true, 5: true, 6: true };   // rock, water, mountain, forest
const BUILDABLE = { 0: true, 4: true, 7: true, 8: true };  // grass, sand, dirt, snow
const VISION_BLOCK = { 5: true };                          // mountains block line of sight
const ELEV_STEP = 9;                                        // px height per elevation level
const ELEV_MAX = 5;
const HIGH_GROUND = 1.25;                                   // range/damage bonus shooting downhill
const FOREST_COVER = 0.65;                                  // damage taken multiplier inside forest
// movement domains (air crosses all):
//   vehicles  -> open land only
//   infantry  -> open land + forest + can SWIM across water (slowly)
//   bridges   -> any ground unit may cross water
//   water/mountain/rock block vehicles
const SWIM_SPEED = 0.5;                                     // speed multiplier while swimming
const SNOW_SPEED = 0.85;                                    // slight slow trudging through snow
const BRIDGE_H = 8;                                         // deck height above water
const ORE_VALUE = 25, HARV_CAP = 700;

// ---------- Factions ----------
const FACTIONS = {
  allies: {
    name: 'Allied Coalition', short: 'Allies', color: '#4f9dff', accent: '#9fd0ff',
    desc: 'Versatile and high-tech. Prism weaponry and stealth tanks.',
    power: 'power', defenses: ['pillbox', 'prism'],
    units: ['gi', 'rocketeer', 'grizzly', 'mirage', 'prismtank', 'nighthawk'],
  },
  soviet: {
    name: 'Soviet Union', short: 'Soviet', color: '#ff5b5b', accent: '#ff9d7a',
    desc: 'Heavy armor and brute force. Tesla tech and Apocalypse tanks.',
    power: 'power', defenses: ['sentry', 'tesla'],
    units: ['conscript', 'flaktrooper', 'rhino', 'v3', 'apocalypse', 'kirov'],
  },
  empire: {
    name: 'Rising Sun', short: 'Empire', color: '#ffce4a', accent: '#fff0a8',
    desc: 'Agile transforming tech. Wave-force weapons and fast mechs.',
    power: 'power', defenses: ['turret', 'waveforce'],
    units: ['warrior', 'tankbuster', 'tsunami', 'artillery', 'kingoni', 'jet'],
  },
  syndicate: {
    name: 'Black Sun Syndicate', short: 'Syndicate', color: '#2fd0b0', accent: '#9ff0e0',
    desc: 'Mercenary hover-tech. Fast skimmers, rail weapons and gunships.',
    power: 'power', defenses: ['autogun', 'railcannon'],
    units: ['merc', 'saboteur', 'hovertank', 'railtank', 'juggernaut', 'vulture'],
  },
  frostborn: {
    name: 'Frostborn Clans', short: 'Frostborn', color: '#7fd0ff', accent: '#d6f0ff',
    desc: 'Heavy cold-war armor. Cryo weapons that chill and shatter.',
    power: 'power', defenses: ['iceturret', 'cryotower'],
    units: ['raider', 'cryotrooper', 'frosttank', 'avalanche', 'glacier', 'frostwing'],
  },
};

// shared buildings every faction can build
const CORE_BUILDINGS = ['power', 'refinery', 'silo', 'barracks', 'factory', 'depot', 'lab'];

// ---------- Buildings ----------
// role: yard|power|refinery|barracks|factory|lab|defense
const BUILDINGS = {
  yard:    { name: 'Construction Yard', role: 'yard', glyph: '🏛', cost: 0, w: 3, h: 3, hp: 2000, power: 0, build: 0, sight: 8, height: 22, storage: 10000 },
  power:   { name: 'Power Plant',  role: 'power',    glyph: '⚡', cost: 400,  w: 2, h: 2, hp: 700,  power: 150, build: 5,  sight: 5, height: 18 },
  refinery:{ name: 'Ore Refinery', role: 'refinery', glyph: '⛁', cost: 2000, w: 3, h: 3, hp: 1100, power: -40, build: 14, sight: 6, height: 16, needs: ['power'], storage: 2000 },
  silo:    { name: 'Ore Silo',     role: 'silo',     glyph: '🛢', cost: 600,  w: 2, h: 2, hp: 600,  power: -10, build: 6,  sight: 4, height: 16, needs: ['refinery'], storage: 4000 },
  barracks:{ name: 'Barracks',     role: 'barracks', glyph: '🪖', cost: 600,  w: 2, h: 2, hp: 900,  power: -20, build: 7,  sight: 5, height: 14, needs: ['power'] },
  factory: { name: 'War Factory',  role: 'factory',  glyph: '🏭', cost: 2200, w: 3, h: 3, hp: 1200, power: -50, build: 18, sight: 5, height: 20, needs: ['refinery'] },
  depot:   { name: 'Service Depot', role: 'depot',   glyph: '🔧', cost: 900,  w: 3, h: 2, hp: 950,  power: -25, build: 9,  sight: 5, height: 12, needs: ['factory'], repair: true },
  lab:     { name: 'Tech Lab',     role: 'lab',      glyph: '🔬', cost: 1800, w: 2, h: 2, hp: 700,  power: -60, build: 16, sight: 6, height: 22, needs: ['factory'] },

  // Allied defenses
  pillbox: { name: 'Pillbox',      role: 'defense', faction: 'allies', glyph: '🛡', cost: 500, w: 1, h: 1, hp: 600, power: -10, build: 5, sight: 6, height: 10,
             needs: ['power'], range: 6, damage: 16, rof: 22, vs: { inf: 1.5, veh: 0.7, air: 0, bldg: 0.5 }, weapon: 'bullet' },
  prism:   { name: 'Prism Tower',  role: 'defense', faction: 'allies', glyph: '🔆', cost: 1500, w: 1, h: 1, hp: 700, power: -40, build: 12, sight: 8, height: 26,
             needs: ['lab'], range: 8, damage: 40, rof: 50, vs: { inf: 1, veh: 1.2, air: 0, bldg: 1.4 }, weapon: 'prism' },
  // Soviet defenses
  sentry:  { name: 'Sentry Gun',   role: 'defense', faction: 'soviet', glyph: '🔫', cost: 500, w: 1, h: 1, hp: 600, power: -10, build: 5, sight: 6, height: 10,
             needs: ['power'], range: 6, damage: 14, rof: 14, vs: { inf: 1.4, veh: 0.8, air: 0, bldg: 0.5 }, weapon: 'bullet' },
  tesla:   { name: 'Tesla Coil',   role: 'defense', faction: 'soviet', glyph: '⚡', cost: 1500, w: 1, h: 1, hp: 750, power: -50, build: 12, sight: 8, height: 28,
             needs: ['lab'], range: 7, damage: 55, rof: 46, vs: { inf: 1.2, veh: 1.4, air: 0, bldg: 1 }, weapon: 'tesla' },
  // Empire defenses
  turret:  { name: 'Defender VX',  role: 'defense', faction: 'empire', glyph: '🗼', cost: 500, w: 1, h: 1, hp: 600, power: -10, build: 5, sight: 7, height: 12,
             needs: ['power'], range: 7, damage: 15, rof: 16, vs: { inf: 1.2, veh: 1, air: 1.4, bldg: 0.5 }, weapon: 'missile' },
  waveforce:{ name: 'Wave-Force Tower', role: 'defense', faction: 'empire', glyph: '🌊', cost: 1600, w: 1, h: 1, hp: 700, power: -45, build: 13, sight: 8, height: 26,
             needs: ['lab'], range: 8, damage: 48, rof: 55, vs: { inf: 1.3, veh: 1.3, air: 0, bldg: 1.3 }, splash: 1.4, weapon: 'wave' },
  // Syndicate defenses
  autogun: { name: 'Auto-Gun', role: 'defense', faction: 'syndicate', glyph: '🔫', cost: 550, w: 1, h: 1, hp: 620, power: -10, build: 5, sight: 7, height: 11,
             needs: ['power'], range: 7, damage: 13, rof: 10, vs: { inf: 1.3, veh: 0.8, air: 1.2, bldg: 0.5 }, weapon: 'bullet' },
  railcannon:{ name: 'Rail Cannon', role: 'defense', faction: 'syndicate', glyph: '🎯', cost: 1600, w: 1, h: 1, hp: 720, power: -45, build: 12, sight: 9, height: 24,
             needs: ['lab'], range: 9, damage: 52, rof: 52, vs: { inf: 0.9, veh: 1.5, air: 0, bldg: 1.3 }, weapon: 'prism' },
  // Frostborn defenses
  iceturret:{ name: 'Ice Turret', role: 'defense', faction: 'frostborn', glyph: '❄', cost: 550, w: 1, h: 1, hp: 650, power: -10, build: 5, sight: 6, height: 11,
             needs: ['power'], range: 6, damage: 15, rof: 15, vs: { inf: 1.3, veh: 1, air: 0, bldg: 0.5 }, weapon: 'flak' },
  cryotower:{ name: 'Cryo Tower', role: 'defense', faction: 'frostborn', glyph: '🌨', cost: 1550, w: 1, h: 1, hp: 760, power: -48, build: 12, sight: 8, height: 26,
             needs: ['lab'], range: 8, damage: 50, rof: 50, vs: { inf: 1.2, veh: 1.4, air: 0, bldg: 1 }, splash: 1.2, weapon: 'wave' },
};

// ---------- Units ----------
// armor: inf|veh|air ; chassis controls how it's drawn
const UNITS = {
  // shared
  harvester:{ name: 'Ore Harvester', glyph: '🚜', cost: 1400, hp: 800, speed: 1.25, sight: 5, armor: 'veh', chassis: 'harvester', from: 'refinery', build: 10, r: 14, harvester: true, faction: 'all' },
  engineer: { name: 'Engineer', glyph: '🛠', cost: 500, hp: 120, speed: 1.5, sight: 5, armor: 'inf', chassis: 'infantry', from: 'barracks', build: 6, r: 8, engineer: true, faction: 'all' },

  // ---- Allies ----
  gi:        { name: 'GI', glyph: '🪖', cost: 200, hp: 130, speed: 1.7, sight: 6, armor: 'inf', chassis: 'infantry', from: 'barracks', build: 3, r: 8, faction: 'allies',
               wpn: { range: 5, damage: 11, rof: 12, splash: 0, vs: { inf: 1.4, veh: 0.5, air: 0, bldg: 0.4 }, type: 'bullet' } },
  rocketeer: { name: 'Rocketeer', glyph: '🚀', cost: 400, hp: 110, speed: 1.9, sight: 7, armor: 'inf', chassis: 'infantry', from: 'barracks', build: 5, r: 8, faction: 'allies',
               wpn: { range: 6, damage: 18, rof: 24, splash: 0, vs: { inf: 0.8, veh: 1.3, air: 1.5, bldg: 0.9 }, type: 'missile' } },
  grizzly:   { name: 'Grizzly Tank', glyph: '🚙', cost: 700, hp: 460, speed: 1.55, sight: 7, armor: 'veh', chassis: 'tank', from: 'factory', build: 8, r: 13, faction: 'allies',
               wpn: { range: 6, damage: 32, rof: 28, splash: 0.4, vs: { inf: 0.7, veh: 1.2, air: 0, bldg: 1 }, type: 'shell' } },
  mirage:    { name: 'Mirage Tank', glyph: '🌲', cost: 1100, hp: 420, speed: 1.6, sight: 8, armor: 'veh', chassis: 'tank', from: 'factory', build: 11, r: 13, faction: 'allies', stealth: true,
               wpn: { range: 7, damage: 40, rof: 30, splash: 0.3, vs: { inf: 0.8, veh: 1.4, air: 0, bldg: 0.9 }, type: 'shell' } },
  prismtank: { name: 'Prism Tank', glyph: '🔆', cost: 1400, hp: 380, speed: 1.5, sight: 9, armor: 'veh', chassis: 'tank', from: 'factory', build: 14, r: 13, faction: 'allies', needs: ['lab'],
               wpn: { range: 8, damage: 50, rof: 42, splash: 0.6, vs: { inf: 1, veh: 1.1, air: 0, bldg: 1.5 }, type: 'prism' } },
  nighthawk: { name: 'Nighthawk', glyph: '🚁', cost: 1200, hp: 300, speed: 2.6, sight: 9, armor: 'air', chassis: 'heli', from: 'lab', build: 13, r: 14, faction: 'allies', flying: true, needs: ['lab'],
               wpn: { range: 7, damage: 28, rof: 18, splash: 0.3, vs: { inf: 1.2, veh: 1.3, air: 1, bldg: 1 }, type: 'missile' } },

  // ---- Soviet ----
  conscript: { name: 'Conscript', glyph: '🪖', cost: 150, hp: 120, speed: 1.65, sight: 6, armor: 'inf', chassis: 'infantry', from: 'barracks', build: 3, r: 8, faction: 'soviet',
               wpn: { range: 4.5, damage: 12, rof: 11, splash: 0, vs: { inf: 1.4, veh: 0.5, air: 0, bldg: 0.5 }, type: 'bullet' } },
  flaktrooper:{ name: 'Flak Trooper', glyph: '💥', cost: 350, hp: 130, speed: 1.6, sight: 7, armor: 'inf', chassis: 'infantry', from: 'barracks', build: 5, r: 8, faction: 'soviet',
               wpn: { range: 6, damage: 16, rof: 16, splash: 0.4, vs: { inf: 1, veh: 0.9, air: 1.7, bldg: 0.6 }, type: 'flak' } },
  rhino:     { name: 'Rhino Tank', glyph: '🚙', cost: 800, hp: 560, speed: 1.4, sight: 6, armor: 'veh', chassis: 'tank', from: 'factory', build: 9, r: 14, faction: 'soviet',
               wpn: { range: 6, damage: 40, rof: 32, splash: 0.5, vs: { inf: 0.7, veh: 1.3, air: 0, bldg: 1.1 }, type: 'shell' } },
  v3:        { name: 'V3 Launcher', glyph: '🚀', cost: 900, hp: 240, speed: 1.3, sight: 7, armor: 'veh', chassis: 'artillery', from: 'factory', build: 11, r: 13, faction: 'soviet', artillery: true,
               wpn: { range: 11, damage: 70, rof: 70, splash: 1.8, vs: { inf: 1.2, veh: 1, air: 0, bldg: 1.3 }, type: 'arc', minRange: 3 } },
  apocalypse:{ name: 'Apocalypse', glyph: '🛡', cost: 1750, hp: 1000, speed: 1.0, sight: 7, armor: 'veh', chassis: 'tank', from: 'factory', build: 16, r: 16, faction: 'soviet', needs: ['lab'],
               wpn: { range: 6, damage: 60, rof: 36, splash: 0.7, vs: { inf: 0.8, veh: 1.5, air: 0, bldg: 1.3 }, type: 'shell', twin: true } },
  kirov:     { name: 'Kirov Airship', glyph: '🎈', cost: 2000, hp: 1400, speed: 0.7, sight: 8, armor: 'air', chassis: 'airship', from: 'lab', build: 20, r: 20, faction: 'soviet', flying: true, needs: ['lab'],
               wpn: { range: 4, damage: 120, rof: 60, splash: 2.0, vs: { inf: 1, veh: 1, air: 0, bldg: 2 }, type: 'bomb' } },

  // ---- Empire ----
  warrior:   { name: 'Imperial Warrior', glyph: '🥷', cost: 175, hp: 140, speed: 1.75, sight: 6, armor: 'inf', chassis: 'infantry', from: 'barracks', build: 3, r: 8, faction: 'empire',
               wpn: { range: 5, damage: 12, rof: 11, splash: 0, vs: { inf: 1.4, veh: 0.6, air: 0, bldg: 0.5 }, type: 'bullet' } },
  tankbuster:{ name: 'Tankbuster', glyph: '🔥', cost: 400, hp: 120, speed: 1.5, sight: 6, armor: 'inf', chassis: 'infantry', from: 'barracks', build: 5, r: 8, faction: 'empire',
               wpn: { range: 5, damage: 26, rof: 22, splash: 0, vs: { inf: 0.6, veh: 1.6, air: 0, bldg: 1.3 }, type: 'beam' } },
  tsunami:   { name: 'Tsunami Tank', glyph: '🚙', cost: 750, hp: 480, speed: 1.7, sight: 7, armor: 'veh', chassis: 'tank', from: 'factory', build: 8, r: 13, faction: 'empire',
               wpn: { range: 6, damage: 34, rof: 26, splash: 0.4, vs: { inf: 0.7, veh: 1.25, air: 0, bldg: 1 }, type: 'shell' } },
  artillery: { name: 'Wave Artillery', glyph: '🌊', cost: 950, hp: 230, speed: 1.4, sight: 8, armor: 'veh', chassis: 'artillery', from: 'factory', build: 11, r: 13, faction: 'empire', artillery: true,
               wpn: { range: 10, damage: 64, rof: 64, splash: 1.7, vs: { inf: 1.3, veh: 1, air: 0, bldg: 1.2 }, type: 'arc', minRange: 3 } },
  kingoni:   { name: 'King Oni', glyph: '👹', cost: 1700, hp: 950, speed: 1.25, sight: 7, armor: 'veh', chassis: 'mech', from: 'factory', build: 16, r: 16, faction: 'empire', needs: ['lab'],
               wpn: { range: 6, damage: 56, rof: 30, splash: 0.5, vs: { inf: 1, veh: 1.4, air: 0, bldg: 1.2 }, type: 'beam', twin: true } },
  jet:       { name: 'Jet Tengu', glyph: '✈', cost: 1100, hp: 260, speed: 3.0, sight: 9, armor: 'air', chassis: 'jet', from: 'lab', build: 12, r: 13, faction: 'empire', flying: true, needs: ['lab'],
               wpn: { range: 7, damage: 24, rof: 14, splash: 0.2, vs: { inf: 1.2, veh: 1.2, air: 1.3, bldg: 0.9 }, type: 'bullet' } },

  // ---- Syndicate (mercenary hover-tech) ----
  merc:      { name: 'Mercenary', glyph: '🔫', cost: 190, hp: 125, speed: 1.8, sight: 6, armor: 'inf', chassis: 'infantry', from: 'barracks', build: 3, r: 8, faction: 'syndicate',
               wpn: { range: 5, damage: 11, rof: 10, splash: 0, vs: { inf: 1.4, veh: 0.6, air: 0.4, bldg: 0.5 }, type: 'bullet' } },
  saboteur:  { name: 'Saboteur', glyph: '💣', cost: 420, hp: 110, speed: 1.7, sight: 6, armor: 'inf', chassis: 'infantry', from: 'barracks', build: 5, r: 8, faction: 'syndicate', stealth: true,
               wpn: { range: 4, damage: 30, rof: 24, splash: 0, vs: { inf: 0.6, veh: 1.2, air: 0, bldg: 1.8 }, type: 'beam' } },
  hovertank: { name: 'Hover Skimmer', glyph: '🛸', cost: 720, hp: 420, speed: 2.0, sight: 7, armor: 'veh', chassis: 'tank', from: 'factory', build: 8, r: 13, faction: 'syndicate',
               wpn: { range: 6, damage: 30, rof: 24, splash: 0.3, vs: { inf: 0.8, veh: 1.2, air: 0.8, bldg: 1 }, type: 'shell' } },
  railtank:  { name: 'Rail Skimmer', glyph: '⚡', cost: 1300, hp: 400, speed: 1.7, sight: 9, armor: 'veh', chassis: 'tank', from: 'factory', build: 13, r: 13, faction: 'syndicate', needs: ['lab'],
               wpn: { range: 9, damage: 52, rof: 44, splash: 0.2, vs: { inf: 0.9, veh: 1.5, air: 0, bldg: 1.3 }, type: 'prism' } },
  juggernaut:{ name: 'Juggernaut', glyph: '🦾', cost: 1800, hp: 1050, speed: 1.0, sight: 7, armor: 'veh', chassis: 'mech', from: 'factory', build: 16, r: 16, faction: 'syndicate', needs: ['lab'],
               wpn: { range: 7, damage: 58, rof: 34, splash: 0.6, vs: { inf: 0.9, veh: 1.4, air: 0, bldg: 1.4 }, type: 'beam', twin: true } },
  vulture:   { name: 'Vulture Gunship', glyph: '🚁', cost: 1150, hp: 290, speed: 2.7, sight: 9, armor: 'air', chassis: 'heli', from: 'lab', build: 12, r: 14, faction: 'syndicate', flying: true, needs: ['lab'],
               wpn: { range: 7, damage: 26, rof: 16, splash: 0.3, vs: { inf: 1.3, veh: 1.2, air: 1, bldg: 1 }, type: 'missile' } },

  // ---- Frostborn (cold-war heavy armor) ----
  raider:    { name: 'Clan Raider', glyph: '🪓', cost: 165, hp: 135, speed: 1.7, sight: 6, armor: 'inf', chassis: 'infantry', from: 'barracks', build: 3, r: 8, faction: 'frostborn',
               wpn: { range: 5, damage: 12, rof: 12, splash: 0, vs: { inf: 1.4, veh: 0.5, air: 0, bldg: 0.5 }, type: 'bullet' } },
  cryotrooper:{ name: 'Cryo Trooper', glyph: '❄️', cost: 360, hp: 130, speed: 1.55, sight: 6, armor: 'inf', chassis: 'infantry', from: 'barracks', build: 5, r: 8, faction: 'frostborn',
               wpn: { range: 5, damage: 22, rof: 20, splash: 0.3, vs: { inf: 0.8, veh: 1.5, air: 0, bldg: 0.9 }, type: 'flak' } },
  frosttank: { name: 'Frost Tank', glyph: '🚙', cost: 780, hp: 540, speed: 1.35, sight: 6, armor: 'veh', chassis: 'tank', from: 'factory', build: 9, r: 14, faction: 'frostborn',
               wpn: { range: 6, damage: 38, rof: 30, splash: 0.5, vs: { inf: 0.7, veh: 1.3, air: 0, bldg: 1.1 }, type: 'shell' } },
  avalanche: { name: 'Avalanche', glyph: '🏔', cost: 950, hp: 240, speed: 1.3, sight: 8, armor: 'veh', chassis: 'artillery', from: 'factory', build: 12, r: 13, faction: 'frostborn', artillery: true,
               wpn: { range: 11, damage: 66, rof: 66, splash: 1.8, vs: { inf: 1.2, veh: 1, air: 0, bldg: 1.3 }, type: 'arc', minRange: 3 } },
  glacier:   { name: 'Glacier Crawler', glyph: '🧊', cost: 1800, hp: 1080, speed: 0.95, sight: 7, armor: 'veh', chassis: 'tank', from: 'factory', build: 17, r: 16, faction: 'frostborn', needs: ['lab'],
               wpn: { range: 6, damage: 62, rof: 36, splash: 0.7, vs: { inf: 0.8, veh: 1.5, air: 0, bldg: 1.3 }, type: 'shell', twin: true } },
  frostwing: { name: 'Frostwing', glyph: '🦅', cost: 1150, hp: 280, speed: 2.7, sight: 9, armor: 'air', chassis: 'jet', from: 'lab', build: 12, r: 13, faction: 'frostborn', flying: true, needs: ['lab'],
               wpn: { range: 7, damage: 25, rof: 15, splash: 0.2, vs: { inf: 1.2, veh: 1.2, air: 1.4, bldg: 0.9 }, type: 'flak' } },
};

// ---------- Difficulty ----------
const DIFFICULTY = {
  easy:   { label: 'Easy',   aiBuild: 200, aiTrain: 320, aiIncome: 0.8, aiArmy: 6, startMul: 1.3, enemyMul: 0.8 },
  normal: { label: 'Normal', aiBuild: 130, aiTrain: 210, aiIncome: 1.0, aiArmy: 5, startMul: 1.0, enemyMul: 1.0 },
  hard:   { label: 'Hard',   aiBuild: 85,  aiTrain: 150, aiIncome: 1.35, aiArmy: 4, startMul: 0.85, enemyMul: 1.3 },
  brutal: { label: 'Brutal', aiBuild: 60,  aiTrain: 110, aiIncome: 1.7, aiArmy: 3, startMul: 0.75, enemyMul: 1.6 },
};

// ---------- Campaign ----------
const CAMPAIGN = [
  { id: 1, name: 'First Light', faction: 'allies', enemies: ['soviet'], difficulty: 'easy', startCredits: 6000,
    brief: 'A lone Soviet outpost guards the river valley. Establish a base, build an army, and wipe them out. Learn the ropes.' },
  { id: 2, name: 'Iron Curtain', faction: 'allies', enemies: ['soviet'], difficulty: 'normal', startCredits: 5500,
    brief: 'The Soviets have dug in with Tesla defenses. Tech up to Prism weaponry and break their line before they overrun you.' },
  { id: 3, name: 'Twin Suns', faction: 'soviet', enemies: ['empire'], difficulty: 'normal', startCredits: 5500,
    brief: 'Command the Soviet war machine. The Rising Sun fields fast tanks and aircraft — bring Flak and Apocalypse armor.' },
  { id: 4, name: 'Two Fronts', faction: 'soviet', enemies: ['allies', 'empire'], difficulty: 'hard', startCredits: 7000,
    brief: 'Caught between Allied prism tech and Imperial mechs. Two enemy bases want you gone. Hold, expand, and conquer both.' },
  { id: 5, name: 'Rising Tide', faction: 'empire', enemies: ['allies', 'soviet'], difficulty: 'hard', startCredits: 7500,
    brief: 'The Empire makes its final push. Outmaneuver two entrenched superpowers with King Oni and Jet Tengu. End the war.' },
  { id: 6, name: 'Last Stand', faction: 'empire', enemies: ['allies', 'soviet', 'soviet'], difficulty: 'brutal', startCredits: 9000,
    brief: 'Three enemy commanders converge on your position. There is no retreat. Crush them all and claim total victory.' },
  { id: 7, name: 'Cold Front', faction: 'allies', enemies: ['frostborn'], difficulty: 'hard', startCredits: 7000,
    brief: 'The Frostborn Clans have emerged from the north with cryo-armor that shrugs off small arms. Bring prism weaponry and break the ice.' },
  { id: 8, name: 'Black Sun Rising', faction: 'frostborn', enemies: ['syndicate', 'empire'], difficulty: 'brutal', startCredits: 9000,
    brief: 'Command the Frostborn. The Black Sun Syndicate fields hover-skimmers and gunships alongside Imperial mechs. Outlast their speed and bury them.' },
];

// ---------- Defaults ----------
const DEFAULT_SETTINGS = {
  difficulty: 'normal',
  fog: true,
  gameSpeed: 1,
  edgeScroll: true,
  scrollSpeed: 16,
  showHealthAlways: false,
  faction: 'allies',
};
const DEFAULT_KEYS = {
  scrollUp: 'w', scrollDown: 's', scrollLeft: 'a', scrollRight: 'd',
  stop: 'x', selectAll: 'q', attackMove: 'f', deselect: 'escape',
  tabBuild: '1', tabUnits: '2',
};
const KEY_LABELS = {
  scrollUp: 'Scroll Up', scrollDown: 'Scroll Down', scrollLeft: 'Scroll Left', scrollRight: 'Scroll Right',
  stop: 'Stop Units', selectAll: 'Select All Army', attackMove: 'Attack-Move', deselect: 'Deselect / Cancel',
  tabBuild: 'Build Tab', tabUnits: 'Units Tab',
};
