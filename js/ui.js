/* SkyDispatch · DOM 界面：HUD、申请队列、浮层 */
(function () {
  window.SD = window.SD || {};
  const SD = window.SD;
  const C = SD.CONFIG;

  const $ = (id) => document.getElementById(id);

  class UI {
    constructor() {
      this.el = {
        time: $('hud-time'), score: $('hud-score'), air: $('hud-air'),
        done: $('hud-done'), crashes: $('hud-crash'),
        queue: $('queue'), queueCount: $('queue-count'),
        menu: $('overlay-menu'), pause: $('overlay-pause'), report: $('overlay-report'),
        reportScore: $('report-score'), reportRows: $('report-rows'),
        pauseBtn: $('btn-pause'),
      };
    }
    setHud(s) {
      this.el.time.textContent = s.time;
      this.el.score.textContent = s.score;
      this.el.air.textContent = s.air;
      this.el.done.textContent = s.done;
      this.el.crashes.textContent = s.crashes;
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
      this.el.reportScore.textContent = st.score;
      const rows = [
        ['完成架次', st.completed],
        ['逾期任务', st.expired],
        ['被拒申请', st.rejected],
        ['准点率', st.onTime + '%'],
        ['空中冲突', st.crashes],
        ['风暴坠机', st.weatherCrashes],
        ['闯入禁飞', st.zoneViolations],
      ];
      this.el.reportRows.innerHTML = rows
        .map(([k, v]) => `<div class="rk">${k}</div><div class="rv">${v}</div>`)
        .join('');
      this.el.report.classList.remove('hidden');
    }
    renderQueue(board, game) {
      const q = this.el.queue;
      q.innerHTML = '';
      this.el.queueCount.textContent = board.requests.length;
      if (!board.requests.length) {
        const d = document.createElement('div');
        d.className = 'queue-empty';
        d.textContent = '等待新的飞行申请…';
        q.appendChild(d);
        return;
      }
      for (const r of board.requests) {
        const st = SD.TYPE_STYLE[r.type];
        const low = r.ttl / r.maxTtl < 0.3;
        const card = document.createElement('div');
        card.className = 'req-card ' + r.type;
        card.innerHTML = `
          <div class="req-top">
            <span class="req-badge" style="color:${st.color};border-color:${st.color}">${st.label}</span>
            <span class="req-reward">+${r.reward}</span>
          </div>
          <div class="req-route">P${C.PADS.indexOf(r.origin) + 1} · (${r.origin.x},${r.origin.y}) → (${r.dest.x},${r.dest.y})</div>
          <div class="req-ttl"><div class="req-ttl-fill" style="width:${((r.ttl / r.maxTtl) * 100).toFixed(1)}%;${low ? 'background:var(--danger);' : ''}"></div></div>
          <div class="req-btns">
            <button class="btn small approve">批准</button>
            <button class="btn small ghost deny">拒绝</button>
          </div>`;
        card.querySelector('.approve').addEventListener('click', () => game.approveRequest(r.id));
        card.querySelector('.deny').addEventListener('click', () => game.rejectRequest(r.id));
        card.addEventListener('mouseenter', () => { if (game.state === 'running') game.preview = r; });
        card.addEventListener('mouseleave', () => { if (game.preview === r) game.preview = null; });
        q.appendChild(card);
      }
    }
  }

  SD.UI = UI;
})();
