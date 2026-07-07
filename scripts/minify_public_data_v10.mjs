import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const dataDir = join(root, 'public', 'data');
const targetExtensions = new Set(['.json', '.geojson']);
const report = {
  phase: 'V10 — optimización lossless de datos públicos',
  generated_at: new Date().toISOString(),
  strategy: 'JSON.parse + JSON.stringify sin espacios; no modifica valores, geometrías ni registros canónicos.',
  files_processed: 0,
  files_failed: [],
  before_bytes: 0,
  after_bytes: 0,
  saved_bytes: 0,
  items: [],
};

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    if (entry.isFile()) files.push(absolute);
  }
  return files;
}

if (!existsSync(dataDir)) {
  console.error('[data:minify] ERROR: no existe public/data.');
  process.exit(1);
}

for (const file of walk(dataDir)) {
  if (!targetExtensions.has(extname(file).toLowerCase())) continue;
  const rel = toPosix(relative(root, file));
  const before = statSync(file).size;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    const minified = JSON.stringify(parsed);
    writeFileSync(file, `${minified}\n`, 'utf8');
    const after = statSync(file).size;
    report.files_processed += 1;
    report.before_bytes += before;
    report.after_bytes += after;
    report.items.push({ path: rel, before_bytes: before, after_bytes: after, saved_bytes: before - after });
  } catch (error) {
    report.files_failed.push({ path: rel, error: error instanceof Error ? error.message : String(error) });
  }
}

report.saved_bytes = report.before_bytes - report.after_bytes;
report.items.sort((a, b) => b.saved_bytes - a.saved_bytes);

const reportPath = join(root, 'docs', 'DATA_MINIFY_AUDIT_V10.json');
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log('[data:minify] Optimización lossless completada');
console.log(`[data:minify] Archivos procesados: ${report.files_processed}`);
console.log(`[data:minify] Ahorro: ${(report.saved_bytes / 1024 / 1024).toFixed(2)} MiB`);
if (report.files_failed.length > 0) {
  console.error('[data:minify] Archivos con error:');
  for (const item of report.files_failed) console.error(`  - ${item.path}: ${item.error}`);
  process.exit(1);
}
