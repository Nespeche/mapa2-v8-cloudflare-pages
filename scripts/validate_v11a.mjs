import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const rel = (...parts) => path.join(ROOT, ...parts);
const now = new Date().toISOString();

const requiredFiles = [
  'wrangler.toml',
  'migrations/0001_schema.sql',
  'scripts/build_d1_seed.mjs',
  'scripts/validate_d1_seed.mjs',
  'scripts/audit_d1_limits.mjs',
  'scripts/validate_v11a.mjs',
  'data/d1/seed.sql',
  'data/d1/seed_summary.json',
  'data/d1/d1_audit_report.json',
  'docs/V11A_D1_SCHEMA.md',
  'docs/V11A_MIGRATION_REPORT.md',
  'docs/V11A_D1_VALIDATION.md',
  'docs/V11A_CLOUDFLARE_STEPS.md',
  'docs/V11A_GITHUB_STEPS.md',
  'docs/V11A_ROLLBACK.md',
  'docs/POSTAL_CODES_SOURCES.md',
  'docs/V11A_CHANGELOG.md'
];

const packageJson = JSON.parse(fs.readFileSync(rel('package.json'), 'utf8'));
const requiredScripts = ['data:d1:build', 'data:d1:validate', 'audit:d1', 'validate:v11a', 'build'];
const checks = [];
const errors = [];
const warnings = [];
function check(name, ok, detail = null, level = 'error') {
  checks.push({ name, ok, detail, level });
  if (!ok && level === 'error') errors.push({ name, detail });
  if (!ok && level === 'warning') warnings.push({ name, detail });
}

for (const file of requiredFiles) {
  check(`archivo requerido ${file}`, fs.existsSync(rel(...file.split('/'))));
}
for (const script of requiredScripts) {
  check(`script npm ${script}`, Boolean(packageJson.scripts?.[script]), packageJson.scripts?.[script] ?? null);
}

const wrangler = fs.existsSync(rel('wrangler.toml')) ? fs.readFileSync(rel('wrangler.toml'), 'utf8') : '';
check('wrangler.toml tiene binding DB', /binding\s*=\s*"DB"/.test(wrangler));
check('wrangler.toml usa database_name mapa2-db', /database_name\s*=\s*"mapa2-db"/.test(wrangler));
check('wrangler.toml mantiene placeholder seguro de database_id', /REEMPLAZAR_CON_DATABASE_ID_REAL/.test(wrangler), null, 'warning');

const summary = fs.existsSync(rel('data', 'd1', 'seed_summary.json')) ? JSON.parse(fs.readFileSync(rel('data', 'd1', 'seed_summary.json'), 'utf8')) : null;
if (summary) {
  check('V11A no perdió clientes', summary.business_integrity?.actual_clients === 2000, summary.business_integrity?.actual_clients);
  check('V11A no perdió ventas', summary.business_integrity?.actual_sales > 100000, summary.business_integrity?.actual_sales);
  check('V11A conserva productos', summary.business_integrity?.actual_products >= 60, summary.business_integrity?.actual_products);
  check('V11A trae localidades normalizadas', (summary.table_counts?.locality ?? 0) > 500, summary.table_counts?.locality);
  check('V11A modela códigos postales', (summary.table_counts?.postal_code_area ?? 0) > 0, summary.table_counts?.postal_code_area, 'warning');
}

const forbiddenExisting = [];
for (const forbidden of ['.env']) {
  if (fs.existsSync(rel(forbidden))) forbiddenExisting.push(forbidden);
}
check('no existe .env real en raíz', forbiddenExisting.length === 0, forbiddenExisting);
check('node_modules no forma parte requerida del entregable', true, 'Si existe localmente por npm install, se excluye al generar ZIP.');

const report = {
  phase: 'V11A release validation',
  generated_at: now,
  status: errors.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'WARNING' : 'OK',
  errors,
  warnings,
  checks
};
fs.writeFileSync(rel('data', 'd1', 'v11a_release_validation.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

const rows = checks.map((c) => `| ${c.name} | ${c.ok ? 'OK' : c.level === 'warning' ? 'WARNING' : 'ERROR'} | ${c.detail === null || c.detail === undefined ? '' : String(JSON.stringify(c.detail)).replaceAll('|', '\\|')} |`).join('\n');
const md = `# Mapa 2 — V11A Release Validation\n\n**Generado:** ${now}\n\n**Estado:** ${report.status}\n\n| Check | Estado | Detalle |\n|---|---:|---|\n${rows}\n\n## Nota\n\nEste reporte valida artefactos V11A. La validación del frontend se completa con \`npm run build\`; la validación D1 real se completa con los comandos Wrangler locales documentados.\n`;
fs.writeFileSync(rel('docs', 'V11A_RELEASE_VALIDATION.md'), md, 'utf8');

console.log(`[V11A] Release validation: ${report.status}`);
if (errors.length > 0) {
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
}
