const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const assert = require('node:assert/strict');
require('./core.js');
const percentile = (values, q) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]; };
const reports = [];
const crowdKinds = Object.keys(NightEnemies).filter(kind => !NightEnemies[kind].boss);
// Simulation only; these measurements deliberately exclude browser drawing/GPU cost.
for (const count of [1000, 3000, 6000, 12000, 24000]) {
  const game = new NightGame(2026, 'hunter', { stressMode: true, enemyLimit: count }); game.start(); game.enemies = []; game.pressureOffset = 1800;
  for (let i = 0; i < count; i++) game.spawn(crowdKinds[i % crowdKinds.length]);
  const costs = [];
  for (let i = 0; i < 150; i++) {
    while (game.enemies.length < count) game.spawn(crowdKinds[game.enemies.length % crowdKinds.length]);
    const started = performance.now(); game.update(1 / 60); const cost = performance.now() - started;
    if (i >= 30) costs.push(cost); game.events.length = 0;
    assert.equal(game.status, 'running'); assert.ok(Number.isFinite(game.player.x + game.player.y));
  }
  const result = { enemies: count, steps: costs.length, stepMedianMS: +percentile(costs, .5).toFixed(2), stepP95MS: +percentile(costs, .95).toFixed(2), stepWorstMS: +Math.max(...costs).toFixed(2) };
  reports.push(result); console.log(JSON.stringify(result));
}
const game = new NightGame(3030, 'plague', { stressMode: true, enemyLimit: 1000 }); game.start();
const started = performance.now(); let peakDrops = 0;
// A 30-minute stability pass at the supported 50 ms step; not 30 minutes of browser play.
for (let i = 0; i < 36001; i++) {
  const angle = game.time * .08;
  game.input.x = Math.cos(angle); game.input.y = Math.sin(angle);
  game.update(.05); game.events.length = 0;
  peakDrops = Math.max(peakDrops, game.gems.length);
  assert.equal(game.status, 'running'); assert.ok(game.enemies.length <= 1000);
  assert.ok(Number.isFinite(game.time + game.player.x + game.player.y));
}
const stability = { simulatedSeconds: +game.time.toFixed(2), stepMS: 50, wallSeconds: +((performance.now() - started) / 1000).toFixed(2), enemyLimit: game.enemyLimit, peakEnemies: game.peakEnemies, peakDrops, kills: game.kills, finalEnemies: game.enemies.length };
console.log('STABILITY ' + JSON.stringify(stability));
fs.writeFileSync(__dirname + '/benchmark-results.json', JSON.stringify({ kind: 'Node simulation; excludes browser render and GPU', enemyKinds: crowdKinds, node: process.version, crowd: reports, stability }, null, 2));
