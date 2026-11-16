/**
 * InputManager
 *
 * - 통합 입력 관리 시스템 (키보드, 마우스, 터치)
 * - 크로스 디바이스 입력 정규화 (모든 입력 방식이 동일한 인터페이스로)
 * - 이동 벡터 및 액션 상태 제공
 * - 캔버스 좌표 계산
 */

export class InputManager {
  constructor() {
    // 키보드 상태
    this.keys = {};

    // 마우스/터치 드래그 상태
    this.isTouchDragging = false;
    this.lastTouchPos = { x: 0, y: 0 };

    // 가상 조이스틱 상태
    this.joystickActive = false;
    this.joystickVector = { x: 0, y: 0 };
    this.joystickCenter = { x: 0, y: 0 };
    this.joystickRadius = 50;
    this.joystickDeadzone = 8;

    // 캔버스 레퍼런스
    this.canvas = null;
    this.isDesktop = true;

    // 액션 버튼 상태 (터치 UI)
    this.actionButtonPressed = false;
    this.focusButtonPressed = false;
  }

  /**
   * 입력 시스템 초기화
   */
  setup(canvas, isDesktop = true) {
    this.canvas = canvas;
    this.isDesktop = isDesktop;

    // 이벤트 리스너 등록
    this._setupEventListeners();
  }

  /**
   * 모든 이벤트 리스너 등록
   */
  _setupEventListeners() {
    // 키보드 이벤트
    window.addEventListener('keydown', (e) => this._handleKeyDown(e));
    window.addEventListener('keyup', (e) => this._handleKeyUp(e));

    // 마우스 이벤트
    this.canvas.addEventListener('mousedown', (e) => this._handleMouseDown(e));
    window.addEventListener('mousemove', (e) => this._handleMouseMove(e));
    window.addEventListener('mouseup', (e) => this._handleMouseUp(e));

    // 터치 이벤트
    this.canvas.addEventListener('touchstart', (e) => this._handleTouchStart(e), { passive: true });
    window.addEventListener('touchmove', (e) => this._handleTouchMove(e), { passive: true });
    window.addEventListener('touchend', (e) => this._handleTouchEnd(e), { passive: true });
  }

  /**
   * 캔버스 좌표 계산 (DOM 좌표 → 가상 게임 좌표)
   */
  getCanvasPos(clientX, clientY) {
    if (!this.canvas) return { x: 0, y: 0 };

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = 540 / rect.width;      // 가상 너비
    const scaleY = 960 / rect.height;     // 가상 높이

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  /**
   * 키보드 이벤트 처리
   */
  _handleKeyDown(e) {
    const key = e.key.toLowerCase();
    this.keys[key] = true;
  }

  _handleKeyUp(e) {
    const key = e.key.toLowerCase();
    this.keys[key] = false;
  }

  /**
   * 마우스 이벤트 처리
   */
  _handleMouseDown(e) {
    this.isTouchDragging = true;
    this.lastTouchPos = this.getCanvasPos(e.clientX, e.clientY);
  }

  _handleMouseMove(e) {
    if (!this.isTouchDragging) return;

    const pos = this.getCanvasPos(e.clientX, e.clientY);
    const dx = pos.x - this.lastTouchPos.x;
    const dy = pos.y - this.lastTouchPos.y;
    this.lastTouchPos = pos;

    // 드래그 기반 이동은 외부에서 처리하도록 콜백 사용
    if (this.onDragMove) {
      this.onDragMove(dx, dy);
    }
  }

  _handleMouseUp(e) {
    this.isTouchDragging = false;
  }

  /**
   * 터치 이벤트 처리
   */
  _handleTouchStart(e) {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      this.isTouchDragging = true;
      this.lastTouchPos = this.getCanvasPos(touch.clientX, touch.clientY);
    }
  }

  _handleTouchMove(e) {
    if (!this.isTouchDragging || e.touches.length === 0) return;

    const touch = e.touches[0];
    const pos = this.getCanvasPos(touch.clientX, touch.clientY);
    const dx = pos.x - this.lastTouchPos.x;
    const dy = pos.y - this.lastTouchPos.y;
    this.lastTouchPos = pos;

    if (this.onDragMove) {
      this.onDragMove(dx, dy);
    }
  }

  _handleTouchEnd(e) {
    this.isTouchDragging = false;
  }

  /**
   * 가상 조이스틱 입력 처리
   */
  handleJoystickInput(centerX, centerY, touchX, touchY) {
    this.joystickCenter = { x: centerX, y: centerY };

    const dx = touchX - centerX;
    const dy = touchY - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance < this.joystickDeadzone) {
      this.joystickVector = { x: 0, y: 0 };
      this.joystickActive = false;
    } else {
      this.joystickActive = true;
      const maxDist = this.joystickRadius;
      const clampedDist = Math.min(distance, maxDist);
      this.joystickVector = {
        x: (dx / distance) * (clampedDist / maxDist),
        y: (dy / distance) * (clampedDist / maxDist)
      };
    }
  }

  /**
   * 액션 버튼 입력 처리
   */
  setActionButton(pressed) {
    this.actionButtonPressed = pressed;
  }

  setFocusButton(pressed) {
    this.focusButtonPressed = pressed;
  }

  /**
   * 이동 벡터 계산 (키보드 + 조이스틱 + 터치 통합)
   */
  getMovementVector() {
    let moveX = 0;
    let moveY = 0;

    // 키보드 입력 처리
    if (this.keys['arrowleft'] || this.keys['a']) moveX -= 1;
    if (this.keys['arrowright'] || this.keys['d']) moveX += 1;
    if (this.keys['arrowup'] || this.keys['w']) moveY -= 1;
    if (this.keys['arrowdown'] || this.keys['s']) moveY += 1;

    // 가상 조이스틱 입력 추가
    if (this.joystickActive) {
      moveX += this.joystickVector.x;
      moveY += this.joystickVector.y;
    }

    // 대각선 이동 정규화
    if (moveX !== 0 && moveY !== 0) {
      const invLen = 1 / Math.SQRT2;
      moveX *= invLen;
      moveY *= invLen;
    }

    // -1 ~ 1 범위로 제한
    moveX = Math.max(-1, Math.min(1, moveX));
    moveY = Math.max(-1, Math.min(1, moveY));

    return { x: moveX, y: moveY };
  }

  /**
   * 액션 버튼 상태 (키 다운 이벤트)
   */
  isActionPressed() {
    const isPressed = (this.keys[' '] || this.keys['x']) || this.actionButtonPressed;
    return isPressed;
  }

  /**
   * 액션 버튼 에지 감지 (이전 프레임 대비 변화)
   */
  isActionJustPressed() {
    const isPressed = (this.keys[' '] || this.keys['x']) || this.actionButtonPressed;
    const wasPressed = this.prevActionPressed;
    this.prevActionPressed = isPressed;
    return isPressed && !wasPressed;
  }

  /**
   * 포커스 모드 (저속 집중) 상태
   */
  isFocusPressed() {
    return (this.keys['shift'] || this.focusButtonPressed);
  }

  /**
   * 일시정지 버튼 상태
   */
  isPausePressed() {
    return (this.keys['p'] || this.keys['escape']);
  }

  /**
   * 대화 진행 (Space 또는 Enter)
   */
  isDialogueAdvance() {
    return (this.keys[' '] || this.keys['enter']);
  }

  /**
   * 프레임 업데이트
   */
  update(dt) {
    // 이전 프레임의 액션 상태 저장 (에지 감지용)
    // isActionJustPressed에서 이미 처리됨
  }

  /**
   * 입력 상태 리셋 (게임 상태 전환 시)
   */
  reset() {
    this.keys = {};
    this.isTouchDragging = false;
    this.joystickActive = false;
    this.joystickVector = { x: 0, y: 0 };
    this.actionButtonPressed = false;
    this.focusButtonPressed = false;
  }

  /**
   * 이전 호환성: keys 객체 게터
   */
  getKeysState() {
    return this.keys;
  }
}
