const assert = require('node:assert/strict');
require('./core.js'); require('./progress.js');
const data = require('./enemy-roster.js'), system = require('./enemy-system.js');
const clone = x => JSON.parse(JSON.stringify(x));
function fixture() { const g = new NightGame(992, 'hunter', { terrain: false, fireMode: 'manual' }); g.start(); g.enemies = []; g.spawnClock = g.nextBossAt = g.nextMegaAt = 1e8; g.rosterBossIndex = 1e6; return g; }
const g = fixture();
for (const id of ['hammer', 'pistol', 'sling', 'blades']) assert.ok(g.applyUpgrade(NightUpgrades.find(u => u.id === id)));
assert.equal(g.inventory(true).length, 5); assert.equal(g.applyUpgrade(NightUpgrades.find(u => u.id === 'axe')), false);
assert.ok(g.applyUpgrade(NightUpgrades.find(u => u.id === 'pistol')), 'Owned weapons still upgrade when slots are full');
for (const id of ['capital', 'power', 'haste', 'fork', 'magnet']) assert.ok(g.applyUpgrade(NightUpgrades.find(u => u.id === id)));
assert.equal(g.inventory(false).length, 5); assert.equal(g.applyUpgrade(NightUpgrades.find(u => u.id === 'armor')), false);
for (let i = 0; i < 20; i++) {
  g.status = 'running'; g.xp = g.xpNeed; g.checkLevel();
  assert.ok(g.offers.every(u => g.levels[u.id] > 0), 'Level choices never add a sixth weapon or passive');
  if (g.status === 'upgrading') g.choose(0);
}
g.status = 'running'; g.dropChest({kind:'lichLord',bornAt:0,x:g.player.x,y:g.player.y}); g.openChest(g.chests[0]);
assert.ok(g.reward.options.every(o => o.type !== 'upgrade' || g.levels[o.id] > 0));
assert.ok(NightSave.restore(clone(NightSave.capture(g))));
assert.equal(g.selectSlot(6), false); assert.ok(g.selectSlot(5)); assert.equal(g.selectedWeapon, 'blades');
const order = NightSave.restore(clone(NightSave.capture(g))); assert.deepEqual(order.inventory(true), g.inventory(true));
const legacy = clone(NightSave.capture(g)); legacy.version = 6; legacy.status = 'paused'; legacy.reward = null; legacy.levels.axe = 2; legacy.levels.armor = 1;
const restored = NightSave.restore(legacy); assert.ok(restored); assert.equal(restored.inventory(true).length, 6); assert.equal(restored.inventory(false).length, 6);
assert.equal(restored.legacyInventory, true); assert.equal(restored.applyUpgrade(NightUpgrades.find(u => u.id === 'water')), false);
assert.ok(NightSave.restore(clone(NightSave.capture(restored))), 'Grandfathered builds survive another save');
const invalid = clone(NightSave.capture(restored)); invalid.legacyInventory = false; assert.equal(NightSave.restore(invalid), null);
const union = fixture(); for (const id of ['boomerang','hammer','pistol','sling']) union.applyUpgrade(NightUpgrades.find(u=>u.id===id));
union.levels.boomerang = union.levels.hammer = 4; union.applyUpgrade(NightUpgrades.find(u => u.id === 'capital'));
union.evolve(NightCatalog.evolutions.find(r=>r.id==='mikolenin')); assert.equal(union.inventory(true).length,4); assert.ok(union.applyUpgrade(NightUpgrades.find(u=>u.id==='axe')));

assert.equal(data.length, 40); assert.equal(data.filter(e=>e.rank==='elite').length,5); assert.equal(data.filter(e=>['boss','finalBoss'].includes(e.rank)).length,6);
assert.deepEqual(new Set(data.map(e=>e.movement.type)),new Set(['chase','direct','wavy','charger','orbit']));
for (const row of data) {
  assert.ok(Object.isFrozen(NightEnemies[row.id])); const sim = fixture(), e = sim.spawn(row.id, sim.player.x+350,sim.player.y);
  const definition = JSON.stringify(NightEnemies[row.id]); for(let i=0;i<60;i++) sim.update(1/60);
  assert.ok(Number.isFinite(e.x+e.y+e.hp)); assert.equal(JSON.stringify(NightEnemies[row.id]),definition);
  assert.ok(NightSave.restore(clone(NightSave.capture(sim))),row.id+' runtime saves');
}
for(let age=0;age<=3600;age+=30){ const plan=system.wave(NightEnemies,age,false); assert.ok(plan.entries.length<=5); assert.ok(plan.entries.every(e=>NightEnemies[e.id].at<=age || !NightEnemies[e.id].roster)); assert.ok(plan.target<=650); }
const crowd=fixture(); crowd.time=480; for(let i=0;i<100;i++)crowd.spawnWave(); assert.ok(crowd.enemies.length<=crowd.wavePlan.target); assert.ok(crowd.enemies.length<100);
const direction=fixture(), drifter=direction.spawn('crooked_angel',direction.player.x-400,direction.player.y);
const directionX=drifter.chargeX; direction.player.y+=250; direction.updateEnemy(drifter,.1); assert.equal(drifter.chargeX,directionX); assert.equal(drifter.y,direction.player.y-250,'Direct movement keeps its original path');
const orbit=direction.spawn('black_halo',direction.player.x+180,direction.player.y), before=orbit.y; direction.updateEnemy(orbit,.1); assert.notEqual(orbit.y,before);
const boss=direction.spawn('the_administrator',direction.player.x+100,direction.player.y), x=boss.x;
direction.hurtEnemy(boss,1,100); assert.equal(boss.x,x,'Administrator resists knockback'); direction.hurtEnemy(boss,boss.hp+1); assert.equal(boss.alive,false,'Endless mode keeps the Administrator killable');
direction.enemies = direction.enemies.filter(e=>e.alive); assert.ok(NightSave.restore(clone(NightSave.capture(direction))), 'A zero-XP boss does not create an invalid saved gem');
const mother=direction.spawn('boss_mother_pallor',direction.player.x+400,direction.player.y); mother.skillClock=0; direction.updateEnemy(mother,.01); assert.equal(direction.summons.length,3);
const schedule=fixture(); schedule.rosterBossIndex=0;schedule.time=300;schedule.update(.01);assert.equal(schedule.enemies.find(e=>e.boss)?.kind,'boss_bellman');
const index=schedule.rosterBossIndex;const loadedSchedule=NightSave.restore(clone(NightSave.capture(schedule)));assert.equal(loadedSchedule.rosterBossIndex,index);

const treasures=fixture(); assert.equal(treasures.treasures.length,12);assert.deepEqual(treasures.treasures,fixture().treasures);
const cache=treasures.treasures[0];treasures.player.x=cache.x;treasures.player.y=cache.y;treasures.update(.01);
assert.ok(treasures.treasuresTaken.has(0));assert.equal(treasures.status,'reward');assert.equal(treasures.reward.treasure,true);
const cacheSaved=NightSave.restore(clone(NightSave.capture(treasures)));assert.ok(cacheSaved);cacheSaved.claimReward(0);cacheSaved.update(.01);assert.equal(cacheSaved.chestsOpened,1,'A collected cache never respawns');
const wallet=fixture();wallet.awardGold(100);assert.equal(wallet.goldEarned,75);for(let i=0;i<100;i++)wallet.awardGold(1);assert.equal(wallet.goldEarned,150,'Fractional reduced gold accumulates');
const store=new Map(),storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
const p=new NightProgress(storage);assert.deepEqual(p.profile.unlocks,[]);assert.equal(p.purchaseFeature('bestiary'),false);
wallet.awardGold(1000);p.checkpoint(wallet);const balance=p.profile.meta.gold;
const featureQuota=new NightProgress({...storage,setItem(){throw Error('quota');}});assert.equal(featureQuota.purchaseFeature('bestiary'),false);
assert.equal(new NightProgress(storage).profile.meta.gold,balance);assert.equal(new NightProgress(storage).isFeatureUnlocked('bestiary'),false,'A failed feature purchase spends nothing and unlocks nothing');
for(const feature of NightCatalog.features)assert.ok(p.purchaseFeature(feature.id));
assert.equal(p.profile.meta.gold,balance-650);assert.equal(p.purchaseFeature('bestiary'),false);assert.ok(new NightProgress(storage).isFeatureUnlocked('treasureMap'));
p.savePreferences('hunter','manual',6000);assert.ok(new NightProgress(storage).isFeatureUnlocked('necronomicon'));
const failed=new NightProgress({...storage,setItem(){throw Error('quota');}}); const initial=failed.profile.meta.gold;assert.equal(failed.purchaseHero('scout'),false);assert.equal(new NightProgress(storage).profile.meta.gold,initial);
console.log('PASS: strict 5+5 builds, upgrade/chest limits, legacy migration, 40 data-driven enemies, five movements, readable waves, scheduled bosses, treasure caches, 25% less gold and permanent feature unlocks.');
