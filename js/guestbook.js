// 방명록 (오늘 글만 보여줌, 하루 지나면 목록에서 사라짐)
import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

export const MAX_TEXT = 100;
export const MAX_NICK = 10;

/** 오늘 날짜 (KST YYYY-MM-DD) */
function getTodayKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

/** 오늘 작성된 방명록 (오래된 글이 위, 최신 글이 아래) */
export async function getTodayEntries() {
  const snapshot = await getDocs(query(collection(db, 'guestbook'), where('date', '==', getTodayKST())));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.createdAt?.toMillis?.() ?? Date.now()) - (b.createdAt?.toMillis?.() ?? Date.now()));
}

/** 방명록 글 남기기 */
export async function addEntry(nickname, text) {
  const nick = nickname.trim();
  const body = text.trim();
  if (!nick) throw new Error('닉네임을 입력해주세요.');
  if (nick.length > MAX_NICK) throw new Error(`닉네임은 ${MAX_NICK}자까지예요.`);
  if (!body) throw new Error('내용을 입력해주세요.');
  if (body.length > MAX_TEXT) throw new Error(`내용은 ${MAX_TEXT}자까지예요.`);

  await addDoc(collection(db, 'guestbook'), {
    nickname: nick,
    text: body,
    date: getTodayKST(),
    createdAt: serverTimestamp(),
    uid: getCurrentUser().uid,
  });
}
