/**
 * GameMessenger.js - postMessage 기반 iframe 통합 및 게임 이벤트 전달 시스템
 *
 * - 부모 페이지와의 postMessage 통신
 * - Origin 검증으로 보안 강화
 * - 게임 상태 이벤트 (START, CLEAR, OVER) 전파
 * - 난이도 및 결과 데이터 전달
 */

class GameMessenger {
  constructor(options = {}) {
    // 신뢰할 수 있는 부모 페이지 origin 목록 (배포 환경에서 설정)
    this.trustedOrigins = options.trustedOrigins || [
      'http://localhost:3000',
      'http://localhost:5000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5000',
      window.location.origin // 현재 origin도 신뢰 (개발 환경)
    ];

    // iframe 여부 감지
    this.isInIframe = window.self !== window.top;

    // 부모 창 참조
    this.parentWindow = window.parent;

    // 메시지 핸들러 맵
    this.handlers = new Map();

    // 초기화
    this._setupMessageListener();
  }

  /**
   * postMessage 수신 리스너 설정
   */
  _setupMessageListener() {
    window.addEventListener('message', (event) => {
      // Origin 검증
      if (!this._isValidOrigin(event.origin)) {
        console.warn(`[GameMessenger] 검증되지 않은 origin에서 메시지 수신: ${event.origin}`);
        return;
      }

      const { type, payload } = event.data;

      // 핸들러 실행
      if (this.handlers.has(type)) {
        const handler = this.handlers.get(type);
        handler(payload);
      }
    });
  }

  /**
   * Origin 검증
   */
  _isValidOrigin(origin) {
    return this.trustedOrigins.includes(origin);
  }

  /**
   * 부모 페이지에 메시지 전송
   */
  sendToParent(type, payload = {}) {
    if (!this.isInIframe) {
      // iframe이 아닌 경우 로컬 이벤트로 처리
      this._dispatchLocalEvent(type, payload);
      return;
    }

    const message = {
      type,
      payload: {
        timestamp: Date.now(),
        source: 'game',
        ...payload
      }
    };

    this.parentWindow.postMessage(message, this.trustedOrigins[0]);
  }

  /**
   * 로컬 이벤트 발생 (iframe이 아닐 때)
   */
  _dispatchLocalEvent(type, payload) {
    const event = new CustomEvent(`game:${type}`, {
      detail: payload,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
  }

  /**
   * 부모 페이지로부터 메시지 수신 핸들러 등록
   */
  on(type, handler) {
    this.handlers.set(type, handler);
  }

  /**
   * 게임 시작 이벤트 전송
   */
  notifyGameStart(difficulty) {
    this.sendToParent('GAME_START', {
      difficulty: difficulty.id,
      difficultyLevel: difficulty.id,
      timestamp: Date.now()
    });
  }

  /**
   * 게임 클리어 이벤트 전송
   * 부모 페이지/보상 서버에서 검증 및 보상 처리를 수행하도록 설계
   */
  notifyGameClear(difficulty, playerStats) {
    const clearData = {
      difficulty: difficulty.id,
      difficulty_level: difficulty.id,
      player_hp: playerStats.hp || 100,
      player_lives: playerStats.lives || 0,
      player_score: playerStats.score || 0,
      boss_phase: playerStats.bossPhase || 3,
      play_time: playerStats.playTime || 0,
      timestamp: Date.now(),
      // 검증 토큰 (백엔드에서 재검증용)
      verification_token: this._generateVerificationToken()
    };

    this.sendToParent('GAME_CLEAR', clearData);
  }

  /**
   * 게임 오버 이벤트 전송
   */
  notifyGameOver(difficulty, playerStats) {
    this.sendToParent('GAME_OVER', {
      difficulty: difficulty.id,
      difficulty_level: difficulty.id,
      player_hp: playerStats.hp || 0,
      player_lives: playerStats.lives || 0,
      boss_phase: playerStats.bossPhase || 0,
      play_time: playerStats.playTime || 0,
      timestamp: Date.now()
    });
  }

  /**
   * 게임 재시작 이벤트 전송
   */
  notifyGameRestart(difficulty) {
    this.sendToParent('GAME_RESTART', {
      difficulty: difficulty.id,
      timestamp: Date.now()
    });
  }

  /**
   * 난이도 변경 이벤트 전송
   */
  notifyDifficultyChange(difficulty) {
    this.sendToParent('DIFFICULTY_CHANGED', {
      difficulty: difficulty.id,
      timestamp: Date.now()
    });
  }

  /**
   * 부모 페이지에 게임 상태 보고
   */
  reportGameState(gameState, details = {}) {
    this.sendToParent('GAME_STATE_CHANGE', {
      state: gameState,
      ...details,
      timestamp: Date.now()
    });
  }

  /**
   * 검증 토큰 생성 (간단한 형식, 백엔드에서 재검증)
   * 실제 배포 환경에서는 서명된 JWT 또는 HMAC 사용 권장
   */
  _generateVerificationToken() {
    const data = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    return btoa(data);
  }

  /**
   * iframe 여부 확인
   */
  isEmbedded() {
    return this.isInIframe;
  }

  /**
   * 신뢰 origin 추가
   */
  addTrustedOrigin(origin) {
    if (!this.trustedOrigins.includes(origin)) {
      this.trustedOrigins.push(origin);
    }
  }

  /**
   * 신뢰 origin 제거
   */
  removeTrustedOrigin(origin) {
    const index = this.trustedOrigins.indexOf(origin);
    if (index > -1) {
      this.trustedOrigins.splice(index, 1);
    }
  }

  /**
   * 신뢰 origin 목록 조회
   */
  getTrustedOrigins() {
    return [...this.trustedOrigins];
  }
}

export { GameMessenger };
