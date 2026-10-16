(function (root) {
  'use strict';
  const PALETTE = ['#333a2c', '#64654c', '#82d2ad', '#acb77e', '#cfc7af', '#ac8db8', '#df7054', '#f4c77f', '#f0edd0', '#79bace', '#c6ffdc', '#ffd0b8'];
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
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.fillStyle = '#131510'; ctx.fillRect(0, 0, canvas.width, canvas.height);
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
        if (type < 2) paint(wx, wy, ' ._.\n |+|\n_|_|_', 1);
        else if (type === 2) paint(wx, wy, ' \\|/\n--Y--\n  |\n /|\\', 0);
        else if (type === 3) paint(wx, wy, '__\n/..\\', 0);
        else if (type === 4) paint(wx, wy, ',,\n/|', 0);
        else if (type === 5) paint(wx, wy, '-+-\n |', 1);
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
    render(game, camera, alpha = 1) {
      if (this.worldWidth !== game.width || this.worldHeight !== game.height) { this.worldWidth = game.width; this.worldHeight = game.height; this.chunks.clear(); }
      this.camera = camera; this.alpha = Math.max(0, Math.min(1, alpha)); this.scenery();
      this.enemyCells.fill(0); this.renderedEnemies = 0;
      for (const pool of game.pools) {
        this.circle(pool.x, pool.y, pool.radius, 3, '~');
        for (let i = 0; i < 8; i++) { const a = i * 2.4; this.world(pool.x + Math.cos(a) * pool.radius * .55, pool.y + Math.sin(a) * pool.radius * .55, '.', 2); }
        this.world(pool.x, pool.y, 'x', 3);
      }
      for (const m of game.meteors) { this.circle(m.x, m.y, m.radius, 6, ':'); this.world(m.x, m.y, '[X]', 7); }
      for (const r of game.rings) { const t = 1 - r.life / r.maxLife; this.circle(r.x, r.y, r.radius * Math.sqrt(t), t < .7 ? (r.ink ?? 7) : 1, r.glyph || (t < .45 ? '+' : '.')); }
      if (game.levels.blades && game.fireMode === 'auto') this.circle(game.player.x, game.player.y, 88, 0);
      for (const s of game.slashes) for (let a = -.95; a <= .95; a += .13) this.world(s.x + Math.cos(s.angle + a) * s.radius, s.y + Math.sin(s.angle + a) * s.radius, '/', 8);
      for (const e of game.enemies) {
        const ink = e.flash > 0 ? 8 : e.chilledTill > game.time ? 9 : e.ink, p = this.position(e);
        const screen = this.point(p.x, p.y);
        if (screen.x < -35 || screen.x > this.width + 35 || screen.y < -45 || screen.y > this.height + 45) continue;
        // Thousands of overlapping bodies share a visible ASCII cell. Composite
        // one representative there; every enemy still runs in the simulation.
        if (game.enemies.length > 1000 && e.kind !== 'reaper') {
          const x = Math.max(0, Math.min(this.cols - 1, Math.floor(screen.x / this.cellW)));
          const y = Math.max(0, Math.min(this.rows - 1, Math.floor(screen.y / this.cellH))), key = y * this.cols + x;
          if (this.enemyCells[key]) continue;
          this.enemyCells[key] = 1;
        }
        this.renderedEnemies++;
        const sprite = e.kind === 'ghoul' ? 'z' : e.kind === 'bat' ? (Math.sin(game.time * 12 + e.phase) > 0 ? '\\v/' : '<v>') : e.kind === 'skeleton' ? 'S' : e.kind === 'brute' ? ',_,\n[O]\n/ \\' : ' /W\\\n (x)\n/| |\\';
        this.world(p.x, p.y, sprite, ink);
        if (e.hp < e.maxHp && e.maxHp > 70) this.world(p.x, p.y - 38, '-'.repeat(Math.ceil(e.hp / e.maxHp * 5)), 6);
      }
      for (const s of game.shots) { const p = this.position(s); this.world(p.x - s.vx * .022, p.y - s.vy * .022, Math.abs(s.vy) < Math.abs(s.vx) * .45 ? '-' : s.vx * s.vy > 0 ? '\\' : '/', 6); this.world(p.x, p.y, '*', 7); }
      for (const b of game.boomerangs) { const p = this.position(b); this.world(p.x, p.y, ['<)>', '/|\\', '<(>', '\\|/'][Math.floor(b.age * 16) % 4], 7); }
      for (const arc of game.arcs) for (let i = 1; i < arc.points.length; i++) this.line(arc.points[i - 1], arc.points[i], arc.life > .12 ? 8 : 5, i % 2 ? '~' : '/', true);
      for (const p of game.particles) this.world(p.x, p.y, p.life > .25 ? '+' : '.', p.ink);
      for (const b of game.bladePositions()) this.world(b.x, b.y, Math.sin(b.angle * 2) > 0 ? '/' : '\\', 8);
      // Pickups use their own brighter inks and remain readable over combat effects.
      for (const g of game.gems) this.world(g.x, g.y, g.value >= 6 ? '<*>' : '*', 10);
      for (const h of game.hearts) this.world(h.x, h.y, '[+]', 11);
      const p = game.player, position = this.position(p);
      const ink = p.invulnerable > 0 && Math.floor(game.time * 12) % 2 ? 9 : game.character.ink;
      this.world(position.x, position.y, game.character.sprite, ink);
      if (game.fireMode === 'manual') { const target = game.aimPoint(game.selectedWeapon === 'poison' ? 360 : 620); this.world(target.x, target.y, '[+]', 7); }
      if (p.dash > 0) this.circle(position.x, position.y, 24, 2, ':');
      if (p.invulnerable > 0) { this.world(position.x - 33, position.y, '[', 7); this.world(position.x + 33, position.y, ']', 7); }
      if (!this.reducedMotion && game.damageFlash > 0) { this.ctx.fillStyle = 'rgba(172,49,27,' + game.damageFlash * .7 + ')'; this.ctx.fillRect(0, 0, this.width, this.height); }
    }
  }
  root.NightRenderer = NightRenderer;
})(typeof globalThis !== 'undefined' ? globalThis : window);
