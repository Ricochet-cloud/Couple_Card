/**
 * Character
 * 
 * - Entity를 상속받아 캐릭터의 생명주기 및 애니메이션 상태 머신을 제어
 * - 렌더러(CharacterRenderer)에게 화면 묘화를 전적으로 위임 (Strategy/Delegation Pattern)
 * - Idle / Move / Attack / Hit / Death 5대 상태 전환 및 비루프 모션 완료 처리
 */

import { Entity } from './Entity.js';
import { SpriteSheet } from '../graphics/SpriteSheet.js';
import { assetManager } from '../core/AssetManager.js';

export class Character extends Entity {
  constructor(config, renderer) {
    super({
      x: 0,
      y: 0,
      width: config.frameWidth * (config.scale || 1.0),
      height: config.frameHeight * (config.scale || 1.0),
      hitboxRadius: config.hitboxRadius
    });

    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.config = config;
    this.renderer = renderer;

    this.scale = config.scale || 1.0;
    this.alpha = 1.0;
    this.maxHp = config.maxHp || 100;
    this.hp = this.maxHp;

    // 스프라이트 시트 초기화 (이미지 애셋 로드 여부와 관계없이 설정 바인딩)
    this.spriteSheet = null;
    this._setupSpriteSheet(config);

    // 애니메이션 상태 관리
    this.currentAnimName = 'idle';
    this.currentAnim = null;
    this.stateTimer = 0;
    this.isActionLocked = false; // 공격/피격 중 다른 모션으로 즉시 덮어쓰기 방지

    this.playAnimation('idle');
  }

  /**
   * 스프라이트 시트 인스턴스 생성 및 설정 바인딩
   */
  _setupSpriteSheet(config) {
    const img = assetManager.getImage(config.id);
    this.spriteSheet = new SpriteSheet({
      image: img,
      frameWidth: config.frameWidth,
      frameHeight: config.frameHeight,
      scale: config.scale,
      originX: config.originX ?? 0.5,
      originY: config.originY ?? 0.5
    });

    // config에 정의된 애니메이션 등록
    for (const [animName, animCfg] of Object.entries(config.animations)) {
      this.spriteSheet.addAnimation(animName, {
        ...animCfg,
        onComplete: () => this._onAnimationComplete(animName)
      });
    }

    // 추후 비동기 애셋 로딩 완료 시 이미지 참조 자동 갱신 및 AI 프레임 슬라이싱
    assetManager.onStateChange((key, state) => {
      if (key === config.id && state === 'loaded') {
        const loadedImg = assetManager.getImage(key);
        this.spriteSheet.setImage(loadedImg);
      }
    });
  }

  /**
   * 애니메이션 상태 재생 전환
   * @param {'idle' | 'move' | 'attack' | 'hit' | 'death'} animName 
   * @param {boolean} forceReset 
   */
  playAnimation(animName, forceReset = false) {
    if (this.currentAnimName === 'death' && animName !== 'death' && !forceReset) {
      // 사망 상태는 부활/리셋 전까지 고정
      return;
    }

    if (this.isActionLocked && !forceReset && animName !== 'death') {
      return;
    }

    this.currentAnimName = animName;

    if (this.spriteSheet) {
      this.spriteSheet.play(animName, forceReset);
      this.currentAnim = this.spriteSheet.getCurrentAnimation();
    }

    // 단발성 액션 모션의 락(Lock) 처리
    if (animName === 'attack' || animName === 'hit') {
      this.isActionLocked = true;
    } else if (animName === 'death') {
      this.isActionLocked = true;
      this.isAlive = false;
    } else {
      this.isActionLocked = false;
    }
  }

  /**
   * 단발성 애니메이션 완료 시 호출 (자동 상태 복귀)
   */
  _onAnimationComplete(animName) {
    if (animName === 'attack' || animName === 'hit') {
      this.isActionLocked = false;
      // 이동 중이면 move로, 아니면 idle로 자동 복귀
      if (Math.abs(this.vx) > 1 || Math.abs(this.vy) > 1) {
        this.playAnimation('move');
      } else {
        this.playAnimation('idle');
      }
    }
  }

  /**
   * 애니메이션 재생 속도 조절
   */
  setAnimationSpeed(multiplier) {
    if (this.spriteSheet) {
      this.spriteSheet.setSpeed(multiplier);
    }
  }

  /**
   * 피격 트리거
   */
  takeHit(damage = 10) {
    this.hp = Math.max(0, this.hp - damage);
    if (this.hp <= 0) {
      this.die();
    } else {
      this.playAnimation('hit', true);
    }
  }

  /**
   * 공격 트리거
   */
  performAttack() {
    if (this.currentAnimName === 'death') return;
    this.playAnimation('attack', true);
  }

  /**
   * 사망 트리거
   */
  die() {
    this.hp = 0;
    this.playAnimation('death', true);
  }

  /**
   * 상태 리셋 (테스트 및 재도전용)
   */
  revive() {
    this.hp = this.maxHp;
    this.isAlive = true;
    this.isActionLocked = false;
    this.playAnimation('idle', true);
  }

  /**
   * 게임 로직 업데이트 (물리 및 애니메이션 갱신)
   */
  update(dt) {
    super.update(dt);

    // 스프라이트 시트 프레임 갱신
    if (this.spriteSheet) {
      this.spriteSheet.update(dt);
      this.currentAnim = this.spriteSheet.getCurrentAnimation();
    }

    // 이동 속도에 따른 자동 move/idle 전환 (액션 락이 없을 때)
    if (!this.isActionLocked && this.isAlive) {
      const isMoving = Math.abs(this.vx) > 2 || Math.abs(this.vy) > 2;
      if (isMoving && this.currentAnimName !== 'move') {
        this.playAnimation('move');
      } else if (!isMoving && this.currentAnimName !== 'idle') {
        this.playAnimation('idle');
      }
    }

    // 좌우 바라보는 방향 자동 갱신
    if (this.vx > 1) this.facing = 1;
    else if (this.vx < -1) this.facing = -1;
  }

  /**
   * 렌더링을 렌더러 인스턴스에 위임
   */
  render(ctx) {
    if (this.renderer) {
      this.renderer.render(ctx, this);
    }
  }
}
