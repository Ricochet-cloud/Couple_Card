// 뽑기 시스템
import { db } from './firebase.js';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  runTransaction,
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { RARITY } from './card.js';

/**
 * 오늘 날짜 (KST YYYY-MM-DD)
 */
function getTodayKST() {
  const now = new Date();
  const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().split('T')[0];
}

/**
 * 활성 카드 모두 조회
 */
export async function getActiveCards() {
  try {
    const snapshot = await getDocs(query(collection(db, 'cards'), where('active', '==', true)));
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('카드 조회 실패:', error);
    throw error;
  }
}

/**
 * 뽑기: 등급 추첨 (가중치 기반)
 * @param {Array} cards - 활성 카드 배열
 * @returns {string} 선택된 등급
 */
export function pickRarity(cards) {
  // 각 등급별 가중치
  const rarityWeights = {
    ultra: 2,
    legend: 5,
    myth: 8,
    hero: 15,
    superrare: 30,
    rare: 40,
  };

  // 해당 등급에 카드가 있는지 확인
  const availableRarities = Object.entries(rarityWeights).filter(([rarity]) => {
    return cards.some((c) => c.rarity === rarity);
  });

  if (availableRarities.length === 0) {
    throw new Error('활성 카드가 없습니다.');
  }

  // 가중치 합계 계산
  let totalWeight = 0;
  availableRarities.forEach(([, weight]) => {
    totalWeight += weight;
  });

  // 랜덤 추첨
  let random = Math.random() * totalWeight;
  for (const [rarity, weight] of availableRarities) {
    random -= weight;
    if (random < 0) return rarity;
  }

  return availableRarities[availableRarities.length - 1][0];
}

/**
 * 카드 뽑기 (트랜잭션)
 * @returns { cardId, card, isFirstTime }
 */
export async function drawCard() {
  const stateRef = doc(db, 'state', 'shared');
  const today = getTodayKST();

  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. state/shared 읽기
      const stateDoc = await transaction.get(stateRef);
      if (!stateDoc.exists()) {
        throw new Error('게임 상태를 초기화해주세요.');
      }

      const state = stateDoc.data();
      const tickets = state.tickets || 0;

      if (tickets <= 0) {
        throw new Error('뽑기권이 없습니다.');
      }

      // 2. 활성 카드 조회
      const cards = await getActiveCards();
      if (cards.length === 0) {
        throw new Error('뽑을 수 있는 카드가 없습니다.');
      }

      // 3. 등급 추첨
      const selectedRarity = pickRarity(cards);
      const cardsOfRarity = cards.filter((c) => c.rarity === selectedRarity);
      const selectedCard = cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];

      // 4. 보유 정보 업데이트
      const owned = state.owned || {};
      const cardOwned = owned[selectedCard.id] || { count: 0, firstAt: null };
      const isFirstTime = cardOwned.count === 0;

      owned[selectedCard.id] = {
        count: cardOwned.count + 1,
        firstAt: cardOwned.firstAt || today,
      };

      // 5. 트랜잭션 업데이트
      transaction.update(stateRef, {
        tickets: tickets - 1,
        owned: owned,
      });

      return {
        cardId: selectedCard.id,
        card: selectedCard,
        isFirstTime: isFirstTime,
      };
    });

    return result;
  } catch (error) {
    console.error('뽑기 실패:', error);
    throw error;
  }
}

/**
 * 뽑기 확률 검증용 시뮬레이션 (Firestore 쓰기 없음)
 * @param {number} iterations - 시뮬레이션 횟수 (기본 1000)
 */
export async function simulateGacha(iterations = 1000) {
  try {
    const cards = await getActiveCards();

    if (cards.length === 0) {
      console.log('시뮬레이션: 활성 카드가 없습니다.');
      return;
    }

    const results = {
      ultra: 0,
      legend: 0,
      myth: 0,
      hero: 0,
      superrare: 0,
      rare: 0,
    };

    for (let i = 0; i < iterations; i++) {
      const rarity = pickRarity(cards);
      results[rarity]++;
    }

    console.log(`\n🎰 뽑기 확률 시뮬레이션 (${iterations}회)\n`);
    Object.entries(results).forEach(([rarity, count]) => {
      const percent = ((count / iterations) * 100).toFixed(2);
      const expected = (
        (RARITY[rarity].weight /
          Object.values(RARITY).reduce((sum, r) => sum + r.weight, 0)) *
        100
      ).toFixed(2);
      console.log(
        `${RARITY[rarity].label}: ${count}회 (${percent}%) [기댓값: ${expected}%]`
      );
    });
  } catch (error) {
    console.error('시뮬레이션 실패:', error);
  }
}

// 글로벌 함수로 등록 (콘솔에서 호출 가능)
if (typeof window !== 'undefined') {
  window.simulateGacha = simulateGacha;
}
