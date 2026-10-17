const assert = require('node:assert/strict');
require('./core.js'); require('./progress.js');
const clone = x => JSON.parse(JSON.stringify(x));
const ids = ['crossbow', 'gauss', 'plasmaMinigun'];
function fixture(id = 'crossbow', mode = 'manual') {
  const g = new NightGame(682, 'hunter', { terrain: false, fireMode: mode }); g.start();
  g.enemies = []; g.spawnClock = g.nextBossAt = g.nextMegaAt = 1e8; g.rosterBossIndex = 1e6;
  g.shootClock = 1e8; g.levels[id] = 1; g.selectedWeapon = id;
  g.aim = { x: g.player.x + 500, y: g.player.y, active: true }; g.player.invulnerable = 1e8;
  return g;
}
function target(g, dx, dy = 0) {
  const e = g.spawn('brute', g.player.x + dx, g.player.y + dy); e.hp = e.maxHp = 10000; e.speed = 0;
  return e;
}
const tick = (g, seconds) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) g.update(1 / 60); };
assert.equal(NightUpgrades.filter(w => w.id === 'pistol').length, 1, 'The pistol is not duplicated');
for (const id of ids) {
  const item = NightUpgrades.find(w => w.id === id); assert.ok(item?.description && item.projectile);
  const g = fixture(id), e = target(g, 200); tick(g, .4);
  assert.equal(g.relics.length, 0, 'Manual fire waits for the trigger'); assert.equal(e.hp, 10000);
  g.requestAttack(); tick(g, .5); assert.ok(e.hp < 10000, id + ' hits in manual mode');
  assert.ok(g.combat.weapons[id].damage > 0); assert.equal(g.queuedWeapon, null);
  const auto = fixture(id, 'auto'), enemy = target(auto, 200); tick(auto, 1);
  assert.ok(enemy.hp < 10000, id + ' automatically targets an enemy');
  const duplicate = fixture(id); duplicate.levels.fork = 2; duplicate.castRelic(id);
  assert.equal(duplicate.relics.length, 3); assert.equal(duplicate.relics[0].vy, 0, 'The primary projectile preserves aim');
  duplicate.relics = []; duplicate.levels[id] = 4; duplicate.castRelic(id);
  assert.ok(duplicate.relics[0].damage > (item.projectile.damage + item.projectile.rankDamage));
  const capacity = fixture(id); capacity.levels.fork = 100;
  for (let i = 0; i < 100; i++) capacity.castRelic(id);
  assert.equal(capacity.relics.length, 512, 'All new weapons respect the shared projectile budget');
  const save = fixture(id), victim = target(save, 400); save.castRelic(id); tick(save, .05);
  const loaded = NightSave.restore(clone(NightSave.capture(save))); assert.ok(loaded); loaded.pause();
  assert.equal(loaded.relics[0].kind, id); assert.ok(loaded.relics[0].hits instanceof Map);
  tick(save, .8); tick(loaded, .8);
  assert.ok(victim.hp < 10000);
  assert.equal(loaded.enemies.find(e => e.id === victim.id).hp, victim.hp, 'In-flight damage continues across reload');
  assert.deepEqual(loaded.combat.snapshot(), save.combat.snapshot());
  const offer = fixture(); offer.levels.crossbow = 0; offer.offers = [item]; offer.status = 'upgrading';
  assert.ok(offer.choose(0)); assert.equal(offer.levels[id], 1, 'New weapons use ordinary level choices');
  const chest = fixture(id); chest.dropChest({kind:'lichLord',bornAt:0,x:chest.player.x,y:chest.player.y});
  chest.openChest(chest.chests[0]);
  const snapshot = NightSave.capture(chest); snapshot.reward.options = [{type:'upgrade',id,rank:2},{type:'gold',value:50},{type:'shield',value:3}];
  const reward = NightSave.restore(clone(snapshot)); assert.ok(reward); assert.ok(reward.claimReward(0)); assert.equal(reward.levels[id], 2);
}
for (const id of ['crossbow', 'gauss']) {
  const g = fixture(id), first = target(g, 60), second = target(g, 120); g.buildGrid(); g.castRelic(id); g.updateRelics(.2);
  assert.ok(first.hp < 10000 && second.hp < 10000, id + ' uses swept collision and pierces aligned targets');
  const hp = first.hp; g.updateRelics(.01); assert.equal(first.hp, hp, 'A bolt cannot repeatedly damage the same target');
}
const plasma = fixture('plasmaMinigun'), direct = target(plasma, 90), splash = target(plasma, 90, 38);
plasma.buildGrid(); plasma.castRelic('plasmaMinigun'); plasma.updateRelics(.18);
assert.ok(direct.hp < 10000 && splash.hp < 10000, 'Plasma damages a nearby target through its small explosion');
assert.ok(direct.hp < splash.hp, 'Splash is weaker than a direct hit');
const old = fixture(); old.levels.crossbow = 0; old.levels.needle = 1; old.selectedWeapon = 'needle'; old.awardGold(100);
const legacy = clone(NightSave.capture(old)); legacy.version = 7;
for (const id of ids) { delete legacy.levels[id]; delete legacy.clocks[id]; }
const restored = NightSave.restore(legacy); assert.ok(restored);
for (const id of ids) { assert.equal(restored.levels[id], 0); assert.equal(restored.weaponClocks[id], .3); }
assert.equal(restored.goldEarned, old.goldEarned); assert.equal(restored.level, old.level);
const broken = clone(NightSave.capture(restored)); delete broken.levels.gauss; assert.equal(NightSave.restore(broken), null, 'New snapshots require every weapon rank');
console.log('PASS: three distinct sci-fi weapons, existing pistol, manual/auto fire, ranks, Duplicator, swept piercing, plasma splash, budgets, chest choices, in-flight saves and v7 migration.');
