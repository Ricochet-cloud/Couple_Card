// 카드 기울이기 + 반짝임 효과 (마우스/터치 공용)
// 사용법: initTilt(document.querySelector('.card'))
// 카드 위의 포인터 위치를 CSS 변수(--rx, --ry, --mx, --my, --glare)로 넘기면
// 실제 모양은 css/card.css 의 .tilt 규칙이 그려요.

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * @param {HTMLElement|null} card - .card 요소
 * @param {number} [max=12] - 최대 기울기(도)
 */
export function initTilt(card, max = 12) {
  if (!card || reduced || card.classList.contains('card--locked')) return;

  card.classList.add('tilt');
  let raf = 0;
  let px = 0.5;
  let py = 0.5;

  const paint = () => {
    raf = 0;
    // 1차 함수: 위치(0~1) → 각도(-max ~ +max)
    card.style.setProperty('--ry', `${((px - 0.5) * 2 * max).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${((0.5 - py) * 2 * max).toFixed(2)}deg`);
    card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    card.style.setProperty('--glare', '1');
  };

  const move = (e) => {
    const r = card.getBoundingClientRect();
    px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    card.classList.add('is-active');
    if (!raf) raf = requestAnimationFrame(paint); // 프레임당 1번만 갱신
  };

  const reset = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    card.classList.remove('is-active');
    for (const v of ['--rx', '--ry', '--mx', '--my', '--glare']) card.style.removeProperty(v);
  };

  card.addEventListener('pointermove', move);
  card.addEventListener('pointerdown', move);
  card.addEventListener('pointerleave', reset);
  card.addEventListener('pointercancel', reset);
}
