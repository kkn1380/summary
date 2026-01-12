import dotenv from 'dotenv';
import { getMultipleChannelsVideos, VideoInfo } from './channelMonitor.js';
import { extractSubtitles, formatSubtitlesPlain } from './subtitleExtractor.js';
import { summarizeSubtitles } from './aiSummarizer.js';
import { appendToSheet } from './sheetsManager.js';
import { isVideoProcessed, markVideoAsProcessed } from './stateManager.js';

// Load environment variables
dotenv.config();

/**
 * 단일 동영상을 처리합니다
 */
async function processVideo(video: VideoInfo): Promise<void> {
    console.log(`\n📹 처리 중: ${video.title}`);
    console.log(`   채널: ${video.channelName}`);
    console.log(`   게시일: ${video.publishedAt.toLocaleDateString('ko-KR')}`);

    try {
        // 1. 자막 추출
        console.log('   🔍 자막 추출 중...');
        console.log(`   🔤 시도 언어: ${process.env.SUBTITLE_LANGUAGE || 'ko'} (자동자막 포함 en/a.en fallback)`);
        const lang = process.env.SUBTITLE_LANGUAGE || 'ko';
        const contentInfo = await extractSubtitles(video.videoId, { lang });
        const subtitles = contentInfo.subtitle;

        if (subtitles.length === 0) {
            throw new Error('자막을 찾을 수 없습니다');
        }

        const subtitleText = formatSubtitlesPlain(subtitles);
        console.log(`   ✅ 자막 추출 완료: ${subtitles.length}개 세그먼트`);

        // 2. AI 요약 생성
        console.log('   🤖 AI 요약 생성 중...');
        const summary = await summarizeSubtitles(subtitleText);
        console.log(`   ✅ 요약 완료`);

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
async function monitor(): Promise<void> {
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

    for (const video of unprocessedVideos) {
        try {
            await processVideo(video);
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

main();
