/* SkyDispatch · DOM 界面：HUD、申请队列（增量渲染）、事件播报、浮层 */
(function () {
  window.SD = window.SD || {};
  const SD = window.SD;
  const C = SD.CONFIG;

  const $ = (id) => document.getElementById(id);

  class UI {
    constructor() {
      this.el = {
        time: $('hud-time'), score: $('hud-score'),
        combo: $('hud-combo'), lives: $('hud-lives'),
        air: $('hud-air'), done: $('hud-done'), crashes: $('hud-crash'),
        queue: $('queue'), queueCount: $('queue-count'),
        menu: $('overlay-menu'), pause: $('overlay-pause'), report: $('overlay-report'),
        reportScore: $('report-score'), reportRows: $('report-rows'),
        reportTitle: $('report-title'), shutdownLine: $('shutdown-line'),
        pauseBtn: $('btn-pause'), ticker: $('ticker'),
      };
      this.cardMap = new Map(); // request.id → 卡片元素（常驻，不再整体重建）
      this.emptyEl = null;
      this.toastTimer = null;
    }
    setHud(s) {
      this.el.time.textContent = s.time;
      this.el.score.textContent = s.score;
      this.el.combo.textContent = s.combo;
      this.el.combo.classList.toggle('hot', s.comboHot);
      this.el.lives.textContent = s.lives;
      this.el.lives.classList.remove('good', 'mid', 'danger');
      this.el.lives.classList.add(s.livesLevel);
      this.el.air.textContent = s.air;
      this.el.done.textContent = s.done;
      this.el.crashes.textContent = s.crashes;
    }
    /* 事件播报条：顶部一条，2.6 秒后淡出 */
    toast(text) {
      const t = this.el.ticker;
      t.textContent = text;
      t.classList.add('show');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
    }
    setPauseEnabled(b) { this.el.pauseBtn.disabled = !b; }
    setPauseLabel(paused) { this.el.pauseBtn.textContent = paused ? '继续' : '暂停'; }
    hideOverlays() {
      [this.el.menu, this.el.pause, this.el.report].forEach((e) => e.classList.add('hidden'));
      this.setPauseLabel(false);
    }
    showPause() {
      this.el.pause.classList.remove('hidden');
      this.setPauseLabel(true);
    }
    showReport(st) {
      this.el.reportTitle.textContent = st.shutdown ? '塔台已关闭' : '今日调度报告';
      this.el.shutdownLine.classList.toggle('hidden', !st.shutdown);
      this.el.reportScore.textContent = st.score;
      const rows = [
        ['完成架次', st.completed],
        ['最高连击', st.comboBest > 0 ? `${st.comboBest} 连` : '—'],
        ['备降架次', st.diverted],
        ['逾期任务', st.expired],
        ['被拒申请', st.rejected],
        ['准点率', st.onTime + '%'],
        ['空中冲突', st.crashes],
        ['风暴坠机', st.weatherCrashes],
        ['闯入禁飞', st.zoneViolations],
        ['剩余安全盾', '●'.repeat(st.livesLeft) + '○'.repeat(Math.max(0, C.LIVES - st.livesLeft))],
      ];
      this.el.reportRows.innerHTML = rows
        .map(([k, v]) => `<div class="rk">${k}</div><div class="rv">${v}</div>`)
        .join('');
      this.el.report.classList.remove('hidden');
    }

    /* 新局清空队列 */
    resetQueue() {
      this.cardMap.clear();
      this.el.queue.innerHTML = '';
      this.el.queueCount.textContent = '0';
      this.emptyEl = null;
    }

    /* 增量同步：卡片只在申请出现时创建一次，之后只更新倒计时条。
     * 不再整体 innerHTML 重建 —— 按钮不抖、点击不落空、悬停预览不闪断。 */
    syncQueue(board, game) {
      const q = this.el.queue;
      this.el.queueCount.textContent = board.requests.length;

      // 移除已消失的申请对应的卡片
      const alive = new Set(board.requests.map((r) => r.id));
      for (const [id, card] of this.cardMap) {
        if (alive.has(id)) continue;
        if (game.preview === card.__req) game.preview = null;
        card.remove();
        this.cardMap.delete(id);
      }

      // 新申请建卡
      for (const r of board.requests) {
        if (!this.cardMap.has(r.id)) this.cardMap.set(r.id, this.buildCard(r, game));
      }

      // 更新倒计时条
      for (const r of board.requests) {
        const card = this.cardMap.get(r.id);
        const low = r.ttl / r.maxTtl < 0.3;
        card.__fill.style.width = ((r.ttl / r.maxTtl) * 100).toFixed(1) + '%';
        card.__fill.style.background = low ? 'var(--danger)' : '';
      }

      // 空态
      const empty = board.requests.length === 0;
      if (empty && !this.emptyEl) {
        this.emptyEl = document.createElement('div');
        this.emptyEl.className = 'queue-empty';
        this.emptyEl.textContent = '等待新的飞行申请…';
        q.appendChild(this.emptyEl);
      } else if (!empty && this.emptyEl) {
        this.emptyEl.remove();
        this.emptyEl = null;
      }
    }

    buildCard(r, game) {
      const st = SD.TYPE_STYLE[r.type];
      const card = document.createElement('div');
      card.className = 'req-card ' + r.type + (r.risky ? ' risky' : '');
      card.__req = r;
      card.innerHTML = `
        <div class="req-top">
          <span class="req-badge" style="color:${st.color};border-color:${st.color}">${st.label}${r.type === 'rescue' ? ' ⚡' : ''}${r.risky ? ' ⚠' : ''}</span>
          <span class="req-reward">+${r.reward}</span>
        </div>
        <div class="req-route">P${C.PADS.indexOf(r.origin) + 1} · (${r.origin.x},${r.origin.y}) → (${r.dest.x},${r.dest.y})</div>
        <div class="req-ttl"><div class="req-ttl-fill"></div></div>
        <div class="req-btns">
          <button class="btn small approve">批准</button>
          <button class="btn small ghost deny">拒绝</button>
        </div>`;
      card.__fill = card.querySelector('.req-ttl-fill');
      card.querySelector('.approve').addEventListener('click', () => game.approveRequest(r.id));
      card.querySelector('.deny').addEventListener('click', () => game.rejectRequest(r.id));
      card.addEventListener('mouseenter', () => { if (game.state === 'running') game.preview = r; });
      card.addEventListener('mouseleave', () => { if (game.preview === r) game.preview = null; });
      this.el.queue.appendChild(card);
      return card;
    }
  }

  SD.UI = UI;
})();
