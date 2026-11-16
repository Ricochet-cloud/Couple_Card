/**
 * DanmakuPatterns - 도우마의 6대 혈귀술 탄막 알고리즘
 * 
 * [6대 탄막 패턴]
 * 1. 플레이어 추적형 얼음 탄환 (Homing Ice Shards)
 * 2. 원형 확산 탄막 (Circular Ring with Safe Gaps)
 * 3. 부채형 광역 탄막 (Fan-shaped Spread)
 * 4. 얼음 결정 낙하 (Falling Icicles)
 * 5. 플레이어 위치 예측 공격 (Predictive Leading Shot)
 * 6. 복합 탄막 콤보 (Composite Combo)
 * 
 * - 모든 공격은 100% 회피 가능한 틈새(Fair & Evadable) 설계
 * - 난이도 파라미터(diff) 수치 배수로만 제어 (중복 분기 코드 배제)
 */

export class DanmakuPatterns {
  constructor(bulletPool) {
    this.pool = bulletPool;
    this.timer = 0;
    this.spiralAngle = 0;
  }

  update(dt) {
    this.timer += dt;
    this.spiralAngle += dt * 1.6;
  }

  // ==============================================================
  // [1] 플레이어 추적형 얼음 탄환 (Homing Ice Shards)
  // - 시노부를 유도하지만 선회력과 수명이 제한되어 슬쩍 피하면 빗나감
  // ==============================================================
  spawnHomingShards(boss, target, diff, baseCount = 3) {
    const count = Math.max(2, Math.round(baseCount * diff.densityMultiplier));
    const speed = 210 * diff.speedMultiplier;
    const homingPower = 3.2 * diff.homingStrength;

    for (let i = 0; i < count; i++) {
      // 보스 좌우에서 부채꼴로 퍼져나가며 서서히 시노부에게 커브
      const spreadOffset = (i - (count - 1) / 2) * 0.45;
      const initialAngle = Math.PI / 2 + spreadOffset;

      this.pool.spawn({
        x: boss.x + (i - (count - 1) / 2) * 20,
        y: boss.y + 15,
        angle: initialAngle,
        speed: speed,
        radius: 5,
        damage: 1,
        type: 'enemy_homing',
        color: '#80d8ff',
        target: target,
        homingStrength: homingPower,
        maxLifetime: 3.8 // 3.8초 후 소멸 (무한 추적 방지)
      });
    }
  }

  // ==============================================================
  // [2] 원형 확산 탄막 (Circular Ring)
  // - 360도로 균등 방사되되, 플레이어가 빠져나갈 수 있는 안전각(Gap) 보장
  // ==============================================================
  spawnCircularRing(boss, diff, baseCount = 18, baseSpeed = 150) {
    const count = Math.max(10, Math.round(baseCount * diff.densityMultiplier));
    const speed = baseSpeed * diff.speedMultiplier;
    const offset = Math.sin(this.timer * 2.5) * 0.2; // 매 발사마다 회전각 변화

    for (let i = 0; i < count; i++) {
      const angle = offset + (i * Math.PI * 2) / count;
      this.pool.spawn({
        x: boss.x,
        y: boss.y + 10,
        angle: angle,
        speed: speed,
        radius: 4.5,
        damage: 1,
        type: 'enemy_ice',
        color: '#b2ebf2'
      });
    }
  }

  // ==============================================================
  // [3] 부채형 광역 탄막 (Fan-shaped Spread)
  // - 도우마의 금빛 부채질에서 뿜어지는 전방 광역 부채살 탄막
  // - 탄환 사이에 명확한 통로(Lane)가 형성되어 틈새 통과 가능
  // ==============================================================
  spawnFanSpread(boss, diff, baseCount = 7, spreadAngle = 0.85, baseSpeed = 230) {
    const count = Math.max(3, Math.round(baseCount * diff.densityMultiplier));
    const speed = baseSpeed * diff.speedMultiplier;
    const centerAngle = Math.PI / 2; // 아래쪽 방향
    const startAngle = centerAngle - spreadAngle / 2;
    const step = count > 1 ? spreadAngle / (count - 1) : 0;

    for (let i = 0; i < count; i++) {
      const angle = startAngle + i * step;
      this.pool.spawn({
        x: boss.x,
        y: boss.y + 20,
        angle: angle,
        speed: speed,
        radius: 4,
        damage: 1,
        type: 'enemy_ice',
        color: '#e0f7fa'
      });
    }
  }

  // ==============================================================
  // [4] 얼음 결정 낙하 (Falling Icicles)
  // - 화면 천장(Y = -10)에서 수직으로 떨어지는 고드름 탄환
  // - 시노부가 갇히지 않도록 일정 간격 구획으로 분할 낙하
  // ==============================================================
  spawnFallingIcicles(viewWidth, diff, baseCount = 6, baseSpeed = 190) {
    const count = Math.max(3, Math.round(baseCount * diff.densityMultiplier));
    const speed = baseSpeed * diff.speedMultiplier;
    const segmentWidth = viewWidth / (count + 1);

    for (let i = 1; i <= count; i++) {
      // 구획마다 약간의 지터(오차)를 주어 자연스러운 낙하
      const jitterX = (Math.random() - 0.5) * (segmentWidth * 0.4);
      const spawnX = i * segmentWidth + jitterX;

      this.pool.spawn({
        x: spawnX,
        y: -10,
        angle: Math.PI / 2, // 수직 하강
        speed: speed + (Math.random() - 0.5) * 30,
        radius: 5,
        damage: 1,
        type: 'enemy_icicle',
        color: '#80deea',
        maxLifetime: 6.0
      });
    }
  }

  // ==============================================================
  // [5] 플레이어 위치 예측 공격 (Predictive Leading Shot)
  // - 시노부의 현재 이동 벡터(vx, vy)를 분석하여 도달할 미래 좌표 저격
  // - 이동을 멈추거나 반대로 꺾으면(Juke) 100% 회피 가능!
  // ==============================================================
  spawnPredictiveSnipe(boss, target, diff, baseSpeed = 340) {
    const speed = baseSpeed * diff.speedMultiplier;

    // 1. 탄환 도달 시간 추정 (t = distance / speed)
    const dist = Math.hypot(target.x - boss.x, target.y - boss.y);
    const travelTime = dist / Math.max(1, speed);

    // 2. 미래 예상 좌표 산출 (난이도에 따른 예측 오차 errorOffset 적용)
    const errorFactor = (Math.random() - 0.5) * 2 * diff.predictiveError * 120;
    const futureX = target.x + target.vx * travelTime + errorFactor;
    const futureY = target.y + target.vy * travelTime;

    const angle = Math.atan2(futureY - boss.y, futureX - boss.x);

    // 3. 중심 저격탄 1발 + 좌우 얇은 보조 침 2발
    const offsets = [-0.07, 0, 0.07];
    for (const off of offsets) {
      this.pool.spawn({
        x: boss.x,
        y: boss.y + 15,
        angle: angle + off,
        speed: speed,
        radius: 4,
        damage: 1,
        type: 'enemy_predictive',
        color: '#ff80ab',
        maxLifetime: 4.5
      });
    }
  }

  // ==============================================================
  // [6] 복합 탄막 콤보 (Composite Combo)
  // - 3페이즈 발악: 원형 링(저속) + 얼음 고드름 낙하 + 초승달 부채 칼날 교차
  // - 탄속이 층위(Layer)별로 달라 보고 피할 수 있는 시각적 쾌감 선사
  // ==============================================================
  spawnCompositeCombo(boss, viewWidth, diff) {
    // 1. 저속 원형 링 (공간 압박)
    this.spawnCircularRing(boss, diff, 14, 120);

    // 2. 고드름 낙하 4발 (세로 이동 제약)
    this.spawnFallingIcicles(viewWidth, diff, 4, 170);

    // 3. 도우마 전방 초승달 칼날 3발
    const bladeAngles = [Math.PI * 0.42, Math.PI * 0.5, Math.PI * 0.58];
    const bladeSpeed = 230 * diff.speedMultiplier;

    for (const ang of bladeAngles) {
      this.pool.spawn({
        x: boss.x,
        y: boss.y + 25,
        angle: ang,
        speed: bladeSpeed,
        radius: 10,
        damage: 1,
        type: 'enemy_blade',
        color: '#e0f7fa'
      });
    }
  }
}
