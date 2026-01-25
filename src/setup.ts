import fs from 'fs/promises';
import path from 'path';

console.log('🔧 YouTube 채널 모니터 설정 가이드\n');
console.log('='.repeat(60));

async function checkFileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function setup() {
    console.log('\n📋 필요한 설정 항목을 확인합니다...\n');

    // 1. .env 파일 확인
    const envExists = await checkFileExists('.env');
    if (!envExists) {
        console.log('⚠️  .env 파일이 없습니다.');
        console.log('   .env.example 파일을 복사하여 .env 파일을 생성하세요:');
        console.log('   $ cp .env.example .env\n');
    } else {
        console.log('✅ .env 파일이 있습니다.\n');
    }

    // 2. Service Account Key 파일 확인
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './service-account-key.json';
    const keyExists = await checkFileExists(keyPath);

    if (!keyExists) {
        console.log('⚠️  Google Service Account Key 파일이 없습니다.');
        console.log('   다음 단계를 따라 설정하세요:\n');
        console.log('   1. Google Cloud Console (https://console.cloud.google.com) 접속');
        console.log('   2. 새 프로젝트 생성 또는 기존 프로젝트 선택');
        console.log('   3. "APIs & Services" > "Library"에서 "Google Sheets API" 활성화');
        console.log('   4. "APIs & Services" > "Credentials" > "Create Credentials"');
        console.log('   5. "Service Account" 선택 및 생성');
        console.log('   6. JSON 키 파일 다운로드');
        console.log(`   7. 다운로드한 파일을 ${keyPath}로 저장\n`);
    } else {
        console.log('✅ Google Service Account Key 파일이 있습니다.\n');
    }

    // 3. 필수 환경 변수 확인
    console.log('📝 필수 환경 변수:\n');

    const requiredVars = [
        { name: 'YOUTUBE_CHANNEL_IDS', desc: 'YouTube 채널 ID (쉼표로 구분)', example: 'UCxxxxxx,UCyyyyyy' },
        { name: 'AI_PROVIDER', desc: 'AI 제공자 (gemini 또는 openai)', example: 'gemini' },
        { name: 'GEMINI_API_KEY', desc: 'Gemini API 키', example: 'AIza...', link: 'https://aistudio.google.com' },
        { name: 'GOOGLE_SHEETS_SPREADSHEET_ID', desc: '구글 시트 ID', example: '1X2Y3Z...' },
    ];

    for (const vari of requiredVars) {
        const value = process.env[vari.name];
        if (!value || value.includes('your_') || value.includes('xxxxx')) {
            console.log(`   ❌ ${vari.name}`);
            console.log(`      설명: ${vari.desc}`);
            console.log(`      예시: ${vari.example}`);
            if (vari.link) {
                console.log(`      발급: ${vari.link}`);
            }
            console.log('');
        } else {
            console.log(`   ✅ ${vari.name}`);
        }
    }

    console.log('\n='.repeat(60));
    console.log('\n📚 추가 정보:\n');
    console.log('YouTube 채널 ID 찾기:');
    console.log('  1. YouTube 채널 페이지 접속');
    console.log('  2. 페이지 소스 보기 (우클릭 > 페이지 소스 보기)');
    console.log('  3. "channel_id" 또는 "browse_id" 검색');
    console.log('  4. UC로 시작하는 ID 복사\n');

    console.log('Gemini API 키 발급:');
    console.log('  1. https://aistudio.google.com 접속');
    console.log('  2. "Get API Key" 클릭');
    console.log('  3. API 키 생성 및 복사\n');

    console.log('Google Sheets 설정:');
    console.log('  1. 새 구글 시트 생성 또는 기존 시트 열기');
    console.log('  2. URL에서 Spreadsheet ID 복사');
    console.log('     (https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit)');
    console.log('  3. Service Account 이메일과 시트 공유 (편집 권한)\n');

    console.log('\n사용법:');
    console.log('  한 번 실행: npm run monitor');
    console.log('  주기 실행: npm run monitor:watch (1시간마다)\n');

    console.log('='.repeat(60));
}

setup().catch(console.error);
