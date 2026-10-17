const assert = require('node:assert/strict');
require('./core.js'); require('./progress.js');
const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const g = new NightGame(707, 'hunter', { terrain: false, fireMode: 'manual' }); g.start();
  g.enemies = []; g.spawnClock = g.nextBossAt = g.nextMegaAt = 1e8; g.rosterBossIndex = 1e6;
  return g;
}
const g = fixture(), enemy = g.spawn('ghoul', g.player.x + 50, g.player.y); enemy.hp = enemy.maxHp = 18;
g.hurtEnemy(enemy, 30, 0, 'needle'); g.hurtEnemy(enemy, 30, 0, 'needle');
assert.equal(g.combat.total.damage, 18); assert.equal(g.combat.total.overkill, 12); assert.equal(g.combat.total.hits, 1); assert.equal(g.combat.total.kills, 1);
assert.equal(g.combat.weapons.needle.damage, 18); assert.equal(g.combat.weapons.needle.kills, 1);
g.player.hp = 80; assert.equal(g.healPlayer(40), 20); g.healPlayer(20); assert.equal(g.combat.total.healing, 20);
g.levels.armor = 2; g.hurtPlayer(15); g.hurtPlayer(15); assert.equal(g.combat.total.hurt, 11, 'Damage records actual HP loss after armor and invulnerability');
g.awardGold(100); g.gainXP(12); assert.equal(g.combat.total.gold, 45); assert.equal(g.combat.total.xp, 12); assert.equal(g.combat.total.xpDropped, g.gems.reduce((sum, gem) => sum + gem.value, 0));
for (let i = 0; i < 600; i++) g.combat.sample(1 / 60, g);
assert.equal(g.combat.history.length, 1); assert.ok(Math.abs(g.combat.history[0].seconds - 10) < 1e-8); assert.equal(g.combat.history[0].damage, 18);
const continued = NightSave.restore(clone(NightSave.capture(g))); assert.ok(continued);
assert.deepEqual(continued.combat.snapshot(), g.combat.snapshot(), 'Combat totals, weapons and ten-second windows survive saves');
const old = clone(NightSave.capture(g)); delete old.combat;
const migrated = NightSave.restore(old); assert.ok(migrated); assert.equal(migrated.combat.total.damage, 0); assert.equal(migrated.combat.since, g.time);
const broken = clone(NightSave.capture(g)); broken.combat.total.damage = -1;
assert.ok(NightSave.restore(broken), 'Damaged optional metrics never discard a valid game checkpoint');
for (let i = 0; i < 181; i++) g.combat.sample(10, g);
assert.equal(g.combat.history.length, 180, 'Endless runs keep bounded combat history');
assert.ok(NightCombat.restore(g.combat.snapshot()).total.seconds > 1800);

// Every damaging weapon must name its source through actual collision paths.
for (const id of NightSlots.filter(id => !['laurel', 'clock'].includes(id))) {
  const sim = fixture(); sim.levels[id] = 4;
  const target = sim.spawn('lichLord', sim.player.x + (id === 'axe' ? 340 : id === 'bible' ? 135 : 70), sim.player.y); target.hp = target.maxHp = 1e8; target.speed = 0;
  sim.aim = { x: target.x, y: target.y, active: true }; sim.buildGrid();
  if (id === 'needle') sim.fire();
  else if (id === 'blades') sim.castSlash();
  else if (id === 'pulse') sim.castPulse();
  else if (id === 'poison') sim.castPoison();
  else if (['lightning', 'boomerang', 'frost', 'meteor'].includes(id)) sim['cast' + id[0].toUpperCase() + id.slice(1)]();
  else sim.castRelic(id);
  for (let step = 0; step < 180; step++) { sim.player.invulnerable = 1; sim.update(1 / 60); }
  assert.ok(sim.combat.weapons[id]?.damage > 0, id + ' attributes actual damage to its weapon');
  assert.ok(!sim.combat.weapons.other, id + ' has no unattributed combat damage');
}
const evolution = fixture(); evolution.levels.boomerang = evolution.levels.hammer = 4; evolution.levels.capital = 1;
evolution.evolve(NightCatalog.evolutions.find(e => e.id === 'mikolenin'));
const enemy2 = evolution.spawn('ghoul', evolution.player.x + 100, evolution.player.y); evolution.buildGrid(); evolution.castMikolenin();
assert.ok(evolution.combat.weapons.boomerang.damage > 0); assert.equal(enemy2.alive, false);
for (const id of ['clock', 'laurel']) {
  const sim = fixture(), recipe = NightCatalog.evolutions.find(e => e.weapon === id);
  sim.levels[id] = 4; for (const [passive, rank] of Object.entries(recipe.passives)) sim.levels[passive] = rank;
  assert.ok(sim.evolve(recipe)); const target = sim.spawn('lichLord', sim.player.x + 70, sim.player.y); target.hp = target.maxHp = 1e8; sim.buildGrid();
  if (id === 'clock') for (let i = 0; i < 12; i++) sim.castRelic('clock');
  else { sim.castRelic('laurel'); sim.hurtPlayer(15); }
  assert.ok(sim.combat.weapons[id]?.damage > 0, id + ' attributes evolved damage');
}

for (const time of [300, 480, 900, 1800]) {
  const arena = fixture(); arena.time = time;
  for (let i = 0; i < 400; i++) arena.spawnWave();
  const plan = arena.wavePlan;
  assert.ok(arena.enemies.filter(e => e.ai === 'ranged').length <= plan.quotas.ranged);
  assert.ok(arena.enemies.filter(e => e.role === 'special').length <= plan.quotas.special);
  assert.ok(arena.enemies.filter(e => e.rank === 'elite').length <= plan.quotas.elite);
  assert.equal(arena.enemies.length, plan.target, 'Threat quotas do not prevent ordinary crowd replenishment');
}
const push = NightEnemySystem.wave(NightEnemies, 330, false), rest = NightEnemySystem.wave(NightEnemies, 350, false);
assert.equal(push.phase, 'pressure'); assert.equal(rest.phase, 'recovery'); assert.ok(rest.target < push.target);
assert.ok(rest.group / rest.interval < push.group / push.interval, 'Each minute has a short recovery after pressure');
assert.notEqual(NightEnemySystem.wave(NightEnemies, 320, false).id, NightEnemySystem.wave(NightEnemies, 480, false).id);
assert.ok(Object.isFrozen(NightEnemySystem.stages));
const quota = fixture(); quota.time = 480;
const quotaPlan = quota.wavePlan, elite = Object.entries(NightEnemies).find(([, e]) => e.rank === 'elite');
Object.defineProperty(quota, 'wavePlan', { get: () => ({ ...quotaPlan, entries: [
  { id: 'pumpkin', role: 'special', ranged: true, elite: false, weight: 100 },
  { id: elite[0], role: NightEnemySystem.roleOf(elite[1]), ranged: false, elite: true, weight: 50 },
  { id: 'grave_rat', role: 'swarm', ranged: false, elite: false, weight: 1 }
] }) });
quota.random = () => 0;
for (let i = 0; i < 100; i++) quota.spawnWave();
assert.equal(quota.enemies.filter(e => e.kind === 'pumpkin').length, quotaPlan.quotas.ranged, 'A caster-heavy pool stops at the caster quota');
assert.equal(quota.enemies.filter(e => e.rank === 'elite').length, Math.min(quotaPlan.quotas.elite, quotaPlan.quotas.special - quotaPlan.quotas.ranged), 'Overlapping elite/special limits apply together');
assert.equal(quota.enemies.length, quotaPlan.target, 'Weak enemies fill space after dangerous roles reach their quotas');
console.log('PASS: effective damage, overkill, all 27 weapon sources including clock/laurel evolutions, healing, incoming damage, rewards, 10-second windows, bounded history, checkpoint migration, wave timeline, recovery and threat quotas.');
