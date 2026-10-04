// 일일 미션 시스템
import { db } from './firebase.js';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  runTransaction,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

/**
 * 오늘 날짜 (KST YYYY-MM-DD)
 */
function getTodayKST() {
  const now = new Date();
  const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().split('T')[0];
}

/**
 * 활성 미션 모두 조회
 */
export async function getActiveMissions() {
  try {
    const snapshot = await getDocs(query(collection(db, 'missions'), where('active', '==', true)));
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('미션 조회 실패:', error);
    throw error;
  }
}

/**
 * 오늘의 미션 배정 또는 기존 미션 반환 (트랜잭션)
 * @returns { missionId, mission, done }
 */
export async function assignOrGetDailyMission() {
  const stateRef = doc(db, 'state', 'shared');
  const today = getTodayKST();

  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. state/shared 읽기
      const stateDoc = await transaction.get(stateRef);
      if (!stateDoc.exists()) {
        throw new Error('게임 상태를 초기화해주세요.');
      }

      const state = stateDoc.data();
      const daily = state.daily || {};
      const usedMissionIds = state.usedMissionIds || [];

      // 2. 오늘 미션이 이미 배정됨
      if (daily.date === today && daily.missionId) {
        const mission = await getMission(daily.missionId);
        if (mission) {
          return {
            missionId: daily.missionId,
            mission: mission,
            done: daily.done || false,
          };
        }
      }

      // 3. 활성 미션 조회
      const activeMissions = await getActiveMissions();

      if (activeMissions.length === 0) {
        throw new Error('NOMISSIONS');
      }

      // 4. 새로운 미션 선택
      const availableMissions = activeMissions.filter((m) => !usedMissionIds.includes(m.id));

      let selectedMission;
      let newUsedMissionIds = usedMissionIds;

      if (availableMissions.length === 0) {
        // 모든 미션을 사용했음 → 초기화
        selectedMission = activeMissions[Math.floor(Math.random() * activeMissions.length)];
        newUsedMissionIds = [selectedMission.id];
      } else {
        // 미사용 미션 중에서 선택
        selectedMission = availableMissions[Math.floor(Math.random() * availableMissions.length)];
        newUsedMissionIds = [...usedMissionIds, selectedMission.id];
      }

      // 5. 트랜잭션 업데이트
      transaction.update(stateRef, {
        daily: {
          date: today,
          missionId: selectedMission.id,
          done: false,
        },
        usedMissionIds: newUsedMissionIds,
      });

      return {
        missionId: selectedMission.id,
        mission: selectedMission,
        done: false,
      };
    });

    return result;
  } catch (error) {
    if (error.message === 'NOMISSIONS') {
      return {
        missionId: null,
        mission: null,
        done: false,
        noMissions: true,
      };
    }
    console.error('미션 배정 실패:', error);
    throw error;
  }
}

/**
 * 특정 미션 조회
 */
async function getMission(missionId) {
  try {
    const snapshot = await getDoc(doc(db, 'missions', missionId));
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() };
    }
    return null;
  } catch (error) {
    console.error('미션 조회 실패:', error);
    throw error;
  }
}

/**
 * 미션 완료 처리 (트랜잭션)
 */
export async function completeMission() {
  const stateRef = doc(db, 'state', 'shared');

  try {
    await runTransaction(db, async (transaction) => {
      const stateDoc = await transaction.get(stateRef);
      if (!stateDoc.exists()) {
        throw new Error('게임 상태를 초기화해주세요.');
      }

      const state = stateDoc.data();
      const daily = state.daily || {};

      if (!daily.missionId) {
        throw new Error('미션이 배정되지 않았습니다.');
      }

      if (daily.done) {
        throw new Error('이미 완료했습니다.');
      }

      // 완료 표시
      transaction.update(stateRef, {
        daily: {
          ...daily,
          done: true,
        },
      });
    });
  } catch (error) {
    console.error('미션 완료 실패:', error);
    throw error;
  }
}
