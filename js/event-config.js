// 이벤트 설정 — 이 파일 하나로 이벤트를 켜고 끄고 기간을 정해요.
// 이벤트를 완전히 지울 때: event.html, event/ 폴더, css/event.css, js/event*.js,
//                          index.html 의 '이벤트 배너' 블록과 event-banner import/호출 을 지우면 끝이에요.
export const EVENT = {
  id: 'jump',                         // 수령 기록 이름 (state.events.jump) — 바꾸지 마세요
  enabled: true,                      // false 면 홈 배너가 사라지고 이벤트 페이지도 닫혀요
  title: 'JUMP & SURVIVE',
  startDate: '2026-11-02',            // 이 날부터 열려요 (한국 시간, YYYY-MM-DD)
  endDate: '2026-11-11',                      // 이 날까지 열려요. null 이면 기간 제한 없음
  gamePath: './event/jump-survive.html',

  // 난이도별 보상 카드 (도감번호). 관리자에서 '이벤트 전용'을 체크해 두세요.
  // sec 는 게임 안의 시간(event/jump-survive.html 의 DIFFICULTIES)과 맞춰 주세요 — 화면 표시용이에요.
  levels: [
    { key: 'EASY',   name: '이지',  sec: 50, rewardDexNo: 192 },
    { key: 'NORMAL', name: '노말',  sec: 60, rewardDexNo: 193 },
    { key: 'HARD',   name: '하드',  sec: 70, rewardDexNo: 194 },
  ],
};

export function todayKST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/** 'upcoming' | 'open' | 'ended' | 'off' */
export function getEventStatus() {
  if (!EVENT.enabled) return 'off';
  const today = todayKST();
  if (EVENT.startDate && today < EVENT.startDate) return 'upcoming';
  if (EVENT.endDate && today > EVENT.endDate) return 'ended';
  return 'open';
}

/** 종료일까지 남은 날 (endDate 가 없으면 null) */
export function daysLeft() {
  if (!EVENT.endDate) return null;
  const ms = new Date(EVENT.endDate) - new Date(todayKST());
  return Math.round(ms / 86400000);
}
