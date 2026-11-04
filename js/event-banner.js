// 홈의 이벤트 배너 (설정은 js/event-config.js)
import { EVENT, getEventStatus, daysLeft, getLevelState, levelOpenDate, formatKoreanDate } from './event-config.js';
import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

export async function initEventBanner() {
  const el = document.getElementById('eventBanner');
  if (!el) return;

  const status = getEventStatus();
  if (status === 'off' || status === 'ended') {
    el.style.display = 'none';
    return;
  }

  const left = daysLeft();
  let sub = status === 'upcoming' ? `${EVENT.startDate}부터 시작해요` : (EVENT.levels.length > 1 ? '난이도별로 클리어하면 보상을 받아요' : '클리어하면 보상을 받아요');
  if (status === 'open' && left !== null) sub += left === 0 ? ' · 오늘까지!' : ` · D-${left}`;
  if (status === 'open') {
    const next = EVENT.levels
      .filter((l) => getLevelState(l) === 'locked' && levelOpenDate(l))
      .sort((a, b) => levelOpenDate(a).localeCompare(levelOpenDate(b)))[0];
    if (next) sub += ` · ${next.name} ${formatKoreanDate(levelOpenDate(next))} 오픈`;
  }
  document.getElementById('eventBannerSub').textContent = sub;
  el.style.display = 'block';

  try {
    const snap = await getDoc(doc(db, 'state', 'shared'));
    const mine = snap.exists() ? (snap.data().events || {})[EVENT.id] || {} : {};
    const done = EVENT.levels.filter((l) => mine[l.key]).length;
    document.getElementById('eventBannerCount').textContent = `보상 ${done} / ${EVENT.levels.length}`;
    el.classList.toggle('is-complete', done === EVENT.levels.length);
  } catch (error) {
    console.warn('이벤트 진행도 불러오기 실패:', error);
  }
}
