---
name: project_overview
description: 추억카드뽑기 프로젝트 개요 및 핵심 정보
metadata:
  type: project
---

## 프로젝트: 추억카드뽑기 웹사이트

**목표**: 커플이 함께한 추억을 카드로 모으고 뽑기로 하나씩 꺼내보는 재미있는 웹사이트

**기술 스택**:
- HTML / CSS / 순수 JavaScript (ES Modules, 빌드 도구 없음)
- Firebase Authentication (이메일/비밀번호)
- Firestore (데이터 저장)
- GitHub Pages 배포

## 핵심 계정 구조

- **관리자 (1명)**: 나 → 뽑기, 도감, 미션, 관리자 페이지 접근
- **공용 (1명)**: 여자친구 → 뽑기, 도감, 미션만 가능
- UID 기반 접근 제어 (2개 UID만 허용)

## 주요 기능

1. **뽑기권**: 매일 1장 자동 지급 (KST 기준), 미사용분은 누적
2. **카드뽑기**: 등급 먼저 추첨 → 해당 등급 카드 중 랜덤
3. **도감**: 포켓몬 도감 스타일 (실루엣, 수집률, 필터)
4. **일일 미션**: 매일 새로운 미션 배정
5. **관리자 페이지**: 카드/미션/뽑기권 관리 (코드 수정 없음)

## 초기 설정 절차 (사용자 입력 필요)

1. Firebase 프로젝트 생성
2. Authentication: 이메일/비밀번호로 계정 2개 생성 → UID 복사
3. `js/firebase-config.js` 업데이트:
   - `firebaseConfig` 객체에 Firebase 콘솔의 config 값 입력
   - `ADMIN_UID`, `SHARED_UID` 입력
4. `firestore.rules`: 위의 두 UID를 'YOUR_ADMIN_UID', 'YOUR_SHARED_UID'로 바꾼 후 콘솔에 적용
5. Firestore 컬렉션 초기화: `cards`, `missions`, `state/shared` 생성
6. 로컬 테스트: `python3 -m http.server` 또는 Live Server

## 파일 구조

```
css/
  style.css          ← 공통 스타일
js/
  firebase-config.js ← API 키 & UID (미리 작성, .gitignore)
  firebase.js        ← Firebase SDK 초기화
  auth.js            ← 인증 로직 (로그인 상태, 가드, 로그아웃)
login.html           ← 로그인 페이지
index.html           ← 홈 (뽑기권, 미션, 뽑기 버튼)
draw.html            ← 뽑기 결과 (카드 뒤집기 연출)
collection.html      ← 도감 (그리드, 필터)
admin.html           ← 관리자 페이지 (카드/미션/뽑기권)
firestore.rules      ← Firestore 보안 규칙 (콘솔에 붙여넣기용)
CLAUDE.md            ← 기술 규칙 (반드시 준수)
.gitignore           ← 보안: firebase-config.js 제외
```

## 주의사항

- 모든 페이지에서 상대 경로만 사용 (GitHub Pages 서브 경로 호환)
- firebase-config.js는 절대 커밋 금지 (.gitignore에 이미 등록)
- 시간은 항상 KST (Asia/Seoul) 기준
- 모든 페이지에 `<meta name="robots" content="noindex">` 필수
