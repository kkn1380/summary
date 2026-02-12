import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

// 색상 코드
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function separator(char = '━', length = 50) {
    console.log(char.repeat(length));
}

function executeCommand(command: string, description: string): boolean {
    try {
        log(`\n${description}`, 'yellow');
        separator();
        
        execSync(command, {
            stdio: 'inherit',
            cwd: process.cwd(),
        });
        
        return true;
    } catch (error) {
        log(`\n❌ 오류 발생: ${description}`, 'red');
        if (error instanceof Error) {
            log(error.message, 'red');
        }
        return false;
    }
}

async function main() {
    const startTime = Date.now();
    
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
    log('🚀 YouTube Summary 일일 동기화 시작', 'blue');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
    
    const steps = [
        {
            command: 'pnpm run sync:r2',
            description: '📥 1단계: R2 동기화 (다운로드 + 병합)',
            required: true,
        },
        {
            command: 'pnpm run monitor',
            description: '🎬 2단계: 새 영상 모니터링 + 요약 생성',
            required: true,
        },
        {
            command: 'pnpm run upload:r2',
            description: '☁️  3단계: R2 업로드 (변경된 것만)',
            required: true,
        },
    ];
    
    let successCount = 0;
    let failedStep: string | null = null;
    
    for (const step of steps) {
        const success = executeCommand(step.command, step.description);
        
        if (!success) {
            if (step.required) {
                failedStep = step.description;
                break;
            }
        } else {
            successCount++;
        }
    }
    
    const endTime = Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    console.log('');
    
    if (failedStep) {
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'red');
        log('❌ 작업 실패!', 'red');
        log(`   실패한 단계: ${failedStep}`, 'red');
        log(`   완료된 단계: ${successCount}/${steps.length}`, 'red');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'red');
        process.exit(1);
    } else {
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'green');
        log('✅ 모든 작업 완료!', 'green');
        log(`   소요 시간: ${minutes}분 ${seconds}초`, 'green');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'green');
        console.log('');
        log('📊 다음 단계:', 'blue');
        log('   - Cloudflare Pages가 자동으로 재배포됩니다', 'cyan');
        log('   - 약 1-2분 후 https://summary-30h.pages.dev 에서 확인 가능', 'cyan');
        console.log('');
    }
}

main().catch(error => {
    log('\n❌ 예상치 못한 오류 발생:', 'red');
    console.error(error);
    process.exit(1);
});
