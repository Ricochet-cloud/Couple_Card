// 관리자의 선물: 관리자가 올려 두면 홈 화면에서 받을 수 있어요 (state/shared.gifts 배열)
//   gift = { id, message, tickets, specialTickets, dexNo, createdAt, claimedAt }  (claimedAt 이 null 이면 아직 안 받은 선물)
import { db } from './firebase.js';
import { doc, getDoc, runTransaction } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { getActiveCards } from './collection.js';

const STATE_REF = doc(db, 'state', 'shared');

function todayKST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/** 모든 선물 (오래된 순) */
export async function loadGifts() {
  const snap = await getDoc(STATE_REF);
  return snap.exists() ? snap.data().gifts || [] : [];
}

/** 선물 올리기 (관리자). tickets / specialTickets / dexNo 중 하나는 꼭 있어야 해요 */
export async function sendGift({ message = '', tickets = 0, specialTickets = 0, dexNo = null }) {
  tickets = Math.max(0, Math.floor(tickets) || 0);
  specialTickets = Math.max(0, Math.floor(specialTickets) || 0);
  dexNo = dexNo ? Math.floor(dexNo) : null;
  if (!tickets && !specialTickets && !dexNo) throw new Error('뽑기권이나 카드 중 하나는 정해 주세요.');

  if (dexNo) {
    const cards = await getActiveCards();
    if (!cards.some((c) => c.dexNo === dexNo)) throw new Error(`도감 번호 ${dexNo} 카드를 찾을 수 없어요.`);
  }

  const gift = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    message: String(message).trim().slice(0, 40),
    tickets,
    specialTickets,
    dexNo,
    createdAt: todayKST(),
    claimedAt: null,
  };
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(STATE_REF);
    if (!snap.exists()) throw new Error('게임 상태를 초기화해주세요.');
    tx.update(STATE_REF, { gifts: [...(snap.data().gifts || []), gift] });
  });
  return gift;
}

/** 아직 안 받은 선물만 지울 수 있어요 */
export async function deleteGift(id) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(STATE_REF);
    const gifts = snap.exists() ? snap.data().gifts || [] : [];
    const g = gifts.find((x) => x.id === id);
    if (!g) return;
    if (g.claimedAt) throw new Error('이미 받은 선물은 지울 수 없어요.');
    tx.update(STATE_REF, { gifts: gifts.filter((x) => x.id !== id) });
  });
}

/**
 * 선물 받기. 이미 받았으면 { already: true }
 * @returns {{already: boolean, card?: Object|null, isFirstTime?: boolean, tickets?: number, specialTickets?: number}}
 */
export async function claimGift(id) {
  const first = (await loadGifts()).find((x) => x.id === id);
  if (!first) throw new Error('선물을 찾을 수 없어요.');

  let reward = null;
  if (first.dexNo) {
    reward = (await getActiveCards()).find((c) => c.dexNo === first.dexNo);
    if (!reward) throw new Error(`선물 카드(No.${first.dexNo})를 찾을 수 없어요.`);
  }
  const today = todayKST();

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(STATE_REF);
    if (!snap.exists()) throw new Error('게임 상태를 초기화해주세요.');
    const state = snap.data();
    const gifts = state.gifts || [];
    const g = gifts.find((x) => x.id === id);
    if (!g || g.claimedAt) return { already: true };

    const updates = { gifts: gifts.map((x) => (x.id === id ? { ...x, claimedAt: today } : x)) };
    const result = { already: false, card: null, isFirstTime: false, tickets: g.tickets || 0, specialTickets: g.specialTickets || 0 };

    if (reward) {
      const owned = state.owned || {};
      const prev = owned[reward.id] || { count: 0, firstAt: null };
      owned[reward.id] = { count: prev.count + 1, firstAt: prev.firstAt || today };
      updates.owned = owned;
      result.card = { ...reward, isOwned: true, count: prev.count + 1 };
      result.isFirstTime = prev.count === 0;
    }
    if (g.tickets) updates.tickets = (state.tickets || 0) + g.tickets;
    if (g.specialTickets) updates.specialTickets = (state.specialTickets || 0) + g.specialTickets;

    tx.update(STATE_REF, updates);
    return result;
  });
}
