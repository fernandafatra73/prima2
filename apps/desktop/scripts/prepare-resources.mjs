// Menyiapkan apps/desktop/resources/server/ sebelum electron-builder dijalankan:
// build ulang API & web, salin hasilnya, buat ulang template.db (schema kosong +
// akun login default), lalu install dependency produksi server secara terpisah
// dari node_modules monorepo (supaya electron-builder tidak perlu menganalisis
// hoisting workspace npm).
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');
const apiDir = join(repoRoot, 'apps', 'api');
const webDir = join(repoRoot, 'apps', 'web');
const serverDir = join(__dirname, '..', 'resources', 'server');

function run(cmd, cwd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

console.log('1/5 Building API...');
run('npm run build -w @labprima/api', repoRoot);

console.log('2/5 Building web frontend...');
run('npm run build -w @labprima/web', repoRoot);

console.log('3/5 Copying build output into resources/server...');
rmSync(join(serverDir, 'build'), { recursive: true, force: true });
rmSync(join(serverDir, 'web-dist'), { recursive: true, force: true });
cpSync(join(apiDir, 'build'), join(serverDir, 'build'), { recursive: true });
cpSync(join(webDir, 'dist'), join(serverDir, 'web-dist'), { recursive: true });

console.log('4/5 Regenerating template.db (schema kosong + akun login default)...');
const templateDb = join(serverDir, 'template.db');
rmSync(templateDb, { force: true });
const templateDbUrl = `file:${templateDb.replace(/\\/g, '/')}`;
execSync('npx prisma migrate deploy', {
  cwd: apiDir,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: templateDbUrl },
});
execSync('npx tsx prisma/seedDesktopTemplate.ts', {
  cwd: apiDir,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: templateDbUrl },
});

console.log('5/5 Installing production dependencies for the bundled server...');
if (!existsSync(join(serverDir, 'package.json'))) {
  throw new Error('resources/server/package.json is missing');
}
rmSync(join(serverDir, 'node_modules'), { recursive: true, force: true });
run('npm install --omit=dev --no-audit --no-fund', serverDir);

console.log('Done. Run "npm run dist:win" in apps/desktop to package the .exe.');
