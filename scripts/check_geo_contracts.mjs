import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertCount,
  ensureFile,
  exitIfViolations,
  finalStatus,
  publicAssetAudit,
  readJson,
  recordsOf,
  writeJson,
  writeMd,
} from './lib/contract_helpers.mjs';

const root = process.cwd();
const docsDir = join(root, 'docs');

const paths = {
  provinciasGeo: join(root, 'public/data/provincias.geojson'),
  provinciasIndex: join(root, 'public/data/indexes/provincias_index.json'),
  clientesGeo: join(root, 'public/data/business/clientes.geojson'),
  clienteTotales: join(root, 'public/data/business/agregados/ventas_cliente_totales.json'),
  dataPaths: join(root, 'src/data/dataPaths.ts'),
  dataManifest: join(root, 'src/data/dataManifest.ts'),
};

const violations = [];
const warnings = [];
for (const [label, path] of Object.entries(paths)) ensureFile(path, violations, label);
if (violations.length) exitIfViolations('geo-contracts-v10.3', violations);

const provinciasGeo = readJson(paths.provinciasGeo);
const provinciasIndex = readJson(paths.provinciasIndex);
const clientesGeo = readJson(paths.clientesGeo);
const ventasClienteTotales = recordsOf(readJson(paths.clienteTotales));

assertCount('provincias.geojson features', provinciasGeo.features?.length ?? 0, 24, violations);
assertCount('provincias_index.json provinces', Object.keys(provinciasIndex.provinces ?? {}).length, 24, violations);

const provinceIdsFromGeo = new Set((provinciasGeo.features ?? []).map((feature) => String(feature.properties?.id_entidad ?? feature.properties?.provincia_id ?? '')).filter(Boolean));
const provinceIdsFromIndex = new Set(Object.keys(provinciasIndex.provinces ?? {}));
for (const id of provinceIdsFromIndex) {
  if (!provinceIdsFromGeo.has(id)) violations.push(`Provincia en índice sin feature en provincias.geojson: ${id}`);
}

const departmentIds = new Set();
const departmentLayerSummary = [];
for (const province of Object.values(provinciasIndex.provinces ?? {})) {
  const relativePath = province.layers?.departamentos?.relative_path;
  if (!relativePath) {
    violations.push(`Provincia sin layer departamentos: ${province.provincia_id}`);
    continue;
  }
  const absolutePath = join(root, 'public/data', relativePath.replace(/^data\//, ''));
  if (!existsSync(absolutePath)) {
    violations.push(`No existe capa departamentos declarada: ${relativePath}`);
    continue;
  }
  const geo = readJson(absolutePath);
  const features = geo.features ?? [];
  if (features.length === 0) violations.push(`Capa departamentos vacía: ${relativePath}`);
  if (features.some((feature) => !feature.geometry)) violations.push(`Capa departamentos con geometría vacía: ${relativePath}`);
  departmentLayerSummary.push({ provincia_id: province.provincia_id, path: relativePath, features: features.length });
  for (const feature of features) {
    const id = String(feature.properties?.id_entidad ?? feature.properties?.departamento_id ?? '');
    if (id) departmentIds.add(id);
  }
}

for (const client of ventasClienteTotales) {
  if (!provinceIdsFromGeo.has(client.provincia_id)) violations.push(`Cliente ${client.cliente_id} referencia provincia sin GeoJSON: ${client.provincia_id}`);
  if (!departmentIds.has(client.departamento_id)) violations.push(`Cliente ${client.cliente_id} referencia departamento sin geometría: ${client.departamento_id}`);
  if (violations.length > 50) break;
}

for (const feature of clientesGeo.features ?? []) {
  const props = feature.properties ?? {};
  if (!provinceIdsFromGeo.has(props.provincia_id)) violations.push(`Feature cliente ${props.cliente_id || ''} referencia provincia sin GeoJSON: ${props.provincia_id}`);
  if (!departmentIds.has(props.departamento_id)) violations.push(`Feature cliente ${props.cliente_id || ''} referencia departamento sin geometría: ${props.departamento_id}`);
  if (violations.length > 50) break;
}

const publicAudit = publicAssetAudit(root, violations, warnings);

const manifestSource = await import('node:fs').then(({ readFileSync }) => readFileSync(paths.dataManifest, 'utf8'));
const dataPathsSource = await import('node:fs').then(({ readFileSync }) => readFileSync(paths.dataPaths, 'utf8'));
const initialManifestSource = manifestSource.split('lazy:')[0] ?? '';
if (/radios/i.test(initialManifestSource)) violations.push('dataManifest incluye radios dentro de initial. Deben ser carga bajo demanda.');
if (/clientes\.geojson/i.test(initialManifestSource)) violations.push('dataManifest incluye clientes.geojson dentro de initial. Debe ser lazy.');
if (/ventas_mensuales\.csv/i.test(initialManifestSource)) violations.push('dataManifest incluye ventas_mensuales.csv dentro de initial. Debe ser lazy.');
if (!dataPathsSource.includes('DATA_MANIFEST')) warnings.push('dataPaths.ts no usa dataManifest como fuente central.');

const report = {
  phase: 'V10.3 — Geo/census contract checks',
  generated_at: new Date().toISOString(),
  status: finalStatus(violations),
  actual: {
    provincias_geojson_features: provinciasGeo.features?.length ?? 0,
    provincias_index_count: Object.keys(provinciasIndex.provinces ?? {}).length,
    departamentos_ids: departmentIds.size,
    clientes_agregados: ventasClienteTotales.length,
    clientes_geojson_features: clientesGeo.features?.length ?? 0,
    public_data_files: publicAudit.fileCount,
    max_public_asset: publicAudit.maxAsset,
    top_public_assets: publicAudit.top,
  },
  departmentLayerSummary,
  warnings,
  violations,
};

writeJson(join(docsDir, 'GEO_CONTRACT_AUDIT_V10_3.json'), report);
writeMd(join(docsDir, 'GEO_CONTRACT_AUDIT_V10_3.md'), `# Mapa 2 — Auditoría contrato geográfico/censal V10.3\n\n` +
  `**Resultado:** ${report.status}\n\n` +
  `## Checks principales\n\n` +
  `- Provincias GeoJSON: \`${report.actual.provincias_geojson_features}\`\n` +
  `- Provincias índice: \`${report.actual.provincias_index_count}\`\n` +
  `- IDs de departamentos/partidos con geometría: \`${report.actual.departamentos_ids}\`\n` +
  `- Clientes agregados validados contra geometrías: \`${report.actual.clientes_agregados}\`\n` +
  `- Archivos public/data: \`${report.actual.public_data_files}\`\n` +
  `- Mayor asset público: \`${report.actual.max_public_asset.rel}\` (${(report.actual.max_public_asset.size / 1024 / 1024).toFixed(3)} MiB)\n\n` +
  `## Advertencias\n\n${warnings.length ? warnings.map((item) => `- ${item}`).join('\n') : '- Sin advertencias.'}\n\n` +
  `## Errores bloqueantes\n\n${violations.length ? violations.map((item) => `- ${item}`).join('\n') : '- Sin errores bloqueantes.'}\n`);

console.log('[geo-contracts-v10.3] OK auditoría geográfica/censal generada');
console.log(`[geo-contracts-v10.3] provincias=${report.actual.provincias_geojson_features} departamentos_ids=${departmentIds.size} max_asset=${report.actual.max_public_asset.rel}`);
exitIfViolations('geo-contracts-v10.3', violations);
