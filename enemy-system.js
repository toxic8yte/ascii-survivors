(function (root) {
  'use strict';
  const movement = {
    chase(e, dx, dy, d) { e.moveX = dx / d; e.moveY = dy / d; },
    direct(e) { e.moveX = e.chargeX; e.moveY = e.chargeY; },
    wavy(e, dx, dy, d, time) { const wave = Math.sin(time * e.movement.frequency + e.phase) * e.movement.amplitude; e.moveX = (dx - dy * wave) / d; e.moveY = (dy + dx * wave) / d; },
    charger(e, dx, dy, d) { e.moveX = dx / d; e.moveY = dy / d; },
    orbit(e, dx, dy, d) { const radial = Math.max(-.6, Math.min(1, (d - 180) / 180)), side = Math.sin(e.phase) >= 0 ? 1 : -1; e.moveX = dx / d * radial - dy / d * side; e.moveY = dy / d * radial + dx / d * side; }
  };
  function wave(enemies, age, stress) {
    const minute = Math.floor(age / 60), roles = ['swarm', 'normal', 'fast', 'heavy', 'special'];
    const available = Object.entries(enemies).filter(([, e]) => !e.boss && (e.roster ? e.at <= age : e.at <= age * .65));
    const selected = [];
    // Keep the wave readable: four roster roles and one familiar horror enemy.
    for (const role of roles) {
      const pool = available.filter(([, e]) => e.roster && e.role === role).sort((a, b) => b[1].at - a[1].at);
      if (pool.length && selected.length < 4) selected.push(pool[Math.floor(minute / 3) % Math.min(2, pool.length)]);
    }
    const old = available.filter(([, e]) => !e.roster);
    if (old.length) selected.push(old[minute % old.length]);
    if (!selected.length) selected.push(['grave_rat', enemies.grave_rat]);
    const target = Math.min(stress ? 24000 : 650, Math.round(18 + Math.min(age, 1800) * .12 + Math.max(0, age - 1800) * .1));
    return { target, interval: Math.max(.24, .85 - age / 4000), group: Math.min(8, 2 + Math.floor(age / 180)), entries: selected.map(([id, e]) => ({ id, weight: e.role === 'special' || e.rank === 'elite' ? 6 : e.role === 'heavy' ? 12 : 25 })) };
  }
  function weighted(entries, random) {
    let roll = random() * entries.reduce((sum, e) => sum + e.weight, 0);
    return entries.find(e => (roll -= e.weight) < 0)?.id || entries[0].id;
  }
  const api = { movement, wave, weighted };
  root.NightEnemySystem = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
