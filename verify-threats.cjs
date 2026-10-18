const assert=require('node:assert/strict');require('./core.js');require('./renderer.js');require('./progress.js');
const system=NightEnemySystem;
const tick=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++)g.update(1/60);};
function fixture(options={}){const g=new NightGame(83,'hunter',{terrain:false,fireMode:'manual',...options});g.start();g.enemies=[];g.spawnClock=g.nextBossAt=1e8;return g;}
for(const map of ['forest','graveyard'])for(const seed of [1,2,3,4]){
  const g=fixture({map});g.seed=seed;
  for(const age of [0,44,60,90,120,180,300,540,900]){
    g.time=g.wallTime=age;const plan=g.wavePlan;
    assert.ok(plan.entries.length<=7);assert.ok(plan.entries.every(e=>Number.isFinite(e.weight)&&e.weight>0));
    if(age>=60)assert.ok(plan.entries.some(e=>e.ranged),'Shooters participate well before minute ten on both maps');
    if(age>=90)assert.ok(plan.entries.some(e=>e.charge),'Telegraphed chargers participate from 1:30');
    if(age===0)assert.ok(plan.entries.every(e=>!e.ranged&&!e.charge),'Opening remains introductory');
    assert.equal(new Set(plan.entries.map(e=>e.id)).size,plan.entries.length);
  }
  g.time=g.wallTime=140;const expected=g.wavePlan;g.levels.curse=5;if(map==='forest')assert.deepEqual(g.wavePlan.entries,expected.entries,'Curse affects pressure, not attack unlocks or support rotation');g.levels.curse=0;
  g.enemies=[];for(let i=0;i<150;i++)g.spawnWave();
  assert.equal(g.enemies.length,g.wavePlan.target);
  for(const ai of ['ranged','charge']){const count=g.enemies.filter(e=>e.ai===ai).length;assert.ok(count>0,ai+' is actually spawned');assert.ok(count<=g.wavePlan.quotas[ai],ai+' respects its simultaneous quota');}
}
const variety=new Set();for(let seed=1;seed<=8;seed++)for(const row of system.wave(NightEnemies,140,false,NightCatalog.stages[1],140,seed).entries)if(row.ranged||row.charge)variety.add(row.id);
for(const id of ['lich','pumpkin','werewolf','alien'])assert.ok(variety.has(id),'Different runs offer different support enemies');
const gun=fixture(),lich=gun.spawn('lich',gun.player.x+320,gun.player.y);lich.skillClock=0;tick(gun,3.2);assert.ok(gun.player.hp<gun.player.maxHp,'An ordinary early shooter lands real projectile damage');
for(const [id,definition]of Object.entries(NightEnemies).filter(([,e])=>e.boss)){
  const g=new NightGame(83,'hunter',{sandboxMode:true,fireMode:'manual',sandbox:{enemy:id,count:20}});g.start();
  assert.equal(g.enemies.length,1,'A boss ring tests one boss');assert.equal(g.encounter?.phase,'locked');assert.equal(g.enemies[0].arenaMember,1);
  assert.equal(g.sandboxInvulnerable,false,'Sandbox damage is enabled by default');
  g.player.hp=g.player.maxHp=1000;const boss=g.enemies[0];boss.skillClock=0;tick(g,7);
  assert.ok(g.combat.snapshot().total.hurt>0,id+' can damage the hero in the sandbox ring');
  if(id==='lichLord')assert.ok(g.encountered.has('skeleton'),'Sandbox Lich summons skeletons');
  if(definition.summon)assert.ok(g.encountered.has(definition.summon.kind),id+' summons its own adds');
  if(boss.alive)g.hurtEnemy(boss,boss.hp+1);
  assert.equal(g.encounter,null,'Killing the sandbox boss releases its ring');assert.equal(g.chests.length+g.goldEarned+g.gems.length,0,'Sandbox combat does not grant progression');
  assert.equal(NightSave.capture(g),null);
}
const immune=new NightGame(83,'hunter',{sandboxMode:true,fireMode:'manual',sandbox:{enemy:'lichLord',invulnerable:true}});immune.start();immune.enemies[0].skillClock=0;tick(immune,5);
assert.equal(immune.player.hp,immune.player.maxHp);assert.ok(immune.encountered.has('skeleton'),'Optional invulnerability never disables boss AI');
const open=new NightGame(83,'hunter',{sandboxMode:true,fireMode:'manual',sandbox:{enemy:'lichLord',arena:false,invulnerable:true,count:5}});open.start();assert.equal(open.encounter,null);assert.equal(open.enemies.length,5,'Open sandbox retains multiple targets');
const expiry=new NightGame(83,'hunter',{sandboxMode:true,fireMode:'manual',sandbox:{enemy:'jason',invulnerable:true}});expiry.start();tick(expiry,15.1);assert.equal(expiry.encounter,null);assert.ok(expiry.enemies[0].alive,'Timed-out sandbox bosses stay active');
expiry.enemies=[];expiry.player.x=expiry.player.y=28;expiry.spawnSandboxTargets();assert.ok(expiry.player.x>=expiry.arenaRadius+90&&expiry.player.y>=expiry.arenaRadius+90,'Repeated boss tests keep the entire ring inside the world');
const dodge=fixture(),charger=dodge.spawn('werewolf',dodge.player.x+140,dodge.player.y);charger.skillClock=0;dodge.update(.01);
assert.ok(charger.windup>=.8);const x=charger.x,y=charger.y,dir=[charger.chargeX,charger.chargeY];tick(dodge,.5);assert.equal(charger.x,x);assert.equal(charger.y,y,'Charger visibly waits before rushing');
const lines=[],glyphs=[],renderer=Object.create(NightRenderer.prototype);
Object.assign(renderer,{width:1000,height:600,scaleX:1,scaleY:1,worldWidth:dodge.width,worldHeight:dodge.height,mapId:dodge.mapId,chunks:new Map(),enemyCells:new Uint8Array(100),ctx:{fillRect(){}},scenery(){},world(x,y,glyph,ink){glyphs.push({x,y,glyph,ink});},circle(){},line(a,b,ink,glyph){lines.push({a,b,ink,glyph});}});
renderer.render(dodge,{x:dodge.player.x,y:dodge.player.y});const corridor=lines.filter(l=>l.ink===12);assert.equal(corridor.length,3);
const attack=system.chargeAttack(charger);for(const line of corridor)assert.ok(Math.abs(Math.hypot(line.b.x-line.a.x,line.b.y-line.a.y)-attack.speed*attack.duration)<1e-8,'Telegraph covers the full physical charge distance');
assert.ok(glyphs.some(g=>g.ink===12&&g.glyph==='<<'));
dodge.input.y=1;tick(dodge,1);assert.deepEqual([charger.chargeX,charger.chargeY],dir,'Charge direction stays locked after warning');assert.equal(dodge.player.hp,dodge.player.maxHp,'Moving out of the marked corridor avoids the charge');
const impact=fixture(),ram=impact.spawn('werewolf',impact.player.x-30,impact.player.y);ram.chargeX=1;ram.chargeY=0;ram.chargeTime=.4;ram.skillClock=5;impact.update(.01);assert.ok(Math.abs(impact.player.hp-(impact.player.maxHp-ram.damage*1.35))<1e-8,'A rushing hit is stronger than ordinary contact');
console.log('PASS: early mixed shooters/chargers, seeded support variety, bounded quotas, real projectile damage, all sandbox bosses attack and deal damage, optional immunity, rings, no rewards, full-distance dodge corridors and stronger rushing hits.');
