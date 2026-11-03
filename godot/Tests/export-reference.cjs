const fs=require('node:fs');require('../../core.js');
const cases=[];
for(const item of NightUpgrades.filter(u=>u.weapon))for(const evolved of [false,true]){
  const recipe=NightCatalog.evolutions.find(r=>r.weapon===item.id);if(evolved&&!recipe)continue;
  const g=new NightGame(727,'hunter',{fireMode:'manual',terrain:false});g.start();g.enemies=[];
  for(const id in g.levels)g.levels[id]=0;g.levels[item.id]=4;g.selectedWeapon=item.id;g.weaponOrder=[item.id];g.passiveOrder=[];
  if(evolved){for(const id of recipe.weapons||[])g.levels[id]=NightUpgrades.find(u=>u.id===id).max;for(const[id,rank]of Object.entries(recipe.passives))while(g.levels[id]<rank)g.applyUpgrade(NightUpgrades.find(u=>u.id===id));g.evolve(recipe);}
  g.aim={x:g.player.x+300,y:g.player.y,active:true};const e=g.spawn('brute',g.player.x+65,g.player.y);e.hp=e.maxHp=1000000;e.speed=0;g.buildGrid();
  const methods={needle:'fire',blades:'castSlash',pulse:'castPulse',poison:'castPoison',lightning:'castLightning',boomerang:'castBoomerang',frost:'castFrost',meteor:'castMeteor'};
  if(methods[item.id])g[methods[item.id]]();else g.castRelic(item.id);
  const shots=[...g.shots,...g.relics,...g.boomerangs];
  cases.push({id:item.id,evolved,directDamage:1000000-e.hp,shots:shots.map(s=>({vx:s.vx,vy:s.vy,damage:s.damage,life:s.life??2.5,radius:s.radius??(item.id==='needle'?5:16),remaining:s.remaining??100000,charge:s.chargeLeft||0})),pools:g.pools.map(p=>({x:p.x-g.player.x,y:p.y-g.player.y,radius:p.radius,life:p.life})),blasts:g.meteors.map(b=>({x:b.x-g.player.x,y:b.y-g.player.y,damage:b.damage,radius:b.radius,wait:b.wait})),frozen:g.freezes.get(e.id)||0,chilled:e.chilledTill,shields:g.shieldCharges,bibleUntil:g.bibleUntil,cooldown:item.cooldown?item.cooldown*(evolved&&['dagger','pentagram','pistol'].includes(item.id)?item.id==='pistol'?.5:.4:1)*.85/g.haste/(1+(g.levels[item.id]-1)*.05):null});
}
const output={source:'Shared JS combat logic in core.js, including passive compatibility fixes',cases};
fs.writeFileSync(require('node:path').join(__dirname,'reference.json'),JSON.stringify(output,null,2)+'\n');console.log(`Exported ${cases.length} shared JS weapon/evolution references`);
