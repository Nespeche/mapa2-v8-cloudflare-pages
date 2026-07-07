import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureFile, exitIfViolations, finalStatus, publicAssetAudit, readJson, writeJson, writeMd } from './lib/contract_helpers.mjs';

const root = process.cwd();
const docsDir = join(root, 'docs');
const violations = [];
const warnings = [];

const requiredFiles = [
  'src/domain/appVersion.ts',
  'src/domain/businessContracts.ts',
  'src/domain/geoContracts.ts',
  'src/domain/dataContracts.ts',
  'src/services/commercialMetrics.ts',
  'src/services/filterEngine.ts',
  'src/services/geoEnrichment.ts',
  'src/data/dataManifest.ts',
  'src/data/dataValidators.ts',
  'public/data/provincias.geojson',
  'public/data/indexes/provincias_index.json',
  'public/data/business/metadata_business_v6.json',
  'public/data/business/clientes.geojson',
  'public/data/business/ventas_mensuales.csv',
  'public/data/business/agregados/ventas_cliente_totales.json',
  'public/data/business/agregados/ventas_departamento_mes.json',
  'public/data/business/agregados/ventas_producto_mes.json',
  'public/data/business/agregados/ventas_provincia_mes.json',
];

for (const relativePath of requiredFiles) ensureFile(join(root, relativePath), violations, relativePath);

const packageJsonPath = join(root, 'package.json');
if (ensureFile(packageJsonPath, violations, 'package.json')) {
  const pkg = readJson(packageJsonPath);
  const requiredScripts = {
    'check:data-contracts': 'node scripts/check_data_contracts.mjs',
    'check:business-contracts': 'node scripts/check_business_contracts.mjs',
    'check:geo-contracts': 'node scripts/check_geo_contracts.mjs',
    'validate:release': 'npm run build && npm run check:data-contracts && npm run check:business-contracts && npm run check:geo-contracts',
  };
  for (const [name, expected] of Object.entries(requiredScripts)) {
    if (pkg.scripts?.[name] !== expected) violations.push(`package.json script ${name} esperado: ${expected}. Actual: ${pkg.scripts?.[name] ?? 'N/A'}`);
  }
}

const appVersion = existsSync(join(root, 'src/domain/appVersion.ts')) ? readFileSync(join(root, 'src/domain/appVersion.ts'), 'utf8') : '';
if (!appVersion.includes('V10.3')) violations.push('appVersion.ts no declara V10.3.');

const manifest = existsSync(join(root, 'src/data/dataManifest.ts')) ? readFileSync(join(root, 'src/data/dataManifest.ts'), 'utf8') : '';
const initialManifestSource = manifest.split('lazy:')[0] ?? '';
if (/clientes\.geojson/i.test(initialManifestSource)) violations.push('clientes.geojson aparece en initial data manifest.');
if (/ventas_mensuales\.csv/i.test(initialManifestSource)) violations.push('ventas_mensuales.csv aparece en initial data manifest.');
if (/radios/i.test(initialManifestSource)) violations.push('radios aparecen en initial data manifest.');

const dataClient = existsSync(join(root, 'src/data/dataClient.ts')) ? readFileSync(join(root, 'src/data/dataClient.ts'), 'utf8') : '';
for (const validator of ['validateInitialDataBundle', 'validateClientesGeo', 'validateDepartmentMonthSales', 'validateProductMonthSales', 'validateDetailedSales', 'validateProvinceLayer']) {
  if (!dataClient.includes(validator)) violations.push(`dataClient.ts no ejecuta ${validator}.`);
}

const businessContracts = existsSync(join(root, 'src/domain/businessContracts.ts')) ? readFileSync(join(root, 'src/domain/businessContracts.ts'), 'utf8') : '';
for (const kpi of ['clientesVisibles', 'ventaNeta', 'unidades', 'margenBruto', 'ticketPromedio', 'provinciaLider', 'productoLider', 'categoriaLider', 'fuente']) {
  if (!businessContracts.includes(kpi)) violations.push(`businessContracts.ts no documenta semántica KPI: ${kpi}`);
}

const publicAudit = publicAssetAudit(root, violations, warnings);

const report = {
  phase: 'V10.3 — Data contract umbrella checks',
  generated_at: new Date().toISOString(),
  status: finalStatus(violations),
  requiredFiles: requiredFiles.length,
  publicAudit,
  warnings,
  violations,
};

writeJson(join(docsDir, 'DATA_CONTRACT_AUDIT_V10_3.json'), report);
writeMd(join(docsDir, 'DATA_CONTRACT_AUDIT_V10_3.md'), `# Mapa 2 — Auditoría general de contratos de datos V10.3\n\n` +
  `**Resultado:** ${report.status}\n\n` +
  `## Checks\n\n` +
  `- Archivos obligatorios revisados: \`${requiredFiles.length}\`\n` +
  `- Archivos public/data: \`${publicAudit.fileCount}\`\n` +
  `- Mayor asset público: \`${publicAudit.maxAsset.rel}\` (${(publicAudit.maxAsset.size / 1024 / 1024).toFixed(3)} MiB)\n` +
  `- Validadores runtime conectados en \`src/data/dataClient.ts\`.\n\n` +
  `## Advertencias\n\n${warnings.length ? warnings.map((item) => `- ${item}`).join('\n') : '- Sin advertencias.'}\n\n` +
  `## Errores bloqueantes\n\n${violations.length ? violations.map((item) => `- ${item}`).join('\n') : '- Sin errores bloqueantes.'}\n`);

console.log('[data-contracts-v10.3] OK auditoría general generada');
console.log(`[data-contracts-v10.3] required_files=${requiredFiles.length} public_files=${publicAudit.fileCount}`);
exitIfViolations('data-contracts-v10.3', violations);
