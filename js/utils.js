/* SkyDispatch · 通用工具函数 */
(function () {
  window.SD = window.SD || {};
  const SD = window.SD;

  SD.rand = (a, b) => a + Math.random() * (b - a);
  SD.randInt = (a, b) => Math.floor(SD.rand(a, b + 1));
  SD.choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
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
