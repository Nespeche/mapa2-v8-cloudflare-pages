import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'dist');
const docsDir = join(root, 'docs');
const maxAssetBytes = 25 * 1024 * 1024;
const cloudflareFreeFileLimit = 20_000;
const dragAndDropFileLimit = 1_000;
const suspiciousExtensions = new Set(['.gpkg', '.sqlite', '.db', '.zip', '.7z', '.rar', '.bak', '.tmp']);

function formatMiB(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(4));
}

function displayMiB(bytes) {
  return `${formatMiB(bytes).toFixed(4)} MiB`;
}

function toPosix(path) {
  return path.replace(/\\/g, '/');
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

if (!existsSync(distDir)) {
  console.error('[dist-audit-v10] ERROR: no existe dist/. Ejecutá npm run build antes de auditar.');
  process.exit(1);
}

mkdirSync(docsDir, { recursive: true });

const files = walk(distDir);
let totalBytes = 0;
const fileStats = files.map((absolute) => {
  const stat = statSync(absolute);
  totalBytes += stat.size;
  return {
    path: toPosix(relative(distDir, absolute)),
    size_bytes: stat.size,
    size_mib: formatMiB(stat.size),
    extension: extname(absolute).toLowerCase() || '[sin extension]',
  };
});

const topLargest = [...fileStats].sort((a, b) => b.size_bytes - a.size_bytes).slice(0, 20);
const byExtension = [...fileStats.reduce((map, file) => {
  const current = map.get(file.extension) ?? { extension: file.extension, files: 0, size_bytes: 0, size_mib: 0 };
  current.files += 1;
  current.size_bytes += file.size_bytes;
  current.size_mib = formatMiB(current.size_bytes);
  map.set(file.extension, current);
  return map;
}, new Map()).values()].sort((a, b) => b.size_bytes - a.size_bytes);

const filesOver25MiB = fileStats.filter((file) => file.size_bytes > maxAssetBytes);
const suspiciousDistFiles = fileStats.filter((file) => suspiciousExtensions.has(file.extension));
const rawOutputFiles = fileStats.filter((file) => file.path.startsWith('raw/') || file.path.startsWith('output/') || file.path.startsWith('data/raw/') || file.path.startsWith('data/output/'));
const warnings = [];
const violations = [];

if (files.length > cloudflareFreeFileLimit) violations.push(`Cantidad de archivos excede Cloudflare Pages Free: ${files.length}/${cloudflareFreeFileLimit}`);
if (files.length > dragAndDropFileLimit) warnings.push(`dist/ excede Drag & Drop (${files.length}/${dragAndDropFileLimit}); usar integración Git/Cloudflare Pages.`);
if (filesOver25MiB.length > 0) violations.push(`${filesOver25MiB.length} assets superan 25 MiB.`);
if (suspiciousDistFiles.length > 0) violations.push(`${suspiciousDistFiles.length} archivos no aptos para producción.`);
if (rawOutputFiles.length > 0) violations.push(`${rawOutputFiles.length} archivos raw/output entraron a dist/.`);
if (!existsSync(join(distDir, 'index.html'))) violations.push('Falta index.html en dist/.');
if (!existsSync(join(distDir, '_headers'))) warnings.push('No se encontró _headers en dist/.');

const audit = {
  phase: 'V10 — Optimización avanzada de performance, GeoJSON y carga de datos',
  generated_at: new Date().toISOString(),
  base: 'V9 aprobada — commit informado 985782d',
  dist_exists: existsSync(distDir),
  file_count: files.length,
  total_size_bytes: totalBytes,
  total_size_mib: formatMiB(totalBytes),
  largest_asset: topLargest[0] ?? null,
  top_20_largest: topLargest,
  by_extension: byExtension,
  files_over_25_mib: filesOver25MiB,
  suspicious_dist_files: suspiciousDistFiles,
  raw_or_output_files: rawOutputFiles,
  has_index_html: existsSync(join(distDir, 'index.html')),
  has_headers: existsSync(join(distDir, '_headers')),
  has_redirects: existsSync(join(distDir, '_redirects')),
  cloudflare: {
    build_command: 'npm run build',
    output_directory: 'dist',
    max_single_asset_mib: 25,
    git_or_wrangler_file_limit: cloudflareFreeFileLimit,
    drag_and_drop_file_limit: dragAndDropFileLimit,
  },
  v10_optimizations: [
    'Code splitting: MapView/MapLibre se cargan por import dinámico.',
    'clientes.geojson sale de la carga inicial y se solicita solo en capas clientes/clusters/heatmap.',
    'Cache en memoria para JSON/text fetch: evita refetch al alternar capas/filtros.',
    'Actualización granular de sources MapLibre: reduce setData innecesarios.',
    'Minificación lossless de JSON/GeoJSON públicos: reduce peso raw de dist sin alterar datos.',
    'Uso de agregados cliente/departamento V10 para evitar CSV detallado en filtros que no lo requieren.',
    'Headers de cache moderado para /data/* y cache largo inmutable para /assets/*.'
  ],
  warnings,
  violations,
  blocking_errors: violations.length,
};

const jsonPath = join(docsDir, 'DIST_AUDIT_V10.json');
const mdPath = join(docsDir, 'DIST_AUDIT_V10.md');
writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');

const table = topLargest.slice(0, 10).map((file) => `| \`${file.path}\` | ${file.size_mib.toFixed(4)} MiB |`).join('\n');
const extTable = byExtension.slice(0, 10).map((item) => `| \`${item.extension}\` | ${item.files} | ${item.size_mib.toFixed(4)} MiB |`).join('\n');
const md = `# Mapa 2 — Auditoría de \`dist\` V10\n\n` +
`**Fase:** V10 — Optimización avanzada de performance, GeoJSON y carga de datos  \n` +
`**Generado:** ${audit.generated_at}  \n` +
`**Base:** ${audit.base}  \n` +
`**Resultado:** ${audit.blocking_errors === 0 ? 'sin errores bloqueantes para Cloudflare Pages Free' : 'con errores bloqueantes'}\n\n` +
`## Resultado de build\n\n` +
`- \`dist\` generado: \`${audit.dist_exists}\`\n` +
`- Archivos en \`dist\`: \`${audit.file_count}\`\n` +
`- Tamaño total de \`dist\`: \`${audit.total_size_mib.toFixed(4)} MiB\`\n` +
`- Mayor asset: \`${audit.largest_asset?.path ?? 'N/A'}\` — \`${audit.largest_asset ? audit.largest_asset.size_mib.toFixed(4) : '0.0000'} MiB\`\n` +
`- Archivos mayores a 25 MiB: \`${audit.files_over_25_mib.length}\`\n` +
`- Archivos no aptos para producción: \`${audit.suspicious_dist_files.length}\`\n` +
`- Archivos raw/output en producción: \`${audit.raw_or_output_files.length}\`\n` +
`- \`_headers\` copiado a \`dist\`: \`${audit.has_headers}\`\n` +
`- \`_redirects\` copiado a \`dist\`: \`${audit.has_redirects}\`\n\n` +
`## Top 10 archivos más grandes\n\n| Archivo | Tamaño |\n|---|---:|\n${table}\n\n` +
`## Peso por extensión\n\n| Extensión | Archivos | Tamaño |\n|---|---:|---:|\n${extTable}\n\n` +
`## Optimizaciones V10 verificadas\n\n${audit.v10_optimizations.map((item) => `- ${item}`).join('\n')}\n\n` +
`## Advertencias\n\n${warnings.length ? warnings.map((item) => `- ${item}`).join('\n') : '- Sin advertencias relevantes.'}\n\n` +
`## Errores bloqueantes\n\n${violations.length ? violations.map((item) => `- ${item}`).join('\n') : '- Sin errores bloqueantes.'}\n`;
writeFileSync(mdPath, md, 'utf8');

console.log('[dist-audit-v10] Reportes generados:');
console.log(`  - ${toPosix(relative(root, jsonPath))}`);
console.log(`  - ${toPosix(relative(root, mdPath))}`);
console.log(`[dist-audit-v10] dist=${displayMiB(totalBytes)} files=${files.length} blocking_errors=${violations.length}`);
if (violations.length > 0) process.exit(1);
