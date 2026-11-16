/**
 * CharacterRenderer
 * 
 * - 게임 로직(Entity/Character)과 렌더링 구현을 철저히 분리하는 프록시 렌더러
 * - 실제 PNG 스프라이트 시트가 로드되었으면 SpriteSheet를 통해 렌더링
 * - 애셋이 없거나 로드 실패, 혹은 테스트 모드일 경우 ProceduralCharacterRenderer로 자동 분기
 * - 정밀 피격점(Hitbox Core) 및 디버그 오버레이 렌더링 지원
 */

import { assetManager } from '../core/AssetManager.js';
import { ProceduralCharacterRenderer } from './ProceduralCharacterRenderer.js';

export class CharacterRenderer {
  constructor() {
    this.proceduralRenderer = new ProceduralCharacterRenderer();
    this.forceProcedural = false; // 테스트 및 강제 폴백 토글
    this.showHitbox = true;       // 피격 코어 표시 여부
    this.showDebugBounds = false; // 외곽선 디버그
  }

  /**
   * 경과 시간 기반 렌더러 내부 이펙트/파티클 갱신
   */
  update(dt) {
    this.proceduralRenderer.update(dt);
  }

  /**
   * 캐릭터 렌더링
   * @param {CanvasRenderingContext2D} ctx 
   * @param {import('../entities/Character.js').Character} character 
   */
  render(ctx, character) {
    const hasSprite = !this.forceProcedural && 
                      character.spriteSheet && 
                      assetManager.hasLoaded(character.id);

    if (hasSprite) {
      // 1. 실제 스프라이트 시트 렌더링 (투명 PNG)
      character.spriteSheet.draw(ctx, character.x, character.y, {
        scale: character.scale,
        flipX: character.facing < 0,
        alpha: character.alpha,
        rotation: character.aimTilt || 0
      });
    } else {
      // 2. 애셋 미탑재 시 Canvas 절차적 벡터 렌더러 작동
      this.proceduralRenderer.render(ctx, character);
    }

    // 3. 슈팅 게임의 핵심: 피격 코어(Hitbox) 표시 (시노부 집중 모드 또는 디버그 시)
    if (this.showHitbox && character.hitboxRadius > 0) {
      this._renderHitbox(ctx, character);
    }

    // 4. 개발 디버그 바운딩 박스
    if (this.showDebugBounds) {
      this._renderDebugBounds(ctx, character);
    }
  }

  _renderHitbox(ctx, character) {
    ctx.save();
    ctx.translate(Math.round(character.x), Math.round(character.y));

    // 플레이어(시노부) 피격점: 붉은색 외곽원 + 하얀색 중심점
    if (character.id === 'shinobu') {
      ctx.fillStyle = '#ff1744';
      ctx.beginPath();
      ctx.arc(0, 0, character.hitboxRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, character.hitboxRadius * 0.4), 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 보스(도우마) 피격 영역
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, character.hitboxRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  _renderDebugBounds(ctx, character) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(character.x - character.width / 2),
      Math.round(character.y - character.height / 2),
      character.width,
      character.height
    );
    ctx.restore();
  }
}
