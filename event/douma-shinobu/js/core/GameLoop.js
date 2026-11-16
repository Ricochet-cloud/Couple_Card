/**
 * GameLoop
 * 
 * - requestAnimationFrame 기반 가변 델타 타임 루프
 * - 탭 비활성화 후 복귀 시 물리 폭주를 막기 위한 dt Clamping 적용
 * - 실시간 FPS 계산 및 진단 정보 제공
 */

export class GameLoop {
  constructor(updateFn, renderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;

    this.isRunning = false;
    this.isPaused = false;
    this.rafId = null;

    this.lastTime = 0;
    this.maxDt = 0.1; // 최대 100ms 까지만 dt 허용 (프레임 스파이크 방지)

    // FPS 측정기
    this.fps = 60;
    this.frameCount = 0;
    this.fpsTimer = 0;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.fpsTimer = performance.now();

    const loop = (currentTime) => {
      if (!this.isRunning) return;

      const rawDt = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      // dt 클램핑
      const dt = Math.min(rawDt, this.maxDt);

      // FPS 계산
      this.frameCount++;
      if (currentTime - this.fpsTimer >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.fpsTimer));
        this.frameCount = 0;
        this.fpsTimer = currentTime;
      }

      if (!this.isPaused) {
        if (this.updateFn) this.updateFn(dt);
      }

      if (this.renderFn) this.renderFn();

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setPaused(paused) {
    this.isPaused = paused;
    if (!paused) {
      this.lastTime = performance.now();
    }
  }

  getFps() {
    return this.fps;
  }
}
