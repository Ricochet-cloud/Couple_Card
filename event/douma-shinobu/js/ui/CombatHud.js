/**
 * CombatHud - 전투 전용 캔버스 HUD 및 오버레이 렌더러
 * 
 * - 보스 HP 바, 페이즈 구분선, 난이도 뱃지, 독 디버프 표시
 * - 플레이어 HP, 잔기(Life), 폭탄(Bomb), 등꽃 독 게이지
 * - 게임 상태(READY, PAUSED, GAME_OVER, VICTORY) 모달 오버레이
 */

export class CombatHud {
  constructor(virtualWidth = 540, virtualHeight = 960) {
    this.W = virtualWidth;
    this.H = virtualHeight;
  }

  /**
   * HUD 렌더링 (체력바, 잔기, 게이지)
   */
  renderHud(ctx, shinobu, douma, difficulty = null) {
    this._renderBossBar(ctx, douma, difficulty);
    this._renderPlayerStatus(ctx, shinobu);
  }

  // ==========================================
  // [1] 보스(도우마) 체력바
  // ==========================================
  _renderBossBar(ctx, douma, diff) {
    const barWidth = 420;
    const barHeight = 12;
    const barX = (this.W - barWidth) / 2;
    const barY = 26;

    ctx.save();

    // 1. 보스 이름 및 난이도 뱃지
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#80d8ff';
    ctx.fillText('❄️ 상현 2 도우마 (Douma)', barX, barY - 7);

    // 난이도 및 페이즈 텍스트
    ctx.font = '12px monospace';
    ctx.fillStyle = diff?.id === 'HARD' ? '#ff80ab' : (diff?.id === 'EASY' ? '#69f0ae' : '#ffd54f');
    const diffBadge = diff ? `[${diff.id}] ` : '';
    const phaseText = `${diffBadge}PHASE ${douma.phase} / 3`;
    ctx.fillText(phaseText, barX + barWidth - ctx.measureText(phaseText).width, barY - 7);

    // 2. 바 배경
    ctx.fillStyle = 'rgba(10, 15, 25, 0.85)';
    ctx.strokeStyle = '#2e2a4a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 6);
    ctx.fill();
    ctx.stroke();

    // 3. 체력 게이지 (독 중독 시 보라색 그라데이션)
    const hpRatio = Math.max(0, Math.min(1, douma.hp / douma.maxHp));
    const currentBarW = barWidth * hpRatio;

    if (currentBarW > 0) {
      const grad = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
      if (douma.isPoisoned) {
        grad.addColorStop(0, '#ab47bc');
        grad.addColorStop(1, '#e040fb');
      } else {
        grad.addColorStop(0, '#00e5ff');
        grad.addColorStop(1, '#80d8ff');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, currentBarW, barHeight, 6);
      ctx.fill();
    }

    // 4. 페이즈 구분 마커 (66%, 33%)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    const p1X = barX + barWidth * 0.66;
    const p2X = barX + barWidth * 0.33;

    ctx.beginPath();
    ctx.moveTo(p1X, barY);
    ctx.lineTo(p1X, barY + barHeight);
    ctx.moveTo(p2X, barY);
    ctx.lineTo(p2X, barY + barHeight);
    ctx.stroke();

    // 5. 독 중독 아이콘
    if (douma.isPoisoned) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#ea80fc';
      ctx.fillText(`☠️ 등꽃 독 중독 (${douma.poisonDuration.toFixed(1)}s)`, barX, barY + barHeight + 14);
    }

    ctx.restore();
  }

  // ==========================================
  // [2] 플레이어(시노부) 상태
  // ==========================================
  _renderPlayerStatus(ctx, shinobu) {
    const startX = 20;
    const bottomY = this.H - 45;

    ctx.save();

    // 1. 잔기(Life) 아이콘
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#b388ff';
    ctx.fillText('잔기 (LIFE)', startX, bottomY - 26);

    for (let i = 0; i < 5; i++) {
      ctx.font = '15px sans-serif';
      if (i < shinobu.lives) {
        ctx.fillText('💜', startX + i * 22, bottomY - 8);
      } else {
        ctx.fillStyle = '#424242';
        ctx.fillText('🖤', startX + i * 22, bottomY - 8);
      }
    }

    // 2. 결전 오의 폭탄 아이콘
    const bombX = startX + 130;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#a7ffeb';
    ctx.fillText('오의 (BOMB)', bombX, bottomY - 26);

    for (let i = 0; i < 4; i++) {
      ctx.font = '15px sans-serif';
      if (i < shinobu.bombs) {
        ctx.fillText('🦋', bombX + i * 22, bottomY - 8);
      } else {
        ctx.fillStyle = '#424242';
        ctx.fillText('⚪', bombX + i * 22, bottomY - 8);
      }
    }

    // 3. 체력 게이지 바
    const hpBarW = 120;
    const hpBarH = 10;
    const hpBarX = this.W - hpBarW - 24;
    const hpBarY = bottomY - 22;

    ctx.font = '12px monospace';
    ctx.fillStyle = '#e1bee7';
    ctx.fillText(`HP: ${Math.round(shinobu.hp)} / ${shinobu.maxHp}`, hpBarX, hpBarY - 6);

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeStyle = '#2e2a4a';
    ctx.lineWidth = 1;
    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
    ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);

    const hpRatio = Math.max(0, shinobu.hp / shinobu.maxHp);
    ctx.fillStyle = hpRatio > 0.3 ? '#ba68c8' : '#ff1744';
    ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);

    // 4. 등꽃 독 축적 게이지
    const poisonBarY = bottomY - 2;
    ctx.font = '11px monospace';
    ctx.fillStyle = '#ce93d8';
    ctx.fillText(`등꽃 독: ${Math.round(shinobu.poisonGauge)}%`, hpBarX, poisonBarY - 4);

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeStyle = '#4a148c';
    ctx.fillRect(hpBarX, poisonBarY, hpBarW, 6);
    ctx.strokeRect(hpBarX, poisonBarY, hpBarW, 6);

    const pRatio = Math.min(1, shinobu.poisonGauge / 100);
    ctx.fillStyle = pRatio >= 1 ? '#00e676' : '#e040fb';
    ctx.fillRect(hpBarX, poisonBarY, hpBarW * pRatio, 6);

    ctx.restore();
  }

  // ==========================================
  // [3] 게임 상태별 모달 오버레이
  // ==========================================
  renderOverlay(ctx, gameState, difficulty = null) {
    if (gameState === 'PLAYING') return;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 8, 20, 0.78)';
    ctx.fillRect(0, 0, this.W, this.H);

    const midX = this.W / 2;
    const midY = this.H / 2;

    switch (gameState) {
      case 'READY':
        this._renderReadyScreen(ctx, midX, midY, difficulty);
        break;
      case 'PAUSED':
        this._renderPausedScreen(ctx, midX, midY);
        break;
      case 'GAME_OVER':
        this._renderGameOverScreen(ctx, midX, midY, difficulty);
        break;
      case 'VICTORY':
        this._renderVictoryScreen(ctx, midX, midY, difficulty);
        break;
    }

    ctx.restore();
  }

  _renderReadyScreen(ctx, x, y, diff) {
    ctx.textAlign = 'center';

    // 타이틀
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#b388ff';
    ctx.fillText('🦋 시노부 vs 도우마 ❄️', x, y - 110);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#80d8ff';
    ctx.fillText('무한성 결전 - 6대 탄막 보스전', x, y - 75);

    // 난이도 표시 뱃지
    if (diff) {
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = diff.id === 'HARD' ? '#ff80ab' : (diff.id === 'EASY' ? '#69f0ae' : '#ffd54f');
      ctx.fillText(`현재 난이도: ${diff.name}`, x, y - 48);
    }

    // 가이드 박스
    ctx.fillStyle = 'rgba(23, 21, 38, 0.88)';
    ctx.strokeStyle = '#4a3f78';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - 170, y - 30, 340, 160, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#f3f2ff';
    ctx.fillText('• 이동: 방향키 / WASD / 터치 드래그', x, y);
    ctx.fillText('• 자동 공격: 상시 발사 (기본 탑재)', x, y + 25);
    ctx.fillText('• 저속 집중: [Shift] (정밀 회피 & 집탄율↑)', x, y + 50);
    ctx.fillText('• 결전 오의: [Space] 또는 [X] (탄막 소거)', x, y + 75);
    ctx.fillText('• 예측 공격 회피: 이동 멈춤/방향 꺾기', x, y + 100);
    ctx.fillText('• 일시정지: [P] 또는 [ESC]', x, y + 125);

    // 시작 버튼 안내
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#69f0ae';
    ctx.fillText('▶ 화면을 클릭하거나 터치하여 전투 시작', x, y + 175);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#9e9cb4';
    ctx.fillText('(우측 패널에서 EASY / NORMAL / HARD 변경 가능)', x, y + 200);
  }

  _renderPausedScreen(ctx, x, y) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText('⏸️ 일시 정지 (PAUSED)', x, y - 20);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('P 키를 누르거나 화면을 터치하여 재개', x, y + 25);
  }

  _renderGameOverScreen(ctx, x, y, diff) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#ff5252';
    ctx.fillText('☠️ 패 배 (DEFEAT)', x, y - 50);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#ffcdd2';
    ctx.fillText(`난이도: ${diff?.name || 'NORMAL'}`, x, y - 10);
    ctx.fillText('시노부의 잔기가 모두 소진되었습니다...', x, y + 15);

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#80d8ff';
    ctx.fillText('🔄 화면을 클릭하여 재도전', x, y + 75);
  }

  _renderVictoryScreen(ctx, x, y, diff) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#69f0ae';
    ctx.fillText('🏆 승 리 (VICTORY)!', x, y - 60);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#e1bee7';
    ctx.fillText(`도우마 격파 성공! [난이도: ${diff?.name || 'NORMAL'}]`, x, y - 15);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#a7ffeb';
    ctx.fillText('등꽃 독이 혈귀의 몸을 완전히 붕괴시켰습니다.', x, y + 15);

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText('✨ 화면을 클릭하여 다시하기', x, y + 75);
  }
}
