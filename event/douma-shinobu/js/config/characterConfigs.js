/**
 * characterConfigs.js - 캐릭터 애셋 및 애니메이션 메타데이터 설정
 * 
 * - ChatGPT(DALL-E) 1536x1024 고해상도 스프라이트 시트 규격 대응
 * - 5개 행(Idle, Move, Attack, Hit, Death) 및 프레임 스케일링 설정
 */

export const CHARACTER_CONFIGS = {
  shinobu: {
    id: 'shinobu',
    name: '코쵸우 시노부 (Kochou Shinobu)',
    role: 'player',
    imageSrc: 'assets/images/shinobu/shinobu_spritesheet.webp',
    
    // AI 생성 시트(1536x1024, 5행) 기준 단일 프레임 기본 규격
    frameWidth: 256,
    frameHeight: 204,
    
    // 540x960 캔버스 뷰포트에 맞춘 최적 렌더링 배율
    scale: 0.52,
    originX: 0.5,
    originY: 0.5,
    
    hitboxRadius: 3.5,
    baseSpeed: 250,
    focusSpeed: 110,
    maxHp: 100,

    animations: {
      idle: {
        row: 0,
        frames: 6,
        fps: 6,
        loop: true,
        description: '호흡 및 나비 날개 하오리 대기 모션'
      },
      move: {
        row: 1,
        frames: 6,
        fps: 10,
        loop: true,
        description: '가볍게 도약하며 이동하는 모션'
      },
      attack: {
        row: 2,
        frames: 5,
        fps: 12,
        loop: false,
        description: '봉아의 호흡 - 전방 고속 독침 찌르기'
      },
      hit: {
        row: 3,
        frames: 3,
        fps: 8,
        loop: false,
        duration: 0.4,
        description: '피격 점멸 및 경직 모션'
      },
      death: {
        row: 4,
        frames: 6,
        fps: 6,
        loop: false,
        description: '등꽃 나비 입자로 흩어지는 최후 모션'
      }
    }
  },

  douma: {
    id: 'douma',
    name: '도우마 (Douma)',
    role: 'boss',
    imageSrc: 'assets/images/douma/douma_spritesheet.webp',
    
    // AI 생성 시트(1536x1024, 5행) 기준 단일 프레임 기본 규격
    frameWidth: 256,
    frameHeight: 204,
    
    scale: 0.58, // 보스는 플레이어보다 위압감 있게 약간 더 큼
    originX: 0.5,
    originY: 0.5,
    
    hitboxRadius: 28,
    baseSpeed: 80,
    maxHp: 1300,

    animations: {
      idle: {
        row: 0,
        frames: 4,
        fps: 5,
        loop: true,
        description: '금빛 부채를 부치며 공중에 부유'
      },
      move: {
        row: 1,
        frames: 4,
        fps: 7,
        loop: true,
        description: '서리 안개를 일으키며 미끄러지듯 이동'
      },
      attack: {
        row: 2,
        frames: 6,
        fps: 9,
        loop: false,
        description: '부채를 휘둘러 빙결 혈귀술 탄막 방출'
      },
      hit: {
        row: 3,
        frames: 3,
        fps: 8,
        loop: false,
        duration: 0.3,
        description: '얼음 파편이 튀며 가벼운 경직 모션'
      },
      death: {
        row: 4,
        frames: 6,
        fps: 5,
        loop: false,
        description: '얼음이 깨어지며 완전히 소멸하는 모션'
      }
    }
  }
};
