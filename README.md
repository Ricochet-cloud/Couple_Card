# 추억카드뽑기 🎴

> 우리 둘만의 추억을 카드로 모으고, 매일 뽑기로 하나씩 꺼내보는 웹사이트

<!-- English below -->

## 🎯 프로젝트 소개

두 사람이 함께한 추억(사진 + 한 줄 설명)을 **카드로 만들어 수집**하고, **매일 뽑기**로 하나씩 꺼내보며 추억을 되살리는 작은 웹사이트입니다.  
- ✨ 매일 자동으로 뽑기권 1장 지급
- 🎲 등급별 확률로 공정한 뽑기 시스템
- 📖 포켓몬 도감 스타일의 수집 시스템
- 🎯 일일 미션으로 매일 방문 습관 형성
- 👨‍💼 코드 수정 없이 관리자 페이지에서 카드/미션 관리

**기술 스택**: HTML / CSS / 순수 JavaScript (ES Modules) + Firebase  
**배포**: GitHub Pages  
**지원**: 모바일 우선 반응형 디자인

---

## ✨ 주요 기능

### 🎴 카드 뽑기
- 매일 자동 1장 지급, 미사용분 누적
- 6단계 등급 시스템 (울트라 / 전설 / 신화 / 영웅 / 초희귀 / 희귀)
- 등급별 확률로 공정한 추첨
- 카드 뒤집기 연출 애니메이션

### 📚 도감 (포켓몬 도감 스타일)
- 번호순 카드 그리드
- 미보유 카드는 실루엣으로 표시
- 수집률 표시 및 등급별 통계
- 등급 / 분류 / 보유 여부별 필터
- 카드 상세 정보 (사진, 설명, 추억 날짜, 보유 수량)

### 🎯 일일 미션
- 매일 새로운 미션 배정
- 완료 체크로 일일 습관 형성

### 👨‍💼 관리자 페이지
- 카드 추가 / 수정 / 비활성화
- 사진 업로드 (브라우저에서 WebP 자동 변환)
- 미션 추가 / 수정
- 뽑기권 추가 지급
- 저장 즉시 사이트에 반영 (배포 불필요)

---

## 🚀 시작하기

### 사전 준비

1. **Firebase 프로젝트 생성**
   - [Firebase Console](https://console.firebase.google.com)에서 새 프로젝트 생성
   - 프로젝트 설정 > 일반 탭에서 firebaseConfig 값 복사

2. **계정 생성**
   - Authentication > Users에서 이메일/비밀번호로 계정 2개 생성
   - 각각의 UID 복사 (관리자 UID 1개, 공용 UID 1개)

3. **보안 규칙 적용**
   - Firestore > Rules 탭에서 [`firestore.rules`](./firestore.rules) 파일의 내용 복사
   - `YOUR_ADMIN_UID`, `YOUR_SHARED_UID` 부분을 실제 UID로 변경
   - 규칙 게시

4. **설정 파일 작성**
   - `js/firebase-config.js` 생성 (`.gitignore`에 이미 등록)
   ```javascript
   export const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT.appspot.com",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };

   export const ADMIN_UID = "YOUR_ADMIN_UID";
   export const SHARED_UID = "YOUR_SHARED_UID";
   ```

5. **Firestore 컬렉션 초기화**
   - Firestore에서 `cards`, `missions` 컬렉션 생성
   - `state/shared` 문서 생성하고 다음 필드 초기화:
     ```json
     {
       "tickets": 1,
       "lastGrantDate": "2026-10-12",
       "owned": {},
       "daily": { "date": "", "missionId": "", "done": false },
       "usedMissionIds": []
     }
     ```

### 로컬 실행

```bash
# 로컬 서버 시작 (포트 8000)
python3 -m http.server

# 또는 VS Code Live Server 확장 사용
```

브라우저에서 `http://localhost:8000`으로 접속

### 배포 (GitHub Pages)

```bash
git push origin main
```

GitHub Settings > Pages에서 "Deploy from a branch"로 설정하고 main 브랜치 선택

---

## 📁 프로젝트 구조

```
Couple_Card/
├── index.html              # 홈 (뽑기권, 미션, 뽑기 버튼)
├── login.html              # 로그인 페이지
├── draw.html               # 뽑기 결과 화면
├── collection.html         # 도감 (포켓몬 도감 스타일)
├── admin.html              # 관리자 페이지
├── sichuan-standalone.html # 미니게임 (사천성)
│
├── css/
│   └── style.css           # 공통 스타일 (모바일 우선)
│
├── js/
│   ├── firebase-config.js  # 🔒 Firebase 설정 (미커밋)
│   ├── firebase.js         # Firebase SDK 초기화
│   ├── auth.js             # 인증 로직
│   ├── draw.js             # 뽑기 로직
│   ├── collection.js       # 도감 로직
│   └── admin.js            # 관리자 페이지 로직
│
├── firestore.rules         # Firestore 보안 규칙
├── CLAUDE.md               # 개발 규칙 & 제약사항
└── README.md               # 이 파일
```

---

## 🛠️ 개발

### 기술 규칙

- **빌드 도구 없음**: 순수 HTML / CSS / JavaScript (ES Modules)만 사용
- **상대 경로**: GitHub Pages 서브 경로 호환을 위해 모든 링크은 상대 경로
- **보안 설정**: `firebase-config.js`는 `.gitignore`에 등록되어 있음
- **시간**: 항상 한국 시간(Asia/Seoul) KST 기준
- **메타 태그**: 모든 페이지에 `<meta name="robots" content="noindex">` 필수

### 카드 데이터 모델

```javascript
{
  dexNo: 1,                    // 도감 번호 (고유)
  title: "우리의 첫 만남",
  description: "서울 명동에서",
  photoData: "data:image/webp;base64,...", // base64 인코딩된 WebP
  rarity: "legend",            // ultra / legend / myth / hero / superrare / rare
  category: "데이트",
  memoryDate: "2024-03-15",
  active: true,
  createdAt: Timestamp
}
```

### 뽑기 확률 (조정 가능)

```javascript
const RARITY_RATES = {
  "ultra": 0.02,      // 2%
  "legend": 0.05,     // 5%
  "myth": 0.08,       // 8%
  "hero": 0.15,       // 15%
  "superrare": 0.30,  // 30%
  "rare": 0.40        // 40%
};
```

---

## 🔐 보안

### Firestore 접근 제어

- **인증 방식**: 이메일/비밀번호
- **허용 대상**: 관리자 UID + 공용 UID 2개만
- **읽기 권한**: `cards`, `missions` - 두 UID 모두 읽기 가능
- **쓰기 권한**: `cards`, `missions` - 관리자 UID만 가능
- **공유 상태**: `state/shared` - 두 UID 모두 읽기/쓰기

### 주의사항

- Firebase API 키가 공개되므로 비승인 계정 생성 방지 = UID 기반 접근 제어 필수
- `firebase-config.js` 절대 커밋 금지
- 사진은 base64로 Firestore에 저장 (Storage 비용 절감)
- 카드당 약 30~60KB, 50장 기준 약 2~3MB

---

## 📚 커넥션

- **Firestore 로컬 캐시**: 재방문 시 네트워크 요청 최소화
- **트랜잭션**: 뽑기, 권 지급/차감 시 중복 방지
- **사진 변환**: 브라우저에서 WebP 자동 변환 (모바일 최적화)

---

## 🚦 배포 체크리스트

- [ ] Firebase 프로젝트 생성 및 설정
- [ ] 계정 2개 생성 및 UID 확보
- [ ] `firebase-config.js` 작성
- [ ] `firestore.rules` 적용
- [ ] `state/shared` 문서 초기화
- [ ] 초기 카드 / 미션 추가
- [ ] 로컬 테스트 완료
- [ ] GitHub 저장소 설정 완료
- [ ] GitHub Pages 배포

---

## 📄 라이선스

개인 프로젝트  
Firebase 이용 약관 준수

---

## 🤝 기여

이 프로젝트는 개인 프로젝트이므로 외부 기여는 받지 않습니다.

---

<div align="center">

**Happy Memories! 🎉**

</div>
