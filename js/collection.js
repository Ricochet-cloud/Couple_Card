// 도감 페이지 로직
import { db } from './firebase.js';
import { collection, getDocs, query, where, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { RARITY } from './card.js';

/**
 * 모든 활성 카드 조회 (번호순)
 */
export async function getActiveCards() {
  try {
    const snapshot = await getDocs(query(collection(db, 'cards'), where('active', '==', true)));
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => a.dexNo - b.dexNo);
  } catch (error) {
    console.error('카드 조회 실패:', error);
    throw error;
  }
}

/**
 * state/shared.owned 조회
 */
export async function getOwnedCards() {
  try {
    const snapshot = await getDoc(doc(db, 'state', 'shared'));
    if (snapshot.exists()) {
      return snapshot.data().owned || {};
    }
    return {};
  } catch (error) {
    console.error('소유 카드 조회 실패:', error);
    throw error;
  }
}

/**
 * 카드별 소유 정보
 */
export async function getCardWithOwned(card) {
  const owned = await getOwnedCards();
  const ownedInfo = owned[card.id] || null;
  return {
    ...card,
    isOwned: !!ownedInfo,
    count: ownedInfo?.count || 0,
    firstAt: ownedInfo?.firstAt || null,
  };
}

/**
 * 모든 카드 + 소유 정보
 */
export async function getCollectionData() {
  const cards = await getActiveCards();
  const owned = await getOwnedCards();

  return cards.map((card) => {
    const ownedInfo = owned[card.id] || null;
    return {
      ...card,
      isOwned: !!ownedInfo,
      count: ownedInfo?.count || 0,
      firstAt: ownedInfo?.firstAt || null,
    };
  });
}

/**
 * 수집 통계
 */
export function getCollectionStats(cards) {
  // 히든 카드는 수집률에 넣지 않아요 (일반 카드만으로 100% 가능)
  const normal = cards.filter((c) => c.rarity !== 'hidden');
  const total = normal.length;
  const owned = normal.filter((c) => c.isOwned).length;

  const rarityStats = {};
  for (const [key, value] of Object.entries(RARITY)) {
    if (key === 'hidden') continue;
    rarityStats[key] = {
      label: value.label,
      total: normal.filter((c) => c.rarity === key).length,
      owned: normal.filter((c) => c.rarity === key && c.isOwned).length,
    };
  }

  // 히든은 얻은 뒤에만 보여주고, 전체 장수는 비밀이라 total 을 null 로 둬요
  const hiddenOwned = cards.filter((c) => c.rarity === 'hidden' && c.isOwned).length;
  if (hiddenOwned > 0) {
    rarityStats.hidden = { label: RARITY.hidden.label, total: null, owned: hiddenOwned };
  }

  return { total, owned, rarityStats };
}

/**
 * 필터링 & 정렬
 */
export function filterAndSortCards(cards, filters, sortBy) {
  // 아직 못 얻은 히든 카드는 도감에서 숨겨요
  let result = cards.filter((c) => !(c.rarity === 'hidden' && !c.isOwned));

  // 등급 필터
  if (filters.rarity && filters.rarity !== 'all') {
    result = result.filter((c) => c.rarity === filters.rarity);
  }

  // 분류 필터
  if (filters.category && filters.category !== 'all') {
    result = result.filter((c) => c.category === filters.category);
  }

  // 보유 상태 필터
  if (filters.owned === 'owned') {
    result = result.filter((c) => c.isOwned);
  } else if (filters.owned === 'notOwned') {
    result = result.filter((c) => !c.isOwned);
  }

  // 정렬
  if (sortBy === 'number') {
    result.sort((a, b) => a.dexNo - b.dexNo);
  } else if (sortBy === 'recent') {
    result.sort((a, b) => {
      const aDate = a.firstAt ? new Date(a.firstAt) : new Date(0);
      const bDate = b.firstAt ? new Date(b.firstAt) : new Date(0);
      return bDate - aDate;
    });
  }

  return result;
}

/**
 * 분류 목록 추출
 */
export function getCategories(cards) {
  const visible = cards.filter((c) => !(c.rarity === 'hidden' && !c.isOwned)); // 숨긴 히든 카드의 분류는 노출 금지
  const categories = new Set(visible.map((c) => c.category).filter(Boolean));
  return Array.from(categories).sort();
}
