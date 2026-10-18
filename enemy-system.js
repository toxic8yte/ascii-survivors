(function (root) {
  'use strict';
  const movement = {
    chase(e, dx, dy, d) { e.moveX = dx / d; e.moveY = dy / d; },
    direct(e) { e.moveX = e.chargeX; e.moveY = e.chargeY; },
    wavy(e, dx, dy, d, time) { const wave = Math.sin(time * e.movement.frequency + e.phase) * e.movement.amplitude; e.moveX = (dx - dy * wave) / d; e.moveY = (dy + dx * wave) / d; },
    charger(e, dx, dy, d) { e.moveX = dx / d; e.moveY = dy / d; },
    orbit(e, dx, dy, d) { const radial = Math.max(-.6, Math.min(1, (d - 180) / 180)), side = Math.sin(e.phase) >= 0 ? 1 : -1; e.moveX = dx / d * radial - dy / d * side; e.moveY = dy / d * radial + dx / d * side; }
  };
  const stages = Object.freeze([
    { id: 'awakening', from: 0, to: 60, title: 'Первые шорохи', roles: ['fast', 'heavy', 'special'], weights: [34, 28, 18, 10, 4] },
    { id: 'footsteps', from: 60, to: 180, title: 'Мёртвая поступь', roles: ['heavy', 'fast', 'special'], weights: [30, 28, 20, 18, 4] },
    { id: 'pack', from: 180, to: 360, title: 'Голодная стая', roles: ['fast', 'special', 'heavy'], weights: [34, 24, 30, 15, 5] },
    { id: 'beast', from: 360, to: 480, title: 'Охота началась', roles: ['fast', 'heavy', 'special'], weights: [14, 20, 34, 28, 20] },
    { id: 'procession', from: 480, to: 600, title: 'Железная процессия', roles: ['heavy', 'special', 'fast'], weights: [12, 18, 28, 38, 24] },
    { id: 'harvest', from: 600, to: 900, title: 'Красная жатва', roles: ['fast', 'special', 'heavy'], weights: [30, 23, 36, 26, 6] },
    { id: 'watch', from: 900, to: 1200, title: 'Ночной дозор', roles: ['special', 'heavy', 'fast'], weights: [26, 24, 28, 32, 7] },
    { id: 'abyss', from: 1200, to: 1800, title: 'Бездонный натиск', roles: ['heavy', 'fast', 'special'], weights: [33, 22, 34, 36, 7] }
  ].map(stage => Object.freeze({ ...stage, roles: Object.freeze(stage.roles), weights: Object.freeze(stage.weights) })));
  const roleOf = e => e.role || (['ranged', 'summoner', 'blink'].includes(e.ai) ? 'special' : 'normal');
  function wave(enemies, age, stress, map, elapsed=age) {
    const minute = Math.floor(age / 60), stage = stages.find(s => age >= s.from && age < s.to) || stages[5 + minute % 3];
    const roles = age >= 360 && !stress ? ['normal', ...stage.roles] : ['swarm', 'normal', ...stage.roles];
    const available = Object.entries(enemies).filter(([, e]) => !e.boss && (e.roster ? e.at <= age : e.at <= age * .65));
    const selected = [];
    // Early waves keep two filler roles; later waves reserve room for all pressure roles.
    for (const role of roles) {
      const pool = available.filter(([, e]) => e.roster && e.role === role).sort((a, b) => b[1].at - a[1].at);
      if (pool.length && selected.length < 4) selected.push(pool[Math.floor(minute / 3) % Math.min(2, pool.length)]);
    }
    const old = available.filter(([, e]) => !e.roster);
    if (old.length) selected.push(old[minute % old.length]);
    if (!selected.length) selected.push(['grave_rat', enemies.grave_rat]);
    const forestMinute=Math.floor(elapsed/60),forest=!stress&&map?.waves,forestWave=forest&&map.waves[forestMinute<30?forestMinute:24+forestMinute%6];
    if(forestWave)selected.splice(0,selected.length,...Object.keys(forestWave.enemies).map(id=>[id,enemies[id]]));
    const surge = !stress && minute >= 2 && age % 60 < 10, recovery = !stress && minute >= 2 && age % 60 >= 48;
    const phase = stress ? 'stress' : surge ? 'surge' : recovery ? 'recovery' : 'pressure';
    // Pressure comes from composition and refill, not a mandatory 666-enemy floor.
    const afterSix = Math.max(0, age - 360);
    const population = stress ? 18 + Math.min(age, 1800) * .12 + Math.max(0, age - 1800) * .1 : 24 + Math.min(age, 360) * .35 + afterSix * 2.25;
    const target = Math.min(stress ? 24000 : 2000, Math.round(population * (surge ? age >= 360 ? 1.25 : 1.12 : recovery ? .9 : 1)));
    const interval = stress ? Math.max(.24, .85 - age / 4000) : Math.max(.15, .85 - Math.min(age, 360) / 1200 - afterSix / 900) * (surge ? .8 : recovery ? 1.35 : 1);
    const group = stress ? Math.min(8, 2 + Math.floor(age / 180)) : Math.max(3, Math.min(32, 3 + Math.floor(Math.min(age, 360) / 60) + Math.floor(afterSix / 20) + (surge ? 2 : recovery ? -2 : 0)));
    const danger = !stress && age >= 360;
    const quotas = { ranged: Math.max(1, Math.min(danger ? 24 : 16, Math.floor(target * (danger ? .04 : .025)))), special: Math.max(2, Math.min(danger ? 60 : 36, Math.floor(target * (danger ? .12 : .06)))), elite: Math.max(1, Math.min(danger ? 45 : 28, Math.floor(target * (danger ? .09 : .04)))) };
    return { id: forestWave?'forest-'+forestMinute:stage.id, title: forestWave?.title||stage.title, phase, phaseTitle: stress ? 'Нагрузочный тест' : surge ? 'Наплыв' : recovery ? 'Передышка' : 'Натиск', target, interval, group, surge, quotas, entries: selected.map(([id, e]) => ({ id, role: roleOf(e), ranged: e.ai === 'ranged', elite: e.rank === 'elite', weight: forestWave?forestWave.enemies[id]:e.ai === 'ranged' ? danger ? 12 : 5 : stage.weights[['swarm', 'normal', 'fast', 'heavy', 'special'].indexOf(roleOf(e))] || 6 })) };
  }
  function weighted(entries, random) {
    let roll = random() * entries.reduce((sum, e) => sum + e.weight, 0);
    return entries.find(e => (roll -= e.weight) < 0)?.id || entries[0].id;
  }
  const api = { movement, wave, weighted, stages, roleOf };
  root.NightEnemySystem = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
