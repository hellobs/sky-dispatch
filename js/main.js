/* SkyDispatch · 启动与输入绑定 */
(function () {
  const canvas = document.getElementById('sky');
  const ui = new SD.UI();
  const game = new SD.Game(canvas, ui);
  SD.ui = ui; // 调试探针

  // 高分屏适配（CSS 负责显示尺寸，移动端等比缩放）
  const dpr = window.devicePixelRatio || 1;
  const S = SD.CONFIG.GRID * SD.CONFIG.CELL;
  canvas.width = S * dpr;
  canvas.height = S * dpr;
  game.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 音效开关
  const soundBtn = document.getElementById('btn-sound');
  const syncSound = () => { soundBtn.textContent = SD.audio.isMuted() ? '🔇' : '🔊'; };
  syncSound();
  soundBtn.addEventListener('click', (e) => {
    SD.audio.setMuted(!SD.audio.isMuted());
    syncSound();
    e.currentTarget.blur();
  });
  // 浏览器要求首次用户交互后才能出声
  window.addEventListener('pointerdown', () => SD.audio.unlock(), { once: true });

  // 画布显示尺寸变小时，同步放大标注文字，保证手机端可读
  const syncViewScale = () => {
    const cssW = canvas.getBoundingClientRect().width || S;
    SD.textScale = SD.clamp(S / cssW, 1, 2.2);
  };
  syncViewScale();
  window.addEventListener('resize', syncViewScale);

  // 主菜单展示历史最佳
  ui.updateBest(SD.best.get());
  document.getElementById('btn-daily').textContent = `每日挑战 · ${SD.dailyLabel()}`;

  document.getElementById('btn-start').addEventListener('click', (e) => {
    game.start(null); // 自由调度：随机空域
    e.currentTarget.blur();
  });
  document.getElementById('btn-daily').addEventListener('click', (e) => {
    game.start(SD.dailySeed()); // 每日挑战：固定种子，全网同题
    e.currentTarget.blur();
  });
  document.getElementById('btn-restart').addEventListener('click', (e) => {
    game.start(); // 沿用上一局模式
    e.currentTarget.blur();
  });
  document.getElementById('btn-resume').addEventListener('click', (e) => {
    game.togglePause();
    e.currentTarget.blur();
  });
  document.getElementById('btn-giveup').addEventListener('click', (e) => {
    game.start();
    e.currentTarget.blur();
  });
  document.getElementById('btn-pause').addEventListener('click', (e) => {
    game.togglePause();
    e.currentTarget.blur();
  });

  document.getElementById('btn-share').addEventListener('click', (e) => {
    const s = game.stats();
    const mode = game.dailySeed ? `每日挑战（${game.dailyDate}）` : '自由调度';
    const text = `我在 #SkyDispatch 低空塔台 的${mode}中拿到 ${s.score} 分：完成 ${s.completed} 单，最高 ${s.comboBest} 连击，准点率 ${s.onTime}%。1024 格低空空域，等你来接管塔台。`;
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
    } else if (game.state === 'running' && game.board) {
      // 键盘速操：数字键批准第 N 个申请，QWERTY 拒绝
      const APPROVE = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
      const DENY = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY'];
      let idx = APPROVE.indexOf(e.code);
      const isDeny = idx < 0 ? (idx = DENY.indexOf(e.code)) >= 0 : false;
      if (idx >= 0 && game.board.requests[idx]) {
        e.preventDefault();
        if (isDeny) game.rejectRequest(game.board.requests[idx].id);
        else game.approveRequest(game.board.requests[idx].id);
      }
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
