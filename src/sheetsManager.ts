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
 * 안전한 시트 이름 생성 (날짜 + YouTube 제목)
 * Google Sheets 시트 이름 제약: 100자 이하, 특수문자 제한
 */
function createSheetName(videoTitle: string, publishedAt: string): string {
    // 날짜를 YYYY-MM-DD 형식으로 변환
    const date = new Date(publishedAt);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    // 제목에서 안전하지 않은 문자 제거 (: * ? / \ [ ] 등)
    let safeTitle = videoTitle
        .replace(/[:\*\?\/\\[\]]/g, '') // 금지된 문자 제거
        .replace(/\s+/g, ' ')            // 연속 공백을 하나로
        .trim();

    // 시트 이름 최대 길이 100자 제약
    // "YYYY-MM-DD_" = 11자, 제목은 최대 89자
    const maxTitleLength = 89;
    if (safeTitle.length > maxTitleLength) {
        safeTitle = safeTitle.substring(0, maxTitleLength - 3) + '...';
    }

    return `${dateStr}_${safeTitle}`;
}

/**
 * 새로운 시트(탭)을 생성합니다
 */
async function createNewSheet(
    sheets: any,
    spreadsheetId: string,
    sheetName: string
): Promise<void> {
    try {
        // 스프레드시트 정보 가져오기
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId,
        });

        // 같은 이름의 시트가 이미 있는지 확인
        const existingSheet = spreadsheet.data.sheets?.find(
            (sheet: any) => sheet.properties?.title === sheetName
        );

        if (existingSheet) {
            console.log(`   ℹ️  시트 "${sheetName}"이(가) 이미 존재합니다.`);
            return;
        }

        // 새 시트 생성
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: sheetName,
                            },
                        },
                    },
                ],
            },
        });

        console.log(`   ✅ 새 시트 생성됨: "${sheetName}"`);
    } catch (error) {
        console.error('Failed to create new sheet:', error);
        throw error;
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
 * 각 동영상마다 새로운 탭을 생성합니다
 */
export async function appendToSheet(row: SheetRow): Promise<void> {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!spreadsheetId) {
        throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID 환경 변수가 설정되지 않았습니다');
    }

    const sheets = await getGoogleSheetsClient();

    // 날짜와 제목으로 새로운 시트 이름 생성
    const sheetName = createSheetName(row.title, row.publishedAt);

    try {
        // 1. 새 시트 생성 (이미 있으면 스킵)
        console.log(`   📋 시트 준비 중: "${sheetName}"`);
        await createNewSheet(sheets, spreadsheetId, sheetName);

        // 2. 헤더 확인 및 추가
        await ensureHeaders(sheets, spreadsheetId, sheetName);

        // 3. 데이터 추가
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

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A:F`,
            valueInputOption: 'RAW',
            requestBody: {
                values,
            },
        });

        console.log(`   ✅ 구글 시트에 추가됨: "${sheetName}"`);
    } catch (error) {
        console.error('Failed to append to sheet:', error);
        throw new Error('구글 시트에 데이터 추가 실패');
    }
}

/**
 * 시트에서 이미 처리된 URL 목록을 가져옵니다
 * 모든 시트를 확인하여 URL을 수집합니다
 */
export async function getProcessedUrls(): Promise<Set<string>> {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!spreadsheetId) {
        return new Set();
    }

    try {
        const sheets = await getGoogleSheetsClient();

        // 모든 시트 목록 가져오기
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId,
        });

        const urls = new Set<string>();

        // 각 시트의 URL 컬럼(D) 확인
        for (const sheet of spreadsheet.data.sheets || []) {
            const sheetName = sheet.properties?.title;
            if (!sheetName) continue;

            try {
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: `${sheetName}!D:D`, // URL column
                });

                if (response.data.values) {
                    // Skip header row
                    response.data.values.slice(1).forEach(row => {
                        if (row[0]) {
                            urls.add(row[0]);
                        }
                    });
                }
            } catch (error) {
                // 시트가 비어있거나 읽을 수 없는 경우 무시
                continue;
            }
        }

        return urls;
    } catch (error) {
        console.error('Failed to get processed URLs:', error);
        return new Set();
    }
}
