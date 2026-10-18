(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function segmentDistance(x, y, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
  }
  const { enemies: ENEMIES, upgrades: UPGRADES, heroes: CHARACTERS, permanents: META, extraWeapons: EXTRA_WEAPONS, evolutions: EVOLUTIONS } = root.NightCatalog || require('./catalog.js');
  const EVOLUTION_BY_WEAPON = Object.fromEntries(EVOLUTIONS.map(e => [e.weapon, e]));
  const CASTS = { lightning: ['castLightning', 2.4], boomerang: ['castBoomerang', 1.7], frost: ['castFrost', 4.2], meteor: ['castMeteor', 3.2] };
  const SLOTS = ['needle', 'blades', 'pulse', 'lightning', 'boomerang', 'frost', 'meteor', 'poison', ...EXTRA_WEAPONS.map(w => w.id)];
  const BALLISTICS = Object.fromEntries(EXTRA_WEAPONS.filter(w => w.projectile).map(w => [w.id, w.projectile]));
  const WEAPON_DAMAGE = Object.fromEntries(UPGRADES.filter(u => u.weapon).map(u => [u.id, u.damageMultiplier]));
  const WORLD = Object.freeze({ width: 12800, height: 9600 });
  const BALANCE = Object.freeze({ xpDropChance: .5, heartDropChance: .00875, bossHeartDropChance: .25, xpDecay: .08, goldMultiplier: .45, weaponCooldown: .85, dashCooldown: .6, arenaSeconds: 15, arenaBossHealth: 1.25, arenaBossDamage: .75, arenaSummonLimit: 4, firstBossHealth: .25, firstBossDamage: .65, firstBossSkill: 3.5, firstBossMinions: 2 });
  const BOSSES = ['lichLord', 'british', 'freddy', 'jason', 'alienQueen', 'reaper'];
  const EnemySystem = root.NightEnemySystem || require('./enemy-system.js');
  const Combat = root.NightCombat || require('./combat.js');
  const ROSTER_BOSSES = Object.entries(ENEMIES).filter(([, e]) => e.roster && e.boss).sort((a, b) => a[1].at - b[1].at).map(([id]) => id);
  const TERRAIN_TYPES = [
    { kind: 'grave', w: 46, h: 46, sprite: ' ._.\n |+|\n_|_|_', ink: 1 },
    { kind: 'rock', w: 60, h: 42, sprite: ' .--.\n/####\\\n\\____/', ink: 1 },
    { kind: 'tree', w: 46, h: 58, sprite: ' \\|/\n--Y--\n  |\n /|\\', ink: 3 },
    { kind: 'crypt', w: 76, h: 54, sprite: ' _____\n|[_+_]|\n|_|||_|', ink: 1 },
    { kind: 'wall', w: 84, h: 30, sprite: '[]===[]\n[]===[]', ink: 1 }
  ];
  const FOREST_TYPES = [
    {kind:'pine',w:44,h:58,sprite:'  /\\\n /**\\\n/****\\\n  ||',ink:17},
    {kind:'oak',w:64,h:58,sprite:' .oo.\n(oOOo)\n \\||/\n  ||',ink:17},
    {kind:'stump',w:32,h:28,sprite:' _ _\n|o_o|',ink:18},
    {kind:'boulder',w:60,h:42,sprite:' .--.\n/::::\\\n\\____/',ink:1}
  ];
  function forestGround(x,y,width,height){
    const dx=((x-width/2+1600)%3200+3200)%3200-1600,dy=((y-height/2+1200)%2400+2400)%2400-1200;
    if(Math.abs(dx)<46||Math.abs(dy)<42||dx>=0&&dx<700&&Math.abs(dy-520)<32)return 'path';
    if(((dx-940)/190)**2+((dy+600)/110)**2<1||((dx-1150)/95)**2+((dy+300)/60)**2<1)return 'water';
    if(Math.abs(dx-700)<180&&Math.abs(dy-520)<120&&(Math.abs(dx-700)>145||Math.abs(dy-520)>90))return 'flowers';
    return 'grass';
  }
  function terrainHash(x, y) {
    let value = Math.imul(x ^ 0x64ab, 374761393) ^ Math.imul(y ^ 0xf8c, 668265263);
    value = Math.imul(value ^ value >>> 13, 1274126177); return (value ^ value >>> 16) >>> 0;
  }
  function makeTerrain(width, height, mapId) {
    const cols = Math.ceil(width / 400), rows = Math.ceil(height / 320), cells = new Array(cols * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const value = terrainHash(x, y); if (value % 4 === 0) continue;
      const types=mapId==='forest'?FOREST_TYPES:TERRAIN_TYPES;
      const type=mapId==='forest'?[0,1,0,1,2,3][(value>>>5)%6]:value%types.length;
      const block = { ...types[type], x: x * 400 + 120 + value % 160, y: y * 320 + 100 + (value >>> 10) % 120 };
      if(mapId==='forest'&&forestGround(block.x,block.y,width,height)!=='grass')continue;
      if (Math.hypot(block.x - width / 2, block.y - height / 2) < 300) continue;
      cells[y * cols + x] = block;
    }
    return { cols, rows, cells };
  }

  class NightGame {
    constructor(seed = Date.now(), characterId = 'hunter', options = {}) {
      this.seed = seed >>> 0 || 1;
      this.randomState = this.seed;
      this.width = WORLD.width; this.height = WORLD.height; this.duration = Infinity;
      this.map=(root.NightCatalog||require('./catalog.js')).stages.find(s=>s.id===options.map)|| (root.NightCatalog||require('./catalog.js')).stages[0];this.mapId=this.map.id;
      this.sandboxMode=Boolean(options.sandboxMode);
      this.terrainEnabled = options.terrain !== false && !this.sandboxMode; this.terrain = makeTerrain(this.width, this.height,this.mapId);
      this.encounter = null; this.arenaRadius = 205; this.chests = []; this.reward = null; this.chestsOpened = 0; this.nextChestId = 1;
      this.wallTime = 0; this.pressureOffset = 0; this.steps = 0;
      this.combat = new Combat();
      this.stressMode = Boolean(options.stressMode || this.sandboxMode);
      this.meta = Object.fromEntries(META.map(u => [u.id, this.sandboxMode ? 0 : clamp(Math.floor(Number(options.meta?.[u.id]) || 0), 0, u.max)]));
      this.goldEarned = 0; this.goldCarry = 0; this.xpCarry = 0; this.revivesUsed = 0;
      this.evolutions = new Set(); this.clockStep = 0;
      this.weaponOrder = []; this.passiveOrder = []; this.legacyInventory = false; this.rosterBossIndex = 0;
      this.treasuresTaken = new Set(); this.treasures = [];
      for (let i = 0; i < 12; i++) { const hash = terrainHash(i + this.seed % 10000, 37); const cache = { id: i, x: 600 + hash % (this.width - 1200), y: 600 + (hash >>> 12) % (this.height - 1200), radius: 20 }; this.resolveTerrain(cache); this.treasures.push(cache); }
      this.supplyTaken = new Set(); this.supplyCrates = [];
      if (!this.stressMode) for (let i = 0; i < 48; i++) {
        const hash = terrainHash(this.seed ^ i, 83), other = terrainHash(this.seed ^ i, 97), roll = hash % 10;
        const kind = roll < 5 ? 'heal' : roll < 8 ? 'magnet' : 'level';
        const crate = { id:i, kind, x:(i % 8 + .2 + (hash >>> 8) / 0x1000000 * .6) * 1600, y:(Math.floor(i / 8) + .2 + (other >>> 8) / 0x1000000 * .6) * 1600, radius:20 };
        if (i === 27) { const angle = hash / 0x100000000 * TAU; crate.x = this.width / 2 + Math.cos(angle) * 540; crate.y = this.height / 2 + Math.sin(angle) * 540; }
        this.resolveTerrain(crate); this.supplyCrates.push(crate);
      }
      this.enemyLimit = clamp(Math.floor(Number(options.enemyLimit) || 6000), 100, 24000);
      this.peakEnemies = 0; this.nextBossAt = 60; this.bossIndex = 0; this.bossKills = 0; this.lastBoss = '';
      this.nextMegaAt = 600; this.bossWhips = [];
      this.runId = this.seed + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      this.encountered = new Set(); this.enemyShots = []; this.summons = [];
      this.status = 'ready'; this.time = 0; this.kills = 0; this.level = 1;
      this.xp = 0; this.xpNeed = 6; this.nextId = 1;
      this.character = CHARACTERS.find(c => c.id === characterId) || CHARACTERS[0];
      const centerX = this.width / 2, centerY = this.height / 2;
      this.player = { x: centerX, y: centerY, prevX: centerX, prevY: centerY, radius: 12, hp: this.character.hp + this.meta.vital * 10, maxHp: this.character.hp + this.meta.vital * 10, invulnerable: 0, dash: 0, dashReady: 0, dirX: 0, dirY: 1, slowTill: 0 };
      this.input = { x: 0, y: 0, firing: false };
      this.aim = { x: centerX, y: centerY - 300, active: false };
      this.fireMode = options.fireMode === 'manual' ? 'manual' : 'auto';
      this.selectedWeapon = this.character.weapon; this.queuedWeapon = null;
      this.enemies = []; this.shots = []; this.gems = []; this.hearts = [];
      this.particles = []; this.rings = []; this.levels = Object.fromEntries(UPGRADES.map(u => [u.id, 0]));
      this.levels[this.character.weapon] = 1;
      this.weaponOrder.push(this.character.weapon);
      for (const id of this.character.extraWeapons || []) { this.levels[id] = 1; this.weaponOrder.push(id); }
      if (this.stressMode && !this.sandboxMode) for (const u of UPGRADES) this.levels[u.id] = u.max;
      this.arcs = []; this.boomerangs = []; this.pools = []; this.meteors = [];
      this.leechBudget = 2; this.holyMarks = new Map(); this.waterHits = new Map(); this.burnMarks = new Map();
      this.relics = []; this.freezes = new Map(); this.bibleHits = new Map(); this.bibleUntil = 0; this.shieldCharges = 0; this.shieldUntil = 0; this.weaponPage = 0;
      this.weaponClocks = { blades: 0, lightning: .25, boomerang: .25, frost: .3, meteor: .3, poison: 0 };
      for (const w of EXTRA_WEAPONS) this.weaponClocks[w.id] = .3;
      this.slashes = []; this.gemBins = new Map(); this.cellPool = [];
      this.offers = []; this.offerSelection = -1; this.banished = new Set(); this.banishesLeft = 3; this.skipsLeft = 3; this.rerollsUsed = 0; this.rerollGoldSpent = 0;
      this.shootClock = .15; this.spawnClock = .35; this.pulseClock = 1.2;
      this.spawnRadius = 650; this.bossSpawned = false; this.damageFlash = 0; this.events = [];
      this.grid = new Map();
      if(this.sandboxMode) {
        const config=options.sandbox || {}, weapon=UPGRADES.find(u=>u.weapon&&u.id===config.weapon);
        if(weapon) {for(const id in this.levels)this.levels[id]=0;this.levels[weapon.id]=clamp(Math.floor(Number(config.rank)||1),1,weapon.max);this.weaponOrder=[weapon.id];this.selectedWeapon=weapon.id;}
        else for(const id of this.weaponOrder)this.levels[id]=clamp(Math.floor(Number(config.rank)||1),1,UPGRADES.find(u=>u.id===id).max);
        const passive=UPGRADES.find(u=>!u.weapon&&u.id===config.passive);
        if(passive)for(let i=0;i<clamp(Math.floor(Number(config.passiveRank)||1),1,passive.max);i++)this.applyUpgrade(passive);
        const recipe=EVOLUTION_BY_WEAPON[this.selectedWeapon] || EVOLUTIONS.find(r=>r.weapons?.includes(this.selectedWeapon));
        if(config.evolved&&recipe){for(const id of [recipe.weapon,...(recipe.weapons||[])])this.levels[id]=UPGRADES.find(u=>u.id===id).max;for(const [id,rank]of Object.entries(recipe.passives))while(this.levels[id]<rank)this.applyUpgrade(UPGRADES.find(u=>u.id===id));this.evolve(recipe);}
        this.sandboxEnemy=Object.hasOwn(ENEMIES,config.enemy)?config.enemy:'dummy';this.sandboxCount=clamp(Math.floor(Number(config.count)||1),1,20);this.sandboxClock=0;
        this.treasures=[];
      }
    }
    random() {
      let t = this.randomState += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    start() {
      if (this.status !== 'ready') return;
      this.status = 'running';
      if(this.sandboxMode){this.spawnSandboxTargets();return;}
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + this.random() * .2, d = 310 + this.random() * 100;
        this.spawn(this.mapId==='forest'?'grave_bat':'ghoul', this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d);
      }
    }
    spawnSandboxTargets() {
      if(!this.sandboxMode)return;
      for(let i=0;i<this.sandboxCount;i++){
        const angle=this.sandboxCount===1?0:i*TAU/this.sandboxCount, distance=this.sandboxCount===1?150:180;
        const e=this.spawn(this.sandboxEnemy==='dummy'?'ghoul':this.sandboxEnemy,this.player.x+Math.cos(angle)*distance,this.player.y+Math.sin(angle)*distance);
        if(this.sandboxEnemy==='dummy')Object.assign(e,{title:'Манекен',sprite:' ._.\n[+|+]\n / \\',frames:undefined,trainingDummy:true,hp:10000,maxHp:10000,speed:0,damage:0,skill:undefined,xp:0,ink:9,knockbackResistance:1});
      }
      this.buildGrid();
    }
    pause() {
      if (this.status === 'running') this.status = 'paused';
      else if (this.status === 'paused') this.status = 'running';
    }
    get power() { return (1 + this.levels.power * .1) * (1 + this.meta.power * .05 + (this.character.traits?.power || 0)); }
    get haste() { return (1 + this.levels.haste * .08) * (1 + this.meta.haste * .04); }
    get area() { return 1 + this.levels.area * .06 + this.levels.silverRing * .05 + (this.character.traits?.area || 0); }
    get effectDuration() { return 1 + this.levels.duration * .08 + this.levels.silverRing * .03; }
    get projectileSpeed() { return 1 + this.levels.velocity * .08; }
    get armor() { return this.levels.armor + this.meta.armor + (this.character.traits?.armor || 0); }
    get growth() { return 1 + this.levels.growth * .05 + this.meta.growth * .03; }
    get xpEfficiency() { return 1 / (1 + (this.level - 1) * BALANCE.xpDecay); }
    get luck() { return 1 + this.levels.luck * .1; }
    get greed() { return 1 + this.levels.greed * .15 + this.levels.capital * .15 + this.levels.curse * .2 + (this.levels.goldRing + this.levels.rightSign) * .1 + (this.character.traits?.greed || 0); }
    get damage() { return 20 * (1 + .18 * Math.max(0, this.levels.needle - 1)) * this.power; }
    get cooldown() { return .68 * BALANCE.weaponCooldown / this.haste / (1 + .05 * Math.max(0, this.levels.needle - 1)) * (this.isEvolved('needle') ? .4 : 1); }
    get speed() { return this.character.speed * (1 + .08 * this.levels.stride + .03 * this.meta.stride) * (this.player.slowTill > this.time ? .65 : 1); }
    get dashCooldown() { return this.character.dash * BALANCE.dashCooldown * Math.pow(.95, this.levels.stride); }
    get magnet() { return this.character.magnet + this.levels.magnet * 20 + this.meta.magnet * 15; }
    get elapsed() { return Math.max(this.time, this.wallTime); }
    get pressureTime() { return (this.elapsed + this.pressureOffset) * (1 + this.levels.curse * .1 + (this.levels.goldRing + this.levels.rightSign) * .08); }
    get waveAge() { const age = this.pressureTime; return age <= 600 ? age * .65 : 390 + (age - 600) * .85; }
    inventory(weapon) {
      const order = weapon ? this.weaponOrder : this.passiveOrder, all = weapon ? SLOTS : UPGRADES.filter(u => !u.weapon).map(u => u.id);
      return [...new Set([...order, ...all])].filter(id => all.includes(id) && this.levels[id] > 0 && !this.isConsumed(id));
    }
    canUpgrade(u) { return Boolean(u && !this.banished.has(u.id) && !this.isConsumed(u.id) && this.levels[u.id] < u.max && (this.levels[u.id] > 0 || this.stressMode || this.inventory(Boolean(u.weapon)).length < 5)); }
    upgradeWeight(u) {
      const rarity = (root.NightCatalog || require('./catalog.js')).rarities[u.rarity];
      return u.offerWeight ?? (rarity ? rarity.weight * (1 + (this.luck - 1) * rarity.tier) : 100);
    }
    pickUpgrade(pool) {
      if (!pool.length) return null;
      let roll = this.random() * pool.reduce((sum, u) => sum + this.upgradeWeight(u), 0);
      for (const u of pool) { roll -= this.upgradeWeight(u); if (roll < 0) return u; }
      return pool[pool.length - 1];
    }
    drawOffers(candidates = UPGRADES.filter(u => this.canUpgrade(u))) {
      const pool = [...candidates], offers = [];
      const take = choices => { const u = this.pickUpgrade(choices); if (u) { offers.push(u); pool.splice(pool.indexOf(u), 1); } };
      // Reserve a discovery slot while the build still has room for new weapons.
      take(pool.filter(u => u.weapon && !this.levels[u.id]));
      while (offers.filter(u => u.weapon).length < 2 && pool.some(u => u.weapon)) take(pool.filter(u => u.weapon));
      take(pool.filter(u => !u.weapon));
      while (offers.length < 3 && pool.length) take(pool);
      this.offers = offers; this.offerSelection = -1;
    }
    get rerollCost() { return 5 * (this.rerollsUsed + 1); }
    get goldAvailable() { return Math.max(0, this.goldEarned - this.rerollGoldSpent); }
    rerollCandidates() { return UPGRADES.filter(u => this.canUpgrade(u) && !this.offers.includes(u)); }
    get canReroll() { return this.status === 'upgrading' && this.rerollsUsed < 1000000 && this.offers.length > 0 && this.rerollCandidates().length >= this.offers.length; }
    rerollOffers() {
      if (!this.canReroll) return false;
      this.drawOffers(this.rerollCandidates()); this.rerollsUsed++; return true;
    }
    get weaponPages() { return Math.max(1, Math.ceil(this.inventory(true).length / 5)); }
    get wavePlan() { return EnemySystem.wave(ENEMIES, this.pressureTime, this.stressMode,this.map,this.elapsed); }
    isEvolved(id) { return this.evolutions.has(EVOLUTION_BY_WEAPON[id]?.id); }
    isConsumed(id) { return EVOLUTIONS.some(e => this.evolutions.has(e.id) && e.weapons?.includes(id)); }
    weaponInfo(id) { return this.isEvolved(id) ? EVOLUTION_BY_WEAPON[id] : UPGRADES.find(u => u.id === id); }
    canEvolve(recipe) {
      return !this.evolutions.has(recipe.id) && [recipe.weapon, ...(recipe.weapons || [])].every(id => !this.isConsumed(id) && this.levels[id] === UPGRADES.find(u => u.id === id).max) && Object.entries(recipe.passives).every(([id, rank]) => this.levels[id] >= rank);
    }
    readyEvolutions() { return EVOLUTIONS.filter(e => this.canEvolve(e)); }
    evolve(recipe) {
      if (!recipe || !this.canEvolve(recipe)) return false;
      this.evolutions.add(recipe.id);
      for (const id of recipe.weapons || []) {
        this.levels[id] = 0;
        if (this.selectedWeapon === id) this.selectedWeapon = recipe.weapon;
        if (this.queuedWeapon === id) this.queuedWeapon = null;
      }
      if (recipe.weapon in this.weaponClocks) this.weaponClocks[recipe.weapon] = 0;
      if (recipe.id === 'mikolenin') { this.boomerangs.length = 0; this.meteors = this.meteors.filter(m => m.kind !== 'hammer'); }
      this.weaponPage = Math.min(this.weaponPage, this.weaponPages - 1);
      this.events.push('evolution'); return true;
    }
    awardGold(value) {
      if (this.stressMode) return;
      const total = value * BALANCE.goldMultiplier * this.greed + this.goldCarry, whole = Math.floor(total + 1e-8);
      this.goldEarned += whole; this.goldCarry = Math.max(0, total - whole);
      this.combat.record('gold', whole);
    }
    get wave() { return Math.floor(this.pressureTime / 30) + 1; }
    obstacleActive(block) {
      const arena = this.encounter;
      return !arena || arena.phase !== 'locked' || Math.hypot(block.x - arena.x, block.y - arena.y) > arena.radius + Math.hypot(block.w, block.h) / 2 + 35;
    }
    visibleObstacles(left, top, right, bottom) {
      if (!this.terrainEnabled) return [];
      const result = [], terrain = this.terrain;
      for (let y = Math.max(0, Math.floor(top / 320)); y <= Math.min(terrain.rows - 1, Math.floor(bottom / 320)); y++) {
        for (let x = Math.max(0, Math.floor(left / 400)); x <= Math.min(terrain.cols - 1, Math.floor(right / 400)); x++) {
          const block = terrain.cells[y * terrain.cols + x]; if (block && this.obstacleActive(block)) result.push(block);
        }
      }
      return result;
    }
    resolveTerrain(entity) {
      if (!this.terrainEnabled) return false;
      // Blocks stay more than 60 units from cell borders. Every actor's radius
      // is below 50, so an overlapping block is always in the actor's own cell.
      const col = Math.floor(entity.x / 400), row = Math.floor(entity.y / 320);
      const block = this.terrain.cells[row * this.terrain.cols + col];
      if (!block || !this.obstacleActive(block)) return false;
      const left = block.x - block.w / 2, right = block.x + block.w / 2, top = block.y - block.h / 2, bottom = block.y + block.h / 2;
      const dx = entity.x - clamp(entity.x, left, right), dy = entity.y - clamp(entity.y, top, bottom), r = entity.radius;
      const distance = Math.hypot(dx, dy); if (distance >= r) return false;
      if (distance > .0001) { entity.x += dx / distance * (r - distance); entity.y += dy / distance * (r - distance); }
      else {
        const distances = [entity.x - left, right - entity.x, entity.y - top, bottom - entity.y], side = distances.indexOf(Math.min(...distances));
        if (side === 0) entity.x = left - r; else if (side === 1) entity.x = right + r;
        else if (side === 2) entity.y = top - r; else entity.y = bottom + r;
      }
      return true;
    }
    resolveArena(entity) {
      const arena = this.encounter; if (!arena || arena.phase !== 'locked') return;
      const dx = entity.x - arena.x, dy = entity.y - arena.y, distance = Math.hypot(dx, dy);
      const inside = entity === this.player || entity.arenaMember;
      const boundary = inside ? arena.radius - entity.radius - 8 : arena.radius + entity.radius + 8;
      if (inside ? distance <= boundary : distance >= boundary) return;
      const angle = distance ? Math.atan2(dy, dx) : entity.phase || 0;
      entity.x = arena.x + Math.cos(angle) * boundary; entity.y = arena.y + Math.sin(angle) * boundary;
    }
    moveEntity(entity, dx, dy, detour = false) {
      const oldX = entity.x, oldY = entity.y, distance = Math.hypot(dx, dy), steps = Math.max(1, Math.ceil(distance / 8));
      let blocked = false;
      for (let i = 0; i < steps; i++) {
        entity.x = clamp(entity.x + dx / steps, 28, this.width - 28); entity.y = clamp(entity.y + dy / steps, 28, this.height - 28);
        blocked = this.resolveTerrain(entity) || blocked; this.resolveArena(entity);
      }
      if (blocked && detour && Math.hypot(entity.x - oldX, entity.y - oldY) < distance * .5) {
        const direction = entity.id % 2 ? 1 : -1; this.moveEntity(entity, -dy * direction, dx * direction);
      }
    }
    beginEncounter() {
      this.encounter = { phase: 'warning', x: this.player.x, y: this.player.y, radius: this.arenaRadius, warningLeft: 5, lockedLeft: BALANCE.arenaSeconds, bossId: 0, kind: BOSSES[this.bossIndex % BOSSES.length] };
      this.events.push('arena-warning');
    }
    isFirstBoss(enemy) { return this.bossIndex === 1 && enemy.boss && enemy.kind === BOSSES[0]; }
    isEncounterBoss(enemy) { return this.bossIndex>0 && enemy.boss && enemy.kind===BOSSES[(this.bossIndex-1)%BOSSES.length]; }
    encounterBossHealth(index=this.bossIndex+1,level=this.level) {
      return (index===1 ? 1500 : 3200+Math.max(0,index-2)*1000)+Math.max(0,level-1)*200;
    }
    updateEncounter(dt) {
      const arena = this.encounter; if (!arena) return;
      if (arena.phase === 'locked') {
        arena.lockedLeft = Math.max(0, arena.lockedLeft - dt);
        if (arena.lockedLeft <= 0) this.releaseArena('arena-timeout');
        return;
      }
      arena.x = clamp(this.player.x, arena.radius + 90, this.width - arena.radius - 90);
      arena.y = clamp(this.player.y, arena.radius + 90, this.height - arena.radius - 90);
      arena.warningLeft = Math.max(0, arena.warningLeft - dt);
      if (arena.warningLeft > 0) return;
      arena.phase = 'locked'; this.resolveArena(this.player);
      for (const enemy of this.enemies) { enemy.arenaMember = 0; this.resolveArena(enemy); }
      const angle = this.random() * TAU, distance = arena.radius * .56;
      const boss = this.spawn(arena.kind, arena.x + Math.cos(angle) * distance, arena.y + Math.sin(angle) * distance, 1);
      const first = this.bossIndex === 0;
      boss.hp = boss.maxHp = this.encounterBossHealth(); boss.damage *= first ? BALANCE.firstBossDamage : BALANCE.arenaBossDamage;
      boss.radius = Math.min(46, boss.radius * 1.25); boss.arenaMember = 1;
      if (first) boss.skillClock = 1.2;
      this.player.invulnerable = Math.max(this.player.invulnerable, 1);
      arena.bossId = boss.id; this.bossIndex++; this.bossSpawned = true; this.lastBoss = boss.title;
      this.events.push('boss');
    }
    releaseArena(event) {
      if (!this.encounter) return;
      this.encounter = null; this.nextBossAt = this.pressureTime + 90;
      for (const enemy of this.enemies) enemy.arenaMember = 0;
      for (const summon of this.summons) summon.arenaMember = 0;
      this.resolveTerrain(this.player); this.player.invulnerable = Math.max(this.player.invulnerable, 1.5);
      this.events.push(event);
    }
    dropChest(enemy) {
      const chest = { id: this.nextChestId++, x: enemy.x, y: enemy.y, source: enemy.kind, radius: 20, canEvolve: Boolean(enemy.mega || enemy.bornAt >= 600) };
      this.resolveTerrain(chest); this.chests.push(chest);
      if (this.chests.length > 64) this.chests.shift(); this.events.push('chest-drop');
    }
    applyUpgrade(upgrade) {
      if (!this.canUpgrade(upgrade)) return false;
      if (!this.levels[upgrade.id]) (upgrade.weapon ? this.weaponOrder : this.passiveOrder).push(upgrade.id);
      this.levels[upgrade.id]++;
      if (upgrade.id === 'vital') { this.player.maxHp += 25; this.healPlayer(20); }
      if (upgrade.id === 'leftSign') { this.player.maxHp += 10; this.healPlayer(10); }
      if (upgrade.id === 'pulse') this.pulseClock = Math.min(this.pulseClock, .4);
      if (upgrade.id in this.weaponClocks) this.weaponClocks[upgrade.id] = Math.min(this.weaponClocks[upgrade.id], .2);
      return true;
    }
    openChest(chest) {
      if (this.status !== 'running' || !this.chests.includes(chest)) return false;
      this.chests = this.chests.filter(c => c !== chest); this.chestsOpened++;
      const options = [], ready = chest.canEvolve ? this.readyEvolutions() : [];
      while (options.length < 3 && ready.length) {
        const recipe = ready.splice(Math.floor(this.random() * ready.length), 1)[0];
        options.push({ type: 'evolution', id: recipe.id });
      }
      const mega = ENEMIES[chest.source].mega;
      const pool = [{ type: 'gold', value: mega ? 150 : 50 }, { type: 'xp', value: mega ? 200 : 75 }];
      for (const weapon of [true, false]) {
        const candidates = UPGRADES.filter(u => Boolean(u.weapon) === weapon && this.canUpgrade(u));
        if (candidates.length) { const u = this.pickUpgrade(candidates); pool.push({ type: 'upgrade', id: u.id, rank: this.levels[u.id] + 1 }); }
      }
      while (options.length < 3 && pool.length) options.push(pool.splice(Math.floor(this.random()*pool.length),1)[0]);
      if(options.length<3)options.push({type:'shield',value:3});
      this.reward = { id: chest.id, source: chest.source, count: 1, items: [], options, heal: 0, xp: 0, treasure: Boolean(chest.treasure) };
      this.status = 'reward'; this.events.push('chest-open'); return true;
    }
    claimReward(index) {
      if (this.status !== 'reward') return false;
      if (this.reward.options) {
        const option = Number.isInteger(index) && this.reward.options[index]; if (!option) return false;
        if (option.type === 'evolution') { if (!this.evolve(EVOLUTIONS.find(r => r.id === option.id))) return false; }
        else if (option.type === 'upgrade') { if (!this.applyUpgrade(UPGRADES.find(u => u.id === option.id))) return false; }
        else if (option.type === 'gold') this.awardGold(option.value);
        else if (option.type === 'xp') this.gainXP(option.value);
        else if (option.type === 'shield') { this.shieldCharges = option.value; this.shieldUntil = this.time + 30; }
        this.awardGold(10); this.player.invulnerable = Math.max(this.player.invulnerable, 1);
      }
      this.reward = null; this.status = 'running'; this.checkLevel(); return true;
    }
    selectSlot(slot) {
      if (!Number.isInteger(slot) || slot < 1 || slot > 5) return false;
      const id = this.inventory(true)[this.weaponPage * 5 + slot - 1]; if (!id || !this.levels[id]) return false;
      this.selectedWeapon = id; this.queuedWeapon = null; return true;
    }
    cycleWeapons(direction) { this.weaponPage = (this.weaponPage + direction + this.weaponPages) % this.weaponPages; }
    setFireMode(mode) { if (mode !== 'auto' && mode !== 'manual') return; this.fireMode = mode; this.input.firing = false; this.queuedWeapon = null; }
    requestAttack() { if (this.status === 'running' && this.fireMode === 'manual') this.queuedWeapon = this.selectedWeapon; }
    consumeAttack(id) { if (this.queuedWeapon === id) this.queuedWeapon = null; }
    wantsFire(id) { return this.levels[id] > 0 && (this.fireMode === 'auto' || this.selectedWeapon === id && (this.input.firing || this.queuedWeapon === id)); }
    aimPoint(range = 620) {
      const p = this.player;
      let dx = this.aim.active ? this.aim.x - p.x : p.dirX * range, dy = this.aim.active ? this.aim.y - p.y : p.dirY * range;
      const d = Math.hypot(dx, dy) || 1, scale = Math.min(d, range) / d;
      return { x: clamp(p.x + dx * scale, 0, this.width), y: clamp(p.y + dy * scale, 0, this.height) };
    }
    aimedTarget(range = 620) {
      const p = this.player, aim = this.aimPoint(range), dx = aim.x - p.x, dy = aim.y - p.y, length = Math.hypot(dx, dy) || 1;
      let found = null, score = Infinity;
      for (const e of this.enemies) if (e.alive && (this.encounter?.phase !== 'locked' || e.arenaMember)) {
        const ex = e.x - p.x, ey = e.y - p.y, along = (ex * dx + ey * dy) / length, side = Math.abs(ex * dy - ey * dx) / length;
        if (along > 0 && along < range && side < 48 + e.radius && along + side * 3 < score) { score = along + side * 3; found = e; }
      }
      return found;
    }
    dash() {
      const p = this.player;
      if (this.status !== 'running' || p.dashReady > 0) return false;
      const d = Math.hypot(this.input.x, this.input.y);
      if (d) { p.dirX = this.input.x / d; p.dirY = this.input.y / d; }
      p.dash = .22; p.dashReady = this.dashCooldown;
      p.invulnerable = Math.max(p.invulnerable, .3);
      this.events.push('dash');
      return true;
    }
    spawn(kind, x, y, arenaMember = 0) {
      const def = ENEMIES[kind];
      if (!def) throw new Error('Unknown enemy: ' + kind);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        const angle = this.random() * TAU;
        const distance = this.spawnRadius + this.random() * 100;
        x = clamp(this.player.x + Math.cos(angle) * distance, 28, this.width - 28);
        y = clamp(this.player.y + Math.sin(angle) * distance, 28, this.height - 28);
      }
      const latePressure = !def.boss && !this.stressMode ? 1 + Math.max(0, this.pressureTime - 360) / 300 : 1;
      const scale = this.sandboxMode ? 1 : (def.mega ? 1 + Math.max(0, this.elapsed - 600) / 1200 : 1 + this.waveAge / 340) * latePressure;
      const dx = this.player.x - x, dy = this.player.y - y, d = Math.hypot(dx, dy) || 1;
      const enemy = { ...def, damage: def.damage * (this.sandboxMode ? 1 : 1 + Math.floor(this.pressureTime / 180) * .12), kind, id: this.nextId++, x, y, prevX: x, prevY: y, hp: def.hp * scale, maxHp: def.hp * scale, alive: true, flash: 0, bladeAt: -10, chilledTill: 0, poisonAt: 0, phase: this.random() * TAU, skillClock: 1.5 + this.random() * 2, windup: 0, chargeTime: 0, chargeX: def.ai === 'direct' ? dx / d : 0, chargeY: def.ai === 'direct' ? dy / d : 0, targetX: x, targetY: y, arenaMember };
      this.resolveTerrain(enemy); this.resolveArena(enemy); enemy.prevX = enemy.x; enemy.prevY = enemy.y;
      this.enemies.push(enemy);
      enemy.bornAt = this.elapsed;
      this.encountered.add(kind);
      return enemy;
    }
    spawnWave() {
      const plan = this.wavePlan, kind = this.stressMode ? EnemySystem.weighted(plan.entries, () => this.random()) : null;
      const count = Math.min(this.stressMode ? 128 : plan.group, this.stressMode ? 2 + Math.floor(this.waveAge / 45) : Math.max(0, plan.target - this.enemies.length), this.enemyLimit - this.enemies.length - (this.encounter?.phase === 'warning' ? 1 : 0));
      const counts = { ranged: 0, special: 0, elite: 0 };
      if (!this.stressMode) for (const e of this.enemies) if (e.alive && !e.boss) {
        if (e.ai === 'ranged') counts.ranged++;
        if (EnemySystem.roleOf(e) === 'special') counts.special++;
        if (e.rank === 'elite') counts.elite++;
      }
      for (let i = 0; i < count; i++) {
        const candidates = this.stressMode ? plan.entries : plan.entries.filter(row => (!row.ranged || counts.ranged < plan.quotas.ranged) && (row.role !== 'special' || counts.special < plan.quotas.special) && (!row.elite || counts.elite < plan.quotas.elite));
        if (!candidates.length) break;
        const enemy = this.spawn(this.stressMode ? kind : EnemySystem.weighted(candidates, () => this.random()));
        if (enemy.ai === 'ranged') counts.ranged++;
        if (EnemySystem.roleOf(enemy) === 'special') counts.special++;
        if (enemy.rank === 'elite') counts.elite++;
      }
      this.spawnClock += this.stressMode ? Math.max(.12, .86 - this.waveAge * .0014) : plan.interval;
    }
    buildGrid() {
      for (const cell of this.grid.values()) { cell.length = 0; this.cellPool.push(cell); }
      this.grid.clear();
      for (const e of this.enemies) if (e.alive) {
        const key = Math.floor(e.x / 80) + Math.floor(e.y / 80) * 1024;
        if (!this.grid.has(key)) this.grid.set(key, this.cellPool.pop() || []);
        this.grid.get(key).push(e);
      }
    }
    nearby(x, y, r) {
      const found = [];
      for (let yy = Math.floor((y - r) / 80); yy <= Math.floor((y + r) / 80); yy++) {
        for (let xx = Math.floor((x - r) / 80); xx <= Math.floor((x + r) / 80); xx++) {
          const cell = this.grid.get(xx + yy * 1024);
          if (cell) for (let i = 0; i < cell.length; i++) found.push(cell[i]);
        }
      }
      return found;
    }
    separateCrowd() {
      const offsets = [0, -1, 1, -1024, 1024, -1025, -1023, 1023, 1025];
      for (const e of this.enemies) if (e.alive && (this.enemies.length < 2000 || (e.id + this.steps) % 2 === 0)) {
        const key = Math.floor(e.x / 80) + Math.floor(e.y / 80) * 1024;
        let budget = 20;
        for (const offset of offsets) {
          const cell = this.grid.get(key + offset); if (!cell) continue;
          const start = (e.id + this.steps * 7) % cell.length;
          for (let i = 0; i < cell.length && budget > 0; i++, budget--) {
            const other = cell[(start + i) % cell.length]; if (other === e || !other.alive) continue;
            const dx = e.x - other.x, dy = e.y - other.y, d2 = dx * dx + dy * dy, min = (e.radius + other.radius) * .75;
            if (d2 > .001 && d2 < min * min) { const d = Math.sqrt(d2), push = (min - d) * .08 / d; e.x += dx * push; e.y += dy * push; }
          }
          if (budget <= 0) break;
        }
        e.x = clamp(e.x, 28, this.width - 28); e.y = clamp(e.y, 28, this.height - 28);
        this.resolveTerrain(e); this.resolveArena(e);
      }
    }
    addGem(x, y, value) {
      if (value <= 0) return;
      const key = Math.floor(x / 64) + Math.floor(y / 64) * 1024, old = this.gemBins.get(key);
      if (old && !old.taken && !old.magnetized) { old.value += value; return; }
      const gem = { x, y, value, bin: key, magnetized: false }; this.gems.push(gem); this.gemBins.set(key, gem);
    }
    burst(x, y, ink, count = 7, weapon = null) {
      for (let i = 0; i < count; i++) {
        const a = this.random() * TAU, speed = 20 + this.random() * 95;
        this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .3 + this.random() * .3, ink, weapon });
      }
    }
    hurtEnemy(e, damage, knockback = 0, weapon = 'other') {
      if (!e.alive || !Number.isFinite(damage) || damage <= 0) return;
      damage *= WEAPON_DAMAGE[weapon] ?? 1;
      this.combat.hit(weapon, damage, Math.min(e.hp, damage), damage >= e.hp);
      if (weapon === 'poison' && this.character.traits?.lifesteal) this.leechBudget -= this.healPlayer(Math.min(this.leechBudget,1,Math.min(e.hp,damage)*this.character.traits.lifesteal));
      e.hp -= damage; e.flash = .12;
      if (knockback) {
        const dx = e.x - this.player.x, dy = e.y - this.player.y, d = Math.hypot(dx, dy) || 1;
        const force = knockback * (1 - (e.knockbackResistance ?? (this.isFirstBoss(e) ? .65 : 0))); this.moveEntity(e, dx / d * force, dy / d * force);
      }
      if (e.hp > 0) return;
      e.alive = false; this.holyMarks.delete(e.id); this.waterHits.delete(e.id); this.burnMarks.delete(e.id); this.kills++;
      if(this.sandboxMode){this.burst(e.x,e.y,e.ink,8,weapon);return;}
      if (this.kills % 5 === 0) this.awardGold(1);
      if (e.boss) this.bossKills++;
      if (e.boss) {
        this.awardGold(e.mega ? 125 : 25);
        if (this.encounter?.bossId === e.id) {
          this.releaseArena('arena-clear');
        } else this.events.push('boss-defeated');
        this.nextBossAt = this.pressureTime + 90;
        this.dropChest(e);
      }
      if (e.xp > 0 && (e.boss || this.stressMode || this.random() < BALANCE.xpDropChance)) {
        this.addGem(e.x, e.y, e.xp);
        this.combat.record('xpDropped', e.xp);
      }
      if (!this.stressMode && this.random() < (e.boss ? BALANCE.bossHeartDropChance : BALANCE.heartDropChance * this.luck)) { this.hearts.push({ x: e.x + 14, y: e.y, value: e.boss ? 60 : 20, expires: this.time + 120 }); this.combat.record('heartsSpawned', 1); }
      this.burst(e.x, e.y, e.ink, e.boss ? 28 : 6, weapon);
    }
    hurtPlayer(damage, source) {
      const p = this.player;
      if (this.stressMode || p.invulnerable > 0 || this.status !== 'running') return;
      if (this.isEvolved('laurel')) damage = Math.min(10, damage);
      if (this.shieldCharges > 0 && this.shieldUntil > this.time) {
        this.shieldCharges--; p.invulnerable = .4; this.events.push('shield');
        if (this.isEvolved('laurel')) this.explode(p.x, p.y, 180 * this.area, 70 * this.power, 13, 18, 'laurel');
        return;
      }
      const hp = p.hp;
      p.hp = Math.max(0, p.hp - Math.max(1, damage * .25, damage - this.armor)); p.invulnerable = .85;
      this.combat.record('hurt', hp - p.hp);
      if (source?.slow) p.slowTill = this.time + source.slow;
      this.damageFlash = .26; this.events.push('hurt'); this.burst(p.x, p.y, 6, 12);
      if (source) {
        const dx = source.x - p.x, dy = source.y - p.y, d = Math.hypot(dx, dy) || 1;
        this.moveEntity(source, dx / d * 48, dy / d * 48);
      }
      if (p.hp <= 0) {
        if (this.revivesUsed < this.levels.revive + this.meta.revive) {
          this.revivesUsed++; p.hp = Math.max(1, Math.ceil(p.maxHp / 2)); p.invulnerable = 3; p.slowTill = 0; this.events.push('revive');
        } else this.status = 'dead';
      }
    }
    fire() {
      if (!this.levels.needle) return;
      const p = this.player;
      const closest = this.fireMode === 'manual' ? this.aimPoint(700) : this.targets(p.x, p.y, 700, 1)[0];
      if (!closest) return;
      const angle = Math.atan2(closest.y - p.y, closest.x - p.x);
      const count = 1 + this.levels.fork;
      for (let i = 0; i < count; i++) {
        const spread = i === 0 ? 0 : Math.ceil(i / 2) * .11 * (i % 2 ? -1 : 1);
        const a = angle + spread;
        this.shots.push({ x: p.x, y: p.y, prevX: p.x, prevY: p.y, vx: Math.cos(a) * 490 * this.projectileSpeed, vy: Math.sin(a) * 490 * this.projectileSpeed, angle: a, life: 1.5, hits: new Set(), remaining: 1 + this.levels.pierce + (this.isEvolved('needle') ? 3 : 0), damage: this.damage * (this.isEvolved('needle') ? 2 : 1) });
      }
      this.events.push('shot');
    }
    healPlayer(value) {
      const actual = Math.max(0, Math.min(value, this.player.maxHp - this.player.hp));
      this.player.hp += actual; this.combat.record('healing', actual); return actual;
    }
    openSupply(crate) {
      if (this.stressMode || this.status !== 'running' || !this.supplyCrates.includes(crate) || this.supplyTaken.has(crate.id) || Math.hypot(crate.x - this.player.x, crate.y - this.player.y) >= 32) return false;
      this.supplyTaken.add(crate.id);
      if (crate.kind === 'heal') this.healPlayer(30);
      else if (crate.kind === 'level') { this.xp += this.xpNeed; this.checkLevel(); }
      else {
        const xp = this.gems.reduce((total, gem) => total + gem.value, 0);
        this.gems = []; this.gemBins.clear(); this.grantXP(xp);
      }
      this.rings.push({ x:crate.x, y:crate.y, radius:90, life:.65, maxLife:.65, ink:crate.kind === 'heal' ? 11 : crate.kind === 'level' ? 7 : 16, glyph:'+' });
      this.events.push('supply-' + crate.kind); return true;
    }
    gainXP(value) { const total = value * this.growth * this.xpEfficiency + this.xpCarry, whole = Math.floor(total + 1e-8); this.xpCarry = Math.max(0, total - whole); this.xp += whole; this.combat.record('xp', whole); return whole; }
    grantXP(value) { if(this.sandboxMode)return;this.gainXP(value); this.checkLevel(); }
    checkLevel() {
      if (this.sandboxMode || this.status !== 'running' || this.xp < this.xpNeed) return;
      this.xp -= this.xpNeed; this.level++;
      this.xpNeed = Math.min(5000, Math.ceil(this.xpNeed * 1.22 + 3));
      const candidates = UPGRADES.filter(u => this.canUpgrade(u));
      if (!candidates.length) { this.healPlayer(30); return; }
      this.drawOffers(candidates);
      this.status = 'upgrading'; this.events.push('level');
    }
    selectOffer(index) {
      if (this.status !== 'upgrading' || !Number.isInteger(index) || !this.offers[index]) return false;
      this.offerSelection = index; return true;
    }
    finishUpgrade() {
      this.player.invulnerable = Math.max(this.player.invulnerable, .65);
      this.offers = []; this.offerSelection = -1; this.status = 'running'; this.checkLevel();
    }
    banishOffer(index = this.offerSelection) {
      if (this.status !== 'upgrading' || !Number.isInteger(index) || !this.offers[index] || !this.banishesLeft) return false;
      const u = this.offers[index]; this.banished.add(u.id); this.banishesLeft--;
      const candidates = UPGRADES.filter(candidate => this.canUpgrade(candidate) && !this.offers.includes(candidate));
      const sameType = candidates.filter(candidate => Boolean(candidate.weapon) === Boolean(u.weapon));
      const replacement = this.pickUpgrade(sameType.length ? sameType : candidates);
      if (replacement) this.offers[index] = replacement; else this.offers.splice(index, 1);
      this.offerSelection = -1;
      if (!this.offers.length) this.finishUpgrade();
      return true;
    }
    skipUpgrade() {
      if (this.status !== 'upgrading' || !this.skipsLeft) return false;
      this.skipsLeft--; this.finishUpgrade(); return true;
    }
    choose(index) {
      if (this.status !== 'upgrading' || !Number.isInteger(index) || !this.offers[index]) return false;
      const u = this.offers[index]; if (!this.applyUpgrade(u)) return false;
      this.finishUpgrade();
      return true;
    }
    bladePositions() {
      const n = this.fireMode === 'auto' && this.levels.blades ? this.levels.blades + this.levels.fork + (this.isEvolved('blades') ? 2 : 0) : 0, result = [];
      for (let i = 0; i < n; i++) {
        const a = this.time * 3.2 * this.haste / BALANCE.weaponCooldown + i / n * TAU;
        result.push({ x: this.player.x + Math.cos(a) * this.bladeRadius, y: this.player.y + Math.sin(a) * this.bladeRadius, angle: a });
      }
      return result;
    }
    get bladeRadius() { return (this.isEvolved('blades') ? 118 : 88) * this.area; }
    explode(x, y, radius, damage, ink = 7, knockback = 18, weapon = 'other') {
      this.rings.push({ x, y, radius, life: .45, maxLife: .45, ink, glyph: '*', weapon });
      for (const e of this.nearby(x, y, radius + 50)) if (e.alive && Math.hypot(e.x - x, e.y - y) < radius + e.radius) this.hurtEnemy(e, damage, knockback, weapon);
    }
    targets(x = this.player.x, y = this.player.y, radius = 620, count = 2) {
      const best = [], distances = [], arena = this.encounter?.phase === 'locked' ? this.encounter : null;
      for (const e of this.enemies) if (e.alive && (!arena || e.arenaMember)) {
        const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d >= radius * radius) continue;
        const score = arena?.bossId === e.id ? -1 : d;
        let i = 0; while (i < distances.length && distances[i] < score) i++;
        if (i >= count) continue;
        best.splice(i, 0, e); distances.splice(i, 0, score); if (best.length > count) { best.pop(); distances.pop(); }
      }
      return best;
    }
    castPulse() {
      const p = this.player, radius = (145 + this.levels.pulse * 18) * this.area * (this.isEvolved('pulse') ? 1.5 : 1);
      this.rings.push({ x: p.x, y: p.y, radius, life: .55, maxLife: .55, weapon: 'pulse' });
      for (const e of this.nearby(p.x, p.y, radius + 35)) if (e.alive && Math.hypot(e.x - p.x, e.y - p.y) < radius + e.radius) { this.hurtEnemy(e, (36 + this.levels.pulse * 20) * this.power * (this.isEvolved('pulse') ? 1.8 : 1), 75, 'pulse'); if (this.isEvolved('pulse')) e.chilledTill = this.time + 7; }
    }
    castSlash() {
      const p = this.player, aim = this.aimPoint(130), angle = Math.atan2(aim.y - p.y, aim.x - p.x), radius = (110 + this.levels.blades * 10) * this.area;
      const count = 1 + this.levels.fork + (this.isEvolved('blades') ? 2 : 0);
      const swings=Array.from({length:count},(_,i)=>angle+(i-(count-1)/2)*.25);
      for (const facing of swings) this.slashes.push({ x:p.x, y:p.y, angle:facing, radius, life:.22, weapon:'blades' });
      for (const e of this.nearby(p.x, p.y, radius + 35)) if (e.alive && Math.hypot(e.x - p.x, e.y - p.y) < radius + e.radius) {
        const facing=Math.atan2(e.y-p.y,e.x-p.x), hits=swings.filter(a=>Math.abs(Math.atan2(Math.sin(facing-a),Math.cos(facing-a)))<=.95).length;
        if (hits) this.hurtEnemy(e,(23+this.levels.blades*5)*this.power*hits*(this.isEvolved('blades')?1.5:1),18,'blades');
      }
    }
    castPoison() {
      const p = this.fireMode === 'manual' ? this.aimPoint(360) : this.player;
      this.pools.push({ x: p.x, y: p.y, radius: (58 + this.levels.poison * 5) * this.area, life: (4 + this.levels.poison * .5) * this.effectDuration * (this.isEvolved('poison') ? 1.8 : 1), acid: this.isEvolved('poison') });
    }
    castLightning() {
      let x = this.player.x, y = this.player.y;
      const visited = new Set(), points = [{ x, y }];
      for (let i = 0; i < 2 + this.levels.lightning + this.levels.fork; i++) {
        const enemy = i === 0 && this.fireMode === 'manual' ? this.aimedTarget() : this.targets(x, y, i ? 260 : 620, 7).find(e => !visited.has(e.id));
        if (!enemy) break;
        visited.add(enemy.id); x = enemy.x; y = enemy.y; points.push({ x, y });
        this.hurtEnemy(enemy, (24 + 8 * this.levels.lightning) * this.power, 0, 'lightning');
        if (this.isEvolved('lightning') && this.meteors.length < 100) this.meteors.push({ x, y, wait: .4, radius: 55 * this.area, damage: (24 + 8 * this.levels.lightning) * this.power, kind: 'echo' });
      }
      if (points.length === 1 && this.fireMode === 'manual') points.push(this.aimPoint());
      if (points.length > 1) this.arcs.push({ points, life: .24, maxLife: .24, weapon: 'lightning' });
    }
    castBoomerang() {
      if (this.isEvolved('boomerang')) { this.castMikolenin(); return; }
      const target = this.fireMode === 'manual' ? this.aimPoint() : this.targets()[0];
      if (!target) return;
      const count = 1 + Math.floor(this.levels.boomerang / 3) + this.levels.fork;
      for (let i = 0; i < count; i++) {
        const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x) + (i - (count - 1) / 2) * .22;
        this.boomerangs.push({ x: this.player.x, y: this.player.y, prevX: this.player.x, prevY: this.player.y, vx: Math.cos(angle) * 370 * this.projectileSpeed, vy: Math.sin(angle) * 370 * this.projectileSpeed, age: 0, hits: new Map(), damage: (14 + 7 * this.levels.boomerang) * this.power });
      }
    }
    get mikoleninRadius() { return 230 * this.area; }
    castMikolenin() {
      const p = this.player;
      this.explode(p.x, p.y, this.mikoleninRadius, (46 + this.levels.boomerang * 14) * this.power, 13, 42, 'boomerang');
    }
    castFrost() {
      const p = this.player, level = this.levels.frost, radius = (170 + level * 20) * this.area * (this.isEvolved('frost') ? 1.4 : 1);
      this.rings.push({ x: p.x, y: p.y, radius, life: .65, maxLife: .65, ink: 9, glyph: '*', weapon: 'frost' });
      for (const e of this.nearby(p.x, p.y, radius + 35)) if (e.alive && Math.hypot(e.x - p.x, e.y - p.y) < radius + e.radius) {
        e.chilledTill = this.time + (.8 + level * .2) * this.effectDuration;
        if (this.isEvolved('frost')) this.freezes.set(e.id, this.time + (e.mega ? .35 : e.boss ? .6 : 1.5 * this.effectDuration));
        this.hurtEnemy(e, (8 + level * 6) * this.power * (this.isEvolved('frost') ? 2 : 1), 0, 'frost');
      }
    }
    castMeteor() {
      const count = (this.levels.meteor >= 3 ? 2 : 1) + this.levels.fork + (this.isEvolved('meteor') ? 2 : 0);
      const nearby = this.fireMode === 'auto' ? this.targets(this.player.x, this.player.y, 620, count) : [];
      const targets = this.fireMode === 'manual' ? Array.from({ length: count }, (_, i) => { const aim = this.aimPoint(); return { x: aim.x + (i - (count - 1) / 2) * 55, y: aim.y }; }) : nearby.length ? Array.from({length:count},(_,i)=>nearby[i % nearby.length]) : [];
      for (const e of targets.slice(0, count)) if (this.meteors.length < 100) this.meteors.push({ x: clamp(e.x, 28, this.width - 28), y: clamp(e.y, 28, this.height - 28), wait: .65, radius: (90 + this.levels.meteor * 12) * this.area * (this.isEvolved('meteor') ? 1.4 : 1), damage: (48 + 22 * this.levels.meteor) * this.power });
    }
    biblePositions() {
      if (!this.levels.bible || this.bibleUntil <= this.time && !(this.fireMode === 'auto' && this.isEvolved('bible'))) return [];
      const count = 1 + this.levels.bible + this.levels.fork + (this.isEvolved('bible') ? 2 : 0), radius = (this.isEvolved('bible') ? 170 : 135) * this.area;
      return Array.from({ length: count }, (_, i) => { const a = this.time * 2.7 * this.projectileSpeed + i * TAU / count; return { x: this.player.x + Math.cos(a) * radius, y: this.player.y + Math.sin(a) * radius }; });
    }
    castRelic(id) {
      const level = this.levels[id], evolved = this.isEvolved(id), p = this.player, target = this.fireMode === 'manual' ? this.aimPoint() : this.targets()[0];
      const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.atan2(p.dirY, p.dirX);
      const ballistic = BALLISTICS[id];
      if (ballistic) {
        const count = Math.min(12, 1 + this.levels.fork + (id === 'chozo' ? this.character.traits?.chozoAmount || 0 : 0) + (ballistic.rankCount ? Math.floor(level / ballistic.rankCount) : 0));
        for (let i = 0; i < count && this.relics.length < 512; i++) {
          const a = angle + (i ? Math.ceil(i / 2) * (i % 2 ? 1 : -1) * ballistic.spread : 0), speed = ballistic.speed * this.projectileSpeed;
          this.relics.push({ kind: id, evolved, x: p.x, y: p.y, prevX: p.x, prevY: p.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: ballistic.life * this.effectDuration, damage: (ballistic.damage + ballistic.rankDamage * level) * this.power, radius: ballistic.radius * this.area * (id === 'chozo' ? 1 + (level - 1) * .15 : 1), chargeLeft: ballistic.charge ? Math.max(.12, (ballistic.charge - (level - 1) * .12) / this.haste * (evolved ? .75 : 1)) : 0, chargeAngle: a, remaining: ballistic.pierce + ballistic.rankPierce * level + this.levels.pierce + (evolved && id === 'crossbow' ? 2 : 0), hits: new Map(), minX: 0, maxX: this.width, minY: 0, maxY: this.height });
        }
        return;
      }
      if (id === 'lightStaff') {
        const radius = (240 + level * 20) * this.area;
        this.rings.push({ x:p.x, y:p.y, radius, life:.7, maxLife:.7, ink:7, glyph:'+', weapon:id });
        for (const e of this.nearby(p.x, p.y, radius + 50)) if (e.alive && Math.hypot(e.x-p.x, e.y-p.y) < radius + e.radius) {
          if(evolved&&!e.boss){e.windup=0;e.skillClock=Math.max(e.skillClock,1);}
          this.hurtEnemy(e, (20 + level * 10) * this.power, 5, id);
          if (e.alive) this.holyMarks.set(e.id, { expires:this.time + 4 * this.effectDuration, next:this.time + .5, damage:(5 + level * 3) * this.power });
        }
        return;
      }
      if (id === 'crowbar') {
        const radius = (48 + level * 4) * Math.min(this.area, 1.5), count = 1 + this.levels.fork;
        for (let i=0;i<count;i++) this.slashes.push({x:p.x,y:p.y,angle,radius,life:.2,maxLife:.2,halfAngle:.85,ink:12,glyph:'J',weapon:id});
        for (const e of this.nearby(p.x,p.y,radius+50)) if (e.alive && Math.hypot(e.x-p.x,e.y-p.y)<radius+e.radius) {
          const delta = Math.atan2(e.y-p.y,e.x-p.x)-angle;
          if (Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta))) < .85) this.hurtEnemy(e,(24+level*12)*this.power*count,40,id);
        }
        if(evolved)this.enemyShots=this.enemyShots.filter(shot=>{
          const delta=Math.atan2(shot.y-p.y,shot.x-p.x)-angle;
          if(Math.hypot(shot.x-p.x,shot.y-p.y)>radius+shot.radius||Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))>=.85)return true;
          this.burst(shot.x,shot.y,9,4,id);return false;
        });
        return;
      }
      if (id === 'gauntlets') {
        const radius = (90 + level * 10) * this.area, count = 2 + this.levels.fork;
        for (let i = 0; i < count; i++) this.slashes.push({ x:p.x, y:p.y, angle:angle + (i - (count - 1) / 2) * .14, radius:radius + i % 2 * 10, life:.28, ink:8, glyph:'[=]', weapon:id });
        for (const e of this.nearby(p.x,p.y,radius + 50)) if (e.alive && Math.hypot(e.x-p.x,e.y-p.y) < radius + e.radius) {
          const delta = Math.atan2(e.y-p.y,e.x-p.x) - angle;
          if (Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta))) < .85) this.hurtEnemy(e,(12 + level * 8) * this.power * count,55,id);
        }
        if(evolved){
          const reach=Math.min(220,radius+80),start={x:p.x+Math.cos(angle)*radius*.6,y:p.y+Math.sin(angle)*radius*.6},end={x:p.x+Math.cos(angle)*reach,y:p.y+Math.sin(angle)*reach};
          this.arcs.push({points:[start,end],life:.25,maxLife:.25,weapon:id});
          for(const e of this.nearby(p.x,p.y,reach+50))if(e.alive&&segmentDistance(e.x,e.y,start,end)<e.radius+22)this.hurtEnemy(e,(12+level*8)*this.power*.45,85,id);
        }
        return;
      }
      if (id === 'laurel') { this.shieldCharges = 1 + Math.floor(level / 2); this.shieldUntil = this.time + (3 + level) * this.effectDuration; return; }
      if (id === 'bible') { this.bibleUntil = this.time + (2 + level * .4) * this.effectDuration; return; }
      if (id === 'hammer') {
        const count = 1 + Math.floor(level / 2) + this.levels.fork;
        const reach = 130 * this.area, nearby = this.targets(p.x, p.y, reach, count);
        const targets = this.fireMode === 'manual' ? Array.from({ length: count }, () => this.aimPoint(reach)) : nearby.length ? Array.from({ length: count }, (_, i) => nearby[i % nearby.length]) : [];
        for (const point of targets) if (this.meteors.length < 100) this.meteors.push({ x: clamp(point.x, 28, this.width - 28), y: clamp(point.y, 28, this.height - 28), wait: .3, radius: (70 + level * 10) * this.area, damage: (36 + level * 16) * this.power, kind: 'hammer' });
        return;
      }
      if (id === 'water') {
        for (let i = 0; i < 1 + Math.floor(level / 2) + this.levels.fork && this.pools.length < 500; i++) { const a = angle + i * .6, d = target ? Math.min(330, Math.hypot(target.x - p.x, target.y - p.y)) : 180;
          this.pools.push({ x: clamp(p.x + Math.cos(a) * d, 28, this.width - 28), y: clamp(p.y + Math.sin(a) * d, 28, this.height - 28), radius: (60 + level * 9) * this.area, life: (3 + level * .4) * this.effectDuration * (evolved ? 1.4 : 1), kind: 'water', damage: (9 + level * 6) * this.power, home: evolved }); }
        return;
      }
      if (id === 'birds' || id === 'ebony') {
        const count = (evolved ? 4 : 1) + this.levels.fork;
        for (let i = 0; i < count && this.meteors.length < 100; i++) { const a = this.time * (id === 'ebony' ? -.8 : .8) + (id === 'ebony' ? Math.PI : 0) + i * .32, x = this.fireMode === 'manual' && target ? target.x : p.x + Math.cos(a) * 220, y = this.fireMode === 'manual' && target ? target.y : p.y + Math.sin(a) * 220;
          this.meteors.push({ x: clamp(x + i * 30, 28, this.width - 28), y: clamp(y, 28, this.height - 28), wait: .6, radius: (65 + level * 8) * this.area * (evolved ? 1.35 : 1), damage: (20 + level * 10) * this.power * (evolved ? 1.6 : 1), kind: id === 'ebony' ? 'ebony' : 'bird' }); }
        return;
      }
      if (id === 'whip') {
        const radius = (155 + level * 20) * this.area, thickness = 14 * this.area, paths = [];
        for (let i = 0; i < 2 + this.levels.fork; i++) {
          const side = i % 2 ? -1 : 1, offset = i < 2 ? 0 : (i % 2 ? 1 : -1) * Math.ceil((i - 1) / 2) * 24 * this.area;
          const points = Array.from({ length: 9 }, (_, j) => { const t = j / 8; return { x:p.x + side * radius * t, y:p.y + offset - Math.sin(Math.PI * t) * radius * .18 }; });
          paths.push(points); this.slashes.push({ x:p.x, y:p.y, points, radius, life:.28, maxLife:.28, ink:9, glyph:'~', weapon:id });
        }
        let healing = 0;
        for (const e of this.nearby(p.x, p.y, radius + (this.levels.fork + 1) * 24 * this.area + 50)) if (e.alive) {
          const hits = paths.filter(points => points.some((b, i) => i && segmentDistance(e.x, e.y, points[i - 1], b) <= e.radius + thickness)).length;
          if (!hits) continue;
          const critical = evolved && this.random() < Math.min(.8, .3 * this.luck);
          this.hurtEnemy(e, (25 + 15 * level) * this.power * (evolved ? 1.5 : 1) * (critical ? 2.5 : 1) * hits, 25, id);
          if (critical) healing += 5;
        }
        this.healPlayer(Math.min(healing, 3)); return;
      }
      if (id === 'clock') {
        const radius = 480 * this.area, facing = this.fireMode === 'auto' ? this.clockStep * Math.PI / 6 : angle;
        const start = { x:p.x, y:p.y }, end = { x:p.x + Math.cos(facing) * radius, y:p.y + Math.sin(facing) * radius };
        this.arcs.push({ points:[start,end], life:.3, maxLife:.3, weapon:id });
        for (const e of this.nearby(p.x, p.y, radius + 50)) if (e.alive && segmentDistance(e.x, e.y, start, end) <= e.radius + 22) {
          this.freezes.set(e.id, this.time + (e.mega ? .35 : e.boss ? .8 : (1.2 + level * .2) * this.effectDuration));
        }
        if (++this.clockStep % 12 === 0 && evolved) {
          this.rings.push({ x:p.x, y:p.y, radius:650 * this.area, life:.8, maxLife:.8, ink:9, glyph:'0', weapon:id });
          for (const e of this.nearby(p.x,p.y,650 * this.area + 50)) if (e.alive && Math.hypot(e.x-p.x,e.y-p.y) < 650 * this.area + e.radius) this.hurtEnemy(e,e.boss ? Math.min(450,e.hp*.05) : e.hp*.5,0,id);
        }
        return;
      }
      if (id === 'garlic' || id === 'pentagram') {
        const radius = (id === 'pentagram' ? 650 : 75 + level * 15) * this.area * (evolved && id === 'garlic' ? 1.4 : 1);
        let healing = 0;
        this.rings.push({ x:p.x, y:p.y, radius, life:.45, maxLife:.45, ink:7, kind:id === 'pentagram' ? 'pentagram' : '', glyph:id === 'pentagram' ? '*' : '.', weapon:id });
        for (const e of this.nearby(p.x, p.y, radius + 50)) if (e.alive) {
          if (Math.hypot(e.x-p.x,e.y-p.y) > radius + e.radius) continue;
          this.hurtEnemy(e, (id === 'pentagram' ? e.boss ? 110 + 40 * level : 60 + 35 * level : 4 + 4 * level) * this.power * (evolved ? 1.5 : 1), id === 'garlic' ? 14 : 25, id);
          if (evolved && id === 'garlic') healing += 1;
        }
        this.healPlayer(Math.min(healing, .5));
        if (id === 'pentagram' && evolved) for (const gem of this.gems) gem.magnetized = true;
        return;
      }
      const count = Math.min(12, 1 + Math.floor(level / 2) + this.levels.fork + (evolved && id === 'axe' ? 5 : evolved ? 2 : 0));
      for (let i = 0; i < count && this.relics.length < 512; i++) {
        const a = evolved && id === 'axe' ? angle + i * TAU / count : (id === 'dagger' && this.fireMode === 'auto' ? Math.atan2(p.dirY, p.dirX) : angle) + (i - (count - 1) / 2) * .16;
        const speed = (id === 'pistol' ? 800 : id === 'sling' ? 480 : id === 'dagger' ? 700 : id === 'axe' ? 240 : id === 'fireball' ? 220 : 330) * this.projectileSpeed;
        let vx = Math.cos(a) * speed, vy = Math.sin(a) * speed;
        if (id === 'axe' && !evolved) {
          const point = this.fireMode === 'manual' ? this.aimPoint(420) : target || this.aimPoint(420);
          const dx = point.x-p.x, dy = point.y-p.y, distance = Math.hypot(dx,dy) || 1, scale = Math.min(1,420/distance), flight = clamp(Math.min(420,distance)/speed,.2,1.75);
          const spread = a-angle, ax = dx*scale/flight, ay = dy*scale/flight-180*flight;
          vx = ax*Math.cos(spread)-ay*Math.sin(spread); vy = ax*Math.sin(spread)+ay*Math.cos(spread);
        }
        this.relics.push({ kind: id, evolved, x: p.x, y: p.y, prevX: p.x, prevY: p.y, vx, vy, life: (id === 'rune' ? 4 * this.effectDuration : 2.5), damage: (id === 'fireball' ? 45 + 20 * level : id === 'axe' ? 30 + 18 * level : 12 + 8 * level) * this.power * (evolved ? 1.8 : 1), radius: (id === 'fireball' ? 15 : 8) * this.area, remaining: id === 'rune' || id === 'axe' || evolved && id === 'fireball' ? 100000 : 1 + this.levels.pierce + Math.floor(level / 2), hits: new Map(), minX: Math.max(28, p.x - 500), maxX: Math.min(this.width - 28, p.x + 500), minY: Math.max(28, p.y - 300), maxY: Math.min(this.height - 28, p.y + 300) });
      }
    }
    updateRelics(dt) {
      for (const w of EXTRA_WEAPONS) if (this.levels[w.id]) {
        this.weaponClocks[w.id] = Math.max(0, this.weaponClocks[w.id] - dt);
        if (this.weaponClocks[w.id] <= 0 && this.wantsFire(w.id)) { this.castRelic(w.id); this.consumeAttack(w.id); const rapid = this.isEvolved(w.id) && ['dagger', 'pentagram', 'pistol'].includes(w.id) ? (w.id === 'pistol' ? .5 : .4) : 1; this.weaponClocks[w.id] = w.cooldown * rapid * BALANCE.weaponCooldown / this.haste / (1 + (this.levels[w.id] - 1) * .05); }
      }
      for (const s of this.relics) {
        if (s.chargeLeft > 0) { s.chargeLeft = Math.max(0,s.chargeLeft-dt); s.x = s.prevX = this.player.x; s.y = s.prevY = this.player.y; if (s.chargeLeft > 0) continue; }
        if(s.evolved&&s.kind==='chozo'){
          let target=null,distance=240;
          for(const e of this.nearby(s.x,s.y,290))if(e.alive&&!s.hits.has(e.id)){const d=Math.hypot(e.x-s.x,e.y-s.y);if(d<distance){target=e;distance=d;}}
          if(target){const speed=Math.hypot(s.vx,s.vy),angle=Math.atan2(s.vy,s.vx),delta=Math.atan2(target.y-s.y,target.x-s.x)-angle,next=angle+clamp(Math.atan2(Math.sin(delta),Math.cos(delta)),-dt*3,dt*3);s.vx=Math.cos(next)*speed;s.vy=Math.sin(next)*speed;}
        }
        const x = s.x, y = s.y; s.prevX = x; s.prevY = y; s.life -= dt;
        if (s.kind === 'axe' && !s.evolved) s.vy += 360 * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.kind === 'rune') {
          let bounced = false;
          if (s.x < s.minX || s.x > s.maxX) { s.vx *= -1; s.x = clamp(s.x, s.minX, s.maxX); bounced = true; }
          if (s.y < s.minY || s.y > s.maxY) { s.vy *= -1; s.y = clamp(s.y, s.minY, s.maxY); bounced = true; }
          if (bounced && s.evolved) this.explode(s.x, s.y, 80 * this.area, s.damage * .6, 9, 18, s.kind);
        }
        const dx = s.x - x, dy = s.y - y, length = dx * dx + dy * dy;
        for (const e of this.nearby((x + s.x) / 2, (y + s.y) / 2, Math.sqrt(length) / 2 + s.radius + 50)) if (e.alive && s.remaining > 0 && this.time >= (s.hits.get(e.id) || 0)) {
          const t = length ? clamp(((e.x - x) * dx + (e.y - y) * dy) / length, 0, 1) : 0;
          if (Math.hypot(e.x - x - t * dx, e.y - y - t * dy) < e.radius + s.radius) {
            s.hits.set(e.id, this.time + (s.kind === 'rune' ? .35 : 100)); s.remaining--;
            const critical = s.evolved && s.kind === 'pistol' && this.random() < Math.min(.75, .3 * this.luck);
            this.hurtEnemy(e, s.damage * (critical ? 3 : s.evolved && s.kind === 'sling' && e.boss ? 2 : 1), s.kind === 'sling' ? 24 : 7, s.kind);
            const ballistic = BALLISTICS[s.kind];
            if (ballistic?.splashRadius) this.explode(e.x, e.y, ballistic.splashRadius * this.area, s.damage * ballistic.splashScale, ballistic.ink, 8, s.kind);
            if(s.evolved){
              if(s.kind==='crossbow'&&e.alive)this.freezes.set(e.id,this.time+(e.boss ? .15 : .65));
              if(s.kind==='gauss')this.explode(e.x,e.y,60*this.area,s.damage*.25,9,8,s.kind);
              if(s.kind==='plasmaMinigun'&&!e.alive)this.explode(e.x,e.y,70*this.area,s.damage*.6,10,10,s.kind);
              if(s.kind==='flamethrower'&&e.alive){const old=this.burnMarks.get(e.id);this.burnMarks.set(e.id,{expires:this.time+2.5,next:old?.next??this.time+.5,damage:Math.max(old?.damage||0,s.damage*.35)});}
              if(s.kind==='electropistol'){
                const points=[{x:e.x,y:e.y}];let from=e;
                for(let jump=0;jump<2;jump++){
                  let target=null,distance=150;
                  for(const other of this.nearby(from.x,from.y,200))if(other.alive&&!s.hits.has(other.id)){const d=Math.hypot(other.x-from.x,other.y-from.y);if(d<distance){target=other;distance=d;}}
                  if(!target)break;s.hits.set(target.id,this.time+100);points.push({x:target.x,y:target.y});this.hurtEnemy(target,s.damage*(jump ? .35 : .55),0,s.kind);from=target;
                }
                if(points.length>1)this.arcs.push({points,life:.22,maxLife:.22,weapon:s.kind});
              }
            }
            if (s.evolved && ['fireball', 'sling'].includes(s.kind)) this.explode(e.x, e.y, 80 * this.area, s.damage * .4, s.kind === 'sling' ? 7 : 12, 18, s.kind);
          }
        }
      }
      this.relics = this.relics.filter(s => s.life > 0 && s.remaining > 0 && s.x >= 0 && s.y >= 0 && s.x <= this.width && s.y <= this.height);
      for (const b of this.biblePositions()) for (const e of this.nearby(b.x, b.y, 60)) if (e.alive && this.time >= (this.bibleHits.get(e.id) || 0) && Math.hypot(e.x - b.x, e.y - b.y) < e.radius + 20) { this.bibleHits.set(e.id, this.time + .35); this.hurtEnemy(e, (15 + this.levels.bible * 8) * this.power * (this.isEvolved('bible') ? 1.6 : 1), 22, 'bible'); }
      if (this.steps % 60 === 0) for (const map of [this.freezes,this.bibleHits,this.waterHits]) for (const [id,until] of map) if (until<=this.time) map.delete(id);
    }
    updateWeapons(dt) {
      const p = this.player;
      this.updateRelics(dt);
      this.weaponClocks.blades = Math.max(0, this.weaponClocks.blades - dt);
      if (this.fireMode === 'manual' && this.wantsFire('blades') && this.weaponClocks.blades <= 0) { this.castSlash(); this.consumeAttack('blades'); this.weaponClocks.blades = .65 * BALANCE.weaponCooldown / this.haste; }
      for (const id in CASTS) if (this.levels[id]) {
        const [method, cooldown] = CASTS[id];
        this.weaponClocks[id] = Math.max(0, this.weaponClocks[id] - dt);
        if (this.weaponClocks[id] <= 0 && this.wantsFire(id)) { this[method](); this.consumeAttack(id); this.weaponClocks[id] = (id === 'boomerang' && this.isEvolved(id) ? .7 : cooldown) * BALANCE.weaponCooldown / this.haste; }
      }
      if (this.levels.poison) {
        this.weaponClocks.poison = Math.max(0, this.weaponClocks.poison - dt);
        if (this.weaponClocks.poison <= 0 && this.wantsFire('poison')) {
          this.castPoison(); this.consumeAttack('poison'); this.weaponClocks.poison = .75 * BALANCE.weaponCooldown / this.haste;
        }
      }
      for (const b of this.boomerangs) {
        b.prevX = b.x; b.prevY = b.y; b.age += dt;
        if (b.age >= .65) {
          const dx = p.x - b.x, dy = p.y - b.y, distance = Math.hypot(dx, dy) || 1;
          if (distance < 24) { b.done = true; continue; }
          b.vx = dx / distance * 570 * this.projectileSpeed; b.vy = dy / distance * 570 * this.projectileSpeed;
        }
        b.x += b.vx * dt; b.y += b.vy * dt;
        for (const e of this.nearby(b.x, b.y, 50)) if (e.alive && this.time >= (b.hits.get(e.id) || 0) && Math.hypot(e.x - b.x, e.y - b.y) < e.radius + 16) {
          b.hits.set(e.id, this.time + .4); this.hurtEnemy(e, b.damage, 4, 'boomerang');
        }
      }
      this.boomerangs = this.boomerangs.filter(b => !b.done && b.age < 2.5);
      for (const pool of this.pools) {
        pool.life -= dt;
        if (pool.home) { const dx = p.x - pool.x, dy = p.y - pool.y, d = Math.hypot(dx, dy) || 1, step = Math.min(d, 35 * dt); pool.x += dx / d * step; pool.y += dy / d * step; pool.radius = Math.min(180 * this.area, pool.radius + dt * 8); }
        for (const e of this.nearby(pool.x, pool.y, pool.radius + 35)) if (e.alive && this.time >= (pool.kind === 'water' ? this.waterHits.get(e.id)||0 : e.poisonAt) && Math.hypot(e.x - pool.x, e.y - pool.y) < pool.radius + e.radius) {
          if (pool.kind === 'water') this.waterHits.set(e.id,this.time+.4); else e.poisonAt=this.time+.4;
          this.hurtEnemy(e, pool.kind === 'water' ? pool.damage : (5 + this.levels.poison * 3) * this.power * (pool.acid ? 2 : 1), 0, pool.kind === 'water' ? 'water' : 'poison'); if (pool.acid) e.chilledTill = this.time + 1;
        }
      }
      this.pools = this.pools.filter(pool => pool.life > 0);
      if (this.holyMarks.size) {
        const markedAlive = new Set();
        for (const e of this.enemies) { const mark = this.holyMarks.get(e.id); if (!mark || !e.alive || mark.expires <= this.time) continue; markedAlive.add(e.id); if (this.time >= mark.next) { mark.next = this.time + .5; this.hurtEnemy(e,mark.damage*(this.isEvolved('lightStaff')&&e.hp<e.maxHp*.5?1.5:1),0,'lightStaff'); } }
        for (const id of this.holyMarks.keys()) if (!markedAlive.has(id)) this.holyMarks.delete(id);
      }
      if(this.burnMarks.size){
        const burningAlive=new Set();
        for(const e of this.enemies){const burn=this.burnMarks.get(e.id);if(!burn||!e.alive||burn.expires<this.time)continue;burningAlive.add(e.id);if(this.time>=burn.next){burn.next=this.time+.5;this.hurtEnemy(e,burn.damage,0,'flamethrower');}}
        for(const id of this.burnMarks.keys())if(!burningAlive.has(id))this.burnMarks.delete(id);
      }
      for (const m of this.meteors) {
        m.wait -= dt;
        if (m.wait <= 0) {
          const weapon = m.kind === 'hammer' ? 'hammer' : m.kind === 'echo' ? 'lightning' : m.kind === 'bird' ? 'birds' : m.kind === 'ebony' ? 'ebony' : 'meteor';
          for (const e of this.nearby(m.x, m.y, m.radius + 35)) if (e.alive && Math.hypot(e.x - m.x, e.y - m.y) < m.radius + e.radius) this.hurtEnemy(e, m.damage, m.kind === 'hammer' ? 48 : 24, weapon);
          this.rings.push({ x: m.x, y: m.y, radius: m.radius, life: .5, maxLife: .5, ink: 6, glyph: '#', weapon });
          this.burst(m.x, m.y, 7, 16, weapon);
        }
      }
      this.meteors = this.meteors.filter(m => m.wait > 0);
      for (const arc of this.arcs) arc.life -= dt;
      this.arcs = this.arcs.filter(arc => arc.life > 0);
      for (const slash of this.slashes) slash.life -= dt;
      this.slashes = this.slashes.filter(s => s.life > 0);
    }
    queueSummons(e, kind, count) {
      if (e.arenaMember && this.encounter?.phase === 'locked') {
        const inside = this.enemies.filter(enemy => enemy.alive && enemy.arenaMember && !enemy.boss).length + this.summons.filter(summon => summon.arenaMember).length;
        count = Math.min(count, Math.max(0, (this.isFirstBoss(e) ? BALANCE.firstBossMinions : BALANCE.arenaSummonLimit) - inside));
      }
      for (let i = 0; i < count && this.summons.length < 24; i++) {
        const angle = this.random() * TAU, distance = 55 + this.random() * 40;
        this.summons.push({ kind, x: clamp(e.x + Math.cos(angle) * distance, 28, this.width - 28), y: clamp(e.y + Math.sin(angle) * distance, 28, this.height - 28), arenaMember: e.arenaMember });
      }
    }
    enemySkill(e) {
      if (e.ai === 'darklord') {
        const angle = Math.atan2(e.chargeY, e.chargeX), radius = Math.min(this.width, this.height) / 2;
        for (const offset of [-.45, 0, .45]) {
          const a = angle + offset, dx = Math.cos(a), dy = Math.sin(a), px = this.player.x - e.x, py = this.player.y - e.y;
          this.bossWhips.push({ x: e.x, y: e.y, angle: a, radius, life: .4 });
          if (px * dx + py * dy > 0 && px * dx + py * dy < radius && Math.abs(px * dy - py * dx) < this.player.radius + 18) this.hurtPlayer(e.damage);
        }
        if (this.enemyShots.length > 216) this.enemyShots.splice(0, this.enemyShots.length - 216);
        for (let i = 0; i < 40; i++) { const a = i * TAU / 20 + (i >= 20 ? .12 : 0); this.enemyShots.push({ x: e.x, y: e.y, prevX: e.x, prevY: e.y, vx: Math.cos(a) * (i < 20 ? 135 : 95), vy: Math.sin(a) * (i < 20 ? 135 : 95), life: 7, damage: e.damage * .6, radius: 7, ink: 13, glyph: 'o' }); }
      } else if (e.ai === 'ranged') {
        const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x), count = e.kind === 'lich' || this.isFirstBoss(e) ? 1 : 3;
        for (let i = 0; i < count && this.enemyShots.length < 256; i++) {
          const a = angle + (i - (count - 1) / 2) * .22, speed = e.projectileSpeed || 175;
          this.enemyShots.push({ x: e.x, y: e.y, prevX: e.x, prevY: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 4, damage: e.damage * (e.projectileDamageScale ?? .8), radius: 7, ink: e.ink, glyph: e.kind === 'pumpkin' ? 'o' : '~' });
        }
        if (e.kind === 'lichLord') this.queueSummons(e, 'skeleton', this.isFirstBoss(e) ? 2 : 3);
      } else if (e.ai === 'summoner') {
        this.queueSummons(e, 'ghoul', 3); this.queueSummons(e, 'mummy', 1);
      } else if (e.ai === 'blink') {
        this.burst(e.x, e.y, e.ink, 10); e.x = e.targetX; e.y = e.targetY; e.prevX = e.x; e.prevY = e.y;
        this.resolveTerrain(e); this.resolveArena(e); e.prevX = e.x; e.prevY = e.y;
        this.burst(e.x, e.y, e.ink, 10);
      } else if (e.ai === 'charge') {
        e.chargeTime = e.roster ? e.movement.chargeDuration : e.boss ? .65 : .45;
        if (e.kind === 'alienQueen') this.queueSummons(e, 'alien', 2);
      }
    }
    updateEnemy(e, dt) {
      if(e.trainingDummy){e.flash=Math.max(0,e.flash-dt);return;}
      if ((this.freezes.get(e.id) || 0) > this.time) { e.flash = Math.max(0, e.flash - dt); return; }
      const p = this.player, ex = p.x - e.x, ey = p.y - e.y, d = Math.hypot(ex, ey) || 1;
      if (!e.boss && d > this.spawnRadius * (e.ai === 'direct' ? 2.8 : 4)) { e.alive = false; return; }
      if (e.boss && !e.arenaMember && d > this.spawnRadius * 3) { const angle = this.random() * TAU; e.x = clamp(p.x + Math.cos(angle) * (this.spawnRadius + 100), 28, this.width - 28); e.y = clamp(p.y + Math.sin(angle) * (this.spawnRadius + 100), 28, this.height - 28); this.resolveTerrain(e); e.prevX = e.x; e.prevY = e.y; return; }
      const slow = e.chilledTill > this.time ? .4 : 1;
      const lateSpeed = e.boss || this.stressMode ? 1 : 1 + Math.min(.15, Math.max(0, this.pressureTime - 360) / 1200);
      let vx = ex / d, vy = ey / d, speed = e.speed * Math.min(1.85, 1 + this.waveAge / 750) * lateSpeed * slow;
      if (e.roster) {
        EnemySystem.movement[e.movement.type](e, ex, ey, d, this.time); vx = e.moveX; vy = e.moveY;
        speed = e.speed * Math.min(1.5, 1 + this.pressureTime / 6000) * lateSpeed * slow;
      } else if (e.ai === 'weave') { const weave = Math.sin(this.time * 5 + e.phase) * .7; vx -= ey / d * weave; vy += ex / d * weave; }
      if (e.ai === 'ranged') speed *= d > 380 ? 1 : d < (this.isFirstBoss(e) ? 140 : 230) ? -.65 : 0;
      e.skillClock = Math.max(0, e.skillClock - dt);
      if (e.summon && e.skillClock === 0) { this.queueSummons(e, e.summon.kind, e.summon.count); e.skillClock = e.summon.interval; }
      if (e.roster && e.ai === 'charge' && e.skillClock > e.movement.trackingDuration) speed = 0;
      if (e.windup > 0) {
        speed = 0; e.windup = Math.max(0, e.windup - dt);
        if (e.windup === 0) this.enemySkill(e);
      } else if (e.chargeTime > 0) {
        e.chargeTime = Math.max(0, e.chargeTime - dt); vx = e.chargeX; vy = e.chargeY; speed = (e.boss ? 380 : 340) * slow;
        if (e.roster && e.chargeTime === 0) e.skillClock = e.movement.recoveryDuration + e.movement.trackingDuration;
      } else if (e.skill && e.skillClock <= 0 && d < (e.ai === 'charge' ? 620 : 850)) {
        e.skillClock = this.isFirstBoss(e) ? BALANCE.firstBossSkill : e.skill; e.windup = e.roster ? e.movement.windupDuration : e.ai === 'darklord' ? 1.6 : e.ai === 'blink' ? .95 : e.boss ? .8 : .6;
        e.chargeX = ex / d; e.chargeY = ey / d;
        const angle = this.random() * TAU;
        e.targetX = clamp(p.x + Math.cos(angle) * 150, 28, this.width - 28);
        e.targetY = clamp(p.y + Math.sin(angle) * 150, 28, this.height - 28);
        speed = 0;
      }
      this.moveEntity(e, vx * speed * dt, vy * speed * dt, e.chargeTime <= 0);
      e.flash = Math.max(0, e.flash - dt);
    }
    updateEnemyShots(dt) {
      const p = this.player;
      for (const shot of this.enemyShots) {
        const x = shot.x, y = shot.y; shot.prevX = x; shot.prevY = y;
        shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
        const arena = this.encounter;
        if (arena?.phase === 'locked' && (Math.hypot(x - arena.x, y - arena.y) < arena.radius) !== (Math.hypot(shot.x - arena.x, shot.y - arena.y) < arena.radius)) { shot.life = 0; continue; }
        const dx = shot.x - x, dy = shot.y - y, lengthSq = dx * dx + dy * dy;
        const t = lengthSq ? clamp(((p.x - x) * dx + (p.y - y) * dy) / lengthSq, 0, 1) : 0;
        if (Math.hypot(p.x - x - t * dx, p.y - y - t * dy) < p.radius + shot.radius) { this.hurtPlayer(shot.damage); shot.life = 0; }
      }
      this.enemyShots = this.enemyShots.filter(s => s.life > 0 && s.x > 0 && s.x < this.width && s.y > 0 && s.y < this.height);
    }
    update(dt) {
      if (this.status !== 'running') return;
      dt = clamp(dt, 0, .05);
      this.time += dt; this.steps++; this.leechBudget = Math.min(2,this.leechBudget+dt*.6);
      if (Math.floor(this.time / 60) > Math.floor((this.time - dt) / 60)) this.awardGold(5);
      const p = this.player;
      p.prevX = p.x; p.prevY = p.y;
      p.invulnerable = Math.max(0, p.invulnerable - dt); p.dashReady = Math.max(0, p.dashReady - dt);
      this.damageFlash = Math.max(0, this.damageFlash - dt);
      this.healPlayer((this.levels.regen * .2 + this.levels.leftSign * .1) * dt);
      let dx = this.input.x, dy = this.input.y, len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      if (p.dash > 0) {
        p.dash = Math.max(0, p.dash - dt); dx = p.dirX * 3.3; dy = p.dirY * 3.3;
        this.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: .18, ink: 2 });
      } else if (len > .05) {
        p.dirX = dx / Math.hypot(dx, dy); p.dirY = dy / Math.hypot(dx, dy);
      }
      this.moveEntity(p, dx * this.speed * dt, dy * this.speed * dt);

      if(!this.sandboxMode){
      this.spawnClock -= dt;
      if (this.spawnClock <= 0) this.spawnWave();
      const megaAge = this.stressMode ? this.elapsed + this.pressureOffset : this.elapsed;
      if (!this.encounter && megaAge >= this.nextMegaAt && this.enemies.length < this.enemyLimit && !this.enemies.some(e => e.alive && e.boss)) {
        const boss = this.spawn('darVetro'); this.nextMegaAt = (Math.floor(megaAge / 600) + 1) * 600; this.lastBoss = boss.title; this.events.push('mega-boss');
      } else if (!this.encounter && this.pressureTime >= this.nextBossAt && this.enemies.length < this.enemyLimit && !this.enemies.some(e => e.alive && e.boss)) this.beginEncounter();
      this.updateEncounter(dt);
      const rosterBoss = ROSTER_BOSSES[this.rosterBossIndex % ROSTER_BOSSES.length];
      const rosterAt = ENEMIES[rosterBoss].at + Math.floor(this.rosterBossIndex / ROSTER_BOSSES.length) * 1800;
      if (!this.encounter && megaAge >= rosterAt && !this.enemies.some(e => e.alive && e.boss) && this.enemies.length < this.enemyLimit) {
        const boss = this.spawn(rosterBoss); this.rosterBossIndex++; this.lastBoss = boss.title; this.events.push(boss.mega ? 'mega-boss' : 'boss');
      }
      } else if(!this.enemies.some(e=>e.alive)) {
        this.sandboxClock+=dt;if(this.sandboxClock>=1){this.spawnSandboxTargets();this.sandboxClock=0;}
      } else this.sandboxClock=0;
      this.peakEnemies = Math.max(this.peakEnemies, this.enemies.length);
      for (const e of this.enemies) if (e.alive) {
        e.prevX = e.x; e.prevY = e.y;
        this.updateEnemy(e, dt);
      }
      for (const summon of this.summons) { if (this.enemies.length >= this.enemyLimit - (this.encounter?.phase === 'warning' ? 1 : 0)) break; this.spawn(summon.kind, summon.x, summon.y, summon.arenaMember); }
      this.summons.length = 0;
      this.updateEnemyShots(dt);
      this.buildGrid();
      // Bound local separation work even when thousands of enemies crowd one cell.
      this.separateCrowd();
      this.buildGrid();
      this.shootClock = Math.max(0, this.shootClock - dt);
      if (this.shootClock <= 0 && this.wantsFire('needle')) { this.fire(); this.consumeAttack('needle'); this.shootClock = this.cooldown; }
      for (const s of this.shots) {
        const oldX = s.x, oldY = s.y;
        s.prevX = oldX; s.prevY = oldY;
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        const sx = s.x - oldX, sy = s.y - oldY, lengthSq = sx * sx + sy * sy;
        for (const e of this.nearby((oldX + s.x) / 2, (oldY + s.y) / 2, Math.sqrt(lengthSq) / 2 + 40)) {
          if (!e.alive || s.hits.has(e.id) || s.remaining <= 0) continue;
          const t = lengthSq ? clamp(((e.x - oldX) * sx + (e.y - oldY) * sy) / lengthSq, 0, 1) : 0;
          if (Math.hypot(e.x - oldX - t * sx, e.y - oldY - t * sy) < e.radius + 5) {
            s.hits.add(e.id); s.remaining--; this.hurtEnemy(e, s.damage, 9, 'needle');
            this.burst(e.x, e.y, 7, 3, 'needle');
          }
        }
      }
      this.shots = this.shots.filter(s => s.life > 0 && s.remaining > 0);

      for (const b of this.bladePositions()) for (const e of this.nearby(b.x, b.y, 48)) {
        if (e.alive && this.time - e.bladeAt > .35 * BALANCE.weaponCooldown && Math.hypot(e.x - b.x, e.y - b.y) < e.radius + 19) {
          e.bladeAt = this.time; this.hurtEnemy(e, (23 + this.levels.blades * 5) * this.power * (this.isEvolved('blades') ? 1.8 : 1), 13, 'blades');
        }
      }
      if (this.levels.pulse) {
        this.pulseClock = Math.max(0, this.pulseClock - dt);
        if (this.pulseClock <= 0 && this.wantsFire('pulse')) {
          this.castPulse(); this.consumeAttack('pulse'); this.pulseClock = 5 * BALANCE.weaponCooldown / this.haste; this.events.push('pulse');
        }
      }
      this.updateWeapons(dt);
      for (const e of this.enemies) if (e.alive && Math.hypot(e.x - p.x, e.y - p.y) < p.radius + e.radius) this.hurtPlayer(e.damage, e);
      this.enemies = this.enemies.filter(e => e.alive);

      for (const gem of this.gems) {
        const gx = p.x - gem.x, gy = p.y - gem.y, d = Math.hypot(gx, gy);
        if (d < this.magnet) gem.magnetized = true;
        if (gem.magnetized && d > 1) { const step = Math.min(d, (290 + (1 - Math.min(d / 300, 1)) * 280) * dt); gem.x += gx / d * step; gem.y += gy / d * step; }
        if (d < 18 && this.status === 'running') { gem.taken = true; if (this.gemBins.get(gem.bin) === gem) this.gemBins.delete(gem.bin); this.grantXP(gem.value); }
      }
      this.gems = this.gems.filter(g => !g.taken);
      this.checkLevel();
      for (const heart of this.hearts) if (p.hp < p.maxHp && Math.hypot(p.x - heart.x, p.y - heart.y) < 27 && this.status === 'running') {
        this.healPlayer(heart.value); this.combat.record('heartsTaken', 1); heart.taken = true; this.burst(p.x, p.y, 3, 10);
      }
      this.hearts = this.hearts.filter(h => !h.taken && (!h.expires || h.expires > this.time)).slice(-128);
      if (this.status === 'running') {
        const crate = this.supplyCrates.find(c => !this.supplyTaken.has(c.id) && Math.hypot(c.x - p.x, c.y - p.y) < 32);
        if (crate) this.openSupply(crate);
      }
      if (this.status === 'running') {
        const cache = this.treasures.find(c => !this.treasuresTaken.has(c.id) && Math.hypot(c.x - p.x, c.y - p.y) < 32);
        if (cache) {
          this.treasuresTaken.add(cache.id); const found = { id: this.nextChestId++, source: 'lichLord', x: cache.x, y: cache.y, radius: 20, canEvolve: false, treasure: true };
          this.chests.push(found); this.openChest(found);
        }
        const chest = this.chests.find(c => Math.hypot(c.x - p.x, c.y - p.y) < 38);
        if (chest) this.openChest(chest);
      }
      for (const particle of this.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; }
      this.particles = this.particles.filter(p => p.life > 0).slice(-450);
      for (const ring of this.rings) ring.life -= dt;
      this.rings = this.rings.filter(r => r.life > 0).slice(-256);
      for (const whip of this.bossWhips) whip.life -= dt; this.bossWhips = this.bossWhips.filter(w => w.life > 0);
      this.combat.sample(dt, this);
    }
  }
  root.NightMeta = META; root.NightGame = NightGame; root.NightEnemies = ENEMIES; root.NightUpgrades = UPGRADES; root.NightCharacters = CHARACTERS; root.NightSlots = SLOTS; root.NightWorld = WORLD; root.NightBalance = BALANCE;root.NightForestGround=forestGround;
})(typeof globalThis !== 'undefined' ? globalThis : window);
