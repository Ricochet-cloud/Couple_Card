/**
 * storyData.js - 시노부 vs 도우마 스토리 나레이션 및 대사 데이터
 * 
 * - 프롤로그 나레이션 & 전투 전 대화
 * - 보스 페이즈 전환(Phase 2, Phase 3) 컷신 대사
 * - 승리 에필로그 및 패배 대사
 * - 별도의 데이터 구조로 분리되어 대사 수정 및 다국어 확장이 용이함
 */

export const STORY_DATA = {
  // 1. 게임 시작 전 프롤로그 대화 및 나레이션
  prologue: [
    {
      speaker: '나레이션',
      side: 'center',
      themeColor: '#ffd54f',
      text: '무한성 깊은 곳, 연꽃 연못이 얼어붙은 극빙(極氷)의 방.\n상현 2 십이귀월, 도우마의 앞에 충주(蟲柱) 코쵸우 시노부가 마주 선다.'
    },
    {
      speaker: '도우마',
      side: 'boss',
      themeColor: '#80d8ff',
      text: '어라아? 여자아이잖아? 게다가 귀살대의 기둥이라니~\n오늘 밤은 참 운이 좋네. 자, 나와 영원히 하나가 되자꾸나!'
    },
    {
      speaker: '시노부',
      side: 'player',
      themeColor: '#b388ff',
      text: '...당신이군요. 내 언니를, 수많은 사람들을 앗아간 혈귀가.'
    },
    {
      speaker: '도우마',
      side: 'boss',
      themeColor: '#80d8ff',
      text: '아하! 꽃의 호흡을 쓰던 카나에 말이지? 그 아이는 정말 상냥했어.\n너도 언니 곁으로 보내줄게, 고통 없이 편안하게 말이야!'
    },
    {
      speaker: '시노부',
      side: 'player',
      themeColor: '#b388ff',
      text: '헛소리는 거기까지입니다. 내 칼날에 깃든 등꽃 독이\n당신의 오만한 숨통을 끊어놓을 테니까요!'
    }
  ],

  // 2. 보스 페이즈 전환 컷신 대사
  phaseTransitions: {
    phase2: {
      title: '혈귀술(血鬼術) - 동운·빙목련 (凍雲·氷木蓮)',
      speaker: '도우마',
      themeColor: '#80d8ff',
      dialogue: '흐응~ 꽤나 날카로운 독이네? 하지만 얼어붙은 안개 속에서도\n그 가냘픈 날갯짓을 계속할 수 있을까?'
    },
    phase3: {
      title: '비기(秘技) - 무빙·결정의 아이 (霧氷·結晶の御子)',
      speaker: '도우마',
      themeColor: '#ff80ab',
      dialogue: '콜록... 내 폐가 붕괴하고 있어... 설마 온몸에 독을 둘렀던 거니?\n좋아, 그렇다면 내 모든 결정을 해방해서 함께 멸망해주마!'
    }
  },

  // 3. 승리 후 에필로그 나레이션
  victory: [
    {
      speaker: '도우마',
      side: 'boss',
      themeColor: '#80d8ff',
      text: '말도 안 돼... 몸이... 산산이 부서져 내리고 있어...\n이것이... 7백 배 농축된... 등꽃의 독...'
    },
    {
      speaker: '시노부',
      side: 'player',
      themeColor: '#b388ff',
      text: '언니... 보고 계신가요? 약속을 지켰어요.\n이제 영원히... 지옥의 밑바닥에서 얼어붙으세요.'
    },
    {
      speaker: '나레이션',
      side: 'center',
      themeColor: '#69f0ae',
      text: '상현 2 도우마 완전 소멸.\n충주 코쵸우 시노부의 숭고한 결전이 승리로 막을 내렸다.'
    }
  ],

  // 4. 패배 시 나레이션
  defeat: [
    {
      speaker: '도우마',
      side: 'boss',
      themeColor: '#80d8ff',
      text: '아쉽네, 시노부 쨩. 독은 대단했지만... 내 얼음이 조금 더 빨랐어.\n자, 약속대로 영원히 구원해 줄게...'
    },
    {
      speaker: '나레이션',
      side: 'center',
      themeColor: '#ff5252',
      text: '시노부의 의식이 차가운 얼음 속으로 침몰해 간다.\n하지만 언니를 위한 기도는 아직 끝나지 않았다...'
    }
  ]
};
