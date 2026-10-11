// 관리자 페이지 로직
import { db } from './firebase.js';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { RARITY } from './card.js';
import { initState, getTickets, addTickets } from './state.js';

// ========== 카드 관리 ==========

/**
 * 모든 카드 조회 (번호순)
 */
export async function getAllCards() {
  try {
    const snapshot = await getDocs(collection(db, 'cards'));
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => a.dexNo - b.dexNo);
  } catch (error) {
    console.error('카드 조회 실패:', error);
    throw error;
  }
}

/**
 * 도감번호 중복 확인
 */
export async function isDexNoDuplicate(dexNo, excludeId = null) {
  try {
    const snapshot = await getDocs(query(collection(db, 'cards'), where('dexNo', '==', parseInt(dexNo))));
    if (snapshot.empty) return false;
    if (excludeId) {
      return !snapshot.docs.some((doc) => doc.id === excludeId);
    }
    return true;
  } catch (error) {
    console.error('도감번호 중복 확인 실패:', error);
    throw error;
  }
}

/**
 * 다음 도감번호 제안
 */
export async function getNextDexNo() {
  try {
    const cards = await getAllCards();
    if (cards.length === 0) return 1;
    return Math.max(...cards.map((c) => c.dexNo)) + 1;
  } catch (error) {
    console.error('다음 번호 제안 실패:', error);
    return 1;
  }
}

/**
 * 카드 추가
 */
export async function addCard(cardData) {
  try {
    // 도감번호 중복 확인
    if (await isDexNoDuplicate(cardData.dexNo)) {
      throw new Error(`도감번호 ${cardData.dexNo}은 이미 존재합니다.`);
    }

    const newCard = {
      ...cardData,
      dexNo: parseInt(cardData.dexNo),
      active: true,
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'cards'), newCard);
    return { id: docRef.id, ...newCard };
  } catch (error) {
    console.error('카드 추가 실패:', error);
    throw error;
  }
}

/**
 * 카드 수정
 */
export async function updateCard(cardId, updates) {
  try {
    // dexNo 변경 시 중복 확인
    if (updates.dexNo !== undefined) {
      if (await isDexNoDuplicate(updates.dexNo, cardId)) {
        throw new Error(`도감번호 ${updates.dexNo}은 이미 존재합니다.`);
      }
      updates.dexNo = parseInt(updates.dexNo);
    }

    await updateDoc(doc(db, 'cards', cardId), updates);
  } catch (error) {
    console.error('카드 수정 실패:', error);
    throw error;
  }
}

/**
 * 카드 활성/비활성 토글
 */
export async function toggleCardActive(cardId, currentActive) {
  try {
    await updateDoc(doc(db, 'cards', cardId), { active: !currentActive });
  } catch (error) {
    console.error('카드 상태 변경 실패:', error);
    throw error;
  }
}

/**
 * 카드 삭제
 */
export async function deleteCard(cardId) {
  try {
    await deleteDoc(doc(db, 'cards', cardId));
  } catch (error) {
    console.error('카드 삭제 실패:', error);
    throw error;
  }
}

// ========== 사진 처리 ==========

/**
 * 이미지를 변환 (긴 변 640px 이하, 최대 400KB)
 * - WebP를 지원하면 WebP, 지원하지 않으면(아이폰 Safari) JPEG로 저장
 * - 용량이 크면 품질을 낮추고, 그래도 크면 해상도를 조금씩 줄임
 * @param {File} file - 선택한 이미지 파일
 * @returns {Promise<{base64: string, size: number}>}
 */
export async function convertImageToWebP(file) {
  const MAX_SIZE = 400 * 1024;    // 최종 제한
  const TARGET_SIZE = 380 * 1024; // 목표 (여유분)
  const MAX_DIMENSION = 640;

  const image = await loadImage(file);
  let { width, height } = calculateSize(image.naturalWidth, image.naturalHeight, MAX_DIMENSION);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas를 사용할 수 없습니다.');

  function draw() {
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = '#fff'; // JPEG로 저장될 때 투명 부분이 검게 나오는 것 방지
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);
  }

  draw();

  // 품질을 낮춰가며 목표 용량에 맞추기
  let quality = 0.85;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > TARGET_SIZE && quality > 0.4) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }

  // 그래도 크면 해상도를 조금씩 줄이기
  while (blob.size > MAX_SIZE && width > 200 && height > 200) {
    width = Math.round(width * 0.9);
    height = Math.round(height * 0.9);
    draw();
    blob = await canvasToBlob(canvas, 0.6);
  }

  if (blob.size > MAX_SIZE) {
    throw new Error('사진을 400KB 이하로 압축하지 못했습니다.');
  }

  const base64 = await blobToBase64(blob);
  return { base64, size: blob.size };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 읽을 수 없습니다.'));
    };
    img.src = url;
  });
}

function calculateSize(width, height, maxSize) {
  const longSide = Math.max(width, height);
  if (longSide <= maxSize) return { width, height };
  const scale = maxSize / longSide;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// WebP를 지원하지 않는 브라우저(아이폰 Safari)에서는 PNG로 저장되므로 JPEG로 다시 시도
function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('이미지 변환에 실패했습니다.'));
      if (blob.type === 'image/webp') return resolve(blob);

      canvas.toBlob((jpeg) => {
        if (!jpeg) return reject(new Error('이미지 변환에 실패했습니다.'));
        resolve(jpeg);
      }, 'image/jpeg', quality);
    }, 'image/webp', quality);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('이미지 데이터를 읽을 수 없습니다.'));
    reader.readAsDataURL(blob);
  });
}

// ========== 미션 관리 ==========

/**
 * 모든 미션 조회
 */
export async function getAllMissions() {
  try {
    const snapshot = await getDocs(collection(db, 'missions'));
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0));
  } catch (error) {
    console.error('미션 조회 실패:', error);
    throw error;
  }
}

/**
 * 미션 추가
 */
export async function addMission(text) {
  try {
    const docRef = await addDoc(collection(db, 'missions'), {
      text: text.trim(),
      active: true,
      createdAt: Timestamp.now(),
    });
    return { id: docRef.id, text, active: true, createdAt: Timestamp.now() };
  } catch (error) {
    console.error('미션 추가 실패:', error);
    throw error;
  }
}

/**
 * 미션 수정
 */
export async function updateMission(missionId, updates) {
  try {
    if (updates.text !== undefined) {
      updates.text = updates.text.trim();
    }
    await updateDoc(doc(db, 'missions', missionId), updates);
  } catch (error) {
    console.error('미션 수정 실패:', error);
    throw error;
  }
}

/**
 * 미션 활성/비활성 토글
 */
export async function toggleMissionActive(missionId, currentActive) {
  try {
    await updateDoc(doc(db, 'missions', missionId), { active: !currentActive });
  } catch (error) {
    console.error('미션 상태 변경 실패:', error);
    throw error;
  }
}

/**
 * 미션 삭제
 */
export async function deleteMission(missionId) {
  try {
    await deleteDoc(doc(db, 'missions', missionId));
  } catch (error) {
    console.error('미션 삭제 실패:', error);
    throw error;
  }
}
