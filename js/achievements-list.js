// 도전과제 목록 — 여기에 추가·수정하면 도전과제 탭에 바로 반영돼요.
//
// ── 공통 항목 ──────────────────────────────────────────────
//   id          : 겹치지 않는 영어 이름. 한번 정하면 바꾸지 마세요! (수령 기록이 이 id로 저장돼요)
//   icon        : 이모지
//   title       : 도전과제 이름
//   description : 설명
//   rewardDexNo : 보상으로 줄 카드의 도감번호. 히든 S01 → 1001, S02 → 1002 …
//                 아직 카드를 안 만들었으면 null (화면에 '보상 준비 중'으로 나와요)
//   secret      : true 로 두면 달성하기 전까지 이름과 조건을 ???로 가려요 (선택)
//
// ── 조건 종류 (type) ───────────────────────────────────────
//   sichuanScore : 사천성 2분 타임어택 최고점 (두 계정 중 높은 쪽)   → target: 목표 점수
//   collectSet   : 지정한 카드를 전부 보유                         → dexNos: [도감번호, ...]
//   collectCount : 서로 다른 카드를 N장 보유 (히든 카드는 제외)       → target: 장수
//   drawCount    : 카드뽑기를 N번 함 (재조합은 제외)                → target: 횟수
//   quizCount    : 오늘의 퀴즈를 N번 풂 (맞든 틀리든)               → target: 횟수 (퀴즈는 하루 1문제예요)
//   quizCorrect  : 오늘의 퀴즈를 N번 맞힘                          → target: 횟수
//   ※ drawCount·quizCount·quizCorrect 는 이 기능을 적용한 날부터 세기 시작해요.
//
// 예시)
//   { id: 'kimetsu-set', icon: '🗡️', title: '귀멸 컬렉터', description: '귀멸의 칼날 카드 3장 모으기',
//     type: 'collectSet', dexNos: [12, 13, 14], rewardDexNo: 1002 },

export const ACHIEVEMENTS = [
  {
    id: 'sichuan-20000',
    icon: '🀄',
    title: '사천성 달인',
    description: '사천성 2분 타임어택에서 20,000점 달성',
    type: 'sichuanScore',
    target: 20000,
    rewardDexNo: 1001, // 히든 카드를 등록한 뒤 1001 등으로 바꿔주세요
  },
  //조하쿠텐
  {
    id: 'johakuten',
    icon: '👹',
    title: '희노애락',
    description: '희노애락 전부 모으기',
    type: 'collectSet',
    dexNos: [178, 179, 180, 181],
    rewardDexNo: 1002, 
  },
  //퀴즈의신
  {
    id: 'QuizGod',
    icon: '❓',
    title: '퀴즈의 신',
    description: '오늘의퀴즈를 50번 맞힘',
    type: 'quizCorrect',
    target: 50,
    rewardDexNo: 1003, 
  },
  //기술의신
  {
    id: 'skillgod',
    icon: '🧠',
    title: '기술의 신',
    description: '기술을 전부 모아라',
    type: 'collectSet',
    dexNos: [60, 104, 120, 124, 131 , 154, 165, 170],
    rewardDexNo: 1004, 
  },
  //뮤츠
  {
    id: 'mew-x2',
    icon: '🧬',
    title: '뮤츠의 탄생',
    description: '뮤 카드를 2장 모으기',
    type: 'cardCopies',
    dexNo: 151,        // 뮤 카드 도감번호
    target: 2,
    rewardDexNo: 1005,  // 뮤츠 카드 도감번호
  },
  //카드 100장 모으기
  {
    id: 'card-100',
    icon: '📚',
    title: '카드 수집가',
    description: '서로 다른 카드 100종 모으기',
    type: 'collectCount',
    target: 100,
    rewardDexNo: 1006,   // 보상 카드 번호
  },
  //울트라 전부 모으기
    { id: 'ultra-all', 
      icon: '🌈', 
      title: '울트라 대마왕', 
      description: '울트라 카드 전부 모으기',
      type: 'collectRarity', 
      rarity: 'ultra', 
      rewardDexNo: 1007 
  },
  //코쿠시보
   {
    id: 'fullmoon-date',
    icon: '🌕',
    title: '보름달 데이트',
    description: '보름달 뜨는 밤에 데이트하기',
    type: 'manual',
    rewardDexNo: 1040,
  },
 // 무잔
  {
    id: 'MUSAN',
    icon: '🩸',
    title: '도깨비의 시조',
    description: '십이귀월 상현을 전부 모아라',
    type: 'collectSet',
    dexNos: [1008, 137, 183, 1002, 185, 184],
    rewardDexNo: 1009,
  },
  //카드 200장 모으기
  {
    id: 'card-200',
    icon: '📚',
    title: '카드게임 마스터',
    description: '서로 다른 카드 200종 모으기',
    type: 'collectCount',
    target: 200,
    rewardDexNo: 1010,   // 보상 카드 번호
  },
  // 텐겐
  {
    id: 'bitch-3',
    icon: '🎶',
    title: '내비치는 세계',
    description: '아내들을 전부 구하세요',
    type: 'collectSet',
    dexNos: [192,193,194],
    rewardDexNo: 1011,
  },
 // 토미에
  {
    id: 'tomi-e',
    icon: '🪓',
    title: '마성의 그녀',
    description: '하남자들을 전부 모으세요',
    type: 'collectSet',
    dexNos: [32,136,155,156,157,158,186,195,205],
    rewardDexNo: 1012,
  },
// 카드 300장
  {
    id: 'card-300',
    icon: '🫨',
    title: '카드게임에 미친자',
    description: '서로 다른 카드 300종 모으기',
    type: 'collectCount',
    target: 300,
    rewardDexNo: 1013,   // 보상 카드 번호
  },
// 무이치로
  {
    id: 'muichiro',
    icon: '🌁',
    title: '탄지로와 친구들',
    description: '탄지로의 친구들을 모아주세요',
    type: 'collectSet',
    dexNos: [200, 123, 51, 213],
    rewardDexNo: 1015,
  },
];
