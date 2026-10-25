/* SkyDispatch · 游戏主循环与规则结算 */
(function () {
  window.SD = window.SD || {};
  const SD = window.SD;
  const C = SD.CONFIG;

  const STEP = 1 / 30; // 物理子步长：大 dt 也按小步推进，防穿透防卡顿

  const INCIDENT = {
    crash:   { text: '冲突', color: '#ff5470' },
    weather: { text: '风暴', color: '#9fb3c8' },
    zone:    { text: '禁飞', color: '#ffb545' },
  };

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
      this.airspace.onTempSpawn = () => this.notify('⚠ 临时禁飞区即将生效，注意改线');
      this.airspace.onTempActive = (zone) => this.divertFlights(zone);
      this.drones = [];
      this.floats = [];
      this.preview = null;
      this.score = 0;
      this.crashes = 0;
      this.weatherCrashes = 0;
      this.zoneViolations = 0;
      this.lives = C.LIVES;
      this.sinceIncident = 0;
      this.combo = 0;
      this.comboBest = 0;
      this.multLevel = 1;
      this.tempTimer = C.TEMP_ZONE.FIRST;
      this.phaseIdx = 0;
      this.shutdown = false;
      this.elapsed = 0;
      this.uiTimer = 0;
      this.state = 'running';
      this.ui.hideOverlays();
      this.ui.setPauseEnabled(true);
      this.ui.resetQueue();
      this.ui.syncQueue(this.board, this);
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

    /* 单帧推进：大 dt 拆成小步物理模拟，状态结束后停止 */
    frame(ts) {
      if (this.lastTs === null) this.lastTs = ts;
      const dt = Math.min((ts - this.lastTs) / 1000, 1.0);
      this.lastTs = ts;
      if (this.state === 'running') this.update(dt);
      this.draw();
    }

    update(dt) {
      let remaining = dt;
      while (remaining > 0.0001 && this.state === 'running') {
        const step = Math.min(remaining, STEP);
        remaining -= step;
        this.step(step);
      }
      // 每帧一次的表现层更新
      this.floats.forEach((f) => { f.t += dt; f.y -= dt * 0.8; });
      this.floats = this.floats.filter((f) => f.t < 1.2);
      this.uiTimer += dt;
      if (this.uiTimer > 0.1) {
        this.uiTimer = 0;
        this.ui.syncQueue(this.board, this);
      }
      this.updateHud();
    }

    step(dt) {
      this.elapsed += dt;
      if (this.elapsed >= C.ROUND_SECONDS) { this.end(); return; }

      this.airspace.update(dt, this.elapsed);

      // 安全盾随无事故时间缓慢恢复
      this.sinceIncident += dt;
      if (this.lives < C.LIVES && this.sinceIncident >= C.SHIELD_REGEN) {
        this.lives++;
        this.sinceIncident = 0;
        this.notify('🛡 安全盾恢复 +1');
      }

      // 临时禁飞区排程：间隔随对局推进越来越短
      this.tempTimer -= dt;
      if (this.tempTimer <= 0) {
        this.airspace.spawnTempZone();
        const t = SD.clamp(this.elapsed / C.ROUND_SECONDS, 0, 1);
        const gap = SD.lerp(C.TEMP_ZONE.GAP_START, C.TEMP_ZONE.GAP_END, t);
        this.tempTimer = gap * SD.rand(0.85, 1.15);
      }

      // 相位播报：每 45 秒空域流量升一级
      const phaseLen = C.ROUND_SECONDS / C.PHASES.length;
      const idx = Math.min(C.PHASES.length - 1, Math.floor(this.elapsed / phaseLen));
      if (idx > this.phaseIdx) {
        this.phaseIdx = idx;
        this.notify(`📈 空域流量升级 · ${C.PHASES[idx]}`);
      }

      this.board.maybeSpawn(dt, this.elapsed);
      const expired = this.board.update(dt);
      if (expired > 0) {
        this.combo = 0;
        this.multLevel = 1;
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
            this.registerIncident(d.deathCause, d.x, d.y);
            kept.push(d);
          } else {
            this.registerDelivery(d);
          }
        } else {
          kept.push(d);
        }
      }
      this.drones = kept;
      if (this.state !== 'running') return;

      // 风暴与禁飞区
      for (const d of this.drones) {
        if (!d.alive) continue;
        if (this.airspace.inWeather(d.x, d.y)) { d.kill('weather'); this.registerIncident('weather', d.x, d.y); }
        else if (this.airspace.inNoFly(d.x, d.y)) { d.kill('zone'); this.registerIncident('zone', d.x, d.y); }
        if (this.state !== 'running') return;
      }

      // 空中冲突（两两判定，一次冲突记一起事故）
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
            this.registerIncident('crash', (a.x + b.x) / 2, (a.y + b.y) / 2, C.PENALTY.crash);
            if (this.state !== 'running') return;
          }
        }
      }

      this.drones = this.drones.filter((d) => !d.gone);
    }

    /* 连续送达奖励（备降不算送达也不打断连击） */
    registerDelivery(d) {
      if (d.diverting) {
        this.board.diverted++;
        this.addFloat(d.x, d.y, '备降完成', '#b8c9dc');
        return;
      }
      this.board.completed++;
      this.combo++;
      this.comboBest = Math.max(this.comboBest, this.combo);
      const mult = this.mult();
      if (mult > this.multLevel) {
        this.multLevel = mult;
        this.notify(`🔥 连续送达 ${this.combo} 单，收益 ×${mult}`);
      }
      const gained = C.SCORE[d.type] * mult;
      this.score += gained;
      this.addFloat(d.x, d.y, `+${gained}${mult > 1 ? ' ×' + mult : ''}`, SD.TYPE_STYLE[d.type].color);
    }

    /* 一起安全事故：清连击、扣安全盾，盾尽塔台关闭 */
    registerIncident(cause, x, y, penaltyOverride) {
      const info = INCIDENT[cause];
      const penalty = penaltyOverride != null ? penaltyOverride : C.PENALTY[cause];
      if (cause === 'weather') this.weatherCrashes++;
      else if (cause === 'zone') this.zoneViolations++;
      this.combo = 0;
      this.multLevel = 1;
      this.lives--;
      this.sinceIncident = 0;
      this.score -= penalty;
      this.addFloat(x, y, `-${penalty} ${info.text}`, info.color);
      this.notify(`✖ ${info.text}事故，安全盾 ${Math.max(0, this.lives)}/${C.LIVES}`);
      if (this.lives <= 0) {
        this.shutdown = true;
        this.end();
      }
    }

    mult() {
      if (this.combo >= C.COMBO_MULT3_AT) return 3;
      if (this.combo >= C.COMBO_MULT2_AT) return 2;
      return 1;
    }

    /* 临时禁飞区生效：路径会被覆盖的航班自动备降到最近起降点 */
    divertFlights(zone) {
      this.notify('⚠ 临时禁飞区已生效，受影响航班自动备降');
      for (const d of this.drones) {
        if (!d.alive || d.diverting) continue;
        const inside = SD.dist(d.x, d.y, zone.x, zone.y) < zone.r;
        const willCross = this.airspace.pathHitsCircle(d.x, d.y, d.tx, d.ty, zone.x, zone.y, zone.r);
        if (!inside && !willCross) continue;
        let best = C.PADS[0], bd = Infinity;
        for (const p of C.PADS) {
          const dd = SD.dist(d.x, d.y, p.x + 0.5, p.y + 0.5);
          if (dd < bd) { bd = dd; best = p; }
        }
        d.divert(best.x + 0.5, best.y + 0.5);
        this.addFloat(d.x, d.y, '备降', '#b8c9dc');
      }
    }

    addFloat(x, y, text, color) {
      this.floats.push({ x, y, text, color, t: 0 });
    }

    notify(text) {
      this.ui.toast(text);
    }

    stats() {
      const denom = this.board.completed + this.board.expired;
      return {
        score: this.score,
        completed: this.board.completed,
        expired: this.board.expired,
        rejected: this.board.rejected,
        diverted: this.board.diverted,
        onTime: denom ? Math.round((this.board.completed / denom) * 100) : 100,
        crashes: this.crashes,
        weatherCrashes: this.weatherCrashes,
        zoneViolations: this.zoneViolations,
        comboBest: this.comboBest,
        livesLeft: Math.max(0, this.lives),
        shutdown: this.shutdown,
      };
    }

    end() {
      this.state = 'over';
      this.board.requests = [];
      this.ui.syncQueue(this.board, this);
      this.ui.setPauseEnabled(false);
      this.updateHud();
      this.ui.showReport(this.stats());
    }

    updateHud() {
      const mult = this.mult();
      this.ui.setHud({
        time: SD.fmtTime(C.ROUND_SECONDS - this.elapsed),
        score: this.score,
        combo: this.combo > 0 ? `×${mult} · ${this.combo}` : '—',
        comboHot: mult > 1,
        lives: '●'.repeat(Math.max(0, this.lives)) + '○'.repeat(Math.max(0, C.LIVES - this.lives)),
        livesLevel: this.lives >= 3 ? 'good' : this.lives === 2 ? 'mid' : 'danger',
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
      this.airspace.drawTempZones(ctx);
      this.floats.forEach((f) => {
        if (!f.text) return;
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
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = SD.TYPE_STYLE[r.type].color;
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
