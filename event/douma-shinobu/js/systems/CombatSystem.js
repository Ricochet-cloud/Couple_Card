/**
 * CombatSystem - 충돌 판정 및 전투 규칙 처리기
 * 
 * - 플레이어 피격 판정 (도트 단위 원형 충돌)
 * - 피격 무적 시간(Invulnerability) 및 점멸 제어
 * - 플레이어 자동 공격 탄환과 보스 히트박스 충돌 판정
 * - 등꽃 독 누적 및 도트 대미지 연산
 * - 피격 시각 효과 (화면 흔들림 및 충돌 파티클)
 */

export class CombatSystem {
  constructor(bulletPool) {
    this.bulletPool = bulletPool;
    this.hitParticles = [];

    // 화면 흔들림(Screen Shake) 파라미터
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
  }

  /**
   * 충돌 검사 및 물리 연산 갱신
   * @param {number} dt 
   * @param {import('../entities/Shinobu.js').Shinobu} shinobu 
   * @param {import('../entities/Douma.js').Douma} douma 
   */
  update(dt, shinobu, douma) {
    // 1. 화면 흔들림 감쇠
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      this.shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity * 2;
      if (this.shakeDuration <= 0) {
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }
    }

    // 2. 파티클 수명 업데이트
    for (let i = this.hitParticles.length - 1; i >= 0; i--) {
      const p = this.hitParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.hitParticles.splice(i, 1);
      }
    }

    if (!shinobu.isAlive || !douma.isAlive) return;

    // 3. 적 탄환 <-> 플레이어(시노부) 충돌 판정
    if (!shinobu.isInvulnerable) {
      const enemyBullets = this.bulletPool.getActiveBullets('enemy');
      for (let i = 0; i < enemyBullets.length; i++) {
        const b = enemyBullets[i];
        const dx = b.x - shinobu.x;
        const dy = b.y - shinobu.y;
        const hitDist = b.radius + shinobu.hitboxRadius;

        if (dx * dx + dy * dy <= hitDist * hitDist) {
          // 피격 발생!
          b.deactivate();
          shinobu.takeDamage(b.damage);
          this.triggerScreenShake(0.3, 8);
          this._spawnSparks(shinobu.x, shinobu.y, '#ff1744', 12);
          break; // 한 프레임에 1회 피격 처리 후 무적 돌입
        }
      }
    }

    // 4. 플레이어 탄환 <-> 보스(도우마) 충돌 판정
    const playerBullets = this.bulletPool.getActiveBullets('player');
    for (let i = 0; i < playerBullets.length; i++) {
      const b = playerBullets[i];
      const dx = b.x - douma.x;
      const dy = b.y - douma.y;
      const hitDist = b.radius + douma.hitboxRadius;

      if (dx * dx + dy * dy <= hitDist * hitDist) {
        b.deactivate();
        douma.takeHit(b.damage);

        // 시노부 등꽃 독 누적 (적중 시 1.5% 증가)
        const isPoisonMax = shinobu.addPoison(1.5);
        if (isPoisonMax) {
          // 독 폭발 발동! (보너스 대미지 및 도우마 둔화)
          douma.takeHit(35);
          douma.applyPoison(3.5);
          shinobu.consumePoison();
          this.triggerScreenShake(0.2, 5);
          this._spawnSparks(douma.x, douma.y, '#e040fb', 20);
        } else {
          this._spawnSparks(b.x, b.y, '#ce93d8', 4);
        }
      }
    }
  }

  /**
   * 화면 진동 트리거
   */
  triggerScreenShake(duration = 0.25, intensity = 6) {
    this.shakeDuration = duration;
    this.shakeIntensity = intensity;
  }

  _spawnSparks(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.hitParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2 + Math.random() * 3,
        life: 0.4,
        maxLife: 0.4,
        alpha: 1.0
      });
    }
  }

  /**
   * 충돌 파티클 렌더링
   */
  renderParticles(ctx) {
    for (const p of this.hitParticles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
