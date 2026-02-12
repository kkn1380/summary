# 🚀 Cloudflare R2 + Pages 빠른 시작 가이드

## 현재 vs 새로운 방식

### 기존 방식 ❌
```
로컬 PC → GitHub (index.html + 모든 summary 데이터)
         → GitHub Pages
```
- 문제: summary 데이터가 GitHub에 올라감
- 문제: index.html을 매번 새로 생성

### 새로운 방식 ✅
```
로컬 PC → Cloudflare R2 (summary 데이터만)
         → Cloudflare Pages (index.html만, 변경 없음)
```
- 해결: summary는 R2에만 저장
- 해결: index.html은 한 번만 생성, 데이터는 동적 로딩
- 보너스: 오늘 데이터는 즉시 표시, 과거는 클릭 시 로딩

## 🎯 5분 설정

### 1️⃣ Cloudflare 계정 생성
https://dash.cloudflare.com 에서 무료 계정 생성

### 2️⃣ R2 버킷 생성
1. Dashboard → **R2** → **Create bucket**
2. 이름: `youtube-summaries`
3. **Settings** → **Public Access** → **Allow Access**
4. **R2.dev subdomain** 선택
5. 생성된 URL 복사 (예: `https://pub-abc123.r2.dev`)

### 3️⃣ Account ID 확인
1. Cloudflare Dashboard 우측 사이드바에서 **Account ID** 확인
   - 또는 R2 페이지 URL에서 확인: `dash.cloudflare.com/{account_id}/r2`
2. Account ID 복사 (예: `a1b2c3d4e5f6g7h8i9j0`)

**💡 자세한 방법**: `CLOUDFLARE_CREDENTIALS.md` 참고

### 4️⃣ API Token 생성
1. R2 → **Manage R2 API Tokens** → **Create API token**
2. 이름: `youtube-upload`
3. Permissions: **Object Read & Write**
4. **Create API Token** 클릭
5. 생성 후 다음 정보 복사 (한 번만 표시됨!):
   - **Access Key ID** (예: `abc123...`)
   - **Secret Access Key** (예: `xyz789...`)

**💡 자세한 방법**: `CLOUDFLARE_CREDENTIALS.md` 참고

### 5️⃣ .env 파일 설정
```bash
# 기존 설정은 그대로 두고 아래 추가

# Account ID는 Dashboard 우측 사이드바 또는 R2 URL에서 확인
CLOUDFLARE_ACCOUNT_ID=a1b2c3d4e5f6g7h8i9j0

# API Token 생성 시 받은 Access Key
R2_ACCESS_KEY_ID=abc123def456ghi789
R2_SECRET_ACCESS_KEY=xyz789uvw456rst123

# 버킷 이름 (2단계에서 생성한 이름)
R2_BUCKET_NAME=youtube-summaries

# Public URL (2단계에서 복사한 URL)
R2_PUBLIC_URL=https://pub-abc123.r2.dev
```

**참고**: Token 자체는 필요 없고, Access Key ID와 Secret만 사용합니다 (S3 호환 방식)

### 6️⃣ 테스트
```bash
# 의존성 설치
npm install

# 로컬 테스트 (한 번에 실행)
npm run test:local

# 또는 단계별로:
# 1. 로컬 데이터 생성 (R2 업로드 안 함)
npm run upload:r2 -- --local-only

# 2. 로컬용 HTML 생성
npm run generate:local

# 3. 로컬 서버로 확인
npm run serve:site
# → http://localhost:8000 접속
```

### 6️⃣ R2 업로드
```bash
npm run upload:r2
```

### 7️⃣ Cloudflare Pages 배포

#### 방법 A: Git 연동 (추천)
1. Dashboard → **Pages** → **Create a project**
2. **Connect to Git** → GitHub 저장소 선택
3. Build settings:
   - **Build command**: `npm run build:pages`
   - **Build output directory**: `data/site`
4. Environment variables:
   - Name: `R2_PUBLIC_URL`
   - Value: `https://pub-abc123.r2.dev`
   - Environment: **Production** 체크
5. **Save and Deploy**

**⚠️ 중요**: 
- Build command는 `npm run build:pages` (tsx 아님!)
- Environment variable `R2_PUBLIC_URL` 필수!

**빌드 실패 시**: `CLOUDFLARE_PAGES_SETUP.md` 참고

#### 방법 B: 수동 배포
```bash
# Wrangler 설치
npm install -g wrangler

# 로그인
wrangler login

# 배포
wrangler pages deploy data/site --project-name=youtube-insights
```

## 📅 매일 사용법

```bash
# 1. 새 동영상 모니터링 + 요약
npm run monitor

# 2. R2에 업로드
npm run upload:r2

# 끝! (Cloudflare Pages는 자동 재배포)
```

## 🎨 프론트엔드 동작

1. **페이지 로드** → `index.json` 읽기 (오늘 데이터 포함)
2. **오늘 데이터** → 즉시 표시 (펼쳐진 상태)
3. **과거 날짜** → 날짜만 표시 (접힌 상태)
4. **날짜 클릭** → 해당 날짜 JSON 로드 → 펼쳐서 표시

## 💰 비용

**완전 무료!** 🎉

- R2: 10GB 무료 (충분함)
- Pages: 무제한 대역폭
- 예상 사용량: ~100MB/년

## 📚 상세 가이드

더 자세한 내용은 `CLOUDFLARE_R2_GUIDE.md` 참고

## 🆘 문제 해결

### "Access Key Id does not exist"
→ `.env` 파일의 R2 설정 확인

### "Failed to load index"
→ R2 Public URL 확인: `https://pub-xxx.r2.dev/index.json` 직접 접속

### CORS 에러
→ R2 버킷 설정에서 CORS 규칙 추가 (가이드 참고)

## ✅ 체크리스트

- [ ] Cloudflare 계정 생성
- [ ] R2 버킷 생성 및 Public Access 설정
- [ ] API Token 생성
- [ ] .env 파일 설정
- [ ] 로컬 테스트 (`npm run upload:r2 -- --local-only`)
- [ ] R2 업로드 테스트 (`npm run upload:r2`)
- [ ] HTML 생성 (`npm run generate:dynamic`)
- [ ] Cloudflare Pages 배포
- [ ] 최종 확인 (배포된 URL 접속)

완료! 🎉
