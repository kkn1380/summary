import dotenv from 'dotenv';
import { loadExistingSummaries } from '../src/sitePublisher.js';
import {
    saveDailySummariesToLocal,
    saveIndexToLocal,
    uploadDailySummariesToR2,
    uploadIndexToR2,
} from '../src/r2Publisher.js';

dotenv.config();

async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
사용법: npx tsx scripts/upload-to-r2.ts [옵션]

옵션:
  --local-only      로컬에만 저장 (R2 업로드 안 함)
  --r2-only         R2에만 업로드 (로컬 저장 안 함)
  --help, -h        도움말 표시

예시:
  # 로컬 + R2 모두
  npx tsx scripts/upload-to-r2.ts

  # 로컬에만 저장 (테스트용)
  npx tsx scripts/upload-to-r2.ts --local-only

  # R2에만 업로드
  npx tsx scripts/upload-to-r2.ts --r2-only
        `);
        return;
    }

    const localOnly = args.includes('--local-only');
    const r2Only = args.includes('--r2-only');
    const bucketName = process.env.R2_BUCKET_NAME || 'youtube-summaries';

    console.log('🚀 R2 업로드 시작\n');

    // 1. 기존 요약 데이터 로드
    console.log('📖 기존 요약 데이터 로드 중...');
    const records = await loadExistingSummaries();
    console.log(`  ✅ ${records.length}개 요약 로드됨\n`);

    if (records.length === 0) {
        console.log('⚠️  요약 데이터가 없습니다.');
        return;
    }

    // 2. 로컬 저장
    if (!r2Only) {
        console.log('💾 로컬에 저장 중...');
        await saveDailySummariesToLocal(records);
        await saveIndexToLocal(records);
        console.log();
    }

    // 3. R2 업로드
    if (!localOnly) {
        console.log('☁️  Cloudflare R2에 업로드 중...');
        try {
            await uploadDailySummariesToR2(records, bucketName);
            await uploadIndexToR2(records, bucketName);
            console.log();
            console.log('✅ R2 업로드 완료!');
            console.log(`   버킷: ${bucketName}`);
        } catch (error) {
            console.error('❌ R2 업로드 실패:', error);
            if (error instanceof Error) {
                console.error('   ', error.message);
            }
            process.exit(1);
        }
    }

    console.log('\n✨ 완료!');
}

main().catch(error => {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
});
