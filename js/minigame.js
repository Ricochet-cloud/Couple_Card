// 미니게임 보상 시스템
import { db } from './firebase.js';
import { doc, runTransaction, collection, addDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

// 상수: 게임 당 보상 수량
const MINIGAME_REWARD_AMOUNT = 1;
// 상수: 하루 보상 횟수 제한
const MINIGAME_REWARD_LIMIT_PER_DAY = 1;

/**
 * 오늘 날짜 (KST YYYY-MM-DD)
 */
function getTodayKST() {
  const now = new Date();
  const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().split('T')[0];
}

/**
 * 미니게임 클리어 시 보상 지급 (트랜잭션)
 * @param {string} gameId - 게임 ID
 * @returns {Object} { granted: boolean, message: string, tickets?: number }
 */
export async function grantMinigameReward(gameId) {
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
      const lastRewardDate = state.minigameRewardDate || null;

      // 2. 오늘 이미 받았는지 확인
      if (lastRewardDate === today) {
        return {
          granted: false,
          message: '오늘 보상은 이미 받았어요.',
        };
      }

      // 3. 트랜잭션 업데이트: 뽑기권 증가 + 보상 날짜 갱신
      const newTickets = (state.tickets || 0) + MINIGAME_REWARD_AMOUNT;
      transaction.update(stateRef, {
        tickets: newTickets,
        minigameRewardDate: today,
      });

      // 4. 보상 기록 저장을 위한 데이터 반환
      return {
        granted: true,
        message: `뽑기권 +${MINIGAME_REWARD_AMOUNT}`,
        tickets: newTickets,
        gameId,
        today,
      };
    });

    // 5. 보상 지급에 성공했으면 기록 저장
    if (result.granted) {
      try {
        await addDoc(collection(db, 'minigameRewards'), {
          date: result.today,
          gameId: result.gameId,
          amount: MINIGAME_REWARD_AMOUNT,
          grantedAt: Timestamp.now(),
        });
      } catch (recordError) {
        console.warn('보상 기록 저장 실패 (보상 자체는 성공):', recordError);
      }
    }

    return {
      granted: result.granted,
      message: result.message,
      tickets: result.tickets,
    };
  } catch (error) {
    console.error('미니게임 보상 지급 실패:', error);
    throw error;
  }
}

/**
 * 미니게임 보상 상수
 */
export const MINIGAME_CONSTANTS = {
  REWARD_AMOUNT: MINIGAME_REWARD_AMOUNT,
  REWARD_LIMIT_PER_DAY: MINIGAME_REWARD_LIMIT_PER_DAY,
};
