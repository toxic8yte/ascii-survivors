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
    const minute = Math.floor(age / 60), pressureRoles = [['fast', 'heavy', 'special'], ['fast', 'special', 'heavy'], ['heavy', 'special', 'fast']];
    const roles = ['swarm', 'normal', ...pressureRoles[minute % 3]];
    const available = Object.entries(enemies).filter(([, e]) => !e.boss && (e.roster ? e.at <= age : e.at <= age * .65));
    const selected = [];
    // Rotate pressure roles so special enemies are not permanently crowded out.
    for (const role of roles) {
      const pool = available.filter(([, e]) => e.roster && e.role === role).sort((a, b) => b[1].at - a[1].at);
      if (pool.length && selected.length < 4) selected.push(pool[Math.floor(minute / 3) % Math.min(2, pool.length)]);
    }
    const old = available.filter(([, e]) => !e.roster);
    if (old.length) selected.push(old[minute % old.length]);
    if (!selected.length) selected.push(['grave_rat', enemies.grave_rat]);
    const surge = !stress && minute >= 2 && age % 60 < 10;
    const population = stress ? 18 + Math.min(age, 1800) * .12 + Math.max(0, age - 1800) * .1 : age < 300 ? 24 + 642 * Math.pow(age / 300, 2) : 666 + (age - 300) * .37;
    const target = Math.min(stress ? 24000 : 999, Math.round(population * (surge ? age >= 300 ? 1.5 : 1.12 : 1)));
    const interval = stress ? Math.max(.24, .85 - age / 4000) : Math.max(.24, .75 - age / 1000) * (surge ? .8 : 1);
    const group = stress ? Math.min(8, 2 + Math.floor(age / 180)) : Math.min(32, 3 + Math.floor(age / 20)) + (surge ? 2 : 0);
    return { target, interval, group, surge, entries: selected.map(([id, e]) => ({ id, weight: e.role === 'special' || e.rank === 'elite' || ['ranged', 'summoner', 'blink'].includes(e.ai) ? 6 : e.role === 'heavy' ? 12 : 25 })) };
  }
  function weighted(entries, random) {
    let roll = random() * entries.reduce((sum, e) => sum + e.weight, 0);
    return entries.find(e => (roll -= e.weight) < 0)?.id || entries[0].id;
  }
  const api = { movement, wave, weighted };
  root.NightEnemySystem = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
