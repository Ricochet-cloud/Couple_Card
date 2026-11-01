// 메타몽처럼 변신하는 카드: 울렁울렁 흔들리다가 다른 카드 모습으로 바뀌어요.
// 카드 데이터의 disguiseDexNo(숫자)가 있으면 '변신 카드'예요.
import { renderCard } from './card.js';

const WOBBLE_MS = 900;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isShapeshifter = (card) => Number.isFinite(card?.disguiseDexNo);

/** 카드 요소를 그대로 둔 채 내용만 다른 카드로 바꿔요 (기울이기 효과 등은 유지) */
function paintFace(el, card) {
  const tmp = document.createElement('div');
  tmp.innerHTML = renderCard(card);
  const next = tmp.firstElementChild;
  const keep = ['tilt', 'card--wobble'].filter((c) => el.classList.contains(c));
  el.className = [next.className, ...keep].join(' ');
  el.setAttribute('data-rarity', next.getAttribute('data-rarity'));
  el.setAttribute('style', next.getAttribute('style') || '');
  el.innerHTML = next.innerHTML;
}

/** 울렁울렁 → 흔들림이 가장 클 때 모습을 바꿔요. 끝나면 resolve */
export function wobbleInto(el, card) {
  if (reduced()) {
    paintFace(el, card);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    el.classList.remove('card--wobble');
    void el.offsetWidth; // 애니메이션 재시작
    el.classList.add('card--wobble');
    setTimeout(() => paintFace(el, card), WOBBLE_MS * 0.5);
    setTimeout(() => {
      el.classList.remove('card--wobble');
      resolve();
    }, WOBBLE_MS);
  });
}

/** 가지고 있는 카드 중 현재 모습과 다른 카드를 무작위로 골라요 */
export function pickRandomOwned(cards, excludeIds = []) {
  const pool = cards.filter((c) => c.isOwned && !excludeIds.includes(c.id));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
