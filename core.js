(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const ENEMIES = {
    ghoul: { title: 'Зомби', text: 'Медленная толпа, которая берёт числом.', at: 0, weight: 30, hp: 18, speed: 52, radius: 12, damage: 10, xp: 1, ink: 3, glyph: 'z', sprite: 'z' },
    bat: { title: 'Летучая мышь', text: 'Подлетает по извилистой траектории.', at: 9, weight: 18, ai: 'weave', hp: 12, speed: 104, radius: 10, damage: 8, xp: 1, ink: 5, glyph: 'v', sprite: '<v>' },
    skeleton: { title: 'Скелет', text: 'Крепче зомби, но боится огня.', at: 24, weight: 20, hp: 40, speed: 65, radius: 14, damage: 12, xp: 2, ink: 4, glyph: 'S', sprite: 'S' },
    brute: { title: 'Громила', text: 'Большой запас здоровья и тяжёлый удар.', at: 65, weight: 8, hp: 125, speed: 35, radius: 23, damage: 22, xp: 6, ink: 6, glyph: 'O', sprite: ',_,\n[O]\n/ \\' },
    mummy: { title: 'Мумия', text: 'Проклятые бинты замедляют при попадании.', at: 18, weight: 15, hp: 58, speed: 43, radius: 15, damage: 12, slow: 1.8, xp: 3, ink: 4, glyph: '=', sprite: '[=]\n/=\\' },
    spider: { title: 'Могильный паук', text: 'Быстро обходит героя с фланга.', at: 32, weight: 12, ai: 'weave', hp: 23, speed: 92, radius: 12, damage: 9, xp: 2, ink: 3, glyph: 'm', sprite: '/\\o/\\' },
    pumpkin: { title: 'Джек-о-Лантерн', text: 'Хэллоуинская тыква бросает веер огненных шаров.', at: 42, weight: 8, ai: 'ranged', skill: 3.5, hp: 75, speed: 46, radius: 19, damage: 15, xp: 4, ink: 12, glyph: 'o', sprite: ' _|_\n{o.o}\n \\_/' },
    lich: { title: 'Лич', text: 'Держит дистанцию и стреляет проклятиями.', at: 55, weight: 8, ai: 'ranged', skill: 3, hp: 85, speed: 58, radius: 16, damage: 15, xp: 5, ink: 5, glyph: 'L', sprite: ' /\\\n{L}\n /\\' },
    vampire: { title: 'Вампир', text: 'Стремительно кружит вокруг своей жертвы.', at: 75, weight: 10, ai: 'weave', hp: 72, speed: 118, radius: 14, damage: 17, xp: 4, ink: 5, glyph: 'V', sprite: '\\V/\n(V)\n/\\' },
    werewolf: { title: 'Оборотень', text: 'Замирает перед быстрым броском вперёд.', at: 90, weight: 9, ai: 'charge', skill: 4.5, hp: 130, speed: 74, radius: 20, damage: 20, xp: 6, ink: 4, glyph: 'w', sprite: '/^\\\n{w}\n/ \\' },
    alien: { title: 'Чужой', text: 'Ксеноморф атакует рывком по намеченной линии.', at: 110, weight: 9, ai: 'charge', skill: 3.8, hp: 155, speed: 84, radius: 20, damage: 23, xp: 7, ink: 2, glyph: 'X', sprite: '/===\\\n (X)~\n /|\\' },
    lichLord: { title: 'Лич-лорд', text: 'Босс: проклятия и призыв скелетов.', boss: true, ai: 'ranged', skill: 2.8, hp: 1100, speed: 54, radius: 29, damage: 24, xp: 45, ink: 5, glyph: 'W', sprite: ' \\W/\n [L]\n/| |\\' },
    british: { title: 'Зомби-лорд Бритиш', text: 'Босс: поднимает зомби и мумий вокруг себя.', boss: true, ai: 'summoner', skill: 5, hp: 1800, speed: 39, radius: 31, damage: 30, xp: 55, ink: 6, glyph: 'B', sprite: ',W,\n[B]\n/|\\' },
    freddy: { title: 'Фредди Крюгер', text: 'Босс: метит место появления и телепортируется.', boss: true, ai: 'blink', skill: 4, hp: 1350, speed: 67, radius: 25, damage: 26, xp: 50, ink: 6, glyph: 'F', sprite: '_===_\n (F)/\n /|\\' },
    jason: { title: 'Джейсон Вурхиз', text: 'Босс: медленно преследует и делает тяжёлый рывок.', boss: true, ai: 'charge', skill: 4, hp: 2200, speed: 42, radius: 28, damage: 36, xp: 60, ink: 4, glyph: 'J', sprite: ' ._.\n[:;]/\n/|\\' },
    alienQueen: { title: 'Матка Чужих', text: 'Босс: рывки и выводок ксеноморфов.', boss: true, ai: 'charge', skill: 4.8, hp: 2400, speed: 58, radius: 34, damage: 32, xp: 65, ink: 2, glyph: 'Q', sprite: ' /W\\\n(XXX)~\n/| |\\' },
    reaper: { title: 'Жнец', text: 'Босс: неотступно преследует героя.', boss: true, hp: 1000, speed: 61, radius: 32, damage: 28, xp: 35, ink: 6, glyph: 'W', sprite: ' /W\\\n (x)\n/| |\\' }
  };
  const UPGRADES = [
    { id: 'needle', title: 'Огненная игла', icon: '*', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Огненные снаряды летят в ближайшую цель. Ступени усиливают урон и скорость стрельбы.' },
    { id: 'power', title: 'Сила проклятия', icon: '*', kind: 'УРОН', max: 5, text: 'Всё оружие наносит на 35% больше урона.' },
    { id: 'haste', title: 'Быстрый ритуал', icon: '>>', kind: 'СКОРОСТЬ ОГНЯ', max: 5, text: 'Всё оружие срабатывает на 22% чаще.' },
    { id: 'fork', title: 'Раздвоение', icon: '\\|/', kind: 'СНАРЯДЫ', max: 3, text: 'Ещё один огненный снаряд при каждом выстреле.' },
    { id: 'blades', title: 'Лунные клинки', icon: '/@/', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Клинок вращается вокруг тебя и режет врагов. Повторный выбор добавляет клинок.' },
    { id: 'pulse', title: 'Мёртвый колокол', icon: '((+))', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Волна наносит урон и отбрасывает врагов. Ступени усиливают урон и радиус.' },
    { id: 'lightning', title: 'Цепная молния', icon: '/Z/', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Молния перескакивает между врагами. Ступени добавляют цели и урон.' },
    { id: 'boomerang', title: 'Серп возврата', icon: '<)>', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Летит к врагу и возвращается к герою, поражая цели в обе стороны.' },
    { id: 'frost', title: 'Ледяная печать', icon: '{*}', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Ледяное кольцо ранит и замедляет толпу. Ступени усиливают заморозку и радиус.' },
    { id: 'meteor', title: 'Звездопад', icon: '[X]', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Помечает цель и обрушивает метеорит с взрывом. На III ступени падают два.' },
    { id: 'poison', title: 'Чумной след', icon: '~x~', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Оставляет ядовитые лужи за героем. Ступени увеличивают урон и время действия.' },
    { id: 'stride', title: 'Теневой шаг', icon: '-->', kind: 'ДВИЖЕНИЕ', max: 3, text: 'Скорость бега +15%. Рывок восстанавливается быстрее.' },
    { id: 'magnet', title: 'Собиратель душ', icon: '<*>', kind: 'ОПЫТ', max: 3, text: 'Радиус притяжения осколков опыта +65.' },
    { id: 'vital', title: 'Алое сердце', icon: '[+]', kind: 'ЗДОРОВЬЕ', max: 4, text: 'Максимум здоровья +25. Сразу восстанавливает 40 здоровья.' },
    { id: 'regen', title: 'Живая кровь', icon: '+', kind: 'ВОССТАНОВЛЕНИЕ', max: 3, text: 'Восстанавливает 0,7 здоровья каждую секунду.' },
    { id: 'pierce', title: 'Проклятая игла', icon: '--*', kind: 'ПРОБИТИЕ', max: 3, text: 'Каждый снаряд пробивает ещё одного врага.' }
  ];
  const CHARACTERS = [
    { id: 'hunter', name: 'Мара', role: 'Охотница', weapon: 'needle', hp: 100, speed: 172, magnet: 82, dash: 3.4, ink: 8, sprite: ' ^\n/@\\\n/ \\', text: 'Точный огонь. Надёжный герой для первого забега.' },
    { id: 'duelist', name: 'Тень', role: 'Дуэлянт', weapon: 'blades', hp: 95, speed: 192, magnet: 82, dash: 2.6, ink: 4, sprite: ' /\\\n<&>\n/ \\', text: 'Быстрый боец с клинком на орбите и частым рывком.' },
    { id: 'witch', name: 'Искра', role: 'Ведьма', weapon: 'lightning', hp: 85, speed: 180, magnet: 105, dash: 3.4, ink: 5, sprite: ' /\\\n/{\\\n/ \\', text: 'Цепная молния поражает несколько врагов сразу.' },
    { id: 'warden', name: 'Север', role: 'Страж', weapon: 'frost', hp: 150, speed: 154, magnet: 82, dash: 3.8, ink: 9, sprite: ' _\n[#]\n/ \\', text: 'Много здоровья. Ледяная печать замедляет окружение.' },
    { id: 'scout', name: 'Руна', role: 'Следопыт', weapon: 'boomerang', hp: 90, speed: 200, magnet: 95, dash: 3, ink: 7, sprite: ' v\n(%>\n/ \\', text: 'Самый быстрый герой. Серп бьёт по пути туда и обратно.' },
    { id: 'plague', name: 'Мор', role: 'Алхимик', weapon: 'poison', hp: 110, speed: 168, magnet: 147, dash: 3.4, ink: 3, sprite: ' _\n(x)\n/ \\', text: 'Веди толпу по ядовитому следу. Собирает души издалека.' }
  ];
  const CASTS = { lightning: ['castLightning', 2.4], boomerang: ['castBoomerang', 1.7], frost: ['castFrost', 4.2], meteor: ['castMeteor', 3.2] };
  const SLOTS = ['needle', 'blades', 'pulse', 'lightning', 'boomerang', 'frost', 'meteor', 'poison', null];
  const WORLD = Object.freeze({ width: 12800, height: 9600 });
  const BALANCE = Object.freeze({ weaponCooldown: .65, dashCooldown: .6 });
  const BOSSES = ['lichLord', 'british', 'freddy', 'jason', 'alienQueen', 'reaper'];
  const TERRAIN_TYPES = [
    { kind: 'grave', w: 46, h: 46, sprite: ' ._.\n |+|\n_|_|_', ink: 1 },
    { kind: 'rock', w: 60, h: 42, sprite: ' .--.\n/####\\\n\\____/', ink: 1 },
    { kind: 'tree', w: 46, h: 58, sprite: ' \\|/\n--Y--\n  |\n /|\\', ink: 3 },
    { kind: 'crypt', w: 76, h: 54, sprite: ' _____\n|[_+_]|\n|_|||_|', ink: 1 },
    { kind: 'wall', w: 84, h: 30, sprite: '[]===[]\n[]===[]', ink: 1 }
  ];
  function terrainHash(x, y) {
    let value = Math.imul(x ^ 0x64ab, 374761393) ^ Math.imul(y ^ 0xf8c, 668265263);
    value = Math.imul(value ^ value >>> 13, 1274126177); return (value ^ value >>> 16) >>> 0;
  }
  function makeTerrain(width, height) {
    const cols = Math.ceil(width / 400), rows = Math.ceil(height / 320), cells = new Array(cols * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const value = terrainHash(x, y); if (value % 4 === 0) continue;
      const block = { ...TERRAIN_TYPES[value % TERRAIN_TYPES.length], x: x * 400 + 120 + value % 160, y: y * 320 + 100 + (value >>> 10) % 120 };
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
      this.terrainEnabled = options.terrain !== false; this.terrain = makeTerrain(this.width, this.height);
      this.encounter = null; this.arenaRadius = 205; this.chests = []; this.reward = null; this.chestsOpened = 0; this.nextChestId = 1;
      this.wallTime = 0; this.pressureOffset = 0; this.steps = 0;
      this.stressMode = Boolean(options.stressMode);
      this.enemyLimit = clamp(Math.floor(Number(options.enemyLimit) || 6000), 100, 24000);
      this.peakEnemies = 0; this.nextBossAt = 60; this.bossIndex = 0; this.bossKills = 0; this.lastBoss = '';
      this.runId = this.seed + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      this.encountered = new Set(); this.enemyShots = []; this.summons = [];
      this.status = 'ready'; this.time = 0; this.kills = 0; this.level = 1;
      this.xp = 0; this.xpNeed = 6; this.nextId = 1;
      this.character = CHARACTERS.find(c => c.id === characterId) || CHARACTERS[0];
      const centerX = this.width / 2, centerY = this.height / 2;
      this.player = { x: centerX, y: centerY, prevX: centerX, prevY: centerY, radius: 12, hp: this.character.hp, maxHp: this.character.hp, invulnerable: 0, dash: 0, dashReady: 0, dirX: 0, dirY: 1, slowTill: 0 };
      this.input = { x: 0, y: 0, firing: false };
      this.aim = { x: centerX, y: centerY - 300, active: false };
      this.fireMode = options.fireMode === 'manual' ? 'manual' : 'auto';
      this.selectedWeapon = this.character.weapon; this.queuedWeapon = null;
      this.enemies = []; this.shots = []; this.gems = []; this.hearts = [];
      this.particles = []; this.rings = []; this.levels = Object.fromEntries(UPGRADES.map(u => [u.id, 0]));
      this.levels[this.character.weapon] = 1;
      if (this.stressMode) for (const u of UPGRADES) this.levels[u.id] = u.max;
      this.arcs = []; this.boomerangs = []; this.pools = []; this.meteors = [];
      this.weaponClocks = { blades: 0, lightning: .25, boomerang: .25, frost: .3, meteor: .3, poison: 0 };
      this.slashes = []; this.gemBins = new Map(); this.cellPool = [];
      this.offers = []; this.shootClock = .15; this.spawnClock = .35; this.pulseClock = 1.2;
      this.spawnRadius = 650; this.bossSpawned = false; this.damageFlash = 0; this.events = [];
      this.grid = new Map();
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
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + this.random() * .2, d = 310 + this.random() * 100;
        this.spawn('ghoul', this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d);
      }
    }
    pause() {
      if (this.status === 'running') this.status = 'paused';
      else if (this.status === 'paused') this.status = 'running';
    }
    get power() { return Math.pow(1.35, this.levels.power); }
    get haste() { return Math.pow(1.22, this.levels.haste); }
    get damage() { return 20 * (1 + .25 * Math.max(0, this.levels.needle - 1)) * this.power; }
    get cooldown() { return .68 * BALANCE.weaponCooldown / this.haste / (1 + .12 * Math.max(0, this.levels.needle - 1)); }
    get speed() { return this.character.speed * (1 + .15 * this.levels.stride) * (this.player.slowTill > this.time ? .65 : 1); }
    get dashCooldown() { return this.character.dash * BALANCE.dashCooldown * Math.pow(.9, this.levels.stride); }
    get magnet() { return this.character.magnet + this.levels.magnet * 65; }
    get elapsed() { return Math.max(this.time, this.wallTime); }
    get pressureTime() { return this.elapsed + this.pressureOffset; }
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
      this.encounter = { phase: 'warning', x: this.player.x, y: this.player.y, radius: this.arenaRadius, warningLeft: 5, bossId: 0, kind: BOSSES[this.bossIndex % BOSSES.length] };
      this.events.push('arena-warning');
    }
    updateEncounter(dt) {
      const arena = this.encounter; if (!arena || arena.phase !== 'warning') return;
      arena.x = clamp(this.player.x, arena.radius + 90, this.width - arena.radius - 90);
      arena.y = clamp(this.player.y, arena.radius + 90, this.height - arena.radius - 90);
      arena.warningLeft = Math.max(0, arena.warningLeft - dt);
      if (arena.warningLeft > 0) return;
      arena.phase = 'locked'; this.resolveArena(this.player);
      for (const enemy of this.enemies) { enemy.arenaMember = 0; this.resolveArena(enemy); }
      const angle = this.random() * TAU, distance = arena.radius * .56;
      const boss = this.spawn(arena.kind, arena.x + Math.cos(angle) * distance, arena.y + Math.sin(angle) * distance, 1);
      boss.hp *= 2.5; boss.maxHp = boss.hp; boss.radius = Math.min(46, boss.radius * 1.25); boss.arenaMember = 1;
      arena.bossId = boss.id; this.bossIndex++; this.bossSpawned = true; this.lastBoss = boss.title;
      this.events.push('boss');
    }
    dropChest(enemy) {
      const chest = { id: this.nextChestId++, x: enemy.x, y: enemy.y, source: enemy.kind, radius: 20 };
      this.resolveTerrain(chest); this.chests.push(chest);
      if (this.chests.length > 64) this.chests.shift(); this.events.push('chest-drop');
    }
    applyUpgrade(upgrade) {
      if (!upgrade || this.levels[upgrade.id] >= upgrade.max) return false;
      this.levels[upgrade.id]++;
      if (upgrade.id === 'vital') { this.player.maxHp += 25; this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40); }
      if (upgrade.id === 'pulse') this.pulseClock = Math.min(this.pulseClock, .4);
      if (upgrade.id in this.weaponClocks) this.weaponClocks[upgrade.id] = Math.min(this.weaponClocks[upgrade.id], .2);
      return true;
    }
    openChest(chest) {
      if (this.status !== 'running' || !this.chests.includes(chest)) return false;
      this.chests = this.chests.filter(c => c !== chest); this.chestsOpened++;
      const roll = this.random(), count = roll < .05 ? 5 : roll < .3 ? 3 : 1, items = [];
      for (let i = 0; i < count; i++) {
        let candidates = UPGRADES.filter(u => u.weapon && this.levels[u.id] > 0 && this.levels[u.id] < u.max);
        if (!candidates.length) candidates = UPGRADES.filter(u => !u.weapon && this.levels[u.id] < u.max);
        if (!candidates.length) candidates = UPGRADES.filter(u => this.levels[u.id] < u.max);
        if (!candidates.length) break;
        const upgrade = candidates[Math.floor(this.random() * candidates.length)]; this.applyUpgrade(upgrade);
        items.push({ id: upgrade.id, rank: this.levels[upgrade.id] });
      }
      const heal = Math.min(35, this.player.maxHp - this.player.hp), xp = count * 25;
      this.player.hp += heal; this.player.invulnerable = Math.max(this.player.invulnerable, 1);
      this.xp += xp; this.reward = { id: chest.id, source: chest.source, count, items, heal, xp };
      this.status = 'reward'; this.events.push('chest-open'); return true;
    }
    claimReward() {
      if (this.status !== 'reward') return false;
      this.reward = null; this.status = 'running'; this.checkLevel(); return true;
    }
    selectSlot(slot) {
      const id = SLOTS[slot - 1]; if (!id || !this.levels[id]) return false;
      this.selectedWeapon = id; this.queuedWeapon = null; return true;
    }
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
      for (const e of this.enemies) if (e.alive) {
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
      const scale = 1 + this.pressureTime / 280;
      const enemy = { ...def, damage: def.damage * (1 + Math.floor(this.pressureTime / 180) * .12), kind, id: this.nextId++, x, y, prevX: x, prevY: y, hp: def.hp * scale, maxHp: def.hp * scale, alive: true, flash: 0, bladeAt: -10, chilledTill: 0, poisonAt: 0, phase: this.random() * TAU, skillClock: 1.5 + this.random() * 2, windup: 0, chargeTime: 0, chargeX: 0, chargeY: 0, targetX: x, targetY: y, arenaMember };
      this.resolveTerrain(enemy); this.resolveArena(enemy); enemy.prevX = enemy.x; enemy.prevY = enemy.y;
      this.enemies.push(enemy);
      this.encountered.add(kind);
      return enemy;
    }
    spawnWave() {
      const age = this.pressureTime;
      const candidates = Object.keys(ENEMIES).filter(kind => !ENEMIES[kind].boss && age >= ENEMIES[kind].at);
      let roll = this.random() * candidates.reduce((sum, kind) => sum + ENEMIES[kind].weight, 0);
      const kind = candidates.find(kind => (roll -= ENEMIES[kind].weight) < 0) || 'ghoul';
      const count = Math.min(128, 2 + Math.floor(age / 45), this.enemyLimit - this.enemies.length - (this.encounter?.phase === 'warning' ? 1 : 0));
      for (let i = 0; i < count; i++) this.spawn(kind);
      this.spawnClock += Math.max(.12, .86 - age * .0014);
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
      const key = Math.floor(x / 64) + Math.floor(y / 64) * 1024, old = this.gemBins.get(key);
      if (old && !old.taken && !old.magnetized) { old.value += value; return; }
      const gem = { x, y, value, bin: key, magnetized: false }; this.gems.push(gem); this.gemBins.set(key, gem);
    }
    burst(x, y, ink, count = 7) {
      for (let i = 0; i < count; i++) {
        const a = this.random() * TAU, speed = 20 + this.random() * 95;
        this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .3 + this.random() * .3, ink });
      }
    }
    hurtEnemy(e, damage, knockback = 0) {
      if (!e.alive) return;
      e.hp -= damage; e.flash = .12;
      if (knockback) {
        const dx = e.x - this.player.x, dy = e.y - this.player.y, d = Math.hypot(dx, dy) || 1;
        this.moveEntity(e, dx / d * knockback, dy / d * knockback);
      }
      if (e.hp > 0) return;
      e.alive = false; this.kills++;
      if (e.boss) this.bossKills++;
      if (e.boss) {
        if (this.encounter?.bossId === e.id) {
          this.encounter = null; this.nextBossAt = this.pressureTime + 90; this.resolveTerrain(this.player); this.events.push('arena-clear');
        }
        this.dropChest(e);
      }
      this.addGem(e.x, e.y, e.xp);
      if (!this.stressMode && (e.boss || this.random() < .035)) this.hearts.push({ x: e.x + 14, y: e.y, value: e.boss ? 60 : 20, expires: this.time + 120 });
      this.burst(e.x, e.y, e.ink, e.boss ? 28 : 6);
    }
    hurtPlayer(damage, source) {
      const p = this.player;
      if (this.stressMode || p.invulnerable > 0 || this.status !== 'running') return;
      p.hp = Math.max(0, p.hp - damage); p.invulnerable = .85;
      if (source?.slow) p.slowTill = this.time + source.slow;
      this.damageFlash = .26; this.events.push('hurt'); this.burst(p.x, p.y, 6, 12);
      if (source) {
        const dx = source.x - p.x, dy = source.y - p.y, d = Math.hypot(dx, dy) || 1;
        this.moveEntity(source, dx / d * 48, dy / d * 48);
      }
      if (p.hp <= 0) this.status = 'dead';
    }
    fire() {
      if (!this.levels.needle) return;
      const p = this.player;
      let closest = null, distance = 700 * 700;
      for (const e of this.enemies) if (e.alive) {
        const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
        if (d < distance) { distance = d; closest = e; }
      }
      if (this.fireMode === 'manual') closest = this.aimPoint(700);
      if (!closest) return;
      const angle = Math.atan2(closest.y - p.y, closest.x - p.x);
      const count = 1 + this.levels.fork;
      for (let i = 0; i < count; i++) {
        const spread = i === 0 ? 0 : Math.ceil(i / 2) * .11 * (i % 2 ? -1 : 1);
        const a = angle + spread;
        this.shots.push({ x: p.x, y: p.y, prevX: p.x, prevY: p.y, vx: Math.cos(a) * 490, vy: Math.sin(a) * 490, angle: a, life: 1.5, hits: new Set(), remaining: 1 + this.levels.pierce, damage: this.damage });
      }
      this.events.push('shot');
    }
    grantXP(value) { this.xp += value; this.checkLevel(); }
    checkLevel() {
      if (this.status !== 'running' || this.xp < this.xpNeed) return;
      this.xp -= this.xpNeed; this.level++;
      this.xpNeed = Math.min(5000, Math.ceil(this.xpNeed * 1.2 + 3));
      const candidates = UPGRADES.filter(u => this.levels[u.id] < u.max);
      if (!candidates.length) { this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30); return; }
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      this.offers = candidates.slice(0, 3);
      // The first choice always contains a weapon this hero does not have yet.
      if (this.level === 2 && !this.offers.some(u => u.weapon && !this.levels[u.id])) {
        const fresh = candidates.filter(u => u.weapon && !this.levels[u.id]);
        if (fresh.length) this.offers[2] = fresh[0];
      }
      this.status = 'upgrading'; this.events.push('level');
    }
    choose(index) {
      if (this.status !== 'upgrading' || !this.offers[index]) return false;
      const u = this.offers[index]; this.applyUpgrade(u);
      this.player.invulnerable = Math.max(this.player.invulnerable, .65);
      this.offers = []; this.status = 'running'; this.checkLevel();
      return true;
    }
    bladePositions() {
      const n = this.fireMode === 'auto' ? this.levels.blades : 0, result = [];
      for (let i = 0; i < n; i++) {
        const a = this.time * 3.2 * this.haste / BALANCE.weaponCooldown + i / n * TAU;
        result.push({ x: this.player.x + Math.cos(a) * 88, y: this.player.y + Math.sin(a) * 88, angle: a });
      }
      return result;
    }
    targets(x = this.player.x, y = this.player.y, radius = 620, count = 2) {
      const best = [], distances = [];
      for (const e of this.enemies) if (e.alive) {
        const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d >= radius * radius) continue;
        let i = 0; while (i < distances.length && distances[i] < d) i++;
        if (i >= count) continue;
        best.splice(i, 0, e); distances.splice(i, 0, d); if (best.length > count) { best.pop(); distances.pop(); }
      }
      return best;
    }
    castPulse() {
      const p = this.player, radius = 145 + this.levels.pulse * 18;
      this.rings.push({ x: p.x, y: p.y, radius, life: .55, maxLife: .55 });
      for (const e of this.nearby(p.x, p.y, radius + 35)) if (e.alive && Math.hypot(e.x - p.x, e.y - p.y) < radius + e.radius) this.hurtEnemy(e, (36 + this.levels.pulse * 20) * this.power, 75);
    }
    castSlash() {
      const p = this.player, aim = this.aimPoint(130), angle = Math.atan2(aim.y - p.y, aim.x - p.x), radius = 110 + this.levels.blades * 10;
      this.slashes.push({ x: p.x, y: p.y, angle, radius, life: .22 });
      for (const e of this.nearby(p.x, p.y, radius + 35)) if (e.alive && Math.hypot(e.x - p.x, e.y - p.y) < radius + e.radius) {
        const difference = Math.atan2(Math.sin(Math.atan2(e.y - p.y, e.x - p.x) - angle), Math.cos(Math.atan2(e.y - p.y, e.x - p.x) - angle));
        if (Math.abs(difference) < 1.25) this.hurtEnemy(e, (23 + this.levels.blades * 5) * this.power, 18);
      }
    }
    castPoison() {
      const p = this.fireMode === 'manual' ? this.aimPoint(360) : this.player;
      this.pools.push({ x: p.x, y: p.y, radius: 58 + this.levels.poison * 5, life: 4 + this.levels.poison * .5 });
    }
    castLightning() {
      let x = this.player.x, y = this.player.y;
      const visited = new Set(), points = [{ x, y }];
      for (let i = 0; i < 2 + this.levels.lightning; i++) {
        const enemy = i === 0 && this.fireMode === 'manual' ? this.aimedTarget() : this.targets(x, y, i ? 260 : 620, 7).find(e => !visited.has(e.id));
        if (!enemy) break;
        visited.add(enemy.id); x = enemy.x; y = enemy.y; points.push({ x, y });
        this.hurtEnemy(enemy, (24 + 8 * this.levels.lightning) * this.power);
      }
      if (points.length === 1 && this.fireMode === 'manual') points.push(this.aimPoint());
      if (points.length > 1) this.arcs.push({ points, life: .24, maxLife: .24 });
    }
    castBoomerang() {
      const target = this.fireMode === 'manual' ? this.aimPoint() : this.targets()[0];
      if (!target) return;
      const count = 1 + Math.floor(this.levels.boomerang / 3) + this.levels.fork;
      for (let i = 0; i < count; i++) {
        const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x) + (i - (count - 1) / 2) * .22;
        this.boomerangs.push({ x: this.player.x, y: this.player.y, prevX: this.player.x, prevY: this.player.y, vx: Math.cos(angle) * 370, vy: Math.sin(angle) * 370, age: 0, hits: new Map(), damage: (14 + 7 * this.levels.boomerang) * this.power });
      }
    }
    castFrost() {
      const p = this.player, level = this.levels.frost, radius = 170 + level * 20;
      this.rings.push({ x: p.x, y: p.y, radius, life: .65, maxLife: .65, ink: 9, glyph: '*' });
      for (const e of this.nearby(p.x, p.y, radius + 35)) if (e.alive && Math.hypot(e.x - p.x, e.y - p.y) < radius + e.radius) {
        e.chilledTill = this.time + 2.5 + level * .4;
        this.hurtEnemy(e, (8 + level * 6) * this.power);
      }
    }
    castMeteor() {
      const count = this.levels.meteor >= 3 ? 2 : 1;
      const targets = this.fireMode === 'manual' ? Array.from({ length: count }, (_, i) => { const aim = this.aimPoint(); return { x: aim.x + (i - (count - 1) / 2) * 55, y: aim.y }; }) : this.targets();
      for (const e of targets.slice(0, count)) this.meteors.push({ x: e.x, y: e.y, wait: .65, radius: 90 + this.levels.meteor * 12, damage: (48 + 22 * this.levels.meteor) * this.power });
    }
    updateWeapons(dt) {
      const p = this.player;
      this.weaponClocks.blades = Math.max(0, this.weaponClocks.blades - dt);
      if (this.fireMode === 'manual' && this.wantsFire('blades') && this.weaponClocks.blades <= 0) { this.castSlash(); this.consumeAttack('blades'); this.weaponClocks.blades = .65 * BALANCE.weaponCooldown / this.haste; }
      for (const id in CASTS) if (this.levels[id]) {
        const [method, cooldown] = CASTS[id];
        this.weaponClocks[id] = Math.max(0, this.weaponClocks[id] - dt);
        if (this.weaponClocks[id] <= 0 && this.wantsFire(id)) { this[method](); this.consumeAttack(id); this.weaponClocks[id] = cooldown * BALANCE.weaponCooldown / this.haste; }
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
          b.vx = dx / distance * 570; b.vy = dy / distance * 570;
        }
        b.x += b.vx * dt; b.y += b.vy * dt;
        for (const e of this.nearby(b.x, b.y, 50)) if (e.alive && this.time >= (b.hits.get(e.id) || 0) && Math.hypot(e.x - b.x, e.y - b.y) < e.radius + 16) {
          b.hits.set(e.id, this.time + .4); this.hurtEnemy(e, b.damage, 4);
        }
      }
      this.boomerangs = this.boomerangs.filter(b => !b.done && b.age < 2.5);
      for (const pool of this.pools) {
        pool.life -= dt;
        for (const e of this.nearby(pool.x, pool.y, pool.radius + 35)) if (e.alive && this.time >= e.poisonAt && Math.hypot(e.x - pool.x, e.y - pool.y) < pool.radius + e.radius) {
          e.poisonAt = this.time + .4; this.hurtEnemy(e, (5 + this.levels.poison * 3) * this.power);
        }
      }
      this.pools = this.pools.filter(pool => pool.life > 0);
      for (const m of this.meteors) {
        m.wait -= dt;
        if (m.wait <= 0) {
          for (const e of this.nearby(m.x, m.y, m.radius + 35)) if (e.alive && Math.hypot(e.x - m.x, e.y - m.y) < m.radius + e.radius) this.hurtEnemy(e, m.damage, 24);
          this.rings.push({ x: m.x, y: m.y, radius: m.radius, life: .5, maxLife: .5, ink: 6, glyph: '#' });
          this.burst(m.x, m.y, 7, 16);
        }
      }
      this.meteors = this.meteors.filter(m => m.wait > 0);
      for (const arc of this.arcs) arc.life -= dt;
      this.arcs = this.arcs.filter(arc => arc.life > 0);
      for (const slash of this.slashes) slash.life -= dt;
      this.slashes = this.slashes.filter(s => s.life > 0);
    }
    queueSummons(e, kind, count) {
      for (let i = 0; i < count && this.summons.length < 24; i++) {
        const angle = this.random() * TAU, distance = 55 + this.random() * 40;
        this.summons.push({ kind, x: clamp(e.x + Math.cos(angle) * distance, 28, this.width - 28), y: clamp(e.y + Math.sin(angle) * distance, 28, this.height - 28), arenaMember: e.arenaMember });
      }
    }
    enemySkill(e) {
      if (e.ai === 'ranged') {
        const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x), count = e.kind === 'lich' ? 1 : 3;
        for (let i = 0; i < count && this.enemyShots.length < 256; i++) {
          const a = angle + (i - (count - 1) / 2) * .22, speed = e.kind === 'pumpkin' ? 205 : 175;
          this.enemyShots.push({ x: e.x, y: e.y, prevX: e.x, prevY: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 4, damage: e.damage * .8, radius: 7, ink: e.ink, glyph: e.kind === 'pumpkin' ? 'o' : '~' });
        }
        if (e.kind === 'lichLord') this.queueSummons(e, 'skeleton', 3);
      } else if (e.ai === 'summoner') {
        this.queueSummons(e, 'ghoul', 3); this.queueSummons(e, 'mummy', 1);
      } else if (e.ai === 'blink') {
        this.burst(e.x, e.y, e.ink, 10); e.x = e.targetX; e.y = e.targetY; e.prevX = e.x; e.prevY = e.y;
        this.resolveTerrain(e); this.resolveArena(e); e.prevX = e.x; e.prevY = e.y;
        this.burst(e.x, e.y, e.ink, 10);
      } else if (e.ai === 'charge') {
        e.chargeTime = e.boss ? .65 : .45;
        if (e.kind === 'alienQueen') this.queueSummons(e, 'alien', 2);
      }
    }
    updateEnemy(e, dt) {
      const p = this.player, ex = p.x - e.x, ey = p.y - e.y, d = Math.hypot(ex, ey) || 1;
      const slow = e.chilledTill > this.time ? .4 : 1;
      let vx = ex / d, vy = ey / d, speed = e.speed * Math.min(2.2, 1 + this.pressureTime / 600) * slow;
      if (e.ai === 'weave') { const weave = Math.sin(this.time * 5 + e.phase) * .7; vx -= ey / d * weave; vy += ex / d * weave; }
      if (e.ai === 'ranged') speed *= d > 380 ? 1 : d < 230 ? -.65 : 0;
      e.skillClock = Math.max(0, e.skillClock - dt);
      if (e.windup > 0) {
        speed = 0; e.windup = Math.max(0, e.windup - dt);
        if (e.windup === 0) this.enemySkill(e);
      } else if (e.chargeTime > 0) {
        e.chargeTime = Math.max(0, e.chargeTime - dt); vx = e.chargeX; vy = e.chargeY; speed = (e.boss ? 380 : 340) * slow;
      } else if (e.skill && e.skillClock <= 0 && d < (e.ai === 'charge' ? 620 : 850)) {
        e.skillClock = e.skill; e.windup = e.ai === 'blink' ? .95 : e.boss ? .8 : .6;
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
      this.time += dt; this.steps++;
      const p = this.player;
      p.prevX = p.x; p.prevY = p.y;
      p.invulnerable = Math.max(0, p.invulnerable - dt); p.dashReady = Math.max(0, p.dashReady - dt);
      this.damageFlash = Math.max(0, this.damageFlash - dt);
      p.hp = Math.min(p.maxHp, p.hp + this.levels.regen * .7 * dt);
      let dx = this.input.x, dy = this.input.y, len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      if (p.dash > 0) {
        p.dash = Math.max(0, p.dash - dt); dx = p.dirX * 3.3; dy = p.dirY * 3.3;
        this.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: .18, ink: 2 });
      } else if (len > .05) {
        p.dirX = dx / Math.hypot(dx, dy); p.dirY = dy / Math.hypot(dx, dy);
      }
      this.moveEntity(p, dx * this.speed * dt, dy * this.speed * dt);

      this.spawnClock -= dt;
      if (this.spawnClock <= 0) this.spawnWave();
      if (!this.encounter && this.pressureTime >= this.nextBossAt && this.enemies.length < this.enemyLimit) this.beginEncounter();
      this.updateEncounter(dt);
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
            s.hits.add(e.id); s.remaining--; this.hurtEnemy(e, s.damage, 9);
            this.burst(e.x, e.y, 7, 3);
          }
        }
      }
      this.shots = this.shots.filter(s => s.life > 0 && s.remaining > 0);

      for (const b of this.bladePositions()) for (const e of this.nearby(b.x, b.y, 48)) {
        if (e.alive && this.time - e.bladeAt > .35 * BALANCE.weaponCooldown && Math.hypot(e.x - b.x, e.y - b.y) < e.radius + 19) {
          e.bladeAt = this.time; this.hurtEnemy(e, (23 + this.levels.blades * 5) * this.power, 13);
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
      for (const heart of this.hearts) if (p.hp < p.maxHp && Math.hypot(p.x - heart.x, p.y - heart.y) < 27 && this.status === 'running') {
        p.hp = Math.min(p.maxHp, p.hp + heart.value); heart.taken = true; this.burst(p.x, p.y, 3, 10);
      }
      this.hearts = this.hearts.filter(h => !h.taken && (!h.expires || h.expires > this.time)).slice(-128);
      if (this.status === 'running') {
        const chest = this.chests.find(c => Math.hypot(c.x - p.x, c.y - p.y) < 38);
        if (chest) this.openChest(chest);
      }
      for (const particle of this.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; }
      this.particles = this.particles.filter(p => p.life > 0).slice(-450);
      for (const ring of this.rings) ring.life -= dt;
      this.rings = this.rings.filter(r => r.life > 0);
    }
  }
  root.NightGame = NightGame; root.NightEnemies = ENEMIES; root.NightUpgrades = UPGRADES; root.NightCharacters = CHARACTERS; root.NightSlots = SLOTS; root.NightWorld = WORLD; root.NightBalance = BALANCE;
})(typeof globalThis !== 'undefined' ? globalThis : window);
