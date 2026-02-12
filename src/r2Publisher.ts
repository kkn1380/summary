import fs from 'fs/promises';
import path from 'path';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

export interface SummaryRecord {
    title: string;
    channelName: string;
    publishedAt: string;
    url: string;
    summary: string;
    processedAt: string;
}

export interface DailySummary {
    date: string; // YYYY-MM-DD
    generatedAt: string;
    count: number;
    items: SummaryRecord[];
}

export interface IndexData {
    generatedAt: string;
    dates: string[]; // 날짜 목록 (최신순)
    today: DailySummary; // 오늘 데이터 (전체 포함)
}

/**
 * Cloudflare R2 클라이언트 생성
 */
function getR2Client(): S3Client {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error('R2 환경 변수가 설정되지 않았습니다 (CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
    }

    return new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });
}

/**
 * 날짜별로 요약 데이터 그룹화
 */
export function groupByDate(records: SummaryRecord[]): Map<string, SummaryRecord[]> {
    const grouped = new Map<string, SummaryRecord[]>();
    
    for (const record of records) {
        const date = record.publishedAt.split('T')[0]; // YYYY-MM-DD
        if (!grouped.has(date)) {
            grouped.set(date, []);
        }
        grouped.get(date)!.push(record);
    }
    
    return grouped;
}

/**
 * 날짜별 채널 그룹화 (기존 로직 유지)
 */
function groupByChannel(records: SummaryRecord[]): Map<string, SummaryRecord[]> {
    const grouped = new Map<string, SummaryRecord[]>();
    
    for (const record of records) {
        if (!grouped.has(record.channelName)) {
            grouped.set(record.channelName, []);
        }
        grouped.get(record.channelName)!.push(record);
    }
    
    return grouped;
}

/**
 * 로컬에 날짜별 JSON 파일 저장
 */
export async function saveDailySummariesToLocal(
    records: SummaryRecord[],
    outputDir?: string
): Promise<void> {
    const dir = outputDir || path.join(process.cwd(), 'data', 'site', 'summaries');
    await fs.mkdir(dir, { recursive: true });

    const grouped = groupByDate(records);
    
    for (const [date, items] of grouped.entries()) {
        const dailySummary: DailySummary = {
            date,
            generatedAt: new Date().toISOString(),
            count: items.length,
            items: items.sort((a, b) => 
                new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            ),
        };
        
        const filePath = path.join(dir, `${date}.json`);
        await fs.writeFile(filePath, JSON.stringify(dailySummary, null, 2), 'utf-8');
        console.log(`  ✅ 저장: ${date}.json (${items.length}개)`);
    }
}

/**
 * index.json 생성 (메타데이터 + 오늘 데이터)
 */
export async function saveIndexToLocal(
    records: SummaryRecord[],
    outputDir?: string
): Promise<void> {
    const dir = outputDir || path.join(process.cwd(), 'data', 'site');
    await fs.mkdir(dir, { recursive: true });

    const grouped = groupByDate(records);
    const dates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a)); // 최신순
    
    const today = dates[0];
    const todayItems = grouped.get(today) || [];
    
    const indexData: IndexData = {
        generatedAt: new Date().toISOString(),
        dates,
        today: {
            date: today,
            generatedAt: new Date().toISOString(),
            count: todayItems.length,
            items: todayItems.sort((a, b) => 
                new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            ),
        },
    };
    
    const filePath = path.join(dir, 'index.json');
    await fs.writeFile(filePath, JSON.stringify(indexData, null, 2), 'utf-8');
    console.log(`  ✅ index.json 생성 (${dates.length}개 날짜, 오늘: ${todayItems.length}개)`);
}

/**
 * R2에 날짜별 JSON 업로드
 */
export async function uploadDailySummariesToR2(
    records: SummaryRecord[],
    bucketName: string
): Promise<void> {
    const client = getR2Client();
    const grouped = groupByDate(records);
    
    for (const [date, items] of grouped.entries()) {
        const dailySummary: DailySummary = {
            date,
            generatedAt: new Date().toISOString(),
            count: items.length,
            items: items.sort((a, b) => 
                new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            ),
        };
        
        const key = `summaries/${date}.json`;
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: JSON.stringify(dailySummary),
            ContentType: 'application/json',
            CacheControl: 'public, max-age=3600', // 1시간 캐시
        });
        
        await client.send(command);
        console.log(`  ✅ R2 업로드: ${key} (${items.length}개)`);
    }
}

/**
 * R2에 index.json 업로드
 */
export async function uploadIndexToR2(
    records: SummaryRecord[],
    bucketName: string
): Promise<void> {
    const client = getR2Client();
    const grouped = groupByDate(records);
    const dates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));
    
    const today = dates[0];
    const todayItems = grouped.get(today) || [];
    
    const indexData: IndexData = {
        generatedAt: new Date().toISOString(),
        dates,
        today: {
            date: today,
            generatedAt: new Date().toISOString(),
            count: todayItems.length,
            items: todayItems.sort((a, b) => 
                new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            ),
        },
    };
    
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: 'index.json',
        Body: JSON.stringify(indexData),
        ContentType: 'application/json',
        CacheControl: 'public, max-age=300', // 5분 캐시 (자주 업데이트)
    });
    
    await client.send(command);
    console.log(`  ✅ R2 업로드: index.json (${dates.length}개 날짜)`);
}

/**
 * R2의 모든 날짜 목록 가져오기
 */
export async function listDatesInR2(bucketName: string): Promise<string[]> {
    const client = getR2Client();
    const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: 'summaries/',
    });
    
    const response = await client.send(command);
    const dates: string[] = [];
    
    if (response.Contents) {
        for (const item of response.Contents) {
            if (item.Key && item.Key.endsWith('.json')) {
                const date = item.Key.replace('summaries/', '').replace('.json', '');
                dates.push(date);
            }
        }
    }
    
    return dates.sort((a, b) => b.localeCompare(a));
}
