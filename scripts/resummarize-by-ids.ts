import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { summarizeSubtitles } from '../src/aiSummarizer.js';

async function run() {
  dotenv.config();
  const ids = process.argv.slice(2).filter(Boolean);
  if (ids.length === 0) {
    console.log('usage: pnpm tsx scripts/resummarize-by-ids.ts <videoId> [videoId...]');
    return;
  }

  const cacheDir = path.join(process.cwd(), 'data', 'cache');

  for (const id of ids) {
    const subtitlePath = path.join(cacheDir, `${id}.subtitle.txt`);
    const summaryPath = path.join(cacheDir, `${id}.summary.txt`);
    try {
      const subtitle = await fs.readFile(subtitlePath, 'utf-8');
      const summary = await summarizeSubtitles(subtitle);
      await fs.writeFile(summaryPath, summary, 'utf-8');
      console.log(`resummarized: ${id}`);
    } catch (error) {
      console.error(`failed: ${id}`, error instanceof Error ? error.message : error);
    }
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
