import Parser from 'rss-parser';

export interface VideoInfo {
    videoId: string;
    title: string;
    channelId: string;
    channelName: string;
    publishedAt: Date;
    url: string;
}

/**
 * YouTube 채널의 RSS 피드에서 최신 동영상 정보를 가져옵니다
 */
export async function getChannelVideos(
    channelId: string,
    maxVideos: number = 10
): Promise<VideoInfo[]> {
    const parser = new Parser();
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

    try {
        const feed = await parser.parseURL(feedUrl);

        const videos: VideoInfo[] = [];
        const itemsToProcess = Math.min(feed.items?.length || 0, maxVideos);

        for (let i = 0; i < itemsToProcess; i++) {
            const item = feed.items![i];

            // Extract video ID from the link
            const videoId = extractVideoIdFromUrl(item.link || '');
            if (!videoId) continue;

            videos.push({
                videoId,
                title: item.title || 'Unknown Title',
                channelId,
                channelName: feed.title || 'Unknown Channel',
                publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
                url: item.link || `https://www.youtube.com/watch?v=${videoId}`,
            });
        }

        return videos;
    } catch (error) {
        console.error(`Failed to fetch videos for channel ${channelId}:`, error);
        throw new Error(`채널 ${channelId}의 동영상을 가져올 수 없습니다`);
    }
}

/**
 * URL에서 비디오 ID 추출
 */
function extractVideoIdFromUrl(url: string): string | null {
    const match = url.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

/**
 * 여러 채널의 최신 동영상을 가져옵니다
 */
export async function getMultipleChannelsVideos(
    channelIds: string[],
    maxVideosPerChannel: number = 10
): Promise<VideoInfo[]> {
    const allVideos: VideoInfo[] = [];

    for (const channelId of channelIds) {
        try {
            const videos = await getChannelVideos(channelId, maxVideosPerChannel);
            allVideos.push(...videos);
        } catch (error) {
            console.error(`Error fetching channel ${channelId}:`, error);
            // Continue with other channels even if one fails
        }
    }

    // Sort by published date (newest first)
    return allVideos.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
