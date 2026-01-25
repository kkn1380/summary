import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

/**
 * 1. Google Sheets 연결 확인
 */
async function testSheetsConnection() {
    console.log('🔍 1단계: Google Sheets 연결 테스트\n');
    console.log('='.repeat(60));

    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './service-account-key.json';
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    // Service Account 키 파일 확인
    if (!fs.existsSync(keyPath)) {
        console.error(`❌ Service Account 키 파일을 찾을 수 없습니다: ${keyPath}`);
        return null;
    }
    console.log(`✅ Service Account 키 파일 존재: ${keyPath}`);

    const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    console.log(`✅ Service Account 이메일: ${keyFile.client_email}\n`);

    // Spreadsheet ID 확인
    if (!spreadsheetId) {
        console.error('❌ GOOGLE_SHEETS_SPREADSHEET_ID가 설정되지 않았습니다.');
        return null;
    }
    console.log(`✅ Spreadsheet ID: ${spreadsheetId}\n`);

    // Google Sheets API 인증
    const auth = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    try {
        console.log('📡 스프레드시트 접근 시도 중...');
        const response = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId,
        });

        console.log('✅ 스프레드시트 접근 성공!\n');
        console.log(`   제목: ${response.data.properties?.title}`);
        console.log(`   로케일: ${response.data.properties?.locale}`);
        console.log(`   시트 개수: ${response.data.sheets?.length}\n`);

        console.log('📋 사용 가능한 시트 목록:');
        response.data.sheets?.forEach((sheet, index) => {
            console.log(`   ${index + 1}. ${sheet.properties?.title} (ID: ${sheet.properties?.sheetId})`);
        });
        console.log('');

        return { sheets, spreadsheetId, sheetList: response.data.sheets };

    } catch (error: any) {
        console.error('❌ 스프레드시트 접근 실패:', error.message);

        if (error.code === 404) {
            console.error('\n💡 해결 방법:');
            console.error('   - Spreadsheet ID가 올바른지 확인하세요');
            console.error('   - 스프레드시트가 삭제되지 않았는지 확인하세요\n');
        } else if (error.code === 403) {
            console.error('\n💡 해결 방법:');
            console.error(`   1. 스프레드시트 공유 대상에 다음 이메일을 추가하세요:`);
            console.error(`      ${keyFile.client_email}`);
            console.error(`   2. 권한을 "편집자"로 설정하세요\n`);
        }

        return null;
    }
}

/**
 * 2. 데이터 추가 테스트 (새 탭 생성)
 */
async function testAppendData(spreadsheetId: string) {
    console.log('='.repeat(60));
    console.log('📝 2단계: 새 탭 생성 및 데이터 추가 테스트\n');

    try {
        const now = new Date();

        console.log('📤 테스트 데이터로 새 탭 생성 중...');
        console.log(`   제목: [테스트] 샘플 동영상 - AI 기술 소개`);
        console.log(`   날짜: ${now.toISOString().split('T')[0]}\n`);

        // appendToSheet 함수는 자동으로 새 탭 생성
        const { appendToSheet } = await import('../src/sheetsManager.js');

        await appendToSheet({
            title: '[테스트] 샘플 동영상 - AI 기술 소개',
            channelName: '테스트 채널',
            publishedAt: now.toISOString(),
            url: 'https://youtube.com/watch?v=test123',
            summary: '이것은 테스트 요약입니다. Gemini API 연동 및 Google Sheets 연동 테스트를 위한 샘플 데이터입니다. 각 동영상마다 새로운 탭이 생성되어 관리가 편리합니다.',
            processedAt: now.toISOString(),
        });

        console.log('\n✅ 테스트 성공!');
        console.log(`   💡 새로운 탭이 "날짜_제목" 형식으로 생성되었습니다!`);
        console.log(`   📊 스프레드시트 확인: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit\n`);

        return true;

    } catch (error: any) {
        console.error('❌ 데이터 추가 실패:', error.message);
        console.error('\n상세 에러:');
        console.error(error);
        return false;
    }
}

/**
 * 메인 실행
 */
async function main() {
    console.log('\n🧪 Google Sheets 통합 테스트\n');
    console.log('='.repeat(60));
    console.log('');

    // 1단계: 연결 테스트
    const connection = await testSheetsConnection();
    if (!connection) {
        console.log('\n❌ 테스트 실패: Google Sheets 연결 실패\n');
        return;
    }

    // 2단계: 새 탭 생성 및 데이터 추가
    const appendSuccess = await testAppendData(connection.spreadsheetId);

    console.log('='.repeat(60));
    if (appendSuccess) {
        console.log('\n✅ 모든 테스트 통과! Google Sheets 연동이 정상적으로 작동합니다.\n');
        console.log('💡 팁: 각 동영상마다 "YYYY-MM-DD_제목" 형식의 새 탭이 생성됩니다.\n');
    } else {
        console.log('\n❌ 일부 테스트 실패\n');
    }
}

main();
