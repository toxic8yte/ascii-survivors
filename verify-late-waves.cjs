const assert=require('node:assert/strict');require('./core.js');require('./progress.js');
const fodder=new Set(['grave_rat','grave_bat','bat','ghoul','skeleton','coffin_crawler','mold_corpse','screaming_skull','mummy','spider']);
for(const map of ['forest','graveyard'])for(let minute=10;minute<90;minute++){
  const g=new NightGame(781,'hunter',{map});g.time=g.wallTime=minute*60+20;const plan=g.wavePlan;
  assert.ok(plan.entries.every(e=>!fodder.has(e.id)),map+' retires starter fodder at '+minute);
  assert.ok(plan.entries.some(e=>!e.ranged&&!e.charge&&!e.elite&&e.role!=='special'),'Ordinary heavy enemies can refill after quotas');
  assert.ok(plan.entries.some(e=>e.ranged)&&plan.entries.some(e=>e.charge),'Ranged and charge support remain');
  if(map==='graveyard')assert.ok(plan.entries.filter(e=>!e.ranged&&!e.charge).every(e=>NightEnemies[e.id].roster&&NightEnemies[e.id].at>=Math.min(1440,g.time-300)));
  if(map==='forest'&&minute<30)assert.ok(plan.entries.every(e=>NightEnemies[e.id].at<=g.time),'No future late-wave enemies');
  if(minute>=25)assert.ok(plan.entries.filter(e=>NightEnemies[e.id].hp>=400).reduce((sum,e)=>sum+e.weight,0)>plan.entries.reduce((sum,e)=>sum+e.weight,0)*.5,'Mostly strong endgame enemies');
}
for(const minute of [25,30,60,90]){
  const g=new NightGame(781,'hunter',{stressMode:true});g.time=g.wallTime=minute*60+20;const plan=g.wavePlan;
  assert.ok(plan.entries.every(e=>!fodder.has(e.id))&&plan.entries.filter(e=>NightEnemies[e.id].hp>=400).reduce((s,e)=>s+e.weight,0)>plan.entries.reduce((s,e)=>s+e.weight,0)*.5,'Stress mode uses strong late enemies');
}
console.log('PASS: late forest and graveyard waves, starter retirement, heavy population, ranged/charge support, no premature late enemies, strong endless cycle and endgame stress population.');
