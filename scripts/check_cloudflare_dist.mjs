import { existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'dist');
const maxAssetBytes = 25 * 1024 * 1024;
const cloudflareFreeFileLimit = 20_000;
const dragAndDropFileLimit = 1_000;
const suspiciousExtensions = new Set(['.gpkg', '.sqlite', '.db', '.zip', '.7z', '.rar', '.bak', '.tmp']);
const violations = [];
const warnings = [];

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function toPosix(path) {
  return path.replace(/\\/g, '/');
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolute));
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }
  return files;
}

if (!existsSync(distDir)) {
  console.error('[cloudflare-check] ERROR: no existe dist/. Ejecutá npm run build antes de validar.');
  process.exit(1);
}

const files = walk(distDir);
if (files.length === 0) {
  console.error('[cloudflare-check] ERROR: dist/ está vacío.');
  process.exit(1);
}

let totalBytes = 0;
const fileStats = files.map((absolute) => {
  const stat = statSync(absolute);
  const rel = toPosix(relative(distDir, absolute));
  totalBytes += stat.size;
  return { absolute, rel, size: stat.size };
});

for (const file of fileStats) {
  if (file.size > maxAssetBytes) {
    violations.push(`Asset supera 25 MiB: ${file.rel} (${formatMiB(file.size)})`);
  }

  const ext = extname(file.rel).toLowerCase();
  if (suspiciousExtensions.has(ext)) {
    violations.push(`Archivo no apto para producción en dist/: ${file.rel}`);
  }

  if (file.rel.startsWith('raw/') || file.rel.startsWith('output/') || file.rel.startsWith('data/raw/') || file.rel.startsWith('data/output/')) {
    violations.push(`Directorio raw/output no debe entrar a dist/: ${file.rel}`);
  }
}

if (files.length > cloudflareFreeFileLimit) {
  violations.push(`Cantidad de archivos excede Cloudflare Pages Free: ${files.length}/${cloudflareFreeFileLimit}`);
}

if (files.length > dragAndDropFileLimit) {
  warnings.push(`dist/ excede el límite de Drag & Drop (${files.length}/${dragAndDropFileLimit}); usar Git integration o Wrangler.`);
}

if (!existsSync(join(distDir, 'index.html'))) {
  violations.push('Falta dist/index.html.');
}

if (!existsSync(join(distDir, '_headers'))) {
  warnings.push('No se encontró dist/_headers. Se recomienda public/_headers para headers básicos.');
}

if (existsSync(join(distDir, '_redirects'))) {
  const redirect = fileStats.find((file) => file.rel === '_redirects');
  if (redirect?.size === 0) warnings.push('dist/_redirects existe pero está vacío.');
} else {
  warnings.push('No se incluye _redirects: correcto para SPA completa en Cloudflare Pages si no existe 404.html.');
}

const largest = [...fileStats].sort((a, b) => b.size - a.size).slice(0, 10);

console.log('[cloudflare-check] OK: auditoría de dist completada');
console.log(`[cloudflare-check] Archivos en dist: ${files.length}`);
console.log(`[cloudflare-check] Tamaño total dist: ${formatMiB(totalBytes)}`);
console.log(`[cloudflare-check] Mayor asset: ${largest[0].rel} (${formatMiB(largest[0].size)})`);
console.log('[cloudflare-check] Top 10 archivos más grandes:');
for (const file of largest) {
  console.log(`  - ${file.rel}: ${formatMiB(file.size)}`);
}

if (warnings.length > 0) {
  console.log('[cloudflare-check] Advertencias:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (violations.length > 0) {
  console.error('[cloudflare-check] ERRORES BLOQUEANTES:');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log('[cloudflare-check] Sin errores bloqueantes para Cloudflare Pages Free.');
