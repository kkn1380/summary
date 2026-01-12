import { extractSubtitles, formatSubtitles, formatSubtitlesPlain } from './subtitleExtractor.js';

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('사용법:');
        console.log('  npm start -- <YouTube URL 또는 비디오 ID> [언어코드]');
        console.log('');
        console.log('예제:');
        console.log('  npm start -- https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        console.log('  npm start -- dQw4w9WgXcQ ko');
        console.log('  npm start -- https://youtu.be/dQw4w9WgXcQ en');
        console.log('');
        console.log('옵션:');
        console.log('  --plain    타임스탬프 없이 순수 텍스트만 출력');
        process.exit(1);
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
