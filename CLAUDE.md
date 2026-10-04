# Couple Card Project - Technical Rules

## 기술 스택 및 제약 사항

- **빌드 도구, 프레임워크, npm 없음**: 순수 HTML/CSS/JavaScript(ES Modules)만 사용
- **Firebase Web SDK**: gstatic CDN의 modular 버전 사용, 버전은 최신 안정 버전을 확인해 한 곳(js/firebase-config.js)에 명시
- **배포**: GitHub Pages(저장소 하위 경로)에서 동작해야 하므로 **모든 링크과 import는 반드시 상대 경로 사용**
- **페이지 구성**: 화면마다 HTML 파일 (리다이렉트 미지원)
- **반응형**: 모바일 우선, 버튼 터치 영역 최소 44px, `<meta viewport>` 필수
- **메타 태그**: 모든 페이지에 `<meta name="robots" content="noindex">` 추가

## 코딩 규칙

- **시간**: 항상 한국 시간(Asia/Seoul) 기준, YYYY-MM-DD 문자열 형식
- **단순성**: 파일 하나는 한 가지 역할만. 불필요한 추상화 금지
- **보안**: 비밀 키, 서비스 계정 JSON, 사진 원본은 절대 커밋 금지 (.gitignore에 반영)

## Firestore 보안 규칙 원칙

- 허용 UID 2개(관리자, 공용)만 접근 가능
- `"request.auth != null"`만으로는 부족 (API 키 공개 때문에 누구나 가입 가능)
- **UID 기반 접근 제어**:
  - `cards`, `missions`: 두 UID 읽기 가능, **관리자 UID만 쓰기**
  - `state/shared`: 두 UID 모두 읽기/쓰기
  - 나머지 경로는 전부 거부
