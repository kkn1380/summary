# 로컬 테스트 vs 배포

## 🏠 로컬 테스트

### 목적
- R2 설정 전에 기능 확인
- 데이터 구조 확인
- UI/UX 테스트

### 데이터 위치
```
data/site/
  ├── index.json          ← 로컬 파일
  ├── summaries/
  │   ├── 2026-02-11.json ← 로컬 파일
  │   └── 2026-02-10.json
  └── index.html          ← 로컬 파일 읽기
```

### 실행 방법

#### 방법 1: 한 번에 (추천)
```bash
npm run test:local
npm run serve:site
```

#### 방법 2: 단계별
```bash
# 1. 로컬 데이터 생성
npm run upload:r2 -- --local-only

# 2. 로컬용 HTML 생성
npm run generate:local

# 3. 서버 실행
npm run serve:site
```

### 확인
- http://localhost:8000 접속
- 오늘 데이터 즉시 표시
- 과거 날짜 클릭 시 로딩

## ☁️ Cloudflare 배포

### 목적
- 실제 서비스 운영
- GitHub에 summary 올리지 않기
- 전 세계 빠른 속도 (CDN)

### 데이터 위치
```
Cloudflare R2:
  /index.json          ← R2 파일
  /summaries/
    2026-02-11.json    ← R2 파일
    2026-02-10.json

Cloudflare Pages:
  index.html           ← R2 파일 읽기
```

### 실행 방법

#### 1회 설정
```bash
# .env 파일 설정 (CLOUDFLARE_CREDENTIALS.md 참고)
CLOUDFLARE_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

#### 매일 실행
```bash
# 1. 새 동영상 모니터링
npm run monitor

# 2. R2 업로드
npm run upload:r2

# 3. Pages용 HTML 생성 (한 번만)
npm run generate:dynamic
```

### 확인
- https://your-project.pages.dev 접속
- R2에서 데이터 로딩
- 전 세계 어디서나 빠름

## 🔄 워크플로우 비교

### 로컬 개발
```
코드 수정
  ↓
npm run test:local
  ↓
npm run serve:site
  ↓
http://localhost:8000 확인
```

### 실제 배포
```
npm run monitor (새 동영상)
  ↓
npm run upload:r2 (R2 업로드)
  ↓
Cloudflare Pages 자동 재배포
  ↓
https://your-site.pages.dev 확인
```

## 📊 명령어 비교

| 작업 | 로컬 | 배포 |
|------|------|------|
| 데이터 생성 | `npm run upload:r2 -- --local-only` | `npm run upload:r2` |
| HTML 생성 | `npm run generate:local` | `npm run generate:dynamic` |
| 확인 | `npm run serve:site` | 브라우저에서 Pages URL |
| 데이터 위치 | `data/site/` | Cloudflare R2 |
| HTML 읽기 | 로컬 파일 (`.`) | R2 URL |

## 🎯 언제 무엇을 사용?

### 로컬 테스트 사용 시점
- ✅ 처음 설정할 때
- ✅ UI 변경 테스트
- ✅ R2 설정 전
- ✅ 오프라인 작업

### 배포 사용 시점
- ✅ 실제 서비스 운영
- ✅ 다른 사람과 공유
- ✅ 자동화 스크립트
- ✅ GitHub에 summary 올리지 않을 때

## 🆘 문제 해결

### 로컬: "데이터를 불러오는데 실패했습니다"
```bash
# 1. 데이터 파일 확인
ls data/site/index.json
ls data/site/summaries/

# 2. 없으면 생성
npm run upload:r2 -- --local-only

# 3. HTML 재생성
npm run generate:local

# 4. 서버 재시작
npm run serve:site
```

### 배포: "데이터를 불러오는데 실패했습니다"
```bash
# 1. R2 Public URL 확인
curl https://pub-xxx.r2.dev/index.json

# 2. 404면 업로드
npm run upload:r2

# 3. HTML의 R2_PUBLIC_URL 확인
cat data/site/index.html | grep "R2_PUBLIC_URL"

# 4. 틀렸으면 .env 수정 후 재생성
npm run generate:dynamic
```

## ✅ 체크리스트

### 로컬 테스트
- [ ] `npm run test:local` 실행
- [ ] `data/site/index.json` 존재 확인
- [ ] `data/site/summaries/` 폴더 확인
- [ ] `npm run serve:site` 실행
- [ ] http://localhost:8000 접속 확인
- [ ] 오늘 데이터 표시 확인
- [ ] 과거 날짜 클릭 확인

### Cloudflare 배포
- [ ] `.env` 파일 R2 설정 완료
- [ ] `npm run upload:r2` 성공
- [ ] R2 버킷에 파일 확인
- [ ] `npm run generate:dynamic` 실행
- [ ] Cloudflare Pages 배포
- [ ] Pages URL 접속 확인
- [ ] 데이터 로딩 확인

완료! 🎉
