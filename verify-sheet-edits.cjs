const assert = require('node:assert/strict');
require('./core.js'); require('./progress.js'); require('./renderer.js');
const clone = x => JSON.parse(JSON.stringify(x));
const added = ['lightStaff','crowbar','chozo','flamethrower','electropistol'];
function fixture(hero = 'hunter') {
  const g = new NightGame(1810,hero,{terrain:false,fireMode:'manual'}); g.start();
  g.enemies=[]; g.spawnClock=g.nextBossAt=g.nextMegaAt=1e8;g.rosterBossIndex=1e6;g.player.invulnerable=1e8;
  return g;
}
const tick = (g,seconds) => { for(let i=0;i<Math.ceil(seconds*60);i++) g.update(1/60); };
function target(g,dx=150) {const e=g.spawn('brute',g.player.x+dx,g.player.y); e.hp=e.maxHp=10000;e.speed=0;return e;}
const hero = id => NightCharacters.find(h=>h.id===id);
const {weaponTrial}=require('./audit-weapons.cjs');
for(const u of NightUpgrades.filter(u=>u.weapon&&!['clock','laurel'].includes(u.id))) {
  assert.ok([50,100,200,400].some(distance=>weaponTrial(u.id,1,0,'auto',distance).dps>0),u.id+' rank-one attack can damage a target in front');
}
assert.ok(weaponTrial('clock',1,0,'manual',200).freezeSeconds>0);assert.ok(weaponTrial('laurel',1,0,'auto',100).shieldSeconds>0,'Support weapons are tested for control or protection rather than DPS');
const meteor=fixture();meteor.levels.meteor=3;meteor.levels.fork=2;meteor.setFireMode('auto');target(meteor,150);meteor.buildGrid();meteor.castMeteor();assert.equal(meteor.meteors.length,4,'Rank and Duplicator create all meteors even when only one target exists');
const hammer=fixture();hammer.levels.hammer=1;const remote=target(hammer,350);hammer.buildGrid();hammer.setFireMode('auto');hammer.castRelic('hammer');assert.equal(hammer.meteors.length,0,'Hammer does not bomb distant enemies');hammer.setFireMode('manual');hammer.aim={x:remote.x,y:remote.y,active:true};hammer.castRelic('hammer');assert.ok(hammer.meteors.every(m=>Math.hypot(m.x-hammer.player.x,m.y-hammer.player.y)<=130));
const pools=fixture();pools.levels.water=pools.levels.poison=1;const soaked=target(pools,70);pools.buildGrid();
pools.pools=[{x:soaked.x,y:soaked.y,radius:50,life:3,kind:'water',damage:15},{x:soaked.x,y:soaked.y,radius:50,life:3}];
pools.updateWeapons(.01);assert.ok(pools.combat.weapons.water.damage>0&&pools.combat.weapons.poison.damage>0,'Water and acid tick independently on the same enemy');
const poolHP=soaked.hp;pools.updateWeapons(.01);assert.equal(soaked.hp,poolHP,'Overlapping pools of the same family retain their shared cooldown');
const restoredPools=NightSave.restore(clone(NightSave.capture(pools)));assert.ok(restoredPools);assert.deepEqual(restoredPools.waterHits,pools.waterHits);
const oldPools=clone(NightSave.capture(pools));delete oldPools.waterHits;assert.ok(NightSave.restore(oldPools),'Existing checkpoints without a water timer still load');
for(const invalid of [null,[[999999,1]],[[soaked.id,-1]]]){const damaged=clone(NightSave.capture(pools));damaged.waterHits=invalid;assert.equal(NightSave.restore(damaged),null,'Invalid water cooldown data is rejected');}
soaked.alive=false;assert.ok(NightSave.restore(clone(NightSave.capture(pools))),'A recently despawned enemy may retain its short water cooldown until cleanup');
assert.equal(hero('witch').name,'Электра Ивановна');assert.equal(hero('tact').name,'DJ Харон');
assert.equal(hero('ark').weapon,'crowbar');assert.equal(hero('ark').extraWeapons,undefined);
assert.deepEqual(fixture('shepard').inventory(true),['crossbow','rune']);
assert.equal(NightUpgrades.find(w=>w.id==='birds').title,'Летучая мышь из Китая');
assert.equal(NightEnemies.pumpkin.title,'Джек-о-Лантерн');
for(const h of NightCharacters) { assert.equal(new Set(Object.values(h.facingSprites)).size,4); for(const sprite of Object.values(h.facingSprites))assert.match(sprite,/^[\x20-\x7e\n]+$/); }
const g=fixture(), renderer=Object.create(NightRenderer.prototype);
for(const [direction,x,y] of [['right',1,0],['left',-1,0],['up',0,-1],['down',0,1]]) {
  g.input={x,y};g.update(1/60);assert.equal(renderer.facingSprite(g),g.character.facingSprites[direction]);
  g.input={x:0,y:0};tick(g,.1);g.aim={x:g.player.x-x*500,y:g.player.y-y*500,active:true};
  assert.equal(renderer.facingSprite(g),g.character.facingSprites[direction],'Idle and cursor aim retain the last walking direction');
  const saved=NightSave.restore(clone(NightSave.capture(g)));assert.ok(saved);assert.equal(renderer.facingSprite(saved),renderer.facingSprite(g));
}
const whip=fixture();whip.levels.whip=1;whip.aim={x:whip.player.x+400,y:whip.player.y,active:true};
const front=target(whip,70),back=target(whip,-70);whip.buildGrid();whip.castRelic('whip');
assert.ok(front.hp<10000&&back.hp<10000,'Rank-one whip attacks both sides');assert.ok(whip.slashes.every(s=>s.ink===9));
const horizontal=fixture();horizontal.levels.whip=1;horizontal.aim={x:horizontal.player.x,y:horizontal.player.y-400,active:true};
const left=target(horizontal,-100),right=target(horizontal,100),above=target(horizontal,0),below=target(horizontal,0),outside=target(horizontal,260);
above.y-=110;below.y+=110;horizontal.buildGrid();horizontal.castRelic('whip');
assert.ok(left.hp<10000&&right.hp<10000,'Whip remains horizontal even when aiming vertically');
assert.ok([above,below,outside].every(e=>e.hp===10000),'Whip cannot damage a circular area around the player');
assert.equal(horizontal.rings.length,0,'Whip has no misleading circular wave');assert.equal(horizontal.slashes.length,2);
horizontal.slashes=[];horizontal.levels.fork=3;horizontal.castRelic('whip');assert.equal(horizontal.slashes.length,5,'Duplicator adds horizontal whip paths rather than radial sectors');
assert.ok(horizontal.slashes.every(s=>s.points.every(point=>Math.abs(point.y-horizontal.player.y)<90)));
const beam=fixture();beam.levels.clock=1;beam.aim={x:beam.player.x+600,y:beam.player.y,active:true};
const inline=target(beam,300),offAxis=target(beam,300),behind=target(beam,-90),tooFar=target(beam,560);offAxis.y+=100;
beam.buildGrid();beam.castRelic('clock');assert.ok(beam.freezes.has(inline.id));assert.ok([offAxis,behind,tooFar].every(e=>!beam.freezes.has(e.id)),'Beam freezes only its finite forward line');
assert.equal(beam.rings.length,0,'Ordinary clock casts do not draw a circle');assert.equal(beam.arcs.length,1);
beam.setFireMode('auto');beam.castRelic('clock');const rotated=beam.arcs[1].points;assert.ok(rotated[1].x>rotated[0].x&&rotated[1].y>rotated[0].y,'Automatic beam changes direction between straight casts');
const bar=fixture('ark');bar.aim={x:bar.player.x+300,y:bar.player.y,active:true};
const close=target(bar,45),distant=target(bar,110),rear=target(bar,-45);bar.buildGrid();bar.castRelic('crowbar');
assert.ok(close.hp<10000);assert.ok([distant,rear].every(e=>e.hp===10000),'Crowbar hits only in close quarters in front');assert.equal(bar.slashes[0].radius,52);
bar.levels.crowbar=4;bar.levels.area=5;bar.slashes=[];bar.castRelic('crowbar');assert.ok(bar.slashes[0].radius<=96,'Area upgrades retain a short melee reach');
const lines=[],circles=[],glyphs=[],shapeRenderer=Object.create(NightRenderer.prototype);
Object.assign(shapeRenderer,{width:1000,height:600,scaleX:1,scaleY:1,chunks:new Map(),enemyCells:new Uint8Array(100),ctx:{fillRect(){}},scenery(){},world(x,y,glyph,ink){glyphs.push({x,y,glyph,ink});},line(a,b,ink,glyph,zigzag=false){lines.push({a,b,ink,glyph,zigzag});},circle(...args){circles.push(args);}});
beam.arcs=[beam.arcs[0]];shapeRenderer.render(beam,{x:beam.player.x,y:beam.player.y});assert.equal(circles.length,0);assert.equal(lines.length,1);assert.equal(lines[0].glyph,'=');assert.equal(lines[0].zigzag,false,'Clock is a straight beam, not a lightning zigzag');
lines.length=circles.length=glyphs.length=0;for(const s of horizontal.slashes)s.life=.14;shapeRenderer.render(horizontal,{x:horizontal.player.x,y:horizontal.player.y});assert.equal(circles.length,0);assert.equal(lines.length,40,'Five whips render their eight curved horizontal segments');
lines.length=circles.length=glyphs.length=0;bar.slashes[0].life=.1;shapeRenderer.render(bar,{x:bar.player.x,y:bar.player.y});assert.equal(lines.length,1);assert.ok(Math.hypot(lines[0].b.x-lines[0].a.x,lines[0].b.y-lines[0].a.y)<=84);assert.ok(glyphs.some(g=>g.glyph==='J'),'Crowbar has a short shaft and one hooked tip');
whip.levels.pentagram=1;whip.castRelic('pentagram');assert.ok(whip.rings.some(r=>r.kind==='pentagram'));
const staff=fixture('beacon'), marked=target(staff,180);staff.buildGrid();staff.castRelic('lightStaff');assert.ok(staff.holyMarks.has(marked.id));
marked.x+=900;const hp=marked.hp;tick(staff,.3);const staffSave=NightSave.restore(clone(NightSave.capture(staff)));assert.ok(staffSave);staffSave.pause();
tick(staff,.4);tick(staffSave,.4);assert.ok(marked.hp<hp,'Sacred damage follows the marked target outside the initial area');
assert.equal(staffSave.enemies[0].hp,marked.hp);assert.deepEqual(staffSave.holyMarks,staff.holyMarks);
tick(staff,4);assert.equal(staff.holyMarks.size,0,'Sacred marks expire');
const samus=fixture('samus'), victim=target(samus,240);samus.aim={x:victim.x,y:victim.y,active:true};samus.buildGrid();samus.castRelic('chozo');
assert.equal(samus.relics.length,3,'Samus adds two charges');tick(samus,.3);assert.equal(victim.hp,10000,'A charging shot does no premature damage');
const charged=NightSave.restore(clone(NightSave.capture(samus)));assert.ok(charged);charged.pause();assert.ok(charged.relics.every(s=>s.chargeLeft>0));
tick(samus,1);tick(charged,1);assert.ok(victim.hp<10000);assert.equal(charged.enemies[0].hp,victim.hp);
const rank=fixture('samus');rank.castRelic('chozo');const weak={...rank.relics[0]};rank.relics=[];rank.levels.chozo=4;rank.castRelic('chozo');const strong=rank.relics[0];
assert.ok(strong.chargeLeft<weak.chargeLeft&&strong.radius>weak.radius&&strong.remaining>weak.remaining&&strong.damage>weak.damage);
const necro=fixture('whisper'), food=target(necro);necro.player.hp=40;necro.hurtEnemy(food,100,0,'poison');assert.equal(necro.player.hp,41,'Acid leech is capped at one HP per hit');
necro.hurtEnemy(food,100,0,'needle');assert.equal(necro.player.hp,41,'Other weapons cannot leech');food.hp=1;necro.hurtEnemy(food,10000,0,'poison');assert.ok(Math.abs(necro.player.hp-41.02)<1e-8,'Leech excludes overkill');
const swarm=target(necro); for(let i=0;i<20;i++)necro.hurtEnemy(swarm,100,0,'poison'); assert.ok(necro.player.hp<=42.000001,'Crowds cannot provide unbounded healing in one tick'); const leeched=NightSave.restore(clone(NightSave.capture(necro)));assert.ok(leeched);assert.equal(leeched.leechBudget,necro.leechBudget,'Reload cannot refill the healing budget');
const magnet=fixture();const before=magnet.magnet;magnet.levels.magnet=1;assert.equal(magnet.magnet-before,20);
const previous={volt:'pistol',beacon:'meteor',ripley:'fireball',samus:'dagger',whisper:'garlic',ark:'water',shepard:'rune',error:'rune',raven:'ebony'};
for(const [id,weapon] of Object.entries(previous)) {
  const old=fixture(id), save=clone(NightSave.capture(old));save.version=8;delete save.holyMarks;
  for(const key of added){delete save.levels[key];delete save.clocks[key];}
  for(const key of Object.keys(save.levels))save.levels[key]=0;save.levels[weapon]=2;save.selectedWeapon=weapon;save.weaponOrder=[weapon];save.passiveOrder=[];
  if(id==='raven'){save.player.hp=70;save.player.maxHp=90;} if(id==='ark'){save.player.hp=110;save.player.maxHp=140;}
  save.goldEarned=37;save.goldCarry=.4;
  const restored=NightSave.restore(save);assert.ok(restored,id+' loads a previous starting build');assert.equal(restored.player.hp,save.player.hp);assert.equal(restored.player.maxHp,save.player.maxHp);
  assert.equal(restored.levels[weapon],2);assert.equal(restored.goldEarned,37);assert.equal(restored.goldCarry,.4);assert.deepEqual(restored.inventory(true),[weapon]);
  assert.ok(NightSave.restore(clone(NightSave.capture(restored))),'Migrated builds can be saved again');
}
console.log('PASS: sheet content, facing and saves, horizontal curved whip hitboxes, straight finite freezing beam, short crowbar geometry, pentagram, sacred DoT, charging Chozo, capped acid leech, magnet tuning and old hero builds/HP/gold.');
