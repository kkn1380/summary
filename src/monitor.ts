import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import path from 'path';
import { getMultipleChannelsVideos, VideoInfo } from './channelMonitor.js';
import { extractSubtitles, extractVideoId, formatSubtitlesPlain } from './subtitleExtractor.js';
import { RateLimitError, ServiceUnavailableError, summarizeSubtitles } from './aiSummarizer.js';
import { appendToSheet } from './sheetsManager.js';
import { isVideoProcessed, markVideoAsProcessed } from './stateManager.js';
import {
    writeSummariesToLocal,
    writeSummariesHtmlToLocal,
    writeSummariesMobileHtmlToLocal,
    writeSummariesToGcs,
    loadExistingSummaries,
    mergeSummaries,
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

async function writeSiteFromRecords(records: SummaryRecord[], outputDir?: string): Promise<void> {
    const resolvedOutputDir = outputDir && outputDir.trim() ? outputDir : undefined;
    const existingRecords = await loadExistingSummaries({
        outputDir: resolvedOutputDir,
    });
    const mergedRecords = mergeSummaries(records, existingRecords);
    if (mergedRecords.length === 0) {
        return;
    }
    
    // JSON 파일만 업데이트
    const jsonPath = await writeSummariesToLocal(mergedRecords, {
        outputDir: resolvedOutputDir,
    });
    console.log(`🗂  정적 데이터 저장 완료: ${jsonPath}`);
    
    // HTML 파일은 존재하지 않을 때만 생성
    const htmlOutputDir = resolvedOutputDir || path.join(process.cwd(), 'data', 'site');
    const htmlPath = path.join(htmlOutputDir, 'index.html');
    const mobileHtmlPath = path.join(htmlOutputDir, 'index.mobile.html');
    
    const htmlExists = await fileExists(htmlPath);
    const mobileHtmlExists = await fileExists(mobileHtmlPath);
    
    if (!htmlExists) {
        await writeSummariesHtmlToLocal(mergedRecords, {
            outputDir: resolvedOutputDir,
        });
        console.log(`📄 정적 페이지 생성 완료: ${htmlPath}`);
    } else {
        console.log(`📄 정적 페이지 유지: ${htmlPath} (이미 존재)`);
    }
    
    if (!mobileHtmlExists) {
        await writeSummariesMobileHtmlToLocal(mergedRecords, {
            outputDir: resolvedOutputDir,
        });
        console.log(`📄 모바일 페이지 생성 완료: ${mobileHtmlPath}`);
    } else {
        console.log(`📄 모바일 페이지 유지: ${mobileHtmlPath} (이미 존재)`);
    }

    const gcsBucket = process.env.SUMMARY_BUCKET;
    if (gcsBucket) {
        const prefix = process.env.SUMMARY_PREFIX;
        const { jsonUri, htmlUri, mobileHtmlUri } = await writeSummariesToGcs(mergedRecords, {
            bucket: gcsBucket,
            prefix,
        });
        console.log(`☁️  GCS 업로드 완료: ${jsonUri}, ${htmlUri}, ${mobileHtmlUri}`);
    }
}

async function summarizePendingCache(): Promise<void> {
    const cacheDir = path.join(process.cwd(), 'data', 'cache');
    const cacheExists = await fileExists(cacheDir);
    if (!cacheExists) {
        return;
    }
    const entries = await fs.readdir(cacheDir);
    const subtitleFiles = entries.filter(name => name.endsWith('.subtitle.txt'));
    if (subtitleFiles.length === 0) {
        return;
    }

    console.log(`🧾 캐시된 자막 중 요약 누락 ${subtitleFiles.length}건 확인 중...`);

    for (const file of subtitleFiles) {
        const videoId = file.replace('.subtitle.txt', '');
        const subtitleFile = path.join(cacheDir, file);
        const summaryFile = path.join(cacheDir, `${videoId}.summary.txt`);
        const hasSummary = await fileExists(summaryFile);
        if (hasSummary) {
            continue;
        }
        console.log(`   🤖 요약 생성(캐시): ${videoId}`);
        const subtitleText = await fs.readFile(subtitleFile, 'utf-8');
        const summary = await summarizeSubtitles(subtitleText);
        await fs.writeFile(summaryFile, summary, 'utf-8');
        console.log(`   ✅ 요약 완료(캐시): ${videoId}`);
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

        if (summary.trim() === 'NO_RESPONSE') {
            console.log('   🚫 관심 주제 아님 (NO_RESPONSE). 재시도하지 않습니다.');
            await markVideoAsProcessed(video.videoId, 'success', 'NO_RESPONSE');
            return null;
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
            console.log(`   ℹ️  요약이 비어있음`);
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
    const outputDir = process.env.SUMMARY_OUTPUT_DIR;

    const summaryRecords: SummaryRecord[] = [];
    const existingRecords = await loadExistingSummaries({
        outputDir: outputDir && outputDir.trim() ? outputDir : undefined,
    });
    const processedIdsFromIndex = new Set(
        existingRecords
            .map(record => extractVideoId(record.url))
            .filter(Boolean)
    );

    console.log(`📺 모니터링 대상 채널: ${channelIds.length}개`);
    console.log(`📊 채널당 확인할 최대 동영상 수: ${maxVideos}개\n`);

    // 0. 캐시된 자막 중 요약 누락분 먼저 처리
    try {
        await summarizePendingCache();
    } catch (error) {
        if (error instanceof RateLimitError) {
            console.error('\n⛔ Gemini API 429 Too Many Requests로 인해 이후 작업을 중단합니다.');
            await writeSiteFromRecords(summaryRecords, outputDir);
            return;
        }
        if (error instanceof ServiceUnavailableError) {
            console.error('\n⛔ Gemini API 503 Service Unavailable로 인해 이후 작업을 중단합니다.');
            await writeSiteFromRecords(summaryRecords, outputDir);
            return;
        }
        throw error;
    }

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
        if (processedIdsFromIndex.has(video.videoId)) {
            console.log(`   ℹ️  index에 이미 존재: ${video.title}`);
            continue;
        }
        const processed = await isVideoProcessed(video.videoId);
        if (!processed) {
            unprocessedVideos.push(video);
            continue;
        }
        // 자막은 있으나 요약이 없는 경우는 다시 요약하도록 처리
        const cacheDir = path.join(process.cwd(), 'data', 'cache');
        const subtitleFile = path.join(cacheDir, `${video.videoId}.subtitle.txt`);
        const summaryFile = path.join(cacheDir, `${video.videoId}.summary.txt`);
        const hasSubtitle = await fileExists(subtitleFile);
        const hasSummary = await fileExists(summaryFile);
        if (hasSubtitle && !hasSummary) {
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
    let rateLimitError: RateLimitError | null = null;
    let serviceUnavailableError: ServiceUnavailableError | null = null;

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
            if (error instanceof RateLimitError) {
                rateLimitError = error;
                break;
            }
            if (error instanceof ServiceUnavailableError) {
                serviceUnavailableError = error;
                break;
            }
            // Continue with next video
        }
    }

    if (rateLimitError) {
        console.error('\n⛔ Gemini API 429 Too Many Requests로 인해 이후 작업을 중단합니다.');
        if (rateLimitError.errorDetails) {
            try {
                const detailsJson = JSON.stringify(rateLimitError.errorDetails, null, 2);
                console.error('   429 응답 error.details 원문:');
                console.error(detailsJson);
            } catch {
                console.error('   429 응답 error.details 원문: (출력 실패)');
            }
        } else {
            console.error('   429 응답 error.details 원문: (없음)');
        }
        if (rateLimitError.responseHeaders && Object.keys(rateLimitError.responseHeaders).length > 0) {
            console.error('   429 응답 헤더:');
            const headerEntries = Object.entries(rateLimitError.responseHeaders).sort(([a], [b]) => a.localeCompare(b));
            for (const [key, value] of headerEntries) {
                console.error(`     ${key}: ${value}`);
            }
        } else {
            console.error('   429 응답 헤더: (비어있음)');
        }
        if (rateLimitError.retryAfterHeader || rateLimitError.retryAfterSeconds !== null) {
            const retryAfterHeader = rateLimitError.retryAfterHeader ?? '없음';
            const retryAfterSeconds = rateLimitError.retryAfterSeconds;
            const retryAfterHours = retryAfterSeconds !== null
                ? (retryAfterSeconds / 3600).toFixed(2)
                : null;
            const retryAfterMessage = retryAfterSeconds !== null
                ? `${retryAfterSeconds}초 (~${retryAfterHours}시간)`
                : '알 수 없음';
            console.error(`   retry-after 헤더: ${retryAfterHeader}`);
            console.error(`   재시도까지: ${retryAfterMessage}`);
        } else {
            console.error('   retry-after 헤더 없음 (재시도 시간 알 수 없음)');
        }
        await writeSiteFromRecords(summaryRecords, outputDir);
        return;
    }
    if (serviceUnavailableError) {
        console.error('\n⛔ Gemini API 503 Service Unavailable로 인해 이후 작업을 중단합니다.');
        await writeSiteFromRecords(summaryRecords, outputDir);
        return;
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
        await writeSiteFromRecords(summaryRecords, outputDir);
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
