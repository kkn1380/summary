import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY || '';

/**
 * 1. 사용 가능한 Gemini 모델 목록 확인
 */
async function listAvailableModels() {
    console.log('📋 1단계: 사용 가능한 Gemini 모델 확인\n');
    console.log('='.repeat(60));

    if (!API_KEY) {
        console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
        console.error('   .env 파일에 GEMINI_API_KEY를 설정하세요.\n');
        return null;
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
        );

        if (!response.ok) {
            console.error(`❌ HTTP 에러: ${response.status} ${response.statusText}`);
            return null;
        }

        const data: any = await response.json();

        if (!data.models || data.models.length === 0) {
            console.log('❌ 사용 가능한 모델이 없습니다\n');
            return null;
        }

        // generateContent를 지원하는 모델만 필터링
        const generateContentModels = data.models.filter((model: any) =>
            model.supportedGenerationMethods?.includes('generateContent')
        );

        console.log(`✅ 총 ${data.models.length}개 모델 중 generateContent 지원: ${generateContentModels.length}개\n`);

        console.log('📝 주요 추천 모델:\n');
        const recommendedModels = [
            'models/gemini-2.5-flash',
            'models/gemini-2.5-pro',
            'models/gemini-2.0-flash',
        ];

        recommendedModels.forEach((modelName) => {
            const model = generateContentModels.find((m: any) => m.name === modelName);
            if (model) {
                console.log(`   ✓ ${model.name}`);
                console.log(`     ${model.displayName} - ${model.description}`);
                console.log('');
            }
        });

        return generateContentModels[0]?.name || 'models/gemini-2.5-flash';

    } catch (error: any) {
        console.error('❌ 모델 조회 실패:', error.message);
        return null;
    }
}

/**
 * 2. Gemini API로 실제 텍스트 요약 테스트
 */
async function testGeminiSummarization(modelName: string) {
    console.log('='.repeat(60));
    console.log('🤖 2단계: Gemini API 텍스트 요약 테스트\n');
    console.log(`사용 모델: ${modelName}\n`);

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    const testText = `
안녕하세요. 오늘은 AI 기술에 대해 이야기해보겠습니다.
인공지능은 현대 사회에서 점점 더 중요한 역할을 하고 있습니다.
특히 자연어 처리 기술의 발전으로 인해 번역, 요약, 대화 등 다양한 분야에서 활용되고 있습니다.
앞으로 AI 기술은 더욱 발전하여 우리 생활에 깊숙이 자리잡을 것입니다.
    `.trim();

    const prompt = `다음 텍스트를 한국어로 3-5문장으로 간결하게 요약해주세요:\n\n${testText}`;

    try {
        console.log('📤 요청 전송 중...');
        const result = await model.generateContent(prompt);
        const response = result.response;
        const summary = response.text();

        console.log('✅ 요약 성공!\n');
        console.log('📥 원문:');
        console.log(testText);
        console.log('\n📝 요약 결과:');
        console.log(summary);
        console.log('');

        return true;
    } catch (error: any) {
        console.error('❌ 요약 실패:', error.message);
        return false;
    }
}

/**
 * 메인 실행
 */
async function main() {
    console.log('\n🧪 Gemini API 통합 테스트\n');
    console.log('='.repeat(60));
    console.log('');

    // 1단계: 모델 목록 확인
    const modelName = await listAvailableModels();

    if (!modelName) {
        console.error('\n❌ 테스트 실패: 사용 가능한 모델을 찾을 수 없습니다.\n');
        return;
    }

    // 2단계: 요약 테스트
    const success = await testGeminiSummarization(modelName);

    console.log('='.repeat(60));
    if (success) {
        console.log('\n✅ 모든 테스트 통과! Gemini API가 정상적으로 작동합니다.\n');
    } else {
        console.log('\n❌ 테스트 실패\n');
    }
}

main();
