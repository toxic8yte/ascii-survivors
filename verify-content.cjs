const assert = require('node:assert/strict');
require('./core.js'); require('./progress.js');
const clone = value => JSON.parse(JSON.stringify(value));
const tick = (g, seconds) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) { g.update(1 / 60); if (g.status === 'upgrading') g.choose(0); } };
function fixture(options = {}) {
  const g = new NightGame(412, 'hunter', { terrain: false, fireMode: 'manual', ...options }); g.start();
  g.enemies = []; g.spawnClock = g.nextBossAt = 1e6; g.player.invulnerable = 1e8; return g;
}
assert.equal(NightUpgrades.filter(u => !u.weapon).length, 21);
assert.equal(new Set(NightUpgrades.map(u => u.id)).size, NightUpgrades.length);
for (const w of NightCatalog.extraWeapons) {
  const g = fixture(); g.levels[w.id] = 1; g.selectedWeapon = w.id;
  const enemy = g.spawn('brute', g.player.x + 60, g.player.y); enemy.speed = 0; g.buildGrid();
  g.aim = { x: enemy.x, y: enemy.y, active: true };
  tick(g, .4); assert.equal(g.relics.length + g.pools.length + g.meteors.length + g.rings.length, 0, w.id + ' waits for manual input');
  g.requestAttack(); tick(g, .02);
  assert.ok(g.relics.length + g.pools.length + g.meteors.length + g.rings.length + g.freezes.size + g.shieldCharges > 0 || g.bibleUntil > g.time || !enemy.alive, w.id + ' activates when triggered');
  const restored = NightSave.restore(clone(NightSave.capture(g))); assert.ok(restored, w.id + ' resumes');
  assert.equal(restored.relics.length, g.relics.length); assert.equal(restored.pools.length, g.pools.length);
  assert.equal(restored.shieldCharges, g.shieldCharges); assert.equal(restored.bibleUntil, g.bibleUntil);
}
const knife = fixture(); knife.levels.needle = 0; knife.levels.dagger = 2; knife.selectedWeapon = 'dagger'; knife.player.dirX = 1; knife.player.dirY = 0;
knife.setFireMode('auto'); const hit = knife.spawn('brute', knife.player.x + 190, knife.player.y); hit.speed = 0; tick(knife, .8); assert.ok(hit.hp < hit.maxHp, 'Fast knives hit using swept collision');
const rune = fixture(); rune.levels.rune = 1; rune.aim = { x: rune.player.x + 400, y: rune.player.y, active: true }; rune.castRelic('rune');
tick(rune, 1.7); assert.ok(rune.relics[0].vx < 0, 'Runes bounce at their flight bounds');
const defense = fixture(); defense.player.invulnerable = 0; defense.levels.laurel = 1; defense.castRelic('laurel');
defense.hurtPlayer(40); assert.equal(defense.player.hp, 100); assert.equal(defense.shieldCharges, 0);
defense.player.invulnerable = 0; defense.levels.armor = 2; defense.hurtPlayer(20); assert.equal(defense.player.hp, 84);
defense.player.invulnerable = 0; defense.levels.revive = 1; defense.hurtPlayer(1000); assert.equal(defense.status, 'running'); assert.equal(defense.player.hp, 50); assert.equal(defense.revivesUsed, 1);
const reborn = NightSave.restore(clone(NightSave.capture(defense))); reborn.pause(); reborn.player.invulnerable = 0; reborn.hurtPlayer(1000); assert.equal(reborn.status, 'dead', 'A saved resurrection is not reusable');
const growth = fixture(); growth.levels.growth = 1; for (let i = 0; i < 100; i++) growth.gainXP(1); assert.equal(growth.xp, 110, 'Fractional XP bonuses accumulate');
growth.levels.greed = 2; growth.awardGold(10); assert.equal(growth.goldEarned, 13);
const area = fixture(); area.levels.area = area.levels.duration = area.levels.velocity = 2; area.levels.water = 1; area.castRelic('water');
assert.ok(area.pools[0].radius > 69 && area.pools[0].life > 3.4); assert.ok(area.projectileSpeed > 1);
const pages = fixture({ stressMode: true }); pages.cycleWeapons(1); assert.ok(pages.selectSlot(1)); assert.equal(pages.selectedWeapon, NightSlots[9]); pages.cycleWeapons(1); assert.ok(pages.selectSlot(2)); assert.equal(pages.selectedWeapon, 'birds');
pages.cycleWeapons(1); assert.equal(pages.weaponPage, 0);

const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
const p = new NightProgress(storage); assert.equal(p.profile.meta.gold, 50); assert.ok(p.purchase('vital', 0)); assert.equal(p.profile.meta.gold, 25);
const malformed = new NightProgress({ getItem: key => key === 'ascii-night-progress-v2' ? JSON.stringify({ version: 2, seconds: 'bad' }) : null });
assert.equal(malformed.profile.meta.gold, 50, 'Invalid legacy play time cannot corrupt the gold balance');
assert.equal(new NightProgress(storage).profile.meta.ranks.vital, 1);
const upgraded = new NightGame(1, 'hunter', { meta: p.profile.meta.ranks }); assert.equal(upgraded.player.maxHp, 110);
upgraded.start(); const oldRun = NightSave.restore(clone(NightSave.capture(upgraded))); assert.equal(oldRun.player.maxHp, 110); assert.equal(oldRun.meta.vital, 1);
const concurrent = new NightProgress(storage); assert.equal(concurrent.purchase('vital', 0), false, 'A stale shop price cannot purchase another rank');
concurrent.savePreferences('witch', 'auto', 6000); assert.equal(new NightProgress(storage).profile.meta.gold, 25, 'Other tabs preserve purchases when saving preferences');
const earning = fixture(); earning.awardGold(20); assert.ok(p.checkpoint(earning)); assert.equal(p.profile.meta.gold, 45);
p.checkpoint(earning); assert.equal(p.profile.meta.gold, 45); const reloaded = new NightProgress(storage); reloaded.checkpoint(earning); assert.equal(reloaded.profile.meta.gold, 45, 'Checkpoint reloads do not mint gold twice');
earning.awardGold(7); earning.time = 1; reloaded.finish(earning); assert.equal(reloaded.profile.meta.gold, 52); reloaded.finish(earning); assert.equal(reloaded.profile.meta.gold, 52);
const fail = new NightProgress({ ...storage, setItem() { throw Error('QuotaExceededError'); } }); assert.equal(fail.purchase('magnet'), false); assert.equal(new NightProgress(storage).profile.meta.gold, 52, 'Failed purchases do not spend gold');
const testRun = fixture({ stressMode: true }); testRun.awardGold(1000); assert.equal(testRun.goldEarned, 0); assert.equal(p.checkpoint(testRun), false);
const legacy = clone(NightSave.capture(fixture())); legacy.version = 2; delete legacy.meta;
for (const u of NightUpgrades.filter(u => !['needle','power','haste','fork','blades','pulse','lightning','boomerang','frost','meteor','poison','stride','magnet','vital','regen','pierce'].includes(u.id))) { delete legacy.levels[u.id]; delete legacy.clocks[u.id]; }
const legacyRun = NightSave.restore(legacy); assert.ok(legacyRun); assert.equal(legacyRun.levels.whip, 0); assert.equal(legacyRun.meta.vital, 0);

const mega = fixture(); mega.time = 599; tick(mega, .5); assert.ok(!mega.enemies.some(e => e.mega));
mega.time = 600; tick(mega, .02); const dark = mega.enemies.find(e => e.mega); assert.ok(dark); assert.equal(mega.encounter, null); assert.equal(mega.nextMegaAt, 1200);
dark.skillClock = 0; dark.x = mega.player.x - 300; dark.y = mega.player.y; tick(mega, .02); assert.ok(dark.windup > 1.5, 'The long whips have a visible windup');
tick(mega, 1.7); assert.ok(mega.bossWhips.length); assert.ok(mega.enemyShots.length >= 35); assert.ok(mega.enemyShots.every(s => s.ink === 13));
assert.ok(mega.bossWhips.every(w => w.radius >= 4000));
mega.levels.clock = 4; mega.levels.duration = 5; mega.aim = { x: dark.x, y: dark.y, active: true }; mega.buildGrid(); mega.castRelic('clock');
assert.ok(mega.freezes.get(dark.id) - mega.time <= .601, 'A mega-boss resists a permanent freeze lock');
const resumedMega = NightSave.restore(clone(NightSave.capture(mega))); assert.ok(resumedMega); assert.equal(resumedMega.nextMegaAt, 1200); assert.ok(resumedMega.enemies.some(e => e.mega));
mega.enemyShots = Array.from({ length: 256 }, () => ({ ink: 5 })); mega.enemySkill(dark);
assert.equal(mega.enemyShots.length, 256); assert.equal(mega.enemyShots.filter(s => s.ink === 13).length, 40, 'A full shot budget still allows the red mega-boss burst');
mega.hurtEnemy(dark, dark.hp + 1); assert.equal(mega.goldEarned, 125); assert.equal(mega.chests[0].source, 'darVetro');
mega.openChest(mega.chests[0]); assert.equal(mega.reward.count, 5);
console.log('PASS: 13 extra weapon behaviors, 21 passives, pages, sci-fi heroes, gold banking, persistent purchases, failed writes, old saves and the ten-minute mega-boss.');

