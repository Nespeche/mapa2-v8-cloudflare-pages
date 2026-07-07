import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  NOW,
  SCHEMA_VERSION,
  rel,
  readJson,
  readText,
  writeJson,
  writeText,
  listFilesRecursive,
  fileBytes,
  sizeLabel,
  markdownTable
} from './v11a1_utils.mjs';

const errors = [];
const warnings = [];
const checks = [];

function ok(id, message, extra = {}) { checks.push({ id, status: 'OK', message, ...extra }); }
function warn(id, message, extra = {}) { warnings.push({ id, message, ...extra }); checks.push({ id, status: 'WARNING', message, ...extra }); }
function fail(id, message, extra = {}) { errors.push({ id, message, ...extra }); checks.push({ id, status: 'FAIL', message, ...extra }); }
function exists(relPath) { return fs.existsSync(rel(...relPath.split('/'))); }

const requiredFiles = [
  'migrations/0002_v11a1_api_read_optimization.sql',
  'data/d1/v11a1_read_models.sql',
  'data/d1/v11a1_read_models_summary.json',
  'data/d1/static_cache_summary.json',
  'data/d1/v11a1_api_read_budget_report.json',
  'data/d1/v11a1_query_plan_checks.sql',
  'data/d1/v11a1_query_plan_report.json',
  'public/data/api-cache/metadata.json',
  'public/data/api-cache/provinces.json',
  'public/data/api-cache/localities_by_province/index.json',
  'public/data/api-cache/products.json',
  'public/data/api-cache/periods.json',
  'public/data/api-cache/cache_manifest.json',
  'docs/V11A1_OPTIMIZATION_PLAN.md',
  'docs/V11A1_READ_MODELS.md',
  'docs/V11A1_STATIC_CACHE.md',
  'docs/V11A1_API_READ_BUDGET.md',
  'docs/V11A1_QUERY_PLAN_AUDIT.md',
  'docs/V11A1_CLOUDFLARE_FREE_STRATEGY.md',
  'docs/V11A1_GITHUB_STEPS.md',
  'docs/V11A1_CLOUDFLARE_STEPS.md',
  'docs/V11A1_ROLLBACK.md',
  'docs/V11A1_CHANGELOG.md',
  'docs/V11B_PREPARATION_NOTES.md'
];
for (const file of requiredFiles) {
  if (exists(file)) ok(`file:${file}`, `Existe ${file}`);
  else fail(`file:${file}`, `Falta ${file}`);
}

const pkg = readJson(rel('package.json'));
for (const scriptName of ['data:d1:readmodels', 'data:api-cache:build', 'audit:api-budget', 'audit:query-plans', 'validate:v11a1']) {
  if (pkg.scripts?.[scriptName]) ok(`package-script:${scriptName}`, `package.json contiene ${scriptName}`);
  else fail(`package-script:${scriptName}`, `package.json no contiene ${scriptName}`);
}

const migration = exists('migrations/0002_v11a1_api_read_optimization.sql') ? readText(rel('migrations', '0002_v11a1_api_read_optimization.sql')) : '';
const requiredTables = ['api_province_summary', 'api_locality_summary', 'api_locality_month_summary', 'api_locality_top_products', 'api_locality_client_metrics', 'api_client_sales_summary', 'api_query_budget'];
for (const table of requiredTables) {
  if (migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) ok(`schema-table:${table}`, `Migración crea ${table}`);
  else fail(`schema-table:${table}`, `Migración no crea ${table}`);
}
const requiredIndexes = [
  'idx_api_province_summary_slug',
  'idx_api_locality_summary_province',
  'idx_api_locality_summary_province_name',
  'idx_api_locality_month_locality_period',
  'idx_api_locality_month_province_period',
  'idx_api_locality_top_products_loc_rank',
  'idx_api_locality_client_loc_rank',
  'idx_api_client_sales_locality',
  'idx_api_query_budget_endpoint'
];
for (const idx of requiredIndexes) {
  if (migration.includes(idx)) ok(`schema-index:${idx}`, `Migración crea índice ${idx}`);
  else fail(`schema-index:${idx}`, `Falta índice ${idx}`);
}
const forbiddenSql = [
  { token: 'SERIAL', pattern: /\bSERIAL\b/i },
  { token: 'JSONB', pattern: /\bJSONB\b/i },
  { token: 'GEOMETRY', pattern: /\bGEOMETRY\b/i },
  { token: 'GEOGRAPHY', pattern: /\bGEOGRAPHY\b/i },
  { token: 'ST_*', pattern: /\bST_[A-Z0-9_]+\s*\(/i },
  { token: 'ILIKE', pattern: /\bILIKE\b/i }
];
for (const { token, pattern } of forbiddenSql) {
  if (pattern.test(migration)) fail(`schema-forbidden:${token}`, `Migración contiene sintaxis no D1: ${token}`);
  else ok(`schema-forbidden:${token}`, `Migración no contiene ${token}`);
}
if (/DROP\s+TABLE/i.test(migration)) fail('schema-drop-table', 'Migración contiene DROP TABLE');
else ok('schema-drop-table', 'Migración no contiene DROP TABLE');

const readSummary = exists('data/d1/v11a1_read_models_summary.json') ? readJson(rel('data', 'd1', 'v11a1_read_models_summary.json')) : null;
const seedSummary = exists('data/d1/seed_summary.json') ? readJson(rel('data', 'd1', 'seed_summary.json')) : null;
if (readSummary && seedSummary) {
  const expected = seedSummary.table_counts ?? {};
  const counts = readSummary.table_counts ?? {};
  if (counts.api_province_summary === expected.province) ok('data-province-count', `api_province_summary=${counts.api_province_summary}`); else fail('data-province-count', `Provincias esperadas ${expected.province}, obtenidas ${counts.api_province_summary}`);
  if (counts.api_locality_summary === expected.locality) ok('data-locality-count', `api_locality_summary=${counts.api_locality_summary}`); else fail('data-locality-count', `Localidades esperadas ${expected.locality}, obtenidas ${counts.api_locality_summary}`);
  if (counts.api_locality_client_metrics === expected.client) ok('data-client-metrics-count', `api_locality_client_metrics=${counts.api_locality_client_metrics}`); else fail('data-client-metrics-count', `Clientes esperados ${expected.client}, obtenidos ${counts.api_locality_client_metrics}`);
  if (counts.api_client_sales_summary === expected.client) ok('data-client-summary-count', `api_client_sales_summary=${counts.api_client_sales_summary}`); else fail('data-client-summary-count', `Summaries cliente esperados ${expected.client}, obtenidos ${counts.api_client_sales_summary}`);
  if ((readSummary.source_counts?.product ?? 0) === expected.product) ok('data-product-count', `Productos=${readSummary.source_counts.product}`); else fail('data-product-count', `Productos esperados ${expected.product}, obtenidos ${readSummary.source_counts?.product}`);
  if ((readSummary.source_counts?.sale_monthly_csv_rows ?? 0) === expected.sale_monthly) ok('data-sales-count', `Ventas preservadas=${readSummary.source_counts.sale_monthly_csv_rows}`); else fail('data-sales-count', `Ventas esperadas ${expected.sale_monthly}, obtenidas ${readSummary.source_counts?.sale_monthly_csv_rows}`);
  if (readSummary.business_integrity?.synthetic_rows_preserved) ok('data-synthetic-flag', 'Datos sintéticos preservados/documentados'); else fail('data-synthetic-flag', 'No consta preservación de dato sintético');
}

const cacheManifest = exists('public/data/api-cache/cache_manifest.json') ? readJson(rel('public', 'data', 'api-cache', 'cache_manifest.json')) : null;
if (cacheManifest) {
  if (cacheManifest.file_count >= 29) ok('cache-file-count', `Cache contiene ${cacheManifest.file_count} archivos`); else fail('cache-file-count', `Cache contiene pocos archivos: ${cacheManifest.file_count}`);
  if (cacheManifest.warnings?.length) warn('cache-size-warning', `Cache con advertencias de tamaño: ${cacheManifest.warnings.length}`, { warnings: cacheManifest.warnings });
  else ok('cache-size-warning', 'Cache sin advertencias de tamaño');
}
const provincesCache = exists('public/data/api-cache/provinces.json') ? readJson(rel('public', 'data', 'api-cache', 'provinces.json')) : null;
if (provincesCache?.records?.length) ok('cache-provinces-not-empty', `provinces.json filas=${provincesCache.records.length}`); else fail('cache-provinces-not-empty', 'provinces.json vacío');
const indexCache = exists('public/data/api-cache/localities_by_province/index.json') ? readJson(rel('public', 'data', 'api-cache', 'localities_by_province', 'index.json')) : null;
if (indexCache?.records?.length) {
  ok('cache-locality-index-not-empty', `index localidades filas=${indexCache.records.length}`);
  for (const row of indexCache.records) {
    if (!exists(`public/data/api-cache/${row.file}`)) fail(`cache-locality-file:${row.file}`, `Falta ${row.file}`);
  }
} else fail('cache-locality-index-not-empty', 'localities_by_province/index.json vacío');
const productsText = exists('public/data/api-cache/products.json') ? readText(rel('public', 'data', 'api-cache', 'products.json')) : '';
if (/venta_id|ventas_mensuales|sale_monthly/i.test(productsText)) fail('cache-products-raw-sales', 'products.json contiene indicios de ventas crudas'); else ok('cache-products-raw-sales', 'products.json no contiene ventas crudas');
const cacheFiles = exists('public/data/api-cache') ? listFilesRecursive(rel('public', 'data', 'api-cache')) : [];
let geometryLeak = false;
for (const file of cacheFiles) {
  const text = readText(file);
  if (/"coordinates"\s*:|FeatureCollection|Polygon|MultiPolygon/i.test(text)) geometryLeak = true;
}
if (geometryLeak) fail('cache-heavy-geometry', 'Cache contiene indicios de geometría pesada'); else ok('cache-heavy-geometry', 'Cache no contiene geometrías pesadas');

const budget = exists('data/d1/v11a1_api_read_budget_report.json') ? readJson(rel('data', 'd1', 'v11a1_api_read_budget_report.json')) : null;
if (budget?.endpoints?.length === 11) ok('budget-endpoint-count', 'Presupuesto cubre 11 endpoints'); else fail('budget-endpoint-count', 'Presupuesto no cubre 11 endpoints');
if (budget?.status === 'BLOCKED') fail('budget-status', 'API budget está BLOCKED'); else ok('budget-status', `API budget status=${budget?.status}`);

const queryPlan = exists('data/d1/v11a1_query_plan_report.json') ? readJson(rel('data', 'd1', 'v11a1_query_plan_report.json')) : null;
if (queryPlan?.status === 'BLOCKED') fail('query-plan-status', 'Query plan audit está BLOCKED'); else ok('query-plan-status', `Query plan status=${queryPlan?.status}`);
if (queryPlan?.checks?.some((c) => c.id === 'territory_alias_like' && c.status === 'WARNING')) warn('query-plan-like-warning', 'LIKE territorial queda como WARNING controlado con LIMIT');

const allFiles = listFilesRecursive(ROOT);
const forbiddenFiles = [];
const localExclusionDirs = new Set();
for (const file of allFiles) {
  const relPath = path.relative(ROOT, file).replaceAll(path.sep, '/');
  const base = path.basename(file);
  if (relPath.startsWith('node_modules/')) localExclusionDirs.add('node_modules/');
  if (relPath.startsWith('dist/')) localExclusionDirs.add('dist/');
  if (relPath.startsWith('.git/')) localExclusionDirs.add('.git/');
  if (relPath.startsWith('.wrangler/')) localExclusionDirs.add('.wrangler/');
  if (base === '.env') forbiddenFiles.push(relPath);
  if (/\.(sqlite|sqlite3|db|zip)$/i.test(base)) forbiddenFiles.push(relPath);
}
if (forbiddenFiles.length) fail('forbidden-files', `Archivos prohibidos detectados: ${forbiddenFiles.slice(0, 10).join(', ')}`, { forbiddenFiles });
else ok('forbidden-files', 'No hay .env, .sqlite, .db ni .zip internos');
if (localExclusionDirs.size) warn('local-exclusion-dirs', `Directorios locales presentes y excluidos del ZIP final: ${[...localExclusionDirs].join(', ')}`);
else ok('local-exclusion-dirs', 'No hay node_modules/dist/.git/.wrangler locales');

const readModelsSql = exists('data/d1/v11a1_read_models.sql') ? readText(rel('data', 'd1', 'v11a1_read_models.sql')) : '';
if (/SELECT\s+\*\s+FROM\s+sale_monthly/i.test(readModelsSql)) fail('readmodel-sale-fullscan', 'Read model SQL recomienda SELECT * FROM sale_monthly'); else ok('readmodel-sale-fullscan', 'Read model SQL no recomienda full scan sobre sale_monthly');
if (/geometry_json\s*[^,)]*\{|FeatureCollection|MultiPolygon/i.test(readModelsSql)) warn('readmodel-geometry-json', 'Revisar posible texto de geometría en SQL generado'); else ok('readmodel-geometry-json', 'Read models no incluyen geometrías pesadas');

const commandLogSpecs = [
  ['npm install', '00_npm_install.log'],
  ['npm run data:d1:build', '01_data_d1_build.log'],
  ['npm run data:d1:validate', '02_data_d1_validate.log'],
  ['npm run data:d1:readmodels', '03_readmodels.log'],
  ['npm run data:api-cache:build', '04_api_cache.log'],
  ['npm run audit:d1', '05_audit_d1.log'],
  ['npm run audit:api-budget', '06_api_budget.log'],
  ['npm run audit:query-plans', '07_query_plans.log'],
  ['npm run build', '08_build.log'],
  ['npm run validate:v11a', '09_validate_v11a.log'],
  ['npm run validate:v11a1', '10_validate_v11a1.log']
];
const commandRows = commandLogSpecs.map(([command, file]) => {
  const filePath = rel('data', 'd1', 'validation_logs', file);
  if (!fs.existsSync(filePath)) return { command, status: 'PENDING', log: `data/d1/validation_logs/${file}` };
  const text = readText(filePath);
  const failed = /\bERR!\b|BLOCKED|FAIL|failed with status|Command failed/i.test(text);
  const warning = /WARNING|WARN|Advertencias|OK_WITH_WARNINGS/i.test(text);
  return { command, status: failed ? 'FAIL' : (warning ? 'WARNING' : 'OK'), log: `data/d1/validation_logs/${file}` };
});

const result = {
  project: 'Mapa 2',
  phase: 'V11A.1 validation',
  generated_at: NOW,
  schema_version: SCHEMA_VERSION,
  status: errors.length ? 'FAIL' : (warnings.length ? 'OK_WITH_WARNINGS' : 'OK'),
  errors,
  warnings,
  checks,
  summary: {
    required_files_checked: requiredFiles.length,
    cache_files: cacheFiles.length,
    cache_total_size: cacheManifest?.total_size,
    read_model_sql_size: exists('data/d1/v11a1_read_models.sql') ? sizeLabel(fileBytes(rel('data', 'd1', 'v11a1_read_models.sql'))) : null
  }
};
writeJson(rel('data', 'd1', 'v11a1_validation_report.json'), result);

const visibleChecks = checks.map((c) => ({ id: c.id, status: c.status, message: c.message }));
const doc = `# V11A.1 — Validation\n\n` +
`Generado: ${NOW}\n\n` +
`## Estado\n\n${result.status}\n\n` +
`## Resumen\n\n` +
`- Errores: ${errors.length}\n` +
`- Advertencias: ${warnings.length}\n` +
`- Checks ejecutados: ${checks.length}\n` +
`- Tamaño SQL read models: ${result.summary.read_model_sql_size}\n` +
`- Tamaño cache estático: ${result.summary.cache_total_size ?? 'pendiente'}\n\n` +
`## Comandos recomendados de validación completa\n\n\`\`\`powershell\n` +
`npm install\n` +
`npm run data:d1:build\n` +
`npm run data:d1:validate\n` +
`npm run data:d1:readmodels\n` +
`npm run data:api-cache:build\n` +
`npm run audit:d1\n` +
`npm run audit:api-budget\n` +
`npm run audit:query-plans\n` +
`npm run build\n` +
`npm run validate:v11a\n` +
`npm run validate:v11a1\n` +
`\`\`\`\n\n` +
`## Resultados observados en esta entrega\n\n${markdownTable(commandRows, [
  { key: 'command', label: 'Comando' },
  { key: 'status', label: 'Estado' },
  { key: 'log', label: 'Log' }
])}\n\n` +
`## Checks\n\n${markdownTable(visibleChecks, [
  { key: 'id', label: 'Check' },
  { key: 'status', label: 'Estado' },
  { key: 'message', label: 'Mensaje' }
])}\n\n` +
`## Advertencias\n\n${warnings.length ? markdownTable(warnings.map((w) => ({ id: w.id, message: w.message })), [{ key: 'id', label: 'Warning' }, { key: 'message', label: 'Mensaje' }]) : 'Sin advertencias.'}\n\n` +
`## Errores\n\n${errors.length ? markdownTable(errors.map((e) => ({ id: e.id, message: e.message })), [{ key: 'id', label: 'Error' }, { key: 'message', label: 'Mensaje' }]) : 'Sin errores bloqueantes.'}\n`;
writeText(rel('docs', 'V11A1_VALIDATION.md'), doc);

if (errors.length) {
  console.error(`[V11A.1] Validación FAIL: ${errors.length} errores, ${warnings.length} advertencias.`);
  process.exit(1);
}
console.log(`[V11A.1] Validación ${result.status}: ${warnings.length} advertencias, ${checks.length} checks.`);
