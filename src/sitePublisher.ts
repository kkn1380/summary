import fs from 'fs/promises';
import path from 'path';
import { Storage } from '@google-cloud/storage';

export interface SummaryRecord {
    title: string;
    channelName: string;
    publishedAt: string;
    url: string;
    summary: string;
    processedAt: string;
}

/**
 * 간단한 정적 페이지용 JSON을 로컬 디렉터리에 기록합니다.
 * 나중에 GCS 업로드로 대체하기 쉬우도록 경로만 바꿔서 사용합니다.
 */
export async function writeSummariesToLocal(
    records: SummaryRecord[],
    options?: { outputDir?: string; fileName?: string }
) {
    const outputDir = options?.outputDir || path.join(process.cwd(), 'data', 'site');
    const fileName = options?.fileName || 'latest.json';
    await fs.mkdir(outputDir, { recursive: true });
    const filePath = path.join(outputDir, fileName);
    const payload = {
        generatedAt: new Date().toISOString(),
        count: records.length,
        items: records,
    };
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return filePath;
}

export async function loadExistingSummaries(
    options?: { outputDir?: string; fileName?: string }
): Promise<SummaryRecord[]> {
    const outputDir = options?.outputDir || path.join(process.cwd(), 'data', 'site');
    const fileName = options?.fileName || 'latest.json';
    const filePath = path.join(outputDir, fileName);
    try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as any;
        if (parsed && Array.isArray(parsed.items)) {
            return parsed.items as SummaryRecord[];
        }
        return [];
    } catch {
        const remoteUrl =
            process.env.SUMMARY_REMOTE_URL
            || (process.env.SUMMARY_REMOTE_BASE_URL
                ? `${process.env.SUMMARY_REMOTE_BASE_URL.replace(/\/+$/, '')}/${fileName}`
                : undefined);
        if (!remoteUrl) {
            return [];
        }
        try {
            const response = await fetch(remoteUrl);
            if (!response.ok) {
                return [];
            }
            const parsed = await response.json() as any;
            if (parsed && Array.isArray(parsed.items)) {
                return parsed.items as SummaryRecord[];
            }
            return [];
        } catch {
            return [];
        }
    }
}

export function mergeSummaries(newRecords: SummaryRecord[], existingRecords: SummaryRecord[]) {
    const map = new Map<string, SummaryRecord>();
    for (const record of existingRecords) {
        map.set(record.url, record);
    }
    for (const record of newRecords) {
        map.set(record.url, record);
    }
    return Array.from(map.values()).sort((a, b) => {
        const timeA = new Date(a.publishedAt).getTime();
        const timeB = new Date(b.publishedAt).getTime();
        if (timeA !== timeB) {
            return timeB - timeA;
        }
        return new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime();
    });
}

type RenderMode = 'default' | 'mobile';

function renderDynamicHtml(mode: RenderMode = 'default') {
    const isMobile = mode === 'mobile';
    const titleText = isMobile ? '투자 인사이트 | Investment Insights (모바일)' : '투자 인사이트 | Investment Insights';
    const extraMobileStyles = isMobile
        ? `
    h1 { font-size: 48px; }
    summary, pre { font-size: 32px; }
    .subtitle, .meta { font-size: 20px; }
    .channels { font-size: 28px; padding: 16px; }
    input[type="search"] { width: 100%; font-size: 20px; }
  `
        : '';

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${titleText}</title>
  <style>
    body { font-family: 'Pretendard', system-ui, -apple-system, sans-serif; margin: 24px; background: #f7f7f9; }
    h1 { margin-bottom: 8px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
    .channels { color: #555; font-size: 14px; margin-bottom: 20px; padding: 12px; background: #fff; border-radius: 8px; border: 1px solid #e5e5e5; line-height: 1.6; }
    .channels-label { font-weight: 600; color: #333; margin-right: 8px; }
    .date-group { margin: 16px 0; }
    .date-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    details { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; margin-bottom: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); }
    summary { cursor: pointer; font-weight: 600; }
    .tts-btn { margin: 8px 0 4px 0; padding: 6px 10px; border-radius: 8px; border: 1px solid #ddd; background: #f5f5f7; cursor: pointer; }
    .subtitle { color: #666; font-size: 13px; margin-top: 4px; }
    pre { white-space: pre-wrap; word-break: break-word; background: #fafafa; padding: 10px; border-radius: 6px; border: 1px solid #eee; }
    .badge { display: inline-block; background: #eef2ff; color: #3730a3; border-radius: 12px; padding: 2px 8px; font-size: 12px; margin-right: 6px; }
    .search { margin: 12px 0 18px 0; }
    input[type="search"] { width: 260px; padding: 8px 10px; border-radius: 8px; border: 1px solid #ccc; }
    ${extraMobileStyles}
  </style>
</head>
<body>
  <h1>${titleText}</h1>
  <div class="meta">생성: <span id="generatedAt"></span> / 총 <span id="total"></span>건</div>
  <div class="channels">
    <span class="channels-label">📺 구독 채널:</span>
    <span id="channels">로딩 중...</span>
  </div>
  <div class="search">
    <input id="search" type="search" placeholder="제목/채널/요약 검색..." />
  </div>
  <div id="root"></div>

  <script>
    const root = document.getElementById('root');
    const searchInput = document.getElementById('search');
    const generatedAtEl = document.getElementById('generatedAt');
    const totalEl = document.getElementById('total');
    const channelsEl = document.getElementById('channels');
    let payload = null;

    // JSON 파일 경로 (환경에 따라 자동 감지)
    const dataUrl = './latest.json';

    // 데이터 로드
    async function loadData() {
      try {
        const response = await fetch(dataUrl);
        if (!response.ok) {
          throw new Error('데이터를 불러올 수 없습니다.');
        }
        payload = await response.json();
        generatedAtEl.textContent = new Date(payload.generatedAt).toLocaleString('ko-KR');
        totalEl.textContent = payload.items.length;
        
        // 채널 목록 추출 및 표시
        const channels = [...new Set(payload.items.map(item => item.channelName))].sort();
        channelsEl.textContent = channels.join(' • ');
        
        render(payload.items);
      } catch (error) {
        root.innerHTML = '<p style="color: red;">❌ 데이터 로드 실패: ' + error.message + '</p>';
        console.error('Data load error:', error);
      }
    }

    function groupByDate(items) {
      const sorted = [...items].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      const groups = [];
      const map = new Map();
      for (const item of sorted) {
        const d = new Date(item.publishedAt);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const key = y + '-' + m + '-' + day;
        if (!map.has(key)) {
          const group = { date: key, items: [] };
          map.set(key, group);
          groups.push(group);
        }
        map.get(key).items.push(item);
      }
      return groups;
    }

    function render(list) {
      root.innerHTML = '';
      const groups = groupByDate(list);
      if (groups.length === 0) {
        root.textContent = '표시할 항목이 없습니다.';
        return;
      }
      for (const group of groups) {
        const wrapper = document.createElement('div');
        wrapper.className = 'date-group';
        const header = document.createElement('div');
        header.className = 'date-header';
        const h3 = document.createElement('h3');
        h3.textContent = group.date;
        const dateTtsBtn = document.createElement('button');
        dateTtsBtn.type = 'button';
        dateTtsBtn.className = 'tts-btn';
        dateTtsBtn.textContent = '🔊 날짜 듣기';
        dateTtsBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const text = group.items
            .map(entry => \`제목: \${entry.title}. 요약: \${entry.summary}\`)
            .join('\\n\\n');
          toggleTts(text, dateTtsBtn);
        });
        header.appendChild(h3);
        header.appendChild(dateTtsBtn);
        wrapper.appendChild(header);

        group.items.forEach(item => {
          const details = document.createElement('details');
          const summary = document.createElement('summary');
          summary.innerHTML = \`\${item.title} <span class="subtitle">(\${item.channelName})</span>\`;
          const ttsBtn = document.createElement('button');
          ttsBtn.type = 'button';
          ttsBtn.className = 'tts-btn';
          ttsBtn.textContent = '🔊 듣기';
          ttsBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleTts(item.summary, ttsBtn);
          });
          const meta = document.createElement('div');
          meta.className = 'meta';
          meta.innerHTML = \`
            <span class="badge">유튜브 게시일 \${new Date(item.publishedAt).toLocaleString('ko-KR')}</span>
            <span class="badge">처리 \${new Date(item.processedAt).toLocaleString('ko-KR')}</span>
            <span class="badge"><a href="\${item.url}" target="_blank" rel="noopener">YouTube</a></span>
          \`;
          const pre = document.createElement('pre');
          pre.textContent = item.summary;

          details.appendChild(summary);
          details.appendChild(ttsBtn);
          details.appendChild(meta);
          details.appendChild(pre);
          wrapper.appendChild(details);
        });

        root.appendChild(wrapper);
      }
    }

    function matches(item, q) {
      const hay = [item.title, item.channelName, item.summary].join(' ').toLowerCase();
      return hay.includes(q);
    }

    searchInput.addEventListener('input', () => {
      if (!payload) return;
      const q = searchInput.value.trim().toLowerCase();
      if (!q) {
        render(payload.items);
        return;
      }
      render(payload.items.filter(it => matches(it, q)));
    });

    const supportsTts = 'speechSynthesis' in window;
    let currentUtterance = null;
    let currentButton = null;

    function resetTtsButton(button) {
      if (!button) return;
      button.textContent = '🔊 듣기';
      button.dataset.state = 'idle';
    }

    function toggleTts(text, button) {
      if (!supportsTts) {
        alert('이 브라우저는 TTS를 지원하지 않습니다.');
        return;
      }
      if (button.dataset.state === 'playing') {
        window.speechSynthesis.cancel();
        resetTtsButton(button);
        currentUtterance = null;
        currentButton = null;
        return;
      }
      if (currentButton && currentButton !== button) {
        window.speechSynthesis.cancel();
        resetTtsButton(currentButton);
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.onend = () => {
        resetTtsButton(button);
        currentUtterance = null;
        currentButton = null;
      };
      utterance.onerror = () => {
        resetTtsButton(button);
        currentUtterance = null;
        currentButton = null;
      };
      currentUtterance = utterance;
      currentButton = button;
      button.dataset.state = 'playing';
      button.textContent = '⏹ 중지';
      window.speechSynthesis.speak(utterance);
    }

    // 페이지 로드 시 데이터 가져오기
    loadData();
  </script>
</body>
</html>`;
}

export async function writeSummariesHtmlToLocal(
    records: SummaryRecord[],
    options?: { outputDir?: string; fileName?: string }
) {
    const outputDir = options?.outputDir || path.join(process.cwd(), 'data', 'site');
    const fileName = options?.fileName || 'index.html';
    await fs.mkdir(outputDir, { recursive: true });
    const filePath = path.join(outputDir, fileName);
    const html = renderDynamicHtml();
    await fs.writeFile(filePath, html, 'utf-8');
    return filePath;
}

export async function writeSummariesMobileHtmlToLocal(
    records: SummaryRecord[],
    options?: { outputDir?: string; fileName?: string }
) {
    const outputDir = options?.outputDir || path.join(process.cwd(), 'data', 'site');
    const fileName = options?.fileName || 'index.mobile.html';
    await fs.mkdir(outputDir, { recursive: true });
    const filePath = path.join(outputDir, fileName);
    const html = renderDynamicHtml('mobile');
    await fs.writeFile(filePath, html, 'utf-8');
    return filePath;
}

function buildPrefix(prefix?: string) {
    if (!prefix) return '';
    return prefix.endsWith('/') ? prefix : `${prefix}/`;
}

const storage = new Storage();

export async function writeSummariesToGcs(
    records: SummaryRecord[],
    options: {
        bucket: string;
        prefix?: string;
        jsonFileName?: string;
        htmlFileName?: string;
        mobileHtmlFileName?: string;
    }
) {
    const bucket = storage.bucket(options.bucket);
    const prefix = buildPrefix(options.prefix);

    const jsonPayload = {
        generatedAt: new Date().toISOString(),
        count: records.length,
        items: records,
    };
    const html = renderDynamicHtml();
    const mobileHtml = renderDynamicHtml('mobile');

    const jsonName = options.jsonFileName || 'latest.json';
    const htmlName = options.htmlFileName || 'index.html';
    const mobileHtmlName = options.mobileHtmlFileName || 'index.mobile.html';

    const jsonFile = bucket.file(`${prefix}${jsonName}`);
    const htmlFile = bucket.file(`${prefix}${htmlName}`);
    const mobileHtmlFile = bucket.file(`${prefix}${mobileHtmlName}`);

    await jsonFile.save(JSON.stringify(jsonPayload, null, 2), {
        contentType: 'application/json',
        metadata: {
            cacheControl: 'no-store',
        },
    });
    await htmlFile.save(html, {
        contentType: 'text/html; charset=utf-8',
        metadata: {
            cacheControl: 'no-store',
        },
    });
    await mobileHtmlFile.save(mobileHtml, {
        contentType: 'text/html; charset=utf-8',
        metadata: {
            cacheControl: 'no-store',
        },
    });

    return {
        jsonUri: `gs://${options.bucket}/${prefix}${jsonName}`,
        htmlUri: `gs://${options.bucket}/${prefix}${htmlName}`,
        mobileHtmlUri: `gs://${options.bucket}/${prefix}${mobileHtmlName}`,
    };
}
