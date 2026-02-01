import { writeSummariesHtmlToLocal, writeSummariesMobileHtmlToLocal } from '../src/sitePublisher.js';

async function main() {
    console.log('📄 동적 HTML 템플릿 생성 중...');
    
    // 빈 배열로 HTML 생성 (템플릿만 생성)
    await writeSummariesHtmlToLocal([], {
        outputDir: 'data/site',
    });
    
    await writeSummariesMobileHtmlToLocal([], {
        outputDir: 'data/site',
    });
    
    console.log('✅ 동적 HTML 템플릿 생성 완료!');
    console.log('   - data/site/index.html');
    console.log('   - data/site/index.mobile.html');
    console.log('');
    console.log('이제 latest.json 파일만 업데이트하면 됩니다.');
}

main().catch(console.error);
