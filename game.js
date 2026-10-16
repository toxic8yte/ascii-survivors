(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('screen'), arena = $('arena');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new NightRenderer(canvas, reducedMotion);
  let selectedCharacter = 'hunter';
  try { const saved = localStorage.getItem('ascii-night-character'); if (NightCharacters.some(c => c.id === saved)) selectedCharacter = saved; } catch (_) {}
  let fireModePreference = 'auto';
  function options() { return { fireMode: fireModePreference, stressMode: $('stress-mode').checked, enemyLimit: Number($('enemy-limit').value) }; }
  let game = new NightGame(Date.now(), selectedCharacter, options()), keys = new Set();
  let camera = { x: game.player.x, y: game.player.y }, pointer = { x: 0, y: 0, id: null };
  let last = 0, accumulator = 0, lastHUD = 0, previousStatus = '', offersLevel = 0;
  let fpsFrames = 0, fpsSince = 0, displayFPS = 0, dirty = true;
  let noticeUntil = 0, best = null, lastWave = 1;
  const frameTimes = new Float32Array(180), records = [];
  let frameIndex = 0, sampleCount = 0, frameMean = 0, frameP95 = 0, simulationMS = 0, renderMS = 0, lastRecord = -1;
  let mouseFiring = false, touchFiring = false;
  const mouseAim = { x: .5, y: .2, active: false };
  const textCache = new Map(), equipment = new Map();
  try { best = JSON.parse(localStorage.getItem('ascii-night-best-v1') || 'null'); } catch (_) {}
  if (best && Number.isFinite(best.time)) $('best').textContent = formatTime(best.time) + ' / ' + (best.kills || 0) + ' ИЗГНАНО';
  canvas.tabIndex = 0;

  function formatTime(t) { return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
  function text(id, value) { if (textCache.get(id) !== value) { $(id).textContent = value; textCache.set(id, value); } }
  function resize() {
    renderer.resize(arena.clientWidth, arena.clientHeight, devicePixelRatio || 1);
    game.spawnRadius = Math.max(510, Math.min(920, Math.hypot(renderer.cols * 10, renderer.rows * 16) / 2 + 70));
    renderer.render(game, camera); dirty = true;
  }
  function buildCharacters() {
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
    NightSlots.forEach((id, i) => {
      const u = NightUpgrades.find(u => u.id === id), slot = document.createElement('button'), key = document.createElement('kbd'), icon = document.createElement('i'), name = document.createElement('span'), rank = document.createElement('b');
      slot.type = 'button'; slot.dataset.slot = i + 1; key.textContent = i + 1;
      icon.textContent = u?.icon || '-'; name.textContent = u?.title.toUpperCase() || 'ПУСТО'; slot.append(key, icon, name, rank); slot.title = u?.text || 'Место для будущего оружия';
      $('loadout').append(slot); equipment.set(id || 'empty', { slot, rank });
    });
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
    records.push({ seconds: +game.elapsed.toFixed(2), simulationSeconds: +game.time.toFixed(2), pressureSeconds: +game.pressureTime.toFixed(2), enemies: game.enemies.length, peakEnemies: game.peakEnemies, fps: displayFPS, frameMS: +frameMean.toFixed(2), frameP95MS: +frameP95.toFixed(2), simulationMS: +simulationMS.toFixed(2), renderMS: +renderMS.toFixed(2), drops: game.gems.length, projectiles: game.shots.length + game.boomerangs.length });
    if (records.length > 3600) records.shift();
  }
  function selectWeapon(number) {
    if (game.status === 'upgrading') return;
    if (!game.selectSlot(number)) { notify(number === 9 ? 'Слот 9 пока пуст.' : 'Оружие ещё не найдено — выбери его при повышении уровня.'); return; }
    updateHUD(); dirty = true;
  }
  function toggleFireMode() {
    fireModePreference = game.fireMode === 'auto' ? 'manual' : 'auto'; game.setFireMode(fireModePreference); mouseFiring = touchFiring = false; keys.delete('KeyF');
    updateHUD(); dirty = true;
    notify(game.fireMode === 'manual' ? 'РУЧНОЙ: 1–9 оружие · ЛКМ / F атака · курсор — прицел.' : 'АВТО: всё найденное оружие атакует само.');
  }
  function exportMetrics() {
    const payload = { version: 1, mode: game.stressMode ? 'stress' : 'survival', enemyLimit: game.enemyLimit, elapsed: game.elapsed, simulationSeconds: game.time, pressureSeconds: game.pressureTime, peakEnemies: game.peakEnemies, kills: game.kills, sampleWindow: 'last 3600 active seconds', samples: records };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'ascii-survivors-metrics.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function configureRun() {
    if (game.status !== 'ready') return;
    game = new NightGame(Date.now(), selectedCharacter, options()); resetMetrics(); resize(); updateHUD();
  }
  function updateCharacterDetails() {
    const c = game.character, weapon = NightUpgrades.find(u => u.id === c.weapon);
    text('character-name', c.name + ' / ' + c.role); text('character-description', c.text);
    text('character-stats', c.hp + ' HP  /  ' + c.speed + ' СКОРОСТЬ  /  ' + c.dash + ' С РЫВОК');
    text('character-weapon', weapon.icon + ' ' + weapon.title);
    for (const card of $('characters').children) card.setAttribute('aria-pressed', String(card.dataset.character === selectedCharacter));
  }
  function selectCharacter(id) {
    if (game.status !== 'ready' || !NightCharacters.some(c => c.id === id)) return;
    selectedCharacter = id; game = new NightGame(Date.now(), id, options()); resetMetrics(); resize(); updateCharacterDetails(); updateHUD();
    try { localStorage.setItem('ascii-night-character', id); } catch (_) {}
  }
  function notify(message) {
    $('notice').textContent = message; $('notice').classList.add('visible'); noticeUntil = performance.now() + 3300;
  }
  function saveBest() {
    if (game.stressMode) return;
    if (!best || game.elapsed > best.time + .1 || Math.abs(game.elapsed - best.time) < .1 && game.kills > best.kills) {
      best = { time: game.elapsed, kills: game.kills };
      try { localStorage.setItem('ascii-night-best-v1', JSON.stringify(best)); } catch (_) {}
    }
  }
  function showOffers() {
    $('upgrade-level').textContent = String(game.level).padStart(2, '0');
    const fragment = document.createDocumentFragment();
    game.offers.forEach((u, i) => {
      const card = document.createElement('button'); card.className = 'upgrade-card'; card.type = 'button'; card.dataset.choice = i;
      const part = (className, content) => { const el = document.createElement('span'); el.className = className; el.textContent = content; card.append(el); };
      part('upgrade-icon', u.icon); part('upgrade-kind', u.weapon ? (game.levels[u.id] ? 'УСИЛЕНИЕ ОРУЖИЯ' : 'НОВОЕ ОРУЖИЕ') : u.kind); part('upgrade-name', u.title); part('upgrade-description', u.text);
      part('upgrade-rank', 'СТУПЕНЬ ' + (game.levels[u.id] + 1) + ' / ' + u.max); part('upgrade-key', i + 1);
      fragment.append(card);
    });
    $('upgrade-cards').replaceChildren(fragment);
    $('upgrade-cards').querySelector('button')?.focus({ preventScroll: true });
    offersLevel = game.level;
  }
  function updateHUD() {
    const p = game.player, status = game.status;
    const weapon = NightUpgrades.find(u => u.id === game.selectedWeapon), manual = game.fireMode === 'manual';
    text('selected-weapon', (NightSlots.indexOf(game.selectedWeapon) + 1) + ' / ' + weapon.title.toUpperCase());
    $('fire-mode').setAttribute('aria-pressed', String(manual));
    text('fire-mode', manual ? 'РУЧНОЙ ОГОНЬ [M]' : 'АВТОАТАКА [M]');
    $('fire-touch').hidden = !manual; $('stress-controls').hidden = !game.stressMode;
    text('hero-label', game.character.name.toUpperCase() + ' / ЖИЗНЬ');
    text('fps', status === 'running' && displayFPS ? displayFPS + ' FPS / AUTO' : 'РЕНДЕР / AUTO');
    text('hp-text', game.stressMode ? 'НЕУЯЗВИМОСТЬ' : Math.ceil(p.hp) + ' / ' + p.maxHp);
    $('hp-bar').style.width = (p.hp / p.maxHp * 100) + '%';
    $('xp-bar').style.width = Math.min(100, game.xp / game.xpNeed * 100) + '%';
    text('xp-text', 'ОПЫТ ' + game.xp + ' / ' + game.xpNeed);
    text('timer', formatTime(game.elapsed)); text('enemy-count', game.enemies.length.toLocaleString('ru-RU'));
    text('kills', String(game.kills).padStart(3, '0')); text('level', String(game.level).padStart(2, '0'));
    text('stage', (game.stressMode ? 'ТЕСТ ДВИЖКА / ' : '') + (status === 'ready' ? 'БЕСКОНЕЧНАЯ НОЧЬ' : 'ВОЛНА ' + game.wave));
    text('coords', Math.round(p.x) + ' : ' + Math.round(p.y));
    text('map-label', 'КЛАДБИЩЕ · ' + game.width.toLocaleString('ru-RU') + ' × ' + game.height.toLocaleString('ru-RU'));
    text('dash-label', p.dashReady <= 0 ? 'РЫВОК ГОТОВ' : 'РЫВОК ' + p.dashReady.toFixed(1) + ' С');
    $('dash-bar').style.width = (100 * (1 - p.dashReady / game.dashCooldown)) + '%';
    $('dash-touch').disabled = status !== 'running' || p.dashReady > 0;
    $('pause').disabled = status !== 'running' && status !== 'paused';
    $('pause').setAttribute('aria-pressed', String(status === 'paused'));
    for (const [id, { slot, rank }] of equipment) {
      const level = game.levels[id] || 0;
      slot.classList.toggle('locked', !level);
      slot.setAttribute('aria-pressed', String(id === game.selectedWeapon));
      const value = level ? 'I'.repeat(level) : '—'; if (rank.textContent !== value) rank.textContent = value;
    }
    text('metric-enemies', game.enemies.length + ' / ' + game.enemyLimit); text('metric-peak', game.peakEnemies); text('metric-rendered', renderer.renderedEnemies || 0);
    text('metric-fps', displayFPS || '—'); text('metric-frame', frameMean.toFixed(1) + ' / ' + frameP95.toFixed(1) + ' мс');
    text('metric-cpu', simulationMS.toFixed(1) + ' / ' + renderMS.toFixed(1) + ' мс'); text('metric-sim', formatTime(game.time)); text('metric-pressure', formatTime(game.pressureTime));
    text('metric-objects', (game.shots.length + game.boomerangs.length) + ' / ' + game.gems.length);
    if (status !== previousStatus) {
      dirty = true;
      $('intro').hidden = status !== 'ready'; $('upgrade').hidden = status !== 'upgrading'; $('paused').hidden = status !== 'paused'; $('ending').hidden = status !== 'dead' && status !== 'won';
      $('touch-controls').hidden = status !== 'running'; $('dash-status').hidden = status === 'ready';
      if (status === 'dead' || status === 'won') {
        saveBest(); const won = status === 'won';
        text('ending-title', won ? 'Ты встретил рассвет' : 'Ночь победила');
        text('ending-caption', won ? 'СОЛНЦЕ ВЗОШЛО НАД КЛАДБИЩЕМ' : 'КЛАДБИЩЕ ПОЛУЧИЛО ЕЩЁ ОДНУ ДУШУ');
        text('ending-text', 'Беги к осколкам опыта. Новое оружие поможет пережить следующую ночь.');
        text('ending-art', won ? ' \\ | /\n-- * --\n / | \\' : ' .-.\n(x x)\n |=|\n_|_|_');
        text('result-time', formatTime(game.elapsed)); text('result-kills', game.kills); text('result-level', game.level);
        $('restart').focus({ preventScroll: true });
      }
      if (status === 'paused') $('resume').focus({ preventScroll: true });
      previousStatus = status;
    }
    if (status === 'upgrading' && offersLevel !== game.level) { clearInput(); showOffers(); }
    if (noticeUntil && performance.now() > noticeUntil) { $('notice').classList.remove('visible'); noticeUntil = 0; }
  }
  function start() {
    game.start(); canvas.focus({ preventScroll: true }); updateHUD();
    if (game.stressMode) { $('engine-panel').hidden = false; $('metrics-toggle').setAttribute('aria-expanded', 'true'); }
    notify(game.stressMode ? 'ТЕСТ: весь арсенал, неуязвимость, нарастающая нагрузка.' : 'Бесконечная арена · M — авто / ручной огонь.');
  }
  function restart() {
    game = new NightGame(Date.now(), selectedCharacter, options()); resetMetrics(); camera.x = game.player.x; camera.y = game.player.y;
    offersLevel = 0; previousStatus = ''; lastWave = 1; accumulator = 0; clearInput();
    resize(); start();
  }
  function returnToCharacters() {
    game = new NightGame(Date.now(), selectedCharacter, options()); resetMetrics(); camera = { x: game.player.x, y: game.player.y };
    offersLevel = 0; previousStatus = ''; lastWave = 1; accumulator = 0; clearInput(); resize(); updateCharacterDetails(); updateHUD();
    $('characters').querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
  }
  function choose(index) {
    if (game.choose(index)) { if (game.status === 'running') canvas.focus({ preventScroll: true }); updateHUD(); }
  }
  function togglePause() { clearInput(); game.pause(); updateHUD(); if (game.status === 'running') canvas.focus({ preventScroll: true }); }
  function clearInput() { keys.clear(); mouseFiring = touchFiring = false; game.input.firing = false; game.queuedWeapon = null; pointer.x = pointer.y = 0; pointer.id = null; game.input.x = game.input.y = 0; $('stick').style.transform = ''; }
  function syncInput() {
    const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    game.input.x = x || pointer.x; game.input.y = y || pointer.y;
    game.input.firing = mouseFiring || touchFiring || keys.has('KeyF');
  }
  $('start').addEventListener('click', start); $('pause').addEventListener('click', togglePause); $('resume').addEventListener('click', togglePause);
  $('restart').addEventListener('click', restart); $('restart-pause').addEventListener('click', restart);
  $('change-character').addEventListener('click', returnToCharacters); $('change-character-pause').addEventListener('click', returnToCharacters);
  $('fire-mode').addEventListener('click', toggleFireMode);
  $('stress-mode').addEventListener('change', configureRun); $('enemy-limit').addEventListener('change', configureRun);
  $('loadout').addEventListener('click', e => { const slot = e.target.closest('[data-slot]'); if (slot) selectWeapon(Number(slot.dataset.slot)); });
  $('metrics-toggle').addEventListener('click', () => { const panel = $('engine-panel'); panel.hidden = !panel.hidden; $('metrics-toggle').setAttribute('aria-expanded', String(!panel.hidden)); });
  $('pressure').addEventListener('click', () => { if (!game.stressMode || game.status !== 'running') return; game.pressureOffset += 300; updateHUD(); });
  $('save-metrics').addEventListener('click', exportMetrics);
  $('characters').addEventListener('click', e => { const card = e.target.closest('[data-character]'); if (card) selectCharacter(card.dataset.character); });
  $('upgrade-cards').addEventListener('click', e => { const card = e.target.closest('[data-choice]'); if (card) choose(Number(card.dataset.choice)); });
  document.addEventListener('keydown', e => {
    const movement = /^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code);
    if (/^(INPUT|SELECT)$/.test(e.target.tagName)) return;
    if (movement) { e.preventDefault(); keys.add(e.code); syncInput(); }
    if (e.code === 'KeyF' && game.status === 'running') { e.preventDefault(); keys.add(e.code); if (!e.repeat) game.requestAttack(); syncInput(); }
    if (e.repeat) return;
    if (game.status === 'upgrading' && /^(Digit|Numpad)[123]$/.test(e.code)) { e.preventDefault(); choose(Number(e.code.slice(-1)) - 1); }
    else if (/^(Digit|Numpad)[1-9]$/.test(e.code)) { e.preventDefault(); selectWeapon(Number(e.code.slice(-1))); }
    else if (e.code === 'KeyM') { e.preventDefault(); toggleFireMode(); }
    else if (e.code === 'Space' && game.status === 'running') { e.preventDefault(); game.dash(); }
    else if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause(); }
    else if (e.code === 'KeyR' && game.status !== 'ready') restart();
  });
  document.addEventListener('keyup', e => { keys.delete(e.code); syncInput(); });
  document.addEventListener('visibilitychange', () => { last = 0; fpsSince = fpsFrames = 0; if (document.hidden && game.status === 'running') { clearInput(); game.pause(); updateHUD(); } });
  window.addEventListener('blur', () => { clearInput(); if (game.status === 'running') { game.pause(); updateHUD(); } });
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
      camera.x += (p.prevX + (p.x - p.prevX) * alpha - camera.x) * factor;
      camera.y += (p.prevY + (p.y - p.prevY) * alpha - camera.y) * factor;
      if (game.wave !== lastWave) { lastWave = game.wave; notify('ВОЛНА ' + game.wave + ' — НЕ ОСТАНАВЛИВАЙСЯ'); }
    } else accumulator = 0;
    simulationMS += (performance.now() - simulationStart - simulationMS) * .1;
    if (game.events.includes('boss')) notify('ЖНЕЦ ВЫШЕЛ НА ОХОТУ');
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
    } else { fpsSince = fpsFrames = 0; }
    requestAnimationFrame(frame);
  }
  buildCharacters(); updateHUD(); resize(); requestAnimationFrame(frame);
})();
