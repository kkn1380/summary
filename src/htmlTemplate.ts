export function generateDynamicHtml(r2PublicUrl: string): string {
    return generateHtmlTemplate(r2PublicUrl);
}

export function generateLocalHtml(): string {
    return generateHtmlTemplate(''); // 빈 문자열 = 로컬 경로 사용
}

function generateHtmlTemplate(r2PublicUrl: string): string {
    const isLocal = r2PublicUrl === '';
    const baseUrl = isLocal ? '.' : r2PublicUrl;
    
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>투자 인사이트 | Investment Insights</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 2em;
        }
        .subtitle {
            color: #7f8c8d;
            margin-bottom: 20px;
            font-size: 0.9em;
        }
        .channels {
            background: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 30px;
        }
        .channels h3 {
            color: #34495e;
            margin-bottom: 10px;
            font-size: 1.1em;
        }
        .channel-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        .channel-tag {
            background: white;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.85em;
            color: #555;
            border: 1px solid #ddd;
        }
        .date-section {
            margin-bottom: 30px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
        }
        .date-header {
            background: #3498db;
            color: white;
            padding: 15px 20px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
        }
        .date-header:hover {
            background: #2980b9;
        }
        .date-header.collapsed {
            background: #95a5a6;
        }
        .date-header.collapsed:hover {
            background: #7f8c8d;
        }
        .date-title {
            font-size: 1.2em;
            font-weight: bold;
        }
        .date-count {
            font-size: 0.9em;
            opacity: 0.9;
        }
        .toggle-icon {
            font-size: 1.2em;
            transition: transform 0.3s;
        }
        .toggle-icon.collapsed {
            transform: rotate(-90deg);
        }
        .date-content {
            padding: 20px;
            background: #fafafa;
        }
        .date-content.hidden {
            display: none;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #7f8c8d;
        }
        .channel-group {
            margin-bottom: 20px;
            background: white;
            border-radius: 5px;
            overflow: hidden;
            border: 1px solid #e0e0e0;
        }
        .channel-header {
            background: #ecf0f1;
            padding: 12px 15px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            border-left: 4px solid #3498db;
        }
        .channel-header:hover {
            background: #d5dbdb;
        }
        .channel-header.collapsed {
            background: #f8f9fa;
        }
        .channel-name {
            font-size: 1.05em;
            font-weight: bold;
            color: #2c3e50;
        }
        .channel-count {
            font-size: 0.85em;
            color: #7f8c8d;
        }
        .channel-content {
            padding: 10px;
            background: #fafafa;
        }
        .channel-content.hidden {
            display: none;
        }
        .video-item {
            margin-bottom: 10px;
            background: white;
            border-radius: 5px;
            overflow: hidden;
            border: 1px solid #e0e0e0;
        }
        .video-header {
            padding: 12px 15px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            border-left: 3px solid #e74c3c;
        }
        .video-header:hover {
            background: #f8f9fa;
        }
        .video-header.collapsed {
            background: white;
        }
        .video-title-text {
            flex: 1;
            font-size: 0.95em;
            font-weight: 500;
            color: #2c3e50;
            padding-right: 10px;
        }
        .video-link-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            margin-left: 8px;
            background: #e74c3c;
            border-radius: 4px;
            color: white;
            text-decoration: none;
            font-size: 16px;
            transition: background 0.2s;
            flex-shrink: 0;
        }
        .video-link-icon:hover {
            background: #c0392b;
            transform: scale(1.05);
        }
        .video-link-icon svg {
            width: 18px;
            height: 18px;
            fill: white;
        }
        .video-content {
            padding: 15px;
            background: #f8f9fa;
            border-top: 1px solid #e0e0e0;
        }
        .video-content.hidden {
            display: none;
        }
        .video-meta {
            font-size: 0.85em;
            color: #7f8c8d;
            margin-bottom: 10px;
        }
        .video-summary {
            color: #555;
            line-height: 1.8;
            white-space: pre-wrap;
            font-size: 0.95em;
        }
        .tts-btn {
            margin: 8px 0;
            padding: 8px 16px;
            border-radius: 6px;
            border: 1px solid #ddd;
            background: #f8f9fa;
            cursor: pointer;
            font-size: 0.9em;
            color: #555;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .tts-btn:hover {
            background: #e9ecef;
            border-color: #adb5bd;
        }
        .tts-btn.playing {
            background: #e74c3c;
            color: white;
            border-color: #c0392b;
        }
        .tts-btn.playing:hover {
            background: #c0392b;
        }
        .load-more-btn {
            display: block;
            width: 100%;
            padding: 15px;
            margin: 20px 0;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1em;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }
        .load-more-btn:hover {
            background: #2980b9;
        }
        .load-more-btn:disabled {
            background: #95a5a6;
            cursor: not-allowed;
        }
        .error {
            background: #e74c3c;
            color: white;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            .container {
                padding: 15px;
            }
            h1 {
                font-size: 1.5em;
            }
            .subtitle {
                font-size: 0.85em;
            }
            .channels {
                padding: 12px;
            }
            .channels h3 {
                font-size: 1em;
            }
            .channel-list {
                gap: 5px;
            }
            .channel-tag {
                font-size: 0.75em;
                padding: 4px 8px;
            }
            .date-header {
                padding: 12px 15px;
            }
            .date-title {
                font-size: 1em;
            }
            .date-count {
                font-size: 0.8em;
            }
            .channel-header {
                padding: 10px 12px;
            }
            .channel-name {
                font-size: 0.95em;
            }
            .channel-count {
                font-size: 0.8em;
            }
            .video-header {
                padding: 10px 12px;
            }
            .video-title-text {
                font-size: 0.9em;
            }
            .video-link-icon {
                width: 28px;
                height: 28px;
                font-size: 14px;
            }
            .video-link-icon svg {
                width: 16px;
                height: 16px;
            }
            .video-content {
                padding: 12px;
            }
            .video-meta {
                font-size: 0.8em;
            }
            .video-summary {
                font-size: 0.9em;
            }
            .tts-btn {
                font-size: 0.85em;
                padding: 6px 12px;
            }
            .load-more-btn {
                padding: 12px;
                font-size: 0.95em;
            }
            .toggle-icon {
                font-size: 1em;
            }
        }
        @media (max-width: 480px) {
            body {
                padding: 5px;
            }
            .container {
                padding: 10px;
                border-radius: 0;
            }
            h1 {
                font-size: 1.3em;
            }
            .subtitle {
                font-size: 0.8em;
            }
            .channels {
                padding: 10px;
            }
            .date-header, .channel-header, .video-header {
                padding: 8px 10px;
            }
            .video-title-text {
                font-size: 0.85em;
            }
            .video-link-icon {
                width: 24px;
                height: 24px;
            }
            .video-link-icon svg {
                width: 14px;
                height: 14px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>투자 인사이트 | Investment Insights</h1>
        <p class="subtitle">YouTube 채널 요약 모음</p>
        
        <div class="channels" id="channels">
            <h3>📺 구독 중인 채널</h3>
            <div class="channel-list" id="channel-list">
                <span class="channel-tag">로딩 중...</span>
            </div>
        </div>
        
        <div id="content">
            <div class="loading">데이터를 불러오는 중...</div>
        </div>
    </div>

    <script>
        const R2_PUBLIC_URL = '${baseUrl}';
        const IS_LOCAL = ${isLocal};
        const DATES_PER_PAGE = 3; // 한 번에 보여줄 날짜 개수
        
        let indexData = null;
        let loadedDates = new Set();
        let displayedDateCount = 0; // 현재 표시된 날짜 개수

        // 초기 로드
        async function init() {
            try {
                const indexUrl = IS_LOCAL ? './index.json' : \`\${R2_PUBLIC_URL}/index.json\`;
                const response = await fetch(indexUrl);
                if (!response.ok) throw new Error('Failed to load index');
                
                indexData = await response.json();
                
                // 채널 목록 표시
                renderChannels();
                
                // 날짜 섹션 렌더링
                renderDates();
                
            } catch (error) {
                console.error('Error loading data:', error);
                document.getElementById('content').innerHTML = 
                    '<div class="error">데이터를 불러오는데 실패했습니다. ' + 
                    (IS_LOCAL ? '로컬 파일을 확인하세요: data/site/index.json' : '') + 
                    '</div>';
            }
        }

        // 채널 목록 렌더링
        function renderChannels() {
            const channels = new Set();
            indexData.today.items.forEach(item => channels.add(item.channelName));
            
            const channelList = document.getElementById('channel-list');
            channelList.innerHTML = Array.from(channels)
                .sort()
                .map(name => \`<span class="channel-tag">\${name}</span>\`)
                .join('');
        }

        // 날짜 섹션 렌더링
        function renderDates() {
            const content = document.getElementById('content');
            content.innerHTML = '';
            
            // 처음 3개 날짜만 렌더링
            displayedDateCount = Math.min(DATES_PER_PAGE, indexData.dates.length);
            renderDateRange(0, displayedDateCount);
            
            // 더 보기 버튼 추가
            if (displayedDateCount < indexData.dates.length) {
                addLoadMoreButton();
            }
        }

        // 날짜 범위 렌더링
        function renderDateRange(startIndex, endIndex) {
            const content = document.getElementById('content');
            const fragment = document.createDocumentFragment();
            
            for (let i = startIndex; i < endIndex && i < indexData.dates.length; i++) {
                const date = indexData.dates[i];
                const isToday = i === 0;
                const count = isToday ? indexData.today.count : '?';
                
                const dateSection = document.createElement('div');
                dateSection.className = 'date-section';
                dateSection.innerHTML = \`
                    <div class="date-header \${isToday ? '' : 'collapsed'}" 
                         onclick="toggleDate('\${date}', this)">
                        <div>
                            <div class="date-title">\${formatDate(date)}</div>
                            <div class="date-count" id="count-\${date}">\${count}개 영상</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button class="tts-btn" onclick="event.stopPropagation(); playDateTTS('\${date}')" id="tts-date-\${date}">
                                🔊 날짜 듣기
                            </button>
                            <div class="toggle-icon \${isToday ? '' : 'collapsed'}">▼</div>
                        </div>
                    </div>
                    <div class="date-content \${isToday ? '' : 'hidden'}" id="content-\${date}">
                        \${isToday ? renderDayContent(indexData.today.items) : ''}
                    </div>
                \`;
                
                fragment.appendChild(dateSection);
            }
            
            content.appendChild(fragment);
        }

        // 더 보기 버튼 추가
        function addLoadMoreButton() {
            const content = document.getElementById('content');
            const existingBtn = document.getElementById('load-more-btn');
            if (existingBtn) {
                existingBtn.remove();
            }
            
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'load-more-btn';
            loadMoreBtn.className = 'load-more-btn';
            loadMoreBtn.textContent = \`더 보기 (\${indexData.dates.length - displayedDateCount}개 날짜 남음)\`;
            loadMoreBtn.onclick = loadMoreDates;
            
            content.appendChild(loadMoreBtn);
        }

        // 더 보기 클릭
        function loadMoreDates() {
            const startIndex = displayedDateCount;
            const endIndex = Math.min(startIndex + DATES_PER_PAGE, indexData.dates.length);
            
            // 더 보기 버튼 제거
            const loadMoreBtn = document.getElementById('load-more-btn');
            if (loadMoreBtn) {
                loadMoreBtn.remove();
            }
            
            // 새 날짜들 렌더링
            renderDateRange(startIndex, endIndex);
            displayedDateCount = endIndex;
            
            // 아직 더 있으면 버튼 다시 추가
            if (displayedDateCount < indexData.dates.length) {
                addLoadMoreButton();
            }
        }

        // 날짜 토글
        async function toggleDate(date, headerElement) {
            const contentElement = document.getElementById(\`content-\${date}\`);
            const icon = headerElement.querySelector('.toggle-icon');
            
            // 이미 열려있으면 닫기
            if (!contentElement.classList.contains('hidden')) {
                contentElement.classList.add('hidden');
                headerElement.classList.add('collapsed');
                icon.classList.add('collapsed');
                return;
            }
            
            // 열기
            headerElement.classList.remove('collapsed');
            icon.classList.remove('collapsed');
            contentElement.classList.remove('hidden');
            
            // 데이터가 이미 로드되었으면 스킵
            if (loadedDates.has(date)) return;
            
            // 오늘 데이터는 이미 있음
            if (date === indexData.dates[0]) {
                loadedDates.add(date);
                return;
            }
            
            // 데이터 로드
            contentElement.innerHTML = '<div class="loading">데이터를 불러오는 중...</div>';
            
            try {
                const dateUrl = IS_LOCAL 
                    ? \`./summaries/\${date}.json\`
                    : \`\${R2_PUBLIC_URL}/summaries/\${date}.json\`;
                const response = await fetch(dateUrl);
                if (!response.ok) throw new Error('Failed to load date data');
                
                const dayData = await response.json();
                contentElement.innerHTML = renderDayContent(dayData.items);
                
                // 카운트 업데이트
                document.getElementById(\`count-\${date}\`).textContent = \`\${dayData.count}개 영상\`;
                
                loadedDates.add(date);
                
            } catch (error) {
                console.error(\`Error loading \${date}:\`, error);
                contentElement.innerHTML = '<div class="error">데이터를 불러오는데 실패했습니다.</div>';
            }
        }

        // 하루 데이터 렌더링 (채널별 그룹화)
        function renderDayContent(items) {
            const byChannel = {};
            items.forEach(item => {
                if (!byChannel[item.channelName]) {
                    byChannel[item.channelName] = [];
                }
                byChannel[item.channelName].push(item);
            });
            
            return Object.entries(byChannel)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([channelName, videos]) => {
                    const channelId = \`channel-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
                    return \`
                        <div class="channel-group">
                            <div class="channel-header collapsed" onclick="toggleChannel('\${channelId}', this)">
                                <div>
                                    <div class="channel-name">\${channelName}</div>
                                    <div class="channel-count">\${videos.length}개 영상</div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <button class="tts-btn" onclick="event.stopPropagation(); playChannelTTS('\${channelId}', \${JSON.stringify(videos).replace(/"/g, '&quot;')})" id="tts-\${channelId}">
                                        🔊 채널 듣기
                                    </button>
                                    <div class="toggle-icon collapsed">▼</div>
                                </div>
                            </div>
                            <div class="channel-content hidden" id="\${channelId}">
                                \${videos.map(video => {
                                    const videoId = \`video-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
                                    return \`
                                        <div class="video-item">
                                            <div class="video-header collapsed" onclick="toggleVideo('\${videoId}', this)">
                                                <div class="video-title-text">
                                                    \${video.title}
                                                </div>
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <a href="\${video.url}" 
                                                       target="_blank" 
                                                       class="video-link-icon" 
                                                       onclick="event.stopPropagation()"
                                                       title="YouTube에서 보기">
                                                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                                        </svg>
                                                    </a>
                                                    <div class="toggle-icon collapsed">▼</div>
                                                </div>
                                            </div>
                                            <div class="video-content hidden" id="\${videoId}">
                                                <div class="video-meta">
                                                    게시일: \${new Date(video.publishedAt).toLocaleString('ko-KR')}
                                                </div>
                                                <button class="tts-btn" onclick="playVideoTTS('\${videoId}', \${JSON.stringify(video.summary).replace(/"/g, '&quot;')})" id="tts-\${videoId}">
                                                    🔊 요약 듣기
                                                </button>
                                                <div class="video-summary">\${video.summary}</div>
                                            </div>
                                        </div>
                                    \`;
                                }).join('')}
                            </div>
                        </div>
                    \`;
                }).join('');
        }

        // 채널 토글
        function toggleChannel(channelId, headerElement) {
            const contentElement = document.getElementById(channelId);
            const icon = headerElement.querySelector('.toggle-icon');
            
            if (contentElement.classList.contains('hidden')) {
                contentElement.classList.remove('hidden');
                headerElement.classList.remove('collapsed');
                icon.classList.remove('collapsed');
            } else {
                contentElement.classList.add('hidden');
                headerElement.classList.add('collapsed');
                icon.classList.add('collapsed');
            }
        }

        // 영상 토글
        function toggleVideo(videoId, headerElement) {
            const contentElement = document.getElementById(videoId);
            const icon = headerElement.querySelector('.toggle-icon');
            
            if (contentElement.classList.contains('hidden')) {
                contentElement.classList.remove('hidden');
                headerElement.classList.remove('collapsed');
                icon.classList.remove('collapsed');
            } else {
                contentElement.classList.add('hidden');
                headerElement.classList.add('collapsed');
                icon.classList.add('collapsed');
            }
        }

        // 날짜 포맷팅
        function formatDate(dateStr) {
            const date = new Date(dateStr);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (dateStr === today.toISOString().split('T')[0]) {
                return \`오늘 (\${dateStr})\`;
            } else if (dateStr === yesterday.toISOString().split('T')[0]) {
                return \`어제 (\${dateStr})\`;
            } else {
                const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
                return \`\${dateStr} (\${weekday})\`;
            }
        }

        // 페이지 로드 시 실행
        init();

        // ========== TTS 기능 ==========
        const supportsTTS = 'speechSynthesis' in window;
        let currentUtterance = null;
        let currentButton = null;

        function resetTTSButton(button) {
            if (!button) return;
            const icon = button.textContent.includes('날짜') ? '🔊 날짜 듣기' :
                         button.textContent.includes('채널') ? '🔊 채널 듣기' :
                         '🔊 요약 듣기';
            button.textContent = icon;
            button.classList.remove('playing');
            button.dataset.state = 'idle';
        }

        function toggleTTS(text, button) {
            if (!supportsTTS) {
                alert('이 브라우저는 TTS를 지원하지 않습니다.');
                return;
            }

            // 이미 재생 중이면 중지
            if (button.dataset.state === 'playing') {
                window.speechSynthesis.cancel();
                resetTTSButton(button);
                currentUtterance = null;
                currentButton = null;
                return;
            }

            // 다른 버튼이 재생 중이면 중지
            if (currentButton && currentButton !== button) {
                window.speechSynthesis.cancel();
                resetTTSButton(currentButton);
            }

            // 새로운 TTS 시작
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ko-KR';
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            
            utterance.onend = () => {
                resetTTSButton(button);
                currentUtterance = null;
                currentButton = null;
            };
            
            utterance.onerror = () => {
                resetTTSButton(button);
                currentUtterance = null;
                currentButton = null;
            };

            currentUtterance = utterance;
            currentButton = button;
            button.dataset.state = 'playing';
            button.textContent = '⏹ 중지';
            button.classList.add('playing');
            
            window.speechSynthesis.speak(utterance);
        }

        // 날짜별 TTS
        async function playDateTTS(date) {
            const button = document.getElementById(\`tts-date-\${date}\`);
            
            // 데이터 로드 확인
            let items;
            if (date === indexData.dates[0]) {
                items = indexData.today.items;
            } else if (loadedDates.has(date)) {
                // 이미 로드된 데이터에서 가져오기
                const contentElement = document.getElementById(\`content-\${date}\`);
                if (!contentElement || contentElement.classList.contains('hidden')) {
                    alert('먼저 날짜를 펼쳐서 데이터를 로드해주세요.');
                    return;
                }
                // DOM에서 데이터 추출 (임시 방법)
                alert('날짜 TTS는 오늘 데이터만 지원합니다.');
                return;
            } else {
                alert('먼저 날짜를 펼쳐서 데이터를 로드해주세요.');
                return;
            }
            
            const text = items
                .map(item => \`제목: \${item.title}. 요약: \${item.summary}\`)
                .join('\\n\\n');
            
            toggleTTS(text, button);
        }

        // 채널별 TTS
        function playChannelTTS(channelId, videos) {
            const button = document.getElementById(\`tts-\${channelId}\`);
            const text = videos
                .map(video => \`제목: \${video.title}. 요약: \${video.summary}\`)
                .join('\\n\\n');
            
            toggleTTS(text, button);
        }

        // 영상별 TTS
        function playVideoTTS(videoId, summary) {
            const button = document.getElementById(\`tts-\${videoId}\`);
            toggleTTS(summary, button);
        }
    </script>
</body>
</html>`;
}
