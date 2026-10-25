/* SkyDispatch · 通用工具函数 */
(function () {
  window.SD = window.SD || {};
  const SD = window.SD;

  /* 可播种随机数：每日挑战用固定种子让全网拿到同一套空域与任务序列 */
  let rng = null; // null = Math.random（自由调度）
  function next() { return rng ? rng() : Math.random(); }
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  SD.rand = (a, b) => a + next() * (b - a);
  SD.randInt = (a, b) => Math.floor(SD.rand(a, b + 1));
  SD.choice = (arr) => arr[Math.floor(next() * arr.length)];
  SD.setRng = (seed) => { rng = mulberry32(seed); };
  SD.clearRng = () => { rng = null; };
  SD.dailySeed = () => {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  };
  SD.dailyLabel = () => {
    const d = new Date();
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  };
  SD.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  SD.lerp = (a, b, t) => a + (b - a) * t;
  SD.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  SD.uid = () => 'r' + Math.random().toString(36).slice(2, 9);

  SD.fmtTime = (s) => {
    s = Math.max(0, Math.ceil(s));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };

  /* 本地最佳纪录（隐私模式下静默降级） */
  SD.best = {
    get() {
      try { return +localStorage.getItem('sd-best') || 0; } catch (e) { return 0; }
    },
    set(v) {
      try { localStorage.setItem('sd-best', String(v)); } catch (e) { /* 忽略 */ }
    },
  };
})();
