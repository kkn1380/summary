import { extractSubtitles } from './subtitleExtractor.js';

async function test() {
    console.log('Starting test...');
    try {
        const videoId = 'jNQXAC9IVRw'; // "Me at the zoo" - first YouTube video
        console.log(`Testing with video ID: ${videoId}`);

        const subtitles = await extractSubtitles(videoId, { lang: 'en' });
        console.log(`Success! Found ${subtitles.length} subtitle segments`);
        console.log('First subtitle:', subtitles[0]);
    } catch (error) {
        console.error('Error:', error);
    }
}

test();
