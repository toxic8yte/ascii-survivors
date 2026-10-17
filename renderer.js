(function (root) {
  'use strict';
  const PALETTE = ['#3d5840', '#82916b', '#82d2ad', '#acb77e', '#cfc7af', '#ac8db8', '#df7054', '#f4c77f', '#f0edd0', '#79bace', '#c6ffdc', '#ffd0b8', '#ff8b2b', '#ff3c52', '#080b09'];
  const BALLISTICS = Object.fromEntries((root.NightCatalog || require('./catalog.js')).extraWeapons.filter(w => w.projectile).map(w => [w.id, w.projectile]));
  const TAU = Math.PI * 2;
  const hash = (x, y) => { let v = Math.imul(x ^ 0x64ab, 374761393) ^ Math.imul(y ^ 0xf8c, 668265263); v = Math.imul(v ^ v >>> 13, 1274126177); return (v ^ v >>> 16) >>> 0; };
  const mix = (previous, current, alpha) => (previous ?? current) + (current - (previous ?? current)) * alpha;

  class NightRenderer {
    constructor(canvas, reducedMotion = false) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
      this.reducedMotion = reducedMotion; this.chunks = new Map();
      this.camera = { x: 0, y: 0 }; this.alpha = 1;
      this.worldWidth = 0; this.worldHeight = 0;
    }
    makeCanvas(width, height) {
      const canvas = this.canvas.ownerDocument.createElement('canvas');
      canvas.width = Math.ceil(width); canvas.height = Math.ceil(height); return canvas;
    }
    resize(width, height, dpr = 1) {
      this.width = width; this.height = height; this.dpr = Math.min(dpr, 2);
      this.cols = Math.max(35, Math.min(170, Math.floor(width / (width < 600 ? 7.8 : 9.1))));
      this.cellW = width / this.cols; this.cellH = this.cellW * 1.64;
      this.scaleX = this.cellW / 10; this.scaleY = this.cellH / 16;
      this.rows = Math.ceil(height / this.cellH);
      this.enemyCells = new Uint8Array(this.cols * this.rows); this.renderedEnemies = 0;
      this.canvas.width = Math.round(width * this.dpr); this.canvas.height = Math.round(height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      // Rasterize each ASCII character once. Running frames only copy cached pixels.
      this.glyphW = Math.ceil(this.cellW * this.dpr) + 2;
      this.glyphH = Math.ceil(this.cellH * this.dpr) + 2;
      this.atlas = this.makeCanvas(this.glyphW * 95, this.glyphH * PALETTE.length);
      const ctx = this.atlas.getContext('2d');
      ctx.font = (this.cellW / .6 * this.dpr).toFixed(2) + 'px "Courier New", monospace'; ctx.textBaseline = 'top';
      for (let ink = 0; ink < PALETTE.length; ink++) {
        ctx.fillStyle = PALETTE[ink];
        for (let code = 32; code <= 126; code++) ctx.fillText(String.fromCharCode(code), (code - 32) * this.glyphW, ink * this.glyphH);
      }
      this.chunks.clear();
    }
    glyph(ctx, x, y, ch, ink = 1) {
      const code = ch.charCodeAt(0); if (code <= 32 || code > 126) return;
      ctx.drawImage(this.atlas, (code - 32) * this.glyphW, ink * this.glyphH, this.glyphW, this.glyphH,
        x, y, this.glyphW / this.dpr, this.glyphH / this.dpr);
    }
    sprite(ctx, x, y, value, ink = 1) {
      const lines = value.split('\n'), width = Math.max(...lines.map(l => l.length)) * this.cellW;
      x -= width / 2; y -= lines.length * this.cellH / 2;
      for (let j = 0; j < lines.length; j++) for (let i = 0; i < lines[j].length; i++) this.glyph(ctx, x + i * this.cellW, y + j * this.cellH, lines[j][i], ink);
    }
    point(x, y) { return { x: (x - this.camera.x) * this.scaleX + this.width / 2, y: (y - this.camera.y) * this.scaleY + this.height / 2 }; }
    position(entity) { return { x: mix(entity.prevX, entity.x, this.alpha), y: mix(entity.prevY, entity.y, this.alpha) }; }
    world(x, y, value, ink = 1) {
      const p = this.point(x, y);
      if (p.x < -80 || p.x > this.width + 80 || p.y < -80 || p.y > this.height + 80) return;
      this.sprite(this.ctx, p.x, p.y, value, ink);
    }
    circle(x, y, radius, ink, glyph = '.') {
      const center = this.point(x, y);
      if (center.x + radius * this.scaleX < 0 || center.x - radius * this.scaleX > this.width || center.y + radius * this.scaleY < 0 || center.y - radius * this.scaleY > this.height) return;
      const steps = Math.max(18, Math.ceil(radius / 4));
      for (let i = 0; i < steps; i++) { const a = i / steps * TAU; this.world(x + Math.cos(a) * radius, y + Math.sin(a) * radius, glyph, ink); }
    }
    sealedWall(x, y, radius) {
      const steps = Math.ceil(TAU * radius / 10), points = [];
      this.ctx.fillStyle = '#15291c';
      for (let i = 0; i < steps; i++) {
        const a = i / steps * TAU, wx = x + Math.cos(a) * radius, wy = y + Math.sin(a) * radius, p = this.point(wx, wy);
        points.push({ x: wx, y: wy });
        this.ctx.fillRect(p.x - this.cellW * .8, p.y - this.cellH * .65, this.cellW * 1.6, this.cellH * 1.3);
      }
      for (const p of points) this.world(p.x, p.y, '#', 6);
    }
    line(a, b, ink, glyph, zigzag = false) {
      const length = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.ceil(length / 11);
      for (let i = 0; i <= steps; i++) {
        const t = steps ? i / steps : 0, wave = zigzag && i > 0 && i < steps ? Math.sin(i * 2.7) * 10 : 0;
        this.world(a.x + (b.x - a.x) * t + wave, a.y + (b.y - a.y) * t - wave * .7, glyph, ink);
      }
    }
    chunk(xx, yy) {
      const key = xx + ',' + yy;
      if (this.chunks.has(key)) return this.chunks.get(key);
      const tileW = 400, tileH = 320, left = xx * tileW, top = yy * tileH;
      const canvas = this.makeCanvas(tileW * this.scaleX * this.dpr, tileH * this.scaleY * this.dpr), ctx = canvas.getContext('2d', { alpha: false });
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.fillStyle = '#15291c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const paint = (x, y, sprite, ink) => this.sprite(ctx, (x - left) * this.scaleX, (y - top) * this.scaleY, sprite, ink);
      for (let y = top; y < top + tileH; y += 16) for (let x = left; x < left + tileW; x += 10) {
        const v = hash(x / 10, y / 16);
        if (x < 5 || x > this.worldWidth - 5 || y < 5 || y > this.worldHeight - 5) paint(x, y, (x + y) % 3 ? '#' : ':', 1);
        else if (v % 23 === 0) paint(x, y, '.', 0);
        else if (v % 107 === 0) paint(x, y, "'", 0);
      }
      for (let y = Math.floor((top - 80) / 110); y <= Math.ceil((top + tileH + 80) / 110); y++) for (let x = Math.floor((left - 80) / 130); x <= Math.ceil((left + tileW + 80) / 130); x++) {
        const v = hash(x, y), wx = x * 130 + v % 59, wy = y * 110 + (v >>> 8) % 41, type = v % 11;
        if (wx < 45 || wy < 45 || wx > this.worldWidth - 45 || wy > this.worldHeight - 45) continue;
        if (type < 3) paint(wx, wy, ',,\n/|', 0);
        else if (type === 5) paint(wx, wy, '-+-', 0);
      }
      // Bounded cache: scrolling never keeps the entire cemetery in memory.
      if (this.chunks.size >= 36) this.chunks.delete(this.chunks.keys().next().value);
      this.chunks.set(key, canvas); return canvas;
    }
    scenery() {
      const left = this.camera.x - this.width / this.scaleX / 2, top = this.camera.y - this.height / this.scaleY / 2;
      for (let y = Math.floor(top / 320); y <= Math.floor((top + this.height / this.scaleY) / 320); y++) for (let x = Math.floor(left / 400); x <= Math.floor((left + this.width / this.scaleX) / 400); x++) {
        const p = this.point(x * 400, y * 320);
        this.ctx.drawImage(this.chunk(x, y), p.x, p.y, 400 * this.scaleX, 320 * this.scaleY);
      }
    }
    weaponInk(weapon, ink) { return weapon && weapon === this.highlightWeapon ? 13 : ink; }
    facingSprite(game) {
      const p = game.player, direction = Math.abs(p.dirX) >= Math.abs(p.dirY) ? p.dirX < 0 ? 'left' : 'right' : p.dirY < 0 ? 'up' : 'down';
      return game.character.facingSprites?.[direction] || game.character.sprite;
    }
    render(game, camera, alpha = 1) {
      if (this.worldWidth !== game.width || this.worldHeight !== game.height) { this.worldWidth = game.width; this.worldHeight = game.height; this.chunks.clear(); }
      this.camera = camera; this.alpha = Math.max(0, Math.min(1, alpha)); this.scenery();
      this.enemyCells.fill(0); this.renderedEnemies = 0;
      const halfW = this.width / this.scaleX / 2, halfH = this.height / this.scaleY / 2;
      for (const block of game.visibleObstacles(camera.x - halfW - 80, camera.y - halfH - 80, camera.x + halfW + 80, camera.y + halfH + 80)) this.world(block.x, block.y, block.sprite, block.ink);
      for (const pool of game.pools) {
        const weapon = pool.kind === 'water' ? 'water' : 'poison';
        this.circle(pool.x, pool.y, pool.radius, this.weaponInk(weapon, pool.kind === 'water' ? 9 : 3), '~');
        for (let i = 0; i < 8; i++) { const a = i * 2.4; this.world(pool.x + Math.cos(a) * pool.radius * .55, pool.y + Math.sin(a) * pool.radius * .55, '.', this.weaponInk(weapon, pool.kind === 'water' ? 9 : 2)); }
        this.world(pool.x, pool.y, pool.kind === 'water' ? '{~}' : 'x', this.weaponInk(weapon, pool.kind === 'water' ? 9 : 3));
      }
      for (const m of game.meteors) {
        const weapon = m.kind === 'hammer' ? 'hammer' : m.kind === 'echo' ? 'lightning' : m.kind === 'bird' ? 'birds' : m.kind === 'ebony' ? 'ebony' : 'meteor';
        const bird = ['bird','ebony'].includes(m.kind), ink = m.kind === 'bird' ? 13 : m.kind === 'ebony' ? 9 : 7;
        this.circle(m.x,m.y,m.radius,this.weaponInk(weapon,bird ? ink : 6),':');
        this.world(m.x,m.y,m.kind === 'hammer' ? '[T]' : m.kind === 'echo' ? '[Z]' : bird ? (Math.sin(game.time*12)>0 ? '\\v/' : '<v>') : '[X]',this.weaponInk(weapon,ink));
      }
      for (const r of game.rings) {
        const t = 1-r.life/r.maxLife;
        if (r.kind === 'pentagram') { const emblemRadius = Math.min(r.radius*.8,Math.min(this.width/this.scaleX,this.height/this.scaleY)*.42); const vertices = Array.from({length:5},(_,i)=>({x:r.x+Math.cos(-Math.PI/2+i*TAU/5)*emblemRadius,y:r.y+Math.sin(-Math.PI/2+i*TAU/5)*emblemRadius})); for(let i=0;i<5;i++) this.line(vertices[i],vertices[(i+2)%5],this.weaponInk(r.weapon,5),'*'); this.circle(r.x,r.y,emblemRadius*1.06,this.weaponInk(r.weapon,5),':'); }
        else this.circle(r.x,r.y,r.radius*Math.sqrt(t),this.weaponInk(r.weapon,t<.7 ? (r.ink ?? 7) : 1),r.glyph || (t<.45 ? '+' : '.'));
      }
      if (game.levels.blades && game.fireMode === 'auto') this.circle(game.player.x, game.player.y, game.bladeRadius, this.weaponInk('blades',game.isEvolved('blades') ? 9 : 0));
      if (game.levels.garlic && game.fireMode === 'auto') this.circle(game.player.x, game.player.y, (75 + game.levels.garlic * 15) * game.area, this.weaponInk('garlic',3), '.');
      if (game.isEvolved('boomerang') && game.fireMode === 'auto') { this.circle(game.player.x, game.player.y, game.mikoleninRadius, 13, '+'); this.world(game.player.x, game.player.y - 52, '{M}', this.weaponInk('boomerang',7)); }
      for (const s of game.slashes) {
        if (s.glyph === '[=]') {
          const reach = s.radius * (.3 + .7 * Math.sin(Math.PI * Math.max(0, Math.min(1, 1 - s.life / .28))));
          this.world(s.x + Math.cos(s.angle) * reach, s.y + Math.sin(s.angle) * reach, '[=]', this.weaponInk(s.weapon,s.ink)); continue;
        }
        for (let a = -.95; a <= .95; a += .13) this.world(s.x + Math.cos(s.angle + a) * s.radius, s.y + Math.sin(s.angle + a) * s.radius, s.glyph || '/', this.weaponInk(s.weapon,s.ink ?? 8));
      }
      const megaBodies = [];
      for (const e of game.enemies) {
        const ink = e.flash > 0 ? 8 : e.chilledTill > game.time || (game.freezes.get(e.id) || 0) > game.time ? 9 : e.ink, p = this.position(e);
        if (e.ai === 'darklord' && e.windup > 0) for (const offset of [-.45, 0, .45]) { const angle = Math.atan2(e.chargeY, e.chargeX) + offset; this.line(p, { x: p.x + Math.cos(angle) * Math.min(game.width, game.height) / 2, y: p.y + Math.sin(angle) * Math.min(game.width, game.height) / 2 }, 13, ':'); }
        if (e.windup > 0 && e.ai === 'blink') { this.circle(e.targetX, e.targetY, 32, 6, '!'); this.world(e.targetX, e.targetY, '[!]', 7); }
        const screen = this.point(p.x, p.y);
        if (screen.x < -35 || screen.x > this.width + 35 || screen.y < -45 || screen.y > this.height + 45) continue;
        // Thousands of overlapping bodies share a visible ASCII cell. Composite
        // one representative there; every enemy still runs in the simulation.
        if (game.enemies.length > 250 && !e.boss) {
          const x = Math.max(0, Math.min(this.cols - 1, Math.floor(screen.x / this.cellW)));
          const y = Math.max(0, Math.min(this.rows - 1, Math.floor(screen.y / this.cellH))), key = y * this.cols + x;
          if (this.enemyCells[key]) continue;
          this.enemyCells[key] = 1;
        }
        this.renderedEnemies++;
        const sprite = e.frames ? e.frames[Math.floor(game.time * 6 + e.phase) % e.frames.length] : e.kind === 'bat' ? (Math.sin(game.time * 12 + e.phase) > 0 ? '\\v/' : '<v>') : e.sprite;
        if (e.mega) megaBodies.push({ p, sprite, ink });
        this.world(p.x, p.y, sprite, ink);
        if (game.holyMarks.has(e.id)) this.world(p.x,p.y-25,'+',this.weaponInk('lightStaff',7));
        if (e.hp < e.maxHp && e.maxHp > 70) this.world(p.x, p.y - 38, '-'.repeat(Math.ceil(e.hp / e.maxHp * 5)), 6);
        if (e.windup > 0) {
          this.world(p.x, p.y - 52, '!', 7);
          if (e.ai === 'charge') this.line(p, { x: p.x + e.chargeX * 180, y: p.y + e.chargeY * 180 }, 6, ':');
        }
      }
      for (const { p, sprite, ink } of megaBodies) {
        this.world(p.x - 2, p.y, sprite, 4);
        this.world(p.x + 2, p.y, sprite, 4);
        this.world(p.x, p.y, sprite, ink);
        this.world(p.x, p.y - 9, '::', 13);
        this.world(p.x, p.y - 48, 'DAR VETROV', 13);
      }
      for (const shot of game.enemyShots) { const p = this.position(shot); this.world(p.x, p.y, shot.glyph, shot.ink); }
      for (const s of game.relics) {
        const p = this.position(s), ballistic = BALLISTICS[s.kind];
        if (ballistic) {
          if (s.chargeLeft > 0) { this.circle(p.x,p.y,22,this.weaponInk(s.kind,9),'+'); this.world(p.x,p.y,Math.floor(game.time*12)%2 ? '(o)' : '(O)',this.weaponInk(s.kind,9)); continue; }
          if (s.kind === 'flamethrower') {
            const speed = Math.hypot(s.vx,s.vy) || 1, dx = s.vx / speed, dy = s.vy / speed;
            for (let i=0;i<4;i++) { const flicker = Math.sin(game.time * 23 + i * 2 + s.x * .03) * (4 + i * 2); this.world(p.x - dx * i * 11 - dy * flicker,p.y - dy * i * 11 + dx * flicker,i % 2 ? '~' : '*',this.weaponInk(s.kind,i === 3 ? 7 : 12)); }
            this.world(p.x,p.y,Math.floor(game.time * 15 + s.x) % 2 ? ')}' : '{~',this.weaponInk(s.kind,12)); continue;
          }
          if (s.kind === 'gauss') this.world(p.x - s.vx * .015,p.y - s.vy * .015,'===',this.weaponInk(s.kind,ballistic.ink));
          this.world(p.x,p.y,ballistic.glyph,this.weaponInk(s.kind,ballistic.ink)); continue;
        }
        const glyph = s.kind === 'axe' ? ['/P','-P','P\\'][Math.floor(game.time * 9) % 3] : s.kind === 'fireball' ? '(@)' : s.kind === 'rune' ? ['<+>','{|}','[#]','/|\\'][Math.floor(game.time*8)%4] : s.kind === 'pistol' ? '=' : s.kind === 'sling' ? 'o' : '-->';
        this.world(p.x,p.y,glyph,this.weaponInk(s.kind,s.kind === 'fireball' ? 12 : s.kind === 'rune' ? 9 : 8));
      }
      for (const b of game.biblePositions()) this.world(b.x, b.y, game.isEvolved('bible') ? '[B!]' : '[B]', this.weaponInk('bible',game.isEvolved('bible') ? 5 : 7));
      for (const whip of game.bossWhips) this.line(whip, { x: whip.x + Math.cos(whip.angle) * whip.radius, y: whip.y + Math.sin(whip.angle) * whip.radius }, 13, '~', true);
      for (const s of game.shots) { const p = this.position(s); this.world(p.x - s.vx * .022, p.y - s.vy * .022, Math.abs(s.vy) < Math.abs(s.vx) * .45 ? '-' : s.vx * s.vy > 0 ? '\\' : '/', this.weaponInk('needle',6)); this.world(p.x, p.y, '*', this.weaponInk('needle',7)); }
      for (const b of game.boomerangs) { const p = this.position(b); this.world(p.x, p.y, ['<)>', '/|\\', '<(>', '\\|/'][Math.floor(b.age * 16) % 4], this.weaponInk('boomerang',7)); }
      for (const arc of game.arcs) for (let i = 1; i < arc.points.length; i++) this.line(arc.points[i - 1], arc.points[i], this.weaponInk(arc.weapon,arc.life > .12 ? 8 : 5), i % 2 ? '~' : '/', true);
      for (const p of game.particles) this.world(p.x, p.y, p.life > .25 ? '+' : '.', this.weaponInk(p.weapon,p.ink));
      for (const b of game.bladePositions()) this.world(b.x, b.y, game.isEvolved('blades') ? '/+' : Math.sin(b.angle * 2) > 0 ? '/' : '\\', this.weaponInk('blades',game.isEvolved('blades') ? 9 : 8));
      // Pickups use their own brighter inks and remain readable over combat effects.
      for (const g of game.gems) this.world(g.x, g.y, g.value >= 6 ? '<*>' : '*', 10);
      for (const h of game.hearts) this.world(h.x, h.y, '[+]', 11);
      for (const chest of game.chests) { this.world(chest.x, chest.y, chest.canEvolve ? ' ___\n[E*]\n|__|' : ' ___\n[?*]\n|__|', chest.canEvolve ? 5 : 7); this.world(chest.x, chest.y - 36, Math.floor(game.time * 3) % 2 ? '*' : '+', 8); }
      for (const cache of game.treasures) if (!game.treasuresTaken.has(cache.id)) this.world(cache.x, cache.y, '[X]', 7);
      const arena = game.encounter;
      if (arena) {
        const warning = arena.phase === 'warning', radius = arena.radius * (warning ? .85 + .15 * (1 - arena.warningLeft / 5) : 1);
        if (warning) this.circle(arena.x, arena.y, radius, 7, ':');
        else this.sealedWall(arena.x, arena.y, radius);
      }
      const p = game.player, position = this.position(p);
      const ink = p.invulnerable > 0 && Math.floor(game.time * 12) % 2 ? 9 : game.character.ink;
      this.world(position.x, position.y, this.facingSprite(game), ink);
      if (game.shieldCharges > 0 && game.shieldUntil > game.time) { this.circle(position.x, position.y, 38, this.weaponInk('laurel',9), '+'); this.world(position.x, position.y - 45, '[' + game.shieldCharges + ']', this.weaponInk('laurel',9)); }
      if (game.fireMode === 'manual') { const target = game.aimPoint(game.selectedWeapon === 'poison' ? 360 : 620); this.world(target.x, target.y, '[+]', this.weaponInk(game.selectedWeapon,7)); }
      if (p.dash > 0) this.circle(position.x, position.y, 24, 2, ':');
      if (p.invulnerable > 0) { this.world(position.x - 33, position.y, '[', 7); this.world(position.x + 33, position.y, ']', 7); }
      if (!this.reducedMotion && game.damageFlash > 0) { this.ctx.fillStyle = 'rgba(172,49,27,' + game.damageFlash * .7 + ')'; this.ctx.fillRect(0, 0, this.width, this.height); }
    }
  }
  root.NightRenderer = NightRenderer;
})(typeof globalThis !== 'undefined' ? globalThis : window);
