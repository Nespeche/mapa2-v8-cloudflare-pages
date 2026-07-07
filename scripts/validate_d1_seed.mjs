import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const rel = (...parts) => path.join(ROOT, ...parts);
const bytes = (value) => Buffer.byteLength(value ?? '', 'utf8');
const now = new Date().toISOString();

const REQUIRED_TABLES = [
  'source_catalog',
  'province',
  'locality',
  'postal_code_area',
  'territorial_alias',
  'territorial_match_log',
  'census_population',
  'geometry_feature',
  'client',
  'product',
  'sale_monthly',
  'sales_aggregate_province_month',
  'sales_aggregate_locality_month',
  'sales_aggregate_product_month',
  'sales_aggregate_client_month',
  'app_metadata',
  'schema_migrations'
];

const REQUIRED_INDEXES = [
  'idx_province_slug',
  'idx_province_official_code',
  'idx_locality_province',
  'idx_locality_slug',
  'idx_locality_province_name',
  'idx_locality_official_code',
  'idx_locality_georef',
  'idx_locality_indec',
  'idx_postal_code_area_cp',
  'idx_postal_code_area_province',
  'idx_postal_code_area_locality',
  'idx_postal_code_area_prov_loc',
  'idx_alias_entity',
  'idx_alias_normalized',
  'idx_census_entity_year',
  'idx_census_province_locality',
  'idx_geometry_entity',
  'idx_geometry_province',
  'idx_geometry_locality',
  'idx_client_province',
  'idx_client_locality',
  'idx_client_postal_code',
  'idx_client_match_confidence',
  'idx_sale_client_period',
  'idx_sale_product_period',
  'idx_sale_period',
  'idx_agg_province_period',
  'idx_agg_locality_period',
  'idx_agg_product_period',
  'idx_agg_client_period'
];

const BANNED_SQL = [
  /\bSERIAL\b/i,
  /\bJSONB\b/i,
  /\bGEOMETRY\b/i,
  /\bST_[A-Z0-9_]+\s*\(/i,
  /\bILIKE\b/i,
  /\bCREATE\s+EXTENSION\b/i,
  /\bGENERATED\s+ALWAYS\s+AS\s+IDENTITY\b/i
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inSingle = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];
    current += ch;
    if (ch === "'") {
      if (inSingle && next === "'") {
        current += next;
        i += 1;
      } else {
        inSingle = !inSingle;
      }
    }
    if (ch === ';' && !inSingle) {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = '';
    }
  }
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

const errors = [];
const warnings = [];
const checks = [];

function check(name, ok, detail = null, level = 'error') {
  checks.push({ name, ok, detail, level });
  if (!ok && level === 'error') errors.push({ name, detail });
  if (!ok && level === 'warning') warnings.push({ name, detail });
}

const schemaPath = rel('migrations', '0001_schema.sql');
const seedPath = rel('data', 'd1', 'seed.sql');
const summaryPath = rel('data', 'd1', 'seed_summary.json');
const packagePath = rel('package.json');

check('migrations/0001_schema.sql existe', fs.existsSync(schemaPath));
check('data/d1/seed.sql existe', fs.existsSync(seedPath));
check('data/d1/seed_summary.json existe', fs.existsSync(summaryPath));
check('package.json existe', fs.existsSync(packagePath));

let schema = '';
let seed = '';
let summary = null;
if (fs.existsSync(schemaPath)) schema = fs.readFileSync(schemaPath, 'utf8');
if (fs.existsSync(seedPath)) seed = fs.readFileSync(seedPath, 'utf8');
if (fs.existsSync(summaryPath)) summary = readJson(summaryPath);

for (const table of REQUIRED_TABLES) {
  check(`tabla requerida ${table}`, new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`, 'i').test(schema));
}
for (const indexName of REQUIRED_INDEXES) {
  check(`índice requerido ${indexName}`, new RegExp(`CREATE\\s+INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${indexName}\\b`, 'i').test(schema));
}
for (const banned of BANNED_SQL) {
  check(`SQL incompatible ausente: ${banned}`, !banned.test(schema), null);
}

if (seed) {
  const statements = splitSqlStatements(seed).filter((stmt) => !stmt.trim().startsWith('--'));
  const maxStatementBytes = statements.reduce((max, stmt) => Math.max(max, bytes(stmt)), 0);
  check('seed contiene INSERTs', /INSERT\s+OR\s+REPLACE\s+INTO\s+/i.test(seed));
  check('cada statement SQL <= 100 KB', maxStatementBytes <= 100_000, { maxStatementBytes });
  check('seed contiene transacciones', /BEGIN\s+TRANSACTION/i.test(seed) && /COMMIT/i.test(seed));
}

if (summary) {
  const counts = summary.table_counts ?? {};
  check('hay provincias', (counts.province ?? 0) > 0, counts.province);
  check('hay localidades', (counts.locality ?? 0) > 0, counts.locality);
  check('hay clientes', (counts.client ?? 0) > 0, counts.client);
  check('hay productos', (counts.product ?? 0) > 0, counts.product);
  check('hay ventas', (counts.sale_monthly ?? 0) > 0, counts.sale_monthly);
  check('hay agregados provincia/mes', (counts.sales_aggregate_province_month ?? 0) > 0, counts.sales_aggregate_province_month);
  check('hay agregados localidad/mes', (counts.sales_aggregate_locality_month ?? 0) > 0, counts.sales_aggregate_locality_month);
  check('hay códigos postales trazados', (counts.postal_code_area ?? 0) > 0, counts.postal_code_area, 'warning');
  check('clientes V6 esperados preservados', summary.business_integrity?.actual_clients === summary.business_integrity?.expected_clients_v6, summary.business_integrity);
  check('no hay ventas huérfanas sin cliente', summary.business_integrity?.orphan_sales_without_client === 0, summary.business_integrity?.orphan_sales_without_client);
  check('no hay ventas huérfanas sin producto', summary.business_integrity?.orphan_sales_without_product === 0, summary.business_integrity?.orphan_sales_without_product);
  check('no hay clientes sin provincia válida', summary.business_integrity?.orphan_clients_without_province === 0, summary.business_integrity?.orphan_clients_without_province);
  check('no hay clientes sin localidad válida', summary.business_integrity?.orphan_clients_without_locality === 0, summary.business_integrity?.orphan_clients_without_locality);
  check('datos sintéticos marcados como sintéticos', summary.business_integrity?.synthetic_rows_preserved === true, summary.business_integrity?.synthetic_rows_preserved);
  check('período ventas conserva 2025-01 a 2026-12', summary.sale_period?.from === '2025-01' && summary.sale_period?.to === '2026-12', summary.sale_period);
  check('geometrías pesadas no se cargan como JSON masivo', (summary.geometry_policy?.asset_path_rows ?? 0) > 0, summary.geometry_policy);
}

const packageJson = fs.existsSync(packagePath) ? readJson(packagePath) : null;
if (packageJson) {
  const scripts = packageJson.scripts ?? {};
  for (const required of ['data:d1:build', 'data:d1:validate', 'audit:d1', 'validate:v11a', 'build']) {
    check(`script npm ${required} existe`, Boolean(scripts[required]), scripts[required] ?? null);
  }
}

const report = {
  phase: 'V11A D1 seed validation',
  generated_at: now,
  status: errors.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'WARNING' : 'OK',
  errors,
  warnings,
  checks,
  files: {
    schema: fs.existsSync(schemaPath) ? path.relative(ROOT, schemaPath) : null,
    seed: fs.existsSync(seedPath) ? path.relative(ROOT, seedPath) : null,
    summary: fs.existsSync(summaryPath) ? path.relative(ROOT, summaryPath) : null,
    seed_size_bytes: fs.existsSync(seedPath) ? fs.statSync(seedPath).size : 0
  }
};

fs.writeFileSync(rel('data', 'd1', 'validation_report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

const md = `# Mapa 2 — V11A D1 Validation\n\n**Generado:** ${now}\n\n**Estado:** ${report.status}\n\n## Resultado de scripts\n\n| Check | Estado | Detalle |\n|---|---:|---|\n${checks.map((c) => `| ${c.name} | ${c.ok ? 'OK' : c.level === 'warning' ? 'WARNING' : 'ERROR'} | ${c.detail === null || c.detail === undefined ? '' : String(JSON.stringify(c.detail)).replaceAll('|', '\\|')} |`).join('\n')}\n\n## Validaciones ejecutadas\n\n- Schema textual compatible SQLite/D1.\n- Existencia de tablas obligatorias.\n- Existencia de índices obligatorios.\n- Ausencia de patrones PostgreSQL/PostGIS incompatibles.\n- Seed generado y con statements menores a 100 KB.\n- Integridad referencial calculada desde archivos fuente.\n- Preservación de clientes, productos y ventas sintéticas V6.\n\n## Nota\n\nEsta validación no reemplaza la ejecución real con Wrangler/D1 local. El paso de D1 local se documenta en \`docs/V11A_CLOUDFLARE_STEPS.md\`.\n`;
fs.writeFileSync(rel('docs', 'V11A_D1_VALIDATION.md'), md, 'utf8');

console.log(`[V11A] Validación D1: ${report.status}`);
if (errors.length > 0) {
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
}
