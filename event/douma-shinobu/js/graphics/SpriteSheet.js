/**
 * SpriteSheet
 * 
 * - 투명 배경 PNG 기반 스프라이트 시트 관리 및 렌더링
 * - AI 생성 이미지(불균등 그리드, 고해상도 DALL-E) 자동 프레임 검출(Auto-Slicer) 탑재
 * - 수동 커스텀 프레임 좌표 및 기존 정형 그리드 동시 지원
 * - 좌우 반전(flipX), 스케일링, 중심점 오프셋(origin) 완벽 지원
 */

import { Animation } from './Animation.js';

export class SpriteSheet {
  constructor({ image = null, frameWidth = 64, frameHeight = 64, scale = 1.0, originX = 0.5, originY = 0.5, autoSlice = true }) {
    this.image = image;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.defaultScale = scale;
    this.originX = originX;
    this.originY = originY;
    this.autoSlice = autoSlice;

    this.animations = new Map();
    this.currentAnimName = null;
    this.currentAnim = null;

    if (image) {
      this._processImage(image);
    }
  }

  setImage(image) {
    this.image = image;
    if (image) {
      this._processImage(image);
    }
  }

  /**
   * AI 생성 고해상도 이미지일 경우 각 행의 실제 스프라이트 픽셀 영역을 자동 슬라이싱
   */
  _processImage(img) {
    if (!this.autoSlice || typeof document === 'undefined') return;

    // 이미지 해상도가 기본 그리드 크기(64x64 등)보다 2배 이상 크다면 AI 고해상도 시트로 판별
    const isLargeAiSheet = img.width > 500 && img.height > 400;
    if (!isLargeAiSheet) return;

    try {
      console.log(`[SpriteSheet] AI 스프라이트 시트 감지 (${img.width}x${img.height}). 정밀 프레임 자동 추출을 시작합니다.`);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);
      const data = imgData.data;

      const rowCount = 5;
      const rowHeight = img.height / rowCount;

      // 행별 애니메이션 매핑 순서: 0: idle, 1: move, 2: attack, 3: hit, 4: death
      const rowAnimNames = ['idle', 'move', 'attack', 'hit', 'death'];

      for (let r = 0; r < rowCount; r++) {
        const animName = rowAnimNames[r];
        const anim = this.animations.get(animName);
        if (!anim) continue;

        const y0 = Math.floor(r * rowHeight);
        const y1 = Math.floor((r + 1) * rowHeight);

        // 세로 투영 밀도 스캔
        const colDensity = new Array(img.width).fill(0);
        for (let y = y0; y < y1; y++) {
          const rowOff = y * img.width * 4;
          for (let x = 0; x < img.width; x++) {
            if (data[rowOff + x * 4 + 3] > 30) {
              colDensity[x]++;
            }
          }
        }

        // 연속 픽셀 블록 분할
        const blocks = [];
        let inBlock = false;
        let startX = 0;
        for (let x = 0; x < img.width; x++) {
          if (colDensity[x] > 12 && !inBlock) {
            inBlock = true;
            startX = x;
          } else if (colDensity[x] <= 12 && inBlock) {
            inBlock = false;
            if (x - startX > 35) {
              blocks.push({ x: startX, w: x - startX });
            }
          }
        }
        if (inBlock && img.width - startX > 35) {
          blocks.push({ x: startX, w: img.width - startX });
        }

        if (blocks.length > 0) {
          // 각 블록의 상/하 실제 경계 산출
          const extractedFrames = blocks.map(b => {
            let top = y1;
            let bottom = y0;
            for (let y = y0; y < y1; y++) {
              const rowOff = y * img.width * 4;
              for (let x = b.x; x < b.x + b.w; x++) {
                if (data[rowOff + x * 4 + 3] > 30) {
                  if (y < top) top = y;
                  if (y > bottom) bottom = y;
                }
              }
            }
            return {
              x: Math.max(0, b.x - 2),
              y: Math.max(0, top - 2),
              w: b.w + 4,
              h: Math.max(10, (bottom - top) + 4)
            };
          });

          // 애니메이션 클립에 정밀 좌표 주입
          anim.customFrames = extractedFrames;
          anim.totalFrames = extractedFrames.length;
          console.log(`[SpriteSheet] ${animName} 프레임 ${extractedFrames.length}개 자동 매핑 완료.`);
        }
      }
    } catch (err) {
      console.warn('[SpriteSheet] 자동 프레임 슬라이싱 실패 (CORS 등):', err);
    }
  }

  addAnimation(name, config) {
    const anim = new Animation({ name, ...config });
    this.animations.set(name, anim);
    if (!this.currentAnim) {
      this.play(name);
    }
    return anim;
  }

  play(name, forceReset = false) {
    if (!this.animations.has(name)) {
      return;
    }

    if (this.currentAnimName === name && !forceReset) {
      return;
    }

    this.currentAnimName = name;
    this.currentAnim = this.animations.get(name);
    this.currentAnim.reset();
  }

  update(dt) {
    if (this.currentAnim) {
      this.currentAnim.update(dt);
    }
  }

  setSpeed(multiplier) {
    for (const anim of this.animations.values()) {
      anim.setSpeed(multiplier);
    }
  }

  /**
   * 캔버스 렌더링 (커스텀 프레임 지원 및 센터링)
   */
  draw(ctx, x, y, options = {}) {
    if (!this.image || !this.currentAnim) return;

    let scale = options.scale ?? this.defaultScale;
    const flipX = options.flipX ?? false;
    const alpha = options.alpha ?? 1.0;
    const rotation = options.rotation ?? 0;

    let sx, sy, sw, sh;

    // 1. 커스텀 프레임이 설정되어 있는 경우 (AI 슬라이싱 또는 수동 좌표)
    if (this.currentAnim.customFrames && this.currentAnim.customFrames.length > 0) {
      const idx = this.currentAnim.getFrameIndex() % this.currentAnim.customFrames.length;
      const f = this.currentAnim.customFrames[idx];
      sx = f.x;
      sy = f.y;
      sw = f.w;
      sh = f.h;

      // 만약 고해상도 프레임(높이 > 150px)인데 scale이 1.0 이상으로 크면 화면에 맞게 자동 보정
      if (sh > 150 && scale >= 1.0) {
        scale = 0.55;
      }
    } else {
      // 2. 표준 균등 그리드
      const col = this.currentAnim.getFrameIndex();
      const row = this.currentAnim.row;
      sx = col * this.frameWidth;
      sy = row * this.frameHeight;
      sw = this.frameWidth;
      sh = this.frameHeight;
    }

    const dw = sw * scale;
    const dh = sh * scale;
    const ox = dw * this.originX;
    const oy = dh * this.originY;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));

    if (rotation !== 0) ctx.rotate(rotation);
    if (flipX) ctx.scale(-1, 1);

    // 픽셀 아트 선명도
    ctx.imageSmoothingEnabled = false;

    // 투명 배경 PNG 렌더링
    ctx.drawImage(
      this.image,
      sx, sy, sw, sh,
      -ox, -oy, dw, dh
    );

    ctx.restore();
  }

  getCurrentAnimation() {
    return this.currentAnim;
  }

  getCurrentAnimName() {
    return this.currentAnimName;
  }
}
