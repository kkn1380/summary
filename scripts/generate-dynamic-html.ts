import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { generateDynamicHtml } from '../src/htmlTemplate.js';

dotenv.config();

async function main() {
    const r2PublicUrl = process.env.R2_PUBLIC_URL;
    
    if (!r2PublicUrl) {
        console.error('❌ R2_PUBLIC_URL 환경 변수가 설정되지 않았습니다.');
        console.error('   .env 파일에 R2_PUBLIC_URL을 추가하세요.');
        console.error('   예: R2_PUBLIC_URL=https://pub-xxxxx.r2.dev');
        process.exit(1);
    }

    console.log('🎨 동적 HTML 생성 중...\n');
    console.log(`   R2 Public URL: ${r2PublicUrl}`);

    const html = generateDynamicHtml(r2PublicUrl);
    
    const outputDir = path.join(process.cwd(), 'data', 'site');
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputPath = path.join(outputDir, 'index.html');
    await fs.writeFile(outputPath, html, 'utf-8');
    
    console.log(`\n✅ HTML 생성 완료: ${outputPath}`);
    console.log('\n📝 다음 단계:');
    console.log('   1. data/site/index.html을 Cloudflare Pages에 배포');
    console.log('   2. R2 데이터 업로드: npm run upload:r2');
}

main().catch(error => {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
});
