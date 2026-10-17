const assert = require('node:assert/strict');
require('./core.js'); require('./progress.js');
const clone = x => JSON.parse(JSON.stringify(x));
function fixture(options = {}) {
  const g = new NightGame(811, 'hunter', { terrain: false, fireMode: 'manual', ...options });
  g.start(); g.enemies = []; g.spawnClock = g.nextBossAt = g.nextMegaAt = 1e8; g.rosterBossIndex = 1e6;
  return g;
}
for (const [roll, expected] of [[0, 1], [.499999, 1], [.5, 0], [.999999, 0]]) {
  const g = fixture(), e = g.spawn('ghoul', 500, 500); g.random = () => roll;
  g.hurtEnemy(e, e.hp + 1);
  assert.equal(g.gems.length, expected, 'Half-open 50% XP probability');
  assert.equal(g.combat.total.xpDropped, expected * e.xp, 'Only real drops enter metrics');
  assert.equal(g.kills, 1, 'A missed crystal still counts as a kill');
}
for (const options of [{}, { stressMode: true }]) {
  const g = fixture(options); g.random = () => .999999;
  const boss = g.spawn('lichLord', 500, 500); g.hurtEnemy(boss, boss.hp + 1);
  assert.equal(g.gems.reduce((sum, gem) => sum + gem.value, 0), boss.xp, 'Boss XP is guaranteed');
  const zero = g.spawn('the_administrator', 500, 500); g.hurtEnemy(zero, zero.hp + 1);
  assert.ok(g.gems.every(gem => gem.value > 0));
  assert.equal(g.combat.total.xpDropped, boss.xp, 'Zero-XP bosses create no invalid crystals');
  if (options.stressMode) {
    const e = g.spawn('ghoul', 700, 700); g.hurtEnemy(e, e.hp + 1);
    assert.equal(g.combat.total.xpDropped, boss.xp + e.xp, 'Stress retains worst-case pickup load');
  }
  if (options.stressMode) assert.equal(NightSave.capture(g), null, 'Stress remains isolated from persistent runs');
  else assert.ok(NightSave.restore(clone(NightSave.capture(g))));
}
const wallet = fixture(); wallet.awardGold(1); wallet.awardGold(1);
const resumed = NightSave.restore(clone(NightSave.capture(wallet))); assert.ok(resumed);
resumed.awardGold(1); assert.equal(resumed.goldEarned, 1); assert.ok(Math.abs(resumed.goldCarry - .35) < 1e-9);
for (let i = 0; i < 97; i++) resumed.awardGold(1);
assert.equal(resumed.goldEarned, 45, 'Small awards accumulate without rounding losses across reloads');
for (const id of ['ghoul', 'grave_rat']) {
  const early = fixture(), late = fixture(); early.time = 360; late.time = 480;
  const e = early.spawn(id, early.player.x + 300, early.player.y), l = late.spawn(id, late.player.x + 300, late.player.y);
  assert.ok(Math.abs(l.maxHp / (NightEnemies[id].hp * (1 + late.waveAge / 340)) - 1.4) < 1e-9);
  early.updateEnemy(e, .1); late.updateEnemy(l, .1);
  assert.ok(late.player.x + 300 - l.x > early.player.x + 300 - e.x, 'Both legacy and roster enemies move faster after six minutes');
}
const pumpkin = NightEnemies.pumpkin;
assert.equal(pumpkin.hp, 105); assert.equal(pumpkin.skill, 2.8); assert.equal(pumpkin.projectileSpeed, 220);
assert.ok(Math.abs(pumpkin.damage * pumpkin.projectileDamageScale / (15 * .64) - 4 / 3) < 1e-9);
const encounter = fixture(), boss = encounter.spawn('lichLord', encounter.player.x + 100, encounter.player.y);
boss.hp = 123; boss.maxHp = 1540; boss.damage = 17; encounter.awardGold(100);
const saved = NightSave.restore(clone(NightSave.capture(encounter))); assert.ok(saved);
assert.equal(saved.enemies[0].hp, 123); assert.equal(saved.enemies[0].maxHp, 1540); assert.equal(saved.enemies[0].damage, 17);
assert.equal(saved.goldEarned, encounter.goldEarned, 'Existing enemy HP and earned wallet amounts are not recalculated');
assert.equal(NightEnemies.darVetro.hp, 16200); assert.equal(NightBalance.arenaSeconds, 15);
console.log('PASS: 50% ordinary XP, guaranteed boss/stress XP, zero-XP safety, real drop metrics, fractional gold saves, post-six-minute HP/speed, stronger pumpkins and retained encounter state.');
