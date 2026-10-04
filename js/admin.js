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
 * 이미지를 WebP로 변환 (긴 변 640px 이하, 품질 0.75)
 * @param {File} file - 선택한 이미지 파일
 * @returns {Promise<{base64: string, size: number}>}
 */
export async function convertImageToWebP(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        // 긴 변 640px 이하로 스케일
        let { width, height } = img;
        const maxSize = 640;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // WebP로 변환 (품질 0.75)
        canvas.toBlob(
          (blob) => {
            const sizeKB = blob.size / 1024;

            if (sizeKB > 400) {
              reject(new Error(`사진이 너무 큽니다 (${sizeKB.toFixed(1)}KB, 최대 400KB)`));
              return;
            }

            const blobReader = new FileReader();
            blobReader.onload = () => {
              resolve({
                base64: blobReader.result,
                size: blob.size,
              });
            };
            blobReader.readAsDataURL(blob);
          },
          'image/webp',
          0.75
        );
      };

      img.onerror = () => {
        reject(new Error('이미지를 읽을 수 없습니다.'));
      };

      img.src = event.target.result;
    };

    reader.onerror = () => {
      reject(new Error('파일을 읽을 수 없습니다.'));
    };

    reader.readAsDataURL(file);
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
