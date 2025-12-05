import { google } from 'googleapis';
import fs from 'fs/promises';

export interface SheetRow {
    title: string;
    channelName: string;
    publishedAt: string;
    url: string;
    summary: string;
    processedAt: string;
}

/**
 * Google Sheets API 클라이언트를 초기화합니다
 */
async function getGoogleSheetsClient() {
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    if (!keyPath) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_PATH 환경 변수가 설정되지 않았습니다');
    }

    try {
        const keyFile = await fs.readFile(keyPath, 'utf-8');
        const credentials = JSON.parse(keyFile);

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        return google.sheets({ version: 'v4', auth });
    } catch (error) {
        console.error('Failed to initialize Google Sheets client:', error);
        throw new Error('Google Sheets 클라이언트 초기화에 실패했습니다');
    }
}

/**
 * 시트에 헤더가 있는지 확인하고 없으면 추가합니다
 */
async function ensureHeaders(
    sheets: any,
    spreadsheetId: string,
    sheetName: string
): Promise<void> {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A1:F1`,
        });

        // If no data exists, add headers
        if (!response.data.values || response.data.values.length === 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A1:F1`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [['동영상 제목', '채널명', '게시일', 'URL', '자막 요약', '처리일시']],
                },
            });
        }
    } catch (error) {
        console.error('Failed to ensure headers:', error);
        throw error;
    }
}

/**
 * Google Sheets에 데이터를 추가합니다
 */
export async function appendToSheet(row: SheetRow): Promise<void> {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Sheet1';

    if (!spreadsheetId) {
        throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID 환경 변수가 설정되지 않았습니다');
    }

    const sheets = await getGoogleSheetsClient();

    // Ensure headers exist
    await ensureHeaders(sheets, spreadsheetId, sheetName);

    // Append the new row
    const values = [
        [
            row.title,
            row.channelName,
            row.publishedAt,
            row.url,
            row.summary,
            row.processedAt,
        ],
    ];

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A:F`,
            valueInputOption: 'RAW',
            requestBody: {
                values,
            },
        });

        console.log(`✅ 구글 시트에 추가됨: ${row.title}`);
    } catch (error) {
        console.error('Failed to append to sheet:', error);
        throw new Error('구글 시트에 데이터 추가 실패');
    }
}

/**
 * 시트에서 이미 처리된 URL 목록을 가져옵니다
 */
export async function getProcessedUrls(): Promise<Set<string>> {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Sheet1';

    if (!spreadsheetId) {
        return new Set();
    }

    try {
        const sheets = await getGoogleSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!D:D`, // URL column
        });

        const urls = new Set<string>();
        if (response.data.values) {
            // Skip header row
            response.data.values.slice(1).forEach(row => {
                if (row[0]) {
                    urls.add(row[0]);
                }
            });
        }

        return urls;
    } catch (error) {
        console.error('Failed to get processed URLs:', error);
        return new Set();
    }
}
