import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const raw = execFileSync(executable, ['--yes', 'supabase@3.4.0', 'status', '--output', 'json'], { encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
const status = JSON.parse(raw);
if (!status.API_URL?.startsWith('http://127.0.0.1:') || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error('No hay una instancia local válida.');
const content = [
  `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.ANON_KEY}`,
  `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`,
  'APP_ORIGIN=http://127.0.0.1:3000',
].join('\n') + '\n';
writeFileSync('.env.local', content, { mode: 0o600 });
console.log('Entorno local preparado. No se han mostrado credenciales.');
