import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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
 * 파일의 MD5 해시 계산
 */
function calculateMD5(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * R2에서 파일의 ETag(MD5) 가져오기
 */
async function getR2FileETag(client: S3Client, bucketName: string, key: string): Promise<string | null> {
    try {
        const command = new HeadObjectCommand({
            Bucket: bucketName,
            Key: key,
        });
        const response = await client.send(command);
        // ETag는 따옴표로 감싸져 있음 ("abc123")
        return response.ETag?.replace(/"/g, '') || null;
    } catch (error) {
        // 파일이 없으면 null 반환
        return null;
    }
}

/**
 * 파일이 변경되었는지 확인
 */
async function isFileChanged(
    client: S3Client,
    bucketName: string,
    key: string,
    content: string
): Promise<boolean> {
    const localMD5 = calculateMD5(content);
    const remoteMD5 = await getR2FileETag(client, bucketName, key);
    
    if (!remoteMD5) {
        // 파일이 없으면 업로드 필요
        return true;
    }
    
    // MD5가 다르면 업로드 필요
    return localMD5 !== remoteMD5;
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
 * R2에 날짜별 JSON 업로드 (변경된 것만)
 */
export async function uploadDailySummariesToR2(
    records: SummaryRecord[],
    bucketName: string,
    options?: { forceUpload?: boolean }
): Promise<void> {
    const client = getR2Client();
    const grouped = groupByDate(records);
    const today = new Date().toISOString().split('T')[0];
    
    let uploadedCount = 0;
    let skippedCount = 0;
    
    for (const [date, items] of grouped.entries()) {
        const dailySummary: DailySummary = {
            date,
            generatedAt: new Date().toISOString(),
            count: items.length,
            items: items.sort((a, b) => 
                new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            ),
        };
        
        const content = JSON.stringify(dailySummary);
        const key = `summaries/${date}.json`;
        
        // 오늘 날짜는 항상 업로드 (자주 변경됨)
        const isToday = date === today;
        const forceUpload = options?.forceUpload || isToday;
        
        if (!forceUpload) {
            // 변경 확인
            const changed = await isFileChanged(client, bucketName, key, content);
            if (!changed) {
                console.log(`  ⏭️  건너뜀: ${key} (변경 없음)`);
                skippedCount++;
                continue;
            }
        }
        
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: content,
            ContentType: 'application/json',
            CacheControl: isToday ? 'public, max-age=300' : 'public, max-age=3600',
        });
        
        await client.send(command);
        console.log(`  ✅ R2 업로드: ${key} (${items.length}개)${isToday ? ' [오늘]' : ''}`);
        uploadedCount++;
    }
    
    console.log(`\n  📊 업로드: ${uploadedCount}개, 건너뜀: ${skippedCount}개`);
}

/**
 * R2에 index.json 업로드 (항상 업로드 - 자주 변경됨)
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
    console.log(`  ✅ R2 업로드: index.json (${dates.length}개 날짜, 오늘: ${todayItems.length}개)`);
}

/**
 * R2에서 모든 요약 데이터 다운로드
 */
export async function downloadAllSummariesFromR2(bucketName: string): Promise<SummaryRecord[]> {
    const client = getR2Client();
    const allRecords: SummaryRecord[] = [];
    
    try {
        // summaries/ 폴더의 모든 파일 목록
        const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: 'summaries/',
        });
        
        const listResponse = await client.send(listCommand);
        
        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            console.log('  ℹ️  R2에 데이터가 없습니다.');
            return [];
        }
        
        console.log(`  📥 R2에서 ${listResponse.Contents.length}개 파일 다운로드 중...`);
        
        // 각 파일 다운로드
        for (const item of listResponse.Contents) {
            if (!item.Key || !item.Key.endsWith('.json')) continue;
            
            const getCommand = new GetObjectCommand({
                Bucket: bucketName,
                Key: item.Key,
            });
            
            const response = await client.send(getCommand);
            const body = await response.Body?.transformToString();
            
            if (body) {
                const dailySummary = JSON.parse(body) as DailySummary;
                allRecords.push(...dailySummary.items);
            }
        }
        
        console.log(`  ✅ R2에서 ${allRecords.length}개 요약 다운로드 완료`);
        return allRecords;
        
    } catch (error) {
        console.error('  ❌ R2 다운로드 실패:', error);
        throw error;
    }
}

/**
 * 요약 데이터 병합 (videoId 기준, 최신 processedAt 우선)
 */
export function mergeSummaryRecords(
    r2Records: SummaryRecord[],
    localRecords: SummaryRecord[]
): SummaryRecord[] {
    const recordMap = new Map<string, SummaryRecord>();
    
    // R2 데이터 먼저 추가
    for (const record of r2Records) {
        const key = record.url; // URL을 고유 키로 사용
        recordMap.set(key, record);
    }
    
    // 로컬 데이터로 업데이트 (같은 키면 최신 것으로)
    for (const record of localRecords) {
        const key = record.url;
        const existing = recordMap.get(key);
        
        if (!existing) {
            // 새 데이터
            recordMap.set(key, record);
        } else {
            // 기존 데이터와 비교 (processedAt 기준)
            const existingTime = new Date(existing.processedAt).getTime();
            const newTime = new Date(record.processedAt).getTime();
            
            if (newTime > existingTime) {
                // 로컬이 더 최신
                recordMap.set(key, record);
            }
            // 아니면 R2 것 유지
        }
    }
    
    // 날짜순 정렬
    return Array.from(recordMap.values()).sort((a, b) => {
        const timeA = new Date(a.publishedAt).getTime();
        const timeB = new Date(b.publishedAt).getTime();
        if (timeA !== timeB) {
            return timeB - timeA;
        }
        return new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime();
    });
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
