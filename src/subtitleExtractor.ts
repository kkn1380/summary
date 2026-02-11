import { YoutubeTranscript } from 'youtube-transcript';
import { getSubtitles, getVideoDetails, VideoDetails } from 'youtube-caption-extractor';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

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
    // 시도 언어는 지정 언어만 사용
    const candidateLangs = [baseLang];

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
            const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
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

    // Fallback: yt-dlp (로컬 바이너리 및 쿠키 사용 가능)
    for (const lang of candidateLangs) {
        try {
            const subtitles = await getSubtitlesWithYtDlp(videoId, lang);
            if (subtitles.length > 0) {
                if (!videoDetails) {
                    videoDetails = await getVideoDetails({ videoID: videoId, lang });
                }
                return {
                    details: videoDetails!,
                    subtitle: subtitles,
                };
            }
            tried.push(`ytdlp:${lang}(empty)`);
        } catch (error) {
            lastError = error;
            tried.push(`ytdlp:${lang}(error:${error instanceof Error ? error.message : String(error)})`);
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

async function getSubtitlesWithYtDlp(videoId: string, lang: string): Promise<SubtitleSegment[]> {
    const ytdlp = process.env.YTDLP_PATH || 'yt-dlp';
    const cookiesPath = process.env.YTDLP_COOKIES;
    const cookiesFromBrowser = process.env.YTDLP_COOKIES_FROM_BROWSER;
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-sub-'));
    const outputTemplate = path.join(tmpDir, '%(id)s.%(ext)s');
    const args = [
        '--skip-download',
        '--write-sub',
        '--write-auto-sub',
        '--sub-lang',
        lang,
        '--sub-format',
        'vtt',
        '-o',
        outputTemplate,
        `https://www.youtube.com/watch?v=${videoId}`,
    ];
    if (cookiesPath) {
        args.unshift(cookiesPath);
        args.unshift('--cookies');
    } else if (cookiesFromBrowser) {
        args.unshift(cookiesFromBrowser);
        args.unshift('--cookies-from-browser');
    }
    // 쿠키 없이도 시도

    try {
        await execFileAsync(ytdlp, args);
        const files = await fs.readdir(tmpDir);
        const vttFiles = files.filter(name => name.endsWith('.vtt'));
        if (vttFiles.length === 0) {
            return [];
        }
        const manualFile = vttFiles.find(name => name.endsWith(`.${lang}.vtt`) && !name.includes(`.a.${lang}.`));
        const autoFile = vttFiles.find(name => name.endsWith(`.a.${lang}.vtt`));
        const vttFile = manualFile || autoFile || vttFiles[0];
        if (!vttFile) {
            return [];
        }
        const content = await fs.readFile(path.join(tmpDir, vttFile), 'utf-8');
        return normalizeSegments(parseVttToSegments(content));
    } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
    }
}

function parseVttToSegments(vtt: string): SubtitleSegment[] {
    const lines = vtt.split(/\r?\n/);
    const segments: SubtitleSegment[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();
        if (!line || line.startsWith('WEBVTT')) {
            i += 1;
            continue;
        }
        if (line.includes('-->')) {
            const [startRaw, endRaw] = line.split('-->').map(part => part.trim());
            const start = toSeconds(startRaw);
            const end = toSeconds(endRaw);
            i += 1;
            const textLines: string[] = [];
            while (i < lines.length && lines[i].trim() !== '') {
                const cleaned = lines[i].replace(/<[^>]+>/g, '').trim();
                if (cleaned) {
                    textLines.push(cleaned);
                }
                i += 1;
            }
            const text = textLines.join(' ').trim();
            if (text) {
                segments.push({
                    text,
                    start: String(start),
                    dur: String(Math.max(0, end - start)),
                });
            }
        }
        i += 1;
    }
    return segments;
}

function toSeconds(value: string): number {
    const clean = value.split(' ')[0].trim();
    const parts = clean.split(':').map(Number);
    if (parts.some(Number.isNaN)) {
        return 0;
    }
    let seconds = 0;
    if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
        seconds = parts[0];
    }
    return Number.isFinite(seconds) ? seconds : 0;
}

function normalizeText(text: string) {
    return text.replace(/\s+/g, ' ').trim();
}

function comparableText(text: string) {
    return normalizeText(text).replace(/[^a-zA-Z0-9가-힣]+/g, '').toLowerCase();
}

function normalizeSegments(segments: SubtitleSegment[]): SubtitleSegment[] {
    const normalized: SubtitleSegment[] = [];
    for (const seg of segments) {
        const text = normalizeText(seg.text);
        if (!text) continue;
        const start = Number(seg.start);
        const dur = Number(seg.dur);
        const end = start + (Number.isFinite(dur) ? dur : 0);
        const currentComparable = comparableText(text);
        const prev = normalized[normalized.length - 1];
        if (prev) {
            const prevText = normalizeText(prev.text);
            const prevComparable = comparableText(prevText);
            const prevStart = Number(prev.start);
            const prevDur = Number(prev.dur);
            const prevEnd = prevStart + (Number.isFinite(prevDur) ? prevDur : 0);
            const gap = start - prevEnd;

            if (currentComparable && currentComparable === prevComparable && gap <= 2) {
                continue;
            }
            if (currentComparable && prevComparable && prevComparable.includes(currentComparable) && gap <= 2) {
                continue;
            }
            if (currentComparable && prevComparable && currentComparable.includes(prevComparable) && gap <= 2) {
                normalized[normalized.length - 1] = {
                    text,
                    start: prev.start,
                    dur: String(Math.max(0, end - prevStart)),
                };
                continue;
            }
        }
        normalized.push({
            text,
            start: seg.start,
            dur: seg.dur,
        });
    }
    return normalized;
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
