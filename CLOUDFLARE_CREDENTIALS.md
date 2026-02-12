# Cloudflare R2 인증 정보 찾기

## 필요한 정보

1. **CLOUDFLARE_ACCOUNT_ID** - 계정 ID
2. **R2_ACCESS_KEY_ID** - S3 호환 Access Key
3. **R2_SECRET_ACCESS_KEY** - S3 호환 Secret Key
4. **R2_PUBLIC_URL** - 버킷 Public URL

## 1. Account ID 찾기

### 방법 1: Dashboard 사이드바 (가장 쉬움)
1. https://dash.cloudflare.com 접속
2. 우측 사이드바 확인
3. **Account ID** 항목 찾기
4. 복사 버튼 클릭

```
예시: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### 방법 2: URL에서 확인
1. R2 페이지 접속
2. 브라우저 주소창 확인
3. URL 형식: `https://dash.cloudflare.com/{account_id}/r2`
4. 중괄호 안의 값이 Account ID

```
예시 URL: https://dash.cloudflare.com/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6/r2
Account ID: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### 방법 3: API Token 페이지
1. R2 → **Manage R2 API Tokens**
2. 페이지 상단에 Account ID 표시

## 2. API Token (Access Key) 생성

### 단계별 가이드

1. **R2 페이지 접속**
   - Dashboard → 좌측 메뉴 → **R2**

2. **API Token 관리 페이지**
   - 우측 상단 **Manage R2 API Tokens** 클릭

3. **새 Token 생성**
   - **Create API token** 버튼 클릭

4. **Token 설정**
   ```
   Token name: youtube-summary-upload
   Permissions: Object Read & Write
   TTL: Forever (또는 원하는 기간)
   ```

5. **Token 생성**
   - **Create API Token** 클릭

6. **정보 복사** (⚠️ 한 번만 표시됨!)
   ```
   Access Key ID: abc123def456ghi789jkl012
   Secret Access Key: xyz789uvw456rst123opq456nml789
   ```
   
   **중요**: 
   - "Token" 값은 무시하세요 (사용 안 함)
   - Access Key ID와 Secret Access Key만 복사
   - 이 정보는 다시 볼 수 없으니 안전한 곳에 저장

## 3. Public URL 찾기

### 단계별 가이드

1. **버킷 선택**
   - R2 → 생성한 버킷 클릭 (예: `youtube-summaries`)

2. **Settings 탭**
   - 상단 메뉴에서 **Settings** 클릭

3. **Public Access 섹션**
   - **Public Access** 항목 찾기
   - 이미 설정했다면 URL이 표시됨
   - 예: `https://pub-abc123def456.r2.dev`

4. **Public Access 설정 (처음인 경우)**
   - **Allow Access** 버튼 클릭
   - **R2.dev subdomain** 선택
   - 자동으로 URL 생성됨

## 4. .env 파일 작성

위에서 얻은 정보로 `.env` 파일 작성:

```bash
# 1. Account ID (Dashboard 사이드바 또는 URL에서)
CLOUDFLARE_ACCOUNT_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# 2. Access Key (API Token 생성 시 받음)
R2_ACCESS_KEY_ID=abc123def456ghi789jkl012
R2_SECRET_ACCESS_KEY=xyz789uvw456rst123opq456nml789

# 3. 버킷 이름
R2_BUCKET_NAME=youtube-summaries

# 4. Public URL (버킷 Settings에서)
R2_PUBLIC_URL=https://pub-abc123def456.r2.dev
```

## 5. 확인 방법

### Account ID 확인
```bash
# 32자 16진수 문자열
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Access Key ID 확인
```bash
# 영숫자 문자열 (약 20-40자)
abc123def456ghi789jkl012
```

### Secret Access Key 확인
```bash
# 영숫자 문자열 (약 40-60자)
xyz789uvw456rst123opq456nml789
```

### Public URL 확인
```bash
# https://pub-{random}.r2.dev 형식
https://pub-abc123def456.r2.dev
```

브라우저에서 직접 접속해서 확인:
```
https://pub-abc123def456.r2.dev/index.json
```
- 404 에러: 정상 (아직 파일 업로드 안 함)
- 다른 에러: URL 확인 필요

## 🆘 문제 해결

### "Account ID를 찾을 수 없어요"
→ Dashboard 우측 사이드바를 확인하세요. 없다면 URL에서 확인하세요.

### "Access Key를 다시 볼 수 없어요"
→ 새로운 API Token을 생성하세요. 이전 것은 삭제하고 새로 만들면 됩니다.

### "Public URL이 없어요"
→ 버킷 Settings → Public Access → Allow Access를 먼저 설정하세요.

### "Token 값은 어디에 쓰나요?"
→ Token 값 자체는 사용하지 않습니다. Access Key ID와 Secret만 사용합니다.

## 📝 체크리스트

- [ ] CLOUDFLARE_ACCOUNT_ID 복사 완료
- [ ] R2_ACCESS_KEY_ID 복사 완료
- [ ] R2_SECRET_ACCESS_KEY 복사 완료
- [ ] R2_PUBLIC_URL 복사 완료
- [ ] .env 파일 작성 완료
- [ ] Public URL 브라우저 접속 테스트 (404 정상)

모든 정보를 얻었다면 `CLOUDFLARE_SETUP.md`의 5단계로 돌아가세요!
