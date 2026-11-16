/**
 * TouchUI
 *
 * - 모바일용 액션 버튼 패널
 * - 우측에 "폭탄(Bomb)" 버튼과 "포커스(Focus)" 버튼 렌더링
 * - InputManager와 통합
 */

export class TouchUI {
  constructor(inputManager, containerElement) {
    this.inputManager = inputManager;
    this.container = containerElement;

    // 버튼 설정
    this.buttonSize = 60;         // 기본 크기
    this.buttonPadding = 20;       // 화면 가장자리와의 거리
    this.buttonGap = 15;           // 버튼 간의 거리
    this.padding = 20;             // 화면 우측 거리

    // 현재 상태
    this.buttonA = {               // 폭탄 버튼
      x: 0,
      y: 0,
      pressed: false,
      label: '💣',
      title: '결전 오의'
    };

    this.buttonB = {               // 포커스 버튼
      x: 0,
      y: 0,
      pressed: false,
      label: '⚡',
      title: '저속 집중'
    };

    // 터치 추적
    this.activeTouches = new Map();

    // DOM 요소
    this.element = null;
    this.canvas = null;
    this.ctx = null;

    this._create();
    this._setupEventListeners();
  }

  /**
   * 버튼 패널 생성
   */
  _create() {
    const wrapper = document.createElement('div');
    wrapper.className = 'touch-ui-wrapper';
    wrapper.style.cssText = `
      position: absolute;
      bottom: 20px;
      right: 20px;
      z-index: 50;
      pointer-events: auto;
      touch-action: none;
      user-select: none;
    `;

    const canvas = document.createElement('canvas');
    canvas.width = this.buttonSize + 20;
    canvas.height = (this.buttonSize * 2) + this.buttonGap + 20;
    canvas.style.cssText = `
      display: block;
      width: ${canvas.width}px;
      height: ${canvas.height}px;
      image-rendering: pixelated;
    `;

    wrapper.appendChild(canvas);
    this.container.appendChild(wrapper);

    this.element = wrapper;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // 버튼 위치 설정
    const centerX = this.buttonSize / 2 + 10;
    this.buttonA.x = centerX;
    this.buttonA.y = this.buttonSize / 2 + 10;

    this.buttonB.x = centerX;
    this.buttonB.y = this.buttonA.y + this.buttonSize + this.buttonGap;

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
   * 버튼 히트 테스트
   */
  _hitTest(x, y, button) {
    const dx = x - button.x;
    const dy = y - button.y;
    return Math.hypot(dx, dy) <= (this.buttonSize / 2);
  }

  /**
   * 터치 시작
   */
  _handleTouchStart(e) {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();

    for (let touch of e.touches) {
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      const touchId = touch.identifier;
      let button = null;

      if (this._hitTest(x, y, this.buttonA)) {
        button = this.buttonA;
      } else if (this._hitTest(x, y, this.buttonB)) {
        button = this.buttonB;
      }

      if (button) {
        this.activeTouches.set(touchId, button);
        button.pressed = true;
        this._updateInputManager();
      }
    }

    this._render();
  }

  _handleTouchMove(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();

    for (let touch of e.touches) {
      const touchId = touch.identifier;
      if (!this.activeTouches.has(touchId)) continue;

      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const button = this.activeTouches.get(touchId);

      const isStillOnButton = this._hitTest(x, y, button);
      if (!isStillOnButton && button.pressed) {
        button.pressed = false;
        this._updateInputManager();
      } else if (isStillOnButton && !button.pressed) {
        button.pressed = true;
        this._updateInputManager();
      }
    }

    this._render();
  }

  _handleTouchEnd(e) {
    e.preventDefault();

    for (let touch of e.changedTouches) {
      const touchId = touch.identifier;
      if (this.activeTouches.has(touchId)) {
        const button = this.activeTouches.get(touchId);
        button.pressed = false;
        this.activeTouches.delete(touchId);
      }
    }

    this._updateInputManager();
    this._render();
  }

  /**
   * 마우스 이벤트 (데스크톱 테스트)
   */
  _handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this._hitTest(x, y, this.buttonA)) {
      this.buttonA.pressed = true;
    } else if (this._hitTest(x, y, this.buttonB)) {
      this.buttonB.pressed = true;
    }

    this._updateInputManager();
    this._render();
  }

  _handleMouseMove(e) {
    // 마우스 이동 중 버튼 상태 유지
  }

  _handleMouseUp(e) {
    this.buttonA.pressed = false;
    this.buttonB.pressed = false;
    this._updateInputManager();
    this._render();
  }

  /**
   * InputManager 상태 업데이트
   */
  _updateInputManager() {
    this.inputManager.setActionButton(this.buttonA.pressed);
    this.inputManager.setFocusButton(this.buttonB.pressed);
  }

  /**
   * 버튼 패널 렌더링
   */
  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 폭탄 버튼 (A)
    this._drawButton(ctx, this.buttonA, 0);

    // 포커스 버튼 (B)
    this._drawButton(ctx, this.buttonB, 1);
  }

  /**
   * 단일 버튼 그리기
   */
  _drawButton(ctx, button, index) {
    const size = this.buttonSize / 2;
    const x = button.x;
    const y = button.y;

    // 배경 원
    if (button.pressed) {
      ctx.fillStyle = 'rgba(179, 136, 255, 0.5)';
      ctx.strokeStyle = 'rgba(179, 136, 255, 1)';
      ctx.lineWidth = 3;
    } else {
      ctx.fillStyle = 'rgba(179, 136, 255, 0.2)';
      ctx.strokeStyle = 'rgba(179, 136, 255, 0.6)';
      ctx.lineWidth = 2;
    }

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 라벨 텍스트 (이모지)
    ctx.fillStyle = button.pressed ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
    ctx.font = `bold ${Math.floor(size * 1.2)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(button.label, x, y);

    // 작은 라벨
    ctx.fillStyle = button.pressed ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
    ctx.font = `bold ${Math.floor(size * 0.4)}px Arial`;
    ctx.fillText(button.title, x, y + size + 8);
  }

  /**
   * 화면 크기 변경에 따른 버튼 크기 조정
   */
  resize(containerWidth, containerHeight) {
    // 모바일 화면 크기에 따라 버튼 크기 동적 조정
    const maxSize = Math.min(containerWidth, containerHeight) * 0.12;
    this.buttonSize = Math.max(48, Math.min(80, maxSize));

    this.canvas.width = this.buttonSize + 20;
    this.canvas.height = (this.buttonSize * 2) + this.buttonGap + 20;
    this.canvas.style.width = this.canvas.width + 'px';
    this.canvas.style.height = this.canvas.height + 'px';

    // 버튼 위치 다시 계산
    const centerX = this.buttonSize / 2 + 10;
    this.buttonA.x = centerX;
    this.buttonA.y = this.buttonSize / 2 + 10;

    this.buttonB.x = centerX;
    this.buttonB.y = this.buttonA.y + this.buttonSize + this.buttonGap;

    this._render();
  }

  /**
   * 버튼 패널 표시/숨김
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
   * 버튼 패널 제거
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
