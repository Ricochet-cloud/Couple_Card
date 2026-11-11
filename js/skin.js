// 상점에서 산 테마·일러스트를 카드에 입히는 모듈
// state/shared.themeOverrides = { [cardId]: themeKey }   (있으면 카드 원래 theme 대신 이 값을 써요)
// state/shared.photoOverrides = { [cardId]: 상품id }      (산 일러스트를 카드 사진 대신 써요)
import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

const imageCache = new Map();   // 상품id → 일러스트 이미지 (한 번만 불러와요)

async function illustImage(itemId) {
  if (!imageCache.has(itemId)) {
    const snap = await getDoc(doc(db, 'shop', itemId));
    imageCache.set(itemId, snap.exists() ? snap.data().imageData || null : null);
  }
  return imageCache.get(itemId);
}

/** 카드 배열에 입힌 테마·일러스트를 반영해서 돌려줘요 (실패하면 원래 카드 그대로) */
export async function applySkins(cards) {
  try {
    const snap = await getDoc(doc(db, 'state', 'shared'));
    const data = snap.exists() ? snap.data() : {};
    const skins = data.themeOverrides || {};
    const photos = data.photoOverrides || {};
    const ids = [...new Set(cards.map((c) => photos[c.id]).filter(Boolean))];
    await Promise.all(ids.map((id) => illustImage(id).catch(() => null)));
    return cards.map((c) => {
      const out = { ...c };
      if (skins[c.id]) { out.theme = skins[c.id]; out.baseTheme = c.theme || null; }
      const img = photos[c.id] && imageCache.get(photos[c.id]);
      if (img) out.photoData = img;
      return out;
    });
  } catch (error) {
    console.error('테마 반영 실패:', error);
    return cards;
  }
}
