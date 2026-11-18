// 활성 카드 목록 불러오기 (캐시 포함)
// 카드 사진이 카드 문서 안에 base64 로 들어 있어서, 목록을 읽을 때마다 사진이 전부 내려와요.
// 그래서 한 번 받은 목록을 이렇게 재사용해요:
//   1) 같은 페이지 안에서는 메모리에 둬요 (홈에서 두 번 부르던 것이 한 번으로).
//   2) 다른 페이지로 가도 IndexedDB 에 남겨 둬요. 카드를 고치면 state/shared.cardsVersion 이 바뀌어서 그때만 다시 받아요.
//   3) 혹시 버전이 안 바뀌는 경로(파이어베이스 콘솔에서 직접 수정 등)로 고쳤더라도 MAX_AGE_MS 가 지나면 다시 받아요.
// 캐시가 안 되는 환경(시크릿 창 등)이면 예전처럼 매번 서버에서 받아요. 캐시 때문에 실패하는 일은 없게 했어요.
import { db } from './firebase.js';
import {
  collection, getDocs, query, where, doc, getDoc, updateDoc, Timestamp,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { applySkins } from './skin.js';

const USE_PERSISTENT_CACHE = true;            // false 로 바꾸면 페이지 간 캐시를 끄고 메모리 캐시만 써요
const MAX_AGE_MS = 6 * 60 * 60 * 1000;        // 6시간
const IDB_TIMEOUT_MS = 1500;                  // 캐시가 느리면 기다리지 않고 서버에서 받아요
const IDB_NAME = 'couplecard-cache';
const IDB_STORE = 'kv';
const IDB_KEY = 'activeCards';

const STATE_REF = doc(db, 'state', 'shared');
const memo = { version: null, promise: null };

// ---------- IndexedDB (실패하면 조용히 null) ----------

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, () => { clearTimeout(timer); resolve(null); });
  });
}

function openIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('indexedDB 없음'));
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('indexedDB blocked'));
  });
}

async function idbRead() {
  if (!USE_PERSISTENT_CACHE) return null;
  return withTimeout((async () => {
    const idb = await openIdb();
    try {
      return await new Promise((resolve, reject) => {
        const req = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } finally { idb.close(); }
  })(), IDB_TIMEOUT_MS);
}

async function idbWrite(value) {
  if (!USE_PERSISTENT_CACHE) return;
  await withTimeout((async () => {
    const idb = await openIdb();
    try {
      await new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally { idb.close(); }
  })(), IDB_TIMEOUT_MS * 3);
}

// Timestamp 는 IndexedDB 에 그대로 넣으면 메서드(toDate 등)가 사라져서, 숫자로 바꿔 담았다가 되돌려요.
function encodeCards(cards) {
  return cards.map((c) => {
    const out = {};
    for (const [k, v] of Object.entries(c)) {
      out[k] = v && typeof v.toMillis === 'function' && 'seconds' in v ? { __ts: [v.seconds, v.nanoseconds] } : v;
    }
    return out;
  });
}

function decodeCards(rows) {
  return rows.map((c) => {
    const out = {};
    for (const [k, v] of Object.entries(c)) {
      out[k] = v && typeof v === 'object' && Array.isArray(v.__ts) ? new Timestamp(v.__ts[0], v.__ts[1]) : v;
    }
    return out;
  });
}

// version 이 'unknown' 이면 state/shared 를 못 읽은 상황(오프라인 등)이라, 버전·시간과 상관없이 남아 있는 캐시를 써요.
function isValidCache(cached, version) {
  if (!cached || !Array.isArray(cached.cards) || cached.cards.length === 0) return false;
  if (!cached.cards.every((c) => c && typeof c.id === 'string' && Number.isFinite(c.dexNo))) return false;
  if (version === 'unknown') return true;
  if (cached.version !== version) return false;
  return typeof cached.savedAt === 'number' && Date.now() - cached.savedAt >= 0 && Date.now() - cached.savedAt < MAX_AGE_MS;
}

// ---------- 서버에서 받기 ----------

async function fetchFromServer() {
  const snapshot = await getDocs(query(collection(db, 'cards'), where('active', '==', true)));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadRaw(version) {
  if (memo.promise && memo.version === version) return memo.promise;
  memo.version = version;
  memo.promise = (async () => {
    const cached = await idbRead();
    if (isValidCache(cached, version)) {
      try { return decodeCards(cached.cards); } catch (e) { /* 깨진 캐시는 무시하고 서버에서 받아요 */ }
    }
    const cards = await fetchFromServer();
    if (version !== 'unknown') idbWrite({ version, savedAt: Date.now(), cards: encodeCards(cards) }).catch(() => {});
    return cards;
  })();
  // 실패한 결과는 붙잡아 두지 않아요 (다음에 다시 시도)
  memo.promise.catch(() => { if (memo.version === version) { memo.promise = null; } });
  return memo.promise;
}

/**
 * 활성 카드 전체 (상점에서 산 테마·일러스트까지 입혀서). 순서는 서버가 준 그대로예요.
 * 매번 새 배열·새 카드 객체를 돌려줘서 받은 쪽에서 고쳐 써도 캐시는 안 망가져요.
 */
export async function loadActiveCards() {
  // state/shared 한 번으로 '카드 버전'과 '스킨 정보'를 같이 얻어요 (예전에도 스킨 때문에 매번 읽던 문서예요)
  let stateData = null;
  try {
    const snap = await getDoc(STATE_REF);
    stateData = snap.exists() ? snap.data() : {};
  } catch (error) {
    console.error('상태 조회 실패:', error);
  }
  const version = stateData ? String(stateData.cardsVersion ?? 0) : 'unknown';
  const raw = await loadRaw(version);
  const cards = raw.map((c) => ({ ...c }));
  return applySkins(cards, stateData);
}

/** 관리자가 카드를 추가·수정·삭제했을 때 불러요. 다른 기기가 다음에 열 때 카드 목록을 새로 받아요. */
export async function bumpCardsVersion() {
  try {
    await updateDoc(STATE_REF, { cardsVersion: Date.now() });
    memo.promise = null;
  } catch (error) {
    console.warn('카드 버전 갱신 실패 (다른 기기는 최대 6시간 뒤에 새 카드를 봐요):', error);
  }
}
