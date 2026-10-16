const assert = require('node:assert/strict');
require('./core.js');
const tick = (g, seconds) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) g.update(1 / 60); };
const fixture = (seed = 77) => { const g = new NightGame(seed); g.start(); Object.assign(g.player, { x: 1600, y: 1200, prevX: 1600, prevY: 1200 }); g.aim = { x: 1600, y: 900, active: false }; g.enemies = []; g.spawnClock = 1e6; g.shootClock = 1e6; return g; };
const near = (actual, expected, tolerance = .01) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const expanded = new NightGame(404);
assert.equal(expanded.width, 12800); assert.equal(expanded.height, 9600);
assert.equal(expanded.width * expanded.height / (3200 * 2400), 16, 'The arena has sixteen times the old area');
assert.equal(expanded.player.x, expanded.width / 2); assert.equal(expanded.player.y, expanded.height / 2);
expanded.start(); expanded.enemies = []; expanded.spawnClock = expanded.shootClock = 1e6;
expanded.player.x = 3300; expanded.player.y = 2500; expanded.input = { x: 1, y: 1 };
tick(expanded, .5); assert.ok(expanded.player.x > 3300 && expanded.player.y > 2500, 'The old edges no longer block movement');
expanded.player.x = expanded.width - 29; expanded.player.y = expanded.height - 29; tick(expanded, .1);
assert.equal(expanded.player.x, expanded.width - 28); assert.equal(expanded.player.y, expanded.height - 28);
for (let i = 0; i < 200; i++) {
  const e = expanded.spawn('ghoul');
  assert.ok(e.x >= 28 && e.x <= expanded.width - 28 && e.y >= 28 && e.y <= expanded.height - 28, 'Spawns respect the new map boundary');
}

const straight = fixture(), diagonal = fixture();
straight.input.x = 1; diagonal.input = { x: 1, y: 1 };
tick(straight, 1); tick(diagonal, 1);
near(straight.player.x - 1600, 172); near(Math.hypot(diagonal.player.x - 1600, diagonal.player.y - 1200), 172);
const boundary = fixture(); boundary.player.x = boundary.width - 29; boundary.input.x = 1; tick(boundary, 1);
assert.equal(boundary.player.x, boundary.width - 28);
assert.ok(boundary.dash()); assert.equal(boundary.dash(), false, 'Dash has a cooldown');
tick(boundary, 3.5); assert.ok(boundary.dash());
const dash = fixture(); dash.input.y = -1; assert.ok(dash.dash()); tick(dash, .2);
assert.ok(dash.player.y < 1200 - 100, 'Dash moves faster than running');
assert.ok(dash.player.invulnerable > 0); const hp = dash.player.hp; dash.hurtPlayer(40); assert.equal(dash.player.hp, hp);

const shooting = fixture(); const target = shooting.spawn('ghoul', 1720, 1200); shooting.shootClock = 0;
tick(shooting, .4); assert.equal(target.alive, false, 'Automatic aim kills a nearby enemy'); assert.equal(shooting.kills, 1); assert.equal(shooting.gems.length, 1);
const pierce = fixture(); pierce.levels.pierce = 1;
const a = pierce.spawn('ghoul', 1720, 1200), b = pierce.spawn('ghoul', 1755, 1200); a.speed = b.speed = 0;
pierce.fire(); tick(pierce, .5); assert.equal(pierce.kills, 2, 'A piercing projectile hits distinct targets');
const noPierce = fixture(); const c = noPierce.spawn('ghoul', 1720, 1200), d = noPierce.spawn('ghoul', 1755, 1200); c.speed = d.speed = 0;
noPierce.fire(); tick(noPierce, .5); assert.equal(noPierce.kills, 1);
const fast = fixture(); const fastEnemy = fast.spawn('bat', 1628, 1200); fastEnemy.speed = 0;
fast.shots.push({ x: 1600, y: 1200, vx: 2000, vy: 0, life: 1, remaining: 1, hits: new Set(), damage: 40 });
fast.update(.05); assert.equal(fastEnemy.alive, false, 'Swept projectile collision does not tunnel through a bat');
const fork = fixture(); fork.levels.fork = 3; fork.spawn('brute', 1800, 1200); fork.fire(); assert.equal(fork.shots.length, 4);
assert.equal(fork.shots[0].vy, 0, 'Extra projectiles preserve the accurately aimed primary shot');

const contact = fixture(); contact.spawn('ghoul', 1600, 1200); tick(contact, .3); assert.equal(contact.player.hp, 90, 'Contact invulnerability prevents damage every frame');
contact.player.hp = 1; contact.player.invulnerable = 0; contact.hurtPlayer(10); assert.equal(contact.status, 'dead');
const frozenAt = contact.time; tick(contact, 1); assert.equal(contact.time, frozenAt);
const paused = fixture(); paused.pause(); tick(paused, 1); assert.equal(paused.time, 0); paused.pause(); tick(paused, 1); near(paused.time, 1);

const xp = fixture(); xp.gems.push({ x: 1660, y: 1200, value: 6 }); tick(xp, .5);
assert.equal(xp.status, 'upgrading'); assert.equal(xp.level, 2); assert.equal(xp.offers.length, 3);
assert.equal(new Set(xp.offers.map(u => u.id)).size, 3, 'Upgrade choices are distinct');
assert.ok(xp.offers.some(u => u.weapon && !xp.levels[u.id]), 'First level offers a second weapon');
const upgradeTime = xp.time; tick(xp, 5); assert.equal(xp.time, upgradeTime, 'Choosing upgrades freezes the run');
const picked = xp.offers[0].id, beforeChoice = xp.levels[picked]; assert.ok(xp.choose(0)); assert.equal(xp.levels[picked], beforeChoice + 1); assert.equal(xp.status, 'running');
assert.equal(xp.choose(0), false, 'Cannot choose twice');
const overflow = fixture(); overflow.grantXP(100); let gained = 0;
while (overflow.status === 'upgrading') { overflow.choose(0); gained++; assert.ok(gained < 15); }
assert.ok(gained >= 3); assert.ok(overflow.xp < overflow.xpNeed, 'Excess XP survives chained level-ups');
const caps = fixture(); for (const u of NightUpgrades) caps.levels[u.id] = u.max;
caps.player.hp = 20; caps.grantXP(6); assert.equal(caps.status, 'running'); assert.equal(caps.player.hp, 50);
const vital = fixture(); vital.player.hp = 20; vital.offers = [NightUpgrades.find(u => u.id === 'vital')]; vital.status = 'upgrading'; vital.choose(0);
assert.equal(vital.player.maxHp, 125); assert.equal(vital.player.hp, 60);

const magnet = fixture(); magnet.levels.magnet = 1; magnet.gems.push({ x: 1730, y: 1200, value: 1 }); tick(magnet, .6); assert.equal(magnet.xp, 1);
const outOfReach = fixture(); outOfReach.gems.push({ x: 1730, y: 1200, value: 1 }); tick(outOfReach, 1); assert.equal(outOfReach.xp, 0);
const healing = fixture(); healing.player.hp = 91; healing.hearts.push({ x: 1600, y: 1200, value: 20 }); tick(healing, .1); assert.equal(healing.player.hp, 100);
healing.hearts.push({ x: 1600, y: 1200, value: 20 }); tick(healing, .1); assert.equal(healing.hearts.length, 1, 'Full-health player leaves medicine on the ground');
healing.player.hp = 80; healing.levels.regen = 2; tick(healing, 1); assert.ok(healing.player.hp <= 100);
const regen = fixture(); regen.player.hp = 50; regen.levels.regen = 2; tick(regen, 1); near(regen.player.hp, 51.4);

const pulse = fixture(); pulse.levels.pulse = 1; pulse.pulseClock = 0;
const close = pulse.spawn('skeleton', 1670, 1200), far = pulse.spawn('skeleton', 1900, 1200); tick(pulse, .02);
assert.equal(close.alive, false); assert.equal(far.alive, true); assert.equal(pulse.rings.length, 1);
const blades = fixture(); blades.levels.blades = 2;
const orb = blades.bladePositions()[0], bladeEnemy = blades.spawn('ghoul', orb.x, orb.y); tick(blades, .02); assert.equal(bladeEnemy.alive, false);

const boss = fixture(); boss.time = 59.99; tick(boss, .03); assert.equal(boss.enemies.filter(e => e.kind === 'lichLord').length, 1);
tick(boss, 1); assert.equal(boss.enemies.filter(e => e.boss).length, 1, 'Only one boss spawns per interval');
const endless = fixture(); endless.time = 179.99; tick(endless, .1); assert.equal(endless.status, 'running'); assert.ok(endless.time > 180);
assert.ok(endless.dash()); endless.time = 1800; tick(endless, .1); assert.equal(endless.status, 'running'); assert.ok(endless.wave > 60);

// Full-length stress run: actual spawns, targeting, pickup, upgrades and late waves.
// Invulnerability isolates simulation stability from the quality of this test bot.
const longRun = new NightGame(2026); longRun.start();
let maxEnemies = 0, maxParticles = 0, steps = 0;
while ((longRun.time < 180 || longRun.status === 'upgrading') && steps++ < 14000) {
  if (longRun.status === 'upgrading') { const preferred = ['blades', 'pulse', 'haste', 'power', 'fork', 'magnet', 'pierce', 'stride', 'vital', 'regen']; let choice = 0; for (const id of preferred) { const i = longRun.offers.findIndex(u => u.id === id); if (i >= 0) { choice = i; break; } } longRun.choose(choice); }
  longRun.player.invulnerable = 1;
  let destination = null, distance = Infinity;
  for (const gem of longRun.gems) { const d = Math.hypot(gem.x - longRun.player.x, gem.y - longRun.player.y); if (d < distance) { distance = d; destination = gem; } }
  const angle = longRun.time * .08;
  const target = destination || { x: longRun.width / 2 + Math.cos(angle) * 450, y: longRun.height / 2 + Math.sin(angle) * 450 };
  const dx = target.x - longRun.player.x, dy = target.y - longRun.player.y, len = Math.hypot(dx, dy) || 1;
  longRun.input = { x: dx / len, y: dy / len };
  longRun.update(1 / 60); longRun.events.length = 0;
  maxEnemies = Math.max(maxEnemies, longRun.enemies.length); maxParticles = Math.max(maxParticles, longRun.particles.length);
  assert.ok(Number.isFinite(longRun.player.x + longRun.player.y + longRun.player.hp));
}
assert.equal(longRun.status, 'running'); assert.ok(longRun.time >= 180); assert.ok(longRun.kills > 100); assert.ok(longRun.level >= 6);
assert.ok(maxEnemies <= longRun.enemyLimit); assert.ok(maxParticles <= 450);
const replayA = new NightGame(123), replayB = new NightGame(123); replayA.start(); replayB.start(); tick(replayA, 4); tick(replayB, 4);
assert.deepEqual(replayA.enemies, replayB.enemies, 'Seeded simulation is reproducible');
assert.equal(NightCharacters.length, 6); assert.equal(NightUpgrades.filter(u => u.weapon).length, 8);
for (const hero of NightCharacters) {
  const character = new NightGame(123, hero.id);
  assert.equal(character.player.maxHp, hero.hp); assert.equal(character.speed, hero.speed);
  assert.equal(character.levels[hero.weapon], 1);
  assert.equal(NightUpgrades.filter(u => u.weapon).reduce((sum, u) => sum + character.levels[u.id], 0), 1, 'Each hero starts with one distinct weapon');
  assert.match(hero.sprite, /^[\x20-\x7e\n]+$/);
  if (hero.weapon !== 'needle') { character.spawn('ghoul', 1700, 1200); character.fire(); assert.equal(character.shots.length, 0, 'Unowned weapons do not fire'); }
  for (let seed = 1; seed <= 20; seed++) {
    const choices = new NightGame(seed, hero.id); choices.start(); choices.grantXP(6);
    assert.equal(new Set(choices.offers.map(u => u.id)).size, 3);
    assert.ok(choices.offers.some(u => u.weapon && choices.levels[u.id] === 0), 'Every hero is offered a new weapon on level 2');
  }
}
const lightning = fixture(); lightning.levels.lightning = 1;
for (const x of [1730, 1900, 2070, 2700]) { const e = lightning.spawn('ghoul', x, 1200); e.speed = 0; }
lightning.castLightning(); assert.equal(lightning.kills, 3, 'Lightning chains through three nearby targets');
assert.equal(lightning.enemies[3].alive, true, 'Lightning cannot cross a huge gap'); assert.equal(lightning.arcs[0].points.length, 4);
const cold = fixture(); cold.levels.frost = 1; cold.weaponClocks.frost = 1e6;
const frozenEnemy = cold.spawn('brute', 1700, 1200); cold.buildGrid(); cold.castFrost();
const beforeCold = frozenEnemy.x; tick(cold, 1); assert.ok(beforeCold - frozenEnemy.x < 15, 'Frost reduces movement to 40%');
assert.ok(frozenEnemy.chilledTill > cold.time); assert.ok(frozenEnemy.hp < frozenEnemy.maxHp);
tick(cold, 2); assert.ok(frozenEnemy.chilledTill < cold.time, 'Chill expires');
const returning = fixture(); returning.levels.boomerang = 1; returning.weaponClocks.boomerang = 1e6;
const returnTarget = returning.spawn('brute', 1770, 1200); returnTarget.speed = 0;
returning.castBoomerang(); tick(returning, 1.5);
assert.equal(returning.boomerangs.length, 0, 'Sickle returns to its owner');
assert.ok(returnTarget.hp <= 83, 'Sickle hits on the outward and return paths');
const meteors = fixture(); meteors.levels.meteor = 3; meteors.weaponClocks.meteor = 1e6;
for (const x of [1450, 1750]) { const e = meteors.spawn('ghoul', x, 1200); e.speed = 0; }
meteors.castMeteor(); assert.equal(meteors.meteors.length, 2); tick(meteors, .5); assert.equal(meteors.kills, 0, 'Meteor gives a visible warning');
tick(meteors, .2); assert.equal(meteors.kills, 2); assert.equal(meteors.meteors.length, 0);
const poison = fixture(); poison.levels.poison = 1; poison.weaponClocks.poison = 1e6;
const poisoned = poison.spawn('brute', 1650, 1200); poisoned.speed = 0;
poison.pools.push({ x: 1600, y: 1200, radius: 65, life: 4 }, { x: 1600, y: 1200, radius: 65, life: 4 });
tick(poison, 1); near(poisoned.hp, 101, .1); // Three 8-damage ticks; overlapping pools do not multiply damage.
poison.pause(); const poolLife = poison.pools[0].life; tick(poison, 2); assert.equal(poison.pools[0].life, poolLife);
poison.pause(); tick(poison, 3.1); assert.equal(poison.pools.length, 0);

// The render path must reuse cached ASCII glyphs and preserve fractional positions.
require('./renderer.js');
let rasterized = 0, blits = 0;
const mockDocument = { createElement: () => mockCanvas() };
function mockCanvas() { return { ownerDocument: mockDocument, width: 0, height: 0, getContext: () => ({ setTransform() {}, fillRect() {}, fillText(ch) { assert.match(ch, /^[\x20-\x7e]$/); rasterized++; }, drawImage() { blits++; } }) }; }
const renderer = new NightRenderer(mockCanvas()); renderer.resize(1100, 560, 1);
assert.equal(rasterized, 1140, 'Only the ASCII atlas rasterizes text, including two pickup inks');
const renderGame = fixture(); renderGame.levels.lightning = renderGame.levels.poison = renderGame.levels.boomerang = renderGame.levels.frost = renderGame.levels.meteor = 1;
renderGame.spawn('brute', 1800, 1200); tick(renderGame, .8);
renderer.render(renderGame, { x: 1600, y: 1200 }, .5);
const rasterCount = rasterized; renderer.render(renderGame, { x: 1600.5, y: 1200.5 }, .5);
assert.equal(rasterized, rasterCount, 'Running frames do not rasterize text'); assert.ok(blits > 100);
assert.equal(renderer.position({ prevX: 10, x: 20, prevY: 0, y: 8 }).x, 15);
assert.ok(renderer.point(1600.6, 1200.6).x > renderer.point(1600.5, 1200.5).x, 'Movement is not rounded to character cells');
for (let x = 0; x < 4000; x += 320) renderer.render(renderGame, { x, y: x * .6 });
assert.ok(renderer.chunks.size <= 36, 'Scenery cache stays bounded');
const terrainRenderer = new NightRenderer(mockCanvas()); terrainRenderer.resize(1100, 560, 1);
let fenceGlyphs = 0; const originalSprite = terrainRenderer.sprite.bind(terrainRenderer);
terrainRenderer.sprite = (ctx, x, y, value, ink) => { if (value === '#' || value === ':') fenceGlyphs++; originalSprite(ctx, x, y, value, ink); };
terrainRenderer.render(renderGame, { x: 3200, y: 2400 }); assert.equal(fenceGlyphs, 0, 'The old boundary renders as ordinary terrain');
terrainRenderer.render(renderGame, { x: renderGame.width - 20, y: renderGame.height / 2 }); assert.ok(fenceGlyphs > 0, 'The new map edge is visible');
const pickupGame = fixture(); pickupGame.spawn('ghoul', 1700, 1200); pickupGame.gems = [{ x: 1700, y: 1200, value: 1 }]; pickupGame.hearts = [{ x: 1730, y: 1200, value: 20 }];
const drawn = [], originalWorld = terrainRenderer.world.bind(terrainRenderer);
terrainRenderer.world = (x, y, glyph, ink) => { drawn.push({ glyph, ink }); originalWorld(x, y, glyph, ink); };
terrainRenderer.render(pickupGame, { x: 1600, y: 1200 });
const xpDraw = drawn.findIndex(d => d.glyph === '*' && d.ink === 10), healDraw = drawn.findIndex(d => d.glyph === '[+]' && d.ink === 11);
assert.ok(xpDraw > drawn.findIndex(d => d.glyph === 'z'), 'Brighter XP is drawn over enemies'); assert.ok(healDraw >= 0, 'Healing has a dedicated brighter ink');
const farBlink = pickupGame.spawn('freddy', 3100, 1200); farBlink.windup = .5; farBlink.targetX = 1650; farBlink.targetY = 1200;
drawn.length = 0; terrainRenderer.render(pickupGame, { x: 1600, y: 1200 });
assert.ok(drawn.some(d => d.glyph === '[!]'), 'An offscreen Freddy still warns about his visible teleport destination');
const packed = fixture(); for (let i = 0; i < 6000; i++) packed.spawn('ghoul', 1600 + i % 4, 1200 + i % 3);
renderer.render(packed, { x: 1600, y: 1200 });
assert.equal(packed.enemies.length, 6000, 'Rendering never removes simulated enemies');
assert.ok(renderer.renderedEnemies < 10, 'Dense bodies are composited by ASCII cell');
const manual = fixture(); manual.setFireMode('manual'); manual.shootClock = 0;
manual.aim = { x: 1600, y: 900, active: true }; const offAxis = manual.spawn('ghoul', 1700, 1200); offAxis.speed = 0;
tick(manual, .3); assert.equal(manual.shots.length, 0, 'Manual mode does not attack without a trigger');
manual.input.firing = true; tick(manual, .4); assert.equal(offAxis.alive, true, 'Manual aim is not overridden by automatic targeting');
manual.aim.x = 1800; manual.aim.y = 1200; tick(manual, 1); assert.equal(offAxis.alive, false, 'Held trigger fires toward the cursor');
assert.equal(manual.selectSlot(9), false); assert.equal(manual.selectSlot(2), false, 'Locked weapons cannot be selected');
manual.levels.blades = 1; assert.ok(manual.selectSlot(2)); assert.equal(manual.selectedWeapon, 'blades'); assert.deepEqual(manual.bladePositions(), [], 'Manual blades do not deal passive orbit damage');
manual.input.firing = false; manual.shots = []; manual.weaponClocks.blades = 0; manual.buildGrid(); const slashTarget = manual.spawn('ghoul', 1690, 1200); slashTarget.speed = 0;
tick(manual, .1); assert.equal(slashTarget.alive, true); manual.input.firing = true; tick(manual, .02); assert.equal(slashTarget.alive, false, 'Manual blade performs an aimed slash');
manual.setFireMode('auto'); assert.equal(manual.input.firing, false); assert.equal(manual.bladePositions().length, 1);
const tap = fixture(); tap.setFireMode('manual'); tap.shootClock = 0; tap.requestAttack(); tap.input.firing = false; tick(tap, .02);
assert.equal(tap.shots.length, 1, 'A quick press between two frames still fires once'); assert.equal(tap.queuedWeapon, null);
tick(tap, 1.7); assert.equal(tap.shots.length, 0, 'A tap does not become a stuck trigger');
const stress = new NightGame(99, 'hunter', { stressMode: true, enemyLimit: 1000 }); stress.start(); stress.hurtPlayer(1e9); assert.equal(stress.player.hp, 100);
assert.equal(NightUpgrades.filter(u => u.weapon).filter(u => stress.levels[u.id] === u.max).length, 8);
const beforePressure = stress.time; stress.pressureOffset += 1800; assert.equal(stress.time, beforePressure, 'Load preset does not pretend to advance elapsed play time');
stress.enemies = []; for (let i = 0; i < 3; i++) stress.spawnWave(); assert.ok(stress.enemies.length > 100, 'Late waves exceed the old crowd size quickly');
while (stress.enemies.length < stress.enemyLimit) stress.spawnWave(); assert.equal(stress.enemies.length, 1000); stress.spawnWave(); assert.equal(stress.enemies.length, 1000);
const merging = fixture(); for (let i = 0; i < 1000; i++) merging.addGem(1800 + i % 20, 1200 + i % 20, 2);
assert.ok(merging.gems.length < 4); assert.equal(merging.gems.reduce((sum, g) => sum + g.value, 0), 2000, 'Merging drops preserves XP');
for (const u of NightUpgrades.filter(u => u.weapon)) {
  const idle = fixture(); idle.levels[u.id] = 1; idle.setFireMode('manual'); idle.selectedWeapon = u.id;
  idle.spawn('brute', 1750, 1200); tick(idle, .4);
  assert.equal(idle.shots.length + idle.boomerangs.length + idle.rings.length + idle.pools.length + idle.arcs.length + idle.meteors.length + idle.slashes.length, 0, u.id + ' waits for manual input');
}
console.log(`PASS: movement, combat, XP, upgrades and endless play. Three-minute run: ${longRun.kills} kills, level ${longRun.level}, peak ${maxEnemies} enemies.`);
console.log('PASS: 6 heroes, 8 weapons, 120 first-level offers, chaining, returning sickle, frost, meteor, poison, cached glyphs and smooth interpolation.');
console.log('PASS: slots 1–9, locked slots, manual aim/trigger/slash, auto mode, stress settings, population budget and merged XP.');
