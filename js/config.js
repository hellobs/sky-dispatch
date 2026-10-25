/* SkyDispatch · 全局数值配置（调平衡只改这里） */
(function () {
  window.SD = window.SD || {};
  SD.CONFIG = {
    GRID: 32,            // 32×32 = 1024 格低空空域
    CELL: 22,            // 每格像素
    ROUND_SECONDS: 180,  // 一局时长

    SPAWN_START: 6.5,    // 开局申请间隔（秒）
    SPAWN_END: 2.8,      // 终局申请间隔
    REQUEST_TTL: 14,     // 申请有效期，超时算逾期
    MAX_PENDING: 6,      // 待处理申请上限

    DRONE_SPEED: 2.2,    // 无人机速度（格/秒）
    COLLIDE_DIST: 0.85,  // 空中冲突判定距离（格）
    TRAIL_LEN: 14,       // 航迹点数

    SCORE: { delivery: 10, inspection: 15, rescue: 25 },
    PENALTY: { expire: 2, crash: 15, weather: 10, zone: 10 },

    PADS: [
      { x: 3,  y: 3 },  { x: 27, y: 4 },  { x: 4,  y: 27 },
      { x: 26, y: 26 }, { x: 15, y: 2 },  { x: 16, y: 29 },
    ],
    NOFLY: [
      { x: 11, y: 11, r: 3.2 },
      { x: 22, y: 19, r: 2.6 },
      { x: 8,  y: 22, r: 2.2 },
    ],
    WEATHER_AT: [75, 135], // 第 2、3 个风暴的生成时间点（秒）
  };
})();
