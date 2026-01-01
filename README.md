# YouTube Subtitle Extractor & Channel Monitor

TypeScript로 작성된 YouTube 자막 추출 및 채널 모니터링 도구입니다.

## 주요 기능

### 🎬 자막 추출 (기본 기능)
- YouTube URL 또는 비디오 ID로 자막 추출
- 한국어/영어 등 다양한 언어 지원
- 자동 언어 폴백 (한국어 자막이 없으면 영어로 시도)
- 타임스탬프 포함 또는 순수 텍스트 출력 옵션

### 🤖 채널 모니터링 & AI 요약 (심화 기능)
- 특정 YouTube 채널의 새 동영상 자동 감지
- 자막 자동 추출
- Google Gemini AI로 자막 요약 생성
- Google Sheets에 자동 업데이트
- 중복 처리 방지
- 주기적 모니터링 지원 (1시간마다)

## 설치

```bash
npm install
```

## 기본 사용법: 자막 추출

### CLI로 자막 추출

```bash
# YouTube URL로 자막 추출
npm start -- https://www.youtube.com/watch?v=dQw4w9WgXcQ

# 비디오 ID로 자막 추출
npm start -- dQw4w9WgXcQ

# 특정 언어 지정 (영어)
npm start -- https://www.youtube.com/watch?v=dQw4w9WgXcQ en

# 순수 텍스트만 출력 (타임스탬프 제외)
npm start -- https://www.youtube.com/watch?v=dQw4w9WgXcQ --plain
```

### 지원하는 URL 형식

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/v/VIDEO_ID`
- `VIDEO_ID` (11자리 영숫자)

## 심화 사용법: 채널 모니터링

### 1. 초기 설정

자세한 설정 가이드는 [SETUP.md](./SETUP.md)를 참조하세요.

**필수 요구사항:**
- Google Gemini API 키 (무료)
- Google Cloud Service Account
- Google Sheets 접근 권한

**빠른 설정:**

```bash
# 1. 환경 변수 파일 생성
cp .env.example .env

# 2. .env 파일 수정 (API 키 등 입력)

# 3. Google Service Account 키 파일 저장
# service-account-key.json 파일을 프로젝트 루트에 저장

# 4. 설정 확인
npm run setup
```

### 2. 단계별 테스트 (권장)

전체 시스템을 실행하기 전에 각 기능을 독립적으로 테스트할 수 있습니다.

**테스트 순서:**

```bash
# 1. YouTube 자막 추출 테스트
npm start -- https://www.youtube.com/watch?v=dQw4w9WgXcQ ko

# 2. Gemini API 연동 테스트
npx tsx tests/test-gemini.ts

# 3. Google Sheets 연동 테스트
npx tsx tests/test-sheets.ts

# 4. 전체 시스템 실행
npm run monitor
```

📚 **자세한 테스트 가이드**: [TESTING.md](./TESTING.md)를 참조하세요.

각 테스트는 다음을 확인합니다:
- ✅ API 키와 설정이 올바른지
- ✅ 각 모듈이 정상 작동하는지
- ✅ 문제 발생 시 상세한 해결 방법 제공

### 3. 채널 모니터링 실행

```bash
# 한 번 실행 (새 동영상 확인)
npm run monitor

# 주기적으로 실행 (1시간마다 자동 확인)
npm run monitor:watch
```

### 3. Google Sheets 결과

처리된 동영상은 다음 형식으로 Google Sheets에 자동으로 추가됩니다:

| 동영상 제목 | 채널명 | 게시일 | URL | 자막 요약 | 처리일시 |
|------------|--------|--------|-----|----------|----------|

## 프로젝트 구조

```
youtube-script/
├── src/
│   ├── index.ts              # CLI 자막 추출 도구
│   ├── subtitleExtractor.ts  # 자막 추출 로직
│   ├── channelMonitor.ts     # 채널 모니터링
│   ├── aiSummarizer.ts       # AI 요약 생성
│   ├── sheetsManager.ts      # Google Sheets 연동
│   ├── stateManager.ts       # 처리 상태 관리
│   ├── monitor.ts            # 메인 모니터링 스크립트
│   └── setup.ts              # 설정 확인 도구
├── tests/
│   ├── test-gemini.ts        # Gemini API 테스트
│   └── test-sheets.ts        # Google Sheets 테스트
├── data/                     # 처리된 동영상 기록
├── .env.example              # 환경 변수 템플릿
├── SETUP.md                  # 상세 설정 가이드
├── TESTING.md                # 테스트 가이드
└── README.md                 # 이 파일
```

## 환경 변수

`.env` 파일에서 다음 변수들을 설정할 수 있습니다:

```env
# YouTube 채널 모니터링
YOUTUBE_CHANNEL_IDS=UCxxxxxx,UCyyyyyy  # 쉼표로 구분

# AI 설정
AI_PROVIDER=gemini                      # gemini 또는 openai
GEMINI_API_KEY=your_api_key_here

# Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_SHEET_NAME=Sheet1
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account-key.json

# 선택 사항
MAX_VIDEOS_PER_CHECK=10                 # 채널당 확인할 최대 동영상 수
SUBTITLE_LANGUAGE=ko                    # 기본 자막 언어
```

## 빌드

```bash
npm run build
```

빌드된 파일은 `dist/` 디렉토리에 생성됩니다.

## 개발

```bash
npm run dev
```

파일 변경 시 자동으로 재실행됩니다.

## 기술 스택

### 기본 기능
- TypeScript
- Node.js
- youtube-caption-extractor

### 심화 기능
- Google Gemini AI (또는 OpenAI GPT)
- Google Sheets API
- RSS Parser (YouTube 채널 피드)

## 특징

✅ **API 키 불필요** (자막 추출)  
✅ **다양한 언어 지원**  
✅ **자동 폴백** (한국어 → 영어)  
✅ **타임스탬프 포맷팅**  
✅ **에러 핸들링**  
✅ **AI 요약 생성** (Gemini/GPT)  
✅ **Google Sheets 자동 업데이트**  
✅ **중복 처리 방지**  
✅ **주기적 모니터링**  

## 사용 예제

### 예제 1: 단순 자막 추출
```bash
npm start -- jNQXAC9IVRw en
```

**출력:**
```
자막 추출 중...

✅ 자막 추출 완료! (총 6개 세그먼트)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1] 00:00:01
All right, so here we are, in front of the elephants
...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 예제 2: 채널 모니터링
```bash
npm run monitor
```

**출력:**
```
🚀 YouTube 채널 모니터링 시작...

📺 모니터링 대상 채널: 2개
📊 채널당 확인할 최대 동영상 수: 10개

🔍 최신 동영상 확인 중...
📹 총 15개의 동영상 발견

🆕 새로운 동영상: 3개

📹 처리 중: Introduction to TypeScript
   채널: Tech Channel
   게시일: 2025. 12. 3.
   🔍 자막 추출 중...
   ✅ 자막 추출 완료: 245개 세그먼트
   🤖 AI 요약 생성 중...
   ✅ 요약 완료
   📊 구글 시트 업데이트 중...
   ✅ 처리 완료!
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 처리 결과 요약
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 성공: 3개
❌ 실패: 0개
📝 총 처리: 3개
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 문제 해결

자세한 문제 해결 가이드는 [SETUP.md](./SETUP.md#문제-해결)를 참조하세요.

## 보안

⚠️ **중요**: 다음 파일들을 절대 공개하지 마세요:
- `.env` (API 키 포함)
- `service-account-key.json` (인증 정보 포함)

## 라이선스

MIT
