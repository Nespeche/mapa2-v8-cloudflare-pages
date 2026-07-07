import fs from 'node:fs';
import {
  NOW,
  SCHEMA_VERSION,
  rel,
  readText,
  writeJson,
  writeText,
  markdownTable
} from './v11a1_utils.mjs';

const schemaFiles = [rel('migrations', '0001_schema.sql'), rel('migrations', '0002_v11a1_api_read_optimization.sql')];
for (const file of schemaFiles) {
  if (!fs.existsSync(file)) {
    console.error(`[V11A.1] Falta schema para query plan audit: ${file}`);
    process.exit(1);
  }
}
const schemaText = schemaFiles.map(readText).join('\n');

const queryPlanSql = `-- Mapa 2 V11A.1 — EXPLAIN QUERY PLAN checks\n-- Ejecutar luego de aplicar migrations/0001 + 0002 y cargar data/d1/v11a1_read_models.sql.\n\nEXPLAIN QUERY PLAN\nSELECT * FROM api_locality_summary WHERE locality_id = 'departamento:06749';\n\nEXPLAIN QUERY PLAN\nSELECT * FROM api_locality_summary WHERE province_id = 'provincia:06' ORDER BY name LIMIT 500;\n\nEXPLAIN QUERY PLAN\nSELECT * FROM api_locality_client_metrics WHERE locality_id = 'departamento:06749' ORDER BY rank_net_sales LIMIT 50;\n\nEXPLAIN QUERY PLAN\nSELECT * FROM api_locality_top_products WHERE locality_id = 'departamento:06749' ORDER BY rank_net_sales LIMIT 10;\n\nEXPLAIN QUERY PLAN\nSELECT * FROM api_client_sales_summary WHERE client_id = 'C00001';\n\nEXPLAIN QUERY PLAN\nSELECT * FROM postal_code_area WHERE postal_code = '1646' LIMIT 20;\n\nEXPLAIN QUERY PLAN\nSELECT * FROM territorial_alias WHERE alias_normalized LIKE 'san%' LIMIT 20;\n\nEXPLAIN QUERY PLAN\nSELECT * FROM api_locality_month_summary WHERE locality_id = 'departamento:06749' AND period_yyyymm BETWEEN '2025-01' AND '2026-12' ORDER BY period_yyyymm;\n\nEXPLAIN QUERY PLAN\nSELECT * FROM api_locality_month_summary WHERE province_id = 'provincia:06' AND period_yyyymm BETWEEN '2025-01' AND '2026-12' ORDER BY period_yyyymm;\n`;
writeText(rel('data', 'd1', 'v11a1_query_plan_checks.sql'), queryPlanSql);

const checks = [
  {
    id: 'locality_by_pk',
    query: 'api_locality_summary WHERE locality_id = ?',
    requiredIndex: 'PRIMARY KEY api_locality_summary(locality_id)',
    evidence: 'CREATE TABLE IF NOT EXISTS api_locality_summary',
    status: schemaText.includes('locality_id TEXT PRIMARY KEY') && schemaText.includes('api_locality_summary') ? 'OK' : 'BLOCKED',
    note: 'Debe resolver por PK.'
  },
  {
    id: 'localities_by_province',
    query: 'api_locality_summary WHERE province_id = ? ORDER BY name LIMIT 500',
    requiredIndex: 'idx_api_locality_summary_province_name',
    evidence: 'CREATE INDEX IF NOT EXISTS idx_api_locality_summary_province_name ON api_locality_summary(province_id, name_normalized)',
    status: schemaText.includes('idx_api_locality_summary_province_name') ? 'OK' : 'BLOCKED',
    note: 'ORDER BY name puede requerir sort; para V11B conviene ordenar por name_normalized o aceptar sort acotado.'
  },
  {
    id: 'locality_clients_ranked',
    query: 'api_locality_client_metrics WHERE locality_id = ? ORDER BY rank_net_sales LIMIT 50',
    requiredIndex: 'idx_api_locality_client_loc_rank',
    evidence: 'CREATE INDEX IF NOT EXISTS idx_api_locality_client_loc_rank ON api_locality_client_metrics(locality_id, rank_net_sales)',
    status: schemaText.includes('idx_api_locality_client_loc_rank') ? 'OK' : 'BLOCKED',
    note: 'Paginación obligatoria y pageSize máximo 100.'
  },
  {
    id: 'locality_top_products',
    query: 'api_locality_top_products WHERE locality_id = ? ORDER BY rank_net_sales LIMIT 10',
    requiredIndex: 'idx_api_locality_top_products_loc_rank',
    evidence: 'CREATE INDEX IF NOT EXISTS idx_api_locality_top_products_loc_rank ON api_locality_top_products(locality_id, rank_net_sales)',
    status: schemaText.includes('idx_api_locality_top_products_loc_rank') ? 'OK' : 'BLOCKED',
    note: 'Top products está precalculado; no escanear ventas crudas.'
  },
  {
    id: 'client_summary_by_pk',
    query: 'api_client_sales_summary WHERE client_id = ?',
    requiredIndex: 'PRIMARY KEY api_client_sales_summary(client_id)',
    evidence: 'client_id TEXT PRIMARY KEY',
    status: schemaText.includes('CREATE TABLE IF NOT EXISTS api_client_sales_summary') && schemaText.includes('client_id TEXT PRIMARY KEY') ? 'OK' : 'BLOCKED',
    note: 'Resuelve detalle/resumen por cliente con una fila.'
  },
  {
    id: 'postal_code_lookup',
    query: 'postal_code_area WHERE postal_code = ? LIMIT 20',
    requiredIndex: 'idx_postal_code_area_cp',
    evidence: 'CREATE INDEX IF NOT EXISTS idx_postal_code_area_cp ON postal_code_area(postal_code)',
    status: schemaText.includes('idx_postal_code_area_cp') ? 'OK' : 'BLOCKED',
    note: 'Código postal solo como señal auxiliar territorial.'
  },
  {
    id: 'territory_alias_like',
    query: "territorial_alias WHERE alias_normalized LIKE 'san%' LIMIT 20",
    requiredIndex: 'idx_alias_normalized',
    evidence: 'CREATE INDEX IF NOT EXISTS idx_alias_normalized ON territorial_alias(alias_normalized)',
    status: schemaText.includes('idx_alias_normalized') ? 'WARNING' : 'BLOCKED',
    note: 'LIKE puede usar índice solo con prefijo y collation compatible; imponer LIMIT y normalizar q.'
  },
  {
    id: 'locality_month_by_locality_period',
    query: 'api_locality_month_summary WHERE locality_id = ? AND period_yyyymm BETWEEN ? AND ?',
    requiredIndex: 'idx_api_locality_month_locality_period',
    evidence: 'CREATE INDEX IF NOT EXISTS idx_api_locality_month_locality_period ON api_locality_month_summary(locality_id, period_yyyymm)',
    status: schemaText.includes('idx_api_locality_month_locality_period') ? 'OK' : 'BLOCKED',
    note: 'Adecuado para serie mensual por localidad.'
  },
  {
    id: 'locality_month_by_province_period',
    query: 'api_locality_month_summary WHERE province_id = ? AND period_yyyymm BETWEEN ? AND ?',
    requiredIndex: 'idx_api_locality_month_province_period',
    evidence: 'CREATE INDEX IF NOT EXISTS idx_api_locality_month_province_period ON api_locality_month_summary(province_id, period_yyyymm)',
    status: schemaText.includes('idx_api_locality_month_province_period') ? 'OK' : 'BLOCKED',
    note: 'Adecuado para resúmenes provinciales sin sale_monthly.'
  }
];

const forbiddenPatterns = [
  { pattern: /SELECT\s+\*\s+FROM\s+sale_monthly\s*;/i, message: 'SELECT * FROM sale_monthly sin filtro está prohibido.' },
  { pattern: /FROM\s+sale_monthly(?![^;]*(client_id|product_id|period_yyyymm))/i, message: 'sale_monthly debe usarse solo con filtros indexados.' }
];
const generatedFiles = [
  rel('data', 'd1', 'v11a1_api_read_budget_report.json'),
  rel('docs', 'V11B_PREPARATION_NOTES.md')
].filter(fs.existsSync);
const forbiddenFindings = [];
for (const file of generatedFiles) {
  const text = readText(file);
  for (const { pattern, message } of forbiddenPatterns) {
    if (pattern.test(text)) forbiddenFindings.push({ file, message });
  }
}

const status = checks.some((c) => c.status === 'BLOCKED') || forbiddenFindings.length ? 'BLOCKED' : (checks.some((c) => c.status === 'WARNING') ? 'WARNING' : 'OK');
const report = {
  project: 'Mapa 2',
  phase: 'V11A.1 query plan audit',
  generated_at: NOW,
  schema_version: SCHEMA_VERSION,
  status,
  checks,
  forbidden_findings: forbiddenFindings.map((f) => ({ file: f.file.replace(process.cwd(), '').replace(/^\//, ''), message: f.message })),
  sql_file: 'data/d1/v11a1_query_plan_checks.sql',
  execution_note: 'Este script prepara EXPLAIN QUERY PLAN y valida cobertura de índices por schema. Ejecutar el SQL con Wrangler D1 local para ver el plan real.'
};
writeJson(rel('data', 'd1', 'v11a1_query_plan_report.json'), report);

const docRows = checks.map((c) => ({ id: c.id, query: c.query, index: c.requiredIndex, status: c.status, note: c.note }));
const doc = `# V11A.1 — Query Plan Audit\n\n` +
`Generado: ${NOW}\n\n` +
`## Objetivo\n\n` +
`Prevenir full scans críticos antes de implementar Pages Functions V11B. Este script genera SQL de \`EXPLAIN QUERY PLAN\` y valida que existan índices adecuados en las migraciones.\n\n` +
`## SQL generado\n\n\`data/d1/v11a1_query_plan_checks.sql\`\n\n` +
`## Checks\n\n${markdownTable(docRows, [
  { key: 'id', label: 'Check' },
  { key: 'query', label: 'Consulta' },
  { key: 'index', label: 'Índice esperado' },
  { key: 'status', label: 'Estado' },
  { key: 'note', label: 'Nota' }
])}\n\n` +
`## Consultas que deben evitarse\n\n` +
`- \`SELECT * FROM sale_monthly\` sin filtros.\n` +
`- Agregar totales por provincia/localidad leyendo ventas crudas en cada request.\n` +
`- Búsquedas \`LIKE '%texto%'\` sin límite estricto.\n` +
`- Devolver geometría pesada inline.\n\n` +
`## Estado final\n\n${status}. El check \`territory_alias_like\` queda como WARNING por naturaleza de LIKE; en V11B debe usarse con prefijo normalizado, LIMIT y debounce.\n`;
writeText(rel('docs', 'V11A1_QUERY_PLAN_AUDIT.md'), doc);

if (status === 'BLOCKED') {
  console.error('[V11A.1] Query plan audit BLOCKED. Revisar data/d1/v11a1_query_plan_report.json');
  process.exit(1);
}
console.log(`[V11A.1] Query plan audit: ${status}. SQL listo en data/d1/v11a1_query_plan_checks.sql.`);
