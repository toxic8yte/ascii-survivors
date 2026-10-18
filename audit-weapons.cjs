const fs = require('node:fs'), path = require('node:path');
require(path.join(process.env.NIGHT_GAME_ROOT || __dirname,'core.js'));
const round = n => Math.round(n * 100) / 100;

function weaponTrial(id, rank, fork, mode, distance) {
  const g = new NightGame(781, 'hunter', { terrain:false, fireMode:mode }); g.start();
  for (const key of Object.keys(g.levels)) g.levels[key] = 0;
  g.levels[id] = rank; g.levels.fork = fork; g.selectedWeapon = id; g.weaponOrder = [id];
  g.player.dirX=1;g.player.dirY=0;
  g.enemies = []; g.treasures = []; g.spawnClock = g.nextBossAt = g.nextMegaAt = 1e8; g.rosterBossIndex = 1e6;
  const e = g.spawn('ghoul',g.player.x+distance,g.player.y);
  Object.assign(e,{hp:1e7,maxHp:1e7,speed:0,damage:0,knockbackResistance:1,radius:18});
  g.aim = {x:e.x,y:e.y,active:true}; g.input.firing = true;
  let freezeSeconds = 0, shieldSeconds = 0;
  for (let i=0;i<1200;i++) {
    g.update(1/60); g.events.length=0;
    if ((g.freezes.get(e.id)||0)>g.time) freezeSeconds+=1/60;
    if (g.shieldCharges && g.shieldUntil>g.time) shieldSeconds+=1/60;
  }
  return {distance,dps:round((1e7-e.hp)/20),freezeSeconds:round(freezeSeconds),shieldSeconds:round(shieldSeconds)};
}

function firstBossTrial(hero, seed, waves=false) {
  const g = new NightGame(seed,hero,{terrain:false}); g.start(); g.treasures=[];
  g.time=g.wallTime=60; g.nextBossAt=60; g.nextMegaAt=1e8; g.rosterBossIndex=1e6;
  if (!waves) g.spawnClock=1e8;
  g.levels[g.character.weapon]=2;
  g.levels[g.character.weapon==='needle'?'pistol':'needle']=1;
  g.level=3;g.xpNeed=5000;
  let boss=null, started=0, startingHP=0, sealedDamage=0;
  const reach={crowbar:65,gauntlets:100,garlic:80,poison:80,blades:90,whip:115,bible:130,flamethrower:130,hammer:130};
  for(let i=0;i<60*125;i++) {
    if (boss && (!boss.alive || g.status==='dead')) break;
    if (g.status==='reward') g.claimReward(0);
    if (boss) {
      const dx=boss.x-g.player.x,dy=boss.y-g.player.y,d=Math.hypot(dx,dy)||1;
      const radial=Math.max(-1,Math.min(1,(d-(reach[g.character.weapon]||180))/65));
      g.input.x=dx/d*radial-dy/d*.65;g.input.y=dy/d*radial+dx/d*.65;
      if (g.character.weapon==='whip') g.input.y+=Math.max(-1,Math.min(1,dy/35));
      if (g.player.hp<g.player.maxHp*.6 && g.player.dashReady<=0 && d<95) g.dash();
    } else {g.input.x=0;g.input.y=0;}
    g.update(1/60);g.events.length=0;
    if (!boss && g.encounter?.phase==='locked') {boss=g.enemies.find(e=>e.id===g.encounter.bossId);startingHP=boss.maxHp;started=g.time;}
    if (boss && g.encounter?.phase==='locked') sealedDamage=startingHP-boss.hp;
  }
  return {hero,seed,waves,bossHP:round(startingHP),bossKilled:Boolean(boss&&!boss.alive),seconds:round(g.time-started),playerHP:round(g.player.hp),bossRemainingHP:round(Math.max(0,boss?.hp||0)),sealedDamage:round(sealedDamage),damageReceived:round(g.combat.total.hurt)};
}

function audit() {
  const weapons=NightUpgrades.filter(u=>u.weapon).map(u=>({id:u.id,title:u.title,tests:[
    {mode:'auto',rank:1,fork:0},{mode:'auto',rank:u.max,fork:0},{mode:'auto',rank:1,fork:1},{mode:'manual',rank:1,fork:0}
  ].map(test=>({...test,targets:[50,100,200,400].map(distance=>weaponTrial(u.id,test.rank,test.fork,test.mode,distance))}))}));
  const firstBoss=['hunter','ripley','ark','loop','plague','abyss'].flatMap(hero=>[811,427].flatMap(seed=>[false,true].map(waves=>firstBossTrial(hero,seed,waves))));
  return {scope:'20-second stationary single-target weapon trials at four distances, facing and aiming right; first boss with normal HP, no Legacy, starter rank 2 plus a rank-1 ranged weapon, steering bot, terrain disabled, isolated and with ordinary waves. Not human playtesting or browser FPS.',weapons,firstBoss};
}
module.exports={weaponTrial,firstBossTrial,audit};
if(require.main===module) {
  const report=audit();if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({weapons:report.weapons.map(w=>({id:w.id,auto1:Math.max(...w.tests[0].targets.map(t=>t.dps)),auto4:Math.max(...w.tests[1].targets.map(t=>t.dps)),fork1:Math.max(...w.tests[2].targets.map(t=>t.dps)),manual1:Math.max(...w.tests[3].targets.map(t=>t.dps))})),firstBoss:report.firstBoss},null,2));
}
