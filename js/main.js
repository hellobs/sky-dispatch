/* SkyDispatch · 启动与输入绑定 */
(function () {
  const canvas = document.getElementById('sky');
  const ui = new SD.UI();
  const game = new SD.Game(canvas, ui);
  SD.ui = ui; // 调试探针

  // 高分屏适配
  const dpr = window.devicePixelRatio || 1;
  const S = SD.CONFIG.GRID * SD.CONFIG.CELL;
  canvas.width = S * dpr;
  canvas.height = S * dpr;
  canvas.style.width = S + 'px';
  canvas.style.height = S + 'px';
  game.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  document.getElementById('btn-start').addEventListener('click', (e) => {
    game.start();
    e.currentTarget.blur();
  });
  document.getElementById('btn-restart').addEventListener('click', (e) => {
    game.start();
    e.currentTarget.blur();
  });
  document.getElementById('btn-resume').addEventListener('click', (e) => {
    game.togglePause();
    e.currentTarget.blur();
  });
  document.getElementById('btn-pause').addEventListener('click', (e) => {
    game.togglePause();
    e.currentTarget.blur();
  });

  document.getElementById('btn-share').addEventListener('click', (e) => {
    const s = game.stats();
    const text = `我在 #SkyDispatch 低空塔台 完成一局低空调度：总分 ${s.score}，完成 ${s.completed} 单，最高 ${s.comboBest} 连击，准点率 ${s.onTime}%。1024 格低空空域，等你来接管塔台。`;
    const btn = e.currentTarget;
    const done = () => {
      btn.textContent = '已复制 ✓';
      setTimeout(() => { btn.textContent = '复制战绩'; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => { fallbackCopy(text); done(); });
    } else {
      fallbackCopy(text);
      done();
    }
    btn.blur();
  });

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) { /* 降级失败则忽略 */ }
    document.body.removeChild(ta);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (game.state === 'running' || game.state === 'paused') game.togglePause();
    } else if (e.code === 'Enter') {
      if (game.state === 'menu' || game.state === 'over') game.start();
    }
  });

  // 主循环：rAF 优先；部分环境（后台标签页、内嵌视图）会暂停 rAF，用定时器兜底
  let lastTick = 0;
  function tick(ts) {
    lastTick = performance.now();
    game.frame(ts);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  setInterval(() => {
    if (performance.now() - lastTick > 400) game.frame(performance.now());
  }, 250);
})();
