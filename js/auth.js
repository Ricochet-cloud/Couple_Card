import { auth } from './firebase.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { ADMIN_UID, SHARED_UID } from './firebase-config.js';

let currentUser = null;

// 현재 로그인 상태 확인 (비동기)
export function getCurrentUser() {
  return currentUser;
}

// 사용자 초기화 및 상태 감지
export function initAuth(callback) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (callback) callback(user);
  });
}

// 관리자 여부 확인
export function isAdmin() {
  return currentUser && currentUser.uid === ADMIN_UID;
}

// 권한 있는 UID 확인 (관리자 또는 공용)
export function isAuthorized() {
  return currentUser && (currentUser.uid === ADMIN_UID || currentUser.uid === SHARED_UID);
}

// 로그아웃
export async function logout() {
  try {
    await signOut(auth);
    currentUser = null;
  } catch (error) {
    console.error('로그아웃 실패:', error);
    throw error;
  }
}

// 비로그인 또는 권한 없음 시 로그인 페이지로 이동 (가드)
export function guardAuth() {
  if (!isAuthorized()) {
    window.location.href = './login.html';
  }
}
