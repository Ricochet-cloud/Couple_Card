// Firebase SDK 최신 안정 버전 (modular)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Firestore 오프라인 캐시 활성화
import { enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore 캐시: 여러 탭에서 열려있음');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore 캐시: 브라우저 미지원');
  }
});
