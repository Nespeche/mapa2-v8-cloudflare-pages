import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  NOW,
  SCHEMA_VERSION,
  rel,
  readJson,
  writeJson,
  writeText,
  markdownTable,
  fileBytes,
  sizeLabel
} from './v11a1_utils.mjs';

function optionalJson(...parts) {
  const filePath = rel(...parts);
  return fs.existsSync(filePath) ? readJson(filePath) : null;
}

const readModels = optionalJson('data', 'd1', 'v11a1_read_models_summary.json');
const staticCache = optionalJson('data', 'd1', 'static_cache_summary.json');
const d1Audit = optionalJson('data', 'd1', 'd1_audit_report.json');

const rowCounts = readModels?.table_counts ?? {};
const cacheRows = staticCache?.row_counts ?? {};
const freeLimits = d1Audit?.limits ?? {
  free_rows_read_per_day: 5_000_000,
  free_rows_written_per_day: 100_000,
  max_queries_per_worker_invocation_free: 50
};

const endpoints = [
  {
    endpoint: 'GET /api/health',
    method: 'GET',
    future_phase: 'V11B',
    main_table: 'app_metadata or static response',
    auxiliary_tables: [],
    required_indexes: [],
    expected_max_rows_returned: 1,
    expected_max_rows_scanned: 1,
    requires_pagination: false,
    approx_response_kb: 1,
    full_scan_risk: 'LOW',
    cache_strategy: 'Responder estático o Edge cache muy corta; D1 opcional.',
    fallback: 'Retornar status sin D1 si DB no está disponible.',
    can_be_static_asset: true,
    should_use_d1: false,
    should_use_read_model: false,
    should_use_aggregates: false,
    warning: 'No usar este endpoint para validar datos pesados.'
  },
  {
    endpoint: 'GET /api/metadata',
    method: 'GET',
    future_phase: 'V11B',
    main_table: 'public/data/api-cache/metadata.json',
    auxiliary_tables: ['app_metadata'],
    required_indexes: ['PK app_metadata.metadata_key'],
    expected_max_rows_returned: 1,
    expected_max_rows_scanned: 4,
    requires_pagination: false,
    approx_response_kb: 4,
    full_scan_risk: 'LOW',
    cache_strategy: 'Asset estático con hash + Cache-Control largo; D1 solo fallback.',
    fallback: 'Leer app_metadata si el asset no existe.',
    can_be_static_asset: true,
    should_use_d1: false,
    should_use_read_model: false,
    should_use_aggregates: false,
    warning: 'Actualizar asset al regenerar read models.'
  },
  {
    endpoint: 'GET /api/provinces',
    method: 'GET',
    future_phase: 'V11B',
    main_table: 'public/data/api-cache/provinces.json or api_province_summary',
    auxiliary_tables: [],
    required_indexes: ['idx_api_province_summary_name', 'idx_api_province_summary_slug'],
    expected_max_rows_returned: rowCounts.api_province_summary ?? 24,
    expected_max_rows_scanned: rowCounts.api_province_summary ?? 24,
    requires_pagination: false,
    approx_response_kb: 20,
    full_scan_risk: 'LOW',
    cache_strategy: 'Asset preferente; D1 read model cuando se necesite consistencia remota.',
    fallback: 'api_province_summary ordenada por name.',
    can_be_static_asset: true,
    should_use_d1: true,
    should_use_read_model: true,
    should_use_aggregates: false,
    warning: 'Nunca sumar sale_monthly para este endpoint.'
  },
  {
    endpoint: 'GET /api/provinces/:provinceId/localities',
    method: 'GET',
    future_phase: 'V11B',
    main_table: 'public/data/api-cache/localities_by_province/{safe_id}.json or api_locality_summary',
    auxiliary_tables: [],
    required_indexes: ['idx_api_locality_summary_province', 'idx_api_locality_summary_province_name'],
    expected_max_rows_returned: Math.max(1, Math.ceil((rowCounts.api_locality_summary ?? 21289) / Math.max(1, rowCounts.api_province_summary ?? 24) * 4)),
    expected_max_rows_scanned: Math.max(1, Math.ceil((rowCounts.api_locality_summary ?? 21289) / Math.max(1, rowCounts.api_province_summary ?? 24) * 4)),
    requires_pagination: false,
    approx_response_kb: 500,
    full_scan_risk: 'LOW_WITH_INDEX',
    cache_strategy: 'Asset por provincia preferente; D1 filtrando por province_id si se requiere versión dinámica.',
    fallback: 'api_locality_summary WHERE province_id = ? ORDER BY name LIMIT 5000.',
    can_be_static_asset: true,
    should_use_d1: true,
    should_use_read_model: true,
    should_use_aggregates: false,
    warning: 'El archivo de Buenos Aires puede ser el más grande; no incluir geometrías.'
  },
  {
    endpoint: 'GET /api/localities/:localityId',
    method: 'GET',
    future_phase: 'V11B',
    main_table: 'api_locality_summary',
    auxiliary_tables: ['geometry_feature only for asset_path/bbox if needed'],
    required_indexes: ['PK api_locality_summary.locality_id', 'idx_geometry_entity'],
    expected_max_rows_returned: 1,
    expected_max_rows_scanned: 2,
    requires_pagination: false,
    approx_response_kb: 8,
    full_scan_risk: 'LOW',
    cache_strategy: 'D1 read model por PK; cache por localidad.',
    fallback: 'locality + sales aggregates si read model no está aplicado.',
    can_be_static_asset: false,
    should_use_d1: true,
    should_use_read_model: true,
    should_use_aggregates: false,
    warning: 'No devolver geometry_json pesado.'
  },
  {
    endpoint: 'GET /api/localities/:localityId/summary',
    method: 'GET',
    future_phase: 'V11B',
    main_table: 'api_locality_summary',
    auxiliary_tables: ['api_locality_top_products'],
    required_indexes: ['PK api_locality_summary.locality_id', 'idx_api_locality_top_products_loc_rank'],
    expected_max_rows_returned: 13,
    expected_max_rows_scanned: 13,
    requires_pagination: false,
    approx_response_kb: 12,
    full_scan_risk: 'LOW',
    cache_strategy: 'D1 read models; Cache-Control corto por localidad.',
    fallback: 'api_locality_month_summary para totales si falta summary.',
    can_be_static_asset: false,
    should_use_d1: true,
    should_use_read_model: true,
    should_use_aggregates: true,
    warning: 'No consultar sale_monthly crudo.'
  },
  {
    endpoint: 'GET /api/localities/:localityId/clients?page=&pageSize=',
    method: 'GET',
    future_phase: 'V11B',
    main_table: 'api_locality_client_metrics',
    auxiliary_tables: [],
    required_indexes: ['idx_api_locality_client_loc_rank'],
    expected_max_rows_returned: 50,
    expected_max_rows_scanned: 50,
    requires_pagination: true,
    approx_response_kb: 30,
    full_scan_risk: 'LOW_WITH_INDEX_AND_LIMIT',
    cache_strategy: 'D1 paginado. pageSize default 25, máximo 100.',
    fallback: 'client filtrado por locality_id sin ventas detalladas.',
    can_be_static_asset: false,
    should_use_d1: true,
    should_use_read_model: true,
    should_use_aggregates: false,
    warning: 'Bloquear pageSize > 100.'
  },
  {
    endpoint: 'GET /api/clients/:clientId',
    method: 'GET',
    future_phase: 'V11B',
    main_table: 'api_client_sales_summary',
    auxiliary_tables: ['client'],
    required_indexes: ['PK api_client_sales_summary.client_id'],
    expected_max_rows_returned: 1,
    expected_max_rows_scanned: 1,
    requires_pagination: false,
    approx_response_kb: 12,
    full_scan_risk: 'LOW',
    cache_strategy: 'D1 por PK; cache por cliente.',
    fallback: 'client + sales_aggregate_client_month filtrado por client_id.',
    can_be_static_asset: false,
    should_use_d1: true,
    should_use_read_model: true,
    should_use_aggregates: true,
    warning: 'No exponer datos sensibles si se reemplaza base sintética por real.'
  },
  {
    endpoint: 'GET /api/clients/:clientId/sales?from=&to=&productId=',
    method: 'GET',
    future_phase: 'V11B',
    main_table: 'api_client_sales_summary or sale_monthly filtered by client_id + period',
    auxiliary_tables: ['product'],
    required_indexes: ['PK api_client_sales_summary.client_id', 'idx_sale_client_period', 'idx_sale_product_period'],
    expected_max_rows_returned: 24,
    expected_max_rows_scanned: 120,
    requires_pagination: false,
    approx_response_kb: 40,
    full_scan_risk: 'MEDIUM_IF_PRODUCT_FILTER_WITHOUT_CLIENT',
    cache_strategy: 'Resumen desde read model; detalle crudo solo filtrado por client_id y rango.',
    fallback: 'sales_aggregate_client_month WHERE client_id = ? AND period_yyyymm BETWEEN ? AND ?',
    can_be_static_asset: false,
    should_use_d1: true,
    should_use_read_model: true,
    should_use_aggregates: true,
    warning: 'Bloquear consultas sin clientId.'
  },
  {
    endpoint: 'GET /api/sales/summary?provinceId=&localityId=&from=&to=&productId=',
    method: 'GET',
    future_phase: 'V11B',
    main_table: 'api_locality_month_summary or sales_aggregate_*',
    auxiliary_tables: ['api_province_summary', 'api_locality_summary'],
    required_indexes: ['idx_api_locality_month_locality_period', 'idx_api_locality_month_province_period', 'idx_agg_locality_period', 'idx_agg_product_period'],
    expected_max_rows_returned: 24,
    expected_max_rows_scanned: 100,
    requires_pagination: false,
    approx_response_kb: 35,
    full_scan_risk: 'MEDIUM_IF_NO_FILTERS',
    cache_strategy: 'Cache por combinación normalizada de filtros; exigir from/to razonables.',
    fallback: 'sales_aggregate_province_month o sales_aggregate_locality_month.',
    can_be_static_asset: false,
    should_use_d1: true,
    should_use_read_model: true,
    should_use_aggregates: true,
    warning: 'No usar sale_monthly para resumen general.'
  },
  {
    endpoint: 'GET /api/search/territory?q=&provinceId=&postalCode=',
    method: 'GET',
    future_phase: 'V11B',
    main_table: 'locality, province, territorial_alias, postal_code_area',
    auxiliary_tables: ['api_locality_summary for enriched result'],
    required_indexes: ['idx_locality_province_name', 'idx_alias_normalized', 'idx_postal_code_area_cp', 'idx_postal_code_area_prov_loc'],
    expected_max_rows_returned: 20,
    expected_max_rows_scanned: 200,
    requires_pagination: true,
    approx_response_kb: 20,
    full_scan_risk: 'WARNING_WITH_LIKE',
    cache_strategy: 'Límite estricto, debounce frontend futuro, cache corta por query normalizada.',
    fallback: 'Búsqueda por provincia + localidad normalizada; código postal como señal auxiliar.',
    can_be_static_asset: false,
    should_use_d1: true,
    should_use_read_model: false,
    should_use_aggregates: false,
    warning: 'LIKE no debe ejecutarse sin LIMIT y normalización.'
  }
];

const risks = [];
for (const endpoint of endpoints) {
  if (endpoint.full_scan_risk.includes('MEDIUM') || endpoint.full_scan_risk.includes('WARNING')) {
    risks.push({ level: 'WARNING', endpoint: endpoint.endpoint, message: endpoint.warning });
  }
  if (String(endpoint.main_table).includes('sale_monthly') && !endpoint.endpoint.includes('/clients/:clientId/sales')) {
    risks.push({ level: 'BLOCKED', endpoint: endpoint.endpoint, message: 'sale_monthly no debe ser tabla principal para endpoint frecuente.' });
  }
}

const report = {
  project: 'Mapa 2',
  phase: 'V11A.1 API read budget audit',
  generated_at: NOW,
  schema_version: SCHEMA_VERSION,
  status: risks.some((r) => r.level === 'BLOCKED') ? 'BLOCKED' : (risks.length ? 'WARNING' : 'OK'),
  cloudflare_free_reference_from_v11a: {
    free_rows_read_per_day: freeLimits.free_rows_read_per_day,
    free_rows_written_per_day: freeLimits.free_rows_written_per_day,
    max_queries_per_worker_invocation_free: freeLimits.max_queries_per_worker_invocation_free,
    note: 'Revisar límites vigentes de Cloudflare al momento del deploy remoto.'
  },
  available_read_model_rows: rowCounts,
  available_static_cache_rows: cacheRows,
  endpoints,
  risks,
  strategy: {
    serve_static_when_possible: ['/api/metadata', '/api/provinces', '/api/provinces/:provinceId/localities', '/api/products'],
    serve_read_models: ['/api/localities/:id/summary', '/api/localities/:id/clients', '/api/clients/:id', '/api/sales/summary'],
    avoid_raw_sales_for: ['/api/provinces', '/api/localities/:id/summary', '/api/sales/summary'],
    pagination_defaults: { default_page_size: 25, max_page_size: 100, search_limit: 20 },
    future_http_cache: 'ETag/Cache-Control para assets; s-maxage corto para summaries dinámicos.'
  }
};

writeJson(rel('data', 'd1', 'v11a1_api_read_budget_report.json'), report);

const tableRows = endpoints.map((e) => ({
  endpoint: e.endpoint,
  main: e.main_table,
  returned: e.expected_max_rows_returned,
  scanned: e.expected_max_rows_scanned,
  cache: e.cache_strategy,
  risk: e.full_scan_risk
}));
const riskRows = risks.length ? risks : [{ level: 'OK', endpoint: '-', message: 'Sin bloqueos; advertencias controladas por índices, límites y paginación.' }];
const doc = `# V11A.1 — API Read Budget\n\n` +
`Generado: ${NOW}\n\n` +
`## Objetivo\n\n` +
`Definir el presupuesto de lectura esperado para las APIs futuras V11B, maximizando el uso de assets y read models para no consumir innecesariamente D1 Free.\n\n` +
`## Presupuesto por endpoint\n\n${markdownTable(tableRows, [
  { key: 'endpoint', label: 'Endpoint' },
  { key: 'main', label: 'Tabla/asset principal' },
  { key: 'returned', label: 'Máx. devueltas' },
  { key: 'scanned', label: 'Máx. escaneadas' },
  { key: 'risk', label: 'Riesgo' }
])}\n\n` +
`## Riesgos y advertencias\n\n${markdownTable(riskRows, [
  { key: 'level', label: 'Nivel' },
  { key: 'endpoint', label: 'Endpoint' },
  { key: 'message', label: 'Mensaje' }
])}\n\n` +
`## Estrategia Cloudflare Free\n\n` +
`- Servir catálogos casi inmutables desde \`public/data/api-cache\`.\n` +
`- Usar read models para resumen de localidad, cliente y series mensuales.\n` +
`- Usar \`sale_monthly\` solo con filtros altamente selectivos por \`client_id\`, \`product_id\` y/o período.\n` +
`- Limitar \`pageSize\` a 100 y búsqueda territorial a 20 resultados.\n` +
`- Revisar los límites vigentes de Cloudflare antes del deploy remoto; V11A conserva la última auditoría en \`data/d1/d1_audit_report.json\`.\n\n` +
`## Estado\n\n${report.status}.\n`;
writeText(rel('docs', 'V11A1_API_READ_BUDGET.md'), doc);

if (report.status === 'BLOCKED') {
  console.error('[V11A.1] API read budget BLOCKED. Revisar data/d1/v11a1_api_read_budget_report.json');
  process.exit(1);
}
console.log(`[V11A.1] API read budget: ${report.status}. Endpoints presupuestados: ${endpoints.length}.`);
