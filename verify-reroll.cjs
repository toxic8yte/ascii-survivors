const assert = require('node:assert/strict');
require('./core.js'); require('./progress.js');
const PROFILE = 'ascii-night-progress-v2', RUN = 'ascii-night-run-v1';
function fixture(seed=1666) { const g=new NightGame(seed,'hunter',{terrain:false});g.start();g.grantXP(6);return g; }
function memory() {
  const data=new Map();return {data,fail:()=>false,getItem:key=>data.get(key)??null,setItem(key,value){if(this.fail(key))throw Error('Quota');data.set(key,value);},removeItem:key=>data.delete(key)};
}
const seen=new Set(), sample=fixture();
for(let i=0;i<6000;i++) {
  sample.drawOffers();assert.equal(sample.offers.length,3);assert.equal(sample.offers.filter(u=>u.weapon).length,2);
  assert.ok(sample.offers.some(u=>u.weapon&&!sample.levels[u.id]));
  for(const u of sample.offers)if(u.weapon)seen.add(u.id);
}
assert.deepEqual([...seen].sort(),[...NightSlots].sort(),'Every weapon can appear, including rare weapons and the starter rank-up');
for(const u of NightUpgrades.filter(u=>u.weapon))sample.levels[u.id]=u.max;
sample.drawOffers();assert.equal(sample.offers.length,3);assert.ok(sample.offers.every(u=>!u.weapon),'Passive-only fallback when all weapons are maxed');
const full=fixture();for(const id of NightSlots.slice(0,5))full.levels[id]=1;
full.drawOffers();assert.ok(full.offers.filter(u=>u.weapon).every(u=>full.levels[u.id]),'Five weapon slots still constrain discovery');
const store=memory(), progress=new NightProgress(store), g=fixture(), original=g.offers.map(u=>u.id), levels={...g.levels};
g.selectOffer(0);assert.ok(progress.reroll(g));assert.equal(progress.profile.meta.gold,45);assert.equal(g.rerollCost,10);
assert.ok(g.offers.every(u=>!original.includes(u.id)));assert.equal(g.offerSelection,-1);assert.equal(g.level,2);assert.equal(g.time,0);assert.equal(g.status,'upgrading');assert.deepEqual(g.levels,levels);
let restored=new NightProgress(store).loadRun();assert.equal(restored.rerollsUsed,1);assert.deepEqual(restored.offers.map(u=>u.id),g.offers.map(u=>u.id));
assert.ok(progress.reroll(restored));assert.equal(progress.profile.meta.gold,35);assert.equal(restored.rerollCost,15);
restored.goldEarned=8;assert.ok(progress.checkpoint(restored));assert.equal(progress.profile.meta.gold,43);assert.ok(progress.checkpoint(restored));assert.equal(progress.profile.meta.gold,43,'Banking does not refund reroll fees');
assert.equal(progress.profile.meta.lifetimeGold,58,'Spending does not reduce lifetime earnings');
const snapshot=g=>({...NightSave.capture(g),savedAt:0});
const before=snapshot(restored);store.fail=key=>key===PROFILE;
assert.equal(progress.reroll(restored),false);assert.deepEqual(snapshot(restored),before,'Failed debit restores cards, selection, RNG and price');
store.fail=()=>false;
let runWrites=0;store.fail=key=>key===RUN&&++runWrites===2;
assert.ok(progress.reroll(restored));assert.equal(progress.profile.meta.gold,28);
const recovered=new NightProgress(store).loadRun();assert.ok(recovered);assert.equal(recovered.rerollsUsed,3);assert.equal(recovered.rerollCost,20);assert.deepEqual(recovered.offers.map(u=>u.id),restored.offers.map(u=>u.id),'Paid cards survive an interrupted run checkpoint');
store.fail=()=>false;assert.ok(progress.checkpoint(recovered));assert.equal(progress.profile.meta.gold,28);
assert.ok(progress.reroll(recovered));assert.equal(progress.profile.meta.gold,8);
const unchanged=recovered.offers;assert.equal(progress.reroll(recovered),false);assert.equal(recovered.offers,unchanged);assert.equal(recovered.rerollCost,25);
assert.equal(fixture().rerollCost,5,'New runs reset the price');
const legacy=NightSave.capture(fixture());delete legacy.rerollsUsed;assert.equal(NightSave.restore(legacy).rerollsUsed,0);
for(const value of [-1,.5,1000001,'1']){legacy.rerollsUsed=value;assert.equal(NightSave.restore(legacy),null);}
const limited=fixture();for(const u of NightUpgrades)if(!limited.offers.includes(u))limited.banished.add(u.id);
assert.equal(limited.canReroll,false);assert.equal(limited.rerollOffers(),false,'No chargeable reroll without a full replacement set');
const blocked=memory(), blockedProgress=new NightProgress(blocked), pending=fixture();blocked.fail=()=>true;
assert.equal(blockedProgress.reroll(pending),false);assert.equal(pending.rerollsUsed,0);
const sandbox=new NightGame(1,'hunter',{sandboxMode:true});assert.equal(progress.reroll(sandbox),false);
const banned=fixture();const index=banned.offers.findIndex(u=>u.weapon);banned.banishOffer(index);assert.equal(banned.offers.filter(u=>u.weapon).length,2,'Banishing preserves weapon priority');
console.log('PASS: all 33 weapons reachable, 2+1 offer priority, slot limits, full paid rerolls, escalating costs, insufficient funds, old saves, bank accounting and interrupted storage recovery.');
