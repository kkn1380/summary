#!/bin/bash

echo "🧪 로컬 테스트 시작"
echo ""

# 1. 로컬 데이터 생성
echo "📦 1단계: 로컬 데이터 생성 중..."
npm run upload:r2 -- --local-only
if [ $? -ne 0 ]; then
    echo "❌ 데이터 생성 실패"
    exit 1
fi
echo ""

# 2. HTML 생성
echo "🎨 2단계: HTML 생성 중..."
npm run generate:local
if [ $? -ne 0 ]; then
    echo "❌ HTML 생성 실패"
    exit 1
fi
echo ""

# 3. 파일 확인
echo "📋 3단계: 생성된 파일 확인"
echo "  - index.json: $([ -f data/site/index.json ] && echo '✅' || echo '❌')"
echo "  - index.html: $([ -f data/site/index.html ] && echo '✅' || echo '❌')"
echo "  - summaries/: $([ -d data/site/summaries ] && echo "✅ ($(ls data/site/summaries/*.json 2>/dev/null | wc -l | tr -d ' ')개 파일)" || echo '❌')"
echo ""

# 4. 서버 실행 안내
echo "✅ 준비 완료!"
echo ""
echo "📝 다음 명령어로 로컬 서버 실행:"
echo "   npm run serve:site"
echo ""
echo "   그 다음 브라우저에서 접속:"
echo "   http://localhost:8000"
