/**
 * BackgroundRenderer - 배경 애셋 및 절차적 폴백 렌더러
 * 
 * - PNG/JPG 배경 이미지가 있으면 종스크롤(Seamless Vertical Scroll) 렌더링
 * - 이미지가 없을 경우 무한성 목조 격자 & 앰비언트 라이트 절차적 벡터 배경 작동
 * - 페이즈별 배경(Phase 1/2 기본 무한성 <-> Phase 3 빙결 사원) 전환 지원
 * - 탄막 시인성 보장을 위한 딤(Dim) 오버레이 필터 탑재
 */

import { BACKGROUND_CONFIG } from '../config/backgroundConfig.js';
import { assetManager } from '../core/AssetManager.js';

export class BackgroundRenderer {
  constructor(virtualWidth = 540, virtualHeight = 960) {
    this.W = virtualWidth;
    this.H = virtualHeight;
    this.config = BACKGROUND_CONFIG;

    this.scrollY = 0;
    this.forceProcedural = false; // 절차적 배경 강제 토글

    // 배경 파티클 (서리 & 등꽃 안개)
    this.bgParticles = [];
    this._initParticles();
  }

  _initParticles() {
    for (let i = 0; i < 45; i++) {
      this.bgParticles.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        speed: 20 + Math.random() * 35,
        size: 1.2 + Math.random() * 2.5,
        alpha: 0.15 + Math.random() * 0.35,
        color: Math.random() > 0.5 ? '#b388ff' : '#80d8ff'
      });
    }
  }

  /**
   * 배경 스크롤 위치 및 파티클 갱신
   */
  update(dt) {
    if (this.config.enableScroll) {
      this.scrollY += this.config.scrollSpeed * dt;
    }

    // 배경 파티클 이동
    for (const p of this.bgParticles) {
      p.y += p.speed * dt;
      if (p.y > this.H) {
        p.y = -10;
        p.x = Math.random() * this.W;
      }
    }
  }

  /**
   * 배경 렌더링 진입점
   * @param {CanvasRenderingContext2D} ctx 
   * @param {number} bossPhase 보스 현재 페이즈 (1, 2, 3)
   */
  render(ctx, bossPhase = 1) {
    // 1. 사용할 이미지 키 결정 (Phase 3일 때 특수 배경 우선 검사)
    let imageKey = this.config.assets.default.key;
    if (bossPhase === 3 && assetManager.hasLoaded(this.config.assets.iceTemple.key)) {
      imageKey = this.config.assets.iceTemple.key;
    }

    const hasImage = !this.forceProcedural && assetManager.hasLoaded(imageKey);

    if (hasImage) {
      // 2-A. 실제 이미지 애셋 렌더링 (연속 무한 종스크롤)
      this._renderImageBackground(ctx, assetManager.getImage(imageKey));
    } else {
      // 2-B. 애셋 미배치 시 절차적 벡터 배경 작동
      this._renderProceduralBackground(ctx, bossPhase);
    }

    // 3. 배경 파티클 렌더링
    this._renderParticles(ctx);
  }

  // ==========================================
  // [1] 이미지 애셋 기반 무한 종스크롤 렌더링
  // ==========================================
  _renderImageBackground(ctx, img) {
    ctx.save();

    // 캔버스 너비에 맞게 이미지 스케일링 비율 계산
    const scale = this.W / img.width;
    const scaledHeight = img.height * scale;

    // Y축 스크롤 오프셋 (모듈로 연산으로 끊김 없는 루프)
    const offset = Math.floor(this.scrollY % scaledHeight);

    // 상하 2장을 연이어 그려 화면 전체를 빈틈없이 커버
    ctx.drawImage(img, 0, offset, this.W, scaledHeight);
    ctx.drawImage(img, 0, offset - scaledHeight, this.W, scaledHeight);

    if (offset + scaledHeight < this.H) {
      ctx.drawImage(img, 0, offset + scaledHeight, this.W, scaledHeight);
    }

    // 탄환 시인성 확보를 위한 반투명 딤 필터
    if (this.config.darkOverlayAlpha > 0) {
      ctx.fillStyle = `rgba(10, 8, 20, ${this.config.darkOverlayAlpha})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }

    ctx.restore();
  }

  // ==========================================
  // [2] 절차적 벡터 무한성 배경 (Fallback)
  // ==========================================
  _renderProceduralBackground(ctx, bossPhase) {
    const theme = this.config.fallbackTheme;

    ctx.save();

    // 1. 기본 그라데이션 (Phase 3에는 핏빛/극빙 어둠 가미)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, this.H);
    if (bossPhase === 3) {
      bgGrad.addColorStop(0, '#100a18');
      bgGrad.addColorStop(0.5, '#1a0e28');
      bgGrad.addColorStop(1, '#0e172a');
    } else {
      bgGrad.addColorStop(0, theme.bgGradTop);
      bgGrad.addColorStop(0.5, theme.bgGradMid);
      bgGrad.addColorStop(1, theme.bgGradBottom);
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.W, this.H);

    // 2. 상단 도우마 서리 앰비언트 라이트
    const frostGlow = ctx.createRadialGradient(
      this.W / 2, 220, 20,
      this.W / 2, 220, 280
    );
    frostGlow.addColorStop(0, bossPhase === 3 ? 'rgba(0, 229, 255, 0.16)' : theme.frostLight);
    frostGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = frostGlow;
    ctx.fillRect(0, 0, this.W, this.H);

    // 3. 하단 시노부 등꽃 앰비언트 라이트
    const wisteriaGlow = ctx.createRadialGradient(
      this.W / 2, 800, 20,
      this.W / 2, 800, 250
    );
    wisteriaGlow.addColorStop(0, theme.wisteriaLight);
    wisteriaGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = wisteriaGlow;
    ctx.fillRect(0, 0, this.W, this.H);

    // 4. 무한성 목조 격자선 (스크롤 Y 적용으로 천천히 움직임)
    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 1;
    const gridSpacing = 60;
    const gridOffsetY = Math.floor(this.scrollY % gridSpacing);

    for (let x = gridSpacing; x < this.W; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.H);
      ctx.stroke();
    }
    for (let y = gridOffsetY - gridSpacing; y < this.H + gridSpacing; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.W, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  _renderParticles(ctx) {
    for (const p of this.bgParticles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * 배경 애셋 로드 상태 반환
   */
  getAssetStatus() {
    if (this.forceProcedural) return '강제 절차적 Fallback 모드';
    const defLoaded = assetManager.hasLoaded(this.config.assets.default.key);
    return defLoaded ? 'PNG 배경 애셋 로드 완료' : '절차적 Fallback (애셋 미배치 정상동작)';
  }
}
