// Stop 훅: 작업이 끝났는데 커밋 안 된 변경이 남아 있으면 Claude를 한 번 멈춰 세워 커밋하게 한다.
// 커밋 메시지는 Claude가 직접 쓴다(포트폴리오용이라 자동 생성 메시지는 쓰지 않음).
const { execSync } = require('child_process');

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let payload = {};
  try { payload = JSON.parse(input || '{}'); } catch {}
  // 이미 한 번 막았는데도 멈추려는 경우엔 놓아준다(무한 루프 방지).
  if (payload.stop_hook_active) return;

  let dirty = '';
  try {
    dirty = execSync('git status --porcelain', {
      cwd: payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(),
      encoding: 'utf8',
    }).trim();
  } catch {
    return; // git 저장소가 아니거나 git이 없으면 아무것도 하지 않는다.
  }
  if (!dirty) return;

  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason:
      '커밋되지 않은 변경이 남아 있습니다:\n' + dirty +
      '\n\nCLAUDE.md의 "커밋 규칙"대로, 이번 작업에서 바꾼 파일을 의미 단위로 나눠 커밋하세요. ' +
      '내가 만들지 않은 변경으로 보이는 파일은 커밋하지 말고 사용자에게 알리세요.',
  }));
});
