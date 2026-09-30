import { spawnSync } from 'node:child_process';

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  const filePath = JSON.parse(input).tool_input?.file_path ?? '';
  if (!/\.(ts|mjs)$/.test(filePath)) return;

  const result = spawnSync('npx', ['eslint', '--fix', filePath], { encoding: 'utf8', shell: true });
  if (result.status === 0) return;

  process.stderr.write(result.stdout + result.stderr);
  process.exit(2);
});
