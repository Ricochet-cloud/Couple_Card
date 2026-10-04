---
name: technical_decisions
description: 기술적 결정사항 및 구현 방식
metadata:
  type: reference
---

## 카드 시스템

### 데이터 구조
```
cards/{cardId}
  ├─ dexNo (유니크 숫자)
  ├─ title, description, photoData (base64)
  ├─ rarity (ultra/legend/myth/hero/superrare/rare)
  ├─ category, memoryDate (YYYY-MM-DD)
  ├─ active (boolean)
  └─ createdAt (Timestamp)
```

### 렌더링 방식
- `renderCard(card)` - HTML 문자열 반환 (모든 입력 이스케이프)
- `renderLockedCard(dexNo)` - 미보유 카드 (실루엣 + ???)
- CSS는 `data-rarity` 속성으로만 등급 분기

### 사진 처리
- 브라우저에서 자동 변환: WebP (긴 변 640px, 품질 0.75)
- base64로 인코딩 → `photoData` 필드에 직접 저장
- 최대 400KB 제한 (초과 시 경고)
- Firebase Storage 사용 안 함 (Spark 요금제 무료 유지)

---

## 뽑기권 시스템

### 자동 지급 (KST 기준)
```javascript
grantDailyTicketIfNeeded() // 트랜잭션
  ├─ 오늘 날짜 (KST) 계산
  ├─ state/shared.lastGrantDate 확인
  ├─ 미지급 시: tickets +1, lastGrantDate = 오늘
  └─ 이미 지급: 스킵
```

**왜 트랜잭션?**
- 여러 사용자가 동시에 접속해도 1장만 지급
- Race condition 방지

### 뽑기 트랜잭션
```javascript
drawCard() // 트랜잭션
  ├─ tickets > 0 확인
  ├─ 등급 추첨 (가중치)
  ├─ 그 등급 카드 중 균등 랜덤
  ├─ tickets -1
  ├─ owned[cardId].count +1 (또는 +1)
  ├─ firstAt 자동 설정 (처음 시에만)
  └─ isFirstTime 반환
```

**등급 확률** (총 100)
- 울트라: 2%
- 전설: 5%
- 신화: 8%
- 영웅: 15%
- 초희귀: 30%
- 희귀: 40%

**특수 처리**
- 해당 등급 카드 없으면 자동으로 가중치 재계산
- 시뮬레이션 함수 제공: `simulateGacha(1000)`

---

## 보안 규칙

### Firestore Rules 원칙
```
cards, missions:
  - read: ADMIN_UID || SHARED_UID
  - write: ADMIN_UID만

state/shared:
  - read/write: ADMIN_UID || SHARED_UID

나머지:
  - 모두 거부
```

**왜 UID 기반?**
- API 키가 공개되므로 "request.auth != null"만으로 부족
- 허용된 2개 UID만 접근 가능하도록 명시적 제어

---

## 도감 & 필터

### 데이터 흐름
```
state/shared.owned: {
  cardId: {
    count: number,
    firstAt: "YYYY-MM-DD"
  },
  ...
}
```

### 필터 & 정렬
- 필터: 등급, 분류, 전체/보유/미보유
- 정렬: 번호순(기본), 최근 획득순 (firstAt 기준)
- 모두 클라이언트 사이드 (Firestore 쿼리 아님)

---

## UI/UX 결정사항

### 카드 레이아웃
- 5:7 비율 (aspect-ratio)
- 모바일에서 2열 이상 (minmax(80px, 1fr))
- 모든 버튼 최소 44px (터치 친화)

### 연출
- 카드 뒤집기: 0.7초 CSS 3D transform
- NEW 배지: 펄스 애니메이션 (1.5초)
- prefers-reduced-motion 대응 (연출 스킵)

### 에러 처리
- 활성 카드 없음: "뽑을 수 있는 카드가 없습니다"
- 뽑기권 없음: "뽑기권이 없습니다. 내일 다시 시도해주세요"
- 모든 필터 결과 없음: "필터 조건에 맞는 카드가 없습니다"

---

## 남은 결정사항

### 오늘의 미션 (6단계)
- 하루 1개 자동 배정 (KST)
- 미출현 미션 위주로 랜덤
- 소진되면 순환
- 완료 체크만 (사진/메모 불가, MVP 범위)

### 카드 수정
- 현재: 삭제 후 재추가 (admin.html의 "수정" 버튼은 alert)
- 나중에: 도감번호 유니크성 검사 후 구현 가능

---

## 성능 고려사항

### Firestore
- 카드 50장 기준 도감 로딩 약 2~3MB
- enableIndexedDbPersistence로 오프라인 캐시 활성화
- 재방문 시 캐시에서 읽음 (네트워크 요청 없음)

### 나중에 확장 시
- 카드 수 > 100장: Firebase Storage + Blaze 플랜으로 이전
- 도감 가상 스크롤 추가 가능
