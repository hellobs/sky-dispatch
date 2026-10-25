/* SkyDispatch · 空域：网格、起降点、禁飞区、风暴 */
(function () {
  window.SD = window.SD || {};
  const SD = window.SD;
  const C = SD.CONFIG;

  class WeatherBlob {
    constructor() {
      this.r = SD.rand(1.8, 2.6);
      this.x = SD.rand(this.r + 1, C.GRID - this.r - 1);
      this.y = SD.rand(this.r + 1, C.GRID - this.r - 1);
      const a = SD.rand(0, Math.PI * 2);
      const v = SD.rand(0.28, 0.45);
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
      ctx.font = '10px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('风暴', px, py - pr - 4);
      ctx.restore();
    }
  }

  class Airspace {
    constructor() { this.reset(); }
    reset() {
      this.weather = [new WeatherBlob()];
      this.weatherFlags = C.WEATHER_AT.map(() => false);
    }
    update(dt, elapsed) {
      this.weather.forEach((w) => w.update(dt));
      C.WEATHER_AT.forEach((at, i) => {
        if (!this.weatherFlags[i] && elapsed >= at) {
          this.weatherFlags[i] = true;
          this.weather.push(new WeatherBlob());
        }
      });
    }
    inWeather(x, y) { return this.weather.some((w) => w.contains(x, y)); }
    inNoFly(x, y) { return C.NOFLY.some((z) => SD.dist(x, y, z.x, z.y) < z.r); }
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
    drawBase(ctx) {
      const N = C.GRID, S = N * C.CELL;
      ctx.fillStyle = '#0a1120';
      ctx.fillRect(0, 0, S, S);
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
      // 起降点
      C.PADS.forEach((p) => {
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
        ctx.restore();
      });
      // 禁飞区
      C.NOFLY.forEach((z) => {
        const px = z.x * C.CELL, py = z.y * C.CELL, pr = z.r * C.CELL;
        ctx.save();
        ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip();
        ctx.strokeStyle = 'rgba(255,84,112,0.28)';
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
        ctx.strokeStyle = 'rgba(255,84,112,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,84,112,0.9)';
        ctx.font = '10px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('禁飞区', px, py - pr - 4);
        ctx.restore();
      });
    }
    drawWeather(ctx) {
      this.weather.forEach((w) => w.draw(ctx));
    }
  }

  SD.Airspace = Airspace;
})();
