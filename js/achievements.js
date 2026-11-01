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
    manualDone: state.manualDone || {},
    stats: state.stats || {}, // { draws, quizAnswered, quizCorrect } 누적 횟수
    sichuanBest: Object.values(records).reduce((max, r) => Math.max(max, r.score || 0), 0),
  };
}

const SLOT_COPIES_MAX = 6; // 같은 카드 N장 모으기: 이 장수 이하일 때만 칸으로 보여줘요

/** 단계 사다리 눈금: 목표의 25/50/75/100% 근처 (ach.milestones 로 직접 지정도 가능) */
export function makeTicks(ach, target) {
  if (Array.isArray(ach.milestones) && ach.milestones.length) {
    const t = ach.milestones.filter((n) => n > 0 && n < target).sort((a, b) => a - b);
    return [...t, target];
  }
  if (target <= 4) return Array.from({ length: target }, (_, i) => i + 1);
  let unit = 1;
  for (const u of [1, 5, 10, 50, 100, 500, 1000, 5000, 10000]) if (u <= target / 20) unit = u;
  const ticks = [0.25, 0.5, 0.75].map((r) => Math.max(unit, Math.round((target * r) / unit) * unit));
  return [...new Set([...ticks.filter((n) => n < target), target])];
}

/**
 * 도전과제 하나의 진행도
 * @returns {{current: number, target: number, done: boolean,
 *            slots: Array|null, ticks: number[]|null}}
 *   slots : 카드 칸 목록 [{dexNo, card, ghost}] (카드 모으기 계열)
 *   ticks : 단계 사다리 눈금 (숫자 누적 계열)
 */
export function evaluateAchievement(ach, data) {
  let current = 0;
  let target = 1;
  let slots = null;
  let ticks = null;
  const bySlot = (no) => {
    const c = data.cards.find((x) => x.dexNo === no);
    return { dexNo: no, card: c && c.isOwned ? c : null, ghost: false };
  };

  if (ach.type === 'sichuanScore') {
    current = data.sichuanBest;
    target = ach.target;
  } else if (ach.type === 'collectSet') {
    target = ach.dexNos.length;
    current = ach.dexNos.filter((no) => data.cards.some((c) => c.dexNo === no && c.isOwned)).length;
    slots = ach.dexNos.map(bySlot);
  } else if (ach.type === 'drawCount') {
    current = data.stats.draws || 0;
    target = ach.target;
  } else if (ach.type === 'quizCount') {
    current = data.stats.quizAnswered || 0;
    target = ach.target;
  } else if (ach.type === 'quizCorrect') {
    current = data.stats.quizCorrect || 0;
    target = ach.target;
  } else if (ach.type === 'cardCopies') {
    // 같은 카드를 N장 보유 (중복 포함)
    const card = data.cards.find((c) => c.dexNo === ach.dexNo);
    current = card ? card.count : 0;
    target = ach.target;
    if (target <= SLOT_COPIES_MAX) {
      // 같은 카드 칸 N개: 가진 장수만큼 채우고, 나머지는 흐릿한 고스트로
      slots = Array.from({ length: target }, (_, i) => ({
        dexNo: ach.dexNo,
        card: card && card.count > i ? card : null,
        ghost: !!(card && card.isOwned && card.count <= i),
        ghostCard: card && card.isOwned ? card : null,
      }));
    }
  } else if (ach.type === 'collectRarity') {
    // 해당 등급의 활성 카드를 전부 보유
    const pool = data.cards.filter((c) => c.rarity === ach.rarity);
    target = Math.max(pool.length, 1);   // 카드가 하나도 없을 때 바로 달성되는 것 방지
    current = pool.filter((c) => c.isOwned).length;
    slots = pool.map((c) => ({ dexNo: c.dexNo, card: c.isOwned ? c : null, ghost: false }));
  } else if (ach.type === 'manual') {
    // 직접 달성 체크하는 도전과제
    current = data.manualDone[ach.id] ? 1 : 0;
    target = 1;
  } else if (ach.type === 'collectCount') {
    current = data.cards.filter((c) => c.rarity !== 'hidden' && c.isOwned).length;
    target = ach.target;
  }

  current = Math.min(current, target);
  if (!slots && ach.type !== 'manual') ticks = makeTicks(ach, target);
  return { current, target, done: current >= target, slots, ticks };
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
/* 수동 도전과제 달성 체크 (이미 체크했으면 아무 일도 안 해요) */
export async function markManualDone(id) {
  const ach = ACHIEVEMENTS.find((a) => a.id === id);
  if (!ach || ach.type !== 'manual') throw new Error('수동 도전과제가 아니에요.');

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(STATE_REF);
    if (!snap.exists()) throw new Error('게임 상태를 초기화해주세요.');
    const done = snap.data().manualDone || {};
    if (done[id]) return;
    tx.update(STATE_REF, { manualDone: { ...done, [id]: getTodayKST() } });
  });
}