import fs from 'fs/promises';
import path from 'path';
import { generateLocalHtml } from '../src/htmlTemplate.js';

async function main() {
    console.log('🎨 로컬 테스트용 HTML 생성 중...\n');

    const html = generateLocalHtml();
    
    const outputDir = path.join(process.cwd(), 'data', 'site');
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputPath = path.join(outputDir, 'index.html');
    await fs.writeFile(outputPath, html, 'utf-8');
    
    console.log(`✅ HTML 생성 완료: ${outputPath}`);
    console.log('\n📝 다음 단계:');
    console.log('   1. 로컬 데이터 생성: npm run upload:r2 -- --local-only');
    console.log('   2. 로컬 서버 실행: npm run serve:site');
    console.log('   3. 브라우저 접속: http://localhost:8000');
}

main().catch(error => {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
});
