const assert = require('node:assert/strict');
require('./core.js'); require('./progress.js'); require('./renderer.js');
const {readContent, validateContent} = require('./build-content.cjs');
const clone = x => JSON.parse(JSON.stringify(x));
const item = id => NightUpgrades.find(u => u.id === id);
function fixture(seed = 1666, hero = 'hunter') { const g = new NightGame(seed,hero,{terrain:false,fireMode:'manual'}); g.start(); g.enemies=[]; return g; }
const tiers = Object.keys(NightCatalog.rarities);
const representatives = tiers.map(rarity => NightUpgrades.find(u => u.weapon && u.rarity === rarity));
assert.equal(new Set(NightUpgrades.map(u => u.icon)).size,NightUpgrades.length,'Every weapon and passive has a distinct ASCII icon');
for(const u of NightUpgrades) assert.match(u.icon,/^[\x20-\x7e]+$/);
for(const mutate of [d=>d.weapons[0].rarity='mythical', d=>d.passives[0].icon=d.weapons[0].icon]) {
  const d=readContent(); mutate(d);assert.throws(()=>validateContent(d,require('./data/enemies.json')),/Content data/);
}
const lottery=fixture(), counts=Object.fromEntries(tiers.map(t=>[t,0]));
for(let i=0;i<50000;i++) counts[lottery.pickUpgrade(representatives).rarity]++;
for(let i=1;i<tiers.length;i++) assert.ok(counts[tiers[i-1]]>counts[tiers[i]]*1.35,'Higher tiers are noticeably rarer per item');
assert.ok(counts.common>counts.legendary*12);
const legendary=item('gauss'), before=lottery.upgradeWeight(legendary); lottery.levels.luck=5;
assert.ok(lottery.upgradeWeight(legendary)>before);assert.ok(lottery.upgradeWeight(legendary)<lottery.upgradeWeight(item('pistol')),'Luck improves rarity without reversing the tier order');
assert.equal(NightMeta.some(u=>u.id==='luck'),false,'Luck is currently an in-run passive, not a Legacy purchase');
for(let seed=1;seed<=300;seed++) {
  const g=fixture(seed);g.grantXP(6);assert.equal(g.offers.length,3);assert.equal(new Set(g.offers).size,3);
  assert.ok(g.offers.some(u=>u.weapon&&!g.levels[u.id]));assert.equal(g.offerSelection,-1);
}
const g=fixture();g.grantXP(6);const initial=clone(g.levels), time=g.time;
assert.equal(g.selectOffer(99),false);assert.ok(g.selectOffer(0));
assert.deepEqual(g.levels,initial,'Selecting a card never applies its reward');assert.equal(g.status,'upgrading');
const banned=g.offers[0].id;assert.ok(g.banishOffer());assert.equal(g.banishesLeft,2);assert.equal(g.offerSelection,-1);
assert.equal(g.levels[banned],initial[banned]);assert.ok(!g.offers.some(u=>u.id===banned));assert.equal(g.canUpgrade(item(banned)),false);
assert.ok(g.selectOffer(1));const checkpoint=clone(NightSave.capture(g)), restored=NightSave.restore(checkpoint);
assert.ok(restored);assert.equal(restored.status,'upgrading');assert.deepEqual(restored.banished,g.banished);assert.equal(restored.offerSelection,1);
assert.equal(restored.banishesLeft,2);assert.equal(restored.skipsLeft,3);
assert.equal(restored.random(),g.random(),'Lottery continues from the same seeded RNG after reload');
assert.ok(restored.choose(restored.offerSelection));assert.equal(restored.offerSelection,-1);assert.equal(restored.status,'running');
assert.equal(Object.values(restored.levels).reduce((a,b)=>a+b),Object.values(initial).reduce((a,b)=>a+b)+1,'Only confirmed card applies');
for(const mutate of [s=>s.banishesLeft=3,s=>s.skipsLeft=-1,s=>s.skipsLeft=.5,s=>s.banished=['missing'],s=>s.banished=[banned,banned],s=>s.offerSelection=3,s=>s.offers[0]=banned]) {
  const bad=clone(checkpoint);mutate(bad);assert.equal(NightSave.restore(bad),null,'Corrupt choice state is rejected');
}
for(let i=0;i<2;i++)assert.ok(g.banishOffer(0));assert.equal(g.banishesLeft,0);assert.equal(g.banishOffer(0),false);
assert.deepEqual(g.levels,initial);assert.equal(g.time,time);
assert.ok(g.skipUpgrade());assert.equal(g.skipsLeft,2);assert.deepEqual(g.levels,initial);assert.equal(g.status,'running');
for(let i=0;i<2;i++){g.grantXP(g.xpNeed);assert.ok(g.skipUpgrade());}
g.grantXP(g.xpNeed);assert.equal(g.skipUpgrade(),false);assert.equal(g.status,'upgrading');
assert.ok(g.offers.every(u=>!g.banished.has(u.id)));
const overflow=fixture();overflow.grantXP(100);const level=overflow.level;assert.ok(overflow.skipUpgrade());assert.equal(overflow.level,level+1);assert.equal(overflow.status,'upgrading');assert.equal(overflow.offerSelection,-1);
const chest=fixture();chest.banished.add('pistol');chest.banishesLeft=2;const drop={id:1,source:'lichLord',x:chest.player.x,y:chest.player.y,canEvolve:false};chest.chests.push(drop);assert.ok(chest.openChest(drop));assert.ok(chest.reward.options.every(o=>o.id!=='pistol'));
// Evolving a fully upgraded owned item remains possible even after banishing its rank-ups.
const evolution=fixture();evolution.levels.pistol=4;evolution.levels.luck=1;evolution.banished.add('pistol');
assert.ok(evolution.readyEvolutions().some(e=>e.weapon==='pistol'));
const legacy=clone(NightSave.capture(fixture(33,'ark')));legacy.version=9;legacy.levels.crowbar=0;legacy.levels.gauss=1;legacy.weaponOrder=['gauss'];legacy.selectedWeapon='gauss';delete legacy.levels.gauntlets;delete legacy.clocks.gauntlets;
for(const key of ['banished','banishesLeft','skipsLeft','offerSelection'])delete legacy[key];
const old=NightSave.restore(legacy);assert.ok(old,'A real v9 Freeman gauss build migrates');assert.equal(old.skipsLeft,3);assert.equal(old.banishesLeft,3);assert.equal(old.levels.gauntlets,0);assert.deepEqual(old.inventory(true),['gauss']);
const freeman=fixture(44,'ark'), ripley=fixture(44,'ripley');assert.deepEqual(freeman.inventory(true),['crowbar']);assert.deepEqual(ripley.inventory(true),['flamethrower']);
const fists=fixture();fists.levels.gauntlets=1;fists.aim={x:fists.player.x+500,y:fists.player.y,active:true};
function victim(dx,dy=0){const e=fists.spawn('brute',fists.player.x+dx,fists.player.y+dy);e.hp=e.maxHp=10000;e.speed=0;return e;}
const front=victim(65),back=victim(-65),far=victim(300);fists.buildGrid();fists.castRelic('gauntlets');
assert.equal(front.hp,9960);assert.equal(back.hp,10000);assert.equal(far.hp,10000);assert.equal(fists.slashes.length,2);
const hp=front.hp;fists.levels.fork=2;fists.castRelic('gauntlets');assert.equal(hp-front.hp,80);assert.equal(fists.slashes.length,6);
assert.ok(NightSave.restore(clone(NightSave.capture(fists))),'Gauntlet levels and cooldowns survive saving');
ripley.aim={x:ripley.player.x+500,y:ripley.player.y,active:true};ripley.castRelic('flamethrower');
const drawn=[],renderer=Object.create(NightRenderer.prototype);
Object.assign(renderer,{width:1000,height:600,scaleX:1,scaleY:1,worldWidth:ripley.width,worldHeight:ripley.height,enemyCells:new Uint8Array(100),ctx:{fillRect(){}},scenery(){},world(x,y,glyph,ink){drawn.push({x,y,glyph,ink});},circle(){},line(){}});
renderer.render(ripley,{x:ripley.player.x,y:ripley.player.y});
assert.ok(drawn.some(p=>p.ink===12&&[')}','{~'].includes(p.glyph)),'Flame has animated tongues');
assert.ok(drawn.some(p=>p.ink===7&&p.glyph==='~'),'Flame has a contrasting multicolor trail');
drawn.length=0;fists.time=.15;for(const s of fists.slashes)s.life=.14;renderer.render(fists,{x:fists.player.x,y:fists.player.y});
assert.equal(drawn.filter(p=>p.glyph==='[=]').length,6,'Each punch renders one moving fist, rather than an arc of repeated fists');
console.log('PASS: five weighted rarity tiers, luck, distinct ASCII icons, two-step selection, banish/skip budgets and overflow, excluded chest offers, v9 migration, saved pending selection, Freeman/Ripley loadouts and directional gauntlet combos.');
