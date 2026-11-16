/**
 * BulletPool - 탄환 오브젝트 풀링 시스템
 * 
 * - 수백~수천 발의 탄막 게임 환경에서 가비지 컬렉션(GC) 랙 방지
 * - 비활성화된 탄환 객체를 재사용하여 60 FPS 유지
 * - 화면 경계 검사 및 자동 회수
 */

import { Bullet } from './Bullet.js';

export class BulletPool {
  constructor(initialCapacity = 1000) {
    this.pool = [];
    this.activeBullets = [];

    // 초기 탄환 인스턴스 사전 할당
    for (let i = 0; i < initialCapacity; i++) {
      this.pool.push(new Bullet());
    }
  }

  /**
   * 풀에서 비활성 탄환을 가져와 초기화 및 활성화
   */
  spawn(options) {
    let bullet = null;

    // 풀에서 미사용 객체 탐색
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].isActive) {
        bullet = this.pool[i];
        break;
      }
    }

    // 풀이 꽉 찼을 경우에만 추가 인스턴스 생성 (동적 확장)
    if (!bullet) {
      bullet = new Bullet();
      this.pool.push(bullet);
    }

    bullet.init(options);
    return bullet;
  }

  /**
   * 모든 활성 탄환 갱신 및 화면 경계 밖 탄환 회수
   */
  update(dt, bounds = { minX: -60, minY: -60, maxX: 600, maxY: 1020 }) {
    for (let i = 0; i < this.pool.length; i++) {
      const b = this.pool[i];
      if (!b.isActive) continue;

      b.update(dt);

      // 화면 경계 이탈 검사 -> 자동 회수
      if (b.x < bounds.minX || b.x > bounds.maxX || b.y < bounds.minY || b.y > bounds.maxY) {
        b.deactivate();
      }
    }
  }

  /**
   * 모든 활성 탄환 캔버스 렌더링
   */
  render(ctx) {
    for (let i = 0; i < this.pool.length; i++) {
      const b = this.pool[i];
      if (b.isActive) {
        b.render(ctx);
      }
    }
  }

  /**
   * 특정 소유자('enemy' | 'player')의 모든 활성 탄환 배열 반환
   */
  getActiveBullets(owner = null) {
    const list = [];
    for (let i = 0; i < this.pool.length; i++) {
      const b = this.pool[i];
      if (b.isActive && (!owner || b.owner === owner)) {
        list.push(b);
      }
    }
    return list;
  }

  /**
   * 적 탄환 일괄 소거 (결전 오의 폭탄 또는 페이즈 전환 시)
   * @returns {Array<{x: number, y: number}>} 소거된 탄환 좌표 목록 (파티클 생성용)
   */
  clearEnemyBullets() {
    const cleared = [];
    for (let i = 0; i < this.pool.length; i++) {
      const b = this.pool[i];
      if (b.isActive && b.owner === 'enemy') {
        cleared.push({ x: b.x, y: b.y, type: b.type });
        b.deactivate();
      }
    }
    return cleared;
  }

  /**
   * 전체 탄환 리셋
   */
  resetAll() {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].deactivate();
    }
  }

  /**
   * 현재 활성화된 탄환 수
   */
  getActiveCount() {
    let count = 0;
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].isActive) count++;
    }
    return count;
  }
}
