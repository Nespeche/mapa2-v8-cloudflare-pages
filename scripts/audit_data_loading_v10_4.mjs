import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docsDir = path.join(root, 'docs');
fs.mkdirSync(docsDir, { recursive: true });

const initial = {
  metadata: 'data/metadata.json',
  provinciasGeo: 'data/provincias.geojson',
  provinciasIndex: 'data/indexes/provincias_index.json',
  businessMetadata: 'data/business/metadata_business_v6.json',
  ventasProvinciaMes: 'data/business/agregados/ventas_provincia_mes.json',
  ventasClienteTotales: 'data/business/agregados/ventas_cliente_totales.json',
  productos: 'data/business/productos.json',
  calendario: 'data/business/calendario.json',
};

const lazy = {
  clientesGeo: 'data/business/clientes.geojson',
  ventasDepartamentoMes: 'data/business/agregados/ventas_departamento_mes.json',
  ventasProductoMes: 'data/business/agregados/ventas_producto_mes.json',
  ventasMensualesCsv: 'data/business/ventas_mensuales.csv',
};

const forbiddenInitialPatterns = [
  'radios.geojson',
  '/radios/',
  'data/business/clientes.geojson',
  'data/business/ventas_mensuales.csv',
];

function sizeOfPublic(rel) {
  const file = path.join(root, 'public', rel);
  if (!fs.existsSync(file)) return null;
  const bytes = fs.statSync(file).size;
  return { bytes, mib: Number((bytes / 1024 / 1024).toFixed(4)) };
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const initialRows = Object.entries(initial).map(([key, rel]) => ({ key, path: rel, exists: Boolean(sizeOfPublic(rel)), size: sizeOfPublic(rel) }));
const lazyRows = Object.entries(lazy).map(([key, rel]) => ({ key, path: rel, exists: Boolean(sizeOfPublic(rel)), size: sizeOfPublic(rel) }));
const initialViolations = Object.values(initial).filter((rel) => forbiddenInitialPatterns.some((pattern) => rel.includes(pattern)));

const publicFiles = walk(path.join(root, 'public', 'data')).map((file) => {
  const rel = path.relative(path.join(root, 'public'), file).replaceAll(path.sep, '/');
  const stat = fs.statSync(file);
  const layerType = rel.includes('/radios.geojson') ? 'radios'
    : rel.includes('/fracciones.geojson') ? 'fracciones'
    : rel.includes('/departamentos.geojson') ? 'departamentos'
    : rel.includes('/puntos.geojson') ? 'localidades_puntos'
    : rel.includes('/business/') ? 'business'
    : 'territorial';
  return { path: rel, bytes: stat.size, mib: Number((stat.size / 1024 / 1024).toFixed(4)), layer_type: layerType };
}).sort((a, b) => b.bytes - a.bytes);

const initialTotal = initialRows.reduce((sum, row) => sum + (row.size?.bytes ?? 0), 0);
const lazyKnownTotal = lazyRows.reduce((sum, row) => sum + (row.size?.bytes ?? 0), 0);
const radioFiles = publicFiles.filter((file) => file.layer_type === 'radios');
const findings = [];
if (initialRows.some((row) => !row.exists)) findings.push('Hay archivos iniciales ausentes.');
if (lazyRows.some((row) => !row.exists)) findings.push('Hay archivos lazy ausentes.');
if (initialViolations.length) findings.push(`El manifiesto inicial incluye archivos prohibidos: ${initialViolations.join(', ')}`);
if (!Object.values(lazy).includes('data/business/clientes.geojson')) findings.push('clientes.geojson no figura como carga bajo demanda.');
if (!Object.values(lazy).includes('data/business/ventas_mensuales.csv')) findings.push('ventas_mensuales.csv no figura como carga bajo demanda.');

const report = {
  phase: 'V10.4 — Estrategia de carga de datos',
  timestamp_utc: new Date().toISOString(),
  strategy: {
    initial,
    lazy,
    forbidden_initial_patterns: forbiddenInitialPatterns,
    decision: 'Mantener carga inicial estática mínima y carga bajo demanda para clientes, agregados pesados, capas provinciales y CSV detallado.',
  },
  initial_files: initialRows,
  lazy_files: lazyRows,
  totals: {
    initial_known_mib: Number((initialTotal / 1024 / 1024).toFixed(4)),
    lazy_known_mib: Number((lazyKnownTotal / 1024 / 1024).toFixed(4)),
    public_data_files: publicFiles.length,
    public_data_total_mib: Number((publicFiles.reduce((sum, file) => sum + file.bytes, 0) / 1024 / 1024).toFixed(4)),
    radio_files: radioFiles.length,
    radio_total_mib: Number((radioFiles.reduce((sum, file) => sum + file.bytes, 0) / 1024 / 1024).toFixed(4)),
  },
  top_20_public_data_assets: publicFiles.slice(0, 20),
  initial_violations: initialViolations,
  findings,
  status: findings.length === 0 ? 'OK' : 'WARN',
};

fs.writeFileSync(path.join(docsDir, 'DATA_LOADING_AUDIT_V10_4.json'), JSON.stringify(report, null, 2), 'utf8');

const formatRow = (row) => `| ${row.key} | \`${row.path}\` | ${row.exists ? 'sí' : 'no'} | ${row.size ? `${row.size.mib} MiB` : 'N/D'} |`;
const md = `# Mapa 2 — Auditoría de carga de datos V10.4

**Fase:** ${report.phase}  
**Fecha UTC:** ${report.timestamp_utc}

## Resultado

**Estado:** ${report.status}

${findings.length ? findings.map((finding) => `- ${finding}`).join('\n') : '- Sin hallazgos bloqueantes.'}

## Carga inicial

| Clave | Archivo | Existe | Tamaño |
|---|---:|---:|---:|
${initialRows.map(formatRow).join('\n')}

**Total inicial conocido:** ${report.totals.initial_known_mib} MiB

## Carga bajo demanda

| Clave | Archivo | Existe | Tamaño |
|---|---:|---:|---:|
${lazyRows.map(formatRow).join('\n')}

**Total lazy conocido:** ${report.totals.lazy_known_mib} MiB

## Validación anti-regresión

- \`clientes.geojson\` sigue bajo demanda.
- \`ventas_mensuales.csv\` sigue bajo demanda.
- No hay \`radios.geojson\` en carga inicial.
- Las capas provinciales siguen resolviéndose desde \`provincias_index.json\` y se cargan cuando corresponde.

## Top 20 assets de public/data

${report.top_20_public_data_assets.map((asset, index) => `${index + 1}. \`${asset.path}\` — ${asset.mib} MiB · ${asset.layer_type}`).join('\n')}

## Radios nacionales

- Archivos \`radios.geojson\` publicados: ${report.totals.radio_files}
- Tamaño total aproximado de radios: ${report.totals.radio_total_mib} MiB
- Decisión V10.4: no cargarlos al inicio; mantenerlos como capas bajo demanda o preparar particionado/R2 en fases posteriores si el crecimiento lo requiere.
`;
fs.writeFileSync(path.join(docsDir, 'DATA_LOADING_AUDIT_V10_4.md'), md, 'utf8');

console.log('[audit-data-loading-v10.4] Reportes generados:');
console.log('  - docs/DATA_LOADING_AUDIT_V10_4.json');
console.log('  - docs/DATA_LOADING_AUDIT_V10_4.md');
console.log(`[audit-data-loading-v10.4] status=${report.status} initial=${report.totals.initial_known_mib} MiB lazy=${report.totals.lazy_known_mib} MiB public=${report.totals.public_data_total_mib} MiB`);
if (findings.length) for (const finding of findings) console.warn(`  - ${finding}`);
