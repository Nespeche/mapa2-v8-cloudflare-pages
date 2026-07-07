import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docsDir = path.join(root, 'docs');
fs.mkdirSync(docsDir, { recursive: true });

const requiredFiles = [
  'package.json', '.gitignore', '.npmrc', '.node-version', 'Makefile', 'vite.config.ts',
  'public/_headers', 'src/app/App.tsx', 'src/app/main.tsx', 'src/app/styles.css',
  'src/components/MapView.tsx', 'src/components/KpiCards.tsx', 'src/data/dataClient.ts',
  'src/data/dataPaths.ts', 'src/data/dataManifest.ts', 'src/data/dataValidators.ts',
  'src/domain/appVersion.ts', 'src/domain/businessContracts.ts', 'src/domain/geoContracts.ts',
  'src/domain/dataContracts.ts', 'src/services/commercialMetrics.ts', 'src/services/filterEngine.ts',
  'src/services/geoEnrichment.ts', 'src/utils/aggregations.ts', 'src/types/business.ts',
  'src/types/geo.ts', 'scripts/check_cloudflare_dist.mjs', 'scripts/audit_dist_v10.mjs',
  'scripts/check_v10_client_counts.mjs', 'scripts/check_data_contracts.mjs',
  'scripts/check_business_contracts.mjs', 'scripts/check_geo_contracts.mjs',
  'scripts/check_map_smoke_v10_3.mjs', 'scripts/lib/contract_helpers.mjs',
  'docs/ARCHITECTURE_V10_3.md', 'docs/DATA_CONTRACTS_V10_3.md',
  'docs/ANTI_REGRESSION_CHECKLIST_V10_3.md', 'docs/VALIDATION_LOG_V10_3.md',
  'docs/CHANGELOG_V10_3.md', 'docs/PROJECT_CONTEXT.md', 'SKILL.md', 'README.md',
  'public/data/business/metadata_business_v6.json', 'public/data/business/clientes.geojson',
  'public/data/business/ventas_mensuales.csv', 'public/data/provincias.geojson',
  'public/data/indexes/provincias_index.json', 'tools/python/requirements.txt',
];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function sizeMiB(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(4));
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appVersion = fs.readFileSync(path.join(root, 'src/domain/appVersion.ts'), 'utf8');
const missingRequiredFiles = requiredFiles.filter((file) => !exists(file));
const rootRequirementsExists = exists('requirements.txt');
const toolsRequirementsExists = exists('tools/python/requirements.txt');
const functionsDirExists = fs.existsSync(path.join(root, 'functions'));
const workerConfigExists = ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc'].some(exists);

const distFiles = walk(path.join(root, 'dist'));
const distAssets = distFiles.map((file) => {
  const stat = fs.statSync(file);
  return {
    path: path.relative(path.join(root, 'dist'), file).replaceAll(path.sep, '/'),
    bytes: stat.size,
    mib: sizeMiB(stat.size),
  };
}).sort((a, b) => b.bytes - a.bytes);

const deployBlocklistPatterns = [
  /^node_modules\//,
  /^dist\//,
  /^data\/raw\//,
  /^\.env$/,
  /\.(zip|gpkg|sqlite|db)$/i,
];

const workingFiles = walk(root).map((file) => path.relative(root, file).replaceAll(path.sep, '/'));
const dangerousTrackedCandidates = workingFiles.filter((rel) => deployBlocklistPatterns.some((pattern) => pattern.test(rel)));

const findings = [];
if (missingRequiredFiles.length) findings.push(`Faltan archivos obligatorios: ${missingRequiredFiles.join(', ')}`);
if (rootRequirementsExists) findings.push('requirements.txt sigue en raíz; Cloudflare podría ejecutar pip install innecesario.');
if (!toolsRequirementsExists) findings.push('No existe tools/python/requirements.txt para aislar dependencias ETL.');
if (!String(pkg.version).startsWith('10.0.4')) findings.push(`package.json version esperado 10.0.4, recibido ${pkg.version}`);
if (!appVersion.includes("APP_VERSION = 'V10.4'")) findings.push('src/domain/appVersion.ts no expone APP_VERSION V10.4.');
if (functionsDirExists || workerConfigExists) findings.push('Hay indicios de backend Cloudflare implementado; V10.4 no debe implementarlo.');
if (distAssets.some((asset) => asset.bytes > 25 * 1024 * 1024)) findings.push('Hay assets en dist mayores a 25 MiB.');

const report = {
  phase: 'V10.4 — Decisión de arquitectura de carga de datos y backend',
  base: 'V10.3 — Estabilización, contratos de datos y anti-regresión aprobada',
  timestamp_utc: new Date().toISOString(),
  package: {
    name: pkg.name,
    version: pkg.version,
    scripts: Object.keys(pkg.scripts ?? {}).sort(),
    dependencies: pkg.dependencies ?? {},
    devDependencies: pkg.devDependencies ?? {},
  },
  required_files: {
    checked: requiredFiles.length,
    missing: missingRequiredFiles,
  },
  backend_status: {
    implemented: false,
    functions_dir_exists: functionsDirExists,
    worker_config_exists: workerConfigExists,
    decision: 'No se implementa backend en V10.4; se documenta la decisión y criterios de adopción.',
  },
  python_etl: {
    root_requirements_exists: rootRequirementsExists,
    tools_requirements_exists: toolsRequirementsExists,
    recommendation: 'Mantener dependencias Python en tools/python/requirements.txt para que Cloudflare Pages build frontend no ejecute pip install.',
  },
  dist: {
    exists: fs.existsSync(path.join(root, 'dist')),
    files: distAssets.length,
    total_mib: sizeMiB(distAssets.reduce((sum, asset) => sum + asset.bytes, 0)),
    largest_asset: distAssets[0] ?? null,
    top_20_assets: distAssets.slice(0, 20),
    assets_over_25_mib: distAssets.filter((asset) => asset.bytes > 25 * 1024 * 1024),
  },
  deploy_safety_candidates_present_in_zip_or_worktree: dangerousTrackedCandidates.slice(0, 100),
  findings,
  status: findings.length === 0 ? 'OK' : 'WARN',
};

const jsonPath = path.join(docsDir, 'ARCHITECTURE_AUDIT_V10_4.json');
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

const md = `# Mapa 2 — Auditoría de arquitectura V10.4

**Fase:** ${report.phase}  
**Base:** ${report.base}  
**Fecha UTC:** ${report.timestamp_utc}

## Resultado

**Estado:** ${report.status}

${findings.length ? findings.map((finding) => `- ${finding}`).join('\n') : '- Sin hallazgos bloqueantes.'}

## Estructura crítica revisada

- Archivos obligatorios revisados: ${report.required_files.checked}
- Archivos faltantes: ${report.required_files.missing.length ? report.required_files.missing.join(', ') : '0'}
- Backend implementado: no
- Directorio \`functions/\`: ${functionsDirExists ? 'presente' : 'ausente'}
- Configuración Wrangler: ${workerConfigExists ? 'presente' : 'ausente'}

## Build / dist

- \`dist\` existe: ${report.dist.exists ? 'sí' : 'no'}
- Archivos en \`dist\`: ${report.dist.files}
- Tamaño total \`dist\`: ${report.dist.total_mib} MiB
- Mayor asset: ${report.dist.largest_asset ? `${report.dist.largest_asset.path} (${report.dist.largest_asset.mib} MiB)` : 'N/D'}
- Assets > 25 MiB: ${report.dist.assets_over_25_mib.length}

## Top 20 assets

${report.dist.top_20_assets.length ? report.dist.top_20_assets.map((asset, index) => `${index + 1}. \`${asset.path}\` — ${asset.mib} MiB`).join('\n') : 'N/D: ejecutar npm run build antes de esta auditoría.'}

## Python / ETL

- \`requirements.txt\` en raíz: ${rootRequirementsExists ? 'sí' : 'no'}
- \`tools/python/requirements.txt\`: ${toolsRequirementsExists ? 'sí' : 'no'}
- Decisión: las dependencias Python quedan fuera de la raíz para evitar que Cloudflare Pages ejecute \`pip install -r requirements.txt\` en un deploy frontend estático.

## Seguridad de deploy

El ZIP puede conservar artefactos históricos para trazabilidad. Para GitHub/Cloudflare, seguir usando \`.gitignore\` y los filtros documentados para no subir \`node_modules/\`, \`dist/\`, \`.env\`, \`.zip\`, \`.gpkg\`, \`.sqlite\`, \`.db\`, \`data/raw/\` ni outputs pesados innecesarios.
`;
fs.writeFileSync(path.join(docsDir, 'ARCHITECTURE_AUDIT_V10_4.md'), md, 'utf8');

console.log('[audit-architecture-v10.4] Reportes generados:');
console.log('  - docs/ARCHITECTURE_AUDIT_V10_4.json');
console.log('  - docs/ARCHITECTURE_AUDIT_V10_4.md');
console.log(`[audit-architecture-v10.4] status=${report.status} dist=${report.dist.total_mib} MiB files=${report.dist.files}`);
if (findings.length) {
  for (const finding of findings) console.warn(`  - ${finding}`);
}
