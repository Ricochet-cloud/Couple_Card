// 이벤트 설정 — 이 파일 하나로 이벤트를 켜고 끄고 기간을 정해요.
// 이벤트를 완전히 지울 때: event.html, event/ 폴더, css/event.css, js/event*.js,
//                          index.html 의 '이벤트 배너' 블록과 event-banner import/호출 을 지우면 끝이에요.
export const EVENT = {
  id: 'hantengu',                    // 수령 기록 이름 (state.events.hantengu) — 바꾸지 마세요
  enabled: true,                      // false 면 홈 배너가 사라지고 이벤트 페이지도 닫혀요
  title: '한텐구 찾기',
  startDate: '2026-11-09',            // 이 날부터 열려요 (한국 시간, YYYY-MM-DD)
  endDate: '2026-11-16',                      // 이 날까지 열려요. null 이면 기간 제한 없음
  gamePath: './event/hantengu/hantengu-finder.html',

  // 난이도별 보상 카드 (도감번호). 관리자에서 '이벤트 전용'을 체크해 두세요.
  //   key            : 게임이 쓰는 난이도 이름 (게임의 ?d= 값, 결과 메시지의 difficulty 와 같아야 해요)
  //   openAfterDays  : startDate 에서 며칠 뒤에 열리는지 (0 또는 생략 = 처음부터). 아직 안 열린 난이도는 잠겨요
  //   rewardDexNo          : 보상 카드 도감번호 (선택)
  //   rewardTickets        : 보상 뽑기권 장수 (선택)       예) rewardTickets: 3
  //   rewardSpecialTickets : 보상 특별 뽑기권 장수 (선택)  예) rewardSpecialTickets: 1
  //     → 위 셋 중 필요한 것만 쓰세요. 카드+뽑기권을 같이 줄 수도 있어요. (하나는 꼭 있어야 해요)
  //   sec / desc     : 화면 표시용 설명 (desc 가 있으면 그걸 써요, 없으면 'sec초 버티기')
  //
  // ※ 난이도 선택이 없는 게임: levels 에 항목을 딱 하나만 두세요. 이 경우 게임에 ?d= 를 붙이지 않고,
  //   게임의 결과 메시지에 difficulty 가 없어도 돼요. (예: { key: 'MAIN', name: '클리어', rewardDexNo: 195 })
  //
  // ※ 클리어한 난이도도 계속 '다시 하기'로 할 수 있어요. 보상은 난이도마다 한 번만 줘요.
  levels: [
    // ※ 보상은 임시 값이에요. 원하는 카드 번호(rewardDexNo)나 뽑기권 장수로 바꿔 주세요.
    { key: 'EASY',   name: 'EASY',   desc: '60초 · 한텐구를 찾아요',               rewardTickets: 5 },
    { key: 'NORMAL', name: 'NORMAL', desc: '45초 · 캐릭터가 더 많아요',            rewardTickets: 7, openAfterDays: 3 },
    { key: 'HARD',   name: 'HARD',   desc: '30초 · 캐릭터가 아주 많고 작아요',     rewardTickets: 9, openAfterDays: 5 },
  ],
};

export function todayKST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/** 난이도의 보상 구성 (카드/뽑기권/특별 뽑기권) */
export function levelRewards(level) {
  return {
    dexNo: level.rewardDexNo || null,
    tickets: level.rewardTickets || 0,
    specialTickets: level.rewardSpecialTickets || 0,
  };
}

/** 'upcoming' | 'open' | 'ended' | 'off' */
export function getEventStatus() {
  if (!EVENT.enabled) return 'off';
  const today = todayKST();
  if (EVENT.startDate && today < EVENT.startDate) return 'upcoming';
  if (EVENT.endDate && today > EVENT.endDate) return 'ended';
  return 'open';
}

/** 난이도가 열리는 날짜 (startDate + openAfterDays, YYYY-MM-DD) */
export function levelOpenDate(level) {
  if (!EVENT.startDate) return null;
  const d = new Date(EVENT.startDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + (level.openAfterDays || 0));
  return d.toISOString().split('T')[0];
}

/** 'open' (할 수 있음) | 'locked' (아직 안 열림) | 'closed' (이벤트 끝/꺼짐) */
export function getLevelState(level) {
  const status = getEventStatus();
  if (status === 'off' || status === 'ended') return 'closed';
  if (status === 'upcoming') return 'locked';
  const openDate = levelOpenDate(level);
  return openDate && todayKST() < openDate ? 'locked' : 'open';
}

/** 오늘부터 날짜까지 남은 날 */
export function daysUntil(dateStr) {
  return Math.round((new Date(dateStr) - new Date(todayKST())) / 86400000);
}

/** 'YYYY-MM-DD' → '11월 5일' */
export function formatKoreanDate(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}월 ${d}일`;
}

/** 종료일까지 남은 날 (endDate 가 없으면 null) */
export function daysLeft() {
  if (!EVENT.endDate) return null;
  const ms = new Date(EVENT.endDate) - new Date(todayKST());
  return Math.round(ms / 86400000);
}
