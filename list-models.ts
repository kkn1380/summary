import * as dotenv from 'dotenv';

dotenv.config();

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다');
        return;
    }

    console.log('📋 사용 가능한 Gemini 모델 목록을 가져오는 중...\n');

    try {
        // v1beta API를 사용하여 모델 목록 가져오기
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );

        if (!response.ok) {
            console.error(`❌ HTTP 에러: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error(`응답: ${errorText}\n`);

            if (response.status === 403) {
                console.error('💡 해결 방법:');
                console.error('   API 키가 유효하지 않거나 권한이 없습니다.');
                console.error('   Google AI Studio에서 새 API 키를 생성하세요.\n');
            }
            return;
        }

        const data: any = await response.json();

        if (!data.models || data.models.length === 0) {
            console.log('❌ 사용 가능한 모델이 없습니다\n');
            return;
        }

        console.log(`✅ 총 ${data.models.length}개의 모델을 찾았습니다:\n`);

        // generateContent를 지원하는 모델만 필터링
        const generateContentModels = data.models.filter((model: any) =>
            model.supportedGenerationMethods?.includes('generateContent')
        );

        console.log('📝 generateContent를 지원하는 모델:\n');
        generateContentModels.forEach((model: any) => {
            console.log(`   ✓ ${model.name}`);
            console.log(`     - 표시 이름: ${model.displayName}`);
            console.log(`     - 설명: ${model.description}`);
            console.log('');
        });

        if (generateContentModels.length > 0) {
            const recommendedModel = generateContentModels[0].name;
            console.log(`💡 권장 모델: ${recommendedModel}`);
            console.log(`   코드에서 사용할 이름: "${recommendedModel}"\n`);
        }

    } catch (error: any) {
        console.error('❌ 에러 발생:', error.message);
    }
}

listModels();
