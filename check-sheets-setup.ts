import * as dotenv from 'dotenv';
import { google } from 'googleapis';
import * as fs from 'fs';

dotenv.config();

async function checkGoogleSheetsSetup() {
    console.log('🔍 Google Sheets 설정 확인 중...\n');

    // 1. Service Account 키 파일 확인
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './service-account-key.json';
    console.log(`1️⃣ Service Account 키 파일 확인`);
    console.log(`   경로: ${keyPath}`);

    if (!fs.existsSync(keyPath)) {
        console.log(`   ❌ 파일이 존재하지 않습니다!`);
        console.log(`   💡 해결: service-account-key.json 파일을 프로젝트 루트에 추가하세요\n`);
        return;
    }
    console.log(`   ✅ 파일 존재\n`);

    // 2. Service Account 이메일 확인
    try {
        const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
        console.log(`2️⃣ Service Account 정보`);
        console.log(`   이메일: ${keyFile.client_email}`);
        console.log(`   프로젝트 ID: ${keyFile.project_id}\n`);

        // 3. Spreadsheet ID 확인
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
        console.log(`3️⃣ Spreadsheet 설정`);
        console.log(`   Spreadsheet ID: ${spreadsheetId || '❌ 설정되지 않음'}`);

        if (!spreadsheetId) {
            console.log(`   💡 해결: .env 파일에 GOOGLE_SHEETS_SPREADSHEET_ID를 설정하세요\n`);
            return;
        }

        const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Sheet1';
        console.log(`   Sheet 이름: ${sheetName}\n`);

        // 4. Google Sheets API 연결 테스트
        console.log(`4️⃣ Google Sheets API 연결 테스트`);

        const auth = new google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        try {
            const response = await sheets.spreadsheets.get({
                spreadsheetId: spreadsheetId,
            });

            console.log(`   ✅ 스프레드시트 접근 성공!`);
            console.log(`   제목: ${response.data.properties?.title}`);
            console.log(`   시트 목록:`);
            response.data.sheets?.forEach((sheet) => {
                console.log(`      - ${sheet.properties?.title}`);
            });
            console.log('');

            // 5. 공유 확인
            console.log(`5️⃣ 권한 확인`);
            console.log(`   ✅ Service Account가 이 스프레드시트에 접근할 수 있습니다`);
            console.log(`   💡 다음을 확인했는지 체크:`);
            console.log(`      • 스프레드시트를 ${keyFile.client_email}과 공유했나요?`);
            console.log(`      • 편집자 권한을 부여했나요?\n`);

        } catch (error: any) {
            console.log(`   ❌ 스프레드시트 접근 실패`);
            console.log(`   에러: ${error.message}\n`);

            if (error.code === 404) {
                console.log(`   💡 해결 방법:`);
                console.log(`      1. Spreadsheet ID가 올바른지 확인하세요`);
                console.log(`         URL: https://docs.google.com/spreadsheets/d/YOUR_ID/edit`);
                console.log(`      2. 또는 스프레드시트가 삭제되지 않았는지 확인하세요\n`);
            } else if (error.code === 403) {
                console.log(`   💡 해결 방법:`);
                console.log(`      1. Google 스프레드시트를 여세요`);
                console.log(`      2. 오른쪽 상단의 "공유" 버튼을 클릭하세요`);
                console.log(`      3. 다음 이메일을 추가하세요:`);
                console.log(`         ${keyFile.client_email}`);
                console.log(`      4. 권한을 "편집자"로 설정하세요`);
                console.log(`      5. "공유" 버튼을 클릭하세요\n`);
            }
        }

    } catch (error: any) {
        console.error(`❌ 오류 발생:`, error.message);
    }
}

checkGoogleSheetsSetup();
