import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  writeSummariesHtmlToLocal,
  writeSummariesMobileHtmlToLocal,
  writeSummariesToLocal,
} from '../src/sitePublisher.js';

type SummaryRecord = {
  title: string;
  channelName: string;
  publishedAt: string;
  url: string;
  summary: string;
  processedAt: string;
};

const execFileAsync = promisify(execFile);

function extractVideoIdFromUrl(url: string): string | null {
  const match = url.match(/watch\\?v=([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

async function loadExistingRecords(): Promise<Map<string, SummaryRecord>> {
  try {
    const raw = await fs.readFile(
      path.join(repoRoot, 'data', 'site', 'latest.json'),
      'utf-8'
    );
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const map = new Map<string, SummaryRecord>();
    for (const item of items) {
      if (!item?.url) continue;
      const videoId = extractVideoIdFromUrl(item.url);
      if (videoId) {
        map.set(videoId, item as SummaryRecord);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

async function fetchOembed(videoId: string): Promise<{ title: string; channelName: string } | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { title?: string; author_name?: string };
    if (!data?.title) {
      return null;
    }
    return {
      title: data.title,
      channelName: data.author_name || 'Unknown Channel',
    };
  } catch {
    return null;
  }
}

function buildYtDlpArgs(baseArgs: string[]): string[] {
  const cookiesPath = process.env.YTDLP_COOKIES;
  const cookiesFromBrowser = process.env.YTDLP_COOKIES_FROM_BROWSER || 'chrome';
  if (cookiesPath) {
    return ['--cookies', cookiesPath, ...baseArgs];
  }
  if (cookiesFromBrowser) {
    return ['--cookies-from-browser', cookiesFromBrowser, ...baseArgs];
  }
  return baseArgs;
}

async function fetchYtDlpMeta(
  videoId: string
): Promise<{ title: string; channelName: string; publishedAt?: string } | null> {
  try {
    const ytdlp = process.env.YTDLP_PATH || 'yt-dlp';
    const args = buildYtDlpArgs([
      '--skip-download',
      '--dump-single-json',
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);
    const { stdout } = await execFileAsync(ytdlp, args, {
      maxBuffer: 1024 * 1024 * 10,
    });
    const data = JSON.parse(stdout) as {
      title?: string;
      uploader?: string;
      channel?: string;
      uploader_id?: string;
      upload_date?: string;
      release_timestamp?: number;
    };
    if (!data?.title) {
      return null;
    }
    let publishedAt: string | undefined;
    if (data.release_timestamp) {
      publishedAt = new Date(data.release_timestamp * 1000).toISOString();
    } else if (data.upload_date && data.upload_date.length === 8) {
      const y = data.upload_date.slice(0, 4);
      const m = data.upload_date.slice(4, 6);
      const d = data.upload_date.slice(6, 8);
      publishedAt = new Date(`${y}-${m}-${d}T00:00:00Z`).toISOString();
    }
    return {
      title: data.title,
      channelName: data.uploader || data.channel || data.uploader_id || 'Unknown Channel',
      publishedAt,
    };
  } catch {
    return null;
  }
}

async function run() {
  const cacheDir = path.join(repoRoot, 'data', 'cache');
  let entries: string[] = [];
  try {
    entries = await fs.readdir(cacheDir);
  } catch (error) {
    console.error(`failed to read cache dir: ${cacheDir}`, error);
    entries = [];
  }
  const summaryFiles = entries.filter(name => {
    if (!name.endsWith('.summary.txt')) return false;
    if (name.includes('.subtitle.summary.txt')) return false;
    const base = name.replace('.summary.txt', '');
    return base.length === 11;
  });

  if (summaryFiles.length === 0) {
    console.log(`no summaries in cache (entries: ${entries.length})`);
    return;
  }

  const now = new Date().toISOString();
  const records = [];
  const existingMap = await loadExistingRecords();

  for (const file of summaryFiles) {
    const summary = await fs.readFile(path.join(cacheDir, file), 'utf-8');
    if (summary.trim() === 'NO_RESPONSE') {
      continue;
    }
    const videoId = file.replace('.summary.txt', '');
    const existing = existingMap.get(videoId);
    let title = existing?.title || videoId;
    let channelName = existing?.channelName || 'unknown';
    let publishedAt = existing?.publishedAt || now;
    const processedAt = existing?.processedAt || now;
    const url = existing?.url || `https://www.youtube.com/watch?v=${videoId}`;

    if (title === videoId || channelName === 'unknown') {
      const oembed = await fetchOembed(videoId);
      if (oembed) {
        title = oembed.title;
        channelName = oembed.channelName;
      }
    }

    if (title === videoId || channelName === 'unknown' || publishedAt === now) {
      const ytdlpMeta = await fetchYtDlpMeta(videoId);
      if (ytdlpMeta) {
        if (title === videoId) {
          title = ytdlpMeta.title;
        }
        if (channelName === 'unknown') {
          channelName = ytdlpMeta.channelName;
        }
        if (publishedAt === now && ytdlpMeta.publishedAt) {
          publishedAt = ytdlpMeta.publishedAt;
        }
      }
    }

    records.push({
      title,
      channelName,
      publishedAt,
      url,
      summary,
      processedAt,
    });
  }

  await writeSummariesToLocal(records, { outputDir: path.join(repoRoot, 'data', 'site') });
  await writeSummariesHtmlToLocal(records, { outputDir: path.join(repoRoot, 'data', 'site') });
  await writeSummariesMobileHtmlToLocal(records, { outputDir: path.join(repoRoot, 'data', 'site') });
  console.log(`generated index from summaries: ${records.length}`);
}

const repoRoot = '/Users/knkim/workspace/toy-project/summary';

run().catch(error => {
  console.error(error);
  process.exit(1);
});
