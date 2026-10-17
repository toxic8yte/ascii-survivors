(function (root) {
  'use strict';
  const content = root.NightContentData || require('./content-data.js');
  const roster = root.NightEnemyData || require('./enemy-roster.js');
  // description is the editable source; text remains a compatibility alias.
  const describe = row => ({ ...row, text: row.description });
  const ENEMIES = Object.fromEntries(content.legacyEnemies.map(({ id, ...row }) => [id, describe(row)]));
  for (const row of roster) {
    const boss = ['boss', 'finalBoss'].includes(row.rank), stats = row.stats;
    ENEMIES[row.id] = { title: row.name, description: row.description, text: row.description, roster: true, rank: row.rank, role: row.role, at: row.firstSecond, weight: 12, hp: stats.maxHealth * (boss ? 2 : 4), speed: stats.moveSpeed * 65, radius: stats.collisionRadius, damage: stats.damage, xp: stats.experience, knockbackResistance: stats.knockbackResistance, spawnCost: stats.spawnCost, movement: { ...row.movement }, traits: [...row.traits], ai: row.movement.type === 'charger' ? 'charge' : row.movement.type === 'wavy' ? 'weave' : row.movement.type, ...(row.movement.type === 'charger' ? { skill: 4.1 } : {}), boss, mega: row.rank === 'finalBoss', ink: row.visual.ink, glyph: row.visual.glyph[0], sprite: row.visual.glyph };
    if (row.summon) ENEMIES[row.id].summon = { ...row.summon };
    if (row.visual.frames) ENEMIES[row.id].frames = [...row.visual.frames];
  }
  const items = new Map([...content.weapons, ...content.passives].map(row => [row.id, row]));
  const UPGRADES = [...new Set([...content.upgradeOrder, ...items.keys()])].map(id => describe(items.get(id)));
  const EXTRA_WEAPONS = content.weapons.filter(row => Number.isFinite(row.cooldown)).map(row => describe({ id: row.id, title: row.title, icon: row.icon, cooldown: row.cooldown, behavior: row.behavior, projectile: row.projectile, description: row.description }));
  const catalog = {
    enemies: ENEMIES, upgrades: UPGRADES, heroes: content.heroes.map(describe),
    permanents: content.permanents.map(describe), extraWeapons: EXTRA_WEAPONS,
    evolutions: content.evolutions.map(describe), features: content.features.map(describe)
  };
  const freeze = object => {
    if (object && typeof object === 'object' && !Object.isFrozen(object)) {
      for (const value of Object.values(object)) freeze(value);
      Object.freeze(object);
    }
    return object;
  };
  root.NightCatalog = freeze(catalog);
  if (typeof module !== 'undefined' && module.exports) module.exports = root.NightCatalog;
})(typeof globalThis !== 'undefined' ? globalThis : window);
