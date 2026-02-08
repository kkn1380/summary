import { google, youtube_v3 } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

export interface YouTubeVideo {
    videoId: string;
    title: string;
    channelId: string;
    channelName: string;
    publishedAt: Date;
    url: string;
    description?: string;
}

export interface FetchOptions {
    channelId: string;
    maxResults?: number;
    publishedAfter?: Date;
    publishedBefore?: Date;
}

/**
 * YouTube Data API v3 클라이언트 초기화
 */
function getYouTubeClient(): youtube_v3.Youtube {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        throw new Error('YOUTUBE_API_KEY 환경 변수가 설정되지 않았습니다');
    }

    return google.youtube({
        version: 'v3',
        auth: apiKey,
    });
}

/**
 * 채널의 업로드 재생목록 ID 가져오기
 */
async function getUploadsPlaylistId(youtube: youtube_v3.Youtube, channelId: string): Promise<string> {
    try {
        const response = await youtube.channels.list({
            part: ['contentDetails'],
            id: [channelId],
        });

        const channel = response.data.items?.[0];
        if (!channel?.contentDetails?.relatedPlaylists?.uploads) {
            throw new Error(`채널 ${channelId}의 업로드 재생목록을 찾을 수 없습니다`);
        }

        return channel.contentDetails.relatedPlaylists.uploads;
    } catch (error) {
        console.error(`Failed to get uploads playlist for channel ${channelId}:`, error);
        throw error;
    }
}

/**
 * YouTube Data API v3를 사용하여 채널의 동영상 목록 가져오기
 */
export async function fetchChannelVideos(options: FetchOptions): Promise<YouTubeVideo[]> {
    const {
        channelId,
        maxResults = 50,
        publishedAfter,
        publishedBefore,
    } = options;

    const youtube = getYouTubeClient();
    const videos: YouTubeVideo[] = [];

    try {
        // 1. 채널의 업로드 재생목록 ID 가져오기
        const uploadsPlaylistId = await getUploadsPlaylistId(youtube, channelId);

        // 2. 재생목록의 동영상 목록 가져오기
        let pageToken: string | undefined = undefined;
        let totalFetched = 0;

        while (totalFetched < maxResults) {
            const response: any = await youtube.playlistItems.list({
                part: ['snippet', 'contentDetails'],
                playlistId: uploadsPlaylistId,
                maxResults: Math.min(50, maxResults - totalFetched), // API 최대 50개
                pageToken,
            });

            const items = response.data.items || [];
            
            for (const item of items) {
                const snippet = item.snippet;
                if (!snippet?.resourceId?.videoId) continue;

                const publishedAt = snippet.publishedAt ? new Date(snippet.publishedAt) : new Date();

                // 날짜 필터링
                if (publishedAfter && publishedAt < publishedAfter) continue;
                if (publishedBefore && publishedAt > publishedBefore) continue;

                videos.push({
                    videoId: snippet.resourceId.videoId,
                    title: snippet.title || 'Unknown Title',
                    channelId: snippet.channelId || channelId,
                    channelName: snippet.channelTitle || 'Unknown Channel',
                    publishedAt,
                    url: `https://www.youtube.com/watch?v=${snippet.resourceId.videoId}`,
                    description: snippet.description,
                });

                totalFetched++;
                if (totalFetched >= maxResults) break;
            }

            // 다음 페이지가 있고 아직 maxResults에 도달하지 않았으면 계속
            pageToken = response.data.nextPageToken || undefined;
            if (!pageToken || totalFetched >= maxResults) break;
        }

        console.log(`✅ 채널 ${channelId}: ${videos.length}개 동영상 가져옴`);
        return videos;

    } catch (error) {
        console.error(`Failed to fetch videos for channel ${channelId}:`, error);
        throw new Error(`채널 ${channelId}의 동영상을 가져올 수 없습니다`);
    }
}

/**
 * 여러 채널의 동영상 가져오기
 */
export async function fetchMultipleChannelsVideos(
    channelIds: string[],
    options?: {
        maxResultsPerChannel?: number;
        publishedAfter?: Date;
        publishedBefore?: Date;
    }
): Promise<YouTubeVideo[]> {
    const allVideos: YouTubeVideo[] = [];

    for (const channelId of channelIds) {
        try {
            const videos = await fetchChannelVideos({
                channelId,
                maxResults: options?.maxResultsPerChannel || 50,
                publishedAfter: options?.publishedAfter,
                publishedBefore: options?.publishedBefore,
            });
            allVideos.push(...videos);
        } catch (error) {
            console.error(`Error fetching channel ${channelId}:`, error);
            // Continue with other channels even if one fails
        }
    }

    // Sort by published date (newest first)
    return allVideos.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

/**
 * 특정 기간의 동영상 가져오기 (편의 함수)
 */
export async function fetchChannelVideosByDateRange(
    channelId: string,
    startDate: Date,
    endDate: Date,
    maxResults: number = 500
): Promise<YouTubeVideo[]> {
    console.log(`📅 기간: ${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`);
    
    return fetchChannelVideos({
        channelId,
        maxResults,
        publishedAfter: startDate,
        publishedBefore: endDate,
    });
}
