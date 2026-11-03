const assert=require('node:assert/strict');
require('./core.js');require('./progress.js');
function scene(id,mode='manual',evolved=false,passive='',rank=0){
  const g=new NightGame(727,'hunter',{terrain:false,fireMode:mode});g.start();g.enemies=[];
  for(const key in g.levels)g.levels[key]=0;g.levels[id]=2;g.weaponOrder=[id];g.passiveOrder=[];g.selectedWeapon=id;
  if(evolved)g.evolutions.add(NightCatalog.evolutions.find(r=>r.weapon===id).id);
  if(passive)g.levels[passive]=rank;
  g.aim={x:g.player.x+300,y:g.player.y,active:true};g.player.invulnerable=100;g.spawnClock=g.nextBossAt=g.nextMegaAt=g.shootClock=g.pulseClock=1e8;g.rosterBossIndex=1e6;
  for(const key in g.clocks)g.clocks[key]=1e8;
  for(let i=0;i<24;i++)probe(g,Math.cos(i*Math.PI/12)*130,Math.sin(i*Math.PI/12)*130);probe(g,40,0);
  g.buildGrid();return g;
}
function probe(g,x,y){const e=g.spawn('brute',g.player.x+x,g.player.y+y);Object.assign(e,{hp:1e6,maxHp:1e6,speed:0,knockbackResistance:1});return e;}
function cast(g,id){const methods={needle:'fire',blades:'castSlash',pulse:'castPulse',poison:'castPoison',lightning:'castLightning',boomerang:'castBoomerang',frost:'castFrost',meteor:'castMeteor'};if(methods[id])g[methods[id]]();else g.castRelic(id);}
function units(g,id){if(id==='blades'&&g.fireMode==='auto')return g.bladePositions().length;if(id==='bible')return g.biblePositions().length;if(id==='lightning')return g.arcs.filter(a=>a.weapon===id).length;return g.shots.length+g.relics.length+g.boomerangs.length+g.pools.length+g.meteors.length+g.slashes.length+g.rings.length+g.arcs.length;}
const noAmount=['pulse','poison','frost','lightStaff','laurel','clock','garlic','pentagram'];
let pairs=0;
for(const item of NightUpgrades.filter(u=>u.weapon))for(const evolved of NightCatalog.evolutions.some(r=>r.weapon===item.id)?[false,true]:[false])for(const mode of ['auto','manual']){
  const id=item.id,label=id+(evolved?' evolved ':' base ')+mode,base=scene(id,mode,evolved);cast(base,id);
  for(let rank=1;rank<=3;rank++){const more=scene(id,mode,evolved,'fork',rank);cast(more,id);const compatible=!noAmount.includes(id)&&!(id==='boomerang'&&evolved);assert.equal(units(more,id),units(base,id)+(compatible?rank:0),label+' Duplicator '+rank);pairs++;}
  const stronger=scene(id,mode,evolved,'power',5);cast(stronger,id);
  for(const g of [base,stronger]){
    for(const p of g.pools)probe(g,p.x-g.player.x,p.y-g.player.y);
    for(const p of g.meteors)probe(g,p.x-g.player.x,p.y-g.player.y);
    if(id==='bible'||id==='blades'&&mode==='auto'){const p=(id==='bible'?g.biblePositions():g.bladePositions())[0];probe(g,p.x-g.player.x,p.y-g.player.y);}
    g.buildGrid();for(let i=0;i<90;i++)g.update(1/60);
  }
  if(!['clock','laurel'].includes(id))assert.ok(base.combat.total.damage>0&&stronger.combat.total.damage>base.combat.total.damage,label+' Power through hit paths');
}
for(const mode of ['auto','manual'])for(const evolved of [false,true]){
  let first=0;
  for(let rank=0;rank<=3;rank++){const g=scene('lightning',mode,evolved,'fork',rank);g.enemies=[];probe(g,100,0);g.buildGrid();cast(g,'lightning');if(!rank)first=g.combat.total.damage;assert.ok(Math.abs(g.combat.total.damage-first*(rank+1))<1e-6,'Tesla extra chains damage a single enemy');assert.equal(g.arcs.length,rank+1);assert.equal(new Set(g.arcs.map(a=>JSON.stringify(a.points))).size,rank+1,'Tesla copies remain visible');}
}
const plain=scene('whip'),extra=scene('whip','manual',false,'fork',1);
for(const g of [plain,extra]){g.enemies=[];const e=probe(g,90,-85);e.radius=8;g.buildGrid();cast(g,'whip');}
assert.equal(plain.combat.total.damage,0);assert.ok(extra.combat.total.damage>0,'Extra whip lane has a matching hitbox');
for(const id of ['crowbar','gauntlets']){const g=scene(id,'manual',false,'fork',3);cast(g,id);assert.equal(new Set(g.slashes.map(s=>s.angle)).size,g.slashes.length,id+' visible melee copies');}
for(const id of ['needle','axe','rune','dagger','fireball','pistol','sling','crossbow','gauss','plasmaMinigun','chozo','flamethrower','electropistol']){
  for(const [passive,key]of [['duration','life'],['area','radius']]){const a=scene(id),b=scene(id,'manual',false,passive,5);cast(a,id);cast(b,id);const shots=g=>[...g.shots,...g.relics];assert.ok(shots(b)[0][key]>shots(a)[0][key],id+' '+passive);}
}
for(const id of ['blades','bible']){const a=scene(id,'auto'),b=scene(id,'auto',false,'velocity',5);a.time=b.time=.1;cast(a,id);cast(b,id);const positions=g=>id==='blades'?g.bladePositions():g.biblePositions();assert.notDeepEqual(positions(a)[0],positions(b)[0],id+' orbit speed');}
const needle=scene('needle','manual',false,'area',5);cast(needle,'needle');
const save=JSON.parse(JSON.stringify(NightSave.capture(needle))),restored=NightSave.restore(save);assert.ok(restored);assert.equal(restored.shots[0].radius,needle.shots[0].radius,'Scaled hitbox survives save');delete save.shots[0].radius;assert.equal(NightSave.restore(save).shots[0].radius,5,'Old saves retain their original needle hitbox');save.shots[0].radius=-1;assert.equal(NightSave.restore(save),null,'Invalid hitbox rejected');
const sickle=scene('boomerang','manual',false,'area',5);cast(sickle,'boomerang');sickle.levels.needle=1;sickle.weaponOrder.push('needle');assert.ok(sickle.boomerangs[0].radius>16);const sickleSave=JSON.parse(JSON.stringify(NightSave.capture(sickle)));assert.equal(NightSave.restore(sickleSave).boomerangs[0].radius,sickle.boomerangs[0].radius);delete sickleSave.boomerangs[0].radius;assert.equal(NightSave.restore(sickleSave).boomerangs[0].radius,16);
for(const id of ['flamethrower','crossbow']){const a=scene(id,'manual',true),b=scene(id,'manual',true,'duration',5);for(const g of [a,b]){cast(g,id);g.updateRelics(.2);}const expiry=g=>Math.max(0,...(id==='flamethrower'?[...g.burnMarks.values()].map(m=>m.expires):g.freezes.values()));assert.ok(expiry(b)>expiry(a),id+' on-hit status lifetime');}
console.log('PASS: '+pairs+' Duplicator weapon/mode/evolution/rank combinations, Power through real hit paths, single-target Tesla copies, extra whip lanes, distinct melee swings, projectile Area/Duration, orbit velocity and compatible saves.');
