// Main app uses existing local credentials; fixture/export isolation must not
// accidentally disable .env loading here. Never write credentials into source.
const { spawn } = require('node:child_process');
const path = require('node:path');
const env = { ...process.env };
delete env.EXPO_NO_DOTENV;
delete env.EXPO_PUBLIC_COACHIE_DESIGN_PREVIEW;
const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), 'start', '--web', '--offline', '--port', '8083'], {
  cwd: path.resolve(__dirname, '..'), stdio: 'inherit', env,
});
child.on('exit', code => process.exit(code ?? 0));
