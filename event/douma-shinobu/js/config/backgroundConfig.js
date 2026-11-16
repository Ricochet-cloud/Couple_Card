/**
 * backgroundConfig.js - 배경 애셋 및 렌더링 설정
 * 
 * - 실제 이미지 파일(PNG/JPG) 교체만으로 배경 수정 가능
 * - 수직 무한 패럴랙스 스크롤 속도 및 오버레이 암부 조절
 * - 페이즈별 배경 전환(Phase 1/2 기본 무한성 -> Phase 3 빙결 사원) 지원
 */

export const BACKGROUND_CONFIG = {
  // 1. 이미지 애셋 경로
  assets: {
    default: {
      key: 'bg_default',
      src: 'assets/images/backgrounds/infinity_castle.webp',
      description: '기본 무한성 목조 누각 배경'
    },
    iceTemple: {
      key: 'bg_ice_temple',
      src: 'assets/images/backgrounds/ice_temple.png',
      description: '도우마 Phase 3 극빙 사원 배경'
    }
  },

  // 2. 스크롤 및 렌더링 파라미터
  scrollSpeed: 30,         // px/sec (세로 종스크롤 속도, 0이면 고정)
  enableScroll: true,      // 무한 루프 스크롤 활성화
  darkOverlayAlpha: 0.35,  // 탄막과 캐릭터 시인성 확보를 위한 반투명 어두운 오버레이 필터

  // 3. 이미지가 없을 때 작동하는 절차적 벡터 배경 테마 설정
  fallbackTheme: {
    bgGradTop: '#0a0914',
    bgGradMid: '#131124',
    bgGradBottom: '#1b1730',
    frostLight: 'rgba(0, 229, 255, 0.08)',
    wisteriaLight: 'rgba(179, 136, 255, 0.08)',
    gridColor: 'rgba(255, 255, 255, 0.025)'
  }
};
