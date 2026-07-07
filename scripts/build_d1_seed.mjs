import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'data', 'd1');
const CHUNK_DIR = path.join(OUT_DIR, 'chunks');
const NOW = '2026-07-07T00:00:00.000Z';
const SEED_VERSION = 'v11a';
const MAX_GEOMETRY_JSON_BYTES = 8_000;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(CHUNK_DIR, { recursive: true });

const rel = (...parts) => path.join(ROOT, ...parts);
const exists = (...parts) => fs.existsSync(rel(...parts));
const readText = (filePath) => fs.readFileSync(filePath, 'utf8');
const readJson = (filePath) => JSON.parse(readText(filePath));
const bytes = (value) => Buffer.byteLength(value ?? '', 'utf8');

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/&/g, ' y ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function slugify(value) {
  const base = normalizeName(value).replace(/\s+/g, '-');
  return base || 'sin-nombre';
}

function stableId(prefix, parts) {
  const hash = crypto.createHash('sha1').update(parts.map((v) => String(v ?? '')).join('|')).digest('hex').slice(0, 16);
  return `${prefix}:${hash}`;
}

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function readCsv(filePath) {
  const text = readText(filePath).replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });
    return row;
  });
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/\./g, (match, offset, full) => {
    // Preserve decimal dot when there is only one dot and no comma.
    return full.includes(',') ? '' : match;
  }).replace(',', '.');
  if (text === '' || text.toLowerCase() === 'nan') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function toInt(value) {
  const n = toNumber(value);
  return n === null ? null : Math.trunc(n);
}

function toBoolInt(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'yes'].includes(text)) return 1;
  if (['false', '0', 'no'].includes(text)) return 0;
  return fallback;
}

function sqlValue(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  const text = String(value).replace(/\u0000/g, '').replace(/'/g, "''");
  return `'${text}'`;
}

function insertSql(table, columns, row, mode = 'INSERT OR REPLACE') {
  const cols = columns.join(', ');
  const values = columns.map((c) => sqlValue(row[c])).join(', ');
  return `${mode} INTO ${table} (${cols}) VALUES (${values});`;
}

function firstExisting(paths) {
  for (const p of paths) {
    const abs = rel(...p.split('/'));
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

function geometryBbox(geometry) {
  const coords = [];
  function walk(node) {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      coords.push([node[0], node[1]]);
      return;
    }
    node.forEach(walk);
  }
  if (geometry?.coordinates) walk(geometry.coordinates);
  if (coords.length === 0) return { bbox: [null, null, null, null], centroid: [null, null] };
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
  }
  if (!Number.isFinite(minLng)) return { bbox: [null, null, null, null], centroid: [null, null] };
  return { bbox: [minLng, minLat, maxLng, maxLat], centroid: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] };
}

function pointFromGeometry(geometry) {
  if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) {
    return [toNumber(geometry.coordinates[0]), toNumber(geometry.coordinates[1])];
  }
  return [null, null];
}

function detectSourceType(entityId, props = {}) {
  const id = String(entityId ?? props.id_entidad ?? '').toLowerCase();
  const original = normalizeName(props.tipo_original ?? props.display_tipo ?? props.capa_original ?? '');
  const provinceCode = props.provincia_codigo;
  if (id.startsWith('departamento:') || original.includes('departamento')) {
    if (provinceCode === '02') return 'comuna';
    if (provinceCode === '06') return 'partido';
    return 'departamento';
  }
  if (id.startsWith('gobierno_local:') || original.includes('gobierno local')) return 'gobierno_local';
  if (id.startsWith('municipio:') || original.includes('municipio')) return 'municipio';
  if (id.startsWith('aglomerado:') || original.includes('aglomerado')) return 'aglomerado';
  if (id.startsWith('asentamiento:') || original.includes('asentamiento')) return 'barrio';
  if (id.startsWith('localidad:') || original.includes('localidad')) return 'localidad';
  return 'division_equivalente';
}

function sourceForProps(props = {}) {
  const source = String(props.fuente_censo ?? props.capa_original ?? '').toLowerCase();
  if (source.includes('indec')) return 'indec_censo_2022';
  if (source.includes('georef')) return 'georef_argentina';
  return 'mapa2_public_data_v10_4';
}

function minimalProperties(props = {}) {
  return JSON.stringify({
    id_entidad: props.id_entidad ?? null,
    nombre: props.nombre ?? null,
    provincia_id: props.provincia_id ?? null,
    provincia_nombre: props.provincia_nombre ?? null,
    poblacion_total: props.poblacion_total ?? null,
    anio_censo: props.anio_censo ?? null,
    fuente_censo: props.fuente_censo ?? null,
    tipo_original: props.tipo_original ?? null,
    capa_original: props.capa_original ?? null,
    nivel_map_ready: props.nivel_map_ready ?? null,
    loading_strategy: props.loading_strategy ?? null
  });
}

const inputs = {
  provincesGeojson: firstExisting(['public/data/provincias.geojson', 'data/raw/georef/provincias.geojson']),
  departmentPolygons: firstExisting(['public/data/localidades_poligonos_departamentos.geojson']),
  governmentPolygons: firstExisting(['public/data/localidades_poligonos_gobiernos_locales.geojson']),
  municipalityPolygons: firstExisting(['public/data/localidades_poligonos_municipios.geojson']),
  pointsIndex: firstExisting(['public/data/indexes/localidades_puntos_index.json']),
  provinceCentroids: firstExisting(['data/semilla/provincias_georef_centroides.csv']),
  refeglo: firstExisting(['data/semilla/datos-refeglo_25-09-2023.csv', 'data/raw/mininterior/datos-refeglo_25-09-2023.csv']),
  clientsCsv: firstExisting(['data/output/business_v6/clientes_v6.csv', 'public/data/business/clientes.csv']),
  productsCsv: firstExisting(['data/output/business_v6/productos_v6.csv']),
  salesCsv: firstExisting(['data/output/business_v6/ventas_mensuales_v6.csv', 'public/data/business/ventas_mensuales.csv']),
  aggProvinceCsv: firstExisting(['data/output/business_v6/agregados_provincia_mes_v6.csv']),
  aggLocalityCsv: firstExisting(['data/output/business_v6/agregados_departamento_mes_v6.csv']),
  aggProductCsv: firstExisting(['data/output/business_v6/agregados_producto_mes_v6.csv'])
};

const requiredInputs = ['provincesGeojson', 'clientsCsv', 'productsCsv', 'salesCsv'];
const missingInputs = requiredInputs.filter((key) => !inputs[key]);
if (missingInputs.length > 0) {
  console.error(`[V11A] Faltan inputs obligatorios: ${missingInputs.join(', ')}`);
  process.exit(1);
}

const sourceRows = [
  {
    source_id: 'georef_argentina',
    source_name: 'Datos.gob.ar / Georef Argentina',
    source_type: 'official',
    source_url: 'https://datosgobar.github.io/georef-ar-api/',
    license: 'Datos abiertos públicos',
    retrieved_at: NOW,
    notes: 'Provincias, departamentos, municipios, gobiernos locales, localidades y geometrías públicas usadas como insumo territorial.'
  },
  {
    source_id: 'indec_censo_2022',
    source_name: 'INDEC Censo Nacional 2022',
    source_type: 'official',
    source_url: 'https://www.indec.gob.ar/',
    license: 'Datos públicos oficiales',
    retrieved_at: NOW,
    notes: 'Población censal 2022 consolidada en salidas map-ready de Mapa 2.'
  },
  {
    source_id: 'mininterior_refeglo_2023',
    source_name: 'Ministerio del Interior REFLO gobiernos locales 2023',
    source_type: 'official',
    source_url: 'https://www.argentina.gob.ar/interior/municipios',
    license: 'Datos públicos oficiales',
    retrieved_at: '2023-09-25',
    notes: 'Datos de gobiernos locales; se usa para extraer códigos postales presentes en direcciones de sedes municipales.'
  },
  {
    source_id: 'synthetic_business_v6',
    source_name: 'Mapa 2 V6 base comercial sintética de autopartes',
    source_type: 'synthetic',
    source_url: null,
    license: 'Interno del proyecto',
    retrieved_at: NOW,
    notes: 'Clientes, productos y ventas sintéticas 2025-01 a 2026-12. No representar como datos reales.'
  },
  {
    source_id: 'mapa2_public_data_v10_4',
    source_name: 'Mapa 2 V10.4 public/data map-ready',
    source_type: 'internal',
    source_url: null,
    license: 'Interno del proyecto',
    retrieved_at: NOW,
    notes: 'Assets geográficos optimizados y particionados preservados para compatibilidad del frontend estático.'
  },
  {
    source_id: 'mapa2_derived_v11a',
    source_name: 'Mapa 2 V11A derivados de migración D1',
    source_type: 'derived',
    source_url: null,
    license: 'Interno del proyecto',
    retrieved_at: NOW,
    notes: 'IDs estables, aliases, logs de matching, agregados cliente-mes y auditorías generadas desde datasets existentes.'
  }
];

const provinceRows = new Map();
const localityRows = new Map();
const postalRows = new Map();
const aliasRows = new Map();
const matchLogRows = [];
const censusRows = new Map();
const geometryRows = new Map();
const productRows = [];
const clientRows = [];
const saleRows = [];
const aggProvinceRows = [];
const aggLocalityRows = [];
const aggProductRows = [];
const aggClientRows = [];
const warnings = [];
const omitted = [];

const provinceCentroids = new Map();
if (inputs.provinceCentroids) {
  for (const row of readCsv(inputs.provinceCentroids)) {
    provinceCentroids.set(row.id, { lat: toNumber(row.centroide_lat), lng: toNumber(row.centroide_lon) });
  }
}

const provinceNameToId = new Map();
const provinceCodeToId = new Map();

function addAlias({ entityType, entityId, provinceId = null, aliasOriginal, sourceId, confidenceScore = 1, notes = null }) {
  if (!aliasOriginal || !entityId) return;
  const aliasNormalized = normalizeName(aliasOriginal);
  if (!aliasNormalized) return;
  const alias_id = stableId('alias', [entityType, entityId, provinceId, aliasNormalized]);
  if (!aliasRows.has(alias_id)) {
    aliasRows.set(alias_id, {
      alias_id,
      entity_type: entityType,
      entity_id: entityId,
      province_id: provinceId,
      alias_original: String(aliasOriginal),
      alias_normalized: aliasNormalized,
      source_id: sourceId,
      confidence_score: confidenceScore,
      notes,
      created_at: NOW
    });
  }
}

function addCensus({ entityType, entityId, provinceId = null, localityId = null, year, population, sourceId, confidenceLevel, notes = null }) {
  if (!entityType || !entityId || !year || population === null || population === undefined) return;
  const census_id = stableId('census', [entityType, entityId, year]);
  if (!censusRows.has(census_id)) {
    censusRows.set(census_id, {
      census_id,
      entity_type: entityType,
      entity_id: entityId,
      province_id: provinceId,
      locality_id: localityId,
      census_year: year,
      population_total: toInt(population),
      source_id: sourceId,
      confidence_level: confidenceLevel,
      notes,
      created_at: NOW
    });
  }
}

function addLocalityFromFeature(feature, layerType, assetPath) {
  const props = feature.properties ?? {};
  const entityId = props.id_entidad ?? props.localidad_id ?? props.gobierno_local_id ?? props.departamento_id;
  const provinceId = props.provincia_id;
  if (!entityId || !provinceId || !props.nombre) {
    omitted.push({ type: 'locality_feature', layerType, reason: 'missing_entity_province_or_name', value: props.nombre ?? null });
    return;
  }
  if (!provinceRows.has(provinceId)) {
    omitted.push({ type: 'locality_feature', layerType, reason: 'missing_parent_province', entityId, provinceId });
    return;
  }
  const sourceType = detectSourceType(entityId, props);
  const sourceId = sourceForProps(props);
  const { bbox, centroid } = geometryBbox(feature.geometry);
  const [pointLng, pointLat] = pointFromGeometry(feature.geometry);
  const centroidLng = pointLng ?? centroid[0];
  const centroidLat = pointLat ?? centroid[1];
  const name = String(props.nombre);
  const nameNormalized = props.nombre_normalizado ?? normalizeName(name);
  const row = {
    locality_id: entityId,
    province_id: provinceId,
    slug: `${String(provinceId).replace(':', '-')}-${slugify(name)}-${String(entityId).replace(/[^a-zA-Z0-9]+/g, '-')}`,
    source_type: sourceType,
    name,
    name_normalized: nameNormalized,
    official_code: props.codigo_georef ?? props.codigo_indec ?? null,
    indec_code: props.codigo_indec ?? null,
    georef_id: props.codigo_georef ?? null,
    parent_admin_id: props.departamento_id ?? props.gobierno_local_id ?? props.municipio_id ?? null,
    postal_code_primary: null,
    centroid_lat: centroidLat,
    centroid_lng: centroidLng,
    bbox_min_lng: bbox[0],
    bbox_min_lat: bbox[1],
    bbox_max_lng: bbox[2],
    bbox_max_lat: bbox[3],
    population_2022: toInt(props.poblacion_total),
    confidence_level: props.confianza_censo ?? null,
    data_source: props.fuente_censo ?? props.capa_original ?? null,
    source_id: sourceId,
    created_at: NOW,
    updated_at: NOW
  };
  const existing = localityRows.get(entityId);
  if (!existing || (existing.source_type !== 'departamento' && existing.source_type !== 'partido' && layerType === 'departamentos')) {
    localityRows.set(entityId, row);
  }
  addAlias({ entityType: 'locality', entityId, provinceId, aliasOriginal: name, sourceId, confidenceScore: 1, notes: `Alias principal desde ${layerType}` });
  addCensus({ entityType: 'locality', entityId, provinceId, localityId: entityId, year: 2022, population: props.poblacion_total, sourceId, confidenceLevel: props.confianza_censo ?? null, notes: `Población 2022 desde ${layerType}` });

  const isPoint = feature.geometry?.type === 'Point';
  const geometryJson = isPoint ? JSON.stringify(feature.geometry) : null;
  const geometry_id = stableId('geom', [entityId, layerType, isPoint ? 'point' : 'asset']);
  if (!geometryRows.has(geometry_id)) {
    geometryRows.set(geometry_id, {
      geometry_id,
      entity_type: 'locality',
      entity_id: entityId,
      province_id: provinceId,
      locality_id: entityId,
      layer_type: layerType,
      simplification_level: isPoint ? 'point' : 'asset_path_only',
      geometry_json: geometryJson && bytes(geometryJson) <= MAX_GEOMETRY_JSON_BYTES ? geometryJson : null,
      asset_path: assetPath,
      bbox_min_lng: bbox[0],
      bbox_min_lat: bbox[1],
      bbox_max_lng: bbox[2],
      bbox_max_lat: bbox[3],
      centroid_lat: centroidLat,
      centroid_lng: centroidLng,
      properties_json: minimalProperties(props),
      source_id: sourceId,
      created_at: NOW
    });
  }
}

// Provinces
const provincesGeo = readJson(inputs.provincesGeojson);
for (const feature of provincesGeo.features ?? []) {
  const props = feature.properties ?? {};
  const code = props.provincia_codigo ?? props.codigo_indec ?? props.id;
  const province_id = props.provincia_id ?? `provincia:${code}`;
  const name = props.provincia_nombre ?? props.nombre;
  const centroidFromCsv = provinceCentroids.get(code);
  const { bbox, centroid } = geometryBbox(feature.geometry);
  const centroidLat = centroidFromCsv?.lat ?? centroid[1];
  const centroidLng = centroidFromCsv?.lng ?? centroid[0];
  const row = {
    province_id,
    slug: `${code}-${slugify(name)}`,
    name,
    name_normalized: props.nombre_normalizado ?? normalizeName(name),
    official_code: props.codigo_georef ?? code,
    indec_code: props.codigo_indec ?? code,
    georef_id: props.codigo_georef ?? code,
    centroid_lat: centroidLat,
    centroid_lng: centroidLng,
    bbox_min_lng: bbox[0],
    bbox_min_lat: bbox[1],
    bbox_max_lng: bbox[2],
    bbox_max_lat: bbox[3],
    source_id: sourceForProps(props),
    created_at: NOW,
    updated_at: NOW
  };
  provinceRows.set(province_id, row);
  provinceNameToId.set(normalizeName(name), province_id);
  provinceCodeToId.set(String(code).padStart(2, '0'), province_id);
  addAlias({ entityType: 'province', entityId: province_id, provinceId: province_id, aliasOriginal: name, sourceId: row.source_id, confidenceScore: 1, notes: 'Alias principal de provincia' });
  addCensus({ entityType: 'province', entityId: province_id, provinceId: province_id, year: 2022, population: props.poblacion_total, sourceId: 'indec_censo_2022', confidenceLevel: props.confianza_censo ?? 'alta', notes: 'Población provincial 2022' });
  const geometry_id = stableId('geom', [province_id, 'province', 'asset']);
  geometryRows.set(geometry_id, {
    geometry_id,
    entity_type: 'province',
    entity_id: province_id,
    province_id,
    locality_id: null,
    layer_type: 'province',
    simplification_level: 'asset_path_only',
    geometry_json: null,
    asset_path: 'public/data/provincias.geojson',
    bbox_min_lng: bbox[0],
    bbox_min_lat: bbox[1],
    bbox_max_lng: bbox[2],
    bbox_max_lat: bbox[3],
    centroid_lat: centroidLat,
    centroid_lng: centroidLng,
    properties_json: minimalProperties(props),
    source_id: row.source_id,
    created_at: NOW
  });
}

function addFeaturesFromGeojson(filePath, layerType, assetPath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const geo = readJson(filePath);
  for (const feature of geo.features ?? []) {
    addLocalityFromFeature(feature, layerType, assetPath);
  }
}

addFeaturesFromGeojson(inputs.departmentPolygons, 'departamentos', 'public/data/localidades_poligonos_departamentos.geojson');
addFeaturesFromGeojson(inputs.governmentPolygons, 'gobiernos_locales', 'public/data/localidades_poligonos_gobiernos_locales.geojson');
addFeaturesFromGeojson(inputs.municipalityPolygons, 'municipios', 'public/data/localidades_poligonos_municipios.geojson');

if (inputs.pointsIndex) {
  const pointsIndex = readJson(inputs.pointsIndex);
  for (const item of pointsIndex.files ?? []) {
    const relativePath = item.relative_path;
    const abs = rel('public', 'data', ...relativePath.split('/'));
    if (!fs.existsSync(abs)) {
      warnings.push({ type: 'missing_points_asset', relativePath });
      continue;
    }
    addFeaturesFromGeojson(abs, 'localidades_puntos', `public/data/${relativePath}`);
  }
}

// Postal codes from REFLO / Ministerio del Interior address field.
if (inputs.refeglo) {
  const refegloRows = readCsv(inputs.refeglo);
  const postalRegex = /\((\d{4})\)/;
  for (const row of refegloRows) {
    const address = row.direccion_postal_de_la_sede_de_gobierno ?? '';
    const match = address.match(postalRegex);
    if (!match) continue;
    const postalCode = match[1];
    const provinceName = row.provincia ?? '';
    const localityName = row.nombre_del_gobierno_local ?? row.departamento ?? '';
    const provinceId = provinceNameToId.get(normalizeName(provinceName)) ?? null;
    const normalizedLocality = normalizeName(localityName);
    let localityId = null;
    if (provinceId && normalizedLocality) {
      for (const loc of localityRows.values()) {
        if (loc.province_id === provinceId && loc.name_normalized === normalizedLocality) {
          localityId = loc.locality_id;
          break;
        }
      }
    }
    const postal_code_id = stableId('postal', [postalCode, provinceId, normalizedLocality, address]);
    if (!postalRows.has(postal_code_id)) {
      postalRows.set(postal_code_id, {
        postal_code_id,
        postal_code: postalCode,
        postal_code_type: 'codigo_postal_basico',
        province_id: provinceId,
        locality_id: localityId,
        province_name_original: provinceName || null,
        locality_name_original: localityName || null,
        locality_name_normalized: normalizedLocality || null,
        source_id: 'mininterior_refeglo_2023',
        source_type: 'official',
        confidence_score: localityId ? 0.72 : 0.55,
        match_method: localityId ? 'refeglo_address_postal_code_regex_plus_province_locality_match' : 'refeglo_address_postal_code_regex_only',
        notes: 'Código postal extraído de la dirección postal de la sede de gobierno local; usar solo como señal auxiliar, no como verdad territorial única.',
        created_at: NOW,
        updated_at: NOW
      });
    }
  }
} else {
  warnings.push({ type: 'postal_codes', reason: 'No se encontró dataset interno REFLO para extraer códigos postales.' });
}

const clients = readCsv(inputs.clientsCsv);
const clientProvinceById = new Map();
const clientLocalityById = new Map();
const clientRawLocalityById = new Map();
for (const row of clients) {
  const provinceId = row.provincia_id || provinceCodeToId.get(row.provincia_codigo) || provinceNameToId.get(normalizeName(row.provincia_nombre)) || null;
  const departmentId = row.departamento_id || null;
  const rawLocalityId = row.localidad_id || null;
  const chosenLocalityId = departmentId || rawLocalityId || null;
  if (provinceId && chosenLocalityId && !localityRows.has(chosenLocalityId)) {
    const fallbackName = row.departamento_nombre || row.localidad_nombre || 'Localidad sin nombre';
    const sourceType = chosenLocalityId.startsWith('departamento:') ? detectSourceType(chosenLocalityId, { provincia_codigo: row.provincia_codigo, tipo_original: 'departamento' }) : detectSourceType(chosenLocalityId, { tipo_original: 'localidad' });
    localityRows.set(chosenLocalityId, {
      locality_id: chosenLocalityId,
      province_id: provinceId,
      slug: `${String(provinceId).replace(':', '-')}-${slugify(fallbackName)}-${String(chosenLocalityId).replace(/[^a-zA-Z0-9]+/g, '-')}`,
      source_type: sourceType,
      name: fallbackName,
      name_normalized: normalizeName(fallbackName),
      official_code: String(chosenLocalityId).split(':')[1] ?? null,
      indec_code: String(chosenLocalityId).split(':')[1] ?? null,
      georef_id: String(chosenLocalityId).split(':')[1] ?? null,
      parent_admin_id: departmentId !== chosenLocalityId ? departmentId : null,
      postal_code_primary: null,
      centroid_lat: toNumber(row.lat),
      centroid_lng: toNumber(row.lon),
      bbox_min_lng: toNumber(row.lon),
      bbox_min_lat: toNumber(row.lat),
      bbox_max_lng: toNumber(row.lon),
      bbox_max_lat: toNumber(row.lat),
      population_2022: null,
      confidence_level: 'derivada_cliente_sintetico',
      data_source: 'synthetic_business_v6',
      source_id: 'synthetic_business_v6',
      created_at: NOW,
      updated_at: NOW
    });
    addAlias({ entityType: 'locality', entityId: chosenLocalityId, provinceId, aliasOriginal: fallbackName, sourceId: 'synthetic_business_v6', confidenceScore: 0.58, notes: 'Localidad creada como fallback desde cliente sintético V6.' });
  }
  const client = {
    client_id: row.cliente_id,
    client_name: row.cliente_nombre,
    province_id: provinceId,
    locality_id: chosenLocalityId,
    department_id: departmentId,
    raw_locality_id: rawLocalityId,
    raw_locality_name: row.localidad_nombre || null,
    postal_code: row.codigo_postal || row.postal_code || null,
    lat: toNumber(row.lat),
    lng: toNumber(row.lon),
    segment: row.segmento_cliente || null,
    client_type: row.tipo_cliente || null,
    territorial_match_method: provinceId && chosenLocalityId ? 'direct_business_v6_ids_department_as_normalized_locality' : 'missing_or_partial_business_v6_ids',
    territorial_match_confidence: toNumber(row.confianza_geocodificacion) ?? (provinceId && chosenLocalityId ? 0.86 : 0.25),
    synthetic_flag: toBoolInt(row.dato_sintetico, 1),
    created_at: row.fecha_alta || NOW,
    updated_at: NOW
  };
  clientRows.push(client);
  clientProvinceById.set(client.client_id, provinceId);
  clientLocalityById.set(client.client_id, chosenLocalityId);
  clientRawLocalityById.set(client.client_id, rawLocalityId);
  matchLogRows.push({
    match_id: stableId('match', ['client', row.cliente_id]),
    input_type: 'client',
    input_value: row.cliente_id,
    province_input: row.provincia_nombre || row.provincia_codigo || null,
    locality_input: row.localidad_nombre || row.departamento_nombre || null,
    postal_code_input: client.postal_code,
    matched_province_id: provinceId,
    matched_locality_id: chosenLocalityId,
    matched_by: client.territorial_match_method,
    confidence_score: client.territorial_match_confidence,
    status: provinceId && chosenLocalityId ? 'matched' : 'manual_review',
    notes: departmentId ? 'Cliente normalizado a departamento/partido/comuna para compatibilidad con click poligonal V11C; localidad granular preservada en raw_locality_id.' : 'Cliente preservado con localidad granular por falta de departamento.',
    created_at: NOW
  });
}

// Products
for (const row of readCsv(inputs.productsCsv)) {
  productRows.push({
    product_id: row.producto_id,
    sku: row.producto_id,
    product_name: row.producto_nombre,
    category: row.categoria_producto || null,
    subcategory: row.subcategoria_producto || null,
    brand: row.marca_ficticia || null,
    unit_measure: row.unidad_medida || null,
    base_price: toNumber(row.precio_base),
    estimated_weight_kg: toNumber(row.peso_estimado_kg),
    base_margin_pct: toNumber(row.margen_base_pct),
    synthetic_flag: toBoolInt(row.dato_sintetico, 1),
    created_at: NOW,
    updated_at: NOW
  });
}

// Sales and client-month aggregates
const clientMonthAgg = new Map();
const sales = readCsv(inputs.salesCsv);
for (const row of sales) {
  const sale = {
    sale_id: row.venta_id,
    client_id: row.cliente_id,
    product_id: row.producto_id,
    period_yyyymm: row.periodo,
    year: toInt(row.anio),
    month: toInt(row.mes),
    units: toNumber(row.unidades),
    net_sales: toNumber(row.venta_neta),
    estimated_cost: toNumber(row.costo_estimado),
    gross_margin: toNumber(row.margen_bruto),
    volume_kg: toNumber(row.volumen_kg),
    synthetic_flag: toBoolInt(row.dato_sintetico, 1),
    created_at: NOW
  };
  saleRows.push(sale);
  const key = `${sale.client_id}|${sale.period_yyyymm}`;
  const agg = clientMonthAgg.get(key) ?? {
    aggregate_id: stableId('agg-client-month', [sale.client_id, sale.period_yyyymm]),
    province_id: clientProvinceById.get(sale.client_id) ?? null,
    locality_id: clientLocalityById.get(sale.client_id) ?? null,
    client_id: sale.client_id,
    product_id: null,
    period_yyyymm: sale.period_yyyymm,
    year: sale.year,
    month: sale.month,
    client_count: 1,
    sales_count: 0,
    units: 0,
    net_sales: 0,
    estimated_cost: 0,
    gross_margin: 0,
    volume_kg: 0,
    created_at: NOW
  };
  agg.sales_count += 1;
  agg.units += sale.units ?? 0;
  agg.net_sales += sale.net_sales ?? 0;
  agg.estimated_cost += sale.estimated_cost ?? 0;
  agg.gross_margin += sale.gross_margin ?? 0;
  agg.volume_kg += sale.volume_kg ?? 0;
  clientMonthAgg.set(key, agg);
}
for (const agg of clientMonthAgg.values()) {
  for (const field of ['units', 'net_sales', 'estimated_cost', 'gross_margin', 'volume_kg']) {
    agg[field] = Number(agg[field].toFixed(2));
  }
  aggClientRows.push(agg);
}

function pushProvinceAgg(row) {
  aggProvinceRows.push({
    aggregate_id: stableId('agg-prov-month', [row.provincia_id, row.periodo]),
    province_id: row.provincia_id,
    locality_id: null,
    client_id: null,
    product_id: null,
    period_yyyymm: row.periodo,
    year: toInt(row.anio),
    month: toInt(row.mes),
    client_count: toInt(row.clientes_unicos),
    sales_count: toInt(row.registros_venta),
    units: toNumber(row.unidades),
    net_sales: toNumber(row.venta_neta),
    estimated_cost: toNumber(row.costo_estimado),
    gross_margin: toNumber(row.margen_bruto),
    volume_kg: toNumber(row.volumen_kg),
    created_at: NOW
  });
}
if (inputs.aggProvinceCsv) readCsv(inputs.aggProvinceCsv).forEach(pushProvinceAgg);

function pushLocalityAgg(row) {
  const localityId = row.departamento_id;
  aggLocalityRows.push({
    aggregate_id: stableId('agg-loc-month', [localityId, row.periodo]),
    province_id: row.provincia_id,
    locality_id: localityId,
    client_id: null,
    product_id: null,
    period_yyyymm: row.periodo,
    year: toInt(row.anio),
    month: toInt(row.mes),
    client_count: toInt(row.clientes_unicos),
    sales_count: toInt(row.registros_venta),
    units: toNumber(row.unidades),
    net_sales: toNumber(row.venta_neta),
    estimated_cost: toNumber(row.costo_estimado),
    gross_margin: toNumber(row.margen_bruto),
    volume_kg: toNumber(row.volumen_kg),
    created_at: NOW
  });
}
if (inputs.aggLocalityCsv) readCsv(inputs.aggLocalityCsv).forEach(pushLocalityAgg);

function pushProductAgg(row) {
  aggProductRows.push({
    aggregate_id: stableId('agg-prod-month', [row.producto_id, row.periodo]),
    province_id: null,
    locality_id: null,
    client_id: null,
    product_id: row.producto_id,
    period_yyyymm: row.periodo,
    year: toInt(row.anio),
    month: toInt(row.mes),
    client_count: toInt(row.clientes_unicos),
    sales_count: toInt(row.registros_venta),
    units: toNumber(row.unidades),
    net_sales: toNumber(row.venta_neta),
    estimated_cost: toNumber(row.costo_estimado),
    gross_margin: toNumber(row.margen_bruto),
    volume_kg: toNumber(row.volumen_kg),
    created_at: NOW
  });
}
if (inputs.aggProductCsv) readCsv(inputs.aggProductCsv).forEach(pushProductAgg);

// App metadata.
const metadataRows = [
  { metadata_key: 'mapa2_version_base', metadata_value: 'V10.4 Architecture Decision', value_type: 'string', notes: 'Versión estática de referencia preservada.', updated_at: NOW },
  { metadata_key: 'mapa2_v11a_status', metadata_value: 'D1 schema and local migration pipeline generated', value_type: 'string', notes: 'No implementa APIs ni rediseño UI.', updated_at: NOW },
  { metadata_key: 'territorial_model', metadata_value: 'Pais -> Provincia -> Localidad', value_type: 'string', notes: 'Localidad puede representar localidad, barrio, municipio, departamento, partido, comuna, aglomerado o división equivalente.', updated_at: NOW },
  { metadata_key: 'business_data_notice', metadata_value: 'synthetic', value_type: 'string', notes: 'Clientes, productos y ventas V6 son sintéticos.', updated_at: NOW }
];

// Integrity checks.
const requiredProductIds = new Set(productRows.map((r) => r.product_id));
const requiredClientIds = new Set(clientRows.map((r) => r.client_id));
const orphanSalesWithoutClient = saleRows.filter((r) => !requiredClientIds.has(r.client_id)).length;
const orphanSalesWithoutProduct = saleRows.filter((r) => !requiredProductIds.has(r.product_id)).length;
const orphanClientsWithoutProvince = clientRows.filter((r) => !r.province_id || !provinceRows.has(r.province_id)).length;
const orphanClientsWithoutLocality = clientRows.filter((r) => !r.locality_id || !localityRows.has(r.locality_id)).length;
const localitiesWithoutProvince = [...localityRows.values()].filter((r) => !r.province_id || !provinceRows.has(r.province_id)).length;
const salePeriods = [...new Set(saleRows.map((r) => r.period_yyyymm))].sort();

if (orphanSalesWithoutClient > 0) warnings.push({ type: 'integrity', reason: 'orphan_sales_without_client', count: orphanSalesWithoutClient });
if (orphanSalesWithoutProduct > 0) warnings.push({ type: 'integrity', reason: 'orphan_sales_without_product', count: orphanSalesWithoutProduct });
if (orphanClientsWithoutProvince > 0) warnings.push({ type: 'integrity', reason: 'orphan_clients_without_province', count: orphanClientsWithoutProvince });
if (orphanClientsWithoutLocality > 0) warnings.push({ type: 'integrity', reason: 'orphan_clients_without_locality', count: orphanClientsWithoutLocality });
if (localitiesWithoutProvince > 0) warnings.push({ type: 'integrity', reason: 'localities_without_province', count: localitiesWithoutProvince });

const tableColumns = {
  source_catalog: ['source_id', 'source_name', 'source_type', 'source_url', 'license', 'retrieved_at', 'notes'],
  app_metadata: ['metadata_key', 'metadata_value', 'value_type', 'notes', 'updated_at'],
  province: ['province_id', 'slug', 'name', 'name_normalized', 'official_code', 'indec_code', 'georef_id', 'centroid_lat', 'centroid_lng', 'bbox_min_lng', 'bbox_min_lat', 'bbox_max_lng', 'bbox_max_lat', 'source_id', 'created_at', 'updated_at'],
  locality: ['locality_id', 'province_id', 'slug', 'source_type', 'name', 'name_normalized', 'official_code', 'indec_code', 'georef_id', 'parent_admin_id', 'postal_code_primary', 'centroid_lat', 'centroid_lng', 'bbox_min_lng', 'bbox_min_lat', 'bbox_max_lng', 'bbox_max_lat', 'population_2022', 'confidence_level', 'data_source', 'source_id', 'created_at', 'updated_at'],
  postal_code_area: ['postal_code_id', 'postal_code', 'postal_code_type', 'province_id', 'locality_id', 'province_name_original', 'locality_name_original', 'locality_name_normalized', 'source_id', 'source_type', 'confidence_score', 'match_method', 'notes', 'created_at', 'updated_at'],
  territorial_alias: ['alias_id', 'entity_type', 'entity_id', 'province_id', 'alias_original', 'alias_normalized', 'source_id', 'confidence_score', 'notes', 'created_at'],
  territorial_match_log: ['match_id', 'input_type', 'input_value', 'province_input', 'locality_input', 'postal_code_input', 'matched_province_id', 'matched_locality_id', 'matched_by', 'confidence_score', 'status', 'notes', 'created_at'],
  census_population: ['census_id', 'entity_type', 'entity_id', 'province_id', 'locality_id', 'census_year', 'population_total', 'source_id', 'confidence_level', 'notes', 'created_at'],
  geometry_feature: ['geometry_id', 'entity_type', 'entity_id', 'province_id', 'locality_id', 'layer_type', 'simplification_level', 'geometry_json', 'asset_path', 'bbox_min_lng', 'bbox_min_lat', 'bbox_max_lng', 'bbox_max_lat', 'centroid_lat', 'centroid_lng', 'properties_json', 'source_id', 'created_at'],
  client: ['client_id', 'client_name', 'province_id', 'locality_id', 'department_id', 'raw_locality_id', 'raw_locality_name', 'postal_code', 'lat', 'lng', 'segment', 'client_type', 'territorial_match_method', 'territorial_match_confidence', 'synthetic_flag', 'created_at', 'updated_at'],
  product: ['product_id', 'sku', 'product_name', 'category', 'subcategory', 'brand', 'unit_measure', 'base_price', 'estimated_weight_kg', 'base_margin_pct', 'synthetic_flag', 'created_at', 'updated_at'],
  sale_monthly: ['sale_id', 'client_id', 'product_id', 'period_yyyymm', 'year', 'month', 'units', 'net_sales', 'estimated_cost', 'gross_margin', 'volume_kg', 'synthetic_flag', 'created_at'],
  sales_aggregate_province_month: ['aggregate_id', 'province_id', 'locality_id', 'client_id', 'product_id', 'period_yyyymm', 'year', 'month', 'client_count', 'sales_count', 'units', 'net_sales', 'estimated_cost', 'gross_margin', 'volume_kg', 'created_at'],
  sales_aggregate_locality_month: ['aggregate_id', 'province_id', 'locality_id', 'client_id', 'product_id', 'period_yyyymm', 'year', 'month', 'client_count', 'sales_count', 'units', 'net_sales', 'estimated_cost', 'gross_margin', 'volume_kg', 'created_at'],
  sales_aggregate_product_month: ['aggregate_id', 'province_id', 'locality_id', 'client_id', 'product_id', 'period_yyyymm', 'year', 'month', 'client_count', 'sales_count', 'units', 'net_sales', 'estimated_cost', 'gross_margin', 'volume_kg', 'created_at'],
  sales_aggregate_client_month: ['aggregate_id', 'province_id', 'locality_id', 'client_id', 'product_id', 'period_yyyymm', 'year', 'month', 'client_count', 'sales_count', 'units', 'net_sales', 'estimated_cost', 'gross_margin', 'volume_kg', 'created_at']
};

function statementsFor(table, rows) {
  const columns = tableColumns[table];
  return rows.map((row) => insertSql(table, columns, row));
}

const chunks = [
  {
    file: 'seed_001_sources_territory.sql',
    description: 'Fuentes, metadata, provincias, localidades, postal codes, aliases, censos y geometrías livianas/asset paths.',
    statements: [
      ...statementsFor('source_catalog', sourceRows),
      ...statementsFor('app_metadata', metadataRows),
      ...statementsFor('province', [...provinceRows.values()]),
      ...statementsFor('locality', [...localityRows.values()]),
      ...statementsFor('postal_code_area', [...postalRows.values()]),
      ...statementsFor('territorial_alias', [...aliasRows.values()]),
      ...statementsFor('census_population', [...censusRows.values()]),
      ...statementsFor('geometry_feature', [...geometryRows.values()])
    ]
  },
  {
    file: 'seed_002_business_core_and_aggregates.sql',
    description: 'Productos, clientes, logs de matching y agregados comerciales precomputados.',
    statements: [
      ...statementsFor('product', productRows),
      ...statementsFor('client', clientRows),
      ...statementsFor('territorial_match_log', matchLogRows),
      ...statementsFor('sales_aggregate_province_month', aggProvinceRows),
      ...statementsFor('sales_aggregate_locality_month', aggLocalityRows),
      ...statementsFor('sales_aggregate_product_month', aggProductRows),
      ...statementsFor('sales_aggregate_client_month', aggClientRows)
    ]
  },
  {
    file: 'seed_003_sales_2025.sql',
    description: 'Ventas mensuales sintéticas del período 2025.',
    statements: statementsFor('sale_monthly', saleRows.filter((r) => r.year === 2025))
  },
  {
    file: 'seed_004_sales_2026.sql',
    description: 'Ventas mensuales sintéticas del período 2026.',
    statements: statementsFor('sale_monthly', saleRows.filter((r) => r.year === 2026))
  }
];

for (const chunk of chunks) {
  const content = [
    `-- Mapa 2 V11A D1 seed chunk: ${chunk.file}`,
    `-- ${chunk.description}`,
    'PRAGMA foreign_keys = ON;',
    'BEGIN TRANSACTION;',
    ...chunk.statements,
    'COMMIT;',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(CHUNK_DIR, chunk.file), content, 'utf8');
  chunk.statementCount = chunk.statements.length;
  chunk.sizeBytes = bytes(content);
  chunk.maxStatementBytes = Math.max(...chunk.statements.map((stmt) => bytes(stmt)), 0);
  delete chunk.statements;
}

const fullSeedParts = chunks.map((chunk) => readText(path.join(CHUNK_DIR, chunk.file)));
const fullSeed = [
  '-- Mapa 2 V11A D1 full seed. Para Cloudflare Free remoto, preferir chunks documentados.',
  '-- Ejecutar después de migrations/0001_schema.sql.',
  ...fullSeedParts,
  ''
].join('\n');
fs.writeFileSync(path.join(OUT_DIR, 'seed.sql'), fullSeed, 'utf8');

const tableCounts = {
  source_catalog: sourceRows.length,
  app_metadata: metadataRows.length,
  province: provinceRows.size,
  locality: localityRows.size,
  postal_code_area: postalRows.size,
  territorial_alias: aliasRows.size,
  territorial_match_log: matchLogRows.length,
  census_population: censusRows.size,
  geometry_feature: geometryRows.size,
  client: clientRows.length,
  product: productRows.length,
  sale_monthly: saleRows.length,
  sales_aggregate_province_month: aggProvinceRows.length,
  sales_aggregate_locality_month: aggLocalityRows.length,
  sales_aggregate_product_month: aggProductRows.length,
  sales_aggregate_client_month: aggClientRows.length,
  schema_migrations: 1
};
const totalRows = Object.values(tableCounts).reduce((a, b) => a + b, 0);
const fullSeedSizeBytes = fs.statSync(path.join(OUT_DIR, 'seed.sql')).size;
const maxChunkStatementBytes = Math.max(...chunks.map((chunk) => chunk.maxStatementBytes));
const geometryStats = [...geometryRows.values()].reduce((acc, row) => {
  if (row.geometry_json) acc.geometry_json_rows += 1;
  if (row.asset_path) acc.asset_path_rows += 1;
  if (row.geometry_json && bytes(row.geometry_json) > MAX_GEOMETRY_JSON_BYTES) acc.omitted_heavy_geometry += 1;
  return acc;
}, { geometry_json_rows: 0, asset_path_rows: 0, omitted_heavy_geometry: 0 });

const summary = {
  project: 'Mapa 2',
  phase: 'V11A D1 Schema + Migración local',
  generated_at: NOW,
  seed_version: SEED_VERSION,
  input_files: Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, value ? path.relative(ROOT, value).replaceAll(path.sep, '/') : null])),
  table_counts: tableCounts,
  total_rows: totalRows,
  sale_period: {
    from: salePeriods[0] ?? null,
    to: salePeriods[salePeriods.length - 1] ?? null,
    period_count: salePeriods.length
  },
  business_integrity: {
    expected_clients_v6: 2000,
    actual_clients: clientRows.length,
    actual_products: productRows.length,
    actual_sales: saleRows.length,
    orphan_sales_without_client: orphanSalesWithoutClient,
    orphan_sales_without_product: orphanSalesWithoutProduct,
    orphan_clients_without_province: orphanClientsWithoutProvince,
    orphan_clients_without_locality: orphanClientsWithoutLocality,
    localities_without_province: localitiesWithoutProvince,
    synthetic_rows_preserved: clientRows.every((r) => r.synthetic_flag === 1) && productRows.every((r) => r.synthetic_flag === 1) && saleRows.every((r) => r.synthetic_flag === 1)
  },
  geometry_policy: {
    max_geometry_json_bytes: MAX_GEOMETRY_JSON_BYTES,
    geometry_json_rows: geometryStats.geometry_json_rows,
    asset_path_rows: geometryStats.asset_path_rows,
    rule: 'Polígonos pesados quedan como asset_path + bbox + centroide; D1 no se usa como PostGIS.'
  },
  postal_codes: {
    rows: postalRows.size,
    strategy: 'Extracción inicial desde direcciones postales REFLO incluidas en el proyecto. No es dataset postal exhaustivo.',
    confidence_rule: 'Código postal es señal auxiliar; requiere cruce con provincia, localidad, alias, código oficial o coordenadas.'
  },
  chunks,
  file_sizes: {
    seed_sql_bytes: fullSeedSizeBytes,
    seed_sql_mb: Number((fullSeedSizeBytes / 1024 / 1024).toFixed(3)),
    max_statement_bytes: maxChunkStatementBytes
  },
  warnings,
  omitted,
  status: (orphanSalesWithoutClient || orphanSalesWithoutProduct || orphanClientsWithoutProvince || localitiesWithoutProvince) ? 'BLOCKED' : 'OK_WITH_REMOTE_IMPORT_WARNINGS',
  notes: [
    'V11A no implementa backend API ni frontend API-first.',
    'El frontend estático V10.4 se preserva.',
    'Para remoto Cloudflare Free revisar docs/V11A_CLOUDFLARE_STEPS.md porque la carga completa puede exceder filas escritas diarias.'
  ]
};

fs.writeFileSync(path.join(OUT_DIR, 'seed_summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');

console.log(`[V11A] Seed generado: data/d1/seed.sql (${summary.file_sizes.seed_sql_mb} MB)`);
console.log(`[V11A] Filas totales estimadas: ${totalRows}`);
console.log(`[V11A] Clientes: ${clientRows.length}; productos: ${productRows.length}; ventas: ${saleRows.length}`);
console.log(`[V11A] Localidades normalizadas: ${localityRows.size}; provincias: ${provinceRows.size}; códigos postales: ${postalRows.size}`);
console.log(`[V11A] Estado: ${summary.status}`);
