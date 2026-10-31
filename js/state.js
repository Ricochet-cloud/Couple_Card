// Firestore 공유 상태 관리
import { db } from './firebase.js';
import { doc, getDoc, setDoc, updateDoc, increment } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

const STATE_DOC = doc(db, 'state', 'shared');

/**
 * state/shared 문서가 없으면 생성
 */
export async function initState() {
  try {
    const snapshot = await getDoc(STATE_DOC);
    if (!snapshot.exists()) {
      await setDoc(STATE_DOC, {
        tickets: 0,
        lastGrantDate: null,
        owned: {},
        daily: null,
        usedMissionIds: [],
        minigameRewardDate: null,
      });
    }
  } catch (error) {
    console.error('상태 초기화 실패:', error);
    throw error;
  }
}

/**
 * 현재 뽑기권 수 조회
 */
export async function getTickets() {
  try {
    const snapshot = await getDoc(STATE_DOC);
    if (snapshot.exists()) {
      return snapshot.data().tickets || 0;
    }
    return 0;
  } catch (error) {
    console.error('뽑기권 조회 실패:', error);
    throw error;
  }
}

/**
 * 뽑기권 증가 (관리자 지급용)
 * @param {number} amount - 지급할 수량
 */
export async function addTickets(amount) {
  try {
    await updateDoc(STATE_DOC, {
      tickets: increment(amount),
    });
  } catch (error) {
    console.error('뽑기권 증가 실패:', error);
    throw error;
  }
}

/**
 * 뽑기권 감소 (뽑기용)
 * @param {number} amount - 사용할 수량
 */
export async function subtractTickets(amount) {
  try {
    await updateDoc(STATE_DOC, {
      tickets: increment(-amount),
    });
  } catch (error) {
    console.error('뽑기권 감소 실패:', error);
    throw error;
  }
}

/**
 * 현재 특별 뽑기권 수 조회 (안 가진 카드만 나오는 뽑기권)
 */
export async function getSpecialTickets() {
  try {
    const snapshot = await getDoc(STATE_DOC);
    return snapshot.exists() ? snapshot.data().specialTickets || 0 : 0;
  } catch (error) {
    console.error('특별 뽑기권 조회 실패:', error);
    throw error;
  }
}

/**
 * 특별 뽑기권 지급 (관리자용)
 * @param {number} amount - 지급할 수량
 */
export async function addSpecialTickets(amount) {
  try {
    await updateDoc(STATE_DOC, {
      specialTickets: increment(amount),
    });
  } catch (error) {
    console.error('특별 뽑기권 지급 실패:', error);
    throw error;
  }
}
