# TODO

- GitHub Secrets 설정
  - `GEMINI_API_KEY`, `OPENAI_API_KEY` (선택), `YOUTUBE_API_KEY`
  - `YOUTUBE_CHANNEL_IDS` (콤마로 구분된 채널 ID 리스트)
  - `GOOGLE_SHEETS_SPREADSHEET_ID`
  - `GOOGLE_SERVICE_ACCOUNT_KEY` (서비스 계정 JSON 전체를 값으로 넣기)
  - 선택: `SUBTITLE_LANGUAGE`(기본 ko), `AI_PROVIDER`(gemini/openai), `MAX_VIDEOS_PER_CHECK`

- Google 서비스 계정 준비
  - Sheets 편집 권한 있는 서비스 계정 생성
  - JSON 키를 GitHub Secret `GOOGLE_SERVICE_ACCOUNT_KEY`로 저장
  - 스프레드시트 공유: 서비스 계정 이메일을 편집 권한으로 초대

- 채널/동영상 설정
  - 추적할 YouTube 채널 ID를 수집 후 `YOUTUBE_CHANNEL_IDS`에 반영
  - 필요 시 채널당 확인 개수 `MAX_VIDEOS_PER_CHECK` 조정

- 워크플로우 확인
  - `.github/workflows/hourly-ingest.yml`의 크론 스케줄(현재 매 정시) 필요 시 수정
  - 최초 한 번 `Actions > hourly-ingest > Run workflow`로 수동 실행하여 동작 확인

- 로컬 점검(선택)
  - `.env`에 동일한 키를 넣고 `npm ci && npm run monitor`로 한 번 실행해 로그 확인

