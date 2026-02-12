# 일일 동기화 가이드

## 🎯 개요

한 번의 명령어로 다음 작업을 모두 수행합니다:

1. **R2 동기화**: R2에서 최신 데이터 다운로드 + 로컬과 병합
2. **영상 수집**: 새 YouTube 영상 모니터링 + 자막 추출 + AI 요약
3. **R2 업로드**: 변경된 데이터만 R2에 업로드

## 🚀 사용 방법

### 방법 1: TypeScript 버전 (추천 ⭐)

```bash
pnpm run daily
```

**장점**:
- 더 나은 에러 처리
- 진행 상황 표시
- 크로스 플랫폼 (Windows/Mac/Linux)

### 방법 2: Bash 스크립트

```bash
pnpm run daily:sh
```

**장점**:
- 더 빠름
- 간단함

**단점**:
- Windows에서 Git Bash 필요

## 📊 실행 예시

```bash
$ pnpm run daily

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 YouTube Summary 일일 동기화 시작
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📥 1단계: R2 동기화 (다운로드 + 병합)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 R2 동기화 시작
  ✅ R2에서 186개 요약 다운로드 완료
  ✅ 186개 로컬 요약 로드됨
  📊 병합 결과: 총 186개
✅ 동기화 완료!

🎬 2단계: 새 영상 모니터링 + 요약 생성
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 채널 모니터링 시작...
  ✅ 새 영상 3개 발견
  ✅ 자막 추출 완료
  ✅ AI 요약 생성 완료

☁️  3단계: R2 업로드 (변경된 것만)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ R2 업로드: summaries/2026-02-12.json (12개) [오늘]
  ⏭️  건너뜀: summaries/2026-02-11.json (변경 없음)
  📊 업로드: 1개, 건너뜀: 19개

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 모든 작업 완료!
   소요 시간: 5분 23초
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 다음 단계:
   - Cloudflare Pages가 자동으로 재배포됩니다
   - 약 1-2분 후 https://summary-30h.pages.dev 에서 확인 가능
```

## ⏰ 자동화 설정

### macOS/Linux (crontab)

```bash
# crontab 편집
crontab -e

# 매일 오전 9시 실행
0 9 * * * cd /path/to/project && pnpm run daily >> /path/to/logs/daily-sync.log 2>&1
```

### Windows (작업 스케줄러)

1. **작업 스케줄러** 열기
2. **기본 작업 만들기** 클릭
3. 이름: `YouTube Summary Daily Sync`
4. 트리거: **매일** → 오전 9시
5. 작업: **프로그램 시작**
   - 프로그램: `cmd.exe`
   - 인수: `/c cd /d C:\path\to\project && pnpm run daily`
6. **마침** 클릭

### Docker (선택 사항)

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY . .

RUN npm install -g pnpm
RUN pnpm install

CMD ["pnpm", "run", "daily"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  youtube-summary:
    build: .
    env_file: .env
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

```bash
# 매일 오전 9시 실행 (cron)
0 9 * * * docker-compose -f /path/to/docker-compose.yml up
```

## 🔍 개별 단계 실행

필요시 각 단계를 개별적으로 실행할 수 있습니다:

```bash
# 1단계만: R2 동기화
pnpm run sync:r2

# 2단계만: 영상 수집
pnpm run monitor

# 3단계만: R2 업로드
pnpm run upload:r2
```

## 🆘 문제 해결

### 에러 발생 시

스크립트는 에러 발생 시 자동으로 중단됩니다:

```bash
❌ 작업 실패!
   실패한 단계: 🎬 2단계: 새 영상 모니터링 + 요약 생성
   완료된 단계: 1/3
```

**해결 방법**:
1. 에러 메시지 확인
2. 해당 단계만 개별 실행하여 디버깅
3. 문제 해결 후 다시 `pnpm run daily` 실행

### 특정 단계 건너뛰기

스크립트를 수정하여 특정 단계를 건너뛸 수 있습니다:

```typescript
// scripts/daily-sync.ts
const steps = [
    // 1단계 건너뛰기 (이미 동기화됨)
    // {
    //     command: 'pnpm run sync:r2',
    //     description: '📥 1단계: R2 동기화',
    //     required: true,
    // },
    {
        command: 'pnpm run monitor',
        description: '🎬 2단계: 새 영상 모니터링',
        required: true,
    },
    // ...
];
```

### Dry-run 모드

실제 업로드 없이 테스트:

```bash
# 1단계: 동기화 시뮬레이션
pnpm run sync:r2 -- --dry-run

# 2단계: 영상 수집 (실제 실행)
pnpm run monitor

# 3단계: 업로드 시뮬레이션
pnpm run upload:r2 -- --dry-run
```

## 📋 체크리스트

일일 동기화 설정 완료:

- [ ] `.env` 파일 설정 (R2 credentials)
- [ ] 수동 실행 테스트: `pnpm run daily`
- [ ] 자동화 설정 (cron 또는 작업 스케줄러)
- [ ] 로그 파일 위치 확인
- [ ] Cloudflare Pages 자동 배포 확인

## 💡 권장 워크플로우

### 시나리오 1: 매일 자동 실행

```bash
# cron으로 매일 오전 9시 자동 실행
0 9 * * * cd /path/to/project && pnpm run daily
```

### 시나리오 2: 수동 실행 (여러 PC)

**PC A (메인)**:
```bash
# 매일 오전
pnpm run daily
```

**PC B (서브)**:
```bash
# 가끔 실행
pnpm run daily  # 자동으로 동기화됨
```

### 시나리오 3: 긴급 업데이트

```bash
# 1. 동기화
pnpm run sync:r2

# 2. 특정 영상만 재처리
pnpm run fetchAndSummarize

# 3. 업로드
pnpm run upload:r2
```

## 📊 모니터링

### 로그 확인

```bash
# 실시간 로그
pnpm run daily

# 백그라운드 실행 + 로그 저장
pnpm run daily > logs/daily-$(date +%Y%m%d).log 2>&1 &

# 로그 확인
tail -f logs/daily-*.log
```

### 성공 여부 확인

```bash
# 마지막 실행 결과 확인
echo $?  # 0이면 성공, 1이면 실패
```

### Slack/Discord 알림 (선택 사항)

```bash
# scripts/daily-sync.sh 끝에 추가
if [ $? -eq 0 ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"✅ YouTube Summary 동기화 완료!"}' \
        YOUR_WEBHOOK_URL
else
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"❌ YouTube Summary 동기화 실패!"}' \
        YOUR_WEBHOOK_URL
fi
```

## 🎯 다음 단계

- [ ] 일일 동기화 스크립트 테스트
- [ ] 자동화 설정 (cron/작업 스케줄러)
- [ ] 로그 모니터링 설정
- [ ] 알림 설정 (선택 사항)

이제 한 번의 명령어로 모든 작업을 자동화할 수 있습니다! 🚀
