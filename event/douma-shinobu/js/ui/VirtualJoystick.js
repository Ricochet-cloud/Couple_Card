/**
 * VirtualJoystick
 *
 * - 모바일용 가상 조이스틱 렌더러 및 터치 핸들러
 * - 좌측 하단에 렌더링되는 원형 조이스틱
 * - InputManager와 통합
 */

export class VirtualJoystick {
  constructor(inputManager, containerElement) {
    this.inputManager = inputManager;
    this.container = containerElement;

    // 조이스틱 시각적 설정
    this.baseRadius = 50;       // 기본 반지름
    this.stickRadius = 25;      // 스틱 버튼 반지름
    this.padding = 20;          // 화면 가장자리와의 거리

    // 현재 포지션
    this.baseX = this.padding + this.baseRadius;
    this.baseY = 0;             // 초기화 시점에 설정됨
    this.stickX = this.baseX;
    this.stickY = this.baseY;

    // 터치 추적
    this.touchId = null;
    this.isActive = false;

    // DOM 요소
    this.element = null;
    this.canvas = null;
    this.ctx = null;

    this._create();
    this._setupEventListeners();
  }

  /**
   * 조이스틱 DOM 요소 생성
   */
  _create() {
    const wrapper = document.createElement('div');
    wrapper.className = 'virtual-joystick-wrapper';
    wrapper.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 20px;
      z-index: 50;
      pointer-events: auto;
      touch-action: none;
      user-select: none;
    `;

    const canvas = document.createElement('canvas');
    canvas.width = this.baseRadius * 2 + 10;
    canvas.height = this.baseRadius * 2 + 10;
    canvas.style.cssText = `
      display: block;
      width: 120px;
      height: 120px;
      image-rendering: pixelated;
      cursor: grab;
    `;
    canvas.style.cursor = 'grab';

    wrapper.appendChild(canvas);
    this.container.appendChild(wrapper);

    this.element = wrapper;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.baseX = this.baseRadius + 5;
    this.baseY = this.baseRadius + 5;
    this.stickX = this.baseX;
    this.stickY = this.baseY;

    this._render();
  }

  /**
   * 터치 이벤트 핸들러 설정
   */
  _setupEventListeners() {
    const canvas = this.canvas;

    canvas.addEventListener('touchstart', (e) => this._handleTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this._handleTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this._handleTouchEnd(e), { passive: false });

    // 마우스 이벤트도 지원 (데스크톱 테스트용)
    canvas.addEventListener('mousedown', (e) => this._handleMouseDown(e));
    window.addEventListener('mousemove', (e) => this._handleMouseMove(e));
    window.addEventListener('mouseup', (e) => this._handleMouseUp(e));
  }

  /**
   * 터치 시작
   */
  _handleTouchStart(e) {
    e.preventDefault();
    if (this.touchId !== null) return;

    const touch = e.touches[0];
    this.touchId = touch.identifier;
    this.isActive = true;

    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    this._updateJoystickPosition(x, y);
  }

  _handleTouchMove(e) {
    if (this.touchId === null) return;

    e.preventDefault();

    let touchFound = false;
    for (let touch of e.touches) {
      if (touch.identifier === this.touchId) {
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        this._updateJoystickPosition(x, y);
        touchFound = true;
        break;
      }
    }

    if (!touchFound) {
      this.touchId = null;
      this.isActive = false;
      this.stickX = this.baseX;
      this.stickY = this.baseY;
      this._render();
    }
  }

  _handleTouchEnd(e) {
    if (this.touchId === null) return;

    let touchFound = false;
    for (let touch of e.touches) {
      if (touch.identifier === this.touchId) {
        touchFound = true;
        break;
      }
    }

    if (!touchFound) {
      this.touchId = null;
      this.isActive = false;
      this.stickX = this.baseX;
      this.stickY = this.baseY;
      this._render();

      // InputManager에 조이스틱 해제 알림
      this.inputManager.handleJoystickInput(this.baseX, this.baseY, this.baseX, this.baseY);
    }
  }

  /**
   * 마우스 이벤트 (데스크톱 테스트)
   */
  _handleMouseDown(e) {
    if (this.isActive) return;
    this.isActive = true;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this._updateJoystickPosition(x, y);
  }

  _handleMouseMove(e) {
    if (!this.isActive) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this._updateJoystickPosition(x, y);
  }

  _handleMouseUp(e) {
    if (!this.isActive) return;
    this.isActive = false;
    this.stickX = this.baseX;
    this.stickY = this.baseY;
    this._render();

    this.inputManager.handleJoystickInput(this.baseX, this.baseY, this.baseX, this.baseY);
  }

  /**
   * 조이스틱 포지션 업데이트
   */
  _updateJoystickPosition(x, y) {
    const dx = x - this.baseX;
    const dy = y - this.baseY;
    const distance = Math.hypot(dx, dy);

    if (distance > this.baseRadius) {
      const ratio = this.baseRadius / distance;
      this.stickX = this.baseX + dx * ratio;
      this.stickY = this.baseY + dy * ratio;
    } else {
      this.stickX = x;
      this.stickY = y;
    }

    // InputManager의 조이스틱 좌표는 게임 화면 기준이 아닌 조이스틱 기준
    // 여기서는 조이스틱 로컬 좌표를 그대로 전달
    this.inputManager.handleJoystickInput(this.baseX, this.baseY, this.stickX, this.stickY);

    this._render();
  }

  /**
   * 조이스틱 렌더링
   */
  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 배경 (기본 원)
    ctx.fillStyle = 'rgba(179, 136, 255, 0.2)';
    ctx.strokeStyle = 'rgba(179, 136, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.baseX, this.baseY, this.baseRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 십자가 (방향 표시)
    ctx.strokeStyle = 'rgba(179, 136, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.baseX - this.baseRadius / 2, this.baseY);
    ctx.lineTo(this.baseX + this.baseRadius / 2, this.baseY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(this.baseX, this.baseY - this.baseRadius / 2);
    ctx.lineTo(this.baseX, this.baseY + this.baseRadius / 2);
    ctx.stroke();

    // 스틱 (조이스틱 버튼)
    const stickColor = this.isActive ? 'rgba(179, 136, 255, 0.8)' : 'rgba(179, 136, 255, 0.6)';
    ctx.fillStyle = stickColor;
    ctx.strokeStyle = 'rgba(179, 136, 255, 1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.stickX, this.stickY, this.stickRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 스틱 내부 원 (3D 효과)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(this.stickX - 5, this.stickY - 5, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 화면 크기 변경에 따른 조이스틱 크기 조정
   */
  resize(containerWidth, containerHeight) {
    // 모바일 화면 크기에 따라 조이스틱 크기 동적 조정
    const maxRadius = Math.min(containerWidth, containerHeight) * 0.08;
    this.baseRadius = Math.max(40, Math.min(80, maxRadius));
    this.stickRadius = this.baseRadius * 0.5;

    this.canvas.width = this.baseRadius * 2 + 10;
    this.canvas.height = this.baseRadius * 2 + 10;
    this.canvas.style.width = (this.baseRadius * 2) + 'px';
    this.canvas.style.height = (this.baseRadius * 2) + 'px';

    this.baseX = this.baseRadius + 5;
    this.baseY = this.baseRadius + 5;
    this.stickX = this.baseX;
    this.stickY = this.baseY;

    this._render();
  }

  /**
   * 조이스틱 표시/숨김
   */
  show() {
    if (this.element) {
      this.element.style.display = 'block';
    }
  }

  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  /**
   * 조이스틱 제거
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
