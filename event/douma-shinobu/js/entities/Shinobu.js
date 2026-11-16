/**
 * Shinobu (코쵸우 시노부 - 플레이어)
 * 
 * - 이동 및 저속 집중(Focus) 모드
 * - 자동 공격 시스템 (고속 전방 독침 연사 + 유도 나비탄)
 * - 피격 무적 시간(Invulnerability) 및 점멸 처리
 * - 결전 오의 폭탄 (화면 내 적 탄막 소거 & 무적)
 */

import { Character } from './Character.js';
import { CHARACTER_CONFIGS } from '../config/characterConfigs.js';

export class Shinobu extends Character {
  constructor(renderer, customConfig = {}) {
    const config = { ...CHARACTER_CONFIGS.shinobu, ...customConfig };
    super(config, renderer);

    // 전투 관련 속성
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.lives = 3;       // 잔기
    this.bombs = 3;       // 폭탄
    this.poisonGauge = 0; // 등꽃 독 게이지 (0 ~ 100)

    // 조작 및 상태 모드
    this.isFocusMode = false;
    this.isAutoShooting = true;

    // 보스(도우마) 시선 추적 및 방향 제어
    this.lookAtBoss = true;   // 도우마 위치에 맞춰 자동으로 시선 고정
    this.flipBase = false;    // 원본 스프라이트 반전 여부
    this.aimTilt = 0;         // 도우마를 향한 미세 조준 기울기 각도

    // 무적 시간 관리 (피격 후 무적 깜빡임)
    this.invulnerableTimer = 0;
    this.maxInvulnerableTime = 1.5; // 피격 시 1.5초 무적

    // 사격 타이머
    this.needleTimer = 0;
    this.needleInterval = 0.09; // 약 11발/초

    this.butterflyTimer = 0;
    this.butterflyInterval = 0.35; // 약 3발/초
  }

  get isInvulnerable() {
    return this.invulnerableTimer > 0;
  }

  /**
   * 저속 집중 모드 설정 (피격점 축소 가시화 & 탄환 집탄율 증가)
   */
  setFocusMode(enabled) {
    this.isFocusMode = enabled;
  }

  get currentSpeed() {
    return this.isFocusMode ? this.config.focusSpeed : this.config.baseSpeed;
  }

  /**
   * 대미지 피격 처리
   */
  takeDamage(amount = 20) {
    if (this.isInvulnerable || !this.isAlive) return;

    this.hp = Math.max(0, this.hp - amount);
    this.invulnerableTimer = this.maxInvulnerableTime;

    if (this.hp <= 0) {
      this.lives--;
      if (this.lives > 0) {
        // 잔기 남아있으면 체력 회복 후 무적 부여
        this.hp = this.maxHp;
        this.invulnerableTimer = 2.5; // 부활 시 2.5초 무적
        this.playAnimation('hit', true);
      } else {
        this.die();
      }
    } else {
      this.playAnimation('hit', true);
    }
  }

  /**
   * 결전 오의 (접아의 호흡 - 나비의 춤 / 폭탄)
   */
  useBomb(bulletPool, douma) {
    if (this.bombs <= 0 || !this.isAlive) return false;

    this.bombs--;
    this.invulnerableTimer = 3.0; // 3초 완전 무적

    // 1. 화면 내 모든 적 탄환 소거
    bulletPool.clearEnemyBullets();

    // 2. 도우마에게 대량의 독 및 대미지 주입
    if (douma && douma.isAlive) {
      douma.takeHit(60);
      douma.applyPoison(4.0);
    }

    this.playAnimation('attack', true);
    return true;
  }

  /**
   * 등꽃 독 축적
   */
  addPoison(amount) {
    this.poisonGauge = Math.min(100, this.poisonGauge + amount);
    return this.poisonGauge >= 100;
  }

  consumePoison() {
    const full = this.poisonGauge >= 100;
    this.poisonGauge = 0;
    return full;
  }

  /**
   * 상태 리셋 (새 게임 시작 시, 난이도별 피격점 및 잔기 반영)
   */
  resetCombat(diff = null) {
    if (diff) {
      this.lives = diff.playerLives ?? 3;
      this.bombs = diff.playerBombs ?? 3;
      this.hitboxRadius = diff.playerHitboxRadius ?? 3.5;
    } else {
      this.lives = 3;
      this.bombs = 3;
      this.hitboxRadius = 3.5;
    }
    this.hp = this.maxHp;
    this.poisonGauge = 0;
    this.invulnerableTimer = 1.0;
    this.isAlive = true;
    this.isActionLocked = false;
    this.playAnimation('idle', true);
  }

  /**
   * 전투 프레임 업데이트 및 자동 사격
   */
  updateCombat(dt, bulletPool, douma) {
    // 1. 기본 물리/애니메이션 업데이트
    super.update(dt);

    // 2. 도우마(보스) 시선 추적 및 조준 틸트 각도 갱신
    if (this.lookAtBoss && douma) {
      const dx = douma.x - this.x;
      const targetFacing = dx >= 0 ? 1 : -1;
      this.facing = this.flipBase ? -targetFacing : targetFacing;
      // 도우마가 있는 X 좌표 방향으로 몸을 미세하게 기울여 조준 (약 -10도 ~ +10도)
      this.aimTilt = Math.max(-0.16, Math.min(0.16, dx * 0.0006));
    } else {
      this.aimTilt = 0;
    }

    // 3. 무적 타이머 및 깜빡임 투명도 처리
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      // 점멸 효과
      this.alpha = Math.sin(this.invulnerableTimer * 30) > 0 ? 0.35 : 0.9;
      if (this.invulnerableTimer <= 0) {
        this.alpha = 1.0;
      }
    } else {
      this.alpha = 1.0;
    }

    if (!this.isAlive) return;

    // 3. 자동 사격 처리
    if (this.isAutoShooting && bulletPool) {
      this._handleAutoShooting(dt, bulletPool, douma);
    }
  }

  _handleAutoShooting(dt, bulletPool, douma) {
    // [1] 전방 고속 독침 연사 (2연장 또는 집중 3연장)
    this.needleTimer += dt;
    if (this.needleTimer >= this.needleInterval) {
      this.needleTimer = 0;

      const bulletSpeed = 700;
      if (this.isFocusMode) {
        // 저속 모드: 좁게 집중된 3연장 전방 사격
        const offsets = [-8, 0, 8];
        for (const ox of offsets) {
          bulletPool.spawn({
            x: this.x + ox,
            y: this.y - 18,
            angle: -Math.PI / 2,
            speed: bulletSpeed,
            radius: 3,
            damage: 2.2,
            type: 'player_needle',
            owner: 'player'
          });
        }
      } else {
        // 일반 모드: 약간의 확산 각도를 가진 2연장 사격
        bulletPool.spawn({
          x: this.x - 10,
          y: this.y - 16,
          angle: -Math.PI / 2 - 0.04,
          speed: bulletSpeed,
          radius: 3,
          damage: 1.8,
          type: 'player_needle',
          owner: 'player'
        });
        bulletPool.spawn({
          x: this.x + 10,
          y: this.y - 16,
          angle: -Math.PI / 2 + 0.04,
          speed: bulletSpeed,
          radius: 3,
          damage: 1.8,
          type: 'player_needle',
          owner: 'player'
        });
      }
    }

    // [2] 유도 나비 바늘 발사 (주기적 지원 사격)
    this.butterflyTimer += dt;
    if (this.butterflyTimer >= this.butterflyInterval) {
      this.butterflyTimer = 0;

      // 좌우로 날아오르며 도우마를 향해 유도되는 2발의 나비
      bulletPool.spawn({
        x: this.x - 16,
        y: this.y - 8,
        angle: -Math.PI * 0.75, // 좌상단으로 발사
        speed: 380,
        radius: 5,
        damage: 4.0,
        type: 'player_butterfly',
        owner: 'player',
        target: douma,
        homingStrength: 4.5
      });

      bulletPool.spawn({
        x: this.x + 16,
        y: this.y - 8,
        angle: -Math.PI * 0.25, // 우상단으로 발사
        speed: 380,
        radius: 5,
        damage: 4.0,
        type: 'player_butterfly',
        owner: 'player',
        target: douma,
        homingStrength: 4.5
      });
    }
  }
}
