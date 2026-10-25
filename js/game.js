/* SkyDispatch · 游戏主循环与规则结算 */
(function () {
  window.SD = window.SD || {};
  const SD = window.SD;
  const C = SD.CONFIG;

  class Game {
    constructor(canvas, ui) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ui = ui;
      SD.game = this; // 调试探针
      this.state = 'menu';
      this.airspace = new SD.Airspace();
      this.board = null;
      this.drones = [];
      this.floats = [];
      this.preview = null;
      this.lastTs = null;
    }

    start() {
      this.airspace.reset();
      this.board = new SD.MissionBoard(this.airspace);
      this.drones = [];
      this.floats = [];
      this.preview = null;
      this.score = 0;
      this.crashes = 0;
      this.weatherCrashes = 0;
      this.zoneViolations = 0;
      this.elapsed = 0;
      this.uiTimer = 0;
      this.state = 'running';
      this.ui.hideOverlays();
      this.ui.setPauseEnabled(true);
      this.ui.renderQueue(this.board, this);
      this.updateHud();
    }

    togglePause() {
      if (this.state === 'running') {
        this.state = 'paused';
        this.ui.showPause();
      } else if (this.state === 'paused') {
        this.state = 'running';
        this.ui.hideOverlays();
      }
    }

    approveRequest(id) {
      if (this.state !== 'running') return;
      const req = this.board.approve(id);
      if (req) this.drones.push(new SD.Drone(req));
    }

    rejectRequest(id) {
      if (this.state !== 'running') return;
      this.board.reject(id);
    }

    /* 单帧推进：调度（rAF/兜底定时器）由 main.js 负责 */
    frame(ts) {
      if (this.lastTs === null) this.lastTs = ts;
      const dt = Math.min((ts - this.lastTs) / 1000, 0.3);
      this.lastTs = ts;
      if (this.state === 'running') this.update(dt);
      this.draw();
    }

    update(dt) {
      this.elapsed += dt;
      if (this.elapsed >= C.ROUND_SECONDS) { this.end(); return; }

      this.airspace.update(dt, this.elapsed);
      this.board.maybeSpawn(dt, this.elapsed);

      const expired = this.board.update(dt);
      if (expired > 0) {
        this.score -= expired * C.PENALTY.expire;
        this.addFloat(C.GRID / 2, 2.5, `-${expired * C.PENALTY.expire} 逾期`, '#ffb545');
      }

      // 飞行推进与到达结算
      const kept = [];
      for (const d of this.drones) {
        const landed = d.update(dt);
        if (landed) {
          // 目标点可能已被风暴/禁飞区覆盖
          if (this.airspace.inWeather(d.x, d.y) || this.airspace.inNoFly(d.x, d.y)) {
            d.kill(this.airspace.inWeather(d.x, d.y) ? 'weather' : 'zone');
            this.applyDeath(d);
            kept.push(d);
          } else {
            this.board.completed++;
            this.score += C.SCORE[d.type];
            this.addFloat(d.x, d.y, `+${C.SCORE[d.type]}`, SD.TYPE_STYLE[d.type].color);
          }
        } else {
          kept.push(d);
        }
      }
      this.drones = kept;

      // 风暴与禁飞区
      for (const d of this.drones) {
        if (!d.alive) continue;
        if (this.airspace.inWeather(d.x, d.y)) { d.kill('weather'); this.applyDeath(d); }
        else if (this.airspace.inNoFly(d.x, d.y)) { d.kill('zone'); this.applyDeath(d); }
      }

      // 空中冲突（两两判定）
      for (let i = 0; i < this.drones.length; i++) {
        const a = this.drones[i];
        if (!a.alive) continue;
        for (let j = i + 1; j < this.drones.length; j++) {
          const b = this.drones[j];
          if (!b.alive) continue;
          if (SD.dist(a.x, a.y, b.x, b.y) < C.COLLIDE_DIST) {
            a.kill('crash');
            b.kill('crash');
            this.crashes++;
            this.score -= C.PENALTY.crash;
            this.addFloat((a.x + b.x) / 2, (a.y + b.y) / 2, `-${C.PENALTY.crash} 冲突`, '#ff5470');
          }
        }
      }

      // 残骸清理与飘字
      this.drones = this.drones.filter((d) => !d.gone);
      this.floats.forEach((f) => { f.t += dt; f.y -= dt * 0.8; });
      this.floats = this.floats.filter((f) => f.t < 1.2);

      // 申请队列刷新（节流）
      this.uiTimer += dt;
      if (this.uiTimer > 0.12) {
        this.uiTimer = 0;
        this.ui.renderQueue(this.board, this);
      }
      this.updateHud();
    }

    applyDeath(d) {
      if (d.deathCause === 'weather') {
        this.weatherCrashes++;
        this.score -= C.PENALTY.weather;
        this.addFloat(d.x, d.y, `-${C.PENALTY.weather} 风暴`, '#9fb3c8');
      } else if (d.deathCause === 'zone') {
        this.zoneViolations++;
        this.score -= C.PENALTY.zone;
        this.addFloat(d.x, d.y, `-${C.PENALTY.zone} 禁飞`, '#ffb545');
      }
      // crash 由冲突判定处统一记账
    }

    addFloat(x, y, text, color) {
      this.floats.push({ x, y, text, color, t: 0 });
    }

    stats() {
      const denom = this.board.completed + this.board.expired;
      return {
        score: this.score,
        completed: this.board.completed,
        expired: this.board.expired,
        rejected: this.board.rejected,
        onTime: denom ? Math.round((this.board.completed / denom) * 100) : 100,
        crashes: this.crashes,
        weatherCrashes: this.weatherCrashes,
        zoneViolations: this.zoneViolations,
      };
    }

    end() {
      this.state = 'over';
      this.board.requests = [];
      this.ui.renderQueue(this.board, this);
      this.ui.setPauseEnabled(false);
      this.updateHud();
      this.ui.showReport(this.stats());
    }

    updateHud() {
      this.ui.setHud({
        time: SD.fmtTime(C.ROUND_SECONDS - this.elapsed),
        score: this.score,
        air: this.drones.filter((d) => d.alive).length,
        done: this.board.completed,
        crashes: this.crashes,
      });
    }

    draw() {
      const ctx = this.ctx;
      this.airspace.drawBase(ctx);
      if (this.preview && this.state === 'running') this.drawPreview(ctx);
      this.drones.forEach((d) => d.draw(ctx));
      this.airspace.drawWeather(ctx);
      this.floats.forEach((f) => {
        ctx.save();
        ctx.globalAlpha = SD.clamp(1 - f.t / 1.2, 0, 1);
        ctx.fillStyle = f.color;
        ctx.font = 'bold 12px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x * C.CELL, f.y * C.CELL);
        ctx.restore();
      });
    }

    drawPreview(ctx) {
      const r = this.preview;
      const ox = (r.origin.x + 0.5) * C.CELL, oy = (r.origin.y + 0.5) * C.CELL;
      const dx = (r.dest.x + 0.5) * C.CELL, dy = (r.dest.y + 0.5) * C.CELL;
      const col = SD.TYPE_STYLE[r.type].color;
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(dx, dy); ctx.stroke();
      ctx.beginPath(); ctx.arc(ox, oy, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(dx, dy, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  SD.Game = Game;
})();
