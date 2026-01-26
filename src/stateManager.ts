import fs from 'fs/promises';
import path from 'path';

export interface ProcessedVideo {
    videoId: string;
    processedAt: string;
    status: 'success' | 'failed';
    error?: string;
}

export interface StateData {
    videos: ProcessedVideo[];
}

const STATE_FILE = 'data/processed-videos.json';

/**
 * 상태 파일이 존재하는지 확인하고, 없으면 생성합니다
 */
async function ensureStateFile(): Promise<void> {
    try {
        await fs.access(STATE_FILE);
    } catch {
        // File doesn't exist, create it
        const dataDir = path.dirname(STATE_FILE);
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(STATE_FILE, JSON.stringify({ videos: [] }, null, 2));
    }
}

/**
 * 현재 상태를 읽어옵니다
 */
export async function loadState(): Promise<StateData> {
    await ensureStateFile();
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(data);
}

/**
 * 상태를 저장합니다
 */
export async function saveState(state: StateData): Promise<void> {
    await ensureStateFile();
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * 비디오가 이미 처리되었는지 확인합니다
 */
export async function isVideoProcessed(videoId: string): Promise<boolean> {
    const state = await loadState();
    return state.videos.some(v => v.videoId === videoId);
}

/**
 * 처리된 비디오를 기록합니다
 */
export async function markVideoAsProcessed(
    videoId: string,
    status: 'success' | 'failed',
    error?: string
): Promise<void> {
    const state = await loadState();

    // Remove existing entry if any
    state.videos = state.videos.filter(v => v.videoId !== videoId);

    // Add new entry
    state.videos.push({
        videoId,
        processedAt: new Date().toISOString(),
        status,
        error,
    });

    await saveState(state);
}

/**
 * 처리되지 않은 비디오 ID 목록을 필터링합니다
 */
export async function filterUnprocessedVideos(videoIds: string[]): Promise<string[]> {
    const state = await loadState();
    const processedIds = new Set(
        state.videos
            .filter(v => v.status === 'success')
            .map(v => v.videoId)
    );

    return videoIds.filter(id => !processedIds.has(id));
}
