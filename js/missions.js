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
    constructor(airspace) {
      this.id = SD.uid();
      this.type = pickType();
      this.origin = SD.choice(C.PADS);
      this.dest = airspace.randomFreeCell(this.origin, 8);
      this.maxTtl = C.REQUEST_TTL;
      this.ttl = C.REQUEST_TTL;
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
    }
    spawnInterval(elapsed) {
      return SD.lerp(C.SPAWN_START, C.SPAWN_END, SD.clamp(elapsed / C.ROUND_SECONDS, 0, 1));
    }
    maybeSpawn(dt, elapsed) {
      this.spawnTimer -= dt;
      if (this.spawnTimer > 0) return;
      if (this.requests.length < C.MAX_PENDING) this.requests.push(new Request(this.airspace));
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
})();
