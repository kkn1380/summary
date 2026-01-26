import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  loadExistingSummaries,
  mergeSummaries,
  writeSummariesHtmlToLocal,
  writeSummariesMobileHtmlToLocal,
  writeSummariesToLocal,
} from '../src/sitePublisher.js';

function extractPayload(html: string) {
  const match = html.match(/const payload = (.*?);/s);
  if (!match) {
    throw new Error('payload not found in legacy index.html');
  }
  return JSON.parse(match[1]);
}

async function main() {
  const legacyHtml = execSync('git show 44d05c7:index.html', { encoding: 'utf-8' });
  const legacyPayload = extractPayload(legacyHtml);
  const legacyItems = Array.isArray(legacyPayload.items) ? legacyPayload.items : [];

  const existingItems = await loadExistingSummaries();
  const mergedItems = mergeSummaries(existingItems, legacyItems);

  const outputDir = path.join(process.cwd(), 'data', 'site');
  await writeSummariesToLocal(mergedItems, { outputDir });
  await writeSummariesHtmlToLocal(mergedItems, { outputDir });
  await writeSummariesMobileHtmlToLocal(mergedItems, { outputDir });

  await fs.writeFile(
    path.join(outputDir, 'rebuild.log'),
    `rebuilt at ${new Date().toISOString()} from commit 44d05c7\n`,
    'utf-8'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
