// 상점: 중복 카드를 팔아 포인트를 모으고, 포인트로 테마·일러스트·카드를 사요
//
// state/shared 에 추가되는 필드
//   points         : 보유 포인트
//   purchases      : { [상품id]: { at, type, theme? } }   (테마·일러스트는 한 번만 살 수 있어요)
//   themeOverrides : { [cardId]: themeKey }                (산 테마를 입힌 카드)
//   photoOverrides : { [cardId]: 상품id }                  (산 일러스트를 사진으로 끼운 카드)
// shop 컬렉션 (관리자만 쓰기)
//   { name, desc, type: 'theme'|'illust'|'card', price, theme?, dexNo?, imageData?, active, createdAt }
import { db } from './firebase.js';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  runTransaction,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { getActiveCards } from './collection.js';

const STATE_REF = doc(db, 'state', 'shared');

/** 카드 1장을 팔 때 받는 포인트. 여기 없는 등급(히든)은 못 팔아요 */
export const SELL_POINTS = { rare: 1, superrare: 2, hero: 4, myth: 8, legend: 15, ultra: 30 };

export const sellValue = (rarity) => SELL_POINTS[rarity] || 0;

function todayKST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/** 포인트·구매 기록·입힌 테마·보유 카드 */
export async function getShopState() {
  const snap = await getDoc(STATE_REF);
  const d = snap.exists() ? snap.data() : {};
  return {
    points: d.points || 0,
    purchases: d.purchases || {},
    themeOverrides: d.themeOverrides || {},
    photoOverrides: d.photoOverrides || {},
    owned: d.owned || {},
  };
}

// ---------- 상품 (shop 컬렉션) ----------

/** 상품 목록. 판매 중인 것만 보려면 { onlyActive: true } */
export async function loadShopItems({ onlyActive = false } = {}) {
  const snap = await getDocs(collection(db, 'shop'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((i) => !onlyActive || i.active)
    .sort((a, b) => (a.price || 0) - (b.price || 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
}

/** 상품 등록 (관리자) */
export async function addShopItem({ name, desc = '', type, price, theme = null, dexNo = null, imageData = null }) {
  name = String(name || '').trim();
  price = Math.floor(price);
  if (!name) throw new Error('상품 이름을 입력해 주세요.');
  if (!(price > 0)) throw new Error('가격은 1 이상이어야 해요.');
  if (!['theme', 'illust', 'card'].includes(type)) throw new Error('상품 종류를 골라 주세요.');
  if (type === 'theme' && !theme) throw new Error('판매할 테마를 골라 주세요.');
  if (type === 'illust' && !imageData) throw new Error('일러스트 이미지를 올려 주세요.');
  if (type === 'card') {
    dexNo = Math.floor(dexNo);
    const cards = await getActiveCards();
    if (!cards.some((c) => c.dexNo === dexNo)) throw new Error(`도감 번호 ${dexNo} 카드를 찾을 수 없어요.`);
  }
  const item = {
    name: name.slice(0, 30),
    desc: String(desc).trim().slice(0, 80),
    type,
    price,
    theme: type === 'theme' ? theme : null,
    dexNo: type === 'card' ? dexNo : null,
    imageData: type === 'illust' ? imageData : null,
    active: true,
    createdAt: todayKST(),
  };
  const ref = await addDoc(collection(db, 'shop'), item);
  return { id: ref.id, ...item };
}

export const updateShopItem = (id, fields) => updateDoc(doc(db, 'shop', id), fields);
export const deleteShopItem = (id) => deleteDoc(doc(db, 'shop', id));

// ---------- 카드 팔기 ----------

/**
 * 중복 카드 팔기. 1장은 꼭 남겨요 (남는 장수만 팔 수 있어요)
 * @returns {{sold: number, gained: number, points: number}}
 */
export async function sellCards(cardId, count) {
  count = Math.floor(count);
  if (!(count > 0)) throw new Error('팔 장수를 정해 주세요.');
  const cardSnap = await getDoc(doc(db, 'cards', cardId));
  if (!cardSnap.exists()) throw new Error('카드를 찾을 수 없어요.');
  const value = sellValue(cardSnap.data().rarity);
  if (!value) throw new Error('이 카드는 팔 수 없어요.');

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(STATE_REF);
    if (!snap.exists()) throw new Error('게임 상태를 초기화해주세요.');
    const state = snap.data();
    const owned = state.owned || {};
    const have = owned[cardId]?.count || 0;
    if (have - count < 1) throw new Error('남는 카드가 부족해요. (1장은 남겨야 해요)');

    owned[cardId] = { ...owned[cardId], count: have - count };
    const points = (state.points || 0) + value * count;
    tx.update(STATE_REF, { owned, points });
    return { sold: count, gained: value * count, points };
  });
}

// ---------- 사기 ----------

/**
 * 상품 사기. 테마·일러스트는 이미 샀으면 못 사요. 카드는 여러 번 살 수 있어요.
 * @returns {{item: Object, card?: Object, isFirstTime?: boolean, points: number}}
 */
export async function buyItem(itemId) {
  const itemSnap = await getDoc(doc(db, 'shop', itemId));
  if (!itemSnap.exists() || !itemSnap.data().active) throw new Error('지금은 팔지 않는 상품이에요.');
  const item = { id: itemId, ...itemSnap.data() };

  let reward = null;
  if (item.type === 'card') {
    reward = (await getActiveCards()).find((c) => c.dexNo === item.dexNo);
    if (!reward) throw new Error(`상품 카드(No.${item.dexNo})를 찾을 수 없어요.`);
  }
  const today = todayKST();

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(STATE_REF);
    if (!snap.exists()) throw new Error('게임 상태를 초기화해주세요.');
    const state = snap.data();
    if ((state.points || 0) < item.price) throw new Error('포인트가 부족해요.');

    const updates = { points: (state.points || 0) - item.price };
    const result = { item, points: updates.points };

    if (item.type === 'card') {
      const owned = state.owned || {};
      const prev = owned[reward.id] || { count: 0, firstAt: null };
      owned[reward.id] = { count: prev.count + 1, firstAt: prev.firstAt || today };
      updates.owned = owned;
      result.card = { ...reward, isOwned: true, count: prev.count + 1 };
      result.isFirstTime = prev.count === 0;
    } else {
      const purchases = state.purchases || {};
      if (purchases[item.id]) throw new Error('이미 가진 상품이에요.');
      purchases[item.id] = { at: today, type: item.type, ...(item.type === 'theme' ? { theme: item.theme } : {}) };
      updates.purchases = purchases;
    }
    tx.update(STATE_REF, updates);
    return result;
  });
}

// ---------- 테마 입히기 ----------

/** 산 테마를 카드에 입혀요. theme 이 null 이면 원래 모습으로 되돌려요 */
export async function setCardTheme(cardId, theme) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(STATE_REF);
    if (!snap.exists()) throw new Error('게임 상태를 초기화해주세요.');
    const state = snap.data();
    if (!state.owned?.[cardId]) throw new Error('가진 카드에만 입힐 수 있어요.');
    const skins = { ...(state.themeOverrides || {}) };
    if (theme) {
      const bought = Object.values(state.purchases || {}).some((p) => p.type === 'theme' && p.theme === theme);
      if (!bought) throw new Error('아직 사지 않은 테마예요.');
      skins[cardId] = theme;
    } else {
      delete skins[cardId];
    }
    tx.update(STATE_REF, { themeOverrides: skins });
  });
}

// ---------- 일러스트 끼우기 ----------

/** 산 일러스트를 카드 사진으로 끼워요. itemId 가 null 이면 원래 사진으로 되돌려요 */
export async function setCardPhoto(cardId, itemId) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(STATE_REF);
    if (!snap.exists()) throw new Error('게임 상태를 초기화해주세요.');
    const state = snap.data();
    if (!state.owned?.[cardId]) throw new Error('가진 카드에만 끼울 수 있어요.');
    const photos = { ...(state.photoOverrides || {}) };
    if (itemId) {
      if (state.purchases?.[itemId]?.type !== 'illust') throw new Error('아직 사지 않은 일러스트예요.');
      photos[cardId] = itemId;
    } else {
      delete photos[cardId];
    }
    tx.update(STATE_REF, { photoOverrides: photos });
  });
}
