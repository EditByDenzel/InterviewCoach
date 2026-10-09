const { spawn } = require('node:child_process');
const path = require('node:path');
const cli = require.resolve('expo/bin/cli');
const child = spawn(process.execPath, [cli, 'start', '--web', '--offline', '--port', '8084'], {
  cwd: path.resolve(__dirname, '..'), stdio: 'inherit',
  env: { ...process.env, EXPO_NO_DOTENV: '1', EXPO_PUBLIC_COACHIE_DESIGN_PREVIEW: '1' },
});
child.on('exit', code => process.exit(code ?? 0));
