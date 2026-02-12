# 여러 PC에서 사용하기

## 🎯 문제 상황

여러 PC에서 데이터를 수집하고 업로드할 때:
- PC A에서 영상 1 추가
- PC B에서 영상 2 추가
- 나중에 업로드한 PC가 이전 데이터를 덮어씀 ❌

## ✅ 해결 방법: 동기화

### 옵션 A: 단순 업로드 (기본)

각 PC가 독립적으로 작동:

```bash
# 새 영상 수집
npm run monitor

# R2 업로드 (스마트 - 변경된 것만)
npm run upload:r2
```

**장점**: 간단
**단점**: 동시 작업 시 데이터 손실 가능

### 옵션 B: 동기화 (추천 ⭐)

R2와 동기화 후 작업:

```bash
# 1. R2와 동기화 (병합)
npm run sync:r2

# 2. 새 영상 수집
npm run monitor

# 3. 다시 동기화 (업로드)
npm run sync:r2
```

**장점**: 안전, 데이터 손실 없음
**단점**: 약간 느림

## 🔄 동기화 작동 방식

### 1단계: R2 다운로드
```
R2에서 모든 요약 데이터 다운로드
```

### 2단계: 로컬 로드
```
로컬의 latest.json 로드
```

### 3단계: 병합
```
videoId(URL) 기준으로 병합:
  - 같은 videoId: processedAt이 최신인 것 선택
  - 다른 videoId: 둘 다 유지
```

### 4단계: 저장 & 업로드
```
병합된 데이터를 로컬과 R2에 저장
```

## 📊 병합 예시

### 예시 1: 다른 영상 추가

**R2**:
```json
[
  { "url": "video1", "processedAt": "2026-02-12 09:00" },
  { "url": "video2", "processedAt": "2026-02-12 09:30" }
]
```

**로컬 (PC B)**:
```json
[
  { "url": "video3", "processedAt": "2026-02-12 10:00" }
]
```

**병합 결과**:
```json
[
  { "url": "video1", "processedAt": "2026-02-12 09:00" },
  { "url": "video2", "processedAt": "2026-02-12 09:30" },
  { "url": "video3", "processedAt": "2026-02-12 10:00" }  ← 추가됨
]
```

### 예시 2: 같은 영상 재처리

**R2**:
```json
[
  { "url": "video1", "summary": "요약 v1", "processedAt": "2026-02-12 09:00" }
]
```

**로컬 (PC B)**:
```json
[
  { "url": "video1", "summary": "요약 v2", "processedAt": "2026-02-12 10:00" }
]
```

**병합 결과**:
```json
[
  { "url": "video1", "summary": "요약 v2", "processedAt": "2026-02-12 10:00" }  ← 최신 것 선택
]
```

## 🚀 실전 워크플로우

### PC A (메인)

매일 자동 실행:
```bash
#!/bin/bash
# daily-sync.sh

# 동기화
npm run sync:r2

# 새 영상 수집
npm run monitor

# 다시 동기화 (업로드)
npm run sync:r2
```

### PC B (서브)

가끔 수동 실행:
```bash
# 1. 동기화 (R2 → 로컬)
npm run sync:r2

# 2. 특정 작업 (예: 과거 데이터 수집)
npm run fetch:historical -- --start 2024-01-01

# 3. 동기화 (로컬 → R2)
npm run sync:r2
```

## 📋 명령어 비교

| 명령어 | 동작 | 사용 시점 |
|--------|------|-----------|
| `npm run upload:r2` | 로컬 → R2 (단방향) | 단일 PC 사용 |
| `npm run sync:r2` | R2 ↔ 로컬 (양방향) | 여러 PC 사용 |
| `npm run sync:r2 -- --dry-run` | 시뮬레이션 | 테스트 |
| `npm run sync:r2 -- --force` | 강제 업로드 | 문제 해결 |

## 🔍 동기화 결과 확인

```bash
npm run sync:r2
```

출력:
```
🔄 R2 동기화 시작

📥 1단계: R2에서 데이터 다운로드 중...
  📥 R2에서 20개 파일 다운로드 중...
  ✅ R2에서 186개 요약 다운로드 완료

📖 2단계: 로컬 데이터 로드 중...
  ✅ 190개 로컬 요약 로드됨

🔀 3단계: 데이터 병합 중...
  📊 병합 결과:
     R2 전용: 2개      ← R2에만 있음
     로컬 전용: 6개    ← 로컬에만 있음
     공통: 184개       ← 둘 다 있음
     총: 192개         ← 병합 후 총 개수

💾 4단계: 로컬에 저장 중...
  ✅ 저장: 2026-02-12.json (10개)
  ...

☁️  5단계: R2에 업로드 중...
  ✅ R2 업로드: summaries/2026-02-12.json (10개) [오늘]
  ⏭️  건너뜀: summaries/2026-02-11.json (변경 없음)
  ...

✅ 동기화 완료!
   총 192개 요약 동기화됨
```

## 🆘 문제 해결

### "R2에 데이터가 없습니다"

첫 업로드:
```bash
npm run upload:r2
```

### 충돌 발생

강제 동기화:
```bash
npm run sync:r2 -- --force
```

### 테스트만 하고 싶음

Dry-run:
```bash
npm run sync:r2 -- --dry-run
```

## 💡 권장 사항

### 시나리오 1: 혼자 사용 (여러 PC)

```bash
# 어떤 PC에서든
npm run sync:r2  # 항상 동기화
npm run monitor  # 작업
npm run sync:r2  # 다시 동기화
```

### 시나리오 2: 팀 사용

```bash
# 작업 전
npm run sync:r2

# 작업
npm run monitor

# 작업 후 (즉시)
npm run sync:r2
```

### 시나리오 3: 자동화

```bash
# cron 또는 스케줄러
0 9 * * * cd /path/to/project && npm run sync:r2 && npm run monitor && npm run sync:r2
```

## ✅ 체크리스트

여러 PC에서 안전하게 사용하려면:

- [ ] 모든 PC에 `.env` 설정 (같은 R2 설정)
- [ ] 작업 전 `npm run sync:r2` 실행
- [ ] 작업 후 `npm run sync:r2` 실행
- [ ] 동시 작업 피하기 (가능하면)
- [ ] 정기적으로 동기화 확인

이제 여러 PC에서 안전하게 작업할 수 있습니다! 🚀
