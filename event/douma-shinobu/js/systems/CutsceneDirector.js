/**
 * CutsceneDirector - 스토리 나레이션 및 연출 총괄 디렉터
 * 
 * - 텍스트 타자(Typewriter) 효과 및 스킵/진행 제어
 * - 화면 페이드 인 / 페이드 아웃 (Fade Transition)
 * - 시노부 & 도우마 등장 연출 (Entrance)
 * - 전투 개시 ("VS" & "BATTLE START!") 연출
 * - 보스 페이즈 전환(Phase Transition Banner) 컷신
 * - 승리 소멸(Dissolve) 및 패배 연출
 * - 모바일 환경 60FPS 최적화
 */

import { STORY_DATA } from '../config/storyData.js';

export class CutsceneDirector {
  constructor(virtualWidth = 540, virtualHeight = 960) {
    this.W = virtualWidth;
    this.H = virtualHeight;

    // 1. 페이드 제어
    this.fadeAlpha = 0.0;
    this.fadeTargetAlpha = 0.0;
    this.fadeSpeed = 2.0;
    this.fadeCallback = null;

    // 2. 대화 시퀀스 제어
    this.currentDialogueList = null;
    this.dialogueIndex = 0;
    this.charIndex = 0;
    this.typingSpeed = 32; // 초당 32글자
    this.typingTimer = 0;
    this.isTyping = false;
    this.dialogueCallback = null;

    // 2.5. 초상화 이미지 캐시
    this.portraitImages = {
      shinobu: null,
      douma: null
    };
    this._loadPortraits();

    // 3. 등장 및 인트로 연출 타이머
    this.entranceActive = false;
    this.entranceTimer = 0;
    this.entranceDuration = 2.0;
    this.entranceCallback = null;

    // 4. 전투 개시 연출 ("VS" & "BATTLE START")
    this.battleIntroActive = false;
    this.battleIntroTimer = 0;
    this.battleIntroDuration = 1.6;
    this.battleIntroCallback = null;

    // 5. 페이즈 전환 연출
    this.phaseBannerActive = false;
    this.phaseBannerTimer = 0;
    this.phaseBannerDuration = 2.0;
    this.currentPhaseData = null;
    this.phaseBannerCallback = null;

    // 6. 연출용 특수 파티클 풀
    this.cutsceneParticles = [];
  }

  /**
   * 초상화 이미지 로드
   */
  _loadPortraits() {
    // 시노부 초상화
    const shinobuImg = new Image();
    shinobuImg.src = './assets/images/shinobu/shinobu_portrait.webp';
    shinobuImg.onload = () => {
      this.portraitImages.shinobu = shinobuImg;
    };

    // 도우마 초상화
    const doumaImg = new Image();
    doumaImg.src = './assets/images/douma/douma_portrait.webp';
    doumaImg.onload = () => {
      this.portraitImages.douma = doumaImg;
    };
  }

  /**
   * speaker에 따른 초상화 취득
   */
  _getPortraitImage(speaker) {
    if (speaker === '시노부') return this.portraitImages.shinobu;
    if (speaker === '도우마') return this.portraitImages.douma;
    return null;
  }

  // ==========================================
  // [1] 페이드 트랜지션 (Fade In / Out)
  // ==========================================
  startFade(targetAlpha, duration = 0.6, onComplete = null) {
    this.fadeTargetAlpha = targetAlpha;
    this.fadeSpeed = Math.abs(targetAlpha - this.fadeAlpha) / Math.max(0.1, duration);
    this.fadeCallback = onComplete;
  }

  // ==========================================
  // [2] 대화 및 텍스트 타자 효과
  // ==========================================
  startDialogue(dialogueList, onComplete = null) {
    if (!dialogueList || dialogueList.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    this.currentDialogueList = dialogueList;
    this.dialogueIndex = 0;
    this.dialogueCallback = onComplete;
    this._setupCurrentLine();
  }

  _setupCurrentLine() {
    this.charIndex = 0;
    this.typingTimer = 0;
    this.isTyping = true;
  }

  /**
   * 대사 진행 (클릭/터치/스페이스 시 호출)
   */
  advanceDialogue() {
    if (!this.currentDialogueList) return false;

    const currentItem = this.currentDialogueList[this.dialogueIndex];
    if (!currentItem) return false;

    if (this.isTyping) {
      // 1. 타이핑 중이면 즉시 전체 대사 표시
      this.charIndex = currentItem.text.length;
      this.isTyping = false;
      return true;
    } else {
      // 2. 이미 완성이면 다음 대사로 전진
      this.dialogueIndex++;
      if (this.dialogueIndex < this.currentDialogueList.length) {
        this._setupCurrentLine();
        return true;
      } else {
        // 전체 대사 완료
        this.currentDialogueList = null;
        if (this.dialogueCallback) {
          const cb = this.dialogueCallback;
          this.dialogueCallback = null;
          cb();
        }
        return false;
      }
    }
  }

  /**
   * 대화 시퀀스 전체 스킵
   */
  skipDialogue() {
    if (!this.currentDialogueList) return;
    this.currentDialogueList = null;
    if (this.dialogueCallback) {
      const cb = this.dialogueCallback;
      this.dialogueCallback = null;
      cb();
    }
  }

  // ==========================================
  // [3] 등장 연출 (Character Entrance)
  // ==========================================
  startEntrance(shinobu, douma, onComplete = null) {
    this.entranceActive = true;
    this.entranceTimer = 0;
    this.entranceDuration = 2.0;
    this.entranceCallback = onComplete;

    // 초기 오프스크린 좌표 설정
    shinobu.x = this.W / 2;
    shinobu.y = this.H + 80; // 화면 밑에서 등장

    douma.x = this.W / 2;
    douma.y = -80; // 화면 위에서 강림

    // 등장 파티클 분출
    this._spawnEntranceParticles();
  }

  // ==========================================
  // [4] 전투 개시 연출 ("VS" & "BATTLE START!")
  // ==========================================
  startBattleIntro(onComplete = null) {
    this.battleIntroActive = true;
    this.battleIntroTimer = 0;
    this.battleIntroDuration = 1.6;
    this.battleIntroCallback = onComplete;
  }

  // ==========================================
  // [5] 페이즈 전환 연출 (Phase Transition Banner)
  // ==========================================
  triggerPhaseTransition(phaseNumber, onComplete = null) {
    this.phaseBannerActive = true;
    this.phaseBannerTimer = 0;
    this.phaseBannerDuration = 2.0;
    this.phaseBannerCallback = onComplete;

    if (phaseNumber === 2) {
      this.currentPhaseData = STORY_DATA.phaseTransitions.phase2;
    } else {
      this.currentPhaseData = STORY_DATA.phaseTransitions.phase3;
    }

    // 화면 진동 & 냉기 충격파 파티클
    for (let i = 0; i < 30; i++) {
      const angle = (i * Math.PI * 2) / 30;
      this.cutsceneParticles.push({
        x: this.W / 2,
        y: 220,
        vx: Math.cos(angle) * (100 + Math.random() * 150),
        vy: Math.sin(angle) * (100 + Math.random() * 150),
        color: '#80d8ff',
        size: 3 + Math.random() * 4,
        life: 1.0,
        maxLife: 1.0,
        alpha: 1.0
      });
    }
  }

  // ==========================================
  // 프레임 업데이트
  // ==========================================
  update(dt, shinobu = null, douma = null) {
    // 1. 페이드 업데이트
    if (this.fadeAlpha !== this.fadeTargetAlpha) {
      if (this.fadeAlpha < this.fadeTargetAlpha) {
        this.fadeAlpha = Math.min(this.fadeTargetAlpha, this.fadeAlpha + this.fadeSpeed * dt);
      } else {
        this.fadeAlpha = Math.max(this.fadeTargetAlpha, this.fadeAlpha - this.fadeSpeed * dt);
      }

      if (this.fadeAlpha === this.fadeTargetAlpha && this.fadeCallback) {
        const cb = this.fadeCallback;
        this.fadeCallback = null;
        cb();
      }
    }

    // 2. 대화 타자 업데이트
    if (this.currentDialogueList && this.isTyping) {
      const currentItem = this.currentDialogueList[this.dialogueIndex];
      if (currentItem) {
        this.typingTimer += dt;
        const interval = 1 / this.typingSpeed;
        while (this.typingTimer >= interval && this.charIndex < currentItem.text.length) {
          this.typingTimer -= interval;
          this.charIndex++;
        }
        if (this.charIndex >= currentItem.text.length) {
          this.isTyping = false;
        }
      }
    }

    // 3. 등장 연출 진행
    if (this.entranceActive && shinobu && douma) {
      this.entranceTimer += dt;
      const t = Math.min(1.0, this.entranceTimer / this.entranceDuration);
      // Ease-out cubic 보간
      const ease = 1 - Math.pow(1 - t, 3);

      // 시노부: Y 1040 -> Y 800
      shinobu.y = (this.H + 80) - ease * ((this.H + 80) - 800);
      // 도우마: Y -80 -> Y 220
      douma.y = -80 + ease * 300;

      if (this.entranceTimer >= this.entranceDuration) {
        this.entranceActive = false;
        shinobu.y = 800;
        douma.y = 220;
        if (this.entranceCallback) {
          const cb = this.entranceCallback;
          this.entranceCallback = null;
          cb();
        }
      }
    }

    // 4. 전투 개시 연출 진행
    if (this.battleIntroActive) {
      this.battleIntroTimer += dt;
      if (this.battleIntroTimer >= this.battleIntroDuration) {
        this.battleIntroActive = false;
        if (this.battleIntroCallback) {
          const cb = this.battleIntroCallback;
          this.battleIntroCallback = null;
          cb();
        }
      }
    }

    // 5. 페이즈 전환 연출 진행
    if (this.phaseBannerActive) {
      this.phaseBannerTimer += dt;
      if (this.phaseBannerTimer >= this.phaseBannerDuration) {
        this.phaseBannerActive = false;
        if (this.phaseBannerCallback) {
          const cb = this.phaseBannerCallback;
          this.phaseBannerCallback = null;
          cb();
        }
      }
    }

    // 6. 연출 파티클 갱신
    for (let i = this.cutsceneParticles.length - 1; i >= 0; i--) {
      const p = this.cutsceneParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.cutsceneParticles.splice(i, 1);
      }
    }
  }

  _spawnEntranceParticles() {
    // 시노부 나비 파티클 (하단에서 솟구침)
    for (let i = 0; i < 25; i++) {
      this.cutsceneParticles.push({
        x: this.W / 2 + (Math.random() - 0.5) * 80,
        y: this.H - 50,
        vx: (Math.random() - 0.5) * 60,
        vy: -80 - Math.random() * 120,
        color: Math.random() > 0.5 ? '#b388ff' : '#80deea',
        size: 3 + Math.random() * 3,
        life: 1.6,
        maxLife: 1.6,
        alpha: 1.0
      });
    }

    // 도우마 서리 파티클 (상단에서 하강)
    for (let i = 0; i < 25; i++) {
      this.cutsceneParticles.push({
        x: this.W / 2 + (Math.random() - 0.5) * 120,
        y: 60,
        vx: (Math.random() - 0.5) * 50,
        vy: 60 + Math.random() * 80,
        color: '#e0f7fa',
        size: 4 + Math.random() * 3,
        life: 1.6,
        maxLife: 1.6,
        alpha: 1.0
      });
    }
  }

  // ==========================================
  // [렌더링 파이프라인]
  // ==========================================
  render(ctx) {
    // 1. 연출 파티클 렌더링
    this._renderParticles(ctx);

    // 2. 대화창 렌더링 (페이드와 무관하게 항상 밝음)
    if (this.currentDialogueList) {
      this._renderDialogueBox(ctx);
    }

    // 4. 전투 개시 ("VS" / "BATTLE START") 렌더링
    if (this.battleIntroActive) {
      this._renderBattleIntro(ctx);
    }

    // 5. 페이즈 전환 배너 렌더링
    if (this.phaseBannerActive) {
      this._renderPhaseBanner(ctx);
    }
  }

  _renderParticles(ctx) {
    for (const p of this.cutsceneParticles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ==========================================
  // [대화창 UI 렌더러]
  // ==========================================
  _renderDialogueBox(ctx) {
    const item = this.currentDialogueList[this.dialogueIndex];
    if (!item) return;

    ctx.save();

    const boxW = this.W - 32;
    const boxH = 145;
    const boxX = 16;
    const boxY = this.H - boxH - 24;

    // 0. 초상화 렌더링 (나레이션 제외)
    if (item.speaker !== '나레이션') {
      this._renderPortrait(ctx, item.speaker);
    }

    // 1. 대화창 배경 (밝고 불투명하게)
    const boxGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
    boxGrad.addColorStop(0, 'rgba(80, 70, 120, 1.0)');
    boxGrad.addColorStop(1, 'rgba(50, 40, 80, 1.0)');

    ctx.fillStyle = boxGrad;
    ctx.strokeStyle = item.themeColor || '#b388ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 12);
    ctx.fill();
    ctx.stroke();

    // 1.5. 말풍선 외곽선 강조 (반짝이는 효과)
    ctx.strokeStyle = item.themeColor || '#b388ff';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(boxX + 1.5, boxY + 1.5, boxW - 3, boxH - 3, 10);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // 2. 화자 이름 뱃지
    const badgeW = 120;
    const badgeH = 26;
    const badgeX = boxX + 16;
    const badgeY = boxY - 14;

    ctx.fillStyle = item.themeColor || '#b388ff';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();

    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#0d0c15';
    ctx.textAlign = 'center';
    ctx.fillText(item.speaker, badgeX + badgeW / 2, badgeY + 18);

    // 3. 우상단 [SKIP] 버튼 가이드
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#9e9cb4';
    ctx.textAlign = 'right';
    ctx.fillText('화면 터치/클릭: 진행 | [SKIP]', boxX + boxW - 14, boxY + 20);

    // 4. 타이핑된 대사 본문 출력
    ctx.textAlign = 'left';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#f3f2ff';

    const visibleText = item.text.substring(0, this.charIndex);
    const lines = visibleText.split('\n');
    const lineHeight = 22;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], boxX + 18, boxY + 48 + i * lineHeight);
    }

    // 5. 다음 대사 안내 인디케이터 (깜빡이는 삼각형)
    if (!this.isTyping) {
      const blink = Math.sin(performance.now() / 180) > 0;
      if (blink) {
        ctx.fillStyle = item.themeColor || '#b388ff';
        ctx.font = '14px sans-serif';
        ctx.fillText('▼', boxX + boxW - 24, boxY + boxH - 14);
      }
    }

    ctx.restore();
  }

  /**
   * 초상화 렌더링
   */
  _renderPortrait(ctx, speaker) {
    const img = this._getPortraitImage(speaker);
    if (!img) return;

    ctx.save();

    // 초상화 크기
    const portraitH = 320;
    const portraitW = portraitH * (img.width / img.height); // 원본 비율 유지

    // 대화창 위치 계산 (렌더링 순서가 변경되어서 여기서 다시 계산)
    const boxH = 145;
    const boxY = this.H - boxH - 24;

    // 초상화가 대화창 위에 맞도록 위치 계산
    let portraitX, portraitY;
    if (speaker === '시노부') {
      // 시노부: 좌측 (대화창 위쪽에 배치)
      portraitX = 0;
      portraitY = boxY - portraitH + 60; // 대화창과 약간 겹치게
    } else {
      // 도우마: 우측 (대화창 위쪽에 배치)
      portraitX = this.W - portraitW;
      portraitY = boxY - portraitH + 60;
    }

    // 초상화 반투명 처리
    ctx.globalAlpha = 0.85;
    ctx.drawImage(img, portraitX, portraitY, portraitW, portraitH);

    ctx.restore();
  }

  // ==========================================
  // [전투 개시 연출: VS & BATTLE START!]
  // ==========================================
  _renderBattleIntro(ctx) {
    ctx.save();
    const t = this.battleIntroTimer / this.battleIntroDuration;
    const midX = this.W / 2;
    const midY = this.H / 2;

    if (t < 0.6) {
      // 1. "VS" 타이포 확대 임팩트
      const scale = 1.0 + (1.0 - t / 0.6) * 1.5;
      ctx.translate(midX, midY);
      ctx.scale(scale, scale);

      // 배경 딤
      ctx.fillStyle = 'rgba(10, 8, 20, 0.4)';
      ctx.fillRect(-this.W, -this.H, this.W * 2, this.H * 2);

      // 시노부 이름 (좌측)
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#b388ff';
      ctx.textAlign = 'right';
      ctx.fillText('충주 시노부', -30, 8);

      // "VS" (중앙 발광)
      ctx.font = 'bold 38px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#e040fb';
      ctx.shadowBlur = 16;
      ctx.textAlign = 'center';
      ctx.fillText('VS', 0, 12);

      // 도우마 이름 (우측)
      ctx.shadowBlur = 0;
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#80d8ff';
      ctx.textAlign = 'left';
      ctx.fillText('상현 2 도우마', 30, 8);

    } else {
      // 2. "BATTLE START!" 강렬한 플래시 임팩트
      const startT = (t - 0.6) / 0.4;
      const alpha = 1.0 - startT * 0.8;

      ctx.translate(midX, midY);
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255, 235, 59, ${alpha})`;
      ctx.shadowColor = '#ffd54f';
      ctx.shadowBlur = 24;
      ctx.fillText('⚔️ BATTLE START! ⚔️', 0, 15);
    }

    ctx.restore();
  }

  // ==========================================
  // [페이즈 전환 배너 연출]
  // ==========================================
  _renderPhaseBanner(ctx) {
    if (!this.currentPhaseData) return;

    ctx.save();
    const midX = this.W / 2;
    const midY = 320;
    const t = this.phaseBannerTimer / this.phaseBannerDuration;

    // 배너 배경 (화면 가로 횡단)
    const bannerH = 75;
    ctx.fillStyle = 'rgba(13, 12, 21, 0.88)';
    ctx.strokeStyle = this.currentPhaseData.themeColor || '#80d8ff';
    ctx.lineWidth = 2;
    ctx.fillRect(0, midY - bannerH / 2, this.W, bannerH);
    ctx.strokeRect(0, midY - bannerH / 2, this.W, bannerH);

    // 스킬명 타이틀
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = this.currentPhaseData.themeColor || '#80d8ff';
    ctx.shadowColor = this.currentPhaseData.themeColor;
    ctx.shadowBlur = 12;
    ctx.fillText(this.currentPhaseData.title, midX, midY - 6);

    // 보스 대사
    ctx.shadowBlur = 0;
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#f3f2ff';
    const firstLine = this.currentPhaseData.dialogue.split('\n')[0];
    ctx.fillText(`도우마: "${firstLine}"`, midX, midY + 22);

    ctx.restore();
  }
}
