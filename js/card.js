// 카드 렌더링 모듈

// 등급: 키, 한글 라벨, 확률 가중치
export const RARITY = {
  ultra: { label: '울트라', weight: 2 },
  legend: { label: '전설', weight: 5 },
  myth: { label: '신화', weight: 8 },
  hero: { label: '영웅', weight: 15 },
  superrare: { label: '초희귀', weight: 30 },
  rare: { label: '희귀', weight: 40 },
};

// HTML 이스케이프 (XSS 방지)
function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}

// 숫자를 0으로 패딩 (No.001 형식)
function padNo(n) {
  return String(n).padStart(3, '0');
}

/**
 * 카드 HTML 생성
 * @param {Object} card - { dexNo, title, description, photoData, rarity, category, memoryDate }
 * @param {number} card.dexNo - 도감 번호
 * @param {string} card.title - 카드 제목
 * @param {string} card.description - 설명
 * @param {string} [card.photoData] - base64 이미지 (없으면 그라데이션)
 * @param {string} card.rarity - 등급 키 (ultra/legend/myth/hero/superrare/rare)
 * @param {string} card.category - 분류
 * @param {string} card.memoryDate - 추억 날짜 (YYYY-MM-DD)
 * @param {number} [card.hue] - 사진 없을 때 그라데이션 색상 (기본 30)
 * @returns {string} 카드 HTML
 */
export function renderCard(card) {
  const {
    dexNo,
    title,
    description,
    photoData,
    rarity,
    category,
    memoryDate,
    hue = 30,
  } = card;

  const photoHtml = photoData
    ? `<img src="${photoData}" alt="${escapeHtml(title)}">`
    : '';

  return `<article class="card" data-rarity="${escapeHtml(rarity)}" style="--h:${hue}">
    <div class="card__in">
      <div class="card__photo">${photoHtml}<span class="card__no">No.${padNo(dexNo)}</span></div>
      <div class="card__body">
        <span class="card__badge">${escapeHtml(RARITY[rarity]?.label || '?')}</span>
        <h3 class="card__title">${escapeHtml(title)}</h3>
        <p class="card__desc">${escapeHtml(description)}</p>
        <div class="card__meta">${escapeHtml(category)} · ${escapeHtml(memoryDate)}</div>
      </div>
    </div>
  </article>`;
}

/**
 * 미보유 카드(실루엣) HTML 생성
 * @param {number} dexNo - 도감 번호
 * @returns {string} 미보유 카드 HTML
 */
export function renderLockedCard(dexNo) {
  return `<article class="card card--locked" style="--h:0" aria-label="미보유 카드">
    <div class="card__in">
      <div class="card__photo"><span class="card__no">No.${padNo(dexNo)}</span></div>
      <div class="card__body">
        <h3 class="card__title">???</h3>
        <div class="card__meta">아직 못 뽑았어요</div>
      </div>
    </div>
  </article>`;
}

/**
 * 등급에 따라 랜덤으로 뽑기 (무게 기반)
 * @returns {string} 선택된 등급 키
 */
export function pickRarity() {
  let r = Math.random() * 100;
  for (const [key, { weight }] of Object.entries(RARITY)) {
    if ((r -= weight) < 0) return key;
  }
  return 'rare';
}
