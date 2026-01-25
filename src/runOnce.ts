import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { extractSubtitles, extractVideoId, formatSubtitlesPlain } from './subtitleExtractor.js';
import { summarizeSubtitles } from './aiSummarizer.js';
import { appendToSheet } from './sheetsManager.js';
import { VideoDetails } from 'youtube-caption-extractor';

dotenv.config();

type Mode = 'fetch' | 'summarize' | 'sheet';

interface Args {
    urlOrId: string;
    lang?: string;
    mode: Mode;
    fresh: boolean;
}

function parseArgs(): Args {
    const args = process.argv.slice(2).filter(Boolean);
    if (args.length === 0) {
        console.log('사용법:');
        console.log('  npm run fetchScript -- <YouTube URL/ID> [lang] [--fresh]');
        console.log('  npm run fetchAndSummarize -- <YouTube URL/ID> [lang] [--fresh]');
        console.log('  npm run fetchSummarizeSheet -- <YouTube URL/ID> [lang] [--fresh]');
        console.log('');
        console.log('예시:');
        console.log('  npm run fetchScript -- https://youtu.be/dQw4w9WgXcQ');
        console.log('  npm run fetchAndSummarize -- dQw4w9WgXcQ ko');
        console.log('  npm run fetchSummarizeSheet -- https://www.youtube.com/watch?v=dQw4w9WgXcQ en --fresh');
        process.exit(1);
    }

    let mode: Mode = 'fetch';
    let fresh = false;

    // fresh/force 플래그 사전 처리
    for (let i = args.length - 1; i >= 0; i--) {
        if (args[i] === '--fresh' || args[i] === '--force') {
            fresh = true;
            args.splice(i, 1);
        }
    }

    if (args[0] === '--fetch' || args[0] === '--fetchScript') {
        mode = 'fetch';
        args.shift();
    } else if (args[0] === '--summarize' || args[0] === '--fetchAndSummarize') {
        mode = 'summarize';
        args.shift();
    } else if (args[0] === '--sheet' || args[0] === '--fetchSummarizeSheet') {
        mode = 'sheet';
        args.shift();
    }

    const urlOrId = args[0];
    const lang = args[1];

    if (!urlOrId) {
        throw new Error('YouTube URL 또는 비디오 ID를 입력하세요');
    }

    return { urlOrId, lang, mode, fresh };
}

async function ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function run() {
    const { urlOrId, lang, mode, fresh } = parseArgs();
    const subtitleLang = lang || process.env.SUBTITLE_LANGUAGE || 'ko';
    const videoId = extractVideoId(urlOrId);
    const cacheDir = path.join(process.cwd(), 'data', 'cache');
    const subtitleFile = path.join(cacheDir, `${videoId}.subtitle.txt`);
    const summaryFile = path.join(cacheDir, `${videoId}.summary.txt`);
    const metaFile = path.join(cacheDir, `${videoId}.meta.json`);

    console.log(`🎬 대상: ${urlOrId}`);
    console.log(`🔤 언어 우선순위: ${subtitleLang} -> a.${subtitleLang} -> en -> a.en`);
    console.log(`🚦 모드: ${mode}`);
    if (fresh) {
        console.log('♻️  fresh 모드: 모든 단계를 처음부터 다시 수행합니다.');
    }

    await ensureDir(cacheDir);

    let subtitlesText: string | null = null;
    let content: { subtitle: any[]; details?: VideoDetails } | null = null;

    // 1) 자막 단계 (파일 있으면 재사용)
    const hasSubtitle = !fresh && (await fileExists(subtitleFile));
    if (hasSubtitle) {
        console.log(`🗂  자막 캐시 사용: ${subtitleFile}`);
        subtitlesText = await fs.readFile(subtitleFile, 'utf-8');
    } else {
        const fetched = await extractSubtitles(urlOrId, { lang: subtitleLang });
        content = fetched;
        const subtitles = fetched.subtitle;
        if (!subtitles || subtitles.length === 0) {
            throw new Error('자막을 찾을 수 없습니다');
        }
        subtitlesText = formatSubtitlesPlain(subtitles);
        await fs.writeFile(subtitleFile, subtitlesText, 'utf-8');
        // 메타 저장
        const d: any = fetched.details as any;
        const meta = {
            title: d?.title || urlOrId,
            channelName:
                (d?.author && (d.author.name || d.author)) ||
                (d?.uploader && (d.uploader.name || d.uploader)) ||
                'unknown',
            publishedAt:
                d?.published ||
                (d?.upload_date
                    ? new Date(d.upload_date).toISOString()
                    : new Date().toISOString()),
            url: `https://www.youtube.com/watch?v=${d?.videoId || d?.videoID || videoId}`,
        };
        await fs.writeFile(metaFile, JSON.stringify(meta, null, 2), 'utf-8');
        console.log(`✅ 자막 추출 완료: ${subtitles.length}개 (저장됨)`);
    }

    // fetch-only면 자막 출력 후 종료
    if (mode === 'fetch') {
        console.log('\n--- 자막(plain) ---');
        console.log(metaFile);
        return;
    }

    // 2) 요약
    let summaryText: string | null = null;
    const hasSummary = !fresh && (await fileExists(summaryFile));
    if (hasSummary) {
        console.log(`🗂  요약 캐시 사용: ${summaryFile}`);
        summaryText = await fs.readFile(summaryFile, 'utf-8');
    } else {
        console.log('🤖 요약 요청 중...');
        summaryText = await summarizeSubtitles(subtitlesText || '');
        await fs.writeFile(summaryFile, summaryText, 'utf-8');
        console.log('✅ 요약 완료 (저장됨)');
    }

    console.log('\n--- 요약 ---');
    console.log(summaryFile);

    // summarize-only면 여기서 종료
    if (mode === 'summarize') {
        return;
    }

    // 3) 시트 기록
    let meta: {
        title: string;
        channelName: string;
        publishedAt: string;
        url: string;
    };

    if (!fresh && (await fileExists(metaFile))) {
        meta = JSON.parse(await fs.readFile(metaFile, 'utf-8'));
        console.log(`🗂  메타 캐시 사용: ${metaFile}`);
    } else {
        // 캐시가 없으면 간단히 생성 (상세 정보가 필요한 경우 추후 확장)
        meta = {
            title: urlOrId,
            channelName: 'unknown',
            publishedAt: new Date().toISOString(),
            url: `https://www.youtube.com/watch?v=${videoId}`,
        };
    }

    console.log('📊 시트 기록 중...');
    await appendToSheet({
        title: meta.title,
        channelName: meta.channelName,
        publishedAt: meta.publishedAt,
        url: meta.url,
        summary: summaryText || '',
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

