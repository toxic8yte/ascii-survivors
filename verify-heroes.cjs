const assert = require('node:assert/strict');
require('./core.js'); require('./progress.js');
const clone = x => JSON.parse(JSON.stringify(x));
const heroData = require('./data/heroes.json');
const expected = heroData.map(hero => hero.name);
assert.deepEqual(NightCharacters.map(c => c.name), expected);
assert.equal(new Set(NightCharacters.map(c => c.id)).size, heroData.length);
for (const hero of NightCharacters) {
  assert.ok(Number.isInteger(hero.cost) && hero.cost >= 0);
  assert.match(hero.sprite, /^[\x20-\x7e\n]+$/);
  const g = new NightGame(427, hero.id, { terrain: false, fireMode: 'auto' }); g.start();
  g.enemies = []; g.spawnClock = g.nextBossAt = g.nextMegaAt = 1e8; g.rosterBossIndex = 1e6; g.player.invulnerable = 1e8;
  assert.equal(g.inventory(true).length, 1);
  for (const radius of [60, 110, 180, 260]) for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI / 12, e = g.spawn('ghoul', g.player.x + Math.cos(angle) * radius, g.player.y + Math.sin(angle) * radius); e.speed = 0;
  }
  for (let i = 0; i < 8 * 60; i++) { g.update(1 / 60); if (g.status === 'upgrading') g.choose(0); }
  assert.ok(g.kills > 0, hero.name + ' can earn the first XP with the starting weapon');
  const resumed = NightSave.restore(clone(NightSave.capture(g)));
  assert.ok(resumed, hero.name + ' resumes'); assert.equal(resumed.character.id, hero.id);
  assert.equal(resumed.player.hp, g.player.hp); assert.deepEqual(resumed.levels, g.levels);
}
const renamed = Object.fromEntries(['witch', 'warden', 'hunter', 'ripley', 'shepard', 'samus', 'mando', 'scout', 'plague', 'duelist'].map(id => [id, heroData.find(hero => hero.id === id).name]));
for (const [id, name] of Object.entries(renamed)) {
  const g = new NightGame(427, id); g.start(); const save = clone(NightSave.capture(g)); save.version = 6;
  const restored = NightSave.restore(save); assert.ok(restored); assert.equal(restored.character.name, name);
}
const values = new Map(), storage = { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
const p = new NightProgress(storage); p.profile.meta.gold = 10000; p.profile.heroes.unlocked.push('ripley', 'witch'); p.profile.character = 'witch'; storage.setItem('ascii-night-progress-v2', JSON.stringify(p.profile));
const shop = new NightProgress(storage); assert.ok(shop.isHeroUnlocked('ripley')); assert.ok(shop.isHeroUnlocked('witch')); assert.equal(shop.profile.character, 'witch');
assert.ok(shop.purchaseHero('root')); assert.equal(shop.profile.meta.gold, 5000); assert.equal(shop.purchaseHero('root'), false);
assert.ok(shop.purchaseHero('cryptoscam')); shop.savePreferences('cryptoscam', 'auto', 6000);
const loaded = new NightProgress(storage); assert.ok(loaded.isHeroUnlocked('root')); assert.ok(loaded.isHeroUnlocked('cryptoscam')); assert.equal(loaded.profile.character, 'cryptoscam');
const investor = new NightGame(427, 'cryptoscam'); investor.awardGold(100); assert.equal(investor.goldEarned, 54, 'The investor keeps its 20% gold bonus with the lower global income');
console.log('PASS: exact 30-hero roster, viable starting weapons, ASCII portraits, old character IDs, checkpoint migration, retained purchases, new unlocks and Cryptoscam gold bonus.');
