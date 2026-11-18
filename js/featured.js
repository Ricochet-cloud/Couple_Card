// 대표 카드: 도감에서 하나 골라 두면 홈에 크게 보여요. 두 사람이 같이 쓰는 값이라 state/shared 에 카드 id 하나만 저장해요.
import { db } from './firebase.js';
import { doc, getDoc, updateDoc, deleteField } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

const STATE_REF = doc(db, 'state', 'shared');

/** 대표 카드 id (없거나 못 읽으면 null) */
export async function getFeaturedId() {
  try {
    const snap = await getDoc(STATE_REF);
    return snap.exists() ? snap.data().featuredCardId || null : null;
  } catch (error) {
    console.warn('대표 카드 조회 실패:', error);
    return null;
  }
}

/** 대표 카드 지정 (null 이면 해제) */
export async function setFeaturedId(cardId) {
  await updateDoc(STATE_REF, { featuredCardId: cardId || deleteField() });
}
