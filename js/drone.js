/* SkyDispatch · 无人机实体 */
(function () {
  window.SD = window.SD || {};
  const SD = window.SD;
  const C = SD.CONFIG;

  const TYPE_STYLE = {
    delivery:   { color: '#38e1ff', label: '配送' },
    inspection: { color: '#ffd166', label: '巡检' },
    rescue:     { color: '#ff7ab8', label: '救援' },
  };
  SD.TYPE_STYLE = TYPE_STYLE;

  const DEATH_COLOR = { crash: '#ff5470', weather: '#9fb3c8', zone: '#ffb545' };

  class Drone {
    constructor(req) {
      this.id = SD.uid();
      this.type = req.type;
      this.x = req.origin.x + 0.5;
      this.y = req.origin.y + 0.5;
      this.tx = req.dest.x + 0.5;
      this.ty = req.dest.y + 0.5;
      this.speed = C.DRONE_SPEED * (req.type === 'rescue' ? C.RESCUE_SPEED_MULT : 1);
      this.heading = Math.atan2(this.ty - this.y, this.tx - this.x);
      this.alive = true;
      this.deathCause = null;
      this.deadTimer = 0;
      this.diverting = false; // 空域管制备降中
      this.trail = [];
    }
    /* 空域管制：改飞最近的起降点备降 */
    divert(tx, ty) {
      this.tx = tx;
      this.ty = ty;
      this.diverting = true;
    }
    /* 返回 true 表示本次更新中落地 */
    update(dt) {
      if (!this.alive) { this.deadTimer += dt; return false; }
      const dx = this.tx - this.x, dy = this.ty - this.y;
      const d = Math.hypot(dx, dy);
      const step = this.speed * dt;
      if (d <= step) {
        this.x = this.tx;
        this.y = this.ty;
        this.alive = false;
        return true;
      }
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      this.heading = Math.atan2(dy, dx);
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > C.TRAIL_LEN) this.trail.shift();
      return false;
    }
    kill(cause) {
      this.alive = false;
      this.deathCause = cause;
      this.deadTimer = 0;
    }
    get gone() {
      return this.deathCause !== null && this.deadTimer > 0.7;
    }
    draw(ctx) {
      if (this.deathCause) {
        const t = Math.min(1, this.deadTimer / 0.7);
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = DEATH_COLOR[this.deathCause] || '#ff5470';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x * C.CELL, this.y * C.CELL, 4 + 24 * t, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
      }
      const col = this.diverting ? '#b8c9dc' : TYPE_STYLE[this.type].color;
      if (this.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        this.trail.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x * C.CELL, p.y * C.CELL);
          else ctx.lineTo(p.x * C.CELL, p.y * C.CELL);
        });
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(this.x * C.CELL, this.y * C.CELL);
      ctx.rotate(this.heading);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, 4.5);
      ctx.lineTo(-2.5, 0);
      ctx.lineTo(-5, -4.5);
      ctx.closePath();
      ctx.fill();
      if (this.diverting) {
        ctx.strokeStyle = '#b8c9dc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 10 + 3 * Math.sin(Date.now() / 150), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  SD.Drone = Drone;
})();
