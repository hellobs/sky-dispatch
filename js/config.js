/* SkyDispatch · 全局数值配置（调平衡只改这里） */
(function () {
  window.SD = window.SD || {};
  SD.CONFIG = {
    GRID: 32,            // 32×32 = 1024 格低空空域
    CELL: 22,            // 每格像素
    ROUND_SECONDS: 180,  // 一局时长

    SPAWN_START: 5.8,    // 开局申请间隔（秒）
    SPAWN_END: 2.2,      // 终局申请间隔
    REQUEST_TTL: 12,     // 普通申请有效期，超时算逾期
    RESCUE_TTL: 9,       // 救援申请窗口更短（但飞机更快）
    MAX_PENDING: 6,      // 待处理申请上限

    DRONE_SPEED: 2.2,    // 无人机速度（格/秒）
    RESCUE_SPEED_MULT: 1.5,
    COLLIDE_DIST: 0.85,  // 空中冲突判定距离（格）
    TRAIL_LEN: 14,       // 航迹点数

    SCORE: { delivery: 10, inspection: 15, rescue: 25 },
    PENALTY: { expire: 2, crash: 15, weather: 10, zone: 10 },

    LIVES: 3,            // 安全盾：任何事故扣一盾，耗尽塔台提前关闭
    SHIELD_REGEN: 45,    // 无事故持续秒数 → 恢复一盾
    COMBO_MULT2_AT: 4,   // 连续送达 4 单 → 收益 ×2
    COMBO_MULT3_AT: 9,   // 连续送达 9 单 → 收益 ×3

    PADS: [
      { x: 3,  y: 3 },  { x: 27, y: 4 },  { x: 4,  y: 27 },
      { x: 26, y: 26 }, { x: 15, y: 2 },  { x: 16, y: 29 },
    ],
    NOFLY: [
      { x: 11, y: 11, r: 3.2 },
      { x: 22, y: 19, r: 2.6 },
      { x: 8,  y: 22, r: 2.2 },
    ],
    WEATHER_AT: [60, 115], // 第 2、3 个风暴的生成时间点（秒）
    TEMP_ZONE: {
      FIRST: 40,           // 首个临时禁飞区出现时间（秒）
      GAP_MIN: 25, GAP_MAX: 40, // 之后每隔一段随机时间再来一个
      WARN: 4,             // 预警时长（秒），预警期内可通行
      LIFE: 18,            // 生效时长（秒）
      R_MIN: 1.8, R_MAX: 2.6,
    },
  };
})();
