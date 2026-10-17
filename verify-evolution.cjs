const assert = require('node:assert/strict');
require('./core.js'); require('./progress.js');
const clone = value => JSON.parse(JSON.stringify(value));
const tick = (g, seconds) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) { g.update(1 / 60); if (g.status === 'upgrading') g.choose(0); } };
function fixture() {
  const g = new NightGame(724, 'hunter', { terrain: false, fireMode: 'manual' }); g.start();
  g.enemies = []; g.spawnClock = g.shootClock = g.nextBossAt = g.nextMegaAt = 1e6;
  g.player.invulnerable = 1e8; return g;
}
function equip(g, recipe) {
  for (const id of [recipe.weapon, ...(recipe.weapons || [])]) g.levels[id] = NightUpgrades.find(u => u.id === id).max;
  for (const [id, rank] of Object.entries(recipe.passives)) while (g.levels[id] < rank) g.applyUpgrade(NightUpgrades.find(u => u.id === id));
  return g;
}
function evolved(weapon) {
  const g = fixture(), recipe = NightCatalog.evolutions.find(r => r.weapon === weapon);
  equip(g, recipe); assert.ok(g.evolve(recipe)); return g;
}
function chest(g, bornAt = 600, kind = 'lichLord') {
  g.time = bornAt; const boss = g.spawn(kind, g.player.x + 260, g.player.y); g.dropChest(boss);
  g.enemies = []; g.buildGrid(); return g.chests[g.chests.length - 1];
}
assert.equal(NightCatalog.evolutions.length, 22);
assert.equal(new Set(NightCatalog.evolutions.map(r => r.weapon)).size, 22);
const permanent = new NightGame(724, 'hunter', { meta: { armor: 5 } }); permanent.levels.rune = 4;
assert.equal(permanent.canEvolve(NightCatalog.evolutions.find(r => r.weapon === 'rune')), false, 'Permanent legacy upgrades do not replace a run catalyst');
const blades = fixture(); blades.setFireMode('auto'); blades.levels.blades = 1;
assert.equal(blades.bladePositions().length, 1);
blades.applyUpgrade(NightUpgrades.find(u => u.id === 'fork')); assert.equal(blades.bladePositions().length, 2, 'Duplicator adds the missing physical orbit blade');
blades.levels.fork = 3; assert.equal(blades.bladePositions().length, 4);
assert.equal(new Set(blades.bladePositions().map(b => b.angle)).size, 4, 'Extra blades occupy distinct orbit positions');
blades.levels.bible = 1; blades.castRelic('bible'); assert.equal(blades.biblePositions().length, 5);
blades.setFireMode('manual'); assert.equal(blades.bladePositions().length, 0); blades.castSlash(); assert.equal(blades.slashes.length, 4);

for (const recipe of NightCatalog.evolutions) {
  const g = fixture(); assert.equal(g.canEvolve(recipe), false);
  equip(g, recipe); assert.equal(g.canEvolve(recipe), true, recipe.id + ' requirements');
  const required = Object.entries(recipe.passives).find(([, rank]) => rank > 1);
  if (required) { g.levels[required[0]]--; assert.equal(g.canEvolve(recipe), false, 'Special catalysts require their maximum rank'); g.levels[required[0]]++; }
  const dropped = chest(g); assert.ok(g.openChest(dropped));
  assert.equal(g.evolutions.size, 0, 'Opening a chest never applies the offered evolution');
  assert.equal(g.reward.options.filter(item => item.type === 'evolution').length, 1);
  assert.equal(g.openChest(dropped), false, 'One chest cannot pay twice');
  const resumed = NightSave.restore(clone(NightSave.capture(g)));
  assert.ok(resumed, recipe.id + ' reward resumes'); assert.equal(resumed.evolutions.size, 0);
  const choice = resumed.reward.options.findIndex(item => item.id === recipe.id);
  assert.ok(choice >= 0); assert.ok(resumed.claimReward(choice)); assert.ok(resumed.evolutions.has(recipe.id));
  assert.equal(resumed.weaponInfo(recipe.weapon).title, recipe.title);
  assert.equal(resumed.evolve(recipe), false, 'Evolution cannot be granted twice');
}
const early = fixture(); equip(early, NightCatalog.evolutions[0]); const earlyChest = chest(early, 599);
early.time = 900; const earlyResumed = NightSave.restore(clone(NightSave.capture(early))); assert.ok(earlyResumed); earlyResumed.pause();
assert.equal(earlyResumed.chests[0].canEvolve, false); earlyResumed.openChest(earlyResumed.chests[0]); assert.equal(earlyResumed.evolutions.size, 0, 'Waiting cannot upgrade an early chest');
const missing = fixture(); missing.levels.whip = 3; missing.applyUpgrade(NightUpgrades.find(u => u.id === 'vital')); missing.openChest(chest(missing));
assert.equal(missing.evolutions.size, 0, 'A chest upgrade to max rank is not an evolution in the same reward');
const mega = fixture(); for (const recipe of NightCatalog.evolutions) equip(mega, recipe);
mega.openChest(chest(mega, 600, 'darVetro')); assert.equal(mega.evolutions.size, 0);
assert.equal(mega.reward.options.filter(item => item.type === 'evolution').length, 3); assert.ok(NightSave.restore(clone(NightSave.capture(mega))));
assert.ok(mega.claimReward(1)); assert.equal(mega.evolutions.size, 1, 'Even a mega-boss chest grants only the selected reward');

const union = evolved('birds'); assert.equal(union.levels.ebony, 0); assert.ok(union.isConsumed('ebony'));
assert.equal(union.applyUpgrade(NightUpgrades.find(u => u.id === 'ebony')), false); union.grantXP(union.xpNeed); assert.ok(union.offers.every(u => u.id !== 'ebony'));
const retarget = fixture(); const unionRecipe = NightCatalog.evolutions.find(r => r.id === 'vandalier'); equip(retarget, unionRecipe); retarget.selectedWeapon = 'ebony'; retarget.evolve(unionRecipe); assert.equal(retarget.selectedWeapon, 'birds');
const old = fixture(); old.levels.birds = 2; const legacy = clone(NightSave.capture(old)); legacy.version = 3;
for (const id of ['ebony','silverRing','goldRing','leftSign','rightSign']) delete legacy.levels[id]; delete legacy.clocks.ebony;
delete legacy.evolutions; delete legacy.enemyBirths; delete legacy.clockStep;
const migrated = NightSave.restore(legacy); assert.ok(migrated); assert.equal(migrated.levels.birds, 2); assert.equal(migrated.levels.ebony, 2, 'The former pair preserves both birds on migration');
assert.equal(migrated.evolutions.size, 0);

const needles = evolved('needle'); needles.aim = { x: needles.player.x + 250, y: needles.player.y, active: true }; needles.fire(); assert.ok(needles.shots[0].remaining >= 4); assert.ok(needles.shots[0].damage > needles.damage);
const axes = evolved('axe'); axes.castRelic('axe'); assert.ok(axes.relics.length >= 8); assert.ok(axes.relics.some(s => s.vx < 0) && axes.relics.some(s => s.vx > 0));
const initialVY = axes.relics[0].vy; tick(axes, .1); assert.equal(axes.relics[0].vy, initialVY, 'Death spiral has radial flight instead of gravity');
const water = evolved('water'); water.castRelic('water'); const pool = water.pools[0], distance = Math.hypot(pool.x - water.player.x, pool.y - water.player.y), radius = pool.radius;
tick(water, .2); assert.ok(pool.radius > radius); assert.ok(Math.hypot(pool.x - water.player.x, pool.y - water.player.y) < distance);
const rune = evolved('rune'); rune.aim = { x: rune.player.x + 400, y: rune.player.y, active: true }; rune.castRelic('rune'); tick(rune, 1.65); assert.ok(rune.rings.length, 'A rune ricochet explodes');
const garlic = evolved('garlic'); garlic.player.hp = 50; const victim = garlic.spawn('brute', garlic.player.x + 40, garlic.player.y); victim.hp = victim.maxHp = 10000; garlic.buildGrid(); garlic.castRelic('garlic'); assert.equal(garlic.player.hp, 51);
const whip = evolved('whip'); whip.player.hp = 50; whip.random = () => 0; const whipped = whip.spawn('brute', whip.player.x + 40, whip.player.y); whip.aim = { x: whipped.x, y: whipped.y, active: true }; whip.buildGrid(); whip.castRelic('whip'); assert.equal(whip.player.hp, 55, 'Critical whip hits heal once per cast');
const shield = evolved('laurel'); shield.player.invulnerable = 0; const hp = shield.player.hp; shield.hurtPlayer(1000); assert.equal(shield.player.hp, hp - 10);
const bible = evolved('bible'); bible.setFireMode('auto'); assert.ok(bible.biblePositions().length, 'Evolved books have no automatic downtime'); bible.setFireMode('manual'); assert.equal(bible.biblePositions().length, 0); bible.castRelic('bible'); assert.ok(bible.biblePositions().length);
const clock = evolved('clock'); const half = clock.spawn('brute', clock.player.x + 100, clock.player.y); half.hp = half.maxHp = 1000; clock.buildGrid(); clock.clockStep = 11; clock.castRelic('clock'); assert.equal(half.hp, 500);
const thunder = evolved('lightning'); thunder.spawn('brute', thunder.player.x + 70, thunder.player.y); thunder.buildGrid(); thunder.setFireMode('auto'); thunder.castLightning(); assert.ok(thunder.meteors.some(m => m.kind === 'echo'));
const moon = evolved('pentagram'); moon.addGem(moon.player.x + 1100, moon.player.y, 2); moon.castRelic('pentagram'); assert.ok(moon.gems[0].magnetized); assert.ok(moon.xp >= 25);
for (const active of [axes, water, rune, thunder, bible, clock]) assert.ok(NightSave.restore(clone(NightSave.capture(active))), 'Active evolved effects survive a JSON save');
const corrupt = clone(NightSave.capture(shield)); corrupt.evolutions.push('unknown'); assert.equal(NightSave.restore(corrupt), null);
console.log('PASS: Duplicator orbits and manual attacks, 22 chest evolutions, catalyst ranks, early-chest timing, one-of-three mega rewards, unions, old-save migration and distinct evolved combat effects.');
