// 뽑기권 자동 지급 (트랜잭션)
import { db } from './firebase.js';
import { doc, runTransaction, Timestamp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

/**
 * 오늘 날짜 (KST YYYY-MM-DD)
 */
function getTodayKST() {
  const now = new Date();
  const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000); // KST = UTC+9
  return kstDate.toISOString().split('T')[0];
}

/**
 * 하루 1장 자동 지급 (트랜잭션)
 * 여러 사용자가 동시에 접속해도 1장만 지급
 */
export async function grantDailyTicketIfNeeded() {
  const stateRef = doc(db, 'state', 'shared');
  const today = getTodayKST();

  try {
    await runTransaction(db, async (transaction) => {
      const stateDoc = await transaction.get(stateRef);

      if (!stateDoc.exists()) {
        // 처음 생성
        transaction.set(stateRef, {
          tickets: 1,
          lastGrantDate: today,
          owned: {},
          daily: null,
          usedMissionIds: [],
        });
        return { granted: true, today };
      }

      const data = stateDoc.data();
      const lastGrantDate = data.lastGrantDate || null;

      if (lastGrantDate !== today) {
        // 오늘 지급 안 됨 → 1장 지급
        transaction.update(stateRef, {
          tickets: (data.tickets || 0) + 1,
          lastGrantDate: today,
        });
        return { granted: true, today };
      }

      // 이미 지급됨
      return { granted: false, today };
    });
  } catch (error) {
    console.error('뽑기권 자동 지급 실패:', error);
    throw error;
  }
}

/**
 * 현재 뽑기권 수 조회
 */
export async function getTickets() {
  try {
    const { getDoc } = await import(
      'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js'
    );
    const snapshot = await getDoc(doc(db, 'state', 'shared'));
    if (snapshot.exists()) {
      return snapshot.data().tickets || 0;
    }
    return 0;
  } catch (error) {
    console.error('뽑기권 조회 실패:', error);
    throw error;
  }
}
