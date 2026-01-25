import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import path from 'path';
import { getMultipleChannelsVideos, VideoInfo } from './channelMonitor.js';
import { extractSubtitles, formatSubtitlesPlain } from './subtitleExtractor.js';
import { summarizeSubtitles } from './aiSummarizer.js';
import { appendToSheet } from './sheetsManager.js';
import { isVideoProcessed, markVideoAsProcessed } from './stateManager.js';
import {
    writeSummariesToLocal,
    writeSummariesHtmlToLocal,
    writeSummariesToGcs,
    SummaryRecord,
} from './sitePublisher.js';

async function fileExists(p: string) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

// Load environment variables
dotenv.config();

/**
 * 단일 동영상을 처리합니다
 */
async function processVideo(video: VideoInfo): Promise<string | null> {
    console.log(`\n📹 처리 중: ${video.title}`);
    console.log(`   채널: ${video.channelName}`);
    console.log(`   게시일: ${video.publishedAt.toLocaleDateString('ko-KR')}`);
    console.log(`   URL: ${video.url}`);

    const cacheDir = path.join(process.cwd(), 'data', 'cache');
    const subtitleFile = path.join(cacheDir, `${video.videoId}.subtitle.txt`);
    const summaryFile = path.join(cacheDir, `${video.videoId}.summary.txt`);

    try {
        // 0. 요약 캐시가 있으면 바로 시트 반영
        let summary: string | null = null;
        const hasSummary = await fileExists(summaryFile);
        if (hasSummary) {
            summary = await fs.readFile(summaryFile, 'utf-8');
            console.log('   🗂  캐시된 요약 사용');
        }

        // 1. 자막 캐시 확인 후 없으면 추출
        let subtitleText: string | null = null;
        if (!summary) {
            const hasSubtitle = await fileExists(subtitleFile);
            if (hasSubtitle) {
                console.log('   🗂  캐시된 자막 사용');
                subtitleText = await fs.readFile(subtitleFile, 'utf-8');
            } else {
                console.log('   🔍 자막 추출 중...');
                console.log(`   🔤 시도 언어: ${process.env.SUBTITLE_LANGUAGE || 'ko'} (자동자막 포함 en/a.en fallback)`);
                const lang = process.env.SUBTITLE_LANGUAGE || 'ko';
                const contentInfo = await extractSubtitles(video.videoId, { lang });
                const subtitles = contentInfo.subtitle;

                if (subtitles.length === 0) {
                    throw new Error('자막을 찾을 수 없습니다');
                }

                subtitleText = formatSubtitlesPlain(subtitles);
                console.log(`   ✅ 자막 추출 완료: ${subtitles.length}개 세그먼트`);
                await fs.mkdir(cacheDir, { recursive: true });
                await fs.writeFile(subtitleFile, subtitleText, 'utf-8');
            }
        }

        // 2. AI 요약 생성 (캐시 없을 때만)
        if (!summary) {
            console.log('   🤖 요약 생성 중...');
            summary = await summarizeSubtitles(subtitleText || '');
            console.log(`   ✅ 요약 완료`);
            await fs.mkdir(cacheDir, { recursive: true });
            await fs.writeFile(summaryFile, summary, 'utf-8');
        }

        // 3. Google Sheets에 추가
        if (summary.length > 0) {
            console.log('   📊 구글 시트 업데이트 중...');
            await appendToSheet({
                title: video.title,
                channelName: video.channelName,
                publishedAt: video.publishedAt.toISOString(),
                url: video.url,
                summary,
                processedAt: new Date().toISOString(),
            });
        } else {
            console.log(`summary(${summary})`);
            console.log(` 주식 정보가 아님. ${contentInfo.details.title}`)
        }

        // 4. 처리 완료 기록
        await markVideoAsProcessed(video.videoId, 'success');
        console.log(`   ✅ 처리 완료!`);
        return summary.length > 0 ? summary : null;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ 오류 발생: ${errorMessage}`);
        if (error instanceof Error && error.stack) {
            console.error(error.stack);
        }
        await markVideoAsProcessed(video.videoId, 'failed', errorMessage);
        throw error;
    }
}

/**
 * 메인 모니터링 함수
 */
export async function monitor(): Promise<void> {
    console.log('🚀 YouTube 채널 모니터링 시작...\n');

    // 환경 변수 확인
    const channelIdsStr = process.env.YOUTUBE_CHANNEL_IDS;
    if (!channelIdsStr) {
        throw new Error('YOUTUBE_CHANNEL_IDS 환경 변수가 설정되지 않았습니다');
    }

    const channelIds = channelIdsStr.split(',').map(id => id.trim()).filter(Boolean);
    const maxVideos = parseInt(process.env.MAX_VIDEOS_PER_CHECK || '10', 10);

    console.log(`📺 모니터링 대상 채널: ${channelIds.length}개`);
    console.log(`📊 채널당 확인할 최대 동영상 수: ${maxVideos}개\n`);

    // 1. 채널들의 최신 동영상 가져오기
    console.log('🔍 최신 동영상 확인 중...');
    const videos = await getMultipleChannelsVideos(channelIds, maxVideos);
    console.log(`📹 총 ${videos.length}개의 동영상 발견\n`);

    if (videos.length === 0) {
        console.log('새로운 동영상이 없습니다.');
        return;
    }

    // 2. 처리되지 않은 동영상 필터링
    const unprocessedVideos: VideoInfo[] = [];
    for (const video of videos) {
        const processed = await isVideoProcessed(video.videoId);
        if (!processed) {
            unprocessedVideos.push(video);
        }
    }

    console.log(`🆕 새로운 동영상: ${unprocessedVideos.length}개\n`);

    if (unprocessedVideos.length === 0) {
        console.log('모든 동영상이 이미 처리되었습니다.');
        return;
    }

    // 3. 각 동영상 처리
    let successCount = 0;
    let failCount = 0;

    const summaryRecords: SummaryRecord[] = [];

    for (const video of unprocessedVideos) {
        try {
            const summary = await processVideo(video);
            if (summary) {
                summaryRecords.push({
                    title: video.title,
                    channelName: video.channelName,
                    publishedAt: video.publishedAt.toISOString(),
                    url: video.url,
                    summary,
                    processedAt: new Date().toISOString(),
                });
            }
            successCount++;
        } catch (error) {
            failCount++;
            // Continue with next video
        }
    }

    // 4. 결과 요약
    console.log('\n' + '='.repeat(60));
    console.log('📊 처리 결과 요약');
    console.log('='.repeat(60));
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failCount}개`);
    console.log(`📝 총 처리: ${successCount + failCount}개`);
    console.log('='.repeat(60));

    // 정적 페이지용 로컬 JSON 출력 (로컬 테스트 우선)
    if (summaryRecords.length > 0) {
        const outputDir = process.env.SUMMARY_OUTPUT_DIR;
        const resolvedOutputDir = outputDir && outputDir.trim() ? outputDir : undefined;
        const jsonPath = await writeSummariesToLocal(summaryRecords, {
            outputDir: resolvedOutputDir,
        });
        const htmlPath = await writeSummariesHtmlToLocal(summaryRecords, {
            outputDir: resolvedOutputDir,
        });
        console.log(`🗂  정적 데이터 저장 완료: ${jsonPath}`);
        console.log(`📄 정적 페이지 저장 완료: ${htmlPath}`);

        const gcsBucket = process.env.SUMMARY_BUCKET;
        if (gcsBucket) {
            const prefix = process.env.SUMMARY_PREFIX;
            const { jsonUri, htmlUri } = await writeSummariesToGcs(summaryRecords, {
                bucket: gcsBucket,
                prefix,
            });
            console.log(`☁️  GCS 업로드 완료: ${jsonUri}, ${htmlUri}`);
        }
    }
}

/**
 * Watch 모드: 주기적으로 실행
 */
async function watchMode(): Promise<void> {
    console.log('👀 Watch 모드: 1시간마다 확인합니다...\n');

    // 즉시 한 번 실행
    await monitor();

    // 1시간(3600초)마다 반복
    setInterval(async () => {
        console.log('\n\n' + '='.repeat(60));
        console.log(`🔄 다음 확인: ${new Date().toLocaleString('ko-KR')}`);
        console.log('='.repeat(60) + '\n');

        try {
            await monitor();
        } catch (error) {
            console.error('모니터링 중 오류 발생:', error);
        }
    }, 3600000); // 1 hour in milliseconds
}

// Main execution
async function main() {
    try {
        const args = process.argv.slice(2);
        const isWatchMode = args.includes('--watch');

        if (isWatchMode) {
            await watchMode();
        } else {
            await monitor();
        }
    } catch (error) {
        console.error('\n❌ 오류 발생:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] === thisFile) {
    main();
}
