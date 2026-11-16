/**
 * ProceduralCharacterRenderer
 * 
 * - 실제 이미지 애셋(PNG)이 없을 때 가동되는 고품질 Canvas 절차적 벡터 렌더러
 * - 시노부(보라/민트 나비 테마)와 도우마(연미색/금빛 부채/얼음 결정 테마) 지원
 * - Idle / Move / Attack / Hit / Death 5대 애니메이션을 완벽히 시각화
 */

export class ProceduralCharacterRenderer {
  constructor() {
    this.particles = [];
  }

  /**
   * 절차적 파티클 갱신
   */
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * 캐릭터 절차적 렌더링 진입점
   */
  render(ctx, character) {
    const charId = character.id;
    const state = character.currentAnimName || 'idle';
    const anim = character.currentAnim;
    const progress = anim ? anim.getFrameIndex() / Math.max(1, anim.totalFrames - 1) : 0;
    const time = performance.now() / 1000;

    // 공통 파티클 렌더링
    this._renderParticles(ctx);

    ctx.save();
    ctx.translate(Math.round(character.x), Math.round(character.y));

    if (character.facing < 0) {
      ctx.scale(-1, 1);
    }

    if (charId === 'shinobu') {
      this._renderShinobu(ctx, state, progress, time, character);
    } else if (charId === 'douma') {
      this._renderDouma(ctx, state, progress, time, character);
    } else {
      this._renderGeneric(ctx, state, progress, time, character);
    }

    ctx.restore();
  }

  // ==========================================
  // [1] 시노부 (Kochou Shinobu) 절차적 렌더링
  // ==========================================
  _renderShinobu(ctx, state, progress, time, char) {
    let offsetY = 0;
    let tiltAngle = 0;
    let wingSpread = 1.0;
    let thrustX = 0;
    let alpha = 1.0;
    let isHitFlashing = false;

    // 상태별 모션 변위 계산
    switch (state) {
      case 'idle':
        offsetY = Math.sin(time * 4) * 3;
        wingSpread = 1.0 + Math.sin(time * 4) * 0.12;
        break;
      case 'move':
        offsetY = Math.abs(Math.sin(time * 10)) * -4;
        tiltAngle = 0.12;
        wingSpread = 1.25 + Math.sin(time * 12) * 0.2;
        if (Math.random() < 0.25) {
          this._spawnButterflyParticle(char.x - 10, char.y + 10, '#ba68c8');
        }
        break;
      case 'attack':
        // 돌진 찌르기 (앞으로 튀어나갔다가 복귀)
        thrustX = Math.sin(progress * Math.PI) * 24;
        tiltAngle = 0.25;
        wingSpread = 0.85;
        if (progress > 0.3 && progress < 0.8 && Math.random() < 0.5) {
          this._spawnPoisonSpark(char.x + 20, char.y);
        }
        break;
      case 'hit':
        isHitFlashing = Math.sin(progress * Math.PI * 6) > 0;
        offsetY = -Math.sin(progress * Math.PI) * 5;
        tiltAngle = -0.15;
        break;
      case 'death':
        alpha = Math.max(0, 1 - progress);
        offsetY = -progress * 25;
        wingSpread = 1.0 + progress * 1.5;
        this._spawnButterflyParticle(char.x + (Math.random() - 0.5) * 30, char.y + (Math.random() - 0.5) * 30, '#e1bee7');
        break;
    }

    ctx.globalAlpha = alpha;
    ctx.translate(thrustX, offsetY);
    ctx.rotate(tiltAngle);

    // 피격 시 붉은/백색 플래시
    if (isHitFlashing) {
      ctx.fillStyle = '#ff5252';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // 1. 나비 날개 하오리 (배경 레이어)
    this._drawButterflyHaori(ctx, wingSpread, time);

    // 2. 몸체 (검은색 귀살대 제복)
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.roundRect(-10, -6, 20, 28, 4);
    ctx.fill();

    // 3. 하얀 벨트
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-10, 8, 20, 4);

    // 4. 머리 및 얼굴
    ctx.fillStyle = '#ffecb3'; // 피부색
    ctx.beginPath();
    ctx.arc(0, -16, 12, 0, Math.PI * 2);
    ctx.fill();

    // 5. 칠흑빛 묶음 머리 & 보라색 끝단 그라데이션
    const hairGrad = ctx.createLinearGradient(0, -28, 0, -10);
    hairGrad.addColorStop(0, '#1a102f');
    hairGrad.addColorStop(0.7, '#2a1a4a');
    hairGrad.addColorStop(1.0, '#9c27b0'); // 보라색 포인트

    ctx.fillStyle = hairGrad;
    ctx.beginPath();
    ctx.arc(0, -20, 13, Math.PI, Math.PI * 2);
    ctx.lineTo(13, -12);
    ctx.lineTo(-13, -12);
    ctx.closePath();
    ctx.fill();

    // 6. 나비 머리핀 (민트 & 퍼플)
    ctx.fillStyle = '#80deea';
    ctx.beginPath();
    ctx.ellipse(-12, -22, 6, 4, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ba68c8';
    ctx.beginPath();
    ctx.ellipse(-12, -22, 3, 2, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // 7. 공격 시 일륜도 독침 찌르기 이펙트
    if (state === 'attack') {
      ctx.save();
      ctx.strokeStyle = '#ce93d8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, 6);
      ctx.lineTo(36, 6);
      ctx.stroke();

      // 바늘 끝 독 광원
      ctx.fillStyle = '#e040fb';
      ctx.shadowColor = '#e040fb';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(36, 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawButterflyHaori(ctx, spread, time) {
    ctx.save();
    // 좌/우 날개 그라데이션 (민트 -> 핑크 -> 보라)
    const wingGrad = ctx.createLinearGradient(-30, -10, 30, 25);
    wingGrad.addColorStop(0, '#e0f7fa');
    wingGrad.addColorStop(0.5, '#80deea');
    wingGrad.addColorStop(0.8, '#f8bbd0');
    wingGrad.addColorStop(1, '#ab47bc');

    ctx.fillStyle = wingGrad;
    ctx.strokeStyle = '#212121';
    ctx.lineWidth = 1.5;

    // 좌측 날개
    ctx.save();
    ctx.scale(spread, 1.0);
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.bezierCurveTo(-26, -14, -36, 12, -18, 26);
    ctx.bezierCurveTo(-12, 22, -8, 16, -4, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 우측 날개
    ctx.beginPath();
    ctx.moveTo(6, -4);
    ctx.bezierCurveTo(26, -14, 36, 12, 18, 26);
    ctx.bezierCurveTo(12, 22, 8, 16, 4, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  // ==========================================
  // [2] 도우마 (Douma) 절차적 렌더링
  // ==========================================
  _renderDouma(ctx, state, progress, time, char) {
    let offsetY = 0;
    let fanAngle = 0;
    let alpha = 1.0;
    let isHitFlashing = false;

    switch (state) {
      case 'idle':
        // 허공에 오만하게 부유
        offsetY = Math.sin(time * 3) * 6;
        fanAngle = Math.sin(time * 5) * 0.25;
        break;
      case 'move':
        offsetY = Math.sin(time * 6) * 4;
        fanAngle = 0.35;
        if (Math.random() < 0.3) {
          this._spawnFrostParticle(char.x + (Math.random() - 0.5) * 40, char.y + 25);
        }
        break;
      case 'attack':
        // 부채를 크게 부치는 모션
        fanAngle = -0.5 + Math.sin(progress * Math.PI) * 1.4;
        if (progress > 0.4 && Math.random() < 0.4) {
          this._spawnFrostParticle(char.x + 35, char.y - 10);
        }
        break;
      case 'hit':
        isHitFlashing = Math.sin(progress * Math.PI * 6) > 0;
        offsetY = -Math.sin(progress * Math.PI) * 4;
        break;
      case 'death':
        alpha = Math.max(0, 1 - progress);
        offsetY = progress * 15;
        this._spawnIceShatter(char.x, char.y);
        break;
    }

    ctx.globalAlpha = alpha;
    ctx.translate(0, offsetY);

    if (isHitFlashing) {
      ctx.fillStyle = '#80d8ff';
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // 1. 도우마의 연미색 로브 & 흑적색 상의
    const robeGrad = ctx.createLinearGradient(0, -20, 0, 40);
    robeGrad.addColorStop(0, '#424242');
    robeGrad.addColorStop(0.3, '#880e4f'); // 핏빛 붉은색
    robeGrad.addColorStop(1, '#f5f5dc'); // 연미색/크림색 하의

    ctx.fillStyle = robeGrad;
    ctx.beginPath();
    ctx.moveTo(-18, -10);
    ctx.lineTo(18, -10);
    ctx.lineTo(26, 38);
    ctx.lineTo(-26, 38);
    ctx.closePath();
    ctx.fill();

    // 2. 머리 및 은발(플래티넘 블론드)
    ctx.fillStyle = '#ffecb3';
    ctx.beginPath();
    ctx.arc(0, -24, 16, 0, Math.PI * 2);
    ctx.fill();

    // 머리칼 (연한 은금발)
    ctx.fillStyle = '#fffde7';
    ctx.beginPath();
    ctx.arc(0, -28, 17, Math.PI * 0.9, Math.PI * 2.1);
    ctx.lineTo(18, -18);
    ctx.lineTo(-18, -18);
    ctx.closePath();
    ctx.fill();

    // 3. 특유의 머리 위 핏빛 얼룩 (만년설 모자/혈흔)
    ctx.fillStyle = '#b71c1c';
    ctx.beginPath();
    ctx.ellipse(0, -40, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. 무지갯빛 칠색 눈동자 포인트
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(-5, -24, 3, 0, Math.PI * 2);
    ctx.arc(5, -24, 3, 0, Math.PI * 2);
    ctx.fill();

    // 5. 금빛 쇠부채 (Golden Tessen Fan)
    ctx.save();
    ctx.translate(16, 4);
    ctx.rotate(fanAngle);

    // 금빛 부채 펼침 렌더링
    const fanGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
    fanGrad.addColorStop(0, '#ffd700');
    fanGrad.addColorStop(0.8, '#ffb300');
    fanGrad.addColorStop(1, '#ffe082');

    ctx.fillStyle = fanGrad;
    ctx.strokeStyle = '#b78103';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 22, -Math.PI * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 부채 살 디테일
    ctx.strokeStyle = '#fff8e1';
    for (let a = -Math.PI * 0.6; a <= 0; a += 0.3) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22);
      ctx.stroke();
    }
    ctx.restore();

    // 공격 중 얼음 연꽃 결정체 이펙트
    if (state === 'attack') {
      this._drawIceLotus(ctx, 32, -6, progress);
    }
  }

  _drawIceLotus(ctx, x, y, progress) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(progress * Math.PI * 2);
    ctx.fillStyle = 'rgba(128, 222, 234, 0.7)';
    ctx.strokeStyle = '#e0f7fa';
    ctx.lineWidth = 1.5;

    for (let i = 0; i < 6; i++) {
      ctx.rotate((Math.PI * 2) / 6);
      ctx.beginPath();
      ctx.ellipse(10, 0, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  _renderGeneric(ctx, state, progress, time, char) {
    ctx.fillStyle = '#9e9e9e';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  // ==========================================
  // [3] 파티클 스폰 헬퍼
  // ==========================================
  _spawnButterflyParticle(x, y, color) {
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 25,
      vy: -20 - Math.random() * 20,
      life: 0.8,
      maxLife: 0.8,
      color,
      size: 3 + Math.random() * 3,
      type: 'butterfly'
    });
  }

  _spawnPoisonSpark(x, y) {
    this.particles.push({
      x,
      y,
      vx: 60 + Math.random() * 40,
      vy: (Math.random() - 0.5) * 30,
      life: 0.35,
      maxLife: 0.35,
      color: '#e040fb',
      size: 3,
      type: 'spark'
    });
  }

  _spawnFrostParticle(x, y) {
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 20,
      vy: 15 + Math.random() * 25,
      life: 0.9,
      maxLife: 0.9,
      color: '#b2ebf2',
      size: 4 + Math.random() * 3,
      type: 'frost'
    });
  }

  _spawnIceShatter(x, y) {
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 60;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6,
        maxLife: 0.6,
        color: '#e0f7fa',
        size: 4,
        type: 'shatter'
      });
    }
  }

  _renderParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.type === 'butterfly') {
        // 작은 나비 실루엣
        ctx.beginPath();
        ctx.arc(p.x - 2, p.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.arc(p.x + 2, p.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'frost' || p.type === 'shatter') {
        // 다이아몬드/서리 결정
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.size);
        ctx.lineTo(p.x + p.size, p.y);
        ctx.lineTo(p.x, p.y + p.size);
        ctx.lineTo(p.x - p.size, p.y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}
