// 이벤트 로직: 진행 상황 불러오기 + 난이도별 보상 카드 지급
import { db } from './firebase.js';
import {
  doc,
  getDoc,
  runTransaction,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { getActiveCards } from './collection.js';
import { EVENT, todayKST, getLevelState, levelRewards } from './event-config.js';

const STATE_REF = doc(db, 'state', 'shared');

/**
 * @returns {{cards: Array, claimed: Object}} claimed: { EASY: '2026-11-02', ... }
 */
export async function loadEventData() {
  const [cards, snap] = await Promise.all([getActiveCards(), getDoc(STATE_REF)]);
  const state = snap.exists() ? snap.data() : {};
  const owned = state.owned || {};
  return {
    cards: cards.map((c) => ({
      ...c,
      isOwned: !!owned[c.id],
      count: owned[c.id]?.count || 0,
      firstAt: owned[c.id]?.firstAt || null,
    })),
    claimed: (state.events || {})[EVENT.id] || {},
  };
}

export function findLevel(key) {
  return EVENT.levels.find((l) => l.key === key) || null;
}

/**
 * 난이도 클리어 보상 받기. 이미 받았으면 { already: true }
 * @returns {{already: boolean, card?: Object|null, isFirstTime?: boolean, tickets?: number, specialTickets?: number}}
 */
export async function claimEventReward(levelKey) {
  const level = findLevel(levelKey);
  if (!level) throw new Error('알 수 없는 난이도예요.');
  if (getLevelState(level) !== 'open') throw new Error('아직 열리지 않았거나 끝난 난이도예요.');

  const rw = levelRewards(level);
  if (!rw.dexNo && !rw.tickets && !rw.specialTickets) throw new Error('이 난이도에는 보상이 정해져 있지 않아요.');

  let reward = null;
  if (rw.dexNo) {
    const cards = await getActiveCards();
    reward = cards.find((c) => c.dexNo === rw.dexNo);
    if (!reward) throw new Error(`보상 카드(No.${rw.dexNo})를 찾을 수 없어요.`);
  }

  const today = todayKST();

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(STATE_REF);
    if (!snap.exists()) throw new Error('게임 상태를 초기화해주세요.');

    const state = snap.data();
    const events = state.events || {};
    const mine = events[EVENT.id] || {};
    if (mine[levelKey]) return { already: true };

    const updates = { events: { ...events, [EVENT.id]: { ...mine, [levelKey]: today } } };
    const result = { already: false, card: null, isFirstTime: false, tickets: rw.tickets, specialTickets: rw.specialTickets };

    if (reward) {
      const owned = state.owned || {};
      const prev = owned[reward.id] || { count: 0, firstAt: null };
      owned[reward.id] = { count: prev.count + 1, firstAt: prev.firstAt || today };
      updates.owned = owned;
      result.card = { ...reward, isOwned: true, count: prev.count + 1, firstAt: owned[reward.id].firstAt };
      result.isFirstTime = prev.count === 0;
    }
    if (rw.tickets) updates.tickets = (state.tickets || 0) + rw.tickets;
    if (rw.specialTickets) updates.specialTickets = (state.specialTickets || 0) + rw.specialTickets;

    tx.update(STATE_REF, updates);
    return result;
  });
}
