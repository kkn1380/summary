#!/bin/bash

echo "🚀 Cloudflare Pages 빌드 시작"
echo ""

# 1. 의존성 설치 확인
echo "📦 의존성 확인 중..."
if [ ! -d "node_modules" ]; then
    echo "   의존성 설치 중..."
    npm install
fi

# 2. TypeScript 빌드
echo "🔨 TypeScript 빌드 중..."
npm run build

# 3. 환경 변수 확인
if [ -z "$R2_PUBLIC_URL" ]; then
    echo "⚠️  R2_PUBLIC_URL 환경 변수가 설정되지 않았습니다."
    echo "   Cloudflare Pages 설정에서 환경 변수를 추가하세요."
    exit 1
fi

# 4. HTML 생성
echo "🎨 HTML 생성 중..."
node dist/scripts/generate-dynamic-html.js

# 5. 출력 디렉토리 확인
if [ ! -f "data/site/index.html" ]; then
    echo "❌ index.html 생성 실패"
    exit 1
fi

echo ""
echo "✅ 빌드 완료!"
echo "   출력 디렉토리: data/site"
