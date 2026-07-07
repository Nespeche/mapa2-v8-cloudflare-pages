import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  NOW,
  SCHEMA_VERSION,
  rel,
  readCsv,
  parseSeedTables,
  writeJson,
  writeText,
  insertSql,
  writeSqlChunks,
  stableId,
  toNumber,
  toInt,
  round,
  markdownTable,
  fileBytes,
  sizeLabel
} from './v11a1_utils.mjs';

const OUT_DIR = rel('data', 'd1');
const DOCS_DIR = rel('docs');

const sourceFiles = {
  seedSummary: rel('data', 'd1', 'seed_summary.json'),
  seedChunks: rel('data', 'd1', 'chunks'),
  clients: rel('data', 'output', 'business_v6', 'clientes_v6.csv'),
  products: rel('data', 'output', 'business_v6', 'productos_v6.csv'),
  sales: rel('data', 'output', 'business_v6', 'ventas_mensuales_v6.csv'),
  aggClient: rel('data', 'output', 'business_v6', 'agregados_cliente_v6.csv'),
  aggLocalityMonth: rel('data', 'output', 'business_v6', 'agregados_departamento_mes_v6.csv'),
  aggProvinceMonth: rel('data', 'output', 'business_v6', 'agregados_provincia_mes_v6.csv')
};

for (const [key, filePath] of Object.entries(sourceFiles)) {
  if (key === 'seedChunks') continue;
  if (!fs.existsSync(filePath)) {
    console.error(`[V11A.1] Falta input obligatorio: ${key} -> ${path.relative(ROOT, filePath)}`);
    process.exit(1);
  }
}

const seed = parseSeedTables(['province', 'locality', 'census_population']);
const provinces = new Map(seed.province.map((row) => [row.province_id, row]));
const localities = new Map(seed.locality.map((row) => [row.locality_id, row]));
const censusPopulation = new Map();
for (const row of seed.census_population) {
  if (toInt(row.census_year) === 2022 && row.entity_id) {
    const current = censusPopulation.get(row.entity_id);
    const population = toInt(row.population_total, null);
    if (population !== null && (current === undefined || population > current)) censusPopulation.set(row.entity_id, population);
  }
}

const productsCsv = readCsv(sourceFiles.products);
const clientsCsv = readCsv(sourceFiles.clients);
const salesCsv = readCsv(sourceFiles.sales);
const aggClientCsv = readCsv(sourceFiles.aggClient);
const aggLocalityMonthCsv = readCsv(sourceFiles.aggLocalityMonth);
const aggProvinceMonthCsv = readCsv(sourceFiles.aggProvinceMonth);

const products = new Map();
for (const row of productsCsv) {
  products.set(row.producto_id, {
    product_id: row.producto_id,
    product_name: row.producto_nombre,
    category: row.categoria_producto,
    subcategory: row.subcategoria_producto,
    brand: row.marca_ficticia,
    unit_measure: row.unidad_medida,
    base_price: round(row.precio_base, 2),
    estimated_weight_kg: round(row.peso_estimado_kg, 3),
    base_margin_pct: round(row.margen_base_pct, 4)
  });
}

const clients = new Map();
const clientsByProvince = new Map();
const clientsByLocality = new Map();
for (const row of clientsCsv) {
  const locality_id = row.departamento_id || row.localidad_id || null;
  const client = {
    client_id: row.cliente_id,
    client_name: row.cliente_nombre,
    province_id: row.provincia_id || null,
    province_name: row.provincia_nombre || null,
    locality_id,
    locality_name: row.departamento_nombre || row.localidad_nombre || null,
    postal_code: row.codigo_postal || row.postal_code || null,
    lat: round(row.lat, 6),
    lng: round(row.lon, 6),
    segment: row.segmento_cliente || null,
    client_type: row.tipo_cliente || null,
    synthetic_flag: String(row.dato_sintetico).toLowerCase() === 'true' ? 1 : 0
  };
  clients.set(client.client_id, client);
  if (client.province_id) {
    if (!clientsByProvince.has(client.province_id)) clientsByProvince.set(client.province_id, new Set());
    clientsByProvince.get(client.province_id).add(client.client_id);
  }
  if (client.locality_id) {
    if (!clientsByLocality.has(client.locality_id)) clientsByLocality.set(client.locality_id, new Set());
    clientsByLocality.get(client.locality_id).add(client.client_id);
  }
}

function zeroMetrics() {
  return {
    sales_count: 0,
    units: 0,
    net_sales: 0,
    estimated_cost: 0,
    gross_margin: 0,
    volume_kg: 0,
    first_period: null,
    last_period: null
  };
}

function addPeriod(metric, period) {
  if (!period) return;
  if (!metric.first_period || period < metric.first_period) metric.first_period = period;
  if (!metric.last_period || period > metric.last_period) metric.last_period = period;
}

function addSale(metric, row, count = 1) {
  metric.sales_count += count;
  metric.units += toNumber(row.unidades, 0);
  metric.net_sales += toNumber(row.venta_neta, 0);
  metric.estimated_cost += toNumber(row.costo_estimado, 0);
  metric.gross_margin += toNumber(row.margen_bruto, 0);
  metric.volume_kg += toNumber(row.volumen_kg, 0);
  addPeriod(metric, row.periodo || row.period_yyyymm);
}

const provinceSales = new Map();
for (const row of aggProvinceMonthCsv) {
  const key = row.provincia_id;
  if (!provinceSales.has(key)) provinceSales.set(key, zeroMetrics());
  addSale(provinceSales.get(key), row, toInt(row.registros_venta, 0));
}

const localityMonthRows = [];
const localitySales = new Map();
const localityPeriodProductSets = new Map();
for (const row of aggLocalityMonthCsv) {
  const locality_id = row.departamento_id;
  if (!locality_id) continue;
  if (!localitySales.has(locality_id)) localitySales.set(locality_id, zeroMetrics());
  addSale(localitySales.get(locality_id), row, toInt(row.registros_venta, 0));
  localityMonthRows.push(row);
}

const clientSales = new Map();
const clientMonthly = new Map();
const clientProductAgg = new Map();
const localityProductAgg = new Map();
const localityProductSet = new Map();
const clientProductSet = new Map();

function incrementProductAgg(map, key, row) {
  if (!map.has(key)) map.set(key, zeroMetrics());
  addSale(map.get(key), row, 1);
}

for (const row of salesCsv) {
  const client = clients.get(row.cliente_id);
  if (!client) continue;
  const locality_id = client.locality_id;
  const province_id = client.province_id;
  const product_id = row.producto_id;
  const period = row.periodo;

  if (!clientSales.has(client.client_id)) clientSales.set(client.client_id, zeroMetrics());
  addSale(clientSales.get(client.client_id), row, 1);

  const clientMonthKey = `${client.client_id}|${period}`;
  if (!clientMonthly.has(clientMonthKey)) clientMonthly.set(clientMonthKey, { client_id: client.client_id, period, year: toInt(row.anio), month: toInt(row.mes), ...zeroMetrics() });
  addSale(clientMonthly.get(clientMonthKey), row, 1);

  const clientProductKey = `${client.client_id}|${product_id}`;
  incrementProductAgg(clientProductAgg, clientProductKey, row);
  if (!clientProductSet.has(client.client_id)) clientProductSet.set(client.client_id, new Set());
  clientProductSet.get(client.client_id).add(product_id);

  if (locality_id) {
    const localityProductKey = `${locality_id}|${product_id}`;
    incrementProductAgg(localityProductAgg, localityProductKey, row);
    if (!localityProductSet.has(locality_id)) localityProductSet.set(locality_id, new Set());
    localityProductSet.get(locality_id).add(product_id);

    const locPeriodProductKey = `${locality_id}|${period}`;
    if (!localityPeriodProductSets.has(locPeriodProductKey)) localityPeriodProductSets.set(locPeriodProductKey, new Set());
    localityPeriodProductSets.get(locPeriodProductKey).add(product_id);
  }

  if (province_id && !provinceSales.has(province_id)) provinceSales.set(province_id, zeroMetrics());
}

const aggClientById = new Map();
for (const row of aggClientCsv) aggClientById.set(row.cliente_id, row);

function metricToRow(metric) {
  return {
    sales_count: metric?.sales_count ?? 0,
    units: round(metric?.units ?? 0, 2),
    net_sales: round(metric?.net_sales ?? 0, 2),
    estimated_cost: round(metric?.estimated_cost ?? 0, 2),
    gross_margin: round(metric?.gross_margin ?? 0, 2),
    volume_kg: round(metric?.volume_kg ?? 0, 2),
    first_period: metric?.first_period ?? null,
    last_period: metric?.last_period ?? null
  };
}

function productInfo(productId) {
  return products.get(productId) ?? { product_id: productId, product_name: productId, category: null, subcategory: null, brand: null };
}

function buildTopProductGroups(sourceMap) {
  const groups = new Map();
  for (const [key, metric] of sourceMap) {
    const [ownerId, productId] = key.split('|');
    if (!groups.has(ownerId)) groups.set(ownerId, []);
    groups.get(ownerId).push({ product_id: productId, ...productInfo(productId), ...metricToRow(metric) });
  }
  for (const [ownerId, rows] of groups) {
    rows.sort((a, b) => (b.net_sales - a.net_sales) || (b.units - a.units) || a.product_id.localeCompare(b.product_id));
    groups.set(ownerId, rows.map((row, idx) => ({ ...row, rank_net_sales: idx + 1 })));
  }
  return groups;
}

const topProductsByLocality = buildTopProductGroups(localityProductAgg);
const topProductsByClient = buildTopProductGroups(clientProductAgg);
const clientMonthlyByClient = new Map();
for (const row of clientMonthly.values()) {
  if (!clientMonthlyByClient.has(row.client_id)) clientMonthlyByClient.set(row.client_id, []);
  clientMonthlyByClient.get(row.client_id).push(row);
}

function topProductsForLocality(localityId, limit = 10) {
  return (topProductsByLocality.get(localityId) ?? []).slice(0, limit);
}

function topProductsForClient(clientId, limit = 10) {
  return (topProductsByClient.get(clientId) ?? []).slice(0, limit);
}

function compactTopProducts(rows) {
  return JSON.stringify(rows.map((row) => ({
    product_id: row.product_id,
    product_name: row.product_name,
    category: row.category,
    rank_net_sales: row.rank_net_sales,
    units: row.units,
    net_sales: row.net_sales,
    gross_margin: row.gross_margin
  })));
}

function compactMonthly(rows) {
  return JSON.stringify(rows
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((row) => ({
      period: row.period,
      year: row.year,
      month: row.month,
      sales_count: row.sales_count,
      units: round(row.units, 2),
      net_sales: round(row.net_sales, 2),
      gross_margin: round(row.gross_margin, 2),
      volume_kg: round(row.volume_kg, 2)
    })));
}

const budgetRows = [
  ['budget:health', 'GET /api/health', 'GET', 'V11B', 'app_metadata', 1, 1, 0, 'Edge cache corta; no D1 si se resuelve estático', 'LOW', 'Endpoint de salud. Debe evitar consultas complejas.'],
  ['budget:metadata', 'GET /api/metadata', 'GET', 'V11B', 'public/data/api-cache/metadata.json|app_metadata', 1, 4, 0, 'Asset estático preferente; D1 solo fallback', 'LOW', 'Metadata casi inmutable, ideal para cache.'],
  ['budget:provinces', 'GET /api/provinces', 'GET', 'V11B', 'public/data/api-cache/provinces.json|api_province_summary', 24, 24, 0, 'Asset estático o read model api_province_summary', 'LOW', 'No consultar ventas crudas.'],
  ['budget:province-localities', 'GET /api/provinces/:provinceId/localities', 'GET', 'V11B', 'public/data/api-cache/localities_by_province/*|api_locality_summary', 5000, 5000, 0, 'Asset por provincia preferente; D1 con índice province_id', 'LOW', 'Puede devolver muchas filas en Buenos Aires; respuesta liviana sin geometrías.'],
  ['budget:locality-detail', 'GET /api/localities/:localityId', 'GET', 'V11B', 'api_locality_summary|geometry_feature', 1, 2, 0, 'D1 read model + asset_path para geometría', 'LOW', 'No incluir geometría pesada inline.'],
  ['budget:locality-summary', 'GET /api/localities/:localityId/summary', 'GET', 'V11B', 'api_locality_summary|api_locality_top_products', 12, 12, 0, 'D1 read models; cache por localidad', 'LOW', 'Resumen comercial debe salir de read models.'],
  ['budget:locality-clients', 'GET /api/localities/:localityId/clients?page=&pageSize=', 'GET', 'V11B', 'api_locality_client_metrics', 50, 50, 1, 'D1 paginado con límite máximo 100', 'LOW', 'Ordenar por rank_net_sales usando índice locality_id + rank.'],
  ['budget:client-detail', 'GET /api/clients/:clientId', 'GET', 'V11B', 'api_client_sales_summary|client', 1, 2, 0, 'D1 read model por PK', 'LOW', 'No escanear sale_monthly.'],
  ['budget:client-sales', 'GET /api/clients/:clientId/sales?from=&to=&productId=', 'GET', 'V11B', 'api_client_sales_summary|sale_monthly(client_id,period_yyyymm)', 24, 24, 0, 'Read model para resumen; sale_monthly solo filtrada por cliente/período', 'MEDIUM', 'Nunca usar sale_monthly sin client_id o período.'],
  ['budget:sales-summary', 'GET /api/sales/summary?provinceId=&localityId=&from=&to=&productId=', 'GET', 'V11B', 'api_locality_month_summary|sales_aggregate_*', 24, 100, 0, 'Agregados o read models, cache por parámetros', 'MEDIUM', 'Ventas crudas solo para filtros muy acotados e indexados.'],
  ['budget:territory-search', 'GET /api/search/territory?q=&provinceId=&postalCode=', 'GET', 'V11B', 'locality|province|territorial_alias|postal_code_area', 20, 200, 1, 'D1 con límite estricto y normalización textual; cache corta', 'MEDIUM', 'LIKE requiere límites; postal code es señal auxiliar.']
].map(([budget_id, endpoint, method, future_phase, expected_tables, expected_max_rows_returned, expected_max_rows_scanned, requires_pagination, cache_strategy, risk_level, notes]) => ({
  budget_id,
  endpoint,
  method,
  future_phase,
  expected_tables,
  expected_max_rows_returned,
  expected_max_rows_scanned,
  requires_pagination,
  cache_strategy,
  risk_level,
  notes,
  updated_at: NOW
}));

const provinceSummaryRows = [];
for (const province of provinces.values()) {
  const metric = metricToRow(provinceSales.get(province.province_id));
  const localityCount = [...localities.values()].filter((loc) => loc.province_id === province.province_id).length;
  provinceSummaryRows.push({
    province_id: province.province_id,
    slug: province.slug,
    name: province.name,
    name_normalized: province.name_normalized,
    locality_count: localityCount,
    client_count: clientsByProvince.get(province.province_id)?.size ?? 0,
    population_2022: censusPopulation.get(province.province_id) ?? null,
    net_sales_total: metric.net_sales,
    units_total: metric.units,
    gross_margin_total: metric.gross_margin,
    first_period: metric.first_period,
    last_period: metric.last_period,
    centroid_lat: province.centroid_lat,
    centroid_lng: province.centroid_lng,
    bbox_min_lng: province.bbox_min_lng,
    bbox_min_lat: province.bbox_min_lat,
    bbox_max_lng: province.bbox_max_lng,
    bbox_max_lat: province.bbox_max_lat,
    updated_at: NOW
  });
}
provinceSummaryRows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));

const localitySummaryRows = [];
for (const locality of localities.values()) {
  const province = provinces.get(locality.province_id) ?? {};
  const metric = metricToRow(localitySales.get(locality.locality_id));
  const topProducts = topProductsForLocality(locality.locality_id, 5);
  localitySummaryRows.push({
    locality_id: locality.locality_id,
    province_id: locality.province_id,
    province_name: province.name ?? null,
    slug: locality.slug,
    name: locality.name,
    name_normalized: locality.name_normalized,
    source_type: locality.source_type,
    population_2022: toInt(locality.population_2022, censusPopulation.get(locality.locality_id) ?? null),
    postal_code_primary: locality.postal_code_primary ?? null,
    client_count: clientsByLocality.get(locality.locality_id)?.size ?? 0,
    product_count: localityProductSet.get(locality.locality_id)?.size ?? 0,
    sales_count: metric.sales_count,
    net_sales_total: metric.net_sales,
    units_total: metric.units,
    gross_margin_total: metric.gross_margin,
    volume_kg_total: metric.volume_kg,
    first_period: metric.first_period,
    last_period: metric.last_period,
    top_products_json: compactTopProducts(topProducts),
    centroid_lat: locality.centroid_lat,
    centroid_lng: locality.centroid_lng,
    bbox_min_lng: locality.bbox_min_lng,
    bbox_min_lat: locality.bbox_min_lat,
    bbox_max_lng: locality.bbox_max_lng,
    bbox_max_lat: locality.bbox_max_lat,
    updated_at: NOW
  });
}
localitySummaryRows.sort((a, b) => `${a.province_id}|${a.name_normalized}`.localeCompare(`${b.province_id}|${b.name_normalized}`));

const localityMonthSummaryRows = localityMonthRows.map((row) => {
  const locality_id = row.departamento_id;
  const period = row.periodo;
  const locPeriodProducts = localityPeriodProductSets.get(`${locality_id}|${period}`)?.size ?? 0;
  return {
    summary_id: stableId('api-loc-month', [locality_id, period]),
    locality_id,
    province_id: row.provincia_id || localities.get(locality_id)?.province_id || null,
    period_yyyymm: period,
    year: toInt(row.anio),
    month: toInt(row.mes),
    client_count: toInt(row.clientes_unicos, 0),
    sales_count: toInt(row.registros_venta, 0),
    product_count: locPeriodProducts,
    units: round(row.unidades, 2),
    net_sales: round(row.venta_neta, 2),
    estimated_cost: round(row.costo_estimado, 2),
    gross_margin: round(row.margen_bruto, 2),
    volume_kg: round(row.volumen_kg, 2),
    updated_at: NOW
  };
});

const localityTopProductRows = [];
for (const localityId of localityProductSet.keys()) {
  const rows = topProductsForLocality(localityId, 12);
  const byUnits = [...rows].sort((a, b) => (b.units - a.units) || (b.net_sales - a.net_sales));
  const unitsRank = new Map(byUnits.map((row, idx) => [row.product_id, idx + 1]));
  for (const row of rows) {
    localityTopProductRows.push({
      row_id: stableId('api-loc-product', [localityId, row.product_id]),
      locality_id: localityId,
      province_id: localities.get(localityId)?.province_id ?? clients.get([...clientsByLocality.get(localityId) ?? []][0])?.province_id ?? null,
      product_id: row.product_id,
      product_name: row.product_name,
      category: row.category,
      subcategory: row.subcategory,
      brand: row.brand,
      rank_net_sales: row.rank_net_sales,
      rank_units: unitsRank.get(row.product_id) ?? null,
      units: row.units,
      net_sales: row.net_sales,
      gross_margin: row.gross_margin,
      period_from: row.first_period,
      period_to: row.last_period,
      updated_at: NOW
    });
  }
}
localityTopProductRows.sort((a, b) => `${a.locality_id}|${String(a.rank_net_sales).padStart(4, '0')}`.localeCompare(`${b.locality_id}|${String(b.rank_net_sales).padStart(4, '0')}`));

const localityClientMetricRows = [];
for (const [localityId, clientSet] of clientsByLocality) {
  const ranked = [...clientSet].map((clientId) => {
    const client = clients.get(clientId);
    const agg = aggClientById.get(clientId);
    const metric = metricToRow(clientSales.get(clientId));
    return {
      row_id: stableId('api-loc-client', [localityId, clientId]),
      locality_id: localityId,
      province_id: client?.province_id ?? agg?.provincia_id ?? null,
      client_id: clientId,
      client_name: client?.client_name ?? agg?.cliente_nombre ?? null,
      segment: client?.segment ?? agg?.segmento_cliente ?? null,
      client_type: client?.client_type ?? agg?.tipo_cliente ?? null,
      postal_code: client?.postal_code ?? null,
      lat: client?.lat ?? round(agg?.lat, 6),
      lng: client?.lng ?? round(agg?.lon, 6),
      sales_count: metric.sales_count || toInt(agg?.registros_venta, 0),
      product_count: clientProductSet.get(clientId)?.size ?? 0,
      units: metric.units || round(agg?.unidades, 2),
      net_sales: metric.net_sales || round(agg?.venta_neta, 2),
      gross_margin: metric.gross_margin || round(agg?.margen_bruto, 2),
      first_period: metric.first_period,
      last_period: metric.last_period,
      rank_net_sales: null,
      updated_at: NOW
    };
  }).sort((a, b) => (b.net_sales - a.net_sales) || a.client_id.localeCompare(b.client_id));
  ranked.forEach((row, idx) => {
    row.rank_net_sales = idx + 1;
    localityClientMetricRows.push(row);
  });
}

const clientSalesSummaryRows = [];
for (const client of clients.values()) {
  const metric = metricToRow(clientSales.get(client.client_id));
  const monthlyRows = clientMonthlyByClient.get(client.client_id) ?? [];
  const topRows = topProductsForClient(client.client_id, 10);
  clientSalesSummaryRows.push({
    client_id: client.client_id,
    client_name: client.client_name,
    province_id: client.province_id,
    locality_id: client.locality_id,
    postal_code: client.postal_code,
    segment: client.segment,
    client_type: client.client_type,
    sales_count: metric.sales_count,
    product_count: clientProductSet.get(client.client_id)?.size ?? 0,
    units: metric.units,
    net_sales: metric.net_sales,
    estimated_cost: metric.estimated_cost,
    gross_margin: metric.gross_margin,
    volume_kg: metric.volume_kg,
    first_period: metric.first_period,
    last_period: metric.last_period,
    monthly_summary_json: compactMonthly(monthlyRows),
    top_products_json: compactTopProducts(topRows),
    updated_at: NOW
  });
}

const statements = [];
statements.push('-- V11A.1 read model refresh. Solo borra tablas api_* generadas; no toca tablas canónicas V11A.');
for (const table of ['api_query_budget', 'api_client_sales_summary', 'api_locality_client_metrics', 'api_locality_top_products', 'api_locality_month_summary', 'api_locality_summary', 'api_province_summary']) {
  statements.push(`DELETE FROM ${table};`);
}

const columns = {
  api_province_summary: ['province_id', 'slug', 'name', 'name_normalized', 'locality_count', 'client_count', 'population_2022', 'net_sales_total', 'units_total', 'gross_margin_total', 'first_period', 'last_period', 'centroid_lat', 'centroid_lng', 'bbox_min_lng', 'bbox_min_lat', 'bbox_max_lng', 'bbox_max_lat', 'updated_at'],
  api_locality_summary: ['locality_id', 'province_id', 'province_name', 'slug', 'name', 'name_normalized', 'source_type', 'population_2022', 'postal_code_primary', 'client_count', 'product_count', 'sales_count', 'net_sales_total', 'units_total', 'gross_margin_total', 'volume_kg_total', 'first_period', 'last_period', 'top_products_json', 'centroid_lat', 'centroid_lng', 'bbox_min_lng', 'bbox_min_lat', 'bbox_max_lng', 'bbox_max_lat', 'updated_at'],
  api_locality_month_summary: ['summary_id', 'locality_id', 'province_id', 'period_yyyymm', 'year', 'month', 'client_count', 'sales_count', 'product_count', 'units', 'net_sales', 'estimated_cost', 'gross_margin', 'volume_kg', 'updated_at'],
  api_locality_top_products: ['row_id', 'locality_id', 'province_id', 'product_id', 'product_name', 'category', 'subcategory', 'brand', 'rank_net_sales', 'rank_units', 'units', 'net_sales', 'gross_margin', 'period_from', 'period_to', 'updated_at'],
  api_locality_client_metrics: ['row_id', 'locality_id', 'province_id', 'client_id', 'client_name', 'segment', 'client_type', 'postal_code', 'lat', 'lng', 'sales_count', 'product_count', 'units', 'net_sales', 'gross_margin', 'first_period', 'last_period', 'rank_net_sales', 'updated_at'],
  api_client_sales_summary: ['client_id', 'client_name', 'province_id', 'locality_id', 'postal_code', 'segment', 'client_type', 'sales_count', 'product_count', 'units', 'net_sales', 'estimated_cost', 'gross_margin', 'volume_kg', 'first_period', 'last_period', 'monthly_summary_json', 'top_products_json', 'updated_at'],
  api_query_budget: ['budget_id', 'endpoint', 'method', 'future_phase', 'expected_tables', 'expected_max_rows_returned', 'expected_max_rows_scanned', 'requires_pagination', 'cache_strategy', 'risk_level', 'notes', 'updated_at']
};

for (const row of provinceSummaryRows) statements.push(insertSql('api_province_summary', columns.api_province_summary, row));
for (const row of localitySummaryRows) statements.push(insertSql('api_locality_summary', columns.api_locality_summary, row));
for (const row of localityMonthSummaryRows) statements.push(insertSql('api_locality_month_summary', columns.api_locality_month_summary, row));
for (const row of localityTopProductRows) statements.push(insertSql('api_locality_top_products', columns.api_locality_top_products, row));
for (const row of localityClientMetricRows) statements.push(insertSql('api_locality_client_metrics', columns.api_locality_client_metrics, row));
for (const row of clientSalesSummaryRows) statements.push(insertSql('api_client_sales_summary', columns.api_client_sales_summary, row));
for (const row of budgetRows) statements.push(insertSql('api_query_budget', columns.api_query_budget, row));

const sqlInfo = writeSqlChunks(statements, 'v11a1_read_models', {
  header: `-- Mapa 2 V11A.1 read models generated at ${NOW}\n-- Aplicar migrations/0002_v11a1_api_read_optimization.sql antes de este archivo.`
});

const summary = {
  project: 'Mapa 2',
  phase: 'V11A.1 Cloudflare Free optimization + API read models',
  generated_at: NOW,
  schema_version: SCHEMA_VERSION,
  source_files: Object.fromEntries(Object.entries(sourceFiles).filter(([key]) => key !== 'seedChunks').map(([key, filePath]) => [key, path.relative(ROOT, filePath).replaceAll(path.sep, '/')])),
  table_counts: {
    api_province_summary: provinceSummaryRows.length,
    api_locality_summary: localitySummaryRows.length,
    api_locality_month_summary: localityMonthSummaryRows.length,
    api_locality_top_products: localityTopProductRows.length,
    api_locality_client_metrics: localityClientMetricRows.length,
    api_client_sales_summary: clientSalesSummaryRows.length,
    api_query_budget: budgetRows.length
  },
  source_counts: {
    province: provinces.size,
    locality: localities.size,
    client: clients.size,
    product: products.size,
    sale_monthly_csv_rows: salesCsv.length,
    agg_locality_month_rows: aggLocalityMonthCsv.length
  },
  business_integrity: {
    expected_clients_v6: 2000,
    actual_clients: clients.size,
    expected_products_from_v11a: 65,
    actual_products: products.size,
    actual_sales: salesCsv.length,
    synthetic_rows_preserved: true,
    client_metrics_rows: localityClientMetricRows.length,
    client_summary_rows: clientSalesSummaryRows.length
  },
  payload_policy: {
    top_products_json_limit_locality_summary: 5,
    top_products_rows_per_locality_table: 12,
    monthly_summary_json_max_periods_per_client: 24,
    no_raw_sales_in_static_cache: true,
    no_heavy_geometry_in_read_models: true
  },
  sql_output: sqlInfo,
  warnings: [],
  status: 'OK'
};

if (clients.size !== 2000) summary.warnings.push({ level: 'WARNING', message: 'La cantidad de clientes no coincide con V6 esperada.' });
if (products.size !== 65) summary.warnings.push({ level: 'WARNING', message: 'La cantidad de productos no coincide con V6 esperada.' });
if (localitySummaryRows.length !== localities.size) summary.warnings.push({ level: 'WARNING', message: 'api_locality_summary no coincide con la cantidad de localidades canónicas.' });
if (summary.warnings.length > 0) summary.status = 'WARNING';

writeJson(path.join(OUT_DIR, 'v11a1_read_models_summary.json'), summary);

const docsRows = Object.entries(summary.table_counts).map(([table, count]) => ({ table, count }));
const sourceRows = Object.entries(summary.source_counts).map(([source, count]) => ({ source, count }));
const doc = `# V11A.1 — Read Models D1\n\n` +
`Generado: ${NOW}\n\n` +
`## Objetivo\n\n` +
`Crear tablas de lectura optimizada para que V11B implemente APIs livianas sin escanear \`sale_monthly\` ni geometrías pesadas. Estas tablas son derivadas y regenerables; la fuente canónica sigue siendo D1 V11A.\n\n` +
`## Tablas generadas\n\n${markdownTable(docsRows, [{ key: 'table', label: 'Tabla' }, { key: 'count', label: 'Filas' }])}\n\n` +
`## Fuentes usadas\n\n${markdownTable(sourceRows, [{ key: 'source', label: 'Fuente' }, { key: 'count', label: 'Filas' }])}\n\n` +
`## SQL generado\n\n- Archivo completo: \`${sqlInfo.file}\` (${sizeLabel(sqlInfo.size_bytes)}, ${sqlInfo.statement_count} statements).\n- Chunks: ${sqlInfo.chunks.length}.\n\n` +
`## Contrato por tabla\n\n` +
`- \`api_province_summary\`: resumen provincial para \`/api/provinces\` y \`/api/provinces/:id/summary\`.\n` +
`- \`api_locality_summary\`: fila única por localidad para \`/api/localities/:id/summary\`, incluye KPIs, población, bbox/centroide y top products compacto.\n` +
`- \`api_locality_month_summary\`: serie mensual por localidad para gráficos y filtros por período.\n` +
`- \`api_locality_top_products\`: top 12 productos por localidad, rankeado por venta neta.\n` +
`- \`api_locality_client_metrics\`: clientes por localidad con ranking para paginación.\n` +
`- \`api_client_sales_summary\`: resumen por cliente con serie mensual compacta y top productos.\n` +
`- \`api_query_budget\`: presupuesto de lectura por endpoint futuro.\n\n` +
`## Consultas a evitar\n\n` +
`- No usar \`SELECT * FROM sale_monthly\` para endpoints frecuentes.\n` +
`- No devolver geometrías pesadas inline desde read models.\n` +
`- No servir clientes completos sin paginación.\n` +
`- No usar código postal como única verdad territorial.\n\n` +
`## Estado\n\n${summary.status}. ${summary.warnings.length ? 'Ver advertencias en data/d1/v11a1_read_models_summary.json.' : 'Sin advertencias bloqueantes.'}\n`;
writeText(path.join(DOCS_DIR, 'V11A1_READ_MODELS.md'), doc);

console.log(`[V11A.1] Read models generados: ${sqlInfo.file}`);
console.log(`[V11A.1] Tablas: ${JSON.stringify(summary.table_counts)}`);
