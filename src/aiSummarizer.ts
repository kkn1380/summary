import {GoogleGenerativeAI} from '@google/generative-ai';
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
let geminiKeyOverride: string | null = null;

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

export class ServiceUnavailableError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ServiceUnavailableError';
    this.status = status;
  }
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  const model = genAI.getGenerativeModel({model: 'models/gemini-2.5-flash'})
  //

  const prompt = language === 'ko'
    ? `역할: 당신은 엄격한 기준을 가진 '금융/투자 전문 에디터'입니다.
      제공된 텍스트는 YouTube 영상의 자동 생성 자막입니다.
      아래 단계에 따라 분석을 수행하되, **출력 형식은 반드시 지시된 포맷만 남기세요.**

      [0. 주제 필터링 (내부 처리)]
      - 텍스트가 **'주식 투자', '경제 시황', '기업 분석', '재테크'**와 직접적으로 관련된 내용인지 판단하세요.
      - 단순히 정치인들의 가십, 연예, 유머, 일상 잡담, 혹은 경제와 무관한 정치 공방이라면 **요약하지 마세요.**
      - **투자/경제 관련 내용이 아니라고 판단되면, 아무런 설명 없이 오직 "NO_RESPONSE" 라고만 출력하고 종료하세요.**

      [1. 오타/수치 보정 및 잡담 제거 (내부 처리)]
      - 음성 인식 오류(오타)를 문맥에 맞게 보정하고, 특히 숫자(주가, 금리 등) 단위를 정확히 맞추세요. (보정 목록은 출력하지 마세요.)
      - 영상 중간에 포함된 **상품 광고(PPL, 의류/전자기기 판매 등), 진행자의 사적인 농담, 의미 없는 추임새는 요약에서 완전히 배제**하세요.

      [2. 요약문 작성 (출력 대상)]
      - 섹션 헤더(예: [2. 핵심 요약])를 붙이지 말고, 바로 본론부터 작성하세요.
      - 문체는 정중하고 신뢰감 있는 **"~습니다/합니다" 체**를 사용하세요. (예: "분석해요" (X) -> "분석합니다" (O))
      - 내용은 줄글(Paragraph)과 개조식(Bullet points)을 적절히 섞어 가독성 있게 구성하세요.

      [3. 투자 인사이트 (출력 대상)]
      - 요약문 작성이 끝나면 하단에 구분선(---)을 넣고 **[투자 조언]** 섹션을 추가하세요.
      - 이 영상의 내용을 바탕으로 투자자가 취해야 할 행동이나 마인드셋을 한 줄로 명확히 조언하세요.

      ---
      [자막 데이터]
      ${subtitleText}`
    : `This is a YouTube video transcript. Please summarize the main content and key points in 3-5 sentences:\n\n${subtitleText}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      ensureRetryAfterCapture();
      lastRetryAfterHeader = null;
      lastResponseHeaders = null;
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      const fetchError = error as FetchErrorLike;
      if (fetchError?.status === 503) {
        if (attempt === 0) {
          console.warn('Gemini API 503 발생: 5초 후 재시도합니다.');
          await sleep(5000);
          continue;
        }
        throw new ServiceUnavailableError('Gemini API 503 Service Unavailable (재시도 실패)', fetchError.status);
      }
      if (fetchError?.status === 429) {
        const fallbackKey = process.env.GEMINI_API_KEY2;
        if (fallbackKey && fallbackKey !== apiKey && geminiKeyOverride !== fallbackKey) {
          geminiKeyOverride = fallbackKey;
          console.warn('Gemini API 429 발생: GEMINI_API_KEY2로 전환하여 재시도합니다.');
          return summarizeWithGemini(subtitleText, fallbackKey, language);
        }
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
  throw new Error('Gemini API를 통한 요약 생성에 실패했습니다');
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
        {role: 'system', content: systemPrompt},
        {role: 'user', content: subtitleText},
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
    const apiKey = geminiKeyOverride || process.env.GEMINI_API_KEY;
    if (geminiKeyOverride) {
      console.warn('Gemini API 요청: GEMINI_API_KEY2 사용 중');
    }
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
