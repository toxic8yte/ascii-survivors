(function (root) {
  'use strict';
  const fields = ['seconds', 'damage', 'overkill', 'hits', 'kills', 'xp', 'xpDropped', 'gold', 'healing', 'hurt', 'heartsSpawned', 'heartsTaken'];
  const fresh = () => Object.fromEntries(fields.map(key => [key, 0]));
  const weapons = () => Object.create(null);
  class NightCombat {
    constructor(since = 0) {
      this.since = since; this.total = fresh(); this.current = fresh(); this.weapons = weapons(); this.currentWeapons = weapons();
      this.history = []; this.near = 0; this.probe = -1; this.enemySeconds = 0; this.nearSeconds = 0; this.peak = 0;
    }
    record(key, amount) {
      if (!fields.includes(key) || !Number.isFinite(amount) || amount <= 0) return;
      this.total[key] += amount; this.current[key] += amount;
    }
    hit(source, raw, actual, killed) {
      const catalog = root.NightCatalog, valid = catalog.upgrades.some(u => u.weapon && u.id === source);
      const id = valid ? source : 'other';
      this.record('damage', actual); this.record('overkill', raw - actual); this.record('hits', 1); if (killed) this.record('kills', 1);
      for (const collection of [this.weapons, this.currentWeapons]) {
        const row = collection[id] || (collection[id] = { damage: 0, overkill: 0, hits: 0, kills: 0 });
        row.damage += actual; row.overkill += raw - actual; row.hits++; if (killed) row.kills++;
      }
    }
    sample(dt, game) {
      this.record('seconds', dt);
      const probe = Math.floor(this.total.seconds * 2);
      if (probe !== this.probe) {
        this.probe = probe; this.near = 0;
        for (const e of game.enemies) if (e.alive && (e.x - game.player.x) ** 2 + (e.y - game.player.y) ** 2 <= 240 ** 2) this.near++;
      }
      this.enemySeconds += game.enemies.length * dt; this.nearSeconds += this.near * dt; this.peak = Math.max(this.peak, game.enemies.length);
      if (this.current.seconds < 10 - 1e-8) return;
      const plan = game.wavePlan;
      this.history.push({ from: this.since + this.total.seconds - this.current.seconds, to: this.since + this.total.seconds, ...this.current, enemies: this.enemySeconds / this.current.seconds, nearby: this.nearSeconds / this.current.seconds, peak: this.peak, stage: plan.id, phase: plan.phase });
      if (this.history.length > 180) this.history.shift();
      this.current = fresh(); this.currentWeapons = weapons(); this.enemySeconds = this.nearSeconds = this.peak = 0;
    }
    snapshot() {
      return JSON.parse(JSON.stringify({ version: 1, since: this.since, total: this.total, current: this.current, weapons: this.weapons, currentWeapons: this.currentWeapons, history: this.history, enemySeconds: this.enemySeconds, nearSeconds: this.nearSeconds, peak: this.peak }));
    }
    static restore(data, since = 0) {
      const result = new NightCombat(since), validNumber = n => Number.isFinite(n) && n >= 0 && n <= 1e15;
      const validBucket = row => row && fields.every(key => validNumber(row[key]));
      const ids = new Set(['other', ...root.NightCatalog.upgrades.filter(u => u.weapon).map(u => u.id)]);
      const validWeapons = rows => rows && typeof rows === 'object' && !Array.isArray(rows) && Object.keys(rows).length <= ids.size && Object.entries(rows).every(([id, row]) => ids.has(id) && ['damage', 'overkill', 'hits', 'kills'].every(key => validNumber(row?.[key])));
      if (!data || data.version !== 1 || !validNumber(data.since) || !validBucket(data.total) || !validBucket(data.current) || data.current.seconds >= 10.001 || !validWeapons(data.weapons) || !validWeapons(data.currentWeapons) || !Array.isArray(data.history) || data.history.length > 180 || !['enemySeconds', 'nearSeconds', 'peak'].every(key => validNumber(data[key]))) return result;
      if (data.history.some(row => !validBucket(row) || !['from', 'to', 'enemies', 'nearby', 'peak'].every(key => validNumber(row[key])) || row.to < row.from || typeof row.stage !== 'string' || row.stage.length > 40 || typeof row.phase !== 'string' || row.phase.length > 20)) return result;
      result.since = data.since; result.total = { ...data.total }; result.current = { ...data.current };
      for (const key of ['weapons', 'currentWeapons']) for (const [id, row] of Object.entries(data[key])) result[key][id] = { ...row };
      result.history = data.history.map(row => ({ ...row })); result.enemySeconds = data.enemySeconds; result.nearSeconds = data.nearSeconds; result.peak = data.peak;
      return result;
    }
  }
  root.NightCombat = NightCombat;
  if (typeof module !== 'undefined' && module.exports) module.exports = NightCombat;
})(typeof globalThis !== 'undefined' ? globalThis : window);
