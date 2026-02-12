#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 에러 발생 시 중단
set -e

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 YouTube Summary 일일 동기화 시작${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 시작 시간 기록
START_TIME=$(date +%s)

# 1단계: R2 동기화 (다운로드 + 병합)
echo -e "${YELLOW}📥 1단계: R2 동기화 (다운로드 + 병합)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pnpm run sync:r2
echo ""

# 2단계: 새 영상 모니터링 + 요약 생성
echo -e "${YELLOW}🎬 2단계: 새 영상 모니터링 + 요약 생성${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pnpm run monitor
echo ""

# 3단계: R2 업로드 (변경된 것만)
echo -e "${YELLOW}☁️  3단계: R2 업로드 (변경된 것만)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pnpm run upload:r2
echo ""

# 종료 시간 계산
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ 모든 작업 완료!${NC}"
echo -e "${GREEN}   소요 시간: ${MINUTES}분 ${SECONDS}초${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📊 다음 단계:${NC}"
echo "   - Cloudflare Pages가 자동으로 재배포됩니다"
echo "   - 약 1-2분 후 https://summary-30h.pages.dev 에서 확인 가능"
echo ""
