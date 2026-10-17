const fs=require('node:fs'),path=require('node:path'); require(path.join(process.env.NIGHT_GAME_ROOT || __dirname,'core.js'));
const results=[];
for(const hero of ['hunter','ripley','ark']) for(const metaMode of ['none','max']) for(const seed of [811,427]) {
 const meta=Object.fromEntries(NightMeta.map(u=>[u.id,metaMode==='max'?u.max:0]));
 const g=new NightGame(seed,hero,{meta,terrain:false});g.start();const priority=['blades','pulse','haste','power','fork','magnet','pierce','stride','vital','regen'];
 const checkpoints=[];
 for(let step=0;step<20000&&g.time<480;step++){
  if(g.status==='reward')g.claimReward(0);
  while(g.status==='upgrading'){let selected=0;for(const id of priority){const i=g.offers.findIndex(u=>u.id===id);if(i>=0){selected=i;break;}}g.choose(selected);}
  g.player.invulnerable=1;
  let target=null,distance=Infinity;
  for(const item of [...g.chests,...g.gems]){const d=(item.x-g.player.x)**2+(item.y-g.player.y)**2;if(d<distance){distance=d;target=item;}}
  if(!target)target={x:g.width/2+Math.cos(g.time*.08)*450,y:g.height/2+Math.sin(g.time*.08)*450};
  const dx=target.x-g.player.x,dy=target.y-g.player.y,d=Math.hypot(dx,dy)||1;g.input={x:dx/d,y:dy/d};
  g.update(.05);g.events.length=0;
  if(g.time >= (checkpoints.length+1)*120)checkpoints.push({minute:(checkpoints.length+1)*2,level:g.level,kills:g.kills,xp:g.combat.total.xp});
 }
 results.push({hero,meta:metaMode,seed,seconds:+g.time.toFixed(1),level:g.level,kills:g.kills,bossKills:g.bossKills,gold:g.goldEarned,xpCollected:g.combat.total.xp,xpDropped:g.combat.total.xpDropped,weapons:g.inventory(true),passives:g.inventory(false),peak:g.peakEnemies,checkpoints});
}
const report={scope:'Eight simulated minutes, three heroes, two seeds, zero/max Legacy; invulnerable XP-collecting bot without terrain and fixed upgrade preferences, not a survival or browser FPS result',results};
console.log(JSON.stringify(report));if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
