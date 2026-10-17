const assert = require('node:assert/strict');
require('./core.js');
require('./progress.js');
const tick = (game, seconds) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) game.update(1 / 60); };
function fixture(options = {}) {
  const game = new NightGame(41, 'hunter', { fireMode: 'manual', terrain: false, ...options }); game.start();
  game.enemies = []; game.spawnClock = game.nextBossAt = 1e6; return game;
}
assert.equal(Object.keys(NightEnemies).length, 58);
assert.equal(Object.values(NightEnemies).filter(e => e.boss && !e.mega).length, 11);
for (const [kind, definition] of Object.entries(NightEnemies)) {
  assert.match(definition.sprite, /^[\x20-\x7e\n]+$/, kind + ' uses ASCII');
  const g = fixture(), e = g.spawn(kind, g.player.x + 400, g.player.y); tick(g, 4);
  assert.ok(Number.isFinite(e.x + e.y + e.hp)); assert.ok(g.encountered.has(kind));
}
const early = fixture(); for (let i = 0; i < 8; i++) early.spawnWave();
assert.ok(early.enemies.every(e => ['ghoul', 'grave_rat'].includes(e.kind)), 'The opening contains only introductory enemies');
const late = fixture({ enemyLimit: 24000 }); late.time = 600;
for (let i = 0; i < 400; i++) late.spawnWave();
assert.ok(late.enemies.every(e => late.wavePlan.entries.some(row => row.id === e.kind)), 'Waves draw from their current readable composition');
assert.ok(late.encountered.size <= 5); assert.ok(late.enemies.length <= late.wavePlan.target);

for (const [kind, projectiles] of [['lich', 1], ['pumpkin', 3], ['lichLord', 3]]) {
  const g = fixture(), e = g.spawn(kind, g.player.x + 320, g.player.y); e.skillClock = 0;
  tick(g, .02); assert.ok(e.windup > 0); assert.equal(g.enemyShots.length, 0, 'Ranged attacks have a warning');
  tick(g, .9); assert.equal(g.enemyShots.length, projectiles);
  assert.ok(g.enemyShots.every(shot => Math.abs(shot.damage - e.damage * (kind === 'pumpkin' ? .64 : .8)) < 1e-9), kind + ' projectile damage');
  if (kind === 'lichLord') assert.equal(g.enemies.filter(e => e.kind === 'skeleton').length, 3);
}
for (const time of [0, 600]) {
  const g = fixture(); g.time = time;
  const pumpkin = g.spawn('pumpkin', g.player.x - 40, g.player.y);
  const resumed = NightSave.restore(JSON.parse(JSON.stringify(NightSave.capture(g))));
  assert.ok(resumed, 'Pumpkin encounters can resume');
  resumed.enemySkill(resumed.enemies[0]);
  const previousDamage = pumpkin.damage * .8;
  assert.ok(resumed.enemyShots.every(shot => Math.abs(shot.damage - previousDamage * .8) < 1e-9), 'Pumpkin projectiles deal 20% less damage at every difficulty');
  resumed.enemyShots = [resumed.enemyShots[1]];
  const loadedShot = NightSave.restore(JSON.parse(JSON.stringify(NightSave.capture(resumed))));
  assert.ok(loadedShot, 'Weakened projectiles survive a checkpoint');
  loadedShot.pause();
  const hp = loadedShot.player.hp;
  loadedShot.updateEnemyShots(.2);
  assert.ok(Math.abs(loadedShot.player.hp - (hp - previousDamage * .8)) < 1e-9, 'A restored pumpkin projectile applies its reduced damage on impact');
  assert.equal(loadedShot.enemyShots.length, 0);
}
const british = fixture(); const lord = british.spawn('british', british.player.x + 300, british.player.y); lord.skillClock = 0; tick(british, 1);
assert.equal(british.enemies.filter(e => e.kind === 'ghoul').length, 3); assert.equal(british.enemies.filter(e => e.kind === 'mummy').length, 1);
const capped = fixture({ enemyLimit: 100 }); const capLord = capped.spawn('lichLord', capped.player.x + 320, capped.player.y); capLord.skillClock = 0;
for (let i = 0; i < 99; i++) capped.spawn('ghoul', capped.player.x + 600, capped.player.y + i); tick(capped, 1);
assert.equal(capped.enemies.length, 100, 'Summoners respect the enemy budget');
capped.enemyShots = [];
for (let i = 0; i < 256; i++) capped.enemyShots.push({ x: 100, y: 100, vx: 0, vy: 0, life: 4, damage: 1, radius: 7, ink: 5, glyph: '~' });
capped.enemySkill(capLord); assert.equal(capped.enemyShots.length, 256, 'Hostile projectiles stay bounded');

const blinking = fixture(), freddy = blinking.spawn('freddy', blinking.player.x + 330, blinking.player.y); freddy.skillClock = 0;
const oldX = freddy.x, oldY = freddy.y; tick(blinking, .02);
assert.ok(freddy.windup > 0); assert.equal(freddy.x, oldX); assert.equal(freddy.y, oldY);
const mark = { x: freddy.targetX, y: freddy.targetY }; tick(blinking, .8); assert.equal(freddy.x, oldX, 'Teleport waits for its visible marker');
tick(blinking, .2); assert.ok(Math.hypot(freddy.x - mark.x, freddy.y - mark.y) < 10);
assert.ok(Math.hypot(freddy.x - blinking.player.x, freddy.y - blinking.player.y) > 100, 'Teleport never lands on the player');
const charging = fixture(), jason = charging.spawn('jason', charging.player.x - 400, charging.player.y); jason.skillClock = 0;
tick(charging, .02); const windupX = jason.x; tick(charging, .5); assert.equal(jason.x, windupX);
tick(charging, .6); assert.ok(jason.x - windupX > 80, 'Jason charges after warning');
const slowed = fixture(), mummy = slowed.spawn('mummy', slowed.player.x, slowed.player.y);
tick(slowed, .02); assert.ok(slowed.speed < slowed.character.speed); slowed.enemies = []; tick(slowed, 2);
assert.equal(slowed.speed, slowed.character.speed, 'Mummy curse expires');
const swept = fixture(); swept.enemyShots.push({ x: swept.player.x - 50, y: swept.player.y, vx: 3000, vy: 0, life: 1, damage: 15, radius: 7, ink: 5, glyph: '~' });
swept.update(.05); assert.equal(swept.player.hp, 85, 'Enemy missiles use swept collision'); assert.equal(swept.enemyShots.length, 0);

const bosses = fixture(); bosses.nextBossAt = 60; bosses.nextMegaAt = 1e6; bosses.rosterBossIndex = 1e6; const order = [];
for (let i = 0; i < 12; i++) { bosses.enemies = []; bosses.time = bosses.nextBossAt; bosses.update(.01); tick(bosses, 5.05); const boss = bosses.enemies.find(e => e.boss); order.push(boss.kind); bosses.hurtEnemy(boss, boss.hp + 1); }
assert.equal(new Set(order.slice(0, 6)).size, 6); assert.deepEqual(order.slice(0, 6), order.slice(6));
assert.equal(bosses.bossKills, 12); assert.equal(bosses.hearts[0].value, 60);
const quicker = new NightGame(); assert.ok(Math.abs(quicker.cooldown - .442) < 1e-9); assert.ok(Math.abs(quicker.dashCooldown - 2.04) < 1e-9);
quicker.levels.haste = 1; assert.ok(quicker.cooldown < .442);
console.log('PASS: 58 enemies, six rotating mini-bosses, telegraphs, missiles, summons, charge, teleport, curse, population budgets and shorter cooldowns.');
