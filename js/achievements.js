// 도전과제 로직: 진행도 계산 + 보상 카드 수령
import { db } from './firebase.js';
import {
  doc,
  getDoc,
  runTransaction,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { getActiveCards } from './collection.js';
import { ACHIEVEMENTS } from './achievements-list.js';

const STATE_REF = doc(db, 'state', 'shared');
const SICHUAN_REF = doc(db, 'minigameScores', 'sichuan-2min'); // js/minigame.js 의 최고기록 문서

function getTodayKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

/**
 * 진행도 계산에 필요한 데이터를 한 번에 불러와요
 * @returns {{cards: Array, claimed: Object, sichuanBest: number}}
 */
export async function loadAchievementData() {
  const [cards, stateSnap, sichuanSnap] = await Promise.all([
    getActiveCards(),
    getDoc(STATE_REF),
    getDoc(SICHUAN_REF).catch(() => null), // 기록 문서를 못 읽어도 나머지는 보여줘요
  ]);

  const state = stateSnap.exists() ? stateSnap.data() : {};
  const owned = state.owned || {};
  const records = sichuanSnap && sichuanSnap.exists() ? sichuanSnap.data().records || {} : {};

  return {
    cards: cards.map((c) => ({
      ...c,
      isOwned: !!owned[c.id],
      count: owned[c.id]?.count || 0,
      firstAt: owned[c.id]?.firstAt || null,
    })),
    claimed: state.achievements || {},
    sichuanBest: Object.values(records).reduce((max, r) => Math.max(max, r.score || 0), 0),
  };
}

/**
 * 도전과제 하나의 진행도
 * @returns {{current: number, target: number, done: boolean}}
 */
export function evaluateAchievement(ach, data) {
  let current = 0;
  let target = 1;

  if (ach.type === 'sichuanScore') {
    current = data.sichuanBest;
    target = ach.target;
  } else if (ach.type === 'collectSet') {
    target = ach.dexNos.length;
    current = ach.dexNos.filter((no) => data.cards.some((c) => c.dexNo === no && c.isOwned)).length;
  } else if (ach.type === 'collectCount') {
    current = data.cards.filter((c) => c.rarity !== 'hidden' && c.isOwned).length;
    target = ach.target;
  }

  current = Math.min(current, target);
  return { current, target, done: current >= target };
}

/**
 * 보상 카드 찾기 (없으면 null)
 */
export function findRewardCard(ach, data) {
  if (!ach.rewardDexNo) return null;
  return data.cards.find((c) => c.dexNo === ach.rewardDexNo) || null;
}

/**
 * 보상 받기: 달성 확인 → 카드 지급 + 수령 기록을 한 트랜잭션으로 저장
 * @returns {{card: Object, isFirstTime: boolean}}
 */
export async function claimAchievement(id) {
  const ach = ACHIEVEMENTS.find((a) => a.id === id);
  if (!ach) throw new Error('없는 도전과제예요.');

  const data = await loadAchievementData(); // 화면 값이 아니라 최신 값으로 다시 확인
  if (!evaluateAchievement(ach, data).done) throw new Error('아직 달성하지 못했어요.');

  const reward = findRewardCard(ach, data);
  if (!reward) throw new Error('보상 카드가 아직 준비되지 않았어요.');

  const today = getTodayKST();

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(STATE_REF);
    if (!snap.exists()) throw new Error('게임 상태를 초기화해주세요.');

    const state = snap.data();
    const claimed = state.achievements || {};
    if (claimed[id]) throw new Error('이미 받은 보상이에요.');

    const owned = state.owned || {};
    const prev = owned[reward.id] || { count: 0, firstAt: null };
    owned[reward.id] = { count: prev.count + 1, firstAt: prev.firstAt || today };

    tx.update(STATE_REF, { owned, achievements: { ...claimed, [id]: today } });

    return {
      card: { ...reward, isOwned: true, count: prev.count + 1, firstAt: owned[reward.id].firstAt },
      isFirstTime: prev.count === 0,
    };
  });
}
