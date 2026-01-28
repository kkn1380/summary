import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { summarizeSubtitles } from './aiSummarizer.js';
import { extractSubtitles, formatSubtitles, formatSubtitlesPlain } from './subtitleExtractor.js';

async function main() {
    dotenv.config();
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('사용법:');
        console.log('  npm start -- <YouTube URL 또는 비디오 ID> [언어코드]');
        console.log('  npm start -- --summarize-file <자막파일경로> [--out <출력경로>]');
        console.log('');
        console.log('예제:');
        console.log('  npm start -- https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        console.log('  npm start -- dQw4w9WgXcQ ko');
        console.log('  npm start -- https://youtu.be/dQw4w9WgXcQ en');
        console.log('  npm start -- --summarize-file data/cache/sX7pMB-uVjs.subtitle.txt');
        console.log('  npm start -- --summarize-file data/cache/sX7pMB-uVjs.subtitle.txt --out data/cache/sX7pMB-uVjs.summary.txt');
        console.log('');
        console.log('옵션:');
        console.log('  --plain    타임스탬프 없이 순수 텍스트만 출력');
        console.log('  --summarize-file  자막 파일을 요약해 파일로 저장');
        console.log('  --out      요약 출력 파일 경로 (미지정 시 .summary.txt 자동 생성)');
        process.exit(1);
    }

    const summarizeFileIndex = args.indexOf('--summarize-file');
    if (summarizeFileIndex !== -1) {
        const inputPath = args[summarizeFileIndex + 1];
        if (!inputPath) {
            console.error('❌ --summarize-file 옵션에는 파일 경로가 필요합니다.');
            process.exit(1);
        }
        const outIndex = args.indexOf('--out');
        const outPathArg = outIndex !== -1 ? args[outIndex + 1] : undefined;
        const outputPath = outPathArg
            ? outPathArg
            : path.join(
                path.dirname(inputPath),
                `${path.basename(inputPath, path.extname(inputPath))}.summary.txt`
              );
        try {
            const text = await fs.readFile(inputPath, 'utf-8');
            const summary = await summarizeSubtitles(text);
            await fs.writeFile(outputPath, summary, 'utf-8');
            console.log(`✅ 요약 저장 완료: ${outputPath}`);
            process.exit(0);
        } catch (error) {
            console.error('❌ 요약 오류:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    }

    const urlOrId = args[0];
    const plainMode = args.includes('--plain');
    const lang = args.find((arg: string) => arg.length === 2 && arg !== '--' && !arg.startsWith('-'));

    try {
        console.log('자막 추출 중...\n');

        const content = await extractSubtitles(urlOrId, { lang });
        const subtitles = content.subtitle;

        console.log(`✅ 자막 추출 완료! (총 ${subtitles.length}개 세그먼트)\n`);
        console.log('━'.repeat(60));

        if (plainMode) {
            console.log(formatSubtitlesPlain(subtitles));
        } else {
            console.log(formatSubtitles(subtitles));
        }

        console.log('━'.repeat(60));
        process.exit(0);
    } catch (error) {
        console.error('❌ 오류 발생:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

main();
