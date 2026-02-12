import dotenv from 'dotenv';
import { loadExistingSummaries } from '../src/sitePublisher.js';
import {
    downloadAllSummariesFromR2,
    mergeSummaryRecords,
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
사용법: npx tsx scripts/sync-with-r2.ts [옵션]

이 스크립트는 R2와 로컬 데이터를 동기화합니다:
1. R2에서 모든 데이터 다운로드
2. 로컬 데이터와 병합 (videoId 기준, 최신 우선)
3. 병합된 데이터를 R2에 업로드

옵션:
  --dry-run         실제 업로드 없이 시뮬레이션만
  --force           모든 파일 강제 업로드
  --help, -h        도움말 표시

병합 규칙:
  - videoId(URL)가 같으면: processedAt이 최신인 것 선택
  - videoId가 다르면: 둘 다 유지
  - 중복 제거 자동

예시:
  # 일반 동기화
  npx tsx scripts/sync-with-r2.ts

  # 시뮬레이션 (업로드 안 함)
  npx tsx scripts/sync-with-r2.ts --dry-run

  # 강제 업로드
  npx tsx scripts/sync-with-r2.ts --force
        `);
        return;
    }

    const dryRun = args.includes('--dry-run');
    const forceUpload = args.includes('--force');
    const bucketName = process.env.R2_BUCKET_NAME || 'youtube-summaries';

    console.log('🔄 R2 동기화 시작\n');

    // 1. R2에서 데이터 다운로드
    console.log('📥 1단계: R2에서 데이터 다운로드 중...');
    const r2Records = await downloadAllSummariesFromR2(bucketName);
    console.log();

    // 2. 로컬 데이터 로드
    console.log('📖 2단계: 로컬 데이터 로드 중...');
    const localRecords = await loadExistingSummaries();
    console.log(`  ✅ ${localRecords.length}개 로컬 요약 로드됨\n`);

    // 3. 병합
    console.log('🔀 3단계: 데이터 병합 중...');
    const mergedRecords = mergeSummaryRecords(r2Records, localRecords);
    
    const stats = {
        r2Only: r2Records.length - mergedRecords.filter(r => 
            localRecords.some(l => l.url === r.url)
        ).length,
        localOnly: localRecords.length - mergedRecords.filter(r => 
            r2Records.some(l => l.url === r.url)
        ).length,
        common: mergedRecords.filter(r => 
            r2Records.some(l => l.url === r.url) && 
            localRecords.some(l => l.url === r.url)
        ).length,
        total: mergedRecords.length,
    };
    
    console.log(`  📊 병합 결과:`);
    console.log(`     R2 전용: ${stats.r2Only}개`);
    console.log(`     로컬 전용: ${stats.localOnly}개`);
    console.log(`     공통: ${stats.common}개`);
    console.log(`     총: ${stats.total}개\n`);

    if (dryRun) {
        console.log('⚠️  Dry-run 모드: 실제 업로드하지 않음\n');
        console.log('✨ 시뮬레이션 완료!');
        return;
    }

    // 4. 로컬에 저장
    console.log('💾 4단계: 로컬에 저장 중...');
    await saveDailySummariesToLocal(mergedRecords);
    await saveIndexToLocal(mergedRecords);
    console.log();

    // 5. R2에 업로드
    console.log('☁️  5단계: R2에 업로드 중...');
    if (forceUpload) {
        console.log('   ⚠️  강제 업로드 모드');
    }
    await uploadDailySummariesToR2(mergedRecords, bucketName, { forceUpload });
    await uploadIndexToR2(mergedRecords, bucketName);
    console.log();

    console.log('✅ 동기화 완료!');
    console.log(`   총 ${mergedRecords.length}개 요약 동기화됨`);
}

main().catch(error => {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
});
