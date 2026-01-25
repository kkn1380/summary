# YouTube Channel Monitor & AI Summary System - Setup Guide

이 가이드는 YouTube 채널 모니터링 및 AI 요약 시스템을 설정하는 방법을 안내합니다.

## 필수 요구사항

- Node.js 18 이상
- Google Cloud 계정
- Google Gemini API 키 (또는 OpenAI API 키)
- Google 스프레드시트

## 1. Gemini API 키 발급

### 방법

1. [Google AI Studio](https://aistudio.google.com) 접속
2. Google 계정으로 로그인
3. 왼쪽 메뉴에서 **"Get API Key"** 클릭
4. **"Create API Key"** 버튼 클릭
5. 생성된 API 키 복사

### 무료 할당량

- Gemini 1.5 Flash: 분당 15 요청, 일일 1,500 요청 (무료)
- 일반적인 사용에는 충분합니다

## 2. Google Sheets API 설정

### 2.1 Google Cloud 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 상단의 **프로젝트 선택** 드롭다운 클릭
3. **"새 프로젝트"** 클릭
4. 프로젝트 이름 입력 (예: "youtube-monitor")
5. **"만들기"** 클릭

### 2.2 Google Sheets API 활성화

1. 프로젝트 선택
2. 왼쪽 메뉴에서 **"APIs & Services"** > **"Library"** 이동
3. 검색창에 "Google Sheets API" 입력
4. Google Sheets API 선택
5. **"사용 설정"** 클릭

### 2.3 Service Account 생성

1. **"APIs & Services"** > **"Credentials"** 이동
2. 상단의 **"+ CREATE CREDENTIALS"** 클릭
3. **"Service Account"** 선택
4. Service Account 세부정보 입력:
   - 이름: `youtube-monitor-service`
   - ID: 자동 생성됨
5. **"만들기 및 계속하기"** 클릭
6. 역할 선택 (선택사항, 건너뛰기 가능)
7. **"완료"** 클릭

### 2.4 Service Account JSON 키 다운로드

1. 생성된 Service Account 목록에서 방금 만든 계정 클릭
2. **"키"** 탭 선택
3. **"키 추가"** > **"새 키 만들기"** 클릭
4. 키 유형: **JSON** 선택
5. **"만들기"** 클릭
6. JSON 파일이 자동으로 다운로드됨
7. 다운로드한 파일을 프로젝트 루트에 `service-account-key.json`으로 저장

### 2.5 Google Sheets 공유

1. 새 Google 스프레드시트 생성 또는 기존 시트 열기
2. **"공유"** 버튼 클릭
3. Service Account 이메일 주소 입력
   - JSON 키 파일에서 `client_email` 필드의 값
   - 예: `youtube-monitor-service@project-id.iam.gserviceaccount.com`
4. 권한: **편집자** 선택
5. **"공유"** 클릭

### 2.6 Spreadsheet ID 복사

Google Sheets URL에서 ID 복사:
```
https://docs.google.com/spreadsheets/d/1X2Y3Z4W5V6U7T8S9R0Q/edit
                                    ^^^^^^^^^^^^^^^^^^^^
                                    이 부분이 Spreadsheet ID
```

## 3. YouTube 채널 ID 찾기

### 방법 1: 페이지 소스에서 찾기

1. YouTube 채널 페이지 열기
2. 우클릭 > **"페이지 소스 보기"** (또는 `Ctrl+U` / `Cmd+Option+U`)
3. `Ctrl+F` / `Cmd+F`로 검색창 열기
4. `"channel_id"` 또는 `"browse_id"` 검색
5. `UC`로 시작하는 ID 복사 (예: `UCxxxxxxxxxxxxxx`)

### 방법 2: URL에서 확인

일부 채널은 URL에 직접 포함:
```
https://www.youtube.com/channel/UCxxxxxxxxxxxxxx
                                ^^^^^^^^^^^^^^^^
```

## 4. 환경 변수 설정

### 4.1 .env 파일 생성

```bash
cp .env.example .env
```

### 4.2 .env 파일 수정

```env
# YouTube 채널 ID (쉼표로 구분하여 여러 개 가능)
YOUTUBE_CHANNEL_IDS=UCxxxxxxxxxxxxxx,UCyyyyyyyyyyyyyy

# AI 제공자 선택
AI_PROVIDER=gemini

# Gemini API 키
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Google Sheets 설정
GOOGLE_SHEETS_SPREADSHEET_ID=1X2Y3Z4W5V6U7T8S9R0Q
GOOGLE_SHEETS_SHEET_NAME=Sheet1

# Service Account 키 파일 경로
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account-key.json

# 선택사항
MAX_VIDEOS_PER_CHECK=10
SUBTITLE_LANGUAGE=ko
```

## 5. 설정 확인

자동 설정 확인 스크립트 실행:

```bash
npm run setup
```

이 명령어는 다음을 확인합니다:
- ✅ .env 파일 존재 여부
- ✅ Service Account 키 파일 존재 여부
- ✅ 필수 환경 변수 설정 여부

## 6. 사용법

### 한 번 실행 (수동)

```bash
npm run monitor
```

새로운 동영상을 확인하고 처리합니다.

### 주기적으로 실행 (자동, 1시간마다)

```bash
npm run monitor:watch
```

백그라운드에서 1시간마다 자동으로 새 동영상을 확인합니다.

## 7. Google Sheets 결과

처리된 동영상은 다음 형식으로 시트에 추가됩니다:

| 동영상 제목 | 채널명 | 게시일 | URL | 자막 요약 | 처리일시 |
|------------|--------|--------|-----|----------|----------|
| 제목1 | 채널A | 2025-12-03T... | https://... | 요약 내용 | 2025-12-03T... |

## 문제 해결

### Service Account 권한 오류

**오류**: `The caller does not have permission`

**해결**:
1. Google Sheets를 Service Account 이메일과 공유했는지 확인
2. 편집자 권한이 부여되었는지 확인

### API 키 오류

**오류**: `API key not valid`

**해결**:
1. Gemini API 키가 올바른지 확인
2. Google AI Studio에서 새 키 생성

### 자막 없음 오류

**오류**: `자막을 찾을 수 없습니다`

**해결**:
- 일부 동영상은 자막이 없을 수 있습니다
- 시스템이 자동으로 건너뛰고 다음 동영상을 처리합니다
- 상태는 `failed`로 기록됩니다

## 보안 주의사항

⚠️ **중요**: 다음 파일들을 절대 Git에 커밋하지 마세요:
- `.env` (API 키 포함)
- `service-account-key.json` (인증 정보 포함)

이 파일들은 이미 `.gitignore`에 포함되어 있습니다.
