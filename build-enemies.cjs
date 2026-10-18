const fs = require('node:fs');
const path = require('node:path');
const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/enemies.json'), 'utf8'));
if (new Set(rows.map(e => e.id)).size !== rows.length) throw new Error('Duplicate enemy ID');
for (const e of rows) {
  const validSprite = s => typeof s === 'string' && /^[\x20-\x7e\n]+$/.test(s) && s.split('\n').length <= 7 && s.split('\n').every(line => line.length <= 11);
  if (!validSprite(e.visual.sprite) || !validSprite(e.visual.glyph) || e.visual.glyph.includes('\n') || e.visual.frames && (!Array.isArray(e.visual.frames) || !e.visual.frames.length || !e.visual.frames.every(validSprite))) throw new Error('Invalid ASCII sprite: ' + e.id);
  if (!['chase', 'direct', 'wavy', 'charger', 'orbit'].includes(e.movement.type) || !e.id || !e.name || typeof e.description !== 'string' || !e.description.trim() || e.description.length > 2000 || e.stats.maxHealth <= 0 || e.stats.moveSpeed <= 0) throw new Error('Invalid enemy definition: ' + e.id);
}
const output = '// Generated from data/enemies.json by node build-enemies.cjs.\n(function(root){const data=' + JSON.stringify(rows) + ';root.NightEnemyData=data;if(typeof module!=="undefined"&&module.exports)module.exports=data;})(typeof globalThis!=="undefined"?globalThis:window);\n';
const target = path.join(__dirname, 'enemy-roster.js');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== output) throw new Error('Run node build-enemies.cjs to refresh enemy-roster.js');
} else fs.writeFileSync(target, output);
