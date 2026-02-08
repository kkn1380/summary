# YouTube Data API v3 사용 가이드

## 🎯 개요

YouTube Data API v3를 사용하여 과거 데이터를 수집할 수 있습니다.

### 기존 방식 (RSS) vs API 방식

| 항목 | RSS 방식 | API 방식 |
|------|---------|---------|
| **데이터 범위** | 최신 15개 | 전체 (수년치) |
| **날짜 필터링** | ❌ | ✅ |
| **API 키 필요** | ❌ | ✅ |
| **비용** | 무료 | 무료 (할당량 내) |
| **속도** | 빠름 | 느림 (API 호출) |

## 📋 API 키 발급

### 1. Google Cloud Console 접속
https://console.cloud.google.com

### 2. 프로젝트 생성 또는 선택
- 새 프로젝트 만들기 또는 기존 프로젝트 선택

### 3. YouTube Data API v3 활성화
1. 좌측 메뉴 → "API 및 서비스" → "라이브러리"
2. "YouTube Data API v3" 검색
3. "사용 설정" 클릭

### 4. API 키 생성
1. 좌측 메뉴 → "API 및 서비스" → "사용자 인증 정보"
2. "+ 사용자 인증 정보 만들기" → "API 키"
3. 생성된 키 복사

### 5. .env 파일에 추가
```bash
YOUTUBE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## 💰 할당량 및 비용

### 무료 할당량
- **하루 10,000 units**
- 검색 요청: 100 units
- 재생목록 조회: 1 unit
- 비디오 정보: 1 unit

### 실제 사용량 예시

**1년치 데이터 (채널 1개, 100개 동영상)**
```
재생목록 조회: 2회 = 2 units
총: 2 units (하루 할당량의 0.02%)
```

**5년치 데이터 (채널 5개, 2,500개 동영상)**
```
재생목록 조회: 50회 = 50 units
총: 50 units (하루 할당량의 0.5%)
```

### 유료 전환
- 초과 시: $0.01/1,000 units
- 대부분의 경우 무료 할당량으로 충분

## 🚀 사용 방법

### 기본 사용법

```bash
# 도움말
npm run fetch:historical -- --help

# 최근 1년치 자막만 수집
npm run fetch:historical

# 특정 기간 지정
npm run fetch:historical -- --start 2024-01-01 --end 2024-12-31

# 자막 + 요약 생성
npm run fetch:historical -- --start 2024-01-01 --summarize

# 자막 + 요약 + 구글 시트 업데이트
npm run fetch:historical -- --start 2024-01-01 --summarize --update-sheet
```

### 옵션 설명

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--start YYYY-MM-DD` | 시작 날짜 | 1년 전 |
| `--end YYYY-MM-DD` | 종료 날짜 | 오늘 |
| `--max N` | 채널당 최대 동영상 수 | 500 |
| `--channels CH1,CH2` | 채널 ID (쉼표 구분) | .env의 YOUTUBE_CHANNEL_IDS |
| `--summarize` | 자막 요약 생성 | false |
| `--update-sheet` | 구글 시트 업데이트 | false |
| `--skip-existing` | 이미 처리된 동영상 건너뛰기 | false |

## 📝 사용 예시

### 예시 1: 2024년 전체 자막 수집
```bash
npm run fetch:historical -- \
  --start 2024-01-01 \
  --end 2024-12-31 \
  --max 500
```

### 예시 2: 최근 6개월 + 요약
```bash
npm run fetch:historical -- \
  --start 2024-07-01 \
  --summarize
```

### 예시 3: 특정 채널만 처리
```bash
npm run fetch:historical -- \
  --channels UChlv4GSd7OQl3js-jkLOnFA \
  --start 2023-01-01 \
  --max 1000 \
  --summarize \
  --update-sheet
```

### 예시 4: 기존 파일 건너뛰고 새 것만
```bash
npm run fetch:historical -- \
  --start 2024-01-01 \
  --skip-existing \
  --summarize
```

## 🔄 워크플로우

### 초기 데이터 수집 (한 번만)
```bash
# 1. 과거 1~2년치 자막만 수집 (빠름)
npm run fetch:historical -- --start 2023-01-01 --max 1000

# 2. 수집된 자막 확인
ls data/cache/*.subtitle.txt | wc -l

# 3. 요약 생성 (시간 소요)
npm run fetch:historical -- --start 2023-01-01 --summarize --skip-existing

# 4. 구글 시트 업데이트
npm run fetch:historical -- --start 2023-01-01 --update-sheet --skip-existing
```

### 일상적인 모니터링
```bash
# RSS 방식으로 최신 것만 (빠르고 API 할당량 절약)
npm run monitor
```

## ⚠️ 주의사항

### 1. Rate Limit
- Gemini API는 분당 요청 제한이 있음
- `--summarize` 사용 시 자동으로 2초 딜레이 추가
- Rate Limit 도달 시 자동 중단

### 2. 할당량 관리
- 하루 10,000 units 제한
- 많은 데이터는 여러 날에 걸쳐 수집
- `--max` 옵션으로 수량 조절

### 3. 캐싱
- 이미 수집된 자막/요약은 재사용
- `--skip-existing`으로 중복 작업 방지
- `data/cache/` 폴더에 저장

## 🔍 할당량 확인

Google Cloud Console에서 확인:
1. "API 및 서비스" → "대시보드"
2. "YouTube Data API v3" 클릭
3. "할당량" 탭에서 사용량 확인

## 🆘 문제 해결

### API 키 오류
```
Error: YOUTUBE_API_KEY 환경 변수가 설정되지 않았습니다
```
→ `.env` 파일에 `YOUTUBE_API_KEY` 추가

### 할당량 초과
```
Error: Quota exceeded
```
→ 다음 날까지 대기 또는 유료 전환

### 자막 없음
```
Error: 자막을 찾을 수 없습니다
```
→ 해당 동영상에 자막이 없음 (정상)

## 📊 성능 비교

### RSS 방식 (기존)
- ✅ 빠름 (1초 이내)
- ✅ API 키 불필요
- ❌ 최신 15개만
- ❌ 날짜 필터링 불가

### API 방식 (신규)
- ✅ 전체 데이터 접근
- ✅ 날짜 필터링 가능
- ✅ 채널당 수천 개 가능
- ❌ API 키 필요
- ❌ 느림 (API 호출)

## 🎯 권장 전략

1. **초기**: API로 과거 1~2년치 수집
2. **일상**: RSS로 최신 것만 모니터링
3. **보완**: 필요 시 API로 특정 기간 재수집

이렇게 하면 API 할당량을 절약하면서도 전체 데이터를 확보할 수 있습니다!
