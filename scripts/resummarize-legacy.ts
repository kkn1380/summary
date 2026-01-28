import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { summarizeSubtitles } from '../src/aiSummarizer.js';

const LEGACY_MARKERS = [
  '[1. 오타 및 수치 문맥 보정]',
  '[2. 핵심 요약]',
];

async function run() {
  dotenv.config();
  const cacheDir = path.join(process.cwd(), 'data', 'cache');
  const entries = await fs.readdir(cacheDir).catch(() => []);
  const summaryFiles = entries.filter(name => name.endsWith('.summary.txt'));
  const targets: string[] = [];

  for (const file of summaryFiles) {
    const content = await fs.readFile(path.join(cacheDir, file), 'utf-8');
    if (LEGACY_MARKERS.some(marker => content.includes(marker))) {
      targets.push(file.replace('.summary.txt', ''));
    }
  }

  if (targets.length === 0) {
    console.log('no legacy summaries found');
    return;
  }

  console.log(`resummarize targets: ${targets.length}`);

  for (const videoId of targets) {
    const subtitlePath = path.join(cacheDir, `${videoId}.subtitle.txt`);
    const summaryPath = path.join(cacheDir, `${videoId}.summary.txt`);
    try {
      const subtitleText = await fs.readFile(subtitlePath, 'utf-8');
      const summary = await summarizeSubtitles(subtitleText);
      await fs.writeFile(summaryPath, summary, 'utf-8');
      console.log(`updated: ${videoId}`);
    } catch (error) {
      console.error(`failed: ${videoId}`, error instanceof Error ? error.message : error);
    }
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
