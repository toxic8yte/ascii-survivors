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
for (const [level, expected] of [[1,1000],[5,757],[10,581],[20,396]]) {
  const xp = fixture(); xp.level = level; xp.xpNeed = 5000; xp.gainXP(1000);
  assert.equal(xp.xp,expected,'The same crystal value becomes less effective with hero level');
  const split = fixture(); split.level = level; split.xpNeed = 5000;
  for(let i=0;i<1000;i++)split.gainXP(1);
  assert.equal(split.xp,xp.xp,'Fractional XP prevents small crystals from rounding to zero');
  const continued = NightSave.restore(clone(NightSave.capture(split))); assert.ok(continued);
  for(let i=0;i<91;i++){continued.gainXP(1);split.gainXP(1);}
  assert.equal(continued.xp,split.xp); assert.equal(continued.xpCarry,split.xpCarry);
}
const amplified = fixture(); amplified.levels.growth=5; amplified.meta.growth=5; amplified.level=20;
assert.ok(amplified.growth*amplified.xpEfficiency < .56,'Maximum Growth and Legacy cannot cancel late-level XP decay');
const passives = fixture(); passives.levels.power=passives.levels.haste=5;
assert.equal(passives.power,1.5);assert.equal(passives.haste,1.4);assert.ok(passives.power*passives.haste<2.11);
passives.levels.area=passives.levels.duration=passives.levels.velocity=5;
assert.equal(passives.area,1.3);assert.equal(passives.effectDuration,1.4);assert.equal(passives.projectileSpeed,1.4);
for(const [kind,roll,expected] of [['ghoul',.008749,1],['ghoul',.00875,0],['ghoul',.01749,0],['lichLord',.24999,1],['lichLord',.25,0],['lichLord',.4999,0]]) {
  const drops=fixture();drops.burst=()=>{};const e=drops.spawn(kind,500,500);drops.random=()=>roll;drops.hurtEnemy(e,e.hp+1);
  assert.equal(drops.hearts.length,expected,'Another exact 50% reduction in normal/boss healing drop probabilities');
}
const lucky=fixture();lucky.levels.luck=5;lucky.random=()=>NightBalance.heartDropChance*lucky.luck;const unluckyDrop=lucky.spawn('ghoul',500,500);lucky.hurtEnemy(unluckyDrop,10000);assert.equal(lucky.hearts.length,0,'Luck respects the new half-open drop threshold');
for(const weapon of NightUpgrades.filter(u=>u.weapon)) {
  assert.ok(weapon.damageMultiplier>0&&weapon.damageMultiplier<=1,weapon.id+' has an explicit damage audit');
  const sim=fixture(), e=sim.spawn('brute',sim.player.x+100,sim.player.y);e.hp=e.maxHp=1000;
  sim.hurtEnemy(e,100,0,weapon.id);
  assert.ok(Math.abs(e.hp-(1000-100*weapon.damageMultiplier))<1e-8,weapon.id+' damage is scaled exactly once');
  assert.ok(Math.abs(sim.combat.total.damage-100*weapon.damageMultiplier)<1e-8,'Metrics count actual tuned damage');
}
const splash=fixture();splash.levels.plasmaMinigun=1;splash.aim={x:splash.player.x+400,y:splash.player.y,active:true};
const main=splash.spawn('brute',splash.player.x+90,splash.player.y), side=splash.spawn('brute',splash.player.x+90,splash.player.y+35);
for(const e of [main,side]){e.hp=e.maxHp=1000;e.speed=0;}splash.buildGrid();splash.castRelic('plasmaMinigun');splash.updateRelics(.2);
assert.ok(Math.abs(main.hp-993.76)<1e-8);assert.ok(Math.abs(side.hp-998.56)<1e-8,'Splash gets one multiplier, without squaring it');
const finite=fixture();finite.levels.pentagram=4;const tank=finite.spawn('brute',finite.player.x+100,finite.player.y);tank.hp=tank.maxHp=100000;finite.buildGrid();finite.castRelic('pentagram');
assert.equal(tank.hp,99800,'Pentagram has finite ordinary damage, not an unconditional execution');
finite.levels.magnet=3;finite.evolutions.add(NightCatalog.evolutions.find(e=>e.weapon==='pentagram').id);const xpBefore=finite.xp;finite.castRelic('pentagram');assert.equal(finite.xp,xpBefore,'Casting a spell cannot create free XP');
const armored=fixture({meta:{armor:5}});armored.levels.armor=5;armored.hurtPlayer(8);assert.equal(armored.player.hp,98,'Even high armor leaves at least 25% incoming damage');
const regeneration=fixture();regeneration.player.hp=50;regeneration.levels.regen=3;regeneration.levels.leftSign=5;regeneration.player.invulnerable=1e6;
for(let i=0;i<60;i++)regeneration.update(1/60);
assert.ok(Math.abs(regeneration.player.hp-51.1)<1e-8,'Regeneration sources no longer erase several HP of damage every second');
const leech=new NightGame(811,'whisper',{terrain:false,fireMode:'manual'});leech.start();leech.enemies=[];leech.spawnClock=leech.nextBossAt=1e6;leech.leechBudget=0;leech.player.hp=20;
for(let i=0;i<60;i++)leech.update(1/60);
const food=leech.spawn('brute',leech.player.x+100,leech.player.y);leech.hurtEnemy(food,100,0,'poison');
assert.ok(Math.abs(leech.player.hp-20.6)<1e-8,'Life-steal refill is capped at 0.6 HP/s across the entire crowd');
const validation=require('./build-content.cjs');
for(const multiplier of [0,-1,1.1,null]){const data=validation.readContent();data.weapons[0].damageMultiplier=multiplier;assert.throws(()=>validation.validateContent(data,require('./data/enemies.json')),/damage multiplier/);}
console.log('PASS: slower level-scaled fractional XP and saves, linear passive power/haste, audited weapon damage and splash, finite pentagram with no free XP, another half healing drops, armor cap, reduced regeneration, gold, stronger post-six-minute enemies and retained encounters.');
