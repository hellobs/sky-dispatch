/* SkyDispatch · 任务申请与调度队列 */
(function () {
  window.SD = window.SD || {};
  const SD = window.SD;
  const C = SD.CONFIG;

  const TYPE_POOL = [
    { type: 'delivery', w: 55 },
    { type: 'inspection', w: 30 },
    { type: 'rescue', w: 15 },
  ];
  function pickType() {
    let r = Math.random() * TYPE_POOL.reduce((s, t) => s + t.w, 0);
    for (const t of TYPE_POOL) if ((r -= t.w) < 0) return t.type;
    return 'delivery';
  }

  class Request {
    constructor(airspace, elapsed) {
      this.id = SD.uid();
      this.type = pickType();
      this.origin = SD.choice(C.PADS);
      // 目的地优先选不在固定禁航航线上的；多次尝试后仍穿航则保留并标记
      let dest = null, risky = false;
      for (let t = 0; t < 5; t++) {
        dest = airspace.randomFreeCell(this.origin, 8);
        risky = airspace.pathHitsStatic(
          this.origin.x + 0.5, this.origin.y + 0.5,
          dest.x + 0.5, dest.y + 0.5,
        );
        if (!risky) break;
      }
      this.dest = dest;
      this.risky = risky;
      // 有效期随对局推进缩短；救援窗口更短，逼你排优先级
      const t = SD.clamp((elapsed || 0) / C.ROUND_SECONDS, 0, 1);
      const baseTtl = SD.lerp(C.REQUEST_TTL, C.TTL_END, Math.pow(t, C.SPAWN_CURVE));
      this.maxTtl = this.type === 'rescue' ? Math.min(C.RESCUE_TTL, baseTtl) : baseTtl;
      this.ttl = this.maxTtl;
      this.reward = C.SCORE[this.type];
    }
  }

  class MissionBoard {
    constructor(airspace) {
      this.airspace = airspace;
      this.requests = [];
      this.spawnTimer = 1.2; // 首个申请很快到来
      this.completed = 0;
      this.expired = 0;
      this.rejected = 0;
      this.diverted = 0;
    }
    spawnInterval(elapsed) {
      const t = SD.clamp(elapsed / C.ROUND_SECONDS, 0, 1);
      return SD.lerp(C.SPAWN_START, C.SPAWN_END, Math.pow(t, C.SPAWN_CURVE));
    }
    maybeSpawn(dt, elapsed) {
      this.spawnTimer -= dt;
      if (this.spawnTimer > 0) return;
      if (this.requests.length < C.MAX_PENDING) this.requests.push(new Request(this.airspace, elapsed));
      this.spawnTimer = this.spawnInterval(elapsed);
    }
    /* 返回本帧逾期的申请数 */
    update(dt) {
      let n = 0;
      this.requests = this.requests.filter((r) => {
        r.ttl -= dt;
        if (r.ttl <= 0) { n++; this.expired++; return false; }
        return true;
      });
      return n;
    }
    approve(id) {
      const i = this.requests.findIndex((r) => r.id === id);
      return i < 0 ? null : this.requests.splice(i, 1)[0];
    }
    reject(id) {
      const i = this.requests.findIndex((r) => r.id === id);
      if (i >= 0) { this.requests.splice(i, 1); this.rejected++; }
    }
  }

  SD.MissionBoard = MissionBoard;
  SD.Request = Request; // 供测试注入
})();
