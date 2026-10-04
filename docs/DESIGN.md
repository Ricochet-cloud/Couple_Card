# 스타듀밸리 감성 디자인 가이드

> "따뜻한 농장 일기장" - 아늑하고 귀여운 도트 감성으로 우리의 추억을 함께 모아요.

## 색 토큰 (css/base.css)

```css
:root {
  /* 따뜻한 농장 팔레트 */
  --bg-cream: #f5f1e8;           /* 양피지 배경 (메인) */
  --wood-dark: #8b5a3c;          /* 짙은 나무 갈색 (테두리, 텍스트) */
  --wood-light: #d4a574;         /* 밝은 나무 (버튼 배경) */
  --grass-green: #6b9e3d;        /* 잔디 초록 (액센트, 활성) */
  --sky-blue: #87ceeb;           /* 하늘색 (보조 액센트) */
  --gold: #ffd700;               /* 금색 (특별함, NEW 배지) */
  --text-dark: #3d2817;          /* 진한 갈색 텍스트 */
  --text-muted: #8b7355;         /* 연한 갈색 텍스트 */
  --border: #c9a881;             /* 도트 테두리 */
  --error: #d63031;              /* 주의 (밝되 따뜻함) */
}
```

## 폰트 (Galmuri 도트 폰트)

**설치**:
1. `fonts/Galmuri-11.ttf` 또는 `fonts/Galmuri-9.ttf` 파일을 준비
   - 출처: https://github.com/daruling/galmuri (OFL 라이선스)
   - 또는 수동으로 다운로드: https://releases.ubuntu.com/font-files/

**CSS**:
```css
@font-face {
  font-family: 'Galmuri';
  src: url('../fonts/Galmuri-11.ttf') format('truetype');
}

body {
  font-family: 'Galmuri', 'Apple SD Gothic Neo', sans-serif;
  font-size: 11px;        /* 도트 폰트 기본 크기 */
  line-height: 1.6;
  image-rendering: pixelated;  /* 도트 텍스처 강조 */
}
```

**사이즈**:
- 본문: 11px
- 제목 (h1): 22px (2배)
- 부제목 (h2): 16px (1.5배)
- 레이블: 9px
- 버튼: 11px

## 컴포넌트 스타일

### 패널 (나무 틀)

**도트 계단 모서리** - CSS로 구현:
```css
.panel {
  background: var(--bg-cream);
  border: 2px solid var(--wood-dark);
  
  /* 도트 계단 모서리 */
  box-shadow: 
    2px 2px 0 var(--wood-dark),    /* 오른쪽 아래 */
    -1px -1px 0 var(--wood-light)  /* 왼쪽 위 (하이라이트) */;
  
  padding: 16px;
  border-radius: 0;  /* 정사각형 */
}
```

### 버튼

```css
.btn {
  background: var(--wood-light);
  color: var(--text-dark);
  border: 2px solid var(--wood-dark);
  padding: 8px 16px;
  font-family: 'Galmuri';
  cursor: pointer;
  
  /* 누를 때 깊이감 */
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.2);
  transition: all 0.1s steps(1);
}

.btn:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 활성 상태 */
.btn.active {
  background: var(--grass-green);
  color: white;
}

/* 주의 (위험) */
.btn.danger {
  background: var(--error);
  color: white;
}
```

### 입력창 (Input, Textarea, Select)

```css
input, textarea, select {
  background: white;
  border: 2px solid var(--wood-dark);
  padding: 8px;
  font-family: 'Galmuri';
  font-size: 11px;
  color: var(--text-dark);
  
  /* 도트 스타일 */
  box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.8);
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--grass-green);
  box-shadow: 
    inset 1px 1px 0 rgba(255, 255, 255, 0.8),
    0 0 0 2px var(--grass-green);
}
```

### 탭

```css
.tab-btn {
  background: var(--wood-light);
  border: 2px solid var(--wood-dark);
  padding: 8px 16px;
  margin-right: 4px;
  cursor: pointer;
  transition: all 0.1s steps(1);
  font-family: 'Galmuri';
}

.tab-btn.active {
  background: var(--grass-green);
  color: white;
  transform: translateY(-2px);  /* 들뜬 느낌 */
}
```

### 메시지 박스

```css
.message {
  padding: 12px;
  border: 2px solid var(--wood-dark);
  background: var(--bg-cream);
  font-family: 'Galmuri';
  margin-bottom: 12px;
}

.message.success {
  border-color: var(--grass-green);
  background: rgba(107, 158, 61, 0.1);
}

.message.error {
  border-color: var(--error);
  background: rgba(214, 48, 49, 0.1);
}

.message.info {
  border-color: var(--sky-blue);
  background: rgba(135, 206, 235, 0.1);
}
```

## 간격 규칙 (8px 기본 단위)

```
기본: 8px
더블: 16px
세배: 24px
네배: 32px
```

## 움직임 & 애니메이션

**원칙**: 도트 감성 유지 (부드러운 곡선 금지)
```css
/* 도트처럼 끊기는 움직임 */
transition: all 0.1s steps(2);  /* 정적 → 동적 (2단계) */

/* 더 역동적일 때 */
transition: all 0.15s steps(3);

/* 킬임 대신 opacity 페이드 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

## 그림자 규칙

**금지**:
- filter: blur(), drop-shadow() (흐릿함)
- 큰 spread radius

**허용** (도트 느낌):
```css
/* 깊이 */
box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.2);

/* 선택 상태 */
box-shadow: 0 0 0 3px var(--grass-green);

/* 내부 깊이 */
box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.8);
```

## 모서리 규칙

- **기본**: `border-radius: 0` (정사각형)
- **약간 둥글게**: `border-radius: 2px` (도트 계단 스타일 유지)
- **금지**: `border-radius: 8px 이상` (너무 부드러움)

## 반응형

- 모바일 (360px 이하): 패딩 12px, 폰트 10px 가능
- 타블릿 (768px): 기본
- 데스크톱 (1280px+): 기본, 패널 간격 증가 가능

## 특수 요소

### 카드 (Card)
```css
.card {
  background: var(--bg-cream);
  border: 3px solid var(--wood-dark);
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.1);
  aspect-ratio: 5/7;
  
  /* 테두리 하이라이트 (입체감) */
  outline: 1px solid var(--wood-light);
  outline-offset: -6px;
}
```

### 모달 배경
```css
.modal-overlay {
  background: rgba(61, 40, 23, 0.7);  /* 따뜻한 그림자 */
  backdrop-filter: none;  /* 블러 금지 */
}
```

### 배지 (NEW, 상태)
```css
.badge {
  background: var(--gold);
  color: var(--text-dark);
  padding: 4px 8px;
  border: 1px solid var(--wood-dark);
  font-size: 9px;
  font-weight: bold;
  border-radius: 0;
  
  /* 도트 애니메이션 (펄스) */
  animation: pulse 0.6s steps(3) infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
```

## 접근성 (prefers-reduced-motion)

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

**예시 컬러 조합**:
```
기본: 양피지(#f5f1e8) 배경 + 나무(#8b5a3c) 텍스트
액센트: 잔디(#6b9e3d) 활성, 금색(#ffd700) 특별함
경고: 따뜻한 빨강(#d63031)
```
