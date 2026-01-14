import dotenv from 'dotenv';
import { extractSubtitles, formatSubtitlesPlain } from './subtitleExtractor.js';
import { summarizeSubtitles } from './aiSummarizer.js';
import { appendToSheet } from './sheetsManager.js';
import { VideoDetails } from 'youtube-caption-extractor';

dotenv.config();

type Mode = 'fetch' | 'summarize' | 'sheet';

interface Args {
    urlOrId: string;
    lang?: string;
    mode: Mode;
}

function parseArgs(): Args {
    const args = process.argv.slice(2).filter(Boolean);
    if (args.length === 0) {
        console.log('사용법:');
        console.log('  npm run fetch -- <YouTube URL/ID> [lang]');
        console.log('  npm run summarize -- <YouTube URL/ID> [lang]');
        console.log('  npm run sheet -- <YouTube URL/ID> [lang]');
        console.log('');
        console.log('예시:');
        console.log('  npm run fetch -- https://youtu.be/dQw4w9WgXcQ');
        console.log('  npm run summarize -- dQw4w9WgXcQ ko');
        console.log('  npm run sheet -- https://www.youtube.com/watch?v=dQw4w9WgXcQ en');
        process.exit(1);
    }

    let mode: Mode = 'fetch';
    if (args[0] === '--fetch') {
        mode = 'fetch';
        args.shift();
    } else if (args[0] === '--summarize') {
        mode = 'summarize';
        args.shift();
    } else if (args[0] === '--sheet') {
        mode = 'sheet';
        args.shift();
    }

    const urlOrId = args[0];
    const lang = args[1];

    if (!urlOrId) {
        throw new Error('YouTube URL 또는 비디오 ID를 입력하세요');
    }

    return { urlOrId, lang, mode };
}

async function run() {
    const { urlOrId, lang, mode } = parseArgs();
    const subtitleLang = lang || process.env.SUBTITLE_LANGUAGE || 'ko';

    console.log(`🎬 대상: ${urlOrId}`);
    console.log(`🔤 언어 우선순위: ${subtitleLang} -> a.${subtitleLang} -> en -> a.en`);
    console.log(`🚦 모드: ${mode}`);

    // 1) 자막 추출
    const content = await extractSubtitles(urlOrId, { lang: subtitleLang });
    const subtitles = content.subtitle;
    if (!subtitles || subtitles.length === 0) {
        throw new Error('자막을 찾을 수 없습니다');
    }
    console.log(`✅ 자막 추출 완료: ${subtitles.length}개`);

    // fetch-only인 경우 여기서 종료
    if (mode === 'fetch') {
        console.log('\n--- 자막(plain) ---');
        console.log(formatSubtitlesPlain(subtitles));
        return;
    }

    // 2) 요약
    const subtitleText = formatSubtitlesPlain(subtitles);
    console.log('🤖 요약 요청 중...');
    const summary = await summarizeSubtitles(subtitleText);
    console.log('\n--- 요약 ---');
    console.log(summary);

    // summarize-only면 여기서 종료
    if (mode === 'summarize') {
        return;
    }

    // 3) 시트 기록
    const details: VideoDetails = content.details;
    const d: any = details as any; // 안전한 접근을 위해 any 병행
    const title = (d.title as string) || urlOrId;
    const channelName =
        (d.author && (d.author.name || d.author)) ||
        (d.uploader && (d.uploader.name || d.uploader)) ||
        'unknown';
    const publishedAt =
        d.published ||
        (d.upload_date ? new Date(d.upload_date).toISOString() : new Date().toISOString());
    const url = `https://www.youtube.com/watch?v=${d.videoId || d.videoID || urlOrId}`;

    console.log('📊 시트 기록 중...');
    await appendToSheet({
        title,
        channelName: typeof channelName === 'string' ? channelName : 'unknown',
        publishedAt,
        url,
        summary,
        processedAt: new Date().toISOString(),
    });
    console.log('✅ 시트 기록 완료');
}

run().catch(err => {
    console.error('❌ 오류:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) {
        console.error(err.stack);
    }
    process.exit(1);
});

