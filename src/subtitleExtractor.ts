import { getSubtitles } from 'youtube-caption-extractor';

export interface SubtitleSegment {
    text: string;
    start: string;
    dur: string;
}

export interface ExtractOptions {
    lang?: string;
}

/**
 * YouTube URL에서 비디오 ID를 추출합니다
 */
export function extractVideoId(urlOrId: string): string {
    // 이미 비디오 ID인 경우
    if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
        return urlOrId;
    }

    // YouTube URL 패턴들
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
        const match = urlOrId.match(pattern);
        if (match) {
            return match[1];
        }
    }

    throw new Error(`유효하지 않은 YouTube URL 또는 비디오 ID입니다: ${urlOrId}`);
}

/**
 * YouTube 비디오의 자막을 추출합니다
 */
export async function extractSubtitles(
    urlOrId: string,
    options: ExtractOptions = {}
): Promise<SubtitleSegment[]> {
    const videoId = extractVideoId(urlOrId);
    const lang = options.lang || 'ko'; // 기본값: 한국어

    try {
        const subtitles = await getSubtitles({ videoID: videoId, lang });
        return subtitles;
    } catch (error) {
        // 한국어 자막이 없으면 영어로 시도
        if (lang === 'ko') {
            console.warn('한국어 자막을 찾을 수 없습니다. 영어 자막을 시도합니다...');
            try {
                const subtitles = await getSubtitles({ videoID: videoId, lang: 'en' });
                return subtitles;
            } catch (enError) {
                throw new Error(`자막을 찾을 수 없습니다. 비디오 ID: ${videoId}`);
            }
        }
        throw error;
    }
}

/**
 * 자막을 읽기 쉬운 텍스트 형식으로 변환합니다
 */
export function formatSubtitles(subtitles: SubtitleSegment[]): string {
    return subtitles
        .map((segment, index) => {
            const startTime = formatTime(parseFloat(segment.start));
            return `[${index + 1}] ${startTime}\n${segment.text}\n`;
        })
        .join('\n');
}

/**
 * 자막을 순수 텍스트로만 변환합니다 (타임스탬프 제외)
 */
export function formatSubtitlesPlain(subtitles: SubtitleSegment[]): string {
    return subtitles.map(segment => segment.text).join(' ');
}

/**
 * 초를 시:분:초 형식으로 변환합니다
 */
function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return [hours, minutes, secs]
        .map(val => String(val).padStart(2, '0'))
        .join(':');
}
