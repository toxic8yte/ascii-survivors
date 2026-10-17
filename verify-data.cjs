const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { readContent, validateContent, generate, build } = require('./build-content.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const data = readContent(), enemies = require('./data/enemies.json');
validateContent(data, enemies); build(true);
require('./core.js'); require('./progress.js');
assert.equal(data.heroes.length, NightCharacters.length); assert.equal(data.weapons.length, NightUpgrades.filter(u => u.weapon).length); assert.equal(data.passives.length, NightUpgrades.filter(u => !u.weapon).length);
assert.equal(data.legacyEnemies.length + enemies.length, Object.keys(NightEnemies).length);
for (const rows of [data.heroes, data.weapons, data.passives, data.evolutions, data.legacyEnemies, data.permanents, data.features, enemies]) {
  for (const row of rows) { assert.ok(row.description.trim(), row.id + ' has a description'); assert.equal(row.text, undefined, 'JSON descriptions have one source of truth'); }
}
assert.deepEqual(NightCharacters.map(row => row.id), data.heroes.map(row => row.id));
for (const [id, row] of Object.entries(NightEnemies)) assert.equal(row.description, row.text, id + ' keeps its compatibility alias');
for (const row of NightUpgrades) assert.equal(row.description, row.text);
for (const hero of NightCharacters) assert.equal(hero.description, hero.text);
assert.ok(Object.isFrozen(NightCatalog)); assert.ok(Object.isFrozen(NightCatalog.heroes[0]));

for (const mutate of [
  d => d.heroes.push(clone(d.heroes[0])),
  d => d.heroes[0].weapon = 'missing',
  d => d.heroes[0].cost = -1,
  d => d.heroes[0].description = '',
  d => d.heroes[0].extraWeapons = ['missing'],
  d => d.heroes[0].facingSprites = {left:'<',right:'>',up:'^'},
  d => d.heroes[0].traits = {chozoAmount:1.5},
  d => d.weapons[0].description = null,
  d => d.weapons[0].text = 'duplicate source',
  d => d.weapons[0].max = 0,
  d => d.passives[0].id = d.weapons[0].id,
  d => d.evolutions[0].weapon = 'missing',
  d => d.evolutions[0].passives = { missing: 1 },
  d => d.evolutions[0].passives = { haste: 999 },
  d => d.legacyEnemies[0].id = enemies[0].id,
  d => d.legacyEnemies[0].description = ' ',
  d => d.legacyEnemies[0].projectileSpeed = -1,
  d => d.legacyEnemies[0].projectileDamageScale = 0,
  d => d.weapons.find(w => w.id === 'gauss').projectile.speed = -1,
  d => d.weapons.find(w => w.id === 'plasmaMinigun').projectile.splashScale = 2,
  d => d.weapons.find(w => w.id === 'crossbow').projectile.glyph = '💥',
  d => d.upgradeOrder.push('missing')
]) { const bad = clone(data); mutate(bad); assert.throws(() => validateContent(bad, enemies), /Content data:/); }

// The browser uses generated script tags, including when opened from file://.
const browser = vm.createContext({});
vm.runInContext(fs.readFileSync('enemy-roster.js', 'utf8'), browser);
vm.runInContext(fs.readFileSync('content-data.js', 'utf8'), browser);
vm.runInContext(fs.readFileSync('catalog.js', 'utf8'), browser);
assert.deepEqual(clone(browser.NightCatalog), clone(NightCatalog));
const edited = clone(data), description = 'Шутка: "ещё один аргумент".\nПолезное: <b>это обычный текст</b>.';
edited.weapons[0].description = description;
const editedBrowser = vm.createContext({}); vm.runInContext(generate(edited), editedBrowser);
vm.runInContext(fs.readFileSync('enemy-roster.js', 'utf8'), editedBrowser); vm.runInContext(fs.readFileSync('catalog.js', 'utf8'), editedBrowser);
assert.equal(editedBrowser.NightCatalog.upgrades.find(row => row.id === edited.weapons[0].id).description, description, 'Quotes, Unicode, line breaks and markup remain description text');

const game = new NightGame(246, 'witch'); game.start();
game.levels.hammer = 2; game.levels.capital = 1; game.spawn('pumpkin', game.player.x + 400, game.player.y);
const saved = NightSave.capture(game), restored = NightSave.restore(clone(saved));
assert.ok(restored); assert.equal(restored.character.id, 'witch'); assert.equal(restored.levels.hammer, 2); assert.equal(restored.levels.capital, 1);
assert.equal(restored.enemies.find(e => e.kind === 'pumpkin').damage, game.enemies.find(e => e.kind === 'pumpkin').damage);
console.log('PASS: JSON sources, shared descriptions, stable IDs, cross references, validation failures, generated browser catalogue without fetch, text escaping, immutable definitions and existing checkpoints.');
