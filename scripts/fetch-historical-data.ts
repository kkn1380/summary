import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fetchChannelVideosByDateRange, fetchMultipleChannelsVideos } from '../src/youtubeApiClient.js';
import { extractSubtitles, formatSubtitlesPlain } from '../src/subtitleExtractor.js';
import { summarizeSubtitles, RateLimitError, ServiceUnavailableError } from '../src/aiSummarizer.js';
import { appendToSheet } from '../src/sheetsManager.js';
import { markVideoAsProcessed } from '../src/stateManager.js';

dotenv.config();

interface HistoricalFetchOptions {
    channelIds: string[];
    startDate?: Date;
    endDate?: Date;
    maxResultsPerChannel?: number;
    skipExisting?: boolean;
    summarize?: boolean;
    updateSheet?: boolean;
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function processVideo(
    videoId: string,
    title: string,
    channelName: string,
    publishedAt: Date,
    url: string,
    options: { summarize: boolean; updateSheet: boolean }
): Promise<void> {
    const cacheDir = path.join(process.cwd(), 'data', 'cache');
    const subtitleFile = path.join(cacheDir, `${videoId}.subtitle.txt`);
    const summaryFile = path.join(cacheDir, `${videoId}.summary.txt`);

    try {
        // 1. 자막 추출
        let subtitleText: string;
        if (await fileExists(subtitleFile)) {
            console.log(`   📄 캐시된 자막 사용: ${videoId}`);
            subtitleText = await fs.readFile(subtitleFile, 'utf-8');
        } else {
            console.log(`   🔍 자막 추출 중: ${videoId}`);
            const lang = process.env.SUBTITLE_LANGUAGE || 'ko';
            const contentInfo = await extractSubtitles(videoId, { lang });
            const subtitles = contentInfo.subtitle;

            if (subtitles.length === 0) {
                throw new Error('자막을 찾을 수 없습니다');
            }

            subtitleText = formatSubtitlesPlain(subtitles);
            await fs.mkdir(cacheDir, { recursive: true });
            await fs.writeFile(subtitleFile, subtitleText, 'utf-8');
            console.log(`   ✅ 자막 저장: ${subtitles.length}개 세그먼트`);
        }

        // 2. 요약 생성 (옵션)
        if (options.summarize) {
            let summary: string;
            if (await fileExists(summaryFile)) {
                console.log(`   📄 캐시된 요약 사용: ${videoId}`);
                summary = await fs.readFile(summaryFile, 'utf-8');
            } else {
                console.log(`   🤖 요약 생성 중: ${videoId}`);
                summary = await summarizeSubtitles(subtitleText);
                await fs.writeFile(summaryFile, summary, 'utf-8');
                console.log(`   ✅ 요약 저장`);
            }

            // 3. Google Sheets 업데이트 (옵션)
            if (options.updateSheet && summary !== 'NO_RESPONSE') {
                console.log(`   📊 구글 시트 업데이트 중: ${videoId}`);
                await appendToSheet({
                    title,
                    channelName,
                    publishedAt: publishedAt.toISOString(),
                    url,
                    summary,
                    processedAt: new Date().toISOString(),
                });
            }
        }

        await markVideoAsProcessed(videoId, 'success');
        console.log(`   ✅ 완료: ${title}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ 실패: ${title} - ${errorMessage}`);
        await markVideoAsProcessed(videoId, 'failed', errorMessage);
        throw error;
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    // 사용법 출력
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
사용법: npx tsx scripts/fetch-historical-data.ts [옵션]

옵션:
  --start YYYY-MM-DD        시작 날짜 (기본: 1년 전)
  --end YYYY-MM-DD          종료 날짜 (기본: 오늘)
  --max N                   채널당 최대 동영상 수 (기본: 500)
  --channels CH1,CH2        채널 ID (쉼표 구분, 기본: .env의 YOUTUBE_CHANNEL_IDS)
  --summarize               자막 요약 생성
  --update-sheet            구글 시트 업데이트
  --skip-existing           이미 처리된 동영상 건너뛰기

예시:
  # 최근 1년치 자막만 수집
  npx tsx scripts/fetch-historical-data.ts

  # 특정 기간 + 요약 + 시트 업데이트
  npx tsx scripts/fetch-historical-data.ts --start 2024-01-01 --end 2024-12-31 --summarize --update-sheet

  # 특정 채널만
  npx tsx scripts/fetch-historical-data.ts --channels UCxxxxxx,UCyyyyyy --max 100
        `);
        return;
    }

    // 옵션 파싱
    const getArgValue = (flag: string): string | undefined => {
        const index = args.indexOf(flag);
        return index !== -1 && args[index + 1] ? args[index + 1] : undefined;
    };

    const startDateStr = getArgValue('--start');
    const endDateStr = getArgValue('--end');
    const maxStr = getArgValue('--max');
    const channelsStr = getArgValue('--channels');

    const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const maxResults = maxStr ? parseInt(maxStr, 10) : 500;
    const summarize = args.includes('--summarize');
    const updateSheet = args.includes('--update-sheet');
    const skipExisting = args.includes('--skip-existing');

    const channelIds = channelsStr
        ? channelsStr.split(',').map(id => id.trim())
        : (process.env.YOUTUBE_CHANNEL_IDS || '').split(',').map(id => id.trim()).filter(Boolean);

    if (channelIds.length === 0) {
        console.error('❌ 채널 ID가 없습니다. --channels 옵션을 사용하거나 .env에 YOUTUBE_CHANNEL_IDS를 설정하세요.');
        process.exit(1);
    }

    console.log('🚀 과거 데이터 수집 시작\n');
    console.log(`📅 기간: ${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`);
    console.log(`📺 채널: ${channelIds.length}개`);
    console.log(`📊 채널당 최대: ${maxResults}개`);
    console.log(`🤖 요약 생성: ${summarize ? '예' : '아니오'}`);
    console.log(`📋 시트 업데이트: ${updateSheet ? '예' : '아니오'}`);
    console.log(`⏭️  기존 건너뛰기: ${skipExisting ? '예' : '아니오'}\n`);

    // 동영상 목록 가져오기
    console.log('🔍 YouTube API로 동영상 목록 가져오는 중...\n');
    const videos = await fetchMultipleChannelsVideos(channelIds, {
        maxResultsPerChannel: maxResults,
        publishedAfter: startDate,
        publishedBefore: endDate,
    });

    console.log(`\n📹 총 ${videos.length}개의 동영상 발견\n`);

    if (videos.length === 0) {
        console.log('처리할 동영상이 없습니다.');
        return;
    }

    // 동영상 처리
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        console.log(`\n[${i + 1}/${videos.length}] ${video.title}`);
        console.log(`   채널: ${video.channelName}`);
        console.log(`   게시일: ${video.publishedAt.toLocaleDateString('ko-KR')}`);

        // 기존 파일 확인
        if (skipExisting) {
            const cacheDir = path.join(process.cwd(), 'data', 'cache');
            const subtitleFile = path.join(cacheDir, `${video.videoId}.subtitle.txt`);
            if (await fileExists(subtitleFile)) {
                console.log(`   ⏭️  이미 처리됨, 건너뛰기`);
                skipCount++;
                continue;
            }
        }

        try {
            await processVideo(
                video.videoId,
                video.title,
                video.channelName,
                video.publishedAt,
                video.url,
                { summarize, updateSheet }
            );
            successCount++;

            // Rate limit 방지를 위한 딜레이 (요약 생성 시)
            if (summarize && i < videos.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

        } catch (error) {
            failCount++;
            if (error instanceof RateLimitError) {
                console.error('\n⛔ Gemini API Rate Limit 도달. 작업 중단.');
                break;
            }
            if (error instanceof ServiceUnavailableError) {
                console.error('\n⛔ Gemini API Service Unavailable. 작업 중단.');
                break;
            }
            // 다른 에러는 계속 진행
        }
    }

    // 결과 요약
    console.log('\n' + '='.repeat(60));
    console.log('📊 처리 결과');
    console.log('='.repeat(60));
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`⏭️  건너뜀: ${skipCount}개`);
    console.log(`❌ 실패: ${failCount}개`);
    console.log(`📝 총: ${videos.length}개`);
    console.log('='.repeat(60));
}

main().catch(error => {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
});
