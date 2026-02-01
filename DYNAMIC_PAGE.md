# 동적 페이지 구조 (Dynamic Page Architecture)

## 🎯 변경 사항

기존의 정적 HTML 생성 방식에서 **동적 데이터 로딩 방식**으로 변경되었습니다.

### Before (정적 방식)
```
매번 실행 시:
1. latest.json 생성
2. index.html 재생성 (데이터 embed)
3. index.mobile.html 재생성 (데이터 embed)
```

### After (동적 방식)
```
최초 1회:
1. index.html 생성 (템플릿만, 데이터 없음)
2. index.mobile.html 생성 (템플릿만, 데이터 없음)

매번 실행 시:
1. latest.json만 업데이트
2. HTML은 변경하지 않음
```

## 📁 파일 구조

```
data/site/
├── index.html          # 동적 페이지 (한 번만 생성)
├── index.mobile.html   # 모바일 동적 페이지 (한 번만 생성)
└── latest.json         # 데이터 파일 (매번 업데이트)
```

## 🔄 동작 방식

### 1. HTML 파일 (정적 템플릿)
- 페이지 구조와 스타일만 포함
- JavaScript로 `latest.json`을 fetch
- 데이터를 동적으로 렌더링

### 2. JSON 파일 (동적 데이터)
```json
{
  "generatedAt": "2026-02-01T12:00:00.000Z",
  "count": 10,
  "items": [
    {
      "title": "영상 제목",
      "channelName": "채널명",
      "publishedAt": "2026-02-01T10:00:00.000Z",
      "url": "https://youtube.com/watch?v=...",
      "summary": "요약 내용...",
      "processedAt": "2026-02-01T12:00:00.000Z"
    }
  ]
}
```

## ✅ 장점

### 1. 서버 불필요
- 순수 JavaScript만 사용
- GitHub Pages, Netlify, Vercel 등 정적 호스팅 가능
- CORS 문제 없음 (같은 도메인)

### 2. 효율성
- HTML 파일은 한 번만 생성
- 매번 JSON만 업데이트 (파일 크기 작음)
- Git diff가 깔끔함 (JSON만 변경)

### 3. 유지보수
- HTML 템플릿 수정 시 한 곳만 변경
- 데이터와 UI 분리
- 캐싱 전략 적용 가능

### 4. 성능
- 초기 로딩 후 JSON만 fetch
- 브라우저 캐싱 활용 가능
- 페이지 크기 감소

## 🚀 사용 방법

### 최초 실행
```bash
# HTML 파일이 없으면 자동 생성됨
npm run monitor
```

### 이후 실행
```bash
# latest.json만 업데이트됨
npm run monitor
```

### HTML 재생성이 필요한 경우
```bash
# HTML 파일 삭제 후 재실행
rm data/site/index.html data/site/index.mobile.html
npm run monitor
```

## 🌐 호스팅

### GitHub Pages
```bash
# gh-pages 브랜치에 data/site/ 내용 푸시
git subtree push --prefix data/site origin gh-pages
```

### Netlify / Vercel
- `data/site/` 디렉터리를 배포 디렉터리로 설정
- 자동 배포 설정

### 로컬 테스트
```bash
# 간단한 HTTP 서버 실행
cd data/site
python3 -m http.server 8000
# 또는
npx serve .
```

브라우저에서 `http://localhost:8000` 접속

## 🔧 커스터마이징

### JSON 파일 경로 변경
`src/sitePublisher.ts`의 `renderDynamicHtml` 함수에서:
```javascript
const dataUrl = './latest.json';  // 이 부분 수정
```

### 다른 데이터 소스 사용
```javascript
// 예: API 엔드포인트
const dataUrl = 'https://api.example.com/summaries';

// 예: 다른 JSON 파일
const dataUrl = './data/2026-02.json';
```

## 📊 비교

| 항목 | 정적 방식 | 동적 방식 |
|------|----------|----------|
| HTML 생성 | 매번 | 최초 1회 |
| JSON 생성 | 매번 | 매번 |
| 파일 크기 | 큼 (데이터 포함) | 작음 (템플릿만) |
| Git diff | 복잡 | 간단 |
| 서버 필요 | ❌ | ❌ |
| 브라우저 호환 | ✅ | ✅ (fetch API) |
| SEO | ✅ | ⚠️ (CSR) |

## 🎨 프레임워크 비교

현재 구현은 **순수 JavaScript**를 사용합니다.

### 다른 옵션들

#### React/Vue/Svelte
```
장점: 복잡한 UI, 컴포넌트 재사용
단점: 빌드 필요, 번들 크기 증가
적합성: ❌ 현재 프로젝트에는 오버킬
```

#### Next.js/Nuxt
```
장점: SSR, SEO 최적화
단점: 서버 필요, 복잡도 증가
적합성: ❌ 정적 호스팅 불가
```

#### 순수 JavaScript (현재)
```
장점: 가볍고 빠름, 서버 불필요
단점: 없음 (이 규모에서는)
적합성: ✅ 완벽
```

## 🔐 보안

### CORS
- 같은 도메인에서 JSON을 fetch하므로 CORS 문제 없음
- 외부 API 사용 시 CORS 설정 필요

### XSS 방지
- `textContent` 사용으로 XSS 방지
- HTML 삽입 시 sanitize 필요

## 📝 마이그레이션 가이드

### 기존 정적 페이지에서 전환

1. **브랜치 전환**
```bash
git checkout feature/dynamic-page
```

2. **빌드**
```bash
npm run build
```

3. **기존 HTML 삭제**
```bash
rm data/site/index.html data/site/index.mobile.html
```

4. **실행**
```bash
npm run monitor
```

5. **확인**
```bash
cd data/site
python3 -m http.server 8000
```

## 🐛 트러블슈팅

### JSON 로드 실패
```
문제: "데이터를 불러올 수 없습니다"
해결: 
1. latest.json 파일 존재 확인
2. 파일 권한 확인
3. 브라우저 콘솔에서 에러 확인
```

### CORS 에러
```
문제: "CORS policy blocked"
해결:
1. 로컬 서버 사용 (file:// 프로토콜 대신)
2. 같은 도메인에서 호스팅
```

### 데이터가 표시되지 않음
```
문제: 빈 페이지
해결:
1. 브라우저 콘솔 확인
2. latest.json 형식 확인
3. JavaScript 에러 확인
```

## 🎯 결론

동적 페이지 방식은:
- ✅ 서버 없이 동작
- ✅ 효율적인 업데이트
- ✅ 깔끔한 Git 히스토리
- ✅ 쉬운 유지보수

현재 프로젝트에 **최적의 선택**입니다!
