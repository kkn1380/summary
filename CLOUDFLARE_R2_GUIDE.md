# Cloudflare R2 + Pages 배포 가이드

## 🎯 아키텍처 개요

```
로컬 PC (데이터 수집)
    ↓
Cloudflare R2 (summary 저장)
    ├── /index.json (메타데이터 + 오늘 데이터)
    └── /summaries/
        ├── 2026-02-11.json
        ├── 2026-02-10.json
        └── ...
    ↓
Cloudflare Pages (프론트엔드)
    └── index.html (동적 로딩)
```

## 📋 1단계: Cloudflare R2 설정

### 1.1 R2 버킷 생성

1. [Cloudflare Dashboard](https://dash.cloudflare.com) 로그인
2. 좌측 메뉴 → **R2** 클릭
3. **Create bucket** 클릭
4. 버킷 이름 입력 (예: `youtube-summaries`)
5. **Create bucket** 클릭

### 1.2 Public Access 설정

1. 생성한 버킷 클릭
2. **Settings** 탭
3. **Public Access** 섹션에서 **Allow Access** 클릭
4. **Custom Domains** 또는 **R2.dev subdomain** 선택
   - R2.dev subdomain 사용 시: 자동으로 `https://pub-xxxxx.r2.dev` 생성됨
   - Custom Domain 사용 시: 본인 도메인 연결 가능

5. 생성된 Public URL 복사 (예: `https://pub-abc123.r2.dev`)

### 1.2.1 CORS 설정 (필수!)

**중요**: Cloudflare Pages에서 R2 데이터를 읽으려면 CORS 설정이 필수입니다.

1. 버킷 페이지에서 **Settings** 탭
2. **CORS Policy** 섹션 찾기
3. **Add CORS policy** 또는 **Edit** 클릭
4. 다음 JSON 입력:

```json
[
  {
    "AllowedOrigins": [
      "https://summary-30h.pages.dev",
      "https://*.pages.dev",
      "http://localhost:8000"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**설명**:
- `AllowedOrigins`: Pages 도메인과 로컬 테스트 허용
- `AllowedMethods`: GET, HEAD만 허용 (읽기 전용)
- `MaxAgeSeconds`: 1시간 동안 CORS preflight 캐시

5. **Save** 클릭

**참고**: 
- Pages 도메인이 다르면 `AllowedOrigins`에 본인 도메인 추가
- Custom Domain 사용 시 해당 도메인도 추가

### 1.3 API Token 생성

1. R2 메인 페이지 → **Manage R2 API Tokens**
2. **Create API token** 클릭
3. Token 이름 입력 (예: `youtube-summary-upload`)
4. Permissions:
   - **Object Read & Write** 선택
5. **Create API Token** 클릭
6. 다음 정보 복사 (한 번만 표시됨!):
   - **Access Key ID** (S3 호환 Access Key)
   - **Secret Access Key** (S3 호환 Secret Key)

**중요**: Token 값 자체는 필요 없습니다. Access Key ID와 Secret Access Key만 사용합니다.

### 1.4 Account ID 확인

Account ID는 다음 방법으로 확인할 수 있습니다:

**방법 1**: Dashboard 우측 사이드바
- Cloudflare Dashboard 접속
- 우측 사이드바에 **Account ID** 표시됨

**방법 2**: URL에서 확인
- R2 페이지 URL: `https://dash.cloudflare.com/{account_id}/r2`
- 중괄호 안의 값이 Account ID

**방법 3**: API Token 생성 페이지
- API Token 생성 화면 상단에 Account ID 표시

### 1.5 .env 파일 설정

```bash
# Cloudflare R2 Configuration

# Account ID: Dashboard 우측 사이드바 또는 R2 URL에서 확인
# 예: https://dash.cloudflare.com/{account_id}/r2
CLOUDFLARE_ACCOUNT_ID=your_account_id_here

# API Token 생성 시 받은 Access Key (S3 호환)
R2_ACCESS_KEY_ID=your_access_key_id_here
R2_SECRET_ACCESS_KEY=your_secret_access_key_here

# 버킷 이름
R2_BUCKET_NAME=youtube-summaries

# R2 Public URL (버킷 설정에서 확인)
R2_PUBLIC_URL=https://pub-abc123.r2.dev
```

**참고**: 
- Token 값 자체는 필요 없습니다
- Access Key ID와 Secret Access Key만 사용 (S3 호환 방식)
- Account ID는 엔드포인트 URL 생성에 사용됩니다

## 📋 2단계: 로컬 테스트

### 2.1 의존성 설치

```bash
npm install
```

### 2.2 로컬에 데이터 생성 (테스트)

```bash
# 로컬에만 JSON 파일 생성
npm run upload:r2 -- --local-only
```

생성된 파일 확인:
```
data/site/
  ├── index.json
  └── summaries/
      ├── 2026-02-11.json
      ├── 2026-02-10.json
      └── ...
```

### 2.3 동적 HTML 생성

```bash
npm run generate:dynamic
```

생성된 파일: `data/site/index.html`

### 2.4 로컬 서버로 테스트

```bash
npm run serve:site
```

브라우저에서 `http://localhost:8000` 접속하여 확인

## 📋 3단계: R2에 데이터 업로드

### 3.1 첫 업로드

```bash
# 로컬 + R2 모두 업로드
npm run upload:r2
```

### 3.2 업로드 확인

1. Cloudflare Dashboard → R2 → 버킷 클릭
2. **Objects** 탭에서 파일 확인:
   - `index.json`
   - `summaries/2026-02-11.json`
   - `summaries/2026-02-10.json`
   - ...

3. Public URL로 접근 테스트:
   ```
   https://pub-abc123.r2.dev/index.json
   https://pub-abc123.r2.dev/summaries/2026-02-11.json
   ```

## 📋 4단계: Cloudflare Pages 배포

### 4.1 Pages 프로젝트 생성

1. Cloudflare Dashboard → **Pages**
2. **Create a project** 클릭
3. **Connect to Git** 선택
4. GitHub 저장소 선택
5. Build settings:
   - **Framework preset**: None
   - **Build command**: `npm run generate:dynamic`
   - **Build output directory**: `data/site`
6. **Environment variables** 추가:
   ```
   R2_PUBLIC_URL=https://pub-abc123.r2.dev
   ```
7. **Save and Deploy** 클릭

### 4.2 수동 배포 (Git 없이)

```bash
# 1. HTML 생성
npm run generate:dynamic

# 2. Wrangler 설치 (Cloudflare CLI)
npm install -g wrangler

# 3. 로그인
wrangler login

# 4. Pages 배포
wrangler pages deploy data/site --project-name=youtube-insights
```

## 📋 5단계: 일상적인 워크플로우

### 매일 자동 실행 (로컬 PC)

```bash
# 1. 새 동영상 모니터링 + 요약 생성
npm run monitor

# 2. R2에 업로드
npm run upload:r2

# 3. (선택) HTML 재생성 및 Pages 배포
npm run generate:dynamic
# Cloudflare Pages는 자동으로 재배포됨 (Git 연동 시)
```

### 스크립트 자동화 (cron 또는 스케줄러)

**macOS/Linux (crontab):**
```bash
# 매일 오전 9시 실행
0 9 * * * cd /path/to/project && npm run monitor && npm run upload:r2
```

**Windows (Task Scheduler):**
1. 작업 스케줄러 열기
2. 새 작업 만들기
3. 트리거: 매일 오전 9시
4. 작업: `npm run monitor && npm run upload:r2`

## 🔧 고급 설정

### Cache 설정

R2 업로드 시 캐시 헤더가 자동 설정됨:
- `index.json`: 5분 캐시
- `summaries/*.json`: 1시간 캐시

## 💰 비용 예상

### 무료 한도
- **R2 Storage**: 10GB (충분함)
- **R2 Class A Operations** (쓰기): 1M/월
- **R2 Class B Operations** (읽기): 10M/월
- **Cloudflare Pages**: 무제한 대역폭

### 예상 사용량 (1년 운영)
- 저장 용량: ~100MB (365일 × 10개 영상 × 30KB)
- 읽기 요청: ~10K/월 (방문자 100명 × 100페이지뷰)
- 쓰기 요청: ~400/월 (매일 업로드)

**→ 완전 무료!** 🎉

## 🆘 문제 해결

### R2 업로드 실패

```
Error: The AWS Access Key Id you provided does not exist in our records
```
→ `.env` 파일의 `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` 확인

### CORS 에러

```
Access to fetch at 'https://pub-xxx.r2.dev/index.json' has been blocked by CORS
```

**해결 방법**:

1. Cloudflare Dashboard → R2 → 버킷 클릭
2. **Settings** 탭 → **CORS Policy** 섹션
3. 다음 설정 추가:

```json
[
  {
    "AllowedOrigins": [
      "https://summary-30h.pages.dev",
      "https://*.pages.dev"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

4. **Save** 후 5분 정도 대기 (전파 시간)
5. 브라우저 캐시 삭제 후 재시도

**참고**: Pages 도메인이 다르면 본인 도메인으로 변경하세요.

### 데이터가 안 보임

1. R2 Public URL 확인: `https://pub-xxx.r2.dev/index.json` 직접 접속
2. 브라우저 개발자 도구 → Network 탭에서 요청 확인
3. 캐시 문제일 수 있음 → 강력 새로고침 (Ctrl+Shift+R)

## 📊 모니터링

### R2 사용량 확인

1. Cloudflare Dashboard → R2
2. 버킷 클릭 → **Metrics** 탭
3. Storage, Requests 확인

### Pages 배포 상태

1. Cloudflare Dashboard → Pages
2. 프로젝트 클릭 → **Deployments** 탭
3. 최근 배포 로그 확인

## 🎯 다음 단계

- [ ] R2 버킷 생성 및 Public Access 설정
- [ ] API Token 생성 및 .env 설정
- [ ] 로컬 테스트 (`npm run upload:r2 -- --local-only`)
- [ ] R2 업로드 테스트 (`npm run upload:r2`)
- [ ] Cloudflare Pages 배포
- [ ] 자동화 스크립트 설정

완료되면 GitHub에 summary 데이터를 올리지 않고도 동적으로 데이터를 로딩할 수 있습니다! 🚀
