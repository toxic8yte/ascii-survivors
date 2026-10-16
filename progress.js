(function (root) {
  'use strict';
  const PROFILE_KEY = 'ascii-night-progress-v2', RUN_KEY = 'ascii-night-run-v1';
  const legacyScalarKeys = ['time', 'wallTime', 'pressureOffset', 'steps', 'kills', 'bossKills', 'level', 'xp', 'xpNeed', 'nextId', 'peakEnemies', 'nextBossAt', 'bossIndex', 'shootClock', 'spawnClock', 'pulseClock'];
  const scalarKeys = [...legacyScalarKeys, 'chestsOpened', 'nextChestId'];
  const enemyKeys = ['id', 'x', 'y', 'hp', 'maxHp', 'damage', 'speed', 'flash', 'bladeAt', 'chilledTill', 'poisonAt', 'phase', 'skillClock', 'windup', 'chargeTime', 'chargeX', 'chargeY', 'targetX', 'targetY', 'arenaMember', 'radius'];
  const playerKeys = ['x', 'y', 'hp', 'maxHp', 'invulnerable', 'dash', 'dashReady', 'dirX', 'dirY', 'slowTill'];
  const effects = {
    shots: ['x', 'y', 'vx', 'vy', 'angle', 'life', 'remaining', 'damage'],
    boomerangs: ['x', 'y', 'vx', 'vy', 'age', 'damage'],
    pools: ['x', 'y', 'radius', 'life'],
    meteors: ['x', 'y', 'wait', 'radius', 'damage'],
    hearts: ['x', 'y', 'value', 'expires'],
    enemyShots: ['x', 'y', 'vx', 'vy', 'life', 'damage', 'radius', 'ink']
  };
  const limits = { shots: 12000, boomerangs: 300, pools: 500, meteors: 100, hearts: 128, enemyShots: 256 };
  const number = (value, min = -1e12, max = 1e12) => { if (!Number.isFinite(value) || value < min || value > max) throw new Error('Invalid save number'); return value; };
  const list = (value, max) => { if (!Array.isArray(value) || value.length > max) throw new Error('Invalid save list'); return value; };
  const pick = (object, keys) => Object.fromEntries(keys.map(key => [key, object[key]]));
  const numeric = (object, keys) => Object.fromEntries(keys.map(key => [key, number(object[key])]));
  const plain = value => value && typeof value === 'object' && !Array.isArray(value);
  const uint = value => Number.isSafeInteger(value) && value >= 0;

  function capture(game) {
    if (game.stressMode || !['running', 'paused', 'upgrading', 'reward'].includes(game.status)) return null;
    const save = {
      version: 2, runId: game.runId, savedAt: Date.now(), seed: game.seed, randomState: game.randomState >>> 0,
      characterId: game.character.id, enemyLimit: game.enemyLimit, status: game.status,
      fireMode: game.fireMode, selectedWeapon: game.selectedWeapon, lastBoss: game.lastBoss,
      player: pick(game.player, playerKeys), levels: { ...game.levels }, clocks: { ...game.weaponClocks },
      offers: game.offers.map(u => u.id), encountered: Array.from(game.encountered),
      terrainEnabled: game.terrainEnabled, encounter: game.encounter ? { ...game.encounter } : null,
      chests: game.chests.map(chest => ({ ...chest })), reward: game.reward ? { ...game.reward, items: game.reward.items.map(item => ({ ...item })) } : null,
      enemies: game.enemies.filter(e => e.alive).map(e => [e.kind, ...enemyKeys.map(key => e[key])]),
      gems: game.gems.map(g => ({ x: g.x, y: g.y, value: g.value, bin: g.bin, magnetized: Boolean(g.magnetized) }))
    };
    Object.assign(save, pick(game, scalarKeys));
    for (const [key, fields] of Object.entries(effects)) save[key] = game[key].map(entity => {
      const copy = pick(entity, fields);
      if (key === 'shots') copy.hits = Array.from(entity.hits);
      if (key === 'boomerangs') copy.hits = Array.from(entity.hits.entries());
      if (key === 'enemyShots') copy.glyph = entity.glyph;
      return copy;
    });
    return save;
  }

  function restore(save) {
    try {
      if (!plain(save) || ![1, 2].includes(save.version) || typeof save.runId !== 'string' || save.runId.length > 120 || !save.runId) return null;
      if (!['running', 'paused', 'upgrading', 'reward'].includes(save.status) || !NightCharacters.some(c => c.id === save.characterId)) return null;
      if (!uint(save.seed) || !uint(save.randomState) || !plain(save.levels) || !plain(save.player) || !plain(save.clocks)) return null;
      const game = new NightGame(save.seed, save.characterId, { enemyLimit: number(save.enemyLimit, 100, 24000), fireMode: save.fireMode, terrain: save.terrainEnabled !== false });
      for (const key of save.version === 1 ? legacyScalarKeys : scalarKeys) game[key] = number(save[key], key.endsWith('Clock') ? -1 : 0);
      if (!uint(game.level) || game.level < 1 || !uint(game.kills) || !uint(game.nextId) || game.nextId < 1 || game.xpNeed < 1) return null;
      for (const key of ['steps', 'bossKills', 'xp', 'xpNeed', 'peakEnemies', 'bossIndex']) if (!uint(game[key])) return null;
      if (game.xpNeed > 5000 || game.bossKills > game.kills) return null;
      if (!uint(game.chestsOpened) || !uint(game.nextChestId) || game.nextChestId < 1) return null;
      for (const upgrade of NightUpgrades) {
        const level = save.levels[upgrade.id];
        if (!uint(level) || level > upgrade.max) return null;
        game.levels[upgrade.id] = level;
      }
      if (!game.levels[game.character.weapon] || !NightSlots.includes(save.selectedWeapon) || !game.levels[save.selectedWeapon]) return null;
      Object.assign(game.player, numeric(save.player, playerKeys));
      number(game.player.x, 28, game.width - 28); number(game.player.y, 28, game.height - 28);
      number(game.player.hp, .001, game.player.maxHp);
      if (game.player.maxHp !== game.character.hp + game.levels.vital * 25) return null;
      game.player.prevX = game.player.x; game.player.prevY = game.player.y;
      game.runId = save.runId; game.randomState = save.randomState; game.selectedWeapon = save.selectedWeapon;
      game.fireMode = save.fireMode === 'manual' ? 'manual' : 'auto';
      game.lastBoss = typeof save.lastBoss === 'string' ? save.lastBoss.slice(0, 80) : '';
      for (const key of Object.keys(game.weaponClocks)) game.weaponClocks[key] = number(save.clocks[key], 0);
      game.enemies = list(save.enemies, game.enemyLimit).map(row => {
        list(row, enemyKeys.length + 1);
        const keys = save.version === 1 ? enemyKeys.slice(0, -2) : enemyKeys;
        const definition = Object.hasOwn(NightEnemies, row[0]) && NightEnemies[row[0]]; if (!definition || row.length !== keys.length + 1) throw new Error('Unknown saved enemy');
        const enemy = { ...definition, kind: row[0], alive: true, arenaMember: 0 };
        keys.forEach((key, i) => { enemy[key] = number(row[i + 1]); });
        if (!uint(enemy.id) || enemy.id < 1 || enemy.hp <= 0 || enemy.maxHp < enemy.hp) throw new Error('Invalid enemy');
        number(enemy.damage, 0); number(enemy.speed, 0, 1000); number(enemy.windup, 0, 30); number(enemy.chargeTime, 0, 10);
        if (![0, 1].includes(enemy.arenaMember)) throw new Error('Invalid arena member'); number(enemy.radius, 1, 50);
        number(enemy.x, 0, game.width); number(enemy.y, 0, game.height);
        enemy.prevX = enemy.x; enemy.prevY = enemy.y; return enemy;
      });
      const ids = new Set(game.enemies.map(e => e.id));
      if (ids.size !== game.enemies.length || game.enemies.some(e => e.id >= game.nextId)) return null;
      if (save.version === 2) {
        if (save.encounter !== null) {
          const a = save.encounter;
          if (!plain(a) || !['warning', 'locked'].includes(a.phase) || !Object.hasOwn(NightEnemies, a.kind) || !NightEnemies[a.kind].boss) return null;
          game.encounter = { ...numeric(a, ['x', 'y', 'radius', 'warningLeft', 'bossId']), phase: a.phase, kind: a.kind };
          number(a.radius, 120, 300); number(a.x, a.radius, game.width - a.radius); number(a.y, a.radius, game.height - a.radius); number(a.warningLeft, 0, 5);
          if (!uint(a.bossId) || a.phase === 'locked' && !game.enemies.some(e => e.id === a.bossId && e.boss && e.arenaMember)) return null;
        }
        game.chests = list(save.chests, 64).map(c => {
          if (!Object.hasOwn(NightEnemies, c.source) || !NightEnemies[c.source].boss || !uint(c.id) || c.id < 1 || c.id >= game.nextChestId) throw new Error('Invalid chest');
          return { id: c.id, x: number(c.x, 0, game.width), y: number(c.y, 0, game.height), radius: 20, source: c.source };
        });
        if (new Set(game.chests.map(c => c.id)).size !== game.chests.length) return null;
        if (save.status === 'reward') {
          const r = save.reward;
          if (!plain(r) || ![1, 3, 5].includes(r.count) || !uint(r.id) || r.id < 1 || r.id >= game.nextChestId || !Object.hasOwn(NightEnemies, r.source) || !NightEnemies[r.source].boss || game.chests.some(c => c.id === r.id)) return null;
          game.reward = { id: r.id, source: r.source, count: r.count, heal: number(r.heal, 0, 35), xp: number(r.xp, 25, 125), items: list(r.items, r.count).map(item => {
            const u = NightUpgrades.find(u => u.id === item.id); if (!u || !uint(item.rank) || item.rank < 1 || item.rank > u.max || item.rank > game.levels[u.id]) throw new Error('Invalid reward');
            return { id: item.id, rank: item.rank };
          }) };
        }
      } else if (save.status === 'reward') return null;
      game.gems = list(save.gems, 50000).map(g => ({ ...numeric(g, ['x', 'y', 'value', 'bin']), magnetized: Boolean(g.magnetized) }));
      for (const gem of game.gems) {
        number(gem.value, 1); number(gem.x, 0, game.width); number(gem.y, 0, game.height);
        if (!gem.magnetized) game.gemBins.set(gem.bin, gem);
      }
      for (const [key, fields] of Object.entries(effects)) game[key] = list(save[key], limits[key]).map(entity => {
        const copy = numeric(entity, fields); copy.prevX = copy.x; copy.prevY = copy.y;
        if (key === 'shots') copy.hits = new Set(list(entity.hits, 100000).map(id => number(id, 1)));
        if (key === 'boomerangs') copy.hits = new Map(list(entity.hits, 100000).map(pair => [number(pair[0], 1), number(pair[1], 0)]));
        if (key === 'enemyShots') { if (!['o', '~'].includes(entity.glyph)) throw new Error('Invalid shot'); copy.glyph = entity.glyph; }
        return copy;
      });
      game.encountered = new Set(list(save.encountered, 100).filter(kind => Object.hasOwn(NightEnemies, kind)));
      game.offers = list(save.offers, 3).map(id => NightUpgrades.find(u => u.id === id));
      if (save.status === 'upgrading' && (!game.offers.length || game.offers.some(u => !u || game.levels[u.id] >= u.max) || new Set(save.offers).size !== save.offers.length)) return null;
      if (save.status !== 'upgrading') game.offers = [];
      game.status = ['upgrading', 'reward'].includes(save.status) ? save.status : 'paused';
      if (save.version === 1) { game.resolveTerrain(game.player); game.player.prevX = game.player.x; game.player.prevY = game.player.y; }
      game.aim = { x: game.player.x, y: game.player.y - 300, active: false };
      game.bossSpawned = game.bossIndex > 0; game.buildGrid();
      return game;
    } catch (_) { return null; }
  }

  class NightProgress {
    constructor(storage) { this.storage = storage; this.available = Boolean(storage); this.profile = this.loadProfile(); }
    read(key) { try { return JSON.parse(this.storage?.getItem(key) || 'null'); } catch (_) { return null; } }
    write(key, value) {
      try { if (!this.storage) return false; this.storage.setItem(key, JSON.stringify(value)); this.available = true; return true; }
      catch (_) { this.available = false; return false; }
    }
    loadProfile() {
      const raw = this.read(PROFILE_KEY), oldBest = this.read('ascii-night-best-v1');
      let oldCharacter; try { oldCharacter = this.storage?.getItem('ascii-night-character'); } catch (_) {}
      const source = raw?.version === 2 ? raw : {};
      const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
      const best = source.best || oldBest;
      return {
        version: 2, runs: count(source.runs), kills: count(source.kills), bossKills: count(source.bossKills), chestsOpened: count(source.chestsOpened),
        seconds: Number.isFinite(source.seconds) && source.seconds >= 0 ? source.seconds : 0,
        maxLevel: count(source.maxLevel), best: best && Number.isFinite(best.time) && best.time >= 0 ? { time: best.time, kills: count(best.kills) } : null,
        character: NightCharacters.some(c => c.id === (source.character || oldCharacter)) ? (source.character || oldCharacter) : 'hunter',
        fireMode: source.fireMode === 'manual' ? 'manual' : 'auto',
        enemyLimit: [1000, 3000, 6000, 12000, 24000].includes(source.enemyLimit) ? source.enemyLimit : 6000,
        seen: Array.isArray(source.seen) ? [...new Set(source.seen.filter(kind => Object.hasOwn(NightEnemies, kind)))] : [],
        finished: Array.isArray(source.finished) ? source.finished.filter(id => typeof id === 'string').slice(-50) : []
      };
    }
    savePreferences(character, fireMode, enemyLimit) {
      this.profile.character = character; this.profile.fireMode = fireMode; this.profile.enemyLimit = enemyLimit;
      return this.write(PROFILE_KEY, this.profile);
    }
    checkpoint(game) {
      const save = capture(game); if (!save) return false;
      const written = this.write(RUN_KEY, save);
      this.profile.seen = [...new Set([...this.profile.seen, ...game.encountered])];
      if (written) this.write(PROFILE_KEY, this.profile);
      return written;
    }
    loadRun() { return restore(this.read(RUN_KEY)); }
    clearRun(runId) {
      try { if (this.read(RUN_KEY)?.runId === runId) this.storage?.removeItem(RUN_KEY); } catch (_) {}
    }
    finish(game) {
      if (game.stressMode || !game.elapsed || this.profile.finished.includes(game.runId)) return false;
      const p = this.profile;
      p.runs++; p.kills += game.kills; p.bossKills += game.bossKills; p.chestsOpened += game.chestsOpened; p.seconds += game.elapsed; p.maxLevel = Math.max(p.maxLevel, game.level);
      p.seen = [...new Set([...p.seen, ...game.encountered])];
      if (!p.best || game.elapsed > p.best.time || game.elapsed === p.best.time && game.kills > p.best.kills) p.best = { time: game.elapsed, kills: game.kills };
      p.finished = [...p.finished, game.runId].slice(-50);
      const written = this.write(PROFILE_KEY, p); this.clearRun(game.runId); return written;
    }
  }
  root.NightSave = { capture, restore }; root.NightProgress = NightProgress;
})(typeof globalThis !== 'undefined' ? globalThis : window);
