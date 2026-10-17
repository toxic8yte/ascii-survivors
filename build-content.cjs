const fs = require('node:fs');
const path = require('node:path');
const files = { heroes: 'heroes', weapons: 'weapons', passives: 'passives', evolutions: 'evolutions', permanents: 'permanents', features: 'features', legacyEnemies: 'enemies-legacy' };
function readContent(directory = path.join(__dirname, 'data')) {
  const read = name => JSON.parse(fs.readFileSync(path.join(directory, name + '.json'), 'utf8').replace(/^\uFEFF/, ''));
  return { ...Object.fromEntries(Object.entries(files).map(([key, name]) => [key, read(name)])), upgradeOrder: read('catalog-order').upgrades };
}
function validateContent(data, roster = []) {
  const fail = message => { throw new Error('Content data: ' + message); };
  const positive = n => Number.isFinite(n) && n > 0;
  const uint = n => Number.isSafeInteger(n) && n >= 0;
  const text = (value, limit = 2000) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
  const ascii = value => text(value, 200) && /^[\x20-\x7e\n]+$/.test(value);
  const ids = {};
  for (const key of Object.keys(files)) {
    const rows = data[key]; if (!Array.isArray(rows) || !rows.length || rows.length > 1000) fail(key + ': expected a non-empty array');
    ids[key] = new Set();
    for (const row of rows) {
      if (!row || !/^[a-z][a-zA-Z0-9_]*$/.test(row.id) || ids[key].has(row.id)) fail(key + ': invalid or duplicate id ' + row?.id);
      ids[key].add(row.id);
      if (!text(row.name || row.title, 120) || !text(row.description)) fail(key + '/' + row.id + ': name/title and description are required');
      if (Object.hasOwn(row, 'text')) fail(key + '/' + row.id + ': use description instead of text');
    }
  }
  const upgrades = [...data.weapons, ...data.passives], upgradeIds = new Set(upgrades.map(row => row.id));
  if (upgradeIds.size !== upgrades.length) fail('weapon and passive IDs overlap');
  for (const row of upgrades) {
    if (!ascii(row.icon) || !uint(row.max) || !row.max || !text(row.kind, 80)) fail(row.id + ': invalid icon, max or kind');
    if (ids.weapons.has(row.id) !== (row.weapon === true)) fail(row.id + ': weapon flag does not match its file');
    if (row.cooldown !== undefined && (!positive(row.cooldown) || !text(row.behavior, 40))) fail(row.id + ': invalid cooldown or behavior');
  }
  for (const hero of data.heroes) {
    if (!ids.weapons.has(hero.weapon) || !['hp', 'speed', 'magnet', 'dash'].every(key => positive(hero[key])) || !uint(hero.cost) || !ascii(hero.sprite) || !text(hero.role, 120) || !uint(hero.ink) || hero.ink > 14) fail('heroes/' + hero.id + ': invalid weapon, stats, portrait or price');
    if (hero.traits && Object.entries(hero.traits).some(([key, value]) => !['armor', 'power', 'area', 'greed'].includes(key) || !Number.isFinite(value) || value < 0)) fail('heroes/' + hero.id + ': invalid traits');
  }
  const evolved = new Set();
  for (const recipe of data.evolutions) {
    if (!ids.weapons.has(recipe.weapon) || evolved.has(recipe.weapon) || !ascii(recipe.icon) || !recipe.passives || typeof recipe.passives !== 'object' || Array.isArray(recipe.passives)) fail('evolutions/' + recipe.id + ': invalid recipe');
    evolved.add(recipe.weapon);
    if (recipe.weapons !== undefined && (!Array.isArray(recipe.weapons) || new Set(recipe.weapons).size !== recipe.weapons.length || recipe.weapons.some(id => !ids.weapons.has(id) || id === recipe.weapon))) fail('evolutions/' + recipe.id + ': invalid union weapons');
    for (const [id, rank] of Object.entries(recipe.passives)) if (!ids.passives.has(id) || !uint(rank) || rank < 1 || rank > data.passives.find(row => row.id === id).max) fail('evolutions/' + recipe.id + ': invalid passive ' + id);
  }
  for (const row of [...data.permanents, ...data.features]) if (!ascii(row.icon) || !uint(row.cost)) fail(row.id + ': invalid price or icon');
  for (const row of data.permanents) if (!uint(row.max) || !row.max) fail('permanents/' + row.id + ': invalid max');
  const enemyIds = new Set(roster.map(row => row.id));
  for (const row of data.legacyEnemies) {
    if (enemyIds.has(row.id) || !['hp', 'speed', 'radius', 'damage', 'xp'].every(key => positive(row[key])) || !ascii(row.sprite) || !ascii(row.glyph) || !uint(row.ink) || row.ink > 14 || !row.boss && (!Number.isFinite(row.at) || row.at < 0)) fail('legacyEnemies/' + row.id + ': invalid enemy or ID collision');
    for (const key of ['projectileSpeed', 'projectileDamageScale']) if (row[key] !== undefined && !positive(row[key])) fail('legacyEnemies/' + row.id + ': invalid ' + key);
    enemyIds.add(row.id);
  }
  if (!Array.isArray(data.upgradeOrder) || new Set(data.upgradeOrder).size !== data.upgradeOrder.length || data.upgradeOrder.some(id => !upgradeIds.has(id))) fail('catalog-order: invalid or duplicate upgrade ID');
  return data;
}
function generate(data) {
  return '// Generated from data/*.json by node build-content.cjs.\n(function(root){const data=' + JSON.stringify(data) + ';root.NightContentData=data;if(typeof module!=="undefined"&&module.exports)module.exports=data;})(typeof globalThis!=="undefined"?globalThis:window);\n';
}
function build(check = false) {
  const data = validateContent(readContent(), JSON.parse(fs.readFileSync(path.join(__dirname, 'data/enemies.json'), 'utf8')));
  const output = generate(data), target = path.join(__dirname, 'content-data.js');
  if (check) { if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) throw new Error('Run node build-content.cjs to refresh content-data.js'); }
  else fs.writeFileSync(target, output);
}
module.exports = { readContent, validateContent, generate, build };
if (require.main === module) build(process.argv.includes('--check'));
