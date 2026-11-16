/**
 * Entity
 * 
 * - 모든 게임 오브젝트의 최상위 기본 클래스
 * - 위치(x, y), 속도(vx, vy), 물리 충돌체 등 순수 게임 로직만 담당
 * - Canvas 렌더링에 대한 종속성을 일절 배제하여 로직과 렌더링을 완전 분리
 */

export class Entity {
  constructor({ x = 0, y = 0, width = 32, height = 32, hitboxRadius = 4 }) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.width = width;
    this.height = height;
    this.hitboxRadius = hitboxRadius;

    this.facing = 1; // 1 = 오른쪽, -1 = 왼쪽
    this.isAlive = true;
    this.tags = new Set();
  }

  /**
   * 물리 및 위치 이동 갱신
   */
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  /**
   * 화면 영역 내로 좌표 강제 제한
   */
  clampToBounds(minX, minY, maxX, maxY) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    this.x = Math.max(minX + halfW, Math.min(maxX - halfW, this.x));
    this.y = Math.max(minY + halfH, Math.min(maxY - halfH, this.y));
  }

  /**
   * 타겟과의 거리 계산
   */
  distanceTo(other) {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.hypot(dx, dy);
  }

  /**
   * 원형 충돌 판정
   */
  collidesWith(other) {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    const radiusSum = this.hitboxRadius + other.hitboxRadius;
    return dx * dx + dy * dy <= radiusSum * radiusSum;
  }
}
