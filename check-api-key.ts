import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkApiKey() {
    const apiKey = process.env.GEMINI_API_KEY;

    console.log('🔑 API 키 확인 중...\n');

    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY가 .env 파일에 설정되지 않았습니다');
        return;
    }

    console.log(`✅ API 키가 설정되어 있습니다`);
    console.log(`   길이: ${apiKey.length} 문자`);
    console.log(`   시작: ${apiKey.substring(0, 10)}...`);
    console.log(`   AI Studio 형식 (AIza로 시작): ${apiKey.startsWith('AIza') ? '✅ 맞음' : '❌ 틀림'}\n`);

    if (!apiKey.startsWith('AIza')) {
        console.error('⚠️  경고: Gemini API 키는 일반적으로 "AIza"로 시작합니다.');
        console.error('   Google AI Studio (https://aistudio.google.com)에서 발급받은 키가 맞는지 확인하세요.\n');
    }

    // 실제 API 호출 테스트
    console.log('📡 API 연결 테스트 중...\n');

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent('Hi');
        const response = result.response.text();
        console.log('✅ API 연결 성공!');
        console.log(`   응답: ${response.substring(0, 100)}\n`);
    } catch (error: any) {
        console.error('❌ API 연결 실패');
        console.error(`   전체 에러 메시지:\n${error.message}\n`);

        if (error.message.includes('API_KEY_INVALID') || error.message.includes('API key not valid')) {
            console.error('💡 해결 방법:');
            console.error('   1. Google AI Studio (https://aistudio.google.com) 접속');
            console.error('   2. 왼쪽 메뉴에서 "Get API key" 클릭');
            console.error('   3. 새로운 API 키 생성');
            console.error('   4. .env 파일의 GEMINI_API_KEY를 새 키로 업데이트\n');
        } else if (error.message.includes('404')) {
            console.error('💡 해결 방법:');
            console.error('   1. API 키가 올바른지 확인');
            console.error('   2. Google AI Studio에서 Gemini API가 활성화되어 있는지 확인');
            console.error('   3. 사용 가능한 지역인지 확인 (일부 국가에서는 제한될 수 있음)\n');
        }
    }
}

checkApiKey();
