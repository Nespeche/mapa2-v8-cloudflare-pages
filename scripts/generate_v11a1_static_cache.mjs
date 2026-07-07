import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  NOW,
  SCHEMA_VERSION,
  rel,
  ensureDir,
  readCsv,
  writeJson,
  writeText,
  parseSqlTablesFromFiles,
  safeFileId,
  sha256File,
  fileBytes,
  sizeLabel,
  markdownTable,
  round
} from './v11a1_utils.mjs';

const sqlPath = rel('data', 'd1', 'v11a1_read_models.sql');
if (!fs.existsSync(sqlPath)) {
  console.error('[V11A.1] No existe data/d1/v11a1_read_models.sql. Ejecutá primero npm run data:d1:readmodels.');
  process.exit(1);
}

const apiCacheDir = rel('public', 'data', 'api-cache');
const locByProvDir = path.join(apiCacheDir, 'localities_by_province');
ensureDir(apiCacheDir);
ensureDir(locByProvDir);

const parsed = parseSqlTablesFromFiles([sqlPath], ['api_province_summary', 'api_locality_summary']);
const provinceRows = parsed.api_province_summary;
const localityRows = parsed.api_locality_summary;
const productsCsv = readCsv(rel('data', 'output', 'business_v6', 'productos_v6.csv'));
const periodsCsv = readCsv(rel('data', 'output', 'business_v6', 'calendario_v6.csv'));

function lightProvince(row) {
  return {
    province_id: row.province_id,
    slug: row.slug,
    name: row.name,
    name_normalized: row.name_normalized,
    locality_count: row.locality_count,
    client_count: row.client_count,
    population_2022: row.population_2022,
    net_sales_total: round(row.net_sales_total, 2),
    units_total: round(row.units_total, 2),
    gross_margin_total: round(row.gross_margin_total, 2),
    first_period: row.first_period,
    last_period: row.last_period,
    centroid_lat: row.centroid_lat,
    centroid_lng: row.centroid_lng,
    bbox: [row.bbox_min_lng, row.bbox_min_lat, row.bbox_max_lng, row.bbox_max_lat]
  };
}

function lightLocality(row) {
  return {
    locality_id: row.locality_id,
    province_id: row.province_id,
    slug: row.slug,
    name: row.name,
    name_normalized: row.name_normalized,
    source_type: row.source_type,
    population_2022: row.population_2022,
    postal_code_primary: row.postal_code_primary,
    client_count: row.client_count,
    product_count: row.product_count,
    sales_count: row.sales_count,
    net_sales_total: round(row.net_sales_total, 2),
    units_total: round(row.units_total, 2),
    gross_margin_total: round(row.gross_margin_total, 2),
    first_period: row.first_period,
    last_period: row.last_period,
    centroid_lat: row.centroid_lat,
    centroid_lng: row.centroid_lng,
    bbox: [row.bbox_min_lng, row.bbox_min_lat, row.bbox_max_lng, row.bbox_max_lat]
  };
}

function wrapper(kind, records, extra = {}) {
  return {
    project: 'Mapa 2',
    phase: 'V11A.1',
    schema_version: SCHEMA_VERSION,
    kind,
    generated_at: NOW,
    source: 'D1 read model generado desde V11A; este asset no es fuente canónica.',
    row_count: records.length,
    ...extra,
    records
  };
}

const files = [];
function writeCacheJson(relativePath, value) {
  const filePath = path.join(apiCacheDir, ...relativePath.split('/'));
  writeJson(filePath, value);
  files.push(filePath);
  return filePath;
}

writeCacheJson('provinces.json', wrapper('province_catalog', provinceRows.map(lightProvince)));

const localitiesByProvince = new Map();
for (const row of localityRows) {
  if (!localitiesByProvince.has(row.province_id)) localitiesByProvince.set(row.province_id, []);
  localitiesByProvince.get(row.province_id).push(lightLocality(row));
}

const indexRecords = [];
for (const province of provinceRows) {
  const records = (localitiesByProvince.get(province.province_id) ?? []).sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  const safe = safeFileId(province.province_id);
  const file = `localities_by_province/${safe}.json`;
  writeCacheJson(file, wrapper('localities_by_province', records, {
    province_id: province.province_id,
    province_name: province.name,
    windows_safe_file_id: safe
  }));
  indexRecords.push({
    province_id: province.province_id,
    province_name: province.name,
    file,
    row_count: records.length,
    note: safe === province.province_id ? null : 'Nombre de archivo sanitizado para Windows/PowerShell.'
  });
}
indexRecords.sort((a, b) => String(a.province_name).localeCompare(String(b.province_name), 'es'));
writeCacheJson('localities_by_province/index.json', wrapper('localities_by_province_index', indexRecords));

const products = productsCsv.map((row) => ({
  product_id: row.producto_id,
  product_name: row.producto_nombre,
  category: row.categoria_producto,
  subcategory: row.subcategoria_producto,
  brand: row.marca_ficticia,
  unit_measure: row.unidad_medida,
  base_price: round(row.precio_base, 2),
  estimated_weight_kg: round(row.peso_estimado_kg, 3),
  base_margin_pct: round(row.margen_base_pct, 4),
  synthetic_flag: String(row.dato_sintetico).toLowerCase() === 'true'
}));
writeCacheJson('products.json', wrapper('product_catalog', products, { synthetic_data_notice: 'Catálogo comercial ficticio/sintético V6.' }));

const periods = periodsCsv.map((row) => ({
  period: row.periodo,
  year: Number(row.anio),
  month: Number(row.mes),
  date: row.fecha_mes,
  month_name: row.mes_nombre,
  quarter: row.trimestre,
  semester: row.semestre,
  order: Number(row.orden_periodo)
}));
writeCacheJson('periods.json', wrapper('period_catalog', periods, { period_from: periods[0]?.period, period_to: periods.at(-1)?.period }));

writeCacheJson('metadata.json', {
  project: 'Mapa 2',
  phase: 'V11A.1 Cloudflare Free optimization',
  schema_version: SCHEMA_VERSION,
  generated_at: NOW,
  source: 'Cache estático generado desde read models D1 V11A.1; no es fuente canónica.',
  canonical_source: 'Cloudflare D1 / migrations + seed V11A + read models V11A.1',
  counts: {
    provinces: provinceRows.length,
    localities: localityRows.length,
    products: products.length,
    periods: periods.length
  },
  policy: {
    no_raw_sales: true,
    no_clients_bulk: true,
    no_heavy_geometries: true,
    no_secrets: true,
    frontend_currently_does_not_depend_on_this_cache: true
  },
  recommended_use_v11b: {
    '/api/metadata': 'Servir asset metadata.json o headers cacheados.',
    '/api/provinces': 'Servir provinces.json cuando no requiera datos frescos.',
    '/api/provinces/:provinceId/localities': 'Servir localities_by_province/{safe_id}.json para navegación de catálogo.',
    '/api/products': 'Servir products.json si se expone catálogo en V11B.'
  }
});

const manifestFiles = files.map((filePath) => ({
  file: path.relative(apiCacheDir, filePath).replaceAll(path.sep, '/'),
  bytes: fileBytes(filePath),
  size: sizeLabel(fileBytes(filePath)),
  sha256: sha256File(filePath)
})).sort((a, b) => a.file.localeCompare(b.file));
const largeWarnings = manifestFiles.filter((f) => f.bytes > 1_500_000).map((f) => ({ level: 'WARNING', file: f.file, bytes: f.bytes, message: 'Asset supera 1.5 MB; revisar si conviene paginar o servir por API D1.' }));
const manifest = {
  project: 'Mapa 2',
  phase: 'V11A.1',
  schema_version: SCHEMA_VERSION,
  generated_at: NOW,
  source: 'public/data/api-cache generado; D1 sigue siendo canónico.',
  file_count: manifestFiles.length,
  total_bytes: manifestFiles.reduce((acc, f) => acc + f.bytes, 0),
  total_size: sizeLabel(manifestFiles.reduce((acc, f) => acc + f.bytes, 0)),
  files: manifestFiles,
  warnings: largeWarnings,
  status: largeWarnings.length ? 'WARNING' : 'OK'
};
writeJson(path.join(apiCacheDir, 'cache_manifest.json'), manifest);
files.push(path.join(apiCacheDir, 'cache_manifest.json'));

const summary = {
  project: 'Mapa 2',
  phase: 'V11A.1 static API cache',
  generated_at: NOW,
  schema_version: SCHEMA_VERSION,
  output_dir: 'public/data/api-cache',
  counts: manifest.file_count ? manifest.files.reduce((acc, f) => ({ ...acc, [f.file]: f.bytes }), {}) : {},
  row_counts: {
    provinces: provinceRows.length,
    localities: localityRows.length,
    products: products.length,
    periods: periods.length,
    locality_index_files: indexRecords.length
  },
  total_bytes: manifest.total_bytes,
  total_size: manifest.total_size,
  warnings: largeWarnings,
  status: manifest.status
};
writeJson(rel('data', 'd1', 'static_cache_summary.json'), summary);

const docRows = manifest.files.map((f) => ({ file: f.file, size: f.size }));
const doc = `# V11A.1 — Static API Cache\n\n` +
`Generado: ${NOW}\n\n` +
`## Objetivo\n\n` +
`Preparar assets JSON livianos para catálogos casi inmutables. Estos archivos reducen lecturas D1 futuras, pero no reemplazan a D1 como fuente canónica.\n\n` +
`## Archivos generados\n\n${markdownTable(docRows, [{ key: 'file', label: 'Archivo' }, { key: 'size', label: 'Tamaño' }])}\n\n` +
`## Reglas aplicadas\n\n` +
`- No se incluyen ventas crudas.\n` +
`- No se incluyen clientes completos.\n` +
`- No se incluyen geometrías pesadas.\n` +
`- Los nombres de archivos por provincia se sanitizan para Windows: \`provincia:06\` -> \`provincia_06.json\`.\n` +
`- El frontend actual no depende todavía de estos assets.\n\n` +
`## Estado\n\n${manifest.status}. ${largeWarnings.length ? 'Hay advertencias de tamaño en el manifiesto.' : 'Sin advertencias de tamaño.'}\n`;
writeText(rel('docs', 'V11A1_STATIC_CACHE.md'), doc);

console.log(`[V11A.1] Static cache generado en public/data/api-cache (${manifest.total_size}).`);
console.log(`[V11A.1] Estado cache: ${manifest.status}`);
