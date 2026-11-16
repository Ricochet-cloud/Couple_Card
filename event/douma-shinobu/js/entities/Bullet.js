/**
 * Bullet - 투사체 엔티티
 * 
 * - 플레이어(시노부) 탄환 및 보스(도우마) 6대 탄막 패턴 지원
 * - 오브젝트 풀링을 위한 isActive 플래그 및 init/deactivate 구조
 * - 얼음 결정, 연꽃탄, 칼날, 고드름 낙하, 유도탄, 예측 저격탄 벡터 발광 렌더러
 */

export class Bullet {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.angle = 0;
    this.radius = 4;
    this.damage = 1;
    this.type = 'enemy_ice';
    this.owner = 'enemy'; // 'player' | 'enemy'
    this.color = '#80d8ff';
    this.lifetime = 0;
    this.maxLifetime = 10;
    this.isActive = false;

    // 특수 탄도 파라미터 (회전, 가속, 유도 등)
    this.angVel = 0;
    this.accel = 0;
    this.target = null;
    this.homingStrength = 0;
  }

  /**
   * 풀에서 재사용 시 탄환 초기화
   */
  init({
    x,
    y,
    vx = 0,
    vy = 0,
    speed = 0,
    angle = 0,
    radius = 4,
    damage = 1,
    type = 'enemy_ice',
    owner = 'enemy',
    color = '#80d8ff',
    angVel = 0,
    accel = 0,
    maxLifetime = 8,
    target = null,
    homingStrength = 0
  }) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.damage = damage;
    this.type = type;
    this.owner = owner;
    this.color = color;
    this.angVel = angVel;
    this.accel = accel;
    this.lifetime = 0;
    this.maxLifetime = maxLifetime;
    this.target = target;
    this.homingStrength = homingStrength;

    if (speed !== 0) {
      this.speed = speed;
      this.angle = angle;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    } else {
      this.vx = vx;
      this.vy = vy;
      this.speed = Math.hypot(vx, vy);
      this.angle = Math.atan2(vy, vx);
    }

    this.isActive = true;
  }

  deactivate() {
    this.isActive = false;
    this.target = null;
  }

  /**
   * 물리 및 궤적 업데이트
   */
  update(dt) {
    if (!this.isActive) return;

    this.lifetime += dt;
    if (this.lifetime >= this.maxLifetime) {
      this.deactivate();
      return;
    }

    // 각속도(회전 탄환)
    if (this.angVel !== 0) {
      this.angle += this.angVel * dt;
      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;
    }

    // 가속도(가속/감속 탄환)
    if (this.accel !== 0) {
      this.speed += this.accel * dt;
      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;
    }

    // 유도 탄환 (플레이어 추적형 또는 시노부 나비탄)
    if (this.target && this.homingStrength > 0) {
      const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      let diff = targetAngle - this.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;

      this.angle += diff * Math.min(1.0, this.homingStrength * dt);
      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  /**
   * 탄환 타입별 캔버스 벡터 발광 렌더링
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    if (!this.isActive) return;

    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));

    switch (this.type) {
      case 'player_needle':
        this._renderPlayerNeedle(ctx);
        break;
      case 'player_butterfly':
        this._renderPlayerButterfly(ctx);
        break;
      case 'enemy_lotus':
        this._renderEnemyLotus(ctx);
        break;
      case 'enemy_blade':
        this._renderEnemyBlade(ctx);
        break;
      case 'enemy_icicle':
        this._renderEnemyIcicle(ctx);
        break;
      case 'enemy_homing':
        this._renderEnemyHoming(ctx);
        break;
      case 'enemy_predictive':
        this._renderEnemyPredictive(ctx);
        break;
      case 'enemy_ice':
      default:
        this._renderEnemyIce(ctx);
        break;
    }

    ctx.restore();
  }

  _renderPlayerNeedle(ctx) {
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#e040fb';
    ctx.shadowColor = '#ea80fc';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(8, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  _renderPlayerButterfly(ctx) {
    ctx.rotate(this.angle);
    ctx.fillStyle = '#b388ff';
    ctx.shadowColor = '#b388ff';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.ellipse(-2, -4, 5, 3, 0.4, 0, Math.PI * 2);
    ctx.ellipse(-2, 4, 5, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  _renderEnemyIce(ctx) {
    // 도우마 기본 얼음 결정체 (육각형/다이아몬드)
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;

    const r = this.radius;
    ctx.beginPath();
    ctx.moveTo(r * 1.5, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 1.2, 0);
    ctx.lineTo(0, -r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  _renderEnemyLotus(ctx) {
    const time = this.lifetime * 4;
    ctx.rotate(time);
    ctx.fillStyle = 'rgba(128, 222, 234, 0.85)';
    ctx.strokeStyle = '#e0f7fa';
    ctx.lineWidth = 1.2;

    const petals = 5;
    for (let i = 0; i < petals; i++) {
      ctx.rotate((Math.PI * 2) / petals);
      ctx.beginPath();
      ctx.ellipse(this.radius * 0.8, 0, this.radius * 0.7, this.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  _renderEnemyBlade(ctx) {
    ctx.rotate(this.angle);
    ctx.fillStyle = '#80d8ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 10;

    const r = this.radius * 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.bezierCurveTo(r * 0.4, r * 0.4, r * 0.4, -r * 0.4, Math.cos(-Math.PI * 0.4) * r, Math.sin(-Math.PI * 0.4) * r);
    ctx.closePath();
    ctx.fill();
  }

  _renderEnemyIcicle(ctx) {
    // 4. 얼음 결정 낙하: 날카로운 고드름 형상
    ctx.rotate(this.angle);
    ctx.fillStyle = '#b2ebf2';
    ctx.shadowColor = '#80deea';
    ctx.shadowBlur = 8;

    const r = this.radius;
    ctx.beginPath();
    ctx.moveTo(r * 2.2, 0); // 날카로운 끝단
    ctx.lineTo(-r, r * 0.8);
    ctx.lineTo(-r * 0.6, 0);
    ctx.lineTo(-r, -r * 0.8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  _renderEnemyHoming(ctx) {
    // 1. 플레이어 추적형: 회전하는 서리 결정 구체
    ctx.rotate(this.lifetime * 6);
    ctx.fillStyle = '#80d8ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12;

    const r = this.radius;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // 외곽 회전 돌기
    ctx.strokeStyle = '#e0f7fa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 1.4, 0);
    ctx.lineTo(r * 1.4, 0);
    ctx.moveTo(0, -r * 1.4);
    ctx.lineTo(0, r * 1.4);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  _renderEnemyPredictive(ctx) {
    // 5. 플레이어 위치 예측 저격: 장거리 고속 침 (적빛 가미된 냉기)
    ctx.rotate(this.angle);
    ctx.fillStyle = '#ff80ab';
    ctx.shadowColor = '#ff4081';
    ctx.shadowBlur = 10;

    const r = this.radius;
    ctx.beginPath();
    ctx.moveTo(r * 2.6, 0);
    ctx.lineTo(-r * 1.2, r * 0.6);
    ctx.lineTo(-r * 1.2, -r * 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(r * 0.6, 0, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}
