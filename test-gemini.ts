import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

async function testGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY가 설정되지 않았습니다');
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // 시도할 모델 이름들
    const modelNames = [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.0-pro',
        'gemini-pro',
        'models/gemini-1.5-flash',
        'models/gemini-1.5-pro',
        'models/gemini-1.0-pro',
        'models/gemini-pro',
    ];

    console.log('🔍 사용 가능한 Gemini 모델을 찾는 중...\n');

    for (const modelName of modelNames) {
        try {
            console.log(`테스트 중: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Hello');
            const response = result.response.text();
            console.log(`✅ 성공! 모델: ${modelName}`);
            console.log(`   응답: ${response.substring(0, 50)}...\n`);
            break; // 성공하면 종료
        } catch (error: any) {
            console.log(`❌ 실패: ${modelName}`);
            if (error.message) {
                console.log(`   에러: ${error.message.substring(0, 100)}\n`);
            }
        }
    }
}

testGemini();
