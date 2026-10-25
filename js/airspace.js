/* SkyDispatch · 空域：网格、起降点、禁飞区、风暴、临时禁飞区 */
(function () {
  window.SD = window.SD || {};
  const SD = window.SD;
  const C = SD.CONFIG;

  class WeatherBlob {
    constructor(speedMult) {
      this.r = SD.rand(1.8, 2.6);
      // 初始位置避开起降点，避免开局即压坪
      for (let i = 0; i < 20; i++) {
        this.x = SD.rand(this.r + 1, C.GRID - this.r - 1);
        this.y = SD.rand(this.r + 1, C.GRID - this.r - 1);
        if (!C.PADS.some((p) => SD.dist(this.x, this.y, p.x, p.y) < this.r + 1.5)) break;
      }
      const a = SD.rand(0, Math.PI * 2);
      const v = SD.rand(0.32, 0.5) * (speedMult || 1); // 越晚出现的风暴飘得越快
      this.vx = Math.cos(a) * v;
      this.vy = Math.sin(a) * v;
      this.t = 0;
    }
    update(dt) {
      this.t += dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const m = this.r + 0.5;
      if (this.x < m) { this.x = m; this.vx *= -1; }
      if (this.x > C.GRID - m) { this.x = C.GRID - m; this.vx *= -1; }
      if (this.y < m) { this.y = m; this.vy *= -1; }
      if (this.y > C.GRID - m) { this.y = C.GRID - m; this.vy *= -1; }
    }
    contains(x, y) { return SD.dist(x, y, this.x, this.y) < this.r; }
    draw(ctx) {
      const px = this.x * C.CELL, py = this.y * C.CELL, pr = this.r * C.CELL;
      const ts = SD.textScale || 1;
      const pulse = 0.16 + 0.05 * Math.sin(this.t * 1.6);
      ctx.save();
      ctx.fillStyle = '#7f9bb9';
      ctx.globalAlpha = pulse;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = pulse + 0.08;
      ctx.beginPath();
      ctx.arc(px + Math.sin(this.t * 0.9) * pr * 0.22, py + Math.cos(this.t * 0.7) * pr * 0.22, pr * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#b8c9dc';
      ctx.font = Math.round(10 * ts) + 'px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('风暴', px, py - pr - 4 * ts);
      ctx.restore();
    }
  }

  class Airspace {
    constructor() {
      this.onTempSpawn = null;  // 由 Game 注入：临时禁飞区进入预警
      this.onTempActive = null; // 由 Game 注入：临时禁飞区生效
      this.reset();
    }
    reset() {
      this.weather = [new WeatherBlob()];
      this.weatherFlags = C.WEATHER_AT.map(() => false);
      this.tempZones = []; // { x, y, r, warn, life, phase: 'warn'|'active' }
    }
    update(dt, elapsed) {
      this.weather.forEach((w) => w.update(dt));
      C.WEATHER_AT.forEach((at, i) => {
        if (!this.weatherFlags[i] && elapsed >= at) {
          this.weatherFlags[i] = true;
          this.weather.push(new WeatherBlob(1 + 0.7 * (at / C.ROUND_SECONDS)));
        }
      });
      for (let i = this.tempZones.length - 1; i >= 0; i--) {
        const z = this.tempZones[i];
        if (z.phase === 'warn') {
          z.warn -= dt;
          if (z.warn <= 0) {
            z.phase = 'active';
            if (this.onTempActive) this.onTempActive(z);
          }
        } else {
          z.life -= dt;
          if (z.life <= 0) this.tempZones.splice(i, 1);
        }
      }
    }
    spawnTempZone() {
      for (let i = 0; i < 60; i++) {
        const r = SD.rand(C.TEMP_ZONE.R_MIN, C.TEMP_ZONE.R_MAX);
        const x = SD.rand(r + 2, C.GRID - r - 3);
        const y = SD.rand(r + 2, C.GRID - r - 3);
        // 不许压着起降点，否则起飞即死，太坑
        if (C.PADS.some((p) => SD.dist(x, y, p.x, p.y) < r + 2.5)) continue;
        this.tempZones.push({ x, y, r, warn: C.TEMP_ZONE.WARN, life: C.TEMP_ZONE.LIFE, phase: 'warn' });
        if (this.onTempSpawn) this.onTempSpawn(this.tempZones[this.tempZones.length - 1]);
        return true;
      }
      return false;
    }
    inWeather(x, y) { return this.weather.some((w) => w.contains(x, y)); }
    /* 禁飞判定：固定禁飞区 + 已生效的临时禁飞区（预警期可通行） */
    inNoFly(x, y) {
      if (C.NOFLY.some((z) => SD.dist(x, y, z.x, z.y) < z.r)) return true;
      return this.tempZones.some((z) => z.phase === 'active' && SD.dist(x, y, z.x, z.y) < z.r);
    }
    randomFreeCell(minDistFrom, minDist) {
      for (let i = 0; i < 200; i++) {
        const x = SD.randInt(2, C.GRID - 3);
        const y = SD.randInt(2, C.GRID - 3);
        if (this.inNoFly(x, y)) continue;
        if (SD.dist(x, y, minDistFrom.x, minDistFrom.y) < minDist) continue;
        if (C.PADS.some((p) => p.x === x && p.y === y)) continue;
        return { x, y };
      }
      return { x: SD.randInt(2, C.GRID - 3), y: SD.randInt(2, C.GRID - 3) };
    }
    /* 航线采样：是否穿过某个动态圆形区域（风暴/临时禁飞区） */
    pathHitsCircle(x1, y1, x2, y2, cx, cy, r) {
      const N = 28;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
        if (SD.dist(x, y, cx, cy) < r) return true;
      }
      return false;
    }
    drawBase(ctx) {
      const N = C.GRID, S = N * C.CELL;
      const ts = SD.textScale || 1;
      ctx.fillStyle = '#0a1120';
      ctx.fillRect(0, 0, S, S);
      // 雷达扫描余辉
      const sweep = (Date.now() / 1000 * 0.45) % (Math.PI * 2);
      for (let i = 0; i < 6; i++) {
        const a0 = sweep - i * 0.09;
        ctx.save();
        ctx.globalAlpha = 0.045 * (1 - i / 6);
        ctx.fillStyle = '#38e1ff';
        ctx.beginPath();
        ctx.moveTo(S / 2, S / 2);
        ctx.arc(S / 2, S / 2, S * 0.75, a0 - 0.09, a0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.lineWidth = 1;
      for (let i = 0; i <= N; i++) {
        ctx.strokeStyle = i % 8 === 0 ? 'rgba(96,150,210,0.22)' : 'rgba(96,150,210,0.08)';
        ctx.beginPath();
        ctx.moveTo(i * C.CELL + 0.5, 0);
        ctx.lineTo(i * C.CELL + 0.5, S);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * C.CELL + 0.5);
        ctx.lineTo(S, i * C.CELL + 0.5);
        ctx.stroke();
      }
      // 起降点（编号与申请卡里的 P1–P6 对应）
      C.PADS.forEach((p, i) => {
        const px = p.x * C.CELL + C.CELL / 2, py = p.y * C.CELL + C.CELL / 2;
        ctx.save();
        ctx.strokeStyle = 'rgba(220,235,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, C.CELL * 0.42, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(220,235,255,0.9)';
        ctx.font = 'bold 11px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('H', px, py + 0.5);
        ctx.font = 'bold ' + Math.round(10 * ts) + 'px Consolas, monospace';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(150,180,215,0.85)';
        ctx.fillText('P' + (i + 1), px, py + C.CELL * 0.42 + 11 * ts);
        ctx.restore();
      });
      // 固定禁飞区
      C.NOFLY.forEach((z) => {
        const px = z.x * C.CELL, py = z.y * C.CELL, pr = z.r * C.CELL;
        this.drawZoneBody(ctx, px, py, pr, '禁飞区', 'rgba(255,84,112,', 0.28, 0.8);
      });
    }
    drawZoneBody(ctx, px, py, pr, label, rgb, fillA, lineA) {
      const ts = SD.textScale || 1;
      ctx.save();
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = rgb + fillA + ')';
      ctx.lineWidth = 1;
      for (let d = -pr; d <= pr; d += 7) {
        ctx.beginPath();
        ctx.moveTo(px - pr, py + d);
        ctx.lineTo(px + pr, py + d);
        ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = rgb + lineA + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = rgb + '0.9)';
      ctx.font = Math.round(10 * ts) + 'px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, px, py - pr - 4 * ts);
      ctx.restore();
    }
    drawTempZones(ctx) {
      const ts = SD.textScale || 1;
      this.tempZones.forEach((z) => {
        const px = z.x * C.CELL, py = z.y * C.CELL, pr = z.r * C.CELL;
        if (z.phase === 'warn') {
          const blink = 0.5 + 0.5 * Math.sin(Date.now() / 120);
          ctx.save();
          ctx.globalAlpha = 0.35 + 0.3 * blink;
          ctx.fillStyle = 'rgba(255,181,69,0.10)';
          ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(255,181,69,0.9)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(255,181,69,0.95)';
          ctx.font = 'bold ' + Math.round(10 * ts) + 'px Consolas, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('临时禁飞 ' + Math.ceil(z.warn) + 's', px, py - pr - 4 * ts);
          ctx.restore();
        } else {
          this.drawZoneBody(ctx, px, py, pr, '临时禁飞 ' + Math.ceil(z.life) + 's', 'rgba(255,84,112,', 0.28, 0.9);
        }
      });
    }
    drawWeather(ctx) {
      this.weather.forEach((w) => w.draw(ctx));
    }
  }

  SD.Airspace = Airspace;
})();
