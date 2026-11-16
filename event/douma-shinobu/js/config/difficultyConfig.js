/**
 * difficultyConfig.js - 게임 난이도(EASY / NORMAL / HARD) 전역 설정
 * 
 * - 모든 탄막 속도, 밀도, 쿨다운 배수를 한곳에서 관리
 * - 게임 로직 내에서 if-else 중복 분기 없이 수치 배수(Multiplier)로 일원화
 * - 플레이어 피격점 반경, 잔기, 폭탄, 보스 HP 차등 적용
 */

export const DIFFICULTY_CONFIG = {
  EASY: {
    id: 'EASY',
    name: '쉬움 (EASY)',
    description: '여유로운 탄속과 넉넉한 회피 경로. 초보자 권장.',
    // 탄막 밸런스 배수
    speedMultiplier: 0.72,       // 탄환 비행 속도 72%
    densityMultiplier: 0.65,     // 탄환 발사 개수 65%
    cooldownMultiplier: 1.35,    // 패턴 간격 1.35배 여유
    homingStrength: 0.6,         // 추적탄 선회력 약화
    predictiveError: 0.22,       // 예측 저격 시 약간 빗나가게 조준 (회피 여유)
    // 플레이어 스펙
    playerHitboxRadius: 2.5,     // 더 작은 피격점 (스치기 쉬움)
    playerLives: 5,              // 잔기 5개
    playerBombs: 4,              // 폭탄 4개
    bossMaxHp: 900               // 보스 체력
  },

  NORMAL: {
    id: 'NORMAL',
    name: '보통 (NORMAL)',
    description: '기본 탄막 패턴과 표준 밸런스.',
    speedMultiplier: 1.0,
    densityMultiplier: 1.0,
    cooldownMultiplier: 1.0,
    homingStrength: 1.0,
    predictiveError: 0.06,
    playerHitboxRadius: 3.5,
    playerLives: 3,
    playerBombs: 3,
    bossMaxHp: 1300
  },

  HARD: {
    id: 'HARD',
    name: '어려움 (HARD)',
    description: '귀살대 주(柱)급 난이도. 빠른 탄속과 복합 탄막 교차.',
    speedMultiplier: 1.25,
    densityMultiplier: 1.35,
    cooldownMultiplier: 0.82,
    homingStrength: 1.4,
    predictiveError: 0.0,        // 100% 정밀 예측 저격
    playerHitboxRadius: 4.0,
    playerLives: 2,
    playerBombs: 2,
    bossMaxHp: 1750
  }
};
