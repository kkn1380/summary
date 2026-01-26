import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

type FetchErrorLike = {
    status?: number;
    statusText?: string;
    errorDetails?: unknown;
};

type RetryInfoDetail = {
    retryDelay?: unknown;
};

const GEMINI_HOST = 'generativelanguage.googleapis.com';
let lastRetryAfterHeader: string | null = null;
let lastResponseHeaders: Record<string, string> | null = null;
let fetchWrapped = false;

export class RateLimitError extends Error {
    status: number;
    retryAfterHeader: string | null;
    retryAfterSeconds: number | null;
    responseHeaders: Record<string, string> | null;
    errorDetails: unknown;

    constructor(
        message: string,
        status: number,
        retryAfterHeader: string | null,
        retryAfterSeconds: number | null,
        responseHeaders: Record<string, string> | null,
        errorDetails: unknown
    ) {
        super(message);
        this.name = 'RateLimitError';
        this.status = status;
        this.retryAfterHeader = retryAfterHeader;
        this.retryAfterSeconds = retryAfterSeconds;
        this.responseHeaders = responseHeaders;
        this.errorDetails = errorDetails;
    }
}

export function isRateLimitError(error: unknown): error is RateLimitError {
    return error instanceof RateLimitError;
}

function ensureRetryAfterCapture(): void {
    if (fetchWrapped) {
        return;
    }
    const originalFetch = globalThis.fetch;
    if (!originalFetch) {
        return;
    }

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await originalFetch(input, init);
        try {
            const url = typeof input === 'string'
                ? input
                : input instanceof URL
                    ? input.toString()
                    : input.url;
            if (url.includes(GEMINI_HOST) && response.status === 429) {
                lastRetryAfterHeader = response.headers.get('retry-after');
                const headers: Record<string, string> = {};
                for (const [key, value] of response.headers.entries()) {
                    headers[key] = value;
                }
                lastResponseHeaders = headers;
            }
        } catch {
            // Ignore header parsing failures.
        }
        return response;
    };

    fetchWrapped = true;
}

function parseRetryAfterSeconds(headerValue: string | null): number | null {
    if (!headerValue) {
        return null;
    }
    const numericSeconds = Number(headerValue);
    if (!Number.isNaN(numericSeconds) && Number.isFinite(numericSeconds)) {
        return Math.max(0, Math.ceil(numericSeconds));
    }
    const date = new Date(headerValue);
    if (!Number.isNaN(date.getTime())) {
        const deltaMs = date.getTime() - Date.now();
        if (deltaMs <= 0) {
            return 0;
        }
        return Math.ceil(deltaMs / 1000);
    }
    return null;
}

function parseDurationSeconds(value: unknown): number | null {
    if (typeof value === 'string') {
        const match = value.match(/^(\d+(?:\.\d+)?)s$/);
        if (match) {
            return Math.max(0, Math.ceil(Number(match[1])));
        }
    }
    if (value && typeof value === 'object') {
        const secondsRaw = (value as { seconds?: number | string }).seconds;
        const nanosRaw = (value as { nanos?: number | string }).nanos;
        const seconds = secondsRaw !== undefined ? Number(secondsRaw) : 0;
        const nanos = nanosRaw !== undefined ? Number(nanosRaw) : 0;
        if (!Number.isNaN(seconds) || !Number.isNaN(nanos)) {
            return Math.max(0, Math.ceil(seconds + nanos / 1e9));
        }
    }
    return null;
}

function parseRetryAfterFromDetails(details: unknown): number | null {
    if (!Array.isArray(details)) {
        return null;
    }
    for (const detail of details) {
        if (!detail || typeof detail !== 'object') {
            continue;
        }
        const retryDelay = (detail as RetryInfoDetail).retryDelay;
        const seconds = parseDurationSeconds(retryDelay);
        if (seconds !== null) {
            return seconds;
        }
    }
    return null;
}

function formatRetryAfterMessage(retryAfterHeader: string | null, retryAfterSeconds: number | null): string {
    if (!retryAfterHeader && retryAfterSeconds === null) {
        return 'retry-after 헤더 없음 (재시도 시간 알 수 없음)';
    }
    const parts: string[] = [];
    if (retryAfterHeader) {
        parts.push(`retry-after: ${retryAfterHeader}`);
    }
    if (retryAfterSeconds !== null) {
        const hours = (retryAfterSeconds / 3600).toFixed(2);
        parts.push(`재시도까지 ${retryAfterSeconds}초 (~${hours}시간)`);
    }
    return parts.join(', ');
}

export interface SummaryOptions {
    provider?: 'gemini' | 'openai';
    language?: string;
}

/**
 * Gemini API를 사용하여 자막 요약을 생성합니다
 */
async function summarizeWithGemini(
    subtitleText: string,
    apiKey: string,
    language: string = 'ko'
): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    // const model = genAI.getGenerativeModel({ model: 'models/gemma-3-1b-it' });
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash' })
    //

    const prompt = language === 'ko'
        ? `다음은 YouTube 동영상의 자막입니다. 주식 관련한 내용이라면 주요 내용과 핵심 포인트를 읽었을 때 5분 내외 길이로 정리해주세요. 자막에 오타가 있을 수 있을 수 있는데 오타는 보정해줘. 마지막 한줄 요약으로 니가 생각할 때 투자 관점으로 나에게 조언해줘.\n\n${subtitleText}`
        : `This is a YouTube video transcript. Please summarize the main content and key points in 3-5 sentences:\n\n${subtitleText}`;

    try {
        ensureRetryAfterCapture();
        lastRetryAfterHeader = null;
        lastResponseHeaders = null;
        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text();
    } catch (error) {
        const fetchError = error as FetchErrorLike;
        if (fetchError?.status === 429) {
            const retryAfterHeader = lastRetryAfterHeader;
            const retryAfterSeconds = parseRetryAfterSeconds(retryAfterHeader)
                ?? parseRetryAfterFromDetails(fetchError.errorDetails);
            const message = `Gemini API 429 Too Many Requests: ${formatRetryAfterMessage(retryAfterHeader, retryAfterSeconds)}`;
            throw new RateLimitError(
                message,
                fetchError.status,
                retryAfterHeader,
                retryAfterSeconds,
                lastResponseHeaders,
                fetchError.errorDetails
            );
        }
        console.error('Gemini API error:', error);
        throw new Error('Gemini API를 통한 요약 생성에 실패했습니다');
    }
}

/**
 * OpenAI API를 사용하여 자막 요약을 생성합니다 (선택사항)
 */
async function summarizeWithOpenAI(
    subtitleText: string,
    apiKey: string,
    language: string = 'ko'
): Promise<string> {
    const openai = new OpenAI({
        apiKey: apiKey,
    });

    const systemPrompt = language === 'ko'
        ? '당신은 YouTube 동영상 내용을 요약하는 AI 어시스턴트입니다. 주요 내용과 핵심 포인트를 3-5문장으로 간결하게 요약해주세요. 내 말에 대한 답변은 필요 없으니 본문으로 바로 답해주세요'
        : 'You are an AI assistant that summarizes YouTube video content. Provide a concise summary of the main content and key points in 3-5 sentences.';

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: subtitleText },
            ],
            temperature: 0.7,
            max_tokens: 500,
        });

        return completion.choices[0].message.content || '';
    } catch (error) {
        console.error('OpenAI API error:', error);
        throw new Error('OpenAI API를 통한 요약 생성에 실패했습니다');
    }
}

/**
 * 자막 텍스트를 AI로 요약합니다
 */
export async function summarizeSubtitles(
    subtitleText: string,
    options: SummaryOptions = {}
): Promise<string> {
    const provider = options.provider || process.env.AI_PROVIDER || 'gemini';
    const language = options.language || process.env.SUBTITLE_LANGUAGE || 'ko';

    if (provider === 'gemini') {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY 환경 변수가 설정되지 않았습니다');
        }
        return summarizeWithGemini(subtitleText, apiKey, language);
    } else if (provider === 'openai') {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다');
        }
        return summarizeWithOpenAI(subtitleText, apiKey, language);
    } else {
        throw new Error(`지원하지 않는 AI 제공자입니다: ${provider}`);
    }
}
