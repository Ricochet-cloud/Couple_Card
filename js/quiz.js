// 오늘의 퀴즈 (하루 1문제, 홈 화면용)
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

async function getActiveQuizzes() {
  const snapshot = await getDocs(query(collection(db, 'quizzes'), where('active', '==', true)));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getQuiz(quizId) {
  const snapshot = await getDoc(doc(db, 'quizzes', quizId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/**
 * 오늘의 퀴즈 배정 또는 기존 퀴즈 반환 (트랜잭션)
 * state/shared 의 dailyQuiz = { date, quizId, answered, selected }
 * @returns {{ noQuizzes?: boolean, quiz?: object, answered?: boolean, selected?: number|null }}
 */
export async function assignOrGetDailyQuiz() {
  const stateRef = doc(db, 'state', 'shared');
  const today = getTodayKST();
  // 트랜잭션 밖에서 미리 조회 (미션 로직과 동일한 방식)
  const activeQuizzes = await getActiveQuizzes();

  try {
    return await runTransaction(db, async (transaction) => {
      const stateDoc = await transaction.get(stateRef);
      if (!stateDoc.exists()) {
        throw new Error('게임 상태를 초기화해주세요.');
      }

      const state = stateDoc.data();
      const daily = state.dailyQuiz || {};
      const usedQuizIds = state.usedQuizIds || [];

      // 오늘 퀴즈가 이미 배정됨
      if (daily.date === today && daily.quizId) {
        const quiz = await getQuiz(daily.quizId);
        if (quiz) {
          return {
            quiz,
            answered: daily.answered || false,
            selected: daily.selected ?? null,
          };
        }
      }

      if (activeQuizzes.length === 0) {
        return { noQuizzes: true };
      }

      // 아직 안 나온 퀴즈 중에서 랜덤, 다 나왔으면 처음부터 다시
      const available = activeQuizzes.filter((q) => !usedQuizIds.includes(q.id));
      const pool = available.length > 0 ? available : activeQuizzes;
      const selectedQuiz = pool[Math.floor(Math.random() * pool.length)];
      const newUsedQuizIds = available.length > 0 ? [...usedQuizIds, selectedQuiz.id] : [selectedQuiz.id];

      transaction.update(stateRef, {
        dailyQuiz: { date: today, quizId: selectedQuiz.id, answered: false, selected: null },
        usedQuizIds: newUsedQuizIds,
      });

      return { quiz: selectedQuiz, answered: false, selected: null };
    });
  } catch (error) {
    console.error('퀴즈 배정 실패:', error);
    throw error;
  }
}

/**
 * 오늘의 퀴즈 답 제출 (하루 한 번)
 * @param {number} selectedIndex - 고른 보기 번호(0부터)
 */
export async function submitQuizAnswer(selectedIndex) {
  const stateRef = doc(db, 'state', 'shared');

  try {
    await runTransaction(db, async (transaction) => {
      const stateDoc = await transaction.get(stateRef);
      if (!stateDoc.exists()) {
        throw new Error('게임 상태를 초기화해주세요.');
      }

      const daily = stateDoc.data().dailyQuiz || {};
      if (!daily.quizId) throw new Error('퀴즈가 배정되지 않았습니다.');
      if (daily.answered) throw new Error('이미 답을 제출했습니다.');

      // 정답 여부 확인 (도전과제용 누적 횟수에 쓰여요)
      const quizDoc = await transaction.get(doc(db, 'quizzes', daily.quizId));
      const isCorrect = quizDoc.exists() && quizDoc.data().answerIndex === selectedIndex;
      const stats = stateDoc.data().stats || {};

      transaction.update(stateRef, {
        dailyQuiz: { ...daily, answered: true, selected: selectedIndex },
        stats: {
          ...stats,
          quizAnswered: (stats.quizAnswered || 0) + 1,
          quizCorrect: (stats.quizCorrect || 0) + (isCorrect ? 1 : 0),
        },
      });
    });
  } catch (error) {
    console.error('퀴즈 제출 실패:', error);
    throw error;
  }
}
