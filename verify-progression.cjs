const assert = require('node:assert/strict');
require('./core.js'); require('./progress.js');
const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const g = new NightGame(847, 'hunter', { terrain: false, fireMode: 'manual' }); g.start();
  g.enemies = []; g.spawnClock = g.nextBossAt = g.nextMegaAt = 1e6; return g;
}
function open(g, kind = 'lichLord', bornAt = 600) {
  g.dropChest({ kind, mega: kind === 'darVetro', bornAt, x: g.player.x, y: g.player.y });
  assert.ok(g.openChest(g.chests.at(-1)));
}
const recipe = NightCatalog.evolutions.find(r => r.id === 'mikolenin');
const union = fixture(); union.levels.boomerang = 4; union.levels.hammer = 3; union.levels.capital = 1;
assert.equal(union.canEvolve(recipe), false, 'Both union weapons must be maxed');
union.levels.hammer = 4; union.selectedWeapon = 'hammer'; union.weaponPage = 2;
union.castBoomerang(); union.castRelic('hammer'); assert.ok(union.boomerangs.length && union.meteors.length);
open(union); assert.equal(union.levels.hammer, 4); assert.equal(union.evolutions.size, 0);
assert.equal(union.claimReward(-1), false); assert.equal(union.claimReward(3), false);
const pending = clone(NightSave.capture(union)), resumed = NightSave.restore(pending); assert.ok(resumed);
const selected = resumed.reward.options.findIndex(o => o.id === 'mikolenin'); assert.ok(selected >= 0);
assert.ok(resumed.claimReward(selected)); assert.equal(resumed.levels.hammer, 0); assert.equal(resumed.levels.capital, 1);
assert.equal(resumed.selectedWeapon, 'boomerang'); assert.equal(resumed.weaponPage, 0);
assert.equal(resumed.boomerangs.length, 0); assert.equal(resumed.meteors.filter(m => m.kind === 'hammer').length, 0);
assert.equal(resumed.applyUpgrade(NightUpgrades.find(u => u.id === 'hammer')), false);
const auraVictim = resumed.spawn('brute', resumed.player.x + 200, resumed.player.y); auraVictim.hp = auraVictim.maxHp = 10000;
resumed.buildGrid(); resumed.castBoomerang(); assert.equal(auraVictim.hp, 9913.3, 'Aura reaches beyond garlic and deals 86.7 tuned damage');
assert.equal(resumed.boomerangs.length, 0); assert.equal(resumed.greed, 1.15);
assert.ok(NightSave.restore(clone(NightSave.capture(resumed))));
const corrupt = clone(pending); corrupt.reward.options[1] = corrupt.reward.options[0]; assert.equal(NightSave.restore(corrupt), null);

const old = clone(NightSave.capture(resumed)); old.version = 4; old.evolutions = ['heavenSickle'];
for (const id of ['hammer', 'capital', 'pistol', 'sling']) { delete old.levels[id]; delete old.clocks[id]; }
const migrated = NightSave.restore(old); assert.ok(migrated); assert.ok(migrated.evolutions.has('mikolenin')); assert.equal(migrated.levels.capital, 1);
const oldReward = clone(pending); oldReward.version = 4;
oldReward.selectedWeapon = 'needle';
oldReward.reward = { id: pending.reward.id, source: 'lichLord', count: 1, items: [{ id: 'needle', rank: 1 }], heal: 0, xp: 25 };
for (const id of ['hammer', 'capital', 'pistol', 'sling']) { delete oldReward.levels[id]; delete oldReward.clocks[id]; }
const legacyReward = NightSave.restore(oldReward); assert.ok(legacyReward);
const legacyGold = legacyReward.goldEarned; assert.ok(legacyReward.claimReward()); assert.equal(legacyReward.goldEarned, legacyGold, 'Old already-applied rewards never pay twice');

const full = fixture(); full.stressMode = true; for (const u of NightUpgrades) while (full.levels[u.id] < u.max) full.applyUpgrade(u);
full.stressMode = false; open(full, 'lichLord', 0); assert.deepEqual(full.reward.options.map(o => o.type), ['gold', 'xp', 'shield']);
assert.equal(full.goldEarned, 0); const fullReloaded = NightSave.restore(clone(NightSave.capture(full))); assert.ok(fullReloaded);
fullReloaded.claimReward(0); assert.equal(fullReloaded.goldEarned, Math.floor(60 * .45 * fullReloaded.greed), 'Only selected gold plus chest gold is applied, including greed');
const afterGold = fullReloaded.goldEarned; assert.equal(fullReloaded.claimReward(1), false); assert.equal(fullReloaded.goldEarned, afterGold);
assert.equal(fullReloaded.shieldCharges, 0); assert.equal(fullReloaded.xp, 0);

for (const id of ['pistol', 'sling']) {
  const g = fixture(); g.levels[id] = 4; g.levels.fork = 2; g.aim = { x: g.player.x + 250, y: g.player.y, active: true };
  g.castRelic(id); assert.equal(g.relics.length, 5); assert.ok(NightSave.restore(clone(NightSave.capture(g))));
  g.relics = []; const evo = NightCatalog.evolutions.find(r => r.weapon === id);
  for (const passive of Object.keys(evo.passives)) g.levels[passive] = 1;
  assert.ok(g.evolve(evo)); const e = g.spawn('lichLord', g.player.x + 70, g.player.y); e.hp = e.maxHp = 10000; e.speed = 0;
  g.buildGrid(); g.random = () => 0; g.castRelic(id); g.updateRelics(.1); assert.ok(e.hp < 9900, id + ' evolved collision damages a boss');
  assert.ok(NightSave.restore(clone(NightSave.capture(g))));
}

const drops = fixture(); drops.burst = () => {}; drops.addGem = () => {};
let roll = .02; drops.random = () => roll;
let e = drops.spawn('ghoul', 500, 500); drops.hurtEnemy(e, 1e6); assert.equal(drops.hearts.length, 0, 'Old 3.5% range is now halved');
roll = .004; e = drops.spawn('ghoul', 500, 500); drops.hurtEnemy(e, 1e6); assert.equal(drops.hearts.length, 1);
roll = .3; e = drops.spawn('lichLord', 500, 500); drops.hurtEnemy(e, 1e6); assert.equal(drops.hearts.length, 1, 'Boss healing is now a 25% drop');
roll = .2; e = drops.spawn('lichLord', 500, 500); drops.hurtEnemy(e, 1e6); assert.equal(drops.hearts.length, 2);
const waves = fixture(); waves.time = 480; waves.spawnClock = 0; waves.spawnWave();
assert.equal(waves.waveAge, 312); assert.equal(waves.enemies.length, 17); assert.ok(Math.abs(waves.spawnClock - (5 / 12 * .8)) < 1e-9);
assert.ok(waves.enemies.every(e => e.maxHp / NightEnemies[e.kind].hp > 2 && e.maxHp / NightEnemies[e.kind].hp < 3));
waves.time = 600; assert.equal(waves.waveAge, 390); waves.time = 1800; assert.equal(waves.waveAge, 1410, 'Endless difficulty continues after the gentler opening');

const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
const p = new NightProgress(storage); assert.deepEqual(p.profile.heroes.unlocked, ['hunter']);
assert.equal(p.purchaseHero('scout'), false); const earnings = fixture(); earnings.awardGold(1000); p.checkpoint(earnings);
const beforeGold = p.profile.meta.gold; assert.ok(p.purchaseHero('scout')); assert.equal(p.profile.meta.gold, beforeGold - 300);
assert.equal(p.purchaseHero('scout'), false); const tab2 = new NightProgress(storage); assert.equal(tab2.purchaseHero('scout'), false);
assert.ok(tab2.isHeroUnlocked('scout')); tab2.savePreferences('ripley', 'auto', 6000); assert.equal(tab2.profile.character, 'hunter', 'Previewing a locked hero does not select it for a real run');
assert.ok(tab2.purchase('vital', 0)); p.savePreferences('scout', 'manual', 6000);
assert.equal(p.profile.meta.ranks.vital, 1); assert.ok(new NightProgress(storage).isHeroUnlocked('scout'));
const failed = new NightProgress({ ...storage, setItem() { throw new Error('QuotaExceeded'); } });
const balance = p.profile.meta.gold; assert.equal(failed.purchaseHero('duelist'), false); assert.equal(new NightProgress(storage).profile.meta.gold, balance);
assert.equal(new NightProgress(storage).isHeroUnlocked('duelist'), false);
const stress = new NightGame(847, 'samus', { stressMode: true }); stress.start(); assert.equal(p.checkpoint(stress), false); assert.equal(p.isHeroUnlocked('samus'), false);
const legacyProfile = clone(p.profile); delete legacyProfile.heroes; legacyProfile.character = 'ripley';
storage.setItem('ascii-night-progress-v2', JSON.stringify(legacyProfile));
storage.setItem('ascii-night-run-v1', JSON.stringify({ characterId: 'samus' }));
const legacyShop = new NightProgress(storage); assert.deepEqual(new Set(legacyShop.profile.heroes.unlocked), new Set(['hunter', 'ripley', 'samus']));
assert.equal(legacyShop.profile.meta.gold, balance, 'Introducing hero unlocks preserves the gold wallet');
console.log('PASS: Mikolenin union and migration, pending 1-of-3 chests, no duplicate payout, pistol/slingshot combat, half healing drops, gentler endless waves and paid hero unlocks.');
