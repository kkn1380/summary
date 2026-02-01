#!/bin/bash

# 정적 사이트 로컬 서버 실행 스크립트

SITE_DIR="data/site"

if [ ! -d "$SITE_DIR" ]; then
    echo "❌ $SITE_DIR 디렉터리가 없습니다."
    echo "먼저 'npm run monitor'를 실행하여 사이트를 생성하세요."
    exit 1
fi

if [ ! -f "$SITE_DIR/index.html" ]; then
    echo "⚠️  index.html이 없습니다. 생성 중..."
    npm run monitor
fi

echo "🚀 로컬 서버 시작..."
echo "📂 디렉터리: $SITE_DIR"
echo "🌐 URL: http://localhost:8000"
echo ""
echo "종료하려면 Ctrl+C를 누르세요."
echo ""

cd "$SITE_DIR" && python3 -m http.server 8000
