import { getTranscript } from '@distube/youtube-transcript';
import { getSubtitles, getVideoDetails, VideoDetails } from 'youtube-caption-extractor';

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

export interface ContentInfo {
    details: VideoDetails,
    subtitle: SubtitleSegment[],
}
/**
 * YouTube 비디오의 자막을 추출합니다
 */
export async function extractSubtitles(
    urlOrId: string,
    options: ExtractOptions = {}
): Promise<ContentInfo> {
    const videoId = extractVideoId(urlOrId);
    const baseLang = options.lang || 'ko'; // 기본값: 한국어
    const baseRoot = baseLang.split('-')[0]; // ko-KR 같은 경우 루트만 추출
    const krVariants = baseRoot === 'ko' ? ['ko', 'ko-KR'] : [];

    // 언어 시도 순서: 지정 언어/변형 -> 자동자막(a.) 변형 -> 국가 코드 변형 -> en -> 자동 en
    const candidateLangs = Array.from(
        new Set([
            baseLang,
            baseLang.startsWith('a.') ? baseLang : `a.${baseLang}`,
            ...krVariants,
            ...krVariants.map(l => `a.${l}`),
            'en',
            'a.en',
        ])
    ).filter(Boolean) as string[];

    const tried: string[] = [];
    let lastError: unknown = null;
    let videoDetails: VideoDetails | undefined;

    for (const lang of candidateLangs) {
        try {
            const details = await getVideoDetails({ videoID: videoId, lang });
            const subtitles = await getSubtitles({ videoID: videoId, lang });

            // 비어 있는 자막은 실패로 간주
            if (!subtitles || subtitles.length === 0) {
                tried.push(`${lang}(empty)`);
                if (!videoDetails) videoDetails = details;
                continue;
            }

            return {
                details: details || videoDetails!,
                subtitle: subtitles,
            };
        } catch (error) {
            lastError = error;
            tried.push(`${lang}(error:${error instanceof Error ? error.message : String(error)})`);
            continue;
        }
    }

    // Fallback: youtube-transcript (비공식 API를 사용해 더 관대한 자막 추출)
    for (const lang of candidateLangs) {
        try {
            const transcript = await getTranscript(videoId, { lang });
            if (transcript && transcript.length > 0) {
                if (!videoDetails) {
                    videoDetails = await getVideoDetails({ videoID: videoId, lang });
                }
                return {
                    details: videoDetails!,
                    subtitle: transcript.map(item => ({
                        text: item.text,
                        start: String(item.offset / 1000),
                        dur: String(item.duration / 1000),
                    })),
                };
            } else {
                tried.push(`fallback:${lang}(empty)`);
            }
        } catch (error) {
            lastError = error;
            tried.push(`fallback:${lang}(error:${error instanceof Error ? error.message : String(error)})`);
            continue;
        }
    }

    const reason = tried.length > 0 ? tried.join(', ') : 'no attempts';
    const lastErrMsg =
        lastError instanceof Error
            ? `${lastError.name}: ${lastError.message}`
            : String(lastError);
    throw new Error(
        `자막을 찾을 수 없습니다. 비디오 ID: ${videoId}, 시도: ${reason}, 마지막 오류: ${lastErrMsg}`
    );
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
