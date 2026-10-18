const assert = require('node:assert/strict');
require('./core.js');require('./progress.js');require('./renderer.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(seed=112,map='forest') {const g=new NightGame(seed,'hunter',{map,fireMode:'manual'});g.start();g.enemies=[];g.spawnClock=g.nextBossAt=1e6;return g;}
function visit(g,kind){const box=g.supplyCrates.find(c=>c.kind===kind&&!g.supplyTaken.has(c.id));assert.ok(box);g.player.x=box.x;g.player.y=box.y;return box;}
for(const map of ['forest','graveyard']) {
  const g=fixture(112,map);assert.equal(g.supplyCrates.length,48);assert.equal(new Set(g.supplyCrates.map(c=>c.kind)).size,3);
  assert.deepEqual(g.supplyCrates,fixture(112,map).supplyCrates,'Box layout is deterministic for resume');
  assert.notDeepEqual(g.supplyCrates,fixture(113,map).supplyCrates,'A new seed changes positions and contents');
  assert.ok(g.supplyCrates.every(c=>Math.hypot(c.x-g.player.x,c.y-g.player.y)>300),'Rewards require travelling');
  for(const box of g.supplyCrates){const copy={...box};assert.equal(g.resolveTerrain(copy),false,'Boxes spawn outside solid obstacles');}
  const heal=visit(g,'heal');g.player.hp=40;assert.ok(g.openSupply(heal));assert.equal(g.player.hp,70);assert.equal(g.openSupply(heal),false,'A box pays only once');
  const saved=NightSave.capture(g), restored=NightSave.restore(clone(saved));assert.ok(restored);restored.pause();assert.deepEqual(restored.supplyTaken,g.supplyTaken);assert.equal(restored.openSupply(restored.supplyCrates[heal.id]),false,'Reload cannot duplicate healing');
  for(const value of [[heal.id,heal.id],[-1],[48],['1']]){const bad=clone(saved);bad.supplyTaken=value;assert.equal(NightSave.restore(bad),null);}
  delete saved.supplyTaken;assert.equal(NightSave.restore(saved).supplyTaken.size,0,'Old checkpoints acquire an untouched box layout');
}
const level=fixture();level.level=30;level.xpNeed=5000;level.xp=120;const ranks={...level.levels};
const tome=visit(level,'level');assert.ok(level.openSupply(tome));assert.equal(level.level,31);assert.equal(level.xp,120);assert.equal(level.status,'upgrading');assert.equal(level.offers.length,3);assert.deepEqual(level.levels,ranks,'Free level offers one choice instead of granting random upgrades');assert.equal(level.combat.snapshot().total.xp,0,'Free level bypasses XP decay');
assert.ok(NightSave.restore(clone(NightSave.capture(level))),'Pending free-level choice survives saving');
const magnet=fixture();magnet.level=10;magnet.xpNeed=1000;magnet.xpCarry=.4;
magnet.addGem(200,200,2);magnet.addGem(12000,9000,5);const expected=Math.floor(7*magnet.xpEfficiency+.4+1e-8);
const vacuum=visit(magnet,'magnet');assert.ok(magnet.openSupply(vacuum));assert.equal(magnet.gems.length,0);assert.equal(magnet.gemBins.size,0);assert.equal(magnet.xp,expected,'Magnet collects all current crystals with normal XP scaling');
magnet.addGem(700,700,2);assert.equal(magnet.openSupply(vacuum),false);assert.equal(magnet.gems.length,1,'Magnet does not keep collecting future drops');
const auto=fixture();auto.player.hp=95;const near=visit(auto,'heal');auto.update(.01);assert.ok(auto.supplyTaken.has(near.id));assert.equal(auto.player.hp,100,'Contact opens the box and caps healing');
const paused=fixture(), box=visit(paused,'level');paused.pause();assert.equal(paused.openSupply(box),false);
for(const options of [{stressMode:true},{sandboxMode:true}]){const g=new NightGame(1,'hunter',options);assert.deepEqual(g.supplyCrates,[]);assert.equal(g.openSupply({id:0}),false,'Test modes never grant box rewards');}
const renderer=Object.create(NightRenderer.prototype),draws=[];
Object.assign(renderer,{width:1000,height:600,scaleX:1,scaleY:1,worldWidth:auto.width,worldHeight:auto.height,mapId:auto.mapId,chunks:new Map(),enemyCells:new Uint8Array(100),ctx:{fillRect(){}},scenery(){},world(x,y,glyph,ink){draws.push({glyph,ink});},circle(){},line(){}});
renderer.render(auto,{x:auto.player.x,y:auto.player.y});
for(const [glyph,ink]of [['| + |',11],['| ^ |',7],['| U |',16]])assert.ok(draws.some(d=>d.glyph.includes(glyph)&&d.ink===ink),'Each supply type has a distinct visible icon and color');
console.log('PASS: 48 seeded exploration boxes on both maps, safe locations, one-time healing/free level/global magnet, scaled XP, contact pickup, saved rewards, old saves and test-mode isolation.');
