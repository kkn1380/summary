# Cloudflare Pages 배포 가이드

## 🚨 빌드 실패 해결

### 문제: "Build failed"

Cloudflare Pages에서 빌드가 실패하는 경우 다음을 확인하세요:

## ✅ Cloudflare Pages 설정

### 1. Build Configuration

```
Framework preset: None
Build command: npm run build:pages
Build output directory: data/site
Root directory: (leave empty)
```

**중요**: `npm run build:pages`를 사용하세요 (tsx 대신 node 사용)

### 2. Environment Variables

Cloudflare Pages 설정에서 환경 변수 추가:

```
R2_PUBLIC_URL = https://pub-xxxxx.r2.dev
```

**설정 방법**:
1. Cloudflare Pages → 프로젝트 선택
2. **Settings** → **Environment variables**
3. **Add variable** 클릭
4. Name: `R2_PUBLIC_URL`
5. Value: R2 Public URL 입력
6. **Production** 체크
7. **Save** 클릭

### 3. Node.js 버전

Cloudflare Pages는 기본적으로 Node.js 16을 사용합니다.
Node.js 18+ 필요 시 환경 변수 추가:

```
NODE_VERSION = 18
```

## 📋 단계별 설정

### Step 1: GitHub 연결

1. Cloudflare Dashboard → **Pages**
2. **Create a project** → **Connect to Git**
3. GitHub 저장소 선택
4. **Begin setup** 클릭

### Step 2: Build Settings

```yaml
Production branch: main (또는 feature/cloudflare-r2)
Build command: npm run build:pages
Build output directory: data/site
```

### Step 3: Environment Variables

**Production 환경**:
```
R2_PUBLIC_URL = https://pub-xxxxx.r2.dev
```

**Preview 환경** (선택):
```
R2_PUBLIC_URL = https://pub-xxxxx.r2.dev
```

### Step 4: Deploy

**Save and Deploy** 클릭

## 🔍 빌드 로그 확인

빌드 실패 시 로그를 확인하세요:

### 일반적인 에러

#### 1. "R2_PUBLIC_URL is not defined"
```
❌ R2_PUBLIC_URL 환경 변수가 설정되지 않았습니다.
```

**해결**:
- Settings → Environment variables → Add variable
- `R2_PUBLIC_URL` 추가

#### 2. "Command not found: tsx"
```
❌ sh: tsx: command not found
```

**해결**:
- Build command를 `npm run build:pages`로 변경
- `tsx` 대신 `node`를 사용하도록 수정됨

#### 3. "Cannot find module"
```
❌ Error: Cannot find module 'dotenv'
```

**해결**:
- `package.json`의 dependencies 확인
- 빌드 명령어가 `npm install`을 포함하는지 확인

#### 4. "index.html not found"
```
❌ index.html 생성 실패
```

**해결**:
- Build output directory가 `data/site`인지 확인
- 빌드 스크립트가 정상 실행되는지 확인

## 🧪 로컬 테스트

배포 전 로컬에서 테스트:

```bash
# 1. 환경 변수 설정
export R2_PUBLIC_URL=https://pub-xxxxx.r2.dev

# 2. 빌드 테스트
npm run build:pages

# 3. 결과 확인
ls data/site/index.html

# 4. 로컬 서버로 확인
npm run serve:site
```

## 📝 빌드 프로세스

`npm run build:pages` 실행 시:

```bash
1. npm install          # 의존성 설치
   ↓
2. npm run build        # TypeScript → JavaScript
   ↓
3. node dist/scripts/generate-dynamic-html.js  # HTML 생성
   ↓
4. data/site/index.html # 출력
```

## 🔧 고급 설정

### Custom Build Command

더 세밀한 제어가 필요한 경우:

```bash
npm install && npm run build && node dist/scripts/generate-dynamic-html.js
```

### Build Cache

빌드 속도 향상을 위해 캐시 활성화:

```yaml
# wrangler.toml (선택)
[build]
command = "npm run build:pages"
cwd = "."
watch_dirs = ["src", "scripts"]
```

### Multiple Environments

환경별 다른 R2 URL 사용:

**Production**:
```
R2_PUBLIC_URL = https://pub-prod-xxxxx.r2.dev
```

**Preview**:
```
R2_PUBLIC_URL = https://pub-preview-xxxxx.r2.dev
```

## 🚀 배포 후 확인

### 1. 배포 상태 확인

Cloudflare Pages → 프로젝트 → **Deployments**

- ✅ Success: 배포 성공
- ❌ Failed: 로그 확인
- 🔄 Building: 빌드 중

### 2. 사이트 접속

```
https://your-project.pages.dev
```

### 3. 기능 테스트

- [ ] 페이지 로딩
- [ ] 오늘 데이터 표시
- [ ] 과거 날짜 클릭 (R2 로딩)
- [ ] 채널 펼치기
- [ ] 영상 요약 보기
- [ ] YouTube 링크 작동

## 🔄 재배포

### 자동 재배포

GitHub에 push하면 자동으로 재배포:

```bash
git add .
git commit -m "Update"
git push origin main
```

### 수동 재배포

Cloudflare Pages → **Deployments** → **Retry deployment**

## 📊 배포 통계

Cloudflare Pages → **Analytics**에서 확인:

- 방문자 수
- 페이지뷰
- 대역폭 사용량
- 빌드 시간

## 🆘 문제 해결 체크리스트

빌드 실패 시 순서대로 확인:

- [ ] Build command: `npm run build:pages`
- [ ] Build output: `data/site`
- [ ] Environment variable: `R2_PUBLIC_URL` 설정됨
- [ ] GitHub 저장소: 최신 코드 push됨
- [ ] package.json: `build:pages` 스크립트 있음
- [ ] scripts/build-for-pages.sh: 실행 권한 있음
- [ ] 로컬 테스트: `npm run build:pages` 성공

## 💡 팁

### 빠른 디버깅

1. **로컬에서 먼저 테스트**
   ```bash
   npm run build:pages
   ```

2. **빌드 로그 자세히 보기**
   - Cloudflare Pages → Deployments → 실패한 배포 클릭
   - 로그 전체 읽기

3. **환경 변수 확인**
   - Settings → Environment variables
   - Production 체크 확인

### 성공적인 배포

```
✅ Build command: npm run build:pages
✅ Output directory: data/site
✅ Environment: R2_PUBLIC_URL 설정
✅ 로컬 테스트: 성공
✅ GitHub push: 완료
```

→ **배포 성공!** 🎉

## 📚 추가 리소스

- [Cloudflare Pages 문서](https://developers.cloudflare.com/pages/)
- [Build configuration](https://developers.cloudflare.com/pages/platform/build-configuration/)
- [Environment variables](https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables)

---

문제가 계속되면 빌드 로그를 공유해주세요!
