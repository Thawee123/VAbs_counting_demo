import { spawn } from 'node:child_process';

const commands = [
  ['model', 'npm', ['run', 'dev:model']],
  ['backend', 'npm', ['run', 'dev:be']],
  ['frontend', 'npm', ['run', 'dev:fe']],
];

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: process.env,
  });

  child.stdout.on('data', (data) => process.stdout.write(`[${name}] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[${name}] ${data}`));
  child.on('exit', (code) => {
    if (code && !process.exitCode) process.exitCode = code;
  });

  return child;
});

function shutdown() {
  for (const child of children) child.kill('SIGTERM');
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(130);
});
process.on('SIGTERM', shutdown);
