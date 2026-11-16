/**
 * Douma (도우마 - 상현 2 보스 엔티티)
 * 
 * - 3개 페이즈 기반 지능형 탄막 AI 상태 머신
 * - 6대 탄막 패턴 스케줄링 (추적, 원형, 부채형, 결정낙하, 위치예측, 복합콤보)
 * - 난이도 설정값(DIFFICULTY_CONFIG)을 주입받아 수치 배수로 밸런스 제어
 * - 등꽃 독 디버프(공격 주기 지연) 반영
 */

import { Character } from './Character.js';
import { CHARACTER_CONFIGS } from '../config/characterConfigs.js';
import { DIFFICULTY_CONFIG } from '../config/difficultyConfig.js';

export class Douma extends Character {
  constructor(renderer, danmakuPatterns, customConfig = {}) {
    const config = { ...CHARACTER_CONFIGS.douma, ...customConfig };
    super(config, renderer);

    this.danmaku = danmakuPatterns;

    // 현재 적용된 난이도 설정 객체 (기본 NORMAL)
    this.diff = DIFFICULTY_CONFIG.NORMAL;

    // 보스 전투 속성
    this.maxHp = this.diff.bossMaxHp;
    this.hp = this.maxHp;
    this.phase = 1;
    this.previousPhase = 1;

    // 이동 파라미터 (상단 영역 유영 AI)
    this.baseX = 270;
    this.baseY = 220;
    this.moveTimer = 0;
    this.targetMoveX = 270;

    // 6대 탄막 타이머
    this.timerHoming = 0;     // 패턴 1: 추적형
    this.timerRing = 0;       // 패턴 2: 원형 확산
    this.timerFan = 0;        // 패턴 3: 부채형
    this.timerIcicle = 0;     // 패턴 4: 결정 낙하
    this.timerPredictive = 0; // 패턴 5: 위치 예측
    this.timerComposite = 0;  // 패턴 6: 복합 콤보

    // 디버프
    this.isPoisoned = false;
    this.poisonDuration = 0;
  }

  /**
   * 난이도 설정 주입 (EASY / NORMAL / HARD)
   */
  setDifficulty(difficultyConfig) {
    this.diff = difficultyConfig;
    this.maxHp = this.diff.bossMaxHp;
    this.hp = this.maxHp;
  }

  /**
   * 등꽃 독 중독 적용
   */
  applyPoison(duration = 3.5) {
    this.isPoisoned = true;
    this.poisonDuration = duration;
  }

  /**
   * 보스 상태 리셋 (새 게임 시작 시)
   */
  resetCombat() {
    this.maxHp = this.diff.bossMaxHp;
    this.hp = this.maxHp;
    this.phase = 1;
    this.previousPhase = 1;

    this.isPoisoned = false;
    this.poisonDuration = 0;

    this.timerHoming = 0;
    this.timerRing = 0;
    this.timerFan = 0;
    this.timerIcicle = 0;
    this.timerPredictive = 0;
    this.timerComposite = 0;
    this.moveTimer = 0;

    this.x = this.baseX;
    this.y = this.baseY;
    this.isAlive = true;
    this.isActionLocked = false;
    this.playAnimation('idle', true);
  }

  /**
   * 보스 전투 프레임 업데이트
   */
  updateCombat(dt, targetPlayer, bulletPool, viewWidth = 540) {
    if (!this.isAlive) {
      super.update(dt);
      return;
    }

    // 1. 독 디버프 갱신 (초당 도트 대미지)
    if (this.isPoisoned) {
      this.poisonDuration -= dt;
      this.hp = Math.max(0, this.hp - 16 * dt);
      if (this.poisonDuration <= 0) {
        this.isPoisoned = false;
      }
    }

    // 2. 페이즈 전환 판정
    const hpRatio = this.hp / this.maxHp;
    if (hpRatio > 0.66) {
      this.phase = 1;
    } else if (hpRatio > 0.33) {
      this.phase = 2;
    } else {
      this.phase = 3;
    }

    // 페이즈 전환 시 적 탄환 일괄 소거 및 포효 모션
    if (this.phase !== this.previousPhase) {
      this.previousPhase = this.phase;
      bulletPool.clearEnemyBullets();
      this.playAnimation('attack', true);
    }

    // 3. 페이즈별 지능형 이동 AI
    this._updateMovementAI(dt, targetPlayer, viewWidth);

    // 4. 탄막 패턴 생성 스케줄링
    if (this.danmaku) {
      this.danmaku.update(dt);
      this._handlePhaseDanmaku(dt, targetPlayer, viewWidth);
    }

    // 5. 물리 및 스프라이트 애니메이션 갱신
    super.update(dt);
  }

  // ==========================================
  // [보스 이동 AI]
  // ==========================================
  _updateMovementAI(dt, player, viewWidth) {
    this.moveTimer += dt;
    const speedScale = this.isPoisoned ? 0.65 : 1.0;

    if (this.phase === 1) {
      // 1페이즈: 상단 좌우 부드러운 사인파 유영
      this.x = this.baseX + Math.sin(this.moveTimer * 1.1 * speedScale) * 115;
      this.y = this.baseY + Math.cos(this.moveTimer * 0.7 * speedScale) * 20;
    } else if (this.phase === 2) {
      // 2페이즈: 플레이어의 반대편으로 천천히 포지셔닝하며 각도 확보
      const oppositeX = viewWidth - player.x;
      this.x += (oppositeX - this.x) * 1.5 * dt * speedScale;
      this.y = this.baseY + Math.sin(this.moveTimer * 1.5 * speedScale) * 25;
    } else {
      // 3페이즈: 중앙에서 긴박한 8자 기동 (압박감 고조)
      this.x = this.baseX + Math.sin(this.moveTimer * 1.8 * speedScale) * 130;
      this.y = this.baseY + Math.sin(this.moveTimer * 3.6 * speedScale) * 35;
    }
  }

  // ==========================================
  // [페이즈별 6대 탄막 패턴 스케줄러]
  // ==========================================
  _handlePhaseDanmaku(dt, player, viewWidth) {
    // 독 중독 시 1.4배 쿨다운 지연, 난이도 쿨다운 배수 적용
    const cooldownFactor = (this.isPoisoned ? 1.4 : 1.0) * this.diff.cooldownMultiplier;

    this.timerHoming += dt;
    this.timerRing += dt;
    this.timerFan += dt;
    this.timerIcicle += dt;
    this.timerPredictive += dt;
    this.timerComposite += dt;

    if (this.phase === 1) {
      // ====================================================
      // [1페이즈: 기본 공격]
      // 패턴: 2(원형 확산) + 3(부채형 광역) + 1(추적형 탄환)
      // ====================================================

      // [패턴 2: 원형 확산 탄막] - 1.9초 주기
      if (this.timerRing >= 1.9 * cooldownFactor) {
        this.timerRing = 0;
        this.danmaku.spawnCircularRing(this, this.diff, 16, 145);
      }

      // [패턴 3: 부채형 광역 탄막] - 2.5초 주기
      if (this.timerFan >= 2.5 * cooldownFactor) {
        this.timerFan = 0;
        this.danmaku.spawnFanSpread(this, this.diff, 7, 0.8, 220);
        this.playAnimation('attack');
      }

      // [패턴 1: 플레이어 추적형 얼음 탄환] - 3.8초 주기
      if (this.timerHoming >= 3.8 * cooldownFactor) {
        this.timerHoming = 0;
        this.danmaku.spawnHomingShards(this, player, this.diff, 2);
      }

    } else if (this.phase === 2) {
      // ====================================================
      // [2페이즈: 공격 패턴 강화]
      // 패턴: 4(얼음 결정 낙하) + 5(위치 예측 공격) + 3(강화 부채형) + 2(원형)
      // ====================================================

      // [패턴 4: 얼음 결정 낙하] - 2.1초 주기 (천장에서 수직 하강)
      if (this.timerIcicle >= 2.1 * cooldownFactor) {
        this.timerIcicle = 0;
        this.danmaku.spawnFallingIcicles(viewWidth, this.diff, 6, 185);
      }

      // [패턴 5: 플레이어 위치 예측 공격] - 2.8초 주기 (이동 방향 미래 저격)
      if (this.timerPredictive >= 2.8 * cooldownFactor) {
        this.timerPredictive = 0;
        this.danmaku.spawnPredictiveSnipe(this, player, this.diff, 330);
        this.playAnimation('attack');
      }

      // [패턴 3: 강화된 부채형 광역 탄막] - 2.2초 주기
      if (this.timerFan >= 2.2 * cooldownFactor) {
        this.timerFan = 0;
        this.danmaku.spawnFanSpread(this, this.diff, 9, 1.0, 240);
      }

      // [패턴 2: 빠른 원형 확산 탄막] - 3.4초 주기
      if (this.timerRing >= 3.4 * cooldownFactor) {
        this.timerRing = 0;
        this.danmaku.spawnCircularRing(this, this.diff, 18, 160);
      }

    } else {
      // ====================================================
      // [3페이즈: 고난도 복합 탄막 & 발악]
      // 패턴: 6(복합 콤보) + 5(위치 예측 저격) + 1(추적형 3연발)
      // ====================================================

      // [패턴 6: 복합 탄막 콤보] - 2.7초 주기
      // (원형 링 + 얼음 고드름 낙하 + 초승달 칼날 동시 교차)
      if (this.timerComposite >= 2.7 * cooldownFactor) {
        this.timerComposite = 0;
        this.danmaku.spawnCompositeCombo(this, viewWidth, this.diff);
        this.playAnimation('attack');
      }

      // [패턴 5: 위치 예측 저격] - 2.2초 주기
      if (this.timerPredictive >= 2.2 * cooldownFactor) {
        this.timerPredictive = 0;
        this.danmaku.spawnPredictiveSnipe(this, player, this.diff, 360);
      }

      // [패턴 1: 플레이어 추적형 탄환] - 3.2초 주기
      if (this.timerHoming >= 3.2 * cooldownFactor) {
        this.timerHoming = 0;
        this.danmaku.spawnHomingShards(this, player, this.diff, 3);
      }
    }
  }
}
