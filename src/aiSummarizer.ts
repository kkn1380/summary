import { GoogleGenerativeAI } from '@google/generative-ai';

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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = language === 'ko'
        ? `다음은 YouTube 동영상의 자막입니다. 이 내용을 한국어로 간결하게 요약해주세요. 주요 내용과 핵심 포인트를 3-5문장으로 정리해주세요:\n\n${subtitleText}`
        : `This is a YouTube video transcript. Please summarize the main content and key points in 3-5 sentences:\n\n${subtitleText}`;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text();
    } catch (error) {
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
    const systemPrompt = language === 'ko'
        ? '당신은 YouTube 동영상 내용을 요약하는 AI 어시스턴트입니다. 주요 내용과 핵심 포인트를 3-5문장으로 간결하게 요약해주세요.'
        : 'You are an AI assistant that summarizes YouTube video content. Provide a concise summary of the main content and key points in 3-5 sentences.';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: subtitleText },
            ],
            temperature: 0.7,
            max_tokens: 500,
        }),
    });

    if (!response.ok) {
        throw new Error('OpenAI API 요청에 실패했습니다');
    }

    const data: any = await response.json();
    return data.choices[0].message.content;
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
