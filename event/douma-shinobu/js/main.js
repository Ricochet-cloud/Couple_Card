/**
 * main.js - 2D 탄막 슈팅게임 스토리 나레이션 및 연출 시스템 통합 엔트리포인트
 * 
 * - 스토리 프롤로그 나레이션 & 텍스트 타자 효과
 * - 캐릭터 등장 연출 (시노부 나비 도약 & 도우마 서리 강림)
 * - "VS" & "BATTLE START!" 전투 개시 연출
 * - 보스 페이즈 전환(동운·빙목련 / 무빙·결정의 아이) 배너
 * - 승리 에필로그 및 도우마 소멸 / 패배 연출 & 재도전
 * - Canvas 기반 60FPS 모바일 최적화
 */

import { CHARACTER_CONFIGS } from './config/characterConfigs.js';
import { BACKGROUND_CONFIG } from './config/backgroundConfig.js';
import { DIFFICULTY_CONFIG } from './config/difficultyConfig.js';
import { STORY_DATA } from './config/storyData.js';
import { assetManager } from './core/AssetManager.js';
import { GameLoop } from './core/GameLoop.js';
import { GameMessenger } from './core/GameMessenger.js';
import { CharacterRenderer } from './graphics/CharacterRenderer.js';
import { BackgroundRenderer } from './graphics/BackgroundRenderer.js';
import { Shinobu } from './entities/Shinobu.js';
import { Douma } from './entities/Douma.js';
import { BulletPool } from './entities/BulletPool.js';
import { DanmakuPatterns } from './systems/DanmakuPatterns.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { CombatHud } from './ui/CombatHud.js';
import { CutsceneDirector } from './systems/CutsceneDirector.js';
import { InputManager } from './systems/InputManager.js';
import { VirtualJoystick } from './ui/VirtualJoystick.js';
import { TouchUI } from './ui/TouchUI.js';

class DanmakuGameApp {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // 내부 논리 가상 해상도 (540 x 960 - 9:16 모바일/PC 반응형)
    this.VIRTUAL_WIDTH = 540;
    this.VIRTUAL_HEIGHT = 960;

    // 게임 상태 머신:
    // 'READY' -> 'PROLOGUE' -> 'ENTRANCE' -> 'BATTLE_INTRO' -> 'PLAYING'
    // -> 'VICTORY_CUTSCENE' -> 'VICTORY' / 'DEFEAT_CUTSCENE' -> 'GAME_OVER'
    this.gameState = 'READY';

    // 현재 난이도 (기본: NORMAL)
    this.currentDifficulty = DIFFICULTY_CONFIG.NORMAL;

    // iframe 통합 시스템 초기화
    this.messenger = new GameMessenger({
      trustedOrigins: [
        window.location.origin,   // 맨 앞 주소로만 메시지를 보내요 (커플카드 사이트와 같은 주소)
        'http://localhost:3000',
        'http://localhost:5000',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5000'
      ]
    });

    // 게임 시간 추적
    this.gameStartTime = null;
    this.playTime = 0;

    // 승리/패배 화면 전환 타이머
    this.victoryTransitionTimer = 0;
    this.victoryTransitionDelay = 2.0; // 2초 대기

    // 1. 탄환 풀링 및 탄막 알고리즘
    this.bulletPool = new BulletPool(1200);
    this.danmaku = new DanmakuPatterns(this.bulletPool);

    // 2. 렌더러 생성 (캐릭터 & 배경)
    this.renderer = new CharacterRenderer();
    this.bgRenderer = new BackgroundRenderer(this.VIRTUAL_WIDTH, this.VIRTUAL_HEIGHT);

    // 3. 캐릭터 엔티티 생성
    this.shinobu = new Shinobu(this.renderer);
    this.shinobu.flipBase = true; // 시노부를 좌우 반전하여 도우마를 향하게 함
    this.douma = new Douma(this.renderer, this.danmaku);
    this.douma.setDifficulty(this.currentDifficulty);

    // 4. 전투 시스템, HUD, 컷신 디렉터
    this.combat = new CombatSystem(this.bulletPool);
    this.hud = new CombatHud(this.VIRTUAL_WIDTH, this.VIRTUAL_HEIGHT);
    this.cutscene = new CutsceneDirector(this.VIRTUAL_WIDTH, this.VIRTUAL_HEIGHT);

    // 기본 위치 세팅
    this.shinobu.x = this.VIRTUAL_WIDTH / 2;
    this.shinobu.y = 800;

    this.douma.x = this.VIRTUAL_WIDTH / 2;
    this.douma.y = 220;

    // 입력 시스템 초기화
    this.inputManager = new InputManager();
    this.isDesktop = window.innerWidth > 900;

    // 모바일 터치 UI (모바일에서만 표시)
    this.touchUI = null;
    this.virtualJoystick = null;

    // 화면 크기 변경 감지
    this.resizeObserver = null;

    // 페이즈 전환 트래커 (중복 컷신 방지)
    this.lastAnnouncedPhase = 1;

    // DOM 요소 캐싱 및 이벤트 바인딩
    this._cacheDom();
    this._setupInputSystem();
    this._setupResizeObserver();

    // 게임 루프 초기화 (60FPS deltaTime)
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render()
    );
  }

  async init() {
    console.log('[DanmakuGame] 스토리 및 전투 시스템 초기화 시작...');

    // Canvas DPR 최적화 (고해상도 디스플레이 대응)
    this._setupCanvasDPR();

    // InputManager 설정
    this.inputManager.setup(this.canvas, this.isDesktop);

    // 애셋 프리로드 시도 (미배치 시 Graceful Fallback)
    await assetManager.loadAll([
      { key: 'shinobu', src: CHARACTER_CONFIGS.shinobu.imageSrc },
      { key: 'douma', src: CHARACTER_CONFIGS.douma.imageSrc },
      { key: BACKGROUND_CONFIG.assets.default.key, src: BACKGROUND_CONFIG.assets.default.src },
      { key: BACKGROUND_CONFIG.assets.iceTemple.key, src: BACKGROUND_CONFIG.assets.iceTemple.src }
    ]);

    this._updateUiState();
    this.loop.start();

    // 난이도 모달 표시 (사이트 이벤트로 열었으면 정해진 난이도만 보여줘요)
    this._applyEventDifficulty();
    this._showDifficultyModal();

    console.log('[DanmakuGame] 게임 루프 가동 완료.');
  }

  _cacheDom() {
    this.fpsDisplay = document.getElementById('fpsDisplay');
    this.activeCharHud = document.getElementById('activeCharHud');
    this.renderModeHud = document.getElementById('renderModeHud');
    this.headerDifficultyBadge = document.getElementById('headerDifficultyBadge');

    // 난이도 모달
    this.difficultyModal = document.getElementById('difficultyModal');
    this.difficultyOptions = document.querySelectorAll('.difficulty-option');
    this.btnStartGame = document.getElementById('btnStartGame');

    // 기존 UI (비상용)
    this.diffButtons = document.querySelectorAll('.tab-btn[data-diff]');
    this.btnTriggerAttack = document.getElementById('btnTriggerAttack');
    this.btnRevive = document.getElementById('btnRevive');

    this.toggleForceProcedural = document.getElementById('toggleForceProcedural');
    this.toggleHitbox = document.getElementById('toggleHitbox');

    this.diagBossPhase = document.getElementById('diagBossPhase');
    this.diagHp = document.getElementById('diagHp');
    this.diagFrame = document.getElementById('diagFrame');
    this.diagAssetStatus = document.getElementById('diagAssetStatus');
  }

  /**
   * 입력 시스템 및 모바일 UI 초기화
   */
  _setupInputSystem() {
    // 난이도 모달 처리
    this.difficultyOptions.forEach(option => {
      option.addEventListener('click', () => {
        // 모든 옵션에서 active 제거
        this.difficultyOptions.forEach(opt => opt.classList.remove('active'));
        // 클릭한 옵션에 active 추가
        option.classList.add('active');
        // 난이도 설정
        const diffId = option.dataset.diff;
        this.setDifficulty(diffId);
      });
    });

    if (this.btnStartGame) {
      this.btnStartGame.addEventListener('click', () => {
        this._hideDifficultyModal();
        this.startStoryPrologue();
      });
    }

    // 기존 대시보드 난이도 선택 버튼 (사용 안 함)
    this.diffButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const diffId = btn.dataset.diff;
        this.setDifficulty(diffId);
      });
    });

    // 캔버스 상호작용 핸들러 (클릭, 드래그)
    this.inputManager.onDragMove = (dx, dy) => {
      if (this.gameState === 'PLAYING') {
        this.shinobu.x += dx;
        this.shinobu.y += dy;
        this.shinobu.clampToBounds(0, 0, this.VIRTUAL_WIDTH, this.VIRTUAL_HEIGHT);
      }
    };

    // 대화 진행 상태 추적 (자동 스킵 방지)
    let lastDialogueClickTime = 0;
    const dialogueClickDelay = 200; // 200ms 딜레이

    // InputManager에서 제공하는 상위 이벤트를 캔버스 상호작용에 사용
    const handleCanvasInteraction = (clientX, clientY) => {
      const pos = this.inputManager.getCanvasPos(clientX, clientY);
      const now = performance.now();

      // 대화 진행 중일 때 (터치로 대사 넘기기 or 우상단 SKIP)
      if (this.gameState === 'PROLOGUE' || this.gameState === 'VICTORY_CUTSCENE' || this.gameState === 'DEFEAT_CUTSCENE') {
        // 너무 빠른 연속 클릭 방지
        if (now - lastDialogueClickTime < dialogueClickDelay) {
          return;
        }
        lastDialogueClickTime = now;

        if (pos.x > this.VIRTUAL_WIDTH - 150 && pos.y > this.VIRTUAL_HEIGHT - 160) {
          this.cutscene.skipDialogue();
        } else {
          this.cutscene.advanceDialogue();
        }
        return;
      }

      // 일시정지 해제
      if (this.gameState === 'PAUSED') {
        this.setGameState('PLAYING');
        return;
      }

      // 게임 오버 / 승리 후 재도전
      if (this.gameState === 'GAME_OVER' || this.gameState === 'VICTORY') {
        this.restartGameFlow();
        return;
      }
    };

    // 캔버스 클릭/터치 이벤트를 InputManager의 상호작용으로 처리
    // (InputManager에서 마우스/터치 드래그는 onDragMove로 처리)
    this.canvas.addEventListener('mousedown', (e) => {
      handleCanvasInteraction(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        handleCanvasInteraction(touch.clientX, touch.clientY);
      }
    }, { passive: true });

    // 대시보드 버튼
    if (this.btnTriggerAttack) {
      this.btnTriggerAttack.addEventListener('click', () => {
        if (this.gameState === 'PLAYING') {
          this.shinobu.useBomb(this.bulletPool, this.douma);
        }
      });
    }

    if (this.btnRevive) {
      this.btnRevive.addEventListener('click', () => {
        this.restartGameFlow();
      });
    }

    if (this.toggleForceProcedural) {
      this.toggleForceProcedural.addEventListener('change', (e) => {
        this.renderer.forceProcedural = e.target.checked;
        this.bgRenderer.forceProcedural = e.target.checked;
        this._updateUiState();
      });
    }

    if (this.toggleHitbox) {
      this.toggleHitbox.addEventListener('change', (e) => {
        this.renderer.showHitbox = e.target.checked;
      });
    }

    // 모바일 터치 UI 초기화
    this._initializeMobileUI();
  }

  /**
   * Canvas DPR 최적화 (고해상도 디스플레이)
   * 주: 이 게임은 가상 해상도 540x960을 유지하므로, CSS 스케일링 사용
   */
  _setupCanvasDPR() {
    // Canvas는 가상 해상도 540x960 유지
    // CSS image-rendering: pixelated로 고해상도 처리
    // (픽셀 완벽성을 위해 DPR 내부 스케일링 생략)
    console.log('[Canvas] Using CSS scaling with pixelated rendering');
  }

  /**
   * 화면 크기 변경 감지 및 반응형 UI 업데이트
   */
  _setupResizeObserver() {
    const resizeHandler = () => {
      const newIsDesktop = window.innerWidth > 900;
      if (newIsDesktop !== this.isDesktop) {
        this.isDesktop = newIsDesktop;
        this._updateMobileUIVisibility();
        this._updateDashboardPanelVisibility();
      }

      // 모바일 UI 크기 조정
      if (this.virtualJoystick) {
        this.virtualJoystick.resize(window.innerWidth, window.innerHeight);
      }
      if (this.touchUI) {
        this.touchUI.resize(window.innerWidth, window.innerHeight);
      }
    };

    // 디바운스 처리 (성능 최적화)
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeHandler, 250);
    });
  }

  /**
   * 모바일 터치 UI 초기화
   */
  _initializeMobileUI() {
    if (this.isDesktop) return;

    const canvasWrapper = this.canvas.parentElement;
    if (!canvasWrapper) return;

    // 가상 조이스틱 생성
    this.virtualJoystick = new VirtualJoystick(this.inputManager, canvasWrapper);
    this.virtualJoystick.resize(window.innerWidth, window.innerHeight);

    // 터치 액션 버튼 생성
    this.touchUI = new TouchUI(this.inputManager, canvasWrapper);
    this.touchUI.resize(window.innerWidth, window.innerHeight);
  }

  /**
   * 모바일 UI 표시/숨김
   */
  _updateMobileUIVisibility() {
    if (this.isDesktop) {
      // 데스크톱: 모바일 UI 숨김
      if (this.virtualJoystick) this.virtualJoystick.hide();
      if (this.touchUI) this.touchUI.hide();
    } else {
      // 모바일: 모바일 UI 표시
      if (!this.virtualJoystick) {
        this._initializeMobileUI();
      }
      if (this.virtualJoystick) this.virtualJoystick.show();
      if (this.touchUI) this.touchUI.show();
    }
  }

  /**
   * 대시보드 패널 표시/숨김
   */
  _updateDashboardPanelVisibility() {
    const dashboardPanel = document.querySelector('.dashboard-panel');
    if (!dashboardPanel) return;

    if (this.isDesktop) {
      dashboardPanel.style.display = '';
    } else {
      dashboardPanel.style.display = 'none';
    }
  }

  /**
   * 커플카드 이벤트로 열렸으면 사이트가 ?d= 로 알려준 난이도로 고정한다.
   * (난이도 선택 버튼은 그 난이도 하나만 남겨요. 사이트 없이 열면 그대로 고를 수 있어요)
   */
  _applyEventDifficulty() {
    const bridge = window.EventBridge;
    const diffId = bridge && bridge.inSite ? bridge.difficulty : null;
    if (!diffId || !DIFFICULTY_CONFIG[diffId]) return;

    this.eventMode = true;
    document.body.classList.add('event-mode');   // 사이트의 닫기(✕) 버튼 자리를 비워요
    this.setDifficulty(diffId);
    this.difficultyOptions.forEach(opt => {
      const mine = opt.dataset.diff === diffId;
      opt.classList.toggle('active', mine);
      if (!mine) opt.style.display = 'none';
    });
    const title = this.difficultyModal && this.difficultyModal.querySelector('h2');
    if (title) title.textContent = this.currentDifficulty.name + ' 도전';
  }

  /**
   * 사이트에 결과를 알려요 (이벤트 모드일 때만). 보상은 사이트가 줘요.
   */
  _reportEventResult(isWin) {
    if (this.eventMode && window.EventBridge) window.EventBridge.report(isWin);
  }

  /**
   * 난이도 모달 표시
   */
  _showDifficultyModal() {
    if (this.difficultyModal) {
      this.difficultyModal.classList.remove('hidden');
    }
  }

  /**
   * 난이도 모달 숨김
   */
  _hideDifficultyModal() {
    if (this.difficultyModal) {
      this.difficultyModal.classList.add('hidden');
    }
  }

  // ==========================================
  // [스토리 및 연출 씬 시퀀스]
  // ==========================================

  /**
   * 1단계: 게임 시작 전 스토리 나레이션 및 프롤로그 대화
   */
  startStoryPrologue() {
    this.setGameState('PROLOGUE');

    // 캐릭터 위치를 대치 구도로 정돈
    this.shinobu.x = this.VIRTUAL_WIDTH / 2;
    this.shinobu.y = 800;
    this.douma.x = this.VIRTUAL_WIDTH / 2;
    this.douma.y = 220;

    // 대화 시퀀스 시작 -> 완료 시 등장 연출로 연결
    this.cutscene.startDialogue(STORY_DATA.prologue, () => {
      this.startCharacterEntrance();
    });
  }

  /**
   * 2단계: 캐릭터 등장 연출 (시노부 도약 & 도우마 강림)
   */
  startCharacterEntrance() {
    this.setGameState('ENTRANCE');

    // 0.4초 화면 페이드 아웃 후 등장 연출 개시
    this.cutscene.startFade(0.7, 0.4, () => {
      this.cutscene.startEntrance(this.shinobu, this.douma, () => {
        this.startBattleIntro();
      });
      this.cutscene.startFade(0.0, 0.5);
    });
  }

  /**
   * 3단계: 전투 개시 ("VS" & "BATTLE START!")
   */
  startBattleIntro() {
    this.setGameState('BATTLE_INTRO');

    this.cutscene.startBattleIntro(() => {
      this.startCombat();
    });
  }

  /**
   * 4단계: 본격적인 실시간 전투 돌입
   */
  startCombat() {
    this.shinobu.resetCombat(this.currentDifficulty);
    this.douma.resetCombat();
    this.bulletPool.resetAll();
    this.lastAnnouncedPhase = 1;
    this.setGameState('PLAYING');

    // 게임 시작 시간 기록 및 이벤트 전송
    this.gameStartTime = Date.now();
    this.playTime = 0;
    this.messenger.notifyGameStart(this.currentDifficulty);
  }

  /**
   * 5단계: 승리 연출 및 에필로그 대화
   */
  handleVictory() {
    this.bulletPool.clearEnemyBullets();
    this.setGameState('VICTORY_CUTSCENE');
    this.victoryTransitionTimer = 0;

    // 도우마 사망 모션 실행
    this.douma.die();

    // 플레이 시간 계산
    if (this.gameStartTime) {
      this.playTime = Math.round((Date.now() - this.gameStartTime) / 1000);
    }

    // 게임 클리어 이벤트 전송 (보상 서버에서 검증)
    this.messenger.notifyGameClear(this.currentDifficulty, {
      hp: Math.round(this.shinobu.hp),
      lives: this.shinobu.lives,
      score: this._calculateScore(),
      bossPhase: this.douma.phase,
      playTime: this.playTime
    });

    // 승리 에필로그 대화 전개 후 VICTORY 상태로 전환
    this.cutscene.startDialogue(STORY_DATA.victory, () => {
      this.victoryTransitionTimer = 0;
      this._reportEventResult(true);
    });
  }

  /**
   * 6단계: 패배 연출 및 재도전
   */
  handleDefeat() {
    this.bulletPool.clearEnemyBullets();
    this.setGameState('DEFEAT_CUTSCENE');
    this.victoryTransitionTimer = 0;

    // 플레이 시간 계산
    if (this.gameStartTime) {
      this.playTime = Math.round((Date.now() - this.gameStartTime) / 1000);
    }

    // 게임 오버 이벤트 전송
    this.messenger.notifyGameOver(this.currentDifficulty, {
      hp: Math.round(this.shinobu.hp),
      lives: this.shinobu.lives,
      bossPhase: this.douma.phase,
      playTime: this.playTime
    });

    // 패배 나레이션 전개 후 게임오버 상태로 전환 대기
    this._reportEventResult(false);
    this.cutscene.startDialogue(STORY_DATA.defeat, () => {
      this.victoryTransitionTimer = 0;
    });
  }

  /**
   * 게임 전체 재시작 (재도전)
   */
  restartGameFlow() {
    this.messenger.notifyGameRestart(this.currentDifficulty);
    this.bulletPool.resetAll();
    this.shinobu.resetCombat(this.currentDifficulty);
    this.douma.resetCombat();
    this.lastAnnouncedPhase = 1;
    this.victoryTransitionTimer = 0;
    this.startCombat();
  }

  // ==========================================
  // 난이도 및 보조 제어
  // ==========================================
  setDifficulty(diffId) {
    if (!DIFFICULTY_CONFIG[diffId]) return;
    this.currentDifficulty = DIFFICULTY_CONFIG[diffId];

    this.messenger.notifyDifficultyChange(this.currentDifficulty);

    this.douma.setDifficulty(this.currentDifficulty);
    this.shinobu.resetCombat(this.currentDifficulty);

    this.diffButtons.forEach(btn => {
      if (btn.dataset.diff === diffId) {
        btn.classList.add('active');
        btn.style.background = '#312e4f';
      } else {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
      }
    });

    if (this.headerDifficultyBadge) {
      this.headerDifficultyBadge.textContent = diffId;
      this.headerDifficultyBadge.style.color = diffId === 'HARD' ? '#ff80ab' : (diffId === 'EASY' ? '#69f0ae' : '#ffd54f');
    }

    if (this.diffDesc) {
      this.diffDesc.textContent = this.currentDifficulty.description;
    }

    if (this.gameState === 'PLAYING') {
      this.restartGameFlow();
    }
  }

  setGameState(state) {
    this.gameState = state;
    if (this.activeCharHud) {
      this.activeCharHud.textContent = `상태: ${state}`;
    }
  }

  togglePause() {
    if (this.gameState === 'PLAYING') {
      this.setGameState('PAUSED');
    } else if (this.gameState === 'PAUSED') {
      this.setGameState('PLAYING');
    }
  }

  _updateUiState() {
    const hasCharAsset = assetManager.hasLoaded('shinobu') || assetManager.hasLoaded('douma');
    const hasBgAsset = assetManager.hasLoaded(BACKGROUND_CONFIG.assets.default.key);
    const isProcedural = this.renderer.forceProcedural || (!hasCharAsset && !hasBgAsset);

    if (this.renderModeHud) {
      this.renderModeHud.textContent = isProcedural ? '절차적 렌더러 (Procedural)' : '애셋 모드 (Image Sprites)';
      this.renderModeHud.style.color = isProcedural ? '#ffd54f' : '#69f0ae';
    }

    if (this.diagAssetStatus) {
      const charStatus = hasCharAsset ? '캐릭터: PNG' : '캐릭터: Fallback';
      const bgStatus = hasBgAsset ? '배경: PNG' : '배경: Fallback';
      this.diagAssetStatus.textContent = `${charStatus} | ${bgStatus}`;
      this.diagAssetStatus.style.color = isProcedural ? '#ffd54f' : '#69f0ae';
    }
  }

  // ==========================================
  // 프레임 업데이트 (deltaTime 기반 60FPS)
  // ==========================================
  update(dt) {
    // 1. 연출 디렉터 갱신 (페이드, 타자, 등장 보간 등)
    this.cutscene.update(dt, this.shinobu, this.douma);

    // 2. 배경 스크롤 갱신
    const bgSpeedMultiplier = (this.gameState === 'PLAYING' || this.gameState === 'BATTLE_INTRO') ? 1.0 : 0.3;
    this.bgRenderer.update(dt * bgSpeedMultiplier);

    // 3. 엔티티 기본 애니메이션/파티클 갱신
    this.renderer.update(dt);

    // 4. 전투 상태가 아닐 때의 업데이트 처리
    if (this.gameState !== 'PLAYING') {
      // 대화/등장 씬 중에도 캐릭터 숨쉬기/유영 애니메이션 유지
      if (this.gameState === 'PROLOGUE' || this.gameState === 'ENTRANCE' || this.gameState === 'BATTLE_INTRO') {
        this.shinobu.update(dt);
        this.douma.update(dt);
      }

      // 승리 컷씬 후 일정 시간 대기 후 승리 화면으로 전환
      if (this.gameState === 'VICTORY_CUTSCENE' && !this.cutscene.currentDialogueList) {
        this.victoryTransitionTimer += dt;
        if (this.victoryTransitionTimer >= this.victoryTransitionDelay) {
          this.setGameState('VICTORY');
        }
      }

      // 패배 컷씬 후 일정 시간 대기 후 게임오버 화면으로 전환
      if (this.gameState === 'DEFEAT_CUTSCENE' && !this.cutscene.currentDialogueList) {
        this.victoryTransitionTimer += dt;
        if (this.victoryTransitionTimer >= this.victoryTransitionDelay) {
          this.setGameState('GAME_OVER');
        }
      }

      return;
    }

    // ==========================================
    // [PLAYING 실시간 전투 로직]
    // ==========================================

    // InputManager에서 정규화된 이동 벡터 획득
    const moveVec = this.inputManager.getMovementVector();

    // 포커스 모드 처리
    const isFocusMode = this.inputManager.isFocusPressed();
    this.shinobu.setFocusMode(isFocusMode);

    // 일시정지 처리
    if (this.inputManager.isPausePressed()) {
      this.togglePause();
    }

    // 폭탄 액션 처리 (한 번만)
    if (this.inputManager.isActionJustPressed()) {
      this.shinobu.useBomb(this.bulletPool, this.douma);
    }

    // 플레이어 속도 설정
    const speed = this.shinobu.currentSpeed;
    this.shinobu.vx = moveVec.x * speed;
    this.shinobu.vy = moveVec.y * speed;

    // 엔티티 전투 상태 갱신 & 자동 공격 / 보스 6대 탄막
    this.shinobu.updateCombat(dt, this.bulletPool, this.douma);
    this.douma.updateCombat(dt, this.shinobu, this.bulletPool, this.VIRTUAL_WIDTH);

    // 페이즈 전환 컷신 배너 트리거 감지
    if (this.douma.phase !== this.lastAnnouncedPhase) {
      this.lastAnnouncedPhase = this.douma.phase;
      this.cutscene.triggerPhaseTransition(this.douma.phase);
      this.combat.triggerScreenShake(0.35, 10);
    }

    // 탄환 풀 갱신 및 화면 경계 회수
    this.bulletPool.update(dt, {
      minX: -40,
      minY: -40,
      maxX: this.VIRTUAL_WIDTH + 40,
      maxY: this.VIRTUAL_HEIGHT + 40
    });

    // 충돌 판정 및 전투 규칙 처리
    this.combat.update(dt, this.shinobu, this.douma);

    // 화면 경계 제한
    this.shinobu.clampToBounds(0, 0, this.VIRTUAL_WIDTH, this.VIRTUAL_HEIGHT);
    this.douma.clampToBounds(0, 0, this.VIRTUAL_WIDTH, this.VIRTUAL_HEIGHT);

    // 승리 / 패배 조건 검사
    if (!this.douma.isAlive || this.douma.hp <= 0) {
      this.handleVictory();
    } else if (!this.shinobu.isAlive && this.shinobu.lives <= 0) {
      this.handleDefeat();
    }

    // 대시보드 HUD 진단 정보 갱신
    this._updateDiagnostics();
  }

  /**
   * 게임 점수 계산
   */
  _calculateScore() {
    const baseScore = 1000;
    const difficultyMultiplier = {
      'EASY': 1.0,
      'NORMAL': 1.5,
      'HARD': 2.0
    }[this.currentDifficulty.id] || 1.0;
    const hpBonus = Math.max(0, this.shinobu.hp) * 10;
    const lifeBonus = this.shinobu.lives * 500;
    const timeBonus = Math.max(0, 300 - this.playTime) * 5; // 5분 안에 클리어하면 보너스

    return Math.round((baseScore * difficultyMultiplier) + hpBonus + lifeBonus + timeBonus);
  }

  _updateDiagnostics() {
    if (this.fpsDisplay) {
      this.fpsDisplay.textContent = `FPS: ${this.loop.getFps()}`;
    }
    if (this.diagBossPhase) {
      this.diagBossPhase.textContent = `Phase ${this.douma.phase} / 3 [${this.currentDifficulty.id}]`;
    }
    if (this.diagHp) {
      this.diagHp.textContent = `P: ${Math.round(this.shinobu.hp)} | B: ${Math.round(this.douma.hp)}`;
    }
    if (this.diagFrame) {
      this.diagFrame.textContent = `${this.bulletPool.getActiveCount()}발`;
    }
  }

  // ==========================================
  // 렌더링 파이프라인
  // ==========================================
  render() {
    const ctx = this.ctx;

    ctx.save();

    // 1. 화면 진동 (Screen Shake)
    if (this.combat.shakeOffsetX !== 0 || this.combat.shakeOffsetY !== 0) {
      ctx.translate(this.combat.shakeOffsetX, this.combat.shakeOffsetY);
    }

    // 2. 배경 렌더링
    this.bgRenderer.render(ctx, this.douma.phase);

    // 3. 캐릭터 렌더링
    this.douma.render(ctx);
    this.shinobu.render(ctx);

    // 4. 탄환 풀 렌더링
    this.bulletPool.render(ctx);

    // 5. 충돌 파티클 렌더링
    this.combat.renderParticles(ctx);

    ctx.restore();

    // 6. 전투 HUD 렌더링 (전투 중 또는 일시정지 시)
    if (this.gameState === 'PLAYING' || this.gameState === 'PAUSED') {
      this.hud.renderHud(ctx, this.shinobu, this.douma, this.currentDifficulty);
    }

    // 7. 연출 디렉터 렌더링 (대화창, VS 인트로, 페이즈 배너 등)
    this.cutscene.render(ctx);

    // 7.5. 페이드 렌더링 (대화창이 없을 때만)
    if (!this.cutscene.currentDialogueList && this.cutscene.fadeAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(10, 8, 20, ${this.cutscene.fadeAlpha})`;
      ctx.fillRect(0, 0, this.VIRTUAL_WIDTH, this.VIRTUAL_HEIGHT);
      ctx.restore();
    }

    // 8. 게임 상태 모달 오버레이 (READY, PAUSED, GAME_OVER, VICTORY)
    this.hud.renderOverlay(ctx, this.gameState, this.currentDifficulty);
  }
}

// 애플리케이션 부트스트랩
window.addEventListener('DOMContentLoaded', () => {
  const app = new DanmakuGameApp();
  app.init();
});
