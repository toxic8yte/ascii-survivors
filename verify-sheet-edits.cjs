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
const magnet=fixture();const before=magnet.magnet;magnet.levels.magnet=1;assert.equal(magnet.magnet-before,30);
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
console.log('PASS: sheet content, four facing directions and idle/save behavior, blue two-sided whip, pentagram, sacred DoT, charging Chozo with Samus bonus, capped acid leech, magnet tuning and old hero builds/HP/gold.');
