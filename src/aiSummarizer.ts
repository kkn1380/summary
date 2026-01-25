import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

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
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash' })

    const prompt = language === 'ko'
        ? `다음은 YouTube 동영상의 자막입니다. 주식 관련한 내용이라면 주요 내용과 핵심 포인트를 읽었을 때 5분 내외 길이로 정리해주세요. 자막에 오타가 있을 수 있을 수 있는데 오타는 보정해줘. 마지막 한줄 요약으로 니가 생각할 때 투자 관점으로 나에게 조언해줘.\n\n${subtitleText}`
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
