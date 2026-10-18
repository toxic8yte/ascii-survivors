(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('screen'), arena = $('arena'), shell = document.querySelector('.game-shell');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new NightRenderer(canvas, reducedMotion);
  let storage = null; try { storage = localStorage; } catch (_) {}
  const progress = new NightProgress(storage);
  let savedRun = progress.loadRun(), lastSavedElapsed = 0, bestiaryWasRunning = false, grimoireWasRunning = false, mapWasRunning = false, sandboxWasRunning=false;
  let selectedCharacter = progress.profile.character;
  let fireModePreference = progress.profile.fireMode;
  $('enemy-limit').value = progress.profile.enemyLimit;
  function options() { return { map:$('stage-select').value,fireMode:fireModePreference, stressMode:$('stress-mode').checked, sandboxMode:$('sandbox-mode').checked, sandbox:{weapon:$('sandbox-weapon').value,rank:Number($('sandbox-rank').value),passive:$('sandbox-passive').value,passiveRank:Number($('sandbox-passive-rank').value),evolved:$('sandbox-evolved').checked,enemy:$('sandbox-enemy').value,count:Number($('sandbox-count').value),invulnerable:$('sandbox-invulnerable').checked,arena:$('sandbox-arena').checked}, enemyLimit:Number($('enemy-limit').value),meta:progress.profile.meta.ranks }; }
  let game = new NightGame(Date.now(), selectedCharacter, options()), keys = new Set();
  const equipmentTooltip = document.createElement('div'); equipmentTooltip.id = 'equipment-tooltip'; equipmentTooltip.className = 'equipment-tooltip'; equipmentTooltip.setAttribute('role', 'tooltip'); equipmentTooltip.hidden = true; shell.append(equipmentTooltip);
  let tooltipAnchor = null, previewWeapon = null;
  function syncWeaponHighlight() {
    const id = previewWeapon || (game.fireMode==='manual'?game.selectedWeapon:null);
    if (renderer.highlightWeapon !== id) { renderer.highlightWeapon = id; dirty = true; }
    for (const slot of $('loadout').querySelectorAll('[data-item]')) slot.classList.toggle('weapon-highlighted', slot.dataset.item === id);
  }
  function hideEquipmentTooltip() {
    tooltipAnchor?.removeAttribute('aria-describedby'); tooltipAnchor = null; equipmentTooltip.hidden = true;
    previewWeapon = null; syncWeaponHighlight();
  }
  function positionEquipmentTooltip() {
    if (!tooltipAnchor || equipmentTooltip.hidden) return;
    const rect = tooltipAnchor.getBoundingClientRect(), box = equipmentTooltip.getBoundingClientRect();
    equipmentTooltip.style.left = Math.max(10, Math.min(rect.left, innerWidth - box.width - 10)) + 'px';
    const top = rect.top - box.height - 10;
    equipmentTooltip.style.top = Math.max(10, Math.min(top >= 10 ? top : rect.bottom + 10, innerHeight - box.height - 10)) + 'px';
  }
  function showEquipmentTooltip(anchor) {
    if (!anchor || anchor.disabled) return;
    hideEquipmentTooltip();
    const u = NightUpgrades.find(u => u.id === anchor.dataset.item), info = u && (u.weapon ? game.weaponInfo(u.id) : u);
    const title = document.createElement('strong'), detail = document.createElement('small'), description = document.createElement('p');
    title.textContent = info ? info.icon + ' ' + info.title : 'Режим огня';
    detail.textContent = u ? (u.weapon ? 'ОРУЖИЕ · ' + NightCatalog.rarities[u.rarity].title : 'ПАССИВКА') + (u.kind !== 'ОРУЖИЕ' ? ' · ' + u.kind : '') + ' · ' + game.levels[u.id] + '/' + u.max : game.fireMode === 'manual' ? 'РУЧНОЙ · ВЫБРАНО ОРУЖИЕ КРАСНЫМ' : 'АВТО · ВСЁ ОРУЖИЕ АТАКУЕТ САМО';
    description.textContent = info ? u.description + (info !== u && info.description !== u.description ? '\n\nЭВОЛЮЦИЯ: ' + info.description : '') + (u.weapon && game.fireMode === 'manual' ? '\n1–5 — выбор оружия; F или ЛКМ — атака.' : '') : 'M переключает режим. В ручном режиме выбери слот 1–5 и атакуй кнопкой F или ЛКМ. Курсор задаёт направление.';
    equipmentTooltip.replaceChildren(title, detail, description);
    equipmentTooltip.dataset.rarity = u?.rarity || 'common'; equipmentTooltip.hidden = false;
    tooltipAnchor = anchor; anchor.setAttribute('aria-describedby', equipmentTooltip.id);
    previewWeapon = u?.weapon ? u.id : null; syncWeaponHighlight();
    positionEquipmentTooltip();
  }
  for (const region of [$('loadout'), $('passive-loadout'), $('fire-mode')]) {
    const target = event => event.target.closest('[data-item], #fire-mode');
    region.addEventListener('pointerover', e => { const anchor = target(e); if (anchor && anchor !== tooltipAnchor) showEquipmentTooltip(anchor); });
    region.addEventListener('pointerout', e => { if (tooltipAnchor && !tooltipAnchor.contains(e.relatedTarget)) hideEquipmentTooltip(); });
    region.addEventListener('focusin', e => showEquipmentTooltip(target(e)));
    region.addEventListener('focusout', hideEquipmentTooltip);
  }
  window.addEventListener('resize', positionEquipmentTooltip); document.addEventListener('scroll', positionEquipmentTooltip, true);
  let camera = { x: game.player.x, y: game.player.y }, pointer = { x: 0, y: 0, id: null };
  let last = 0, accumulator = 0, lastHUD = 0, previousStatus = '', offersLevel = 0;
  let fpsFrames = 0, fpsSince = 0, displayFPS = 0, dirty = true;
  let noticeUntil = 0, best = progress.profile.best, lastWave = 1;
  const frameTimes = new Float32Array(180), records = [];
  let frameIndex = 0, sampleCount = 0, frameMean = 0, frameP95 = 0, simulationMS = 0, renderMS = 0, lastRecord = -1;
  let mouseFiring = false, touchFiring = false;
  let referenceView = 'recipes';
  let expandedView = false, nativeFullscreen = false;
  const mouseAim = { x: .5, y: .2, active: false };
  const textCache = new Map(), equipment = new Map();
  if (best && Number.isFinite(best.time)) $('best').textContent = formatTime(best.time) + ' / ' + (best.kills || 0) + ' ИЗГНАНО';
  $('arsenal-note').textContent = '5 СЛОТОВ ОРУЖИЯ + 5 ПАССИВОК · ОРУЖИЕ: ' + NightUpgrades.filter(u => u.weapon).length + ' · ЭВОЛЮЦИИ: ' + NightCatalog.evolutions.length + ' · РЕЦЕПТЫ В НЕКРОНОМИКОНЕ';
  canvas.tabIndex = 0;

  function formatTime(t) { return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
  function text(id, value) { if (textCache.get(id) !== value) { $(id).textContent = value; textCache.set(id, value); } }
  function preferences() { if(!game.stressMode)progress.savePreferences(selectedCharacter, fireModePreference, Number($('enemy-limit').value)); }
  function saveCheckpoint() {
    if (game.stressMode || !['running', 'paused', 'upgrading', 'reward'].includes(game.status)) return false;
    const success = progress.checkpoint(game); lastSavedElapsed = game.elapsed;
    text('save-status', success ? 'ПРОГРЕСС СОХРАНЁН' : 'НЕ УДАЛОСЬ СОХРАНИТЬ: ХРАНИЛИЩЕ НЕДОСТУПНО');
    return success;
  }
  function progressSummary() {
    $('continue-box').hidden = !savedRun;
    if (savedRun) text('continue-summary', savedRun.character.name + ' · '+savedRun.map.title+' · ' + formatTime(savedRun.elapsed) + ' · УР. ' + savedRun.level + ' · ' + Math.ceil(savedRun.player.hp) + ' HP');
    text('start', savedRun ? 'НОВЫЙ ЗАБЕГ →' : 'ВОЙТИ В НОЧЬ →');
    const p = progress.profile;
    text('meta-open', 'НАСЛЕДИЕ · ' + p.meta.gold + ' ЗОЛОТА');
    text('progress-summary', 'ЗАБЕГОВ: ' + p.runs + ' · ИЗГНАНО: ' + p.kills + ' · БОССОВ: ' + p.bossKills + ' · СУНДУКОВ: ' + p.chestsOpened + (p.best ? ' · РЕКОРД: ' + formatTime(p.best.time) : ''));
    updateFeatureButtons();
  }
  function updateFeatureButtons() {
    for (const [id, featureId] of [['bestiary-open', 'bestiary'], ['grimoire-open', 'necronomicon'], ['map-open', 'treasureMap']]) {
      const feature = NightCatalog.features.find(f => f.id === featureId), owned = progress.isFeatureUnlocked(featureId) || game.stressMode;
      text(id, (featureId === 'treasureMap' ? 'КАРТА' : feature.title.toUpperCase()) + (owned ? '' : ' · ' + feature.cost)); $(id).classList.toggle('feature-locked', !owned); $(id).title = feature.title + (owned ? '' : ': ' + feature.cost + ' золота');
    }
  }
  function accessFeature(id) {
    progress.profile = progress.loadProfile();
    if (game.stressMode || progress.isFeatureUnlocked(id)) return true;
    const feature = NightCatalog.features.find(f => f.id === id);
    if (game.status === 'running') { clearInput(); game.pause(); saveCheckpoint(); updateHUD(); }
    showMeta(); $('meta-shop').showModal();
    text('meta-message', feature.title + ' открывается навсегда за ' + feature.cost + ' золота. Покупки доступны между забегами.'); return false;
  }
  function resumeSavedRun() {
    const restored = progress.loadRun();
    if (!restored) { savedRun = null; progressSummary(); notify('Сохранение недоступно. Можно начать новый забег.'); return; }
    game = restored; selectedCharacter = game.character.id; fireModePreference = game.fireMode;
    $('stress-mode').checked = false; $('sandbox-mode').checked=false;$('stage-select').value=game.mapId; $('enemy-limit').value = game.enemyLimit; preferences();
    resetMetrics(); clearInput(); camera = { x: game.player.x, y: game.player.y }; last = accumulator = 0;
    previousStatus = ''; offersLevel = 0; lastWave = game.wave; lastSavedElapsed = game.elapsed;
    if (game.status === 'paused') game.pause();
    resize(); updateCharacterDetails(); updateHUD();
    if (game.status === 'running') canvas.focus({ preventScroll: true });
    notify('ЗАБЕГ ВОССТАНОВЛЕН · ' + formatTime(game.elapsed));
  }
  function openBestiary() {
    if (!accessFeature('bestiary')) return;
    bestiaryWasRunning = game.status === 'running'; if (bestiaryWasRunning) { clearInput(); game.pause(); saveCheckpoint(); updateHUD(); }
    const seen = new Set([...progress.profile.seen, ...game.encountered]), fragment = document.createDocumentFragment();
    for (const [kind, enemy] of Object.entries(NightEnemies)) {
      const card = document.createElement('article'); card.className = 'enemy-card' + (enemy.boss ? ' boss' : ''); card.dataset.kind = kind;
      const sprite = document.createElement('pre'); sprite.textContent = enemy.sprite; sprite.setAttribute('aria-hidden', 'true');
      const title = document.createElement('h3'); title.textContent = enemy.title;
      const description = document.createElement('p'); description.textContent = enemy.description;
      const hint = document.createElement('small'); hint.textContent = (enemy.mega ? 'МЕГАБОСС · С ' + formatTime(enemy.at ?? 600) : enemy.boss ? 'БОСС' + (enemy.roster ? ' · С ' + formatTime(enemy.at) : '') : 'ВОЗРАСТ ВОЛН ' + formatTime(enemy.at)) + (enemy.roster ? ' · ' + Math.round(enemy.hp) + ' БАЗОВЫХ HP · СОПРОТИВЛЕНИЕ ' + Math.round(enemy.knockbackResistance * 100) + '%' : '') + ' · ' + (seen.has(kind) ? 'ВСТРЕЧЕН' : 'ЕЩЁ ВПЕРЕДИ');
      card.append(sprite, title, description, hint); fragment.append(card);
    }
    $('bestiary-list').replaceChildren(fragment); $('bestiary').showModal();
  }
  function showMeta() {
    progress.profile = progress.loadProfile(); text('meta-gold', progress.profile.meta.gold + ' ЗОЛОТА');
    const fragment = document.createDocumentFragment();
    for (const upgrade of NightMeta) {
      const rank = progress.profile.meta.ranks[upgrade.id], cost = upgrade.cost * (rank + 1) ** 2, card = document.createElement('article'); card.className = 'meta-card';
      const title = document.createElement('h3'); title.textContent = upgrade.icon + ' ' + upgrade.title;
      const info = document.createElement('p'); info.textContent = upgrade.description;
      const button = document.createElement('button'); button.type = 'button'; button.dataset.buy = upgrade.id; button.dataset.rank = rank;
      button.textContent = rank >= upgrade.max ? 'МАКСИМУМ · ' + rank + '/' + upgrade.max : 'РАНГ ' + rank + '/' + upgrade.max + ' → КУПИТЬ ЗА ' + cost;
      button.disabled = game.status !== 'ready' || rank >= upgrade.max || progress.profile.meta.gold < cost || !progress.available;
      card.append(title, info, button); fragment.append(card);
    }
    for (const feature of NightCatalog.features) {
      const owned = progress.isFeatureUnlocked(feature.id), card = document.createElement('article'); card.className = 'meta-card feature-card';
      const title = document.createElement('h3'); title.textContent = feature.icon + ' ' + feature.title;
      const description = document.createElement('p'); description.textContent = feature.description;
      const button = document.createElement('button'); button.type = 'button'; button.dataset.feature = feature.id;
      button.textContent = owned ? 'ОТКРЫТО НАВСЕГДА' : 'ОТКРЫТЬ ЗА ' + feature.cost;
      button.disabled = owned || game.status !== 'ready' || progress.profile.meta.gold < feature.cost || !progress.available;
      card.append(title, description, button); fragment.append(card);
    }
    $('meta-grid').replaceChildren(fragment);
  }
  function openGrimoire() {
    if (!accessFeature('necronomicon')) return;
    grimoireWasRunning = game.status === 'running';
    if (grimoireWasRunning) { clearInput(); game.pause(); saveCheckpoint(); updateHUD(); }
    const fragment = document.createDocumentFragment();
    for (const recipe of NightCatalog.evolutions) {
      const done = game.evolutions.has(recipe.id), ready = game.canEvolve(recipe), card = document.createElement('article');
      card.className = 'recipe-card' + (done ? ' complete' : ready ? ' ready' : '');
      const title = document.createElement('h3'); title.textContent = recipe.icon + ' ' + recipe.title;
      const requirements = [recipe.weapon, ...(recipe.weapons || [])].map(id => [id, NightUpgrades.find(u => u.id === id).max]).concat(Object.entries(recipe.passives));
      const ingredients = document.createElement('ul');
      for (const [id, required] of requirements) {
        const u = NightUpgrades.find(u => u.id === id), row = document.createElement('li'), rank = game.levels[id];
        row.className = done || rank >= required ? 'has-ingredient' : '';
        row.textContent = u.icon + ' ' + u.title + ' · ' + (done && game.isConsumed(id) ? 'ОБЪЕДИНЕНО' : rank + '/' + u.max + (required === u.max ? ' МАКС.' : ' · НУЖНО ' + required + '+'));
        if (u.baseTitle) row.title = u.baseTitle;
        ingredients.append(row);
      }
      const description = document.createElement('p'); description.textContent = recipe.description;
      const state = document.createElement('small'); state.textContent = done ? 'ПОЛУЧЕНО В ЭТОМ ЗАБЕГЕ' : ready ? 'КОМПЛЕКТ ГОТОВ · НАЙДИ СУНДУК ЭВОЛЮЦИИ' : 'СОБЕРИ КОМПЛЕКТ';
      card.append(title, ingredients, description, state); fragment.append(card);
    }
    $('recipe-list').replaceChildren(fragment); showReference(referenceView); $('grimoire').showModal();
  }
  function showReference(view) {
    if (!['recipes', 'weapons', 'passives'].includes(view)) return;
    referenceView = view;
    for (const id of ['recipes', 'weapons', 'passives']) $('reference-' + id).setAttribute('aria-pressed', String(id === view));
    $('recipe-list').hidden = view !== 'recipes'; $('content-reference').hidden = view === 'recipes';
    if (view === 'recipes') return;
    const fragment = document.createDocumentFragment();
    for (const item of NightUpgrades.filter(row => Boolean(row.weapon) === (view === 'weapons'))) {
      const card = document.createElement('article'); card.className = 'recipe-card reference-card'; card.dataset.item = item.id;
      const title = document.createElement('h3'); title.textContent = item.icon + ' ' + item.title;
      const description = document.createElement('p'); description.textContent = item.description;
      const rank = document.createElement('small'); rank.textContent = (item.weapon ? 'ОРУЖИЕ' : item.kind) + ' · ' + game.levels[item.id] + '/' + item.max + (game.isConsumed(item.id) ? ' · ОБЪЕДИНЕНО' : '');
      if (item.baseTitle) title.title = item.baseTitle;
      card.append(title, description, rank); fragment.append(card);
      const recipes=NightCatalog.evolutions.filter(r=>r.weapon===item.id||r.weapons?.includes(item.id)||Object.hasOwn(r.passives,item.id));
      if(recipes.length){const links=document.createElement('p');links.className='upgrade-recipe';links.textContent='ЭВОЛЮЦИИ: '+recipes.map(r=>r.title).join(' · ');card.append(links);}
    }
    $('content-reference').replaceChildren(fragment);
  }
  function openMap() {
    if (!accessFeature('treasureMap')) return;
    mapWasRunning = game.status === 'running'; if (mapWasRunning) { clearInput(); game.pause(); saveCheckpoint(); updateHUD(); }
    const ns = 'http://www.w3.org/2000/svg', svg = $('treasure-map'); svg.replaceChildren();
    svg.setAttribute('viewBox', '0 0 ' + game.width + ' ' + game.height);svg.setAttribute('aria-label',game.map.title+' · карта сокровищ');
    const marker = (x, y, glyph, color, label) => {
      const dot = document.createElementNS(ns, 'text'); dot.setAttribute('x', x); dot.setAttribute('y', y); dot.setAttribute('fill', color); dot.setAttribute('font-size', '290'); dot.setAttribute('text-anchor', 'middle'); dot.textContent = glyph;
      const title = document.createElementNS(ns, 'title'); title.textContent = label; dot.append(title); svg.append(dot);
    };
    if(game.mapId==='forest'){
      const shape=(tag,attrs)=>{const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);svg.append(node);};
      for(let x=0;x<=game.width;x+=3200)shape('line',{x1:x,y1:0,x2:x,y2:game.height,stroke:'#6c6e43','stroke-width':70});
      for(let y=0;y<=game.height;y+=2400)shape('line',{x1:0,y1:y,x2:game.width,y2:y,stroke:'#6c6e43','stroke-width':70});
      for(let x=0;x<=game.width;x+=3200)for(let y=0;y<=game.height;y+=2400){shape('ellipse',{cx:x+940,cy:y-600,rx:190,ry:110,fill:'#43817e'});shape('rect',{x:x+520,y:y+400,width:360,height:240,fill:'none',stroke:'#76945c','stroke-width':35});}
    }
    for (const cache of game.treasures) if (!game.treasuresTaken.has(cache.id)) marker(cache.x, cache.y, 'X', '#edc77d', 'Тайник ' + (cache.id + 1));
    for (const chest of game.chests) marker(chest.x, chest.y, '$', '#c49be2', 'Оставленный сундук');
    for (const crate of game.supplyCrates) if (!game.supplyTaken.has(crate.id)) marker(crate.x, crate.y, crate.kind === 'heal' ? '+' : crate.kind === 'level' ? '^' : 'U', crate.kind === 'heal' ? '#b6dfad' : crate.kind === 'level' ? '#edc77d' : '#6fbbff', crate.kind === 'heal' ? 'Ящик: 30 здоровья' : crate.kind === 'level' ? 'Ящик: бесплатный уровень' : 'Ящик: собрать все кристаллы');
    marker(game.player.x, game.player.y, '@', '#f47561', 'Ты здесь');
    text('map-summary', 'ТАЙНИКОВ: ' + (12 - game.treasuresTaken.size) + '/12 · ПРИПАСОВ: ' + (game.supplyCrates.length - game.supplyTaken.size) + ' · СУНДУКОВ БОССОВ: ' + game.chests.filter(c => !c.treasure).length + ' · ТВОЯ ПОЗИЦИЯ: ' + Math.round(game.player.x) + ' : ' + Math.round(game.player.y));
    $('world-map').showModal();
  }
  function resize() {
    renderer.resize(arena.clientWidth, arena.clientHeight, devicePixelRatio || 1);
    game.arenaRadius = Math.max(150, Math.min(240, Math.min(renderer.width / renderer.scaleX, renderer.height / renderer.scaleY) * .42));
    game.spawnRadius = Math.max(510, Math.min(920, Math.hypot(renderer.cols * 10, renderer.rows * 16) / 2 + 70));
    renderer.render(game, camera); dirty = true;
  }
  function setExpandedView(expanded) {
    expandedView = expanded;
    shell.classList.toggle('is-expanded', expanded); document.body.classList.toggle('expanded-view', expanded);
    $('expand-view').setAttribute('aria-pressed', String(expanded));
    $('expand-view').setAttribute('aria-label', expanded ? 'Вернуть обычный размер поля' : 'Развернуть игровое поле');
    text('view-label', expanded ? 'Свернуть' : 'На весь экран');
    resize();
  }
  function toggleExpandedView() {
    clearInput(); setExpandedView(!expandedView);
    if (expandedView && document.documentElement.requestFullscreen) {
      // Keep the window-sized view usable even if an embedded browser delays or rejects fullscreen.
      document.documentElement.requestFullscreen().catch(() => {
        if (expandedView) notify('ПОЛЕ РАЗВЁРНУТО НА ВСЁ ОКНО · G ИЛИ ESC — ВЕРНУТЬ');
      });
    } else if (!expandedView && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (game.status === 'running') canvas.focus({ preventScroll: true });
  }
  function buildCharacters() {
    text('hero-count', 'ГЕРОИ: ' + NightCharacters.length);
    const fragment = document.createDocumentFragment();
    for (const c of NightCharacters) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'character-card'; button.dataset.character = c.id;
      button.setAttribute('aria-label', c.name + ', ' + c.role); button.setAttribute('aria-pressed', String(c.id === selectedCharacter));
      const sprite = document.createElement('pre'); sprite.textContent = c.sprite; sprite.setAttribute('aria-hidden', 'true');
      const name = document.createElement('b'); name.textContent = c.name;
      const role = document.createElement('small'); role.textContent = c.role;
      button.append(sprite, name, role); fragment.append(button);
    }
    $('characters').replaceChildren(fragment); updateCharacterDetails();
    for (let i = 0; i < 5; i++) {
      const slot = document.createElement('button'), key = document.createElement('kbd'), icon = document.createElement('i'), name = document.createElement('span'), rank = document.createElement('b');
      slot.type = 'button'; slot.dataset.slot = i + 1; key.textContent = i + 1; slot.append(key, icon, name, rank);
      $('loadout').append(slot); equipment.set(i, { slot, rank, name, icon });
    }
  }
  function resetMetrics() {
    records.length = 0; sampleCount = frameIndex = displayFPS = 0; frameMean = frameP95 = simulationMS = renderMS = 0; fpsSince = fpsFrames = 0; lastRecord = -1; mouseAim.active = false;
  }
  function recordMetrics() {
    if (game.status !== 'running') return;
    const second = Math.floor(game.elapsed);
    if (second === lastRecord) return; lastRecord = second;
    const sorted = Array.from(frameTimes.subarray(0, sampleCount)).sort((a, b) => a - b);
    frameMean = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
    frameP95 = sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] || 0;
    records.push({ seconds: +game.elapsed.toFixed(2), simulationSeconds: +game.time.toFixed(2), pressureSeconds: +game.pressureTime.toFixed(2), enemies: game.enemies.length, peakEnemies: game.peakEnemies, fps: displayFPS, frameMS: +frameMean.toFixed(2), frameP95MS: +frameP95.toFixed(2), simulationMS: +simulationMS.toFixed(2), renderMS: +renderMS.toFixed(2), drops: game.gems.length, projectiles: game.shots.length + game.boomerangs.length + game.relics.length + game.enemyShots.length });
    if (records.length > 3600) records.shift();
  }
  function selectWeapon(number) {
    if (game.status === 'upgrading' || game.status === 'reward') return;
    if (!game.selectSlot(number)) { notify('В этом слоте пока нет оружия — найди его при повышении уровня.'); return; }
    updateHUD(); if (tooltipAnchor) showEquipmentTooltip(tooltipAnchor); dirty = true;
  }
  function toggleFireMode() {
    fireModePreference = game.fireMode === 'auto' ? 'manual' : 'auto'; game.setFireMode(fireModePreference); mouseFiring = touchFiring = false; keys.delete('KeyF');
    updateHUD(); if (tooltipAnchor) showEquipmentTooltip(tooltipAnchor); dirty = true;
    notify(game.fireMode === 'manual' ? 'РУЧНОЙ: 1–5 оружие · ЛКМ / F атака · курсор — прицел.' : 'АВТО: всё найденное оружие атакует само.');
    preferences();
  }
  function exportMetrics() {
    const payload = { version: 2, mode: game.sandboxMode ? 'sandbox' : game.stressMode ? 'stress' : 'survival', map:game.mapId, character: game.character.id, levels: { ...game.levels }, meta: { ...game.meta }, evolutions: [...game.evolutions], enemyLimit: game.enemyLimit, elapsed: game.elapsed, simulationSeconds: game.time, pressureSeconds: game.pressureTime, peakEnemies: game.peakEnemies, kills: game.kills, sampleWindow: 'Performance: last 3600 session seconds. Combat: 180 windows of 10 simulated seconds and persistent totals.', combat: game.combat.snapshot(), samples: records };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'ascii-survivors-metrics.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function updateCombatMetrics(plan) {
    const c = game.combat, sample = c.history[c.history.length - 1] || c.current, seconds = Math.max(sample.seconds, 1 / 60);
    const round = value => Math.round(value).toLocaleString('ru-RU');
    const from = sample.from ?? c.since + c.total.seconds - c.current.seconds, to = sample.to ?? c.since + c.total.seconds;
    text('combat-since', 'Замеры с ' + formatTime(c.since) + ' · срез ' + formatTime(from) + '–' + formatTime(to));
    $('combat-mode').hidden = !game.stressMode;
    text('combat-mode', 'НАГРУЗОЧНЫЙ ТЕСТ: неуязвимость и весь арсенал на максимуме. Это не баланс обычного забега.');
    text('metric-wave', game.sandboxMode?'Песочница / выбранные цели':plan.title + ' / ' + plan.phaseTitle); text('metric-nearby', c.near + ' / ' + (game.stressMode ? 'предел ' + game.enemyLimit : plan.target));
    text('metric-dps', round(sample.damage / seconds)); text('metric-kps', (sample.kills / seconds).toFixed(1));
    text('metric-rewards', round(sample.xp) + ' / ' + round(sample.gold)); text('metric-health', round(sample.healing) + ' / ' + round(sample.hurt));
    text('metric-overkill', round(sample.overkill)); text('metric-hearts', sample.heartsSpawned + ' / ' + sample.heartsTaken);
    const rows = Object.entries(c.weapons).sort((a, b) => b[1].damage - a[1].damage);
    const key = rows.map(([id, row]) => id + ':' + Math.round(row.damage) + ':' + row.kills).join('|') + ':' + Math.floor(c.total.seconds);
    if ($('combat-weapons').dataset.content === key) return;
    const fragment = document.createDocumentFragment();
    for (const [id, row] of rows) {
      const item = document.createElement('div'), label = document.createElement('span'), value = document.createElement('b');
      label.textContent = id === 'other' ? 'Прочий урон' : game.weaponInfo(id)?.title || id;
      value.textContent = round(row.damage / Math.max(c.total.seconds, 1 / 60)) + ' DPS · ' + Math.round(row.damage / Math.max(c.total.damage, 1) * 100) + '%';
      item.title = 'Урон ' + round(row.damage) + ' · лишний ' + round(row.overkill) + ' · убийств ' + row.kills;
      item.append(label, value); fragment.append(item);
    }
    if (!rows.length) { const empty = document.createElement('p'); empty.textContent = 'Урон появится после первого попадания.'; fragment.append(empty); }
    $('combat-weapons').replaceChildren(fragment); $('combat-weapons').dataset.content = key;
  }
  function configureRun(persist = true) {
    if (game.status !== 'ready') return;
    game = new NightGame(Date.now(), selectedCharacter, options()); if (persist) preferences(); resetMetrics(); resize(); updateCharacterDetails(); updateHUD();
  }
  function buildSandbox() {
    const add=(select,value,label)=>{const option=document.createElement('option');option.value=value;option.textContent=label;$(select).append(option);};
    for(const hero of NightCharacters)add('sandbox-hero',hero.id,hero.name);
    for(const u of NightUpgrades)add(u.weapon?'sandbox-weapon':'sandbox-passive',u.id,u.title);
    for(const [id,e]of Object.entries(NightEnemies))add('sandbox-enemy',id,e.title+(e.boss?' · БОСС':''));
    updateSandboxPreview();
  }
  function updateSandboxPreview() {
    const weapon=$('sandbox-weapon').value==='starter'?NightCharacters.find(c=>c.id===$('sandbox-hero').value)?.weapon:$('sandbox-weapon').value,recipe=NightCatalog.evolutions.find(r=>r.weapon===weapon||r.weapons?.includes(weapon));
    $('sandbox-evolution-description').hidden=!$('sandbox-evolved').checked;
    text('sandbox-evolution-description',recipe?recipe.title+' · '+recipe.description+' Все ингредиенты рецепта выдаются для теста.':'Для выбранного оружия нет рецепта.');
    const enemy=NightEnemies[$('sandbox-enemy').value],passive=NightUpgrades.find(u=>u.id===$('sandbox-passive').value);
    $('sandbox-arena').disabled=!enemy?.boss;$('sandbox-count').disabled=Boolean(enemy?.boss&&$('sandbox-arena').checked);
    text('sandbox-enemy-art',enemy?.sprite || ' ._.\n[+|+]\n / \\');text('sandbox-enemy-description',enemy?.description || 'Неподвижная цель с 10 000 HP. После зачистки выбранные цели появятся снова.');
    for(const option of $('sandbox-passive-rank').options)option.disabled=Number(option.value)>(passive?.max||1);
    if(Number($('sandbox-passive-rank').value)>(passive?.max||1))$('sandbox-passive-rank').value='1';
  }
  function openSandbox() {
    if(!game.sandboxMode)return;
    sandboxWasRunning=game.status==='running';if(sandboxWasRunning){clearInput();game.pause();updateHUD();}
    $('sandbox-hero').value=selectedCharacter;updateSandboxPreview();$('sandbox-settings').showModal();
  }
  function updateCharacterDetails() {
    const c = game.character, weapon = game.weaponInfo(c.weapon);
    text('character-name', c.name + ' / ' + c.role); text('character-description', c.description);
    text('character-stats', game.player.maxHp + ' HP  /  ' + Math.round(game.speed) + ' СКОРОСТЬ  /  ' + game.dashCooldown.toFixed(2) + ' С РЫВОК');
    text('character-weapon', [c.weapon,...(c.extraWeapons || [])].map(id => { const w = game.weaponInfo(id); return w.icon + ' ' + w.title; }).join(' + '));
    for (const card of $('characters').children) {
      const hero = NightCharacters.find(c => c.id === card.dataset.character), owned = game.sandboxMode || progress.isHeroUnlocked(hero.id);
      card.setAttribute('aria-pressed', String(hero.id === selectedCharacter)); card.classList.toggle('hero-locked', !owned);
      let price = card.querySelector('.hero-price');
      if (!price) { price = document.createElement('span'); price.className = 'hero-price'; card.append(price); }
      price.textContent = game.sandboxMode ? 'ДОСТУПЕН В ТЕСТЕ' : owned ? 'ОТКРЫТ' : hero.cost + ' ЗОЛ.';
      card.setAttribute('aria-label', hero.name + ', ' + hero.role + ', ' + (game.sandboxMode ? 'доступен в песочнице' : owned ? 'открыт' : hero.cost + ' золота'));
    }
    const locked = !progress.isHeroUnlocked(c.id), purchase = $('unlock-hero');
    purchase.hidden = !locked || game.stressMode; purchase.disabled = progress.profile.meta.gold < c.cost || !progress.available;
    text('unlock-hero', 'ОТКРЫТЬ ЗА ' + c.cost + ' ЗОЛОТА' + (progress.profile.meta.gold < c.cost ? ' · ЕСТЬ ' + progress.profile.meta.gold : ''));
    $('start').disabled = locked && !game.stressMode;
  }
  function selectCharacter(id) {
    if (game.status !== 'ready' || !NightCharacters.some(c => c.id === id)) return;
    selectedCharacter = id; game = new NightGame(Date.now(), id, options()); resetMetrics(); resize(); updateCharacterDetails(); updateHUD();
    preferences();
  }
  function notify(message) {
    $('notice').textContent = message; $('notice').classList.add('visible'); noticeUntil = performance.now() + 3300;
  }
  function saveBest() {
    if (game.stressMode) return;
    progress.finish(game); best = progress.profile.best;
    if (savedRun?.runId === game.runId) savedRun = null;
    if (best) text('best', formatTime(best.time) + ' / ' + best.kills + ' ИЗГНАНО');
  }
  function showOffers() {
    $('upgrade-level').textContent = String(game.level).padStart(2, '0');
    const fragment = document.createDocumentFragment();
    game.offers.forEach((u, i) => {
      const card = document.createElement('button'); card.className = 'upgrade-card'; card.type = 'button'; card.dataset.choice = i;
      if (u.weapon) card.dataset.rarity = u.rarity;
      const part = (className, content) => { const el = document.createElement('span'); el.className = className; el.textContent = content; card.append(el); };
      part('upgrade-icon', u.icon);
      const badges = document.createElement('span'); badges.className = 'upgrade-badges';
      const badge = (className, label) => { const el = document.createElement('span'); el.className = className; el.textContent = label; badges.append(el); };
      badge(u.weapon ? 'badge-weapon' : 'badge-passive', u.weapon ? 'ОРУЖИЕ' : 'ПАССИВКА');
      if (!game.levels[u.id]) badge('badge-new', 'НОВОЕ');
      if (u.weapon) badge('badge-rarity', NightCatalog.rarities[u.rarity].title.toUpperCase());
      card.append(badges);
      if (u.kind !== 'ОРУЖИЕ') part('upgrade-kind', u.kind);
      part('upgrade-name', u.title); part('upgrade-description', u.description);
      const recipe = NightCatalog.evolutions.find(r => r.weapon === u.id || r.weapons?.includes(u.id));
      if (recipe) part('upgrade-recipe', 'СВЯЗКА: ' + Object.entries(recipe.passives).map(([id, rank]) => NightUpgrades.find(p => p.id === id).title + (rank > 1 ? ' МАКС.' : '')).concat([recipe.weapon, ...(recipe.weapons || [])].filter(id => id !== u.id).map(id => NightUpgrades.find(p => p.id === id).title + ' МАКС.')).join(' + '));
      part('upgrade-rank', 'СТУПЕНЬ ' + (game.levels[u.id] + 1) + ' / ' + u.max); part('upgrade-key', i + 1);
      fragment.append(card);
    });
    $('upgrade-cards').replaceChildren(fragment);
    updateOfferSelection();
    $('upgrade').focus({ preventScroll: true });
    offersLevel = game.level;
  }
  function updateOfferSelection() {
    for (const card of $('upgrade-cards').children) card.setAttribute('aria-pressed', String(Number(card.dataset.choice) === game.offerSelection));
    const selected = game.offers[game.offerSelection];
    $('upgrade-confirm').disabled = !selected;
    $('upgrade-banish').disabled = !selected || !game.banishesLeft;
    const wallet = game.goldAvailable;
    $('upgrade-reroll').disabled = !game.canReroll || wallet < game.rerollCost;
    text('upgrade-banish', 'ИЗГНАТЬ · ' + game.banishesLeft);
    text('upgrade-reroll', 'РЕРОЛЛ · ' + game.rerollCost + ' ЗОЛ.');
    text('upgrade-wallet', 'ЗОЛОТО ЗАБЕГА: ' + wallet + ' ЗОЛ.' + (!game.canReroll ? ' · Нет полного набора новых вариантов' : wallet < game.rerollCost ? ' · Не хватает золота на реролл' : ''));
    text('upgrade-selection', selected ? 'ВЫДЕЛЕНО: ' + selected.title : 'Сначала выдели карточку.');
  }
  function selectOffer(index) {
    if (game.selectOffer(index)) { updateOfferSelection(); saveCheckpoint(); }
  }
  function changeOffer(action) {
    if (!action()) return;
    if (game.status === 'upgrading') showOffers();
    saveCheckpoint(); updateHUD();
    if (game.status === 'running') canvas.focus({ preventScroll: true });
  }
  function showReward() {
    const reward = game.reward; if (!reward) return;
    if (reward.options) {
      text('reward-title', 'Выбери одну из трёх наград'); const fragment = document.createDocumentFragment();
      reward.options.forEach((option, index) => {
        const item = option.type === 'evolution' ? NightCatalog.evolutions.find(r => r.id === option.id) : option.type === 'upgrade' ? NightUpgrades.find(u => u.id === option.id) : { icon: option.type === 'gold' ? '[$]' : option.type === 'xp' ? '*' : '[#]', title: option.type === 'gold' ? (option.value*NightBalance.goldMultiplier*game.greed).toLocaleString('ru-RU',{maximumFractionDigits:2}) + ' золота' : option.type === 'xp' ? Math.floor(option.value*game.growth*game.xpEfficiency+game.xpCarry+1e-8) + ' опыта' : 'Три защитных заряда', description: option.type === 'shield' ? 'Поглощают три попадания в течение 30 секунд.' : 'Начисляется только после выбора.' };
        const card = document.createElement('button'); card.type = 'button'; card.className = 'reward-item reward-choice' + (option.type === 'evolution' ? ' evolved' : ''); card.dataset.rewardChoice = index;
        if(option.type==='upgrade'&&item.weapon)card.dataset.rarity=item.rarity;
        const icon = document.createElement('b'); icon.textContent = item.icon;
        const title = document.createElement('span'); title.textContent = item.title;
        const description = document.createElement('p'); description.textContent = item.description;
        const rank = document.createElement('small'); rank.textContent = (index + 1) + ' · ' + (option.type === 'evolution' ? 'ЭВОЛЮЦИЯ' : option.type === 'upgrade' ? (item.weapon?'ОРУЖИЕ':'ПАССИВКА')+' · '+option.rank+'/'+item.max : 'БОНУС');
        card.append(icon, title, description, rank); fragment.append(card);
      });
      $('reward-loot').replaceChildren(fragment); $('claim-reward').hidden = true;
      text('reward-summary', (reward.treasure ? 'Найден тайник' : NightEnemies[reward.source].title) + (game.stressMode?' · Тест: награды не начисляются.':' · Одна награда на выбор +'+(10*NightBalance.goldMultiplier*game.greed).toLocaleString('ru-RU',{maximumFractionDigits:2})+' золота за сундук.'));
      text('reward-hint', 'ВЫБОР МЫШЬЮ ИЛИ 1 / 2 / 3 · БОЙ НА ПАУЗЕ');
      $('reward-loot').querySelector('button')?.focus({ preventScroll: true }); return;
    }
    $('claim-reward').hidden = false; text('reward-hint', 'ENTER / ПРОБЕЛ · БОЙ НА ПАУЗЕ');
    text('reward-title', reward.items.some(item => item.evolution) ? 'Эволюция оружия!' : reward.items.length && reward.count > 1 ? 'Сундук: ' + reward.count + (reward.count === 5 ? ' наград!' : ' награды!') : 'Сундук поверженного босса');
    const fragment = document.createDocumentFragment();
    for (const item of reward.items) {
      const upgrade = item.evolution ? NightCatalog.evolutions.find(r => r.id === item.evolution) : NightUpgrades.find(u => u.id === item.id), card = document.createElement('div'); card.className = 'reward-item' + (item.evolution ? ' evolved' : '');
      const icon = document.createElement('b'); icon.textContent = upgrade.icon;
      const title = document.createElement('span'); title.textContent = upgrade.title;
      const rank = document.createElement('small'); rank.textContent = item.evolution ? 'ЭВОЛЮЦИЯ' : 'СТУПЕНЬ ' + item.rank + ' / ' + upgrade.max;
      card.title = upgrade.description;
      card.append(icon, title, rank); fragment.append(card);
    }
    $('reward-loot').replaceChildren(fragment);
    text('reward-summary', NightEnemies[reward.source].title + ' · +' + reward.xp + ' ОПЫТА · +' + Math.round(reward.heal) + ' HP' + (!reward.items.length ? ' · ВСЕ ДАРЫ УЖЕ МАКСИМАЛЬНЫ' : ''));
    $('claim-reward').focus({ preventScroll: true });
  }
  function claimReward(index) {
    if (!game.claimReward(index)) return;
    saveCheckpoint(); updateHUD(); if (game.status === 'running') canvas.focus({ preventScroll: true });
  }
  function updateHUD() {
    const p = game.player, status = game.status;
    const weapon = game.weaponInfo(game.selectedWeapon), manual = game.fireMode === 'manual';
    const ownedWeapons = game.inventory(true), passives = game.inventory(false);
    text('selected-weapon', (ownedWeapons.indexOf(game.selectedWeapon) % 5 + 1) + ' / ' + weapon.title.toUpperCase() + (game.selectedWeapon === 'blades' && game.levels.blades ? ' · КЛИНКОВ: ' + (game.levels.blades + game.levels.fork + (game.isEvolved('blades') ? 2 : 0)) : ''));
    text('weapon-page', 'ОРУЖИЕ ' + ownedWeapons.length + '/5' + (game.weaponPages > 1 ? ' · СТР. ' + (game.weaponPage + 1) + '/' + game.weaponPages + (game.stressMode ? ' · ТЕСТ' : ' · СТАРЫЙ НАБОР') : ''));
    $('weapons-prev').hidden = $('weapons-next').hidden = game.weaponPages <= 1;
    text('run-gold', 'ЗОЛОТО +' + game.goldAvailable);
    $('fire-mode').setAttribute('aria-pressed', String(manual));
    text('fire-mode', manual ? 'РУЧНОЙ ОГОНЬ [M]' : 'АВТОАТАКА [M]');
    $('fire-touch').hidden = !manual; $('stress-controls').hidden = !game.stressMode || game.sandboxMode;
    text('hero-label', game.character.name.toUpperCase() + ' / ЖИЗНЬ');
    text('fps', status === 'running' && displayFPS ? displayFPS + ' FPS / AUTO' : 'РЕНДЕР / AUTO');
    text('hp-text', (game.sandboxMode ? game.sandboxInvulnerable : game.stressMode) ? 'НЕУЯЗВИМОСТЬ' : Math.ceil(p.hp) + ' / ' + p.maxHp);
    $('hp-bar').style.width = (p.hp / p.maxHp * 100) + '%';
    $('xp-bar').style.width = Math.min(100, game.xp / game.xpNeed * 100) + '%';
    text('xp-text', 'ОПЫТ ' + game.xp + ' / ' + game.xpNeed + ' · КРИСТАЛЛЫ ' + Math.round(game.xpEfficiency * 100) + '%');
    text('timer', formatTime(game.elapsed)); text('enemy-count', game.enemies.length.toLocaleString('ru-RU'));
    text('kills', String(game.kills).padStart(3, '0')); text('level', String(game.level).padStart(2, '0'));
    text('stage',game.sandboxMode?'ПЕСОЧНИЦА / СВОБОДНЫЙ ТЕСТ':(game.stressMode?'ТЕСТ ДВИЖКА / ':'')+(status==='ready'?'БЕСКОНЕЧНАЯ НОЧЬ':'ВОЛНА '+game.wave));
    $('sandbox-open').hidden=!game.sandboxMode;$('sandbox-open-live').hidden=!game.sandboxMode||status==='ready';
    text('coords', Math.round(p.x) + ' : ' + Math.round(p.y));
    text('stage-description',game.map.description);
    text('map-label', game.map.title.toUpperCase()+' · ' + game.width.toLocaleString('ru-RU') + ' × ' + game.height.toLocaleString('ru-RU'));
    const boss = game.enemies.find(e => e.alive && e.boss);
    text('boss-name', boss ? boss.title + ' · ' + (boss.id === game.encounter?.bossId ? Math.ceil(boss.hp) + ' / ' + Math.ceil(boss.maxHp) + ' HP' : Math.ceil(boss.hp / boss.maxHp * 100) + '%') : '');
    const encounter = game.encounter;
    $('encounter-note').hidden = !encounter; arena.classList.toggle('has-encounter', Boolean(encounter));
    if (encounter) text('encounter-note', encounter.phase === 'warning' ? 'ПЕЧАТЬ ЗАМКНЁТСЯ ЧЕРЕЗ ' + Math.ceil(encounter.warningLeft) + ' С' : 'БОСС: ' + Math.ceil(boss?.hp || 0) + ' HP · СТЕНА: ' + Math.ceil(encounter.lockedLeft) + ' С · УБЕЙ БОССА, ЧТОБЫ СНЯТЬ РАНЬШЕ');
    if (game.stressMode) text('save-status', 'ТЕСТ НЕ МЕНЯЕТ СОХРАНЕНИЕ');
    else if (status === 'ready') text('save-status', progress.available ? 'АВТОСОХРАНЕНИЕ' : 'ХРАНИЛИЩЕ НЕДОСТУПНО');
    text('dash-label', p.dashReady <= 0 ? 'РЫВОК ГОТОВ' : 'РЫВОК ' + p.dashReady.toFixed(1) + ' С');
    $('dash-bar').style.width = (100 * (1 - p.dashReady / game.dashCooldown)) + '%';
    $('dash-touch').disabled = status !== 'running' || p.dashReady > 0;
    $('pause').disabled = status !== 'running' && status !== 'paused';
    $('pause').setAttribute('aria-pressed', String(status === 'paused'));
    for (const [index, { slot, rank, name, icon }] of equipment) {
      const id = ownedWeapons[game.weaponPage * 5 + index];
      if (!id) { slot.className = 'locked'; slot.disabled = true; slot.setAttribute('aria-pressed', 'false'); slot.removeAttribute('aria-label'); name.textContent = 'СВОБОДНЫЙ СЛОТ'; icon.textContent = '+'; rank.textContent = '—'; delete slot.dataset.item; slot.removeAttribute('title'); continue; }
      const level = game.levels[id] || 0;
      slot.classList.toggle('locked', !level);
      slot.setAttribute('aria-pressed', String(id === game.selectedWeapon));
      const info = game.weaponInfo(id), consumed = game.isConsumed(id), evolved = game.isEvolved(id);
      if (name.textContent !== info.title.toUpperCase()) name.textContent = info.title.toUpperCase();
      if (icon.textContent !== info.icon) icon.textContent = info.icon;
      slot.classList.toggle('evolved', evolved); slot.disabled = consumed;
      slot.dataset.item = id; slot.removeAttribute('title');
      slot.setAttribute('aria-label', info.title + ' · ' + level + '/' + NightUpgrades.find(u => u.id === id).max + (id === game.selectedWeapon ? ' · Выбрано' : ''));
      const value = consumed ? 'ОБЪЕД.' : evolved ? 'EVO' : level ? 'I'.repeat(level) : '—'; if (rank.textContent !== value) rank.textContent = value;
    }
    syncWeaponHighlight();
    const passiveKey = passives.map(id => id + ':' + game.levels[id]).join('|');
    if ($('passive-loadout').dataset.content !== passiveKey) {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < 5; i++) { const id = passives[i], u = NightUpgrades.find(u => u.id === id), cell = document.createElement('span'); cell.className = 'passive-slot' + (u ? '' : ' empty'); cell.textContent = u ? u.icon + ' ' + u.title + ' ' + game.levels[id] + '/' + u.max : '+ ПАССИВКА ' + (i + 1); if (u) { cell.dataset.item = id; cell.tabIndex = 0; } fragment.append(cell); }
      if (passives.length > 5) { const legacy = document.createElement('small'); legacy.textContent = 'Старый набор / тест: ' + passives.slice(5).map(id => NightUpgrades.find(u => u.id === id).title + ' ' + game.levels[id]).join(' · '); fragment.append(legacy); }
      $('passive-loadout').replaceChildren(fragment); $('passive-loadout').dataset.content = passiveKey;
    }
    $('passive-loadout').hidden = false; updateFeatureButtons();
    text('metric-enemies', game.enemies.length + ' / ' + game.enemyLimit); text('metric-peak', game.peakEnemies); text('metric-rendered', renderer.renderedEnemies || 0);
    text('metric-fps', displayFPS || '—'); text('metric-frame', frameMean.toFixed(1) + ' / ' + frameP95.toFixed(1) + ' мс');
    text('metric-cpu', simulationMS.toFixed(1) + ' / ' + renderMS.toFixed(1) + ' мс'); text('metric-sim', formatTime(game.time)); text('metric-pressure', formatTime(game.pressureTime));
    text('metric-objects', (game.shots.length + game.boomerangs.length + game.relics.length + game.enemyShots.length) + ' / ' + game.gems.length);
    const plan = game.wavePlan;
    text('wave-status',game.sandboxMode?'Песочница': plan.title + ' · ' + plan.phaseTitle);
    if (!$('engine-panel').hidden) updateCombatMetrics(plan);
    if (status !== previousStatus) {
      hideEquipmentTooltip();
      dirty = true;
      $('intro').hidden = status !== 'ready'; $('upgrade').hidden = status !== 'upgrading'; $('paused').hidden = status !== 'paused'; $('ending').hidden = status !== 'dead' && status !== 'won'; $('chest-reward').hidden = status !== 'reward';
      document.body.classList.toggle('upgrade-open', status === 'upgrading');
      if (status === 'upgrading' && !$('upgrade').open) $('upgrade').showModal();
      else if (status !== 'upgrading' && $('upgrade').open) $('upgrade').close();
      $('touch-controls').hidden = status !== 'running'; $('dash-status').hidden = status === 'ready';
      if (status === 'dead' || status === 'won') {
        saveBest(); const won = status === 'won';
        text('ending-title', won ? 'Ты встретил рассвет' : 'Ночь победила');
        text('ending-caption', won ? 'СОЛНЦЕ ВЗОШЛО НАД КЛАДБИЩЕМ' : 'КЛАДБИЩЕ ПОЛУЧИЛО ЕЩЁ ОДНУ ДУШУ');
        text('ending-text', game.sandboxMode ? 'Тест окончен. Обычный забег, золото и покупки не изменились.' : 'Сохранено ' + game.goldAvailable + ' золота. На рероллы потрачено ' + game.rerollGoldSpent + '. Постоянные улучшения ждут в «Наследии» на стартовом экране.');
        text('ending-art', won ? ' \\ | /\n-- * --\n / | \\' : ' .-.\n(x x)\n |=|\n_|_|_');
        text('result-time', formatTime(game.elapsed)); text('result-kills', game.kills); text('result-level', game.level);
        $('restart').focus({ preventScroll: true });
      }
      if (status === 'paused') $('resume').focus({ preventScroll: true });
      if (status === 'reward') { clearInput(); showReward(); saveCheckpoint(); }
      if (status === 'ready') progressSummary();
      previousStatus = status;
    }
    if (status === 'upgrading' && offersLevel !== game.level) { clearInput(); showOffers(); saveCheckpoint(); }
    if (noticeUntil && performance.now() > noticeUntil) { $('notice').classList.remove('visible'); noticeUntil = 0; }
  }
  function start() {
    if (game.status !== 'ready') return;
    progress.profile = progress.loadProfile();
    if (!game.stressMode && !progress.isHeroUnlocked(selectedCharacter)) { updateCharacterDetails(); return; }
    if (!game.stressMode && savedRun) { progress.finish(savedRun); savedRun = null; }
    game.start(); canvas.focus({ preventScroll: true }); updateHUD();
    preferences(); saveCheckpoint();
    if (game.stressMode && !game.sandboxMode) { $('engine-panel').hidden = false; $('metrics-toggle').setAttribute('aria-expanded', 'true'); }
    notify(game.sandboxMode?'ПЕСОЧНИЦА: '+(game.sandboxInvulnerable?'НЕУЯЗВИМОСТЬ ВКЛЮЧЕНА. ':'УРОН ГЕРОЮ ВКЛЮЧЁН. ')+'Настройки — кнопкой сверху.':game.stressMode?'ТЕСТ: весь арсенал, неуязвимость, нарастающая нагрузка.':'Бесконечная арена · M — авто / ручной огонь.');
  }
  function restart() {
    saveBest();
    game = new NightGame(Date.now(), selectedCharacter, options()); resetMetrics(); camera.x = game.player.x; camera.y = game.player.y;
    offersLevel = 0; previousStatus = ''; lastWave = 1; accumulator = 0; clearInput();
    resize(); start();
  }
  function returnToCharacters() {
    if (saveCheckpoint()) savedRun = game;
    game = new NightGame(Date.now(), selectedCharacter, options()); resetMetrics(); camera = { x: game.player.x, y: game.player.y };
    offersLevel = 0; previousStatus = ''; lastWave = 1; accumulator = 0; clearInput(); resize(); updateCharacterDetails(); updateHUD();
    $('characters').querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
  }
  function choose(index) {
    if (game.choose(index)) { saveCheckpoint(); updateHUD(); if (game.status === 'running') canvas.focus({ preventScroll: true }); }
  }
  function togglePause() { clearInput(); game.pause(); saveCheckpoint(); updateHUD(); if (game.status === 'running') canvas.focus({ preventScroll: true }); }
  function clearInput() { keys.clear(); mouseFiring = touchFiring = false; game.input.firing = false; game.queuedWeapon = null; pointer.x = pointer.y = 0; pointer.id = null; game.input.x = game.input.y = 0; $('stick').style.transform = ''; }
  function syncInput() {
    const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    game.input.x = x || pointer.x; game.input.y = y || pointer.y;
    game.input.firing = mouseFiring || touchFiring || keys.has('KeyF');
  }
  $('start').addEventListener('click', start); $('pause').addEventListener('click', togglePause); $('resume').addEventListener('click', togglePause);
  $('expand-view').addEventListener('click', toggleExpandedView);
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      nativeFullscreen = true;
      if (!expandedView) document.exitFullscreen().catch(() => {});
    }
    else if (nativeFullscreen) { nativeFullscreen = false; setExpandedView(false); }
  });
  $('continue-run').addEventListener('click', resumeSavedRun);
  $('claim-reward').addEventListener('click', () => claimReward());
  $('reward-loot').addEventListener('click', e => { const button = e.target.closest('[data-reward-choice]'); if (button) claimReward(Number(button.dataset.rewardChoice)); });
  $('unlock-hero').addEventListener('click', () => {
    if (game.status !== 'ready' || game.stressMode) return;
    const bought = progress.purchaseHero(selectedCharacter);
    progress.profile = progress.loadProfile(); updateCharacterDetails(); progressSummary();
    if (bought) { preferences(); notify(game.character.name + ': герой открыт, покупка сохранена.'); }
    else notify('Покупка не выполнена. Баланс обновлён; проверь доступность хранилища.');
  });
  $('meta-open').addEventListener('click', () => { showMeta(); $('meta-shop').showModal(); });
  $('meta-close').addEventListener('click', () => $('meta-shop').close());
  $('meta-grid').addEventListener('click', e => {
    const feature = e.target.closest('[data-feature]');
    if (feature && game.status === 'ready') { const bought = progress.purchaseFeature(feature.dataset.feature); showMeta(); progressSummary(); text('meta-message', bought ? 'Раздел открыт навсегда. Покупка сохранена.' : 'Покупка не выполнена. Проверь баланс и доступность хранилища.'); return; }
    const button = e.target.closest('[data-buy]'); if (!button || game.status !== 'ready') return;
    const bought = progress.purchase(button.dataset.buy, Number(button.dataset.rank));
    showMeta(); if (bought) { configureRun(); updateCharacterDetails(); progressSummary(); text('meta-message', 'Покупка сохранена. Улучшение действует в новых забегах.'); }
    else text('meta-message', 'Покупка не выполнена. Баланс и цены обновлены; проверь доступность хранилища.');
  });
  for (const [id, direction] of [['weapons-prev', -1], ['weapons-next', 1]]) $(id).addEventListener('click', () => { game.cycleWeapons(direction); updateHUD(); });
  window.addEventListener('storage', () => { progress.profile = progress.loadProfile(); if (game.status === 'ready') { configureRun(false); progressSummary(); updateCharacterDetails(); } if ($('meta-shop').open) showMeta(); });
  $('bestiary-open').addEventListener('click', openBestiary);
  $('map-open').addEventListener('click', openMap);
  $('map-close').addEventListener('click', () => $('world-map').close());
  $('world-map').addEventListener('close', () => { if (mapWasRunning && game.status === 'paused') { game.pause(); updateHUD(); } mapWasRunning = false; });
  $('bestiary-close').addEventListener('click', () => $('bestiary').close());
  $('bestiary').addEventListener('close', () => { if (bestiaryWasRunning && game.status === 'paused') { game.pause(); last = 0; updateHUD(); canvas.focus({ preventScroll: true }); } bestiaryWasRunning = false; });
  $('grimoire-open').addEventListener('click', openGrimoire);
  for (const view of ['recipes', 'weapons', 'passives']) $('reference-' + view).addEventListener('click', () => showReference(view));
  $('grimoire-close').addEventListener('click', () => $('grimoire').close());
  $('grimoire').addEventListener('close', () => { if (grimoireWasRunning && game.status === 'paused') { game.pause(); last = 0; updateHUD(); canvas.focus({ preventScroll: true }); } grimoireWasRunning = false; });
  $('restart').addEventListener('click', restart); $('restart-pause').addEventListener('click', restart);
  $('change-character').addEventListener('click', returnToCharacters); $('change-character-pause').addEventListener('click', returnToCharacters);
  $('fire-mode').addEventListener('click', toggleFireMode);
  for(const id of ['stress-mode','sandbox-mode'])$(id).addEventListener('change',()=>{
    if($(id).checked)$(id==='stress-mode'?'sandbox-mode':'stress-mode').checked=false;
    if(!$('stress-mode').checked&&!$('sandbox-mode').checked){selectedCharacter=progress.profile.character;fireModePreference=progress.profile.fireMode;}
    configureRun();
  });
  $('enemy-limit').addEventListener('change', configureRun);$('stage-select').addEventListener('change',()=>configureRun());
  $('sandbox-open').addEventListener('click',openSandbox);$('sandbox-open-live').addEventListener('click',openSandbox);
  $('sandbox-close').addEventListener('click',()=>$('sandbox-settings').close());
  for(const id of ['sandbox-enemy','sandbox-passive','sandbox-weapon','sandbox-hero','sandbox-evolved','sandbox-arena'])$(id).addEventListener('change',updateSandboxPreview);
  $('sandbox-apply').addEventListener('click',()=>{
    if(!game.sandboxMode)return;
    sandboxWasRunning=false;selectedCharacter=$('sandbox-hero').value;$('sandbox-settings').close();
    game=new NightGame(Date.now(),selectedCharacter,options());resetMetrics();camera={x:game.player.x,y:game.player.y};previousStatus='';offersLevel=0;lastWave=1;accumulator=0;clearInput();resize();updateCharacterDetails();start();
  });
  $('sandbox-settings').addEventListener('close',()=>{if(sandboxWasRunning&&game.status==='paused'){game.pause();last=0;updateHUD();canvas.focus({preventScroll:true});}sandboxWasRunning=false;});
  $('loadout').addEventListener('click', e => { const slot = e.target.closest('[data-slot]'); if (slot) selectWeapon(Number(slot.dataset.slot)); });
  $('metrics-toggle').addEventListener('click', () => { const panel = $('engine-panel'); panel.hidden = !panel.hidden; $('metrics-toggle').setAttribute('aria-expanded', String(!panel.hidden)); });
  $('pressure').addEventListener('click', () => { if (!game.stressMode || game.status !== 'running') return; game.pressureOffset += 300; updateHUD(); });
  const megaPreset = document.createElement('button'); megaPreset.id = 'mega-pressure'; megaPreset.type = 'button'; megaPreset.textContent = 'Волны после 10 минут';
  $('stress-controls').append(megaPreset);
  megaPreset.addEventListener('click', () => { if (!game.stressMode || game.status !== 'running') return; game.pressureOffset = Math.max(game.pressureOffset, 600 - game.elapsed); updateHUD(); });
  const evolutionTest = document.createElement('button'); evolutionTest.id = 'evolution-chest'; evolutionTest.type = 'button'; evolutionTest.textContent = 'Сундук эволюций (тест)';
  $('stress-controls').append(evolutionTest);
  evolutionTest.addEventListener('click', () => {
    if (!game.stressMode || game.status !== 'running') return;
    game.dropChest({ kind: 'darVetro', mega: true, x: game.player.x, y: game.player.y });
    game.openChest(game.chests[game.chests.length - 1]); updateHUD(); dirty = true;
  });
  $('save-metrics').addEventListener('click', exportMetrics);
  $('characters').addEventListener('click', e => { const card = e.target.closest('[data-character]'); if (card) selectCharacter(card.dataset.character); });
  $('hero-search').addEventListener('input', e => {
    const query = e.target.value.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim(); let visible = 0;
    for (const card of $('characters').children) {
      const hero = NightCharacters.find(c => c.id === card.dataset.character);
      card.hidden = !(hero.name + ' ' + hero.role).toLocaleLowerCase('ru').replaceAll('ё', 'е').includes(query);
      if (!card.hidden) visible++;
    }
    $('hero-search-empty').hidden = visible > 0;
  });
  $('upgrade-cards').addEventListener('click', e => { const card = e.target.closest('[data-choice]'); if (card) selectOffer(Number(card.dataset.choice)); });
  $('upgrade-confirm').addEventListener('click', () => choose(game.offerSelection));
  $('upgrade').addEventListener('cancel', e => e.preventDefault());
  $('upgrade-banish').addEventListener('click', () => changeOffer(() => game.banishOffer()));
  $('upgrade-reroll').addEventListener('click', () => changeOffer(() => {
    if (progress.reroll(game)) return true;
    updateOfferSelection(); text('upgrade-wallet', 'Реролл не оплачен. Проверь золото и доступность сохранения.'); return false;
  }));
  document.addEventListener('keydown', e => {
    if (e.code === 'Escape') hideEquipmentTooltip();
    if ($('bestiary').open || $('meta-shop').open || $('grimoire').open || $('world-map').open || $('sandbox-settings').open) return;
    if (game.status === 'upgrading') {
      if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); return; }
      const number = /^(Digit|Numpad)([123])$/.exec(e.code);
      if (number) { e.preventDefault(); if (!e.repeat) selectOffer(Number(number[2]) - 1); }
      return;
    }
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && (e.code === 'KeyG' && !e.ctrlKey && !e.altKey && !e.metaKey || e.code === 'Escape' && expandedView)) {
      e.preventDefault(); if (!e.repeat) toggleExpandedView(); return;
    }
    if (game.status === 'reward') {
      const number = /^(Digit|Numpad)([123])$/.exec(e.code);
      if (number && game.reward.options) { e.preventDefault(); if (!e.repeat) claimReward(Number(number[2]) - 1); return; }
      if (['Enter', 'Space'].includes(e.code)) {
        if (game.reward.options && e.target.closest('[data-reward-choice]')) return;
        e.preventDefault(); if (!e.repeat && !game.reward.options) claimReward(); return;
      }
    }
    const movement = /^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code);
    if (/^(INPUT|SELECT)$/.test(e.target.tagName)) return;
    if (movement) { e.preventDefault(); keys.add(e.code); syncInput(); }
    if (e.code === 'KeyF' && game.status === 'running') { e.preventDefault(); keys.add(e.code); if (!e.repeat) game.requestAttack(); syncInput(); }
    if (e.repeat) return;
    if (e.code === 'KeyQ' || e.code === 'KeyE') { e.preventDefault(); game.cycleWeapons(e.code === 'KeyQ' ? -1 : 1); updateHUD(); return; }
    if (/^(Digit|Numpad)[1-9]$/.test(e.code)) { e.preventDefault(); selectWeapon(Number(e.code.slice(-1))); }
    else if (e.code === 'KeyM') { e.preventDefault(); toggleFireMode(); }
    else if (e.code === 'Space' && game.status === 'running') { e.preventDefault(); game.dash(); }
    else if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause(); }
    else if (e.code === 'KeyR' && game.status !== 'ready') restart();
  });
  document.addEventListener('keyup', e => { keys.delete(e.code); syncInput(); });
  document.addEventListener('visibilitychange', () => { last = 0; fpsSince = fpsFrames = 0; if (document.hidden) { clearInput(); if (game.status === 'running') game.pause(); saveCheckpoint(); updateHUD(); } });
  window.addEventListener('blur', () => { clearInput(); if (game.status === 'running') { game.pause(); saveCheckpoint(); updateHUD(); } });
  window.addEventListener('pagehide', saveCheckpoint);
  const joystick = $('joystick');
  function drag(e) {
    const rect = joystick.getBoundingClientRect(), x = e.clientX - rect.left - rect.width / 2, y = e.clientY - rect.top - rect.height / 2;
    const len = Math.hypot(x, y), d = Math.min(31, len), norm = len || 1;
    pointer.x = x / norm * d / 31; pointer.y = y / norm * d / 31;
    $('stick').style.transform = 'translate(' + (x / norm * d) + 'px,' + (y / norm * d) + 'px)'; syncInput();
  }
  joystick.addEventListener('pointerdown', e => { if (game.status !== 'running') return; e.preventDefault(); pointer.id = e.pointerId; joystick.setPointerCapture(e.pointerId); drag(e); });
  joystick.addEventListener('pointermove', e => { if (e.pointerId === pointer.id) drag(e); });
  const releaseStick = e => { if (e.pointerId !== pointer.id) return; pointer.id = null; pointer.x = pointer.y = 0; $('stick').style.transform = ''; syncInput(); };
  joystick.addEventListener('pointerup', releaseStick); joystick.addEventListener('pointercancel', releaseStick); joystick.addEventListener('lostpointercapture', releaseStick);
  $('dash-touch').addEventListener('pointerdown', e => { e.preventDefault(); game.dash(); updateHUD(); });
  const fireTouch = $('fire-touch');
  fireTouch.addEventListener('pointerdown', e => { e.preventDefault(); fireTouch.setPointerCapture(e.pointerId); touchFiring = true; game.requestAttack(); syncInput(); });
  const releaseFire = () => { touchFiring = false; syncInput(); };
  fireTouch.addEventListener('pointerup', releaseFire); fireTouch.addEventListener('pointercancel', releaseFire); fireTouch.addEventListener('lostpointercapture', releaseFire);
  function pointMouse(e) {
    const rect = canvas.getBoundingClientRect(); mouseAim.x = (e.clientX - rect.left) / rect.width; mouseAim.y = (e.clientY - rect.top) / rect.height; mouseAim.active = true;
  }
  canvas.addEventListener('pointermove', pointMouse);
  canvas.addEventListener('pointerdown', e => { if (e.button !== 0 || game.status !== 'running') return; e.preventDefault(); canvas.focus({ preventScroll: true }); pointMouse(e); canvas.setPointerCapture(e.pointerId); mouseFiring = true; game.requestAttack(); syncInput(); });
  const releaseMouse = () => { mouseFiring = false; syncInput(); };
  canvas.addEventListener('pointerup', releaseMouse); canvas.addEventListener('pointercancel', releaseMouse); canvas.addEventListener('lostpointercapture', releaseMouse);
  new ResizeObserver(resize).observe(arena);
  function frame(now) {
    const rawDT = last ? Math.max(0, (now - last) / 1000) : 0, dt = Math.min(.1, rawDT); last = now;
    const simulationStart = performance.now();
    if (game.status === 'running' && !document.hidden) {
      game.wallTime += rawDT;
      if (mouseAim.active) { game.aim.active = true; game.aim.x = camera.x + (mouseAim.x - .5) * renderer.width / renderer.scaleX; game.aim.y = camera.y + (mouseAim.y - .5) * renderer.height / renderer.scaleY; }
      accumulator += dt;
      while (accumulator >= 1 / 60 && game.status === 'running') { game.update(1 / 60); accumulator -= 1 / 60; }
      const factor = 1 - Math.exp(-dt * 9);
      const alpha = Math.min(1, accumulator * 60), p = game.player;
      const room = game.encounter?.phase === 'locked' ? game.encounter : null;
      camera.x += ((room ? room.x : p.prevX + (p.x - p.prevX) * alpha) - camera.x) * factor;
      camera.y += ((room ? room.y : p.prevY + (p.y - p.prevY) * alpha) - camera.y) * factor;
      if (game.wave !== lastWave) { lastWave = game.wave; if(!game.sandboxMode)notify('ВОЛНА ' + game.wave + ' — НЕ ОСТАНАВЛИВАЙСЯ'); }
    } else accumulator = 0;
    simulationMS += (performance.now() - simulationStart - simulationMS) * .1;
    if (game.events.includes('boss')) notify('БОСС: ' + game.lastBoss.toUpperCase());
    if (game.events.includes('mega-boss')) notify('МЕГАБОСС: ' + game.lastBoss.toUpperCase() + ' · БЕЗ ЗАМКНУТОЙ СТЕНЫ');
    if (game.events.includes('revive')) notify('ВОЗРОЖДЕНИЕ · ТРИ СЕКУНДЫ ЗАЩИТЫ');
    if (game.events.includes('arena-warning')) notify('ГОТОВЬСЯ: ПЯТЬ СЕКУНД ДО ЗАМЫКАНИЯ СТЕНЫ');
    if (game.events.includes('arena-clear') || game.events.includes('boss-defeated')) notify('БОСС ПОБЕЖДЁН · ЗАБЕРИ СУНДУК');
    if (game.events.includes('arena-timeout')) notify('СТЕНА ИСЧЕЗЛА · БОСС ОСТАЛСЯ НА ПОЛЕ');
    if (game.events.includes('supply-heal')) notify('ЯЩИК: +30 ЗДОРОВЬЯ');
    if (game.events.includes('supply-level')) notify('ЯЩИК: БЕСПЛАТНЫЙ УРОВЕНЬ · ВЫБЕРИ УСИЛЕНИЕ');
    if (game.events.includes('supply-magnet')) notify('ЯЩИК: МАГНИТ СОБРАЛ ВСЕ КРИСТАЛЛЫ С КАРТЫ');
    if (game.events.some(event => event.startsWith('supply-') || ['boss', 'mega-boss', 'revive', 'arena-warning', 'arena-clear', 'arena-timeout', 'boss-defeated', 'chest-open'].includes(event))) saveCheckpoint();
    game.events.length = 0;
    if (now - lastHUD > 85) { updateHUD(); lastHUD = now; }
    if (!document.hidden && (game.status === 'running' || dirty)) {
      const drawStart = performance.now(); renderer.render(game, camera, game.status === 'running' ? accumulator * 60 : 1); dirty = false;
      renderMS += (performance.now() - drawStart - renderMS) * .1;
    }
    if (!document.hidden && game.status === 'running') {
      if (!fpsSince) fpsSince = now;
      fpsFrames++;
      if (rawDT > 0) { frameTimes[frameIndex] = rawDT * 1000; frameIndex = (frameIndex + 1) % frameTimes.length; sampleCount = Math.min(frameTimes.length, sampleCount + 1); }
      if (now - fpsSince >= 1000) { displayFPS = Math.round(fpsFrames * 1000 / (now - fpsSince)); fpsFrames = 0; fpsSince = now; }
      recordMetrics();
      if (game.elapsed - lastSavedElapsed >= 10) saveCheckpoint();
    } else { fpsSince = fpsFrames = 0; }
    requestAnimationFrame(frame);
  }
  buildSandbox();buildCharacters(); updateHUD(); resize(); requestAnimationFrame(frame);
})();
