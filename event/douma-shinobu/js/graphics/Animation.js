/**
 * Animation
 * 
 * - 단일 애니메이션 클립(Sequence)의 재생 상태 및 프레임 타이밍 제어
 * - 균등 그리드(row, col) 및 AI 불균등 스프라이트(customFrames) 동시 지원
 */

export class Animation {
  constructor({ name, row = 0, frames = 1, fps = 8, loop = true, onComplete = null, customFrames = null, description = '' }) {
    this.name = name;
    this.row = row;
    this.customFrames = customFrames;
    this.totalFrames = customFrames && customFrames.length > 0 ? customFrames.length : Math.max(1, frames);
    this.baseFps = fps;
    this.loop = loop;
    this.onComplete = onComplete;
    this.description = description;

    this.currentFrame = 0;
    this.elapsedTime = 0;
    this.speedMultiplier = 1.0;
    this.isCompleted = false;
  }

  get frameDuration() {
    const effectiveFps = Math.max(0.1, this.baseFps * this.speedMultiplier);
    return 1 / effectiveFps;
  }

  update(dt) {
    if (this.isCompleted && !this.loop) return;

    this.elapsedTime += dt;
    const duration = this.frameDuration;

    while (this.elapsedTime >= duration) {
      this.elapsedTime -= duration;
      
      if (this.currentFrame < this.totalFrames - 1) {
        this.currentFrame++;
      } else {
        if (this.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = this.totalFrames - 1;
          this.isCompleted = true;
          if (this.onComplete) {
            this.onComplete(this);
          }
          break;
        }
      }
    }
  }

  reset() {
    this.currentFrame = 0;
    this.elapsedTime = 0;
    this.isCompleted = false;
  }

  setSpeed(multiplier) {
    this.speedMultiplier = Math.max(0.1, multiplier);
  }

  getFrameIndex() {
    return this.currentFrame;
  }
}
