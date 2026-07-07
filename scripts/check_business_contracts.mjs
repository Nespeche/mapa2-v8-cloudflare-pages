import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  addMetric,
  assertCount,
  assertPositive,
  compareAggregates,
  emptyMetrics,
  ensureFile,
  exitIfViolations,
  finalStatus,
  readCsvRows,
  readJson,
  recordsOf,
  toNumber,
  writeJson,
  writeMd,
} from './lib/contract_helpers.mjs';

const root = process.cwd();
const docsDir = join(root, 'docs');
mkdirSync(docsDir, { recursive: true });

const expected = {
  clientes: 2000,
  productos: 65,
  ventasMensuales: 128998,
  calendario: 24,
  periodoDesde: '2025-01',
  periodoHasta: '2026-12',
  ventasClienteTotales: 2000,
  ventasDepartamentoMes: 6432,
  ventasProductoMes: 1560,
  ventasProvinciaMes: 264,
};

const paths = {
  metadata: join(root, 'public/data/business/metadata_business_v6.json'),
  clientesGeo: join(root, 'public/data/business/clientes.geojson'),
  ventasCsv: join(root, 'public/data/business/ventas_mensuales.csv'),
  productos: join(root, 'public/data/business/productos.json'),
  calendario: join(root, 'public/data/business/calendario.json'),
  clienteTotales: join(root, 'public/data/business/agregados/ventas_cliente_totales.json'),
  departamentoMes: join(root, 'public/data/business/agregados/ventas_departamento_mes.json'),
  productoMes: join(root, 'public/data/business/agregados/ventas_producto_mes.json'),
  provinciaMes: join(root, 'public/data/business/agregados/ventas_provincia_mes.json'),
};

const violations = [];
const warnings = [];

for (const [label, path] of Object.entries(paths)) ensureFile(path, violations, label);
if (violations.length) exitIfViolations('business-contracts-v10.3', violations);

const metadata = readJson(paths.metadata);
const clientesGeo = readJson(paths.clientesGeo);
const productos = recordsOf(readJson(paths.productos));
const calendario = recordsOf(readJson(paths.calendario));
const ventasClienteTotales = recordsOf(readJson(paths.clienteTotales));
const ventasDepartamentoMes = recordsOf(readJson(paths.departamentoMes));
const ventasProductoMes = recordsOf(readJson(paths.productoMes));
const ventasProvinciaMes = recordsOf(readJson(paths.provinciaMes));
const ventasMensuales = readCsvRows(paths.ventasCsv);

assertCount('clientes.geojson features', clientesGeo.features?.length ?? 0, expected.clientes, violations);
assertCount('productos.json records', productos.length, expected.productos, violations);
assertCount('ventas_mensuales.csv records', ventasMensuales.length, expected.ventasMensuales, violations);
assertCount('calendario.json records', calendario.length, expected.calendario, violations);
assertCount('ventas_cliente_totales.json records', ventasClienteTotales.length, expected.ventasClienteTotales, violations);
assertCount('ventas_departamento_mes.json records', ventasDepartamentoMes.length, expected.ventasDepartamentoMes, violations);
assertCount('ventas_producto_mes.json records', ventasProductoMes.length, expected.ventasProductoMes, violations);
assertCount('ventas_provincia_mes.json records', ventasProvinciaMes.length, expected.ventasProvinciaMes, violations);

const calendarPeriods = calendario.map((row) => row.periodo).filter(Boolean).sort();
if (calendarPeriods[0] !== expected.periodoDesde) violations.push(`calendario inicia en ${calendarPeriods[0] ?? 'N/A'}, no en ${expected.periodoDesde}`);
if (calendarPeriods.at(-1) !== expected.periodoHasta) violations.push(`calendario termina en ${calendarPeriods.at(-1) ?? 'N/A'}, no en ${expected.periodoHasta}`);

const csvPeriods = ventasMensuales.map((row) => row.periodo).filter(Boolean).sort();
if (csvPeriods[0] !== expected.periodoDesde) violations.push(`ventas_mensuales.csv inicia en ${csvPeriods[0] ?? 'N/A'}, no en ${expected.periodoDesde}`);
if (csvPeriods.at(-1) !== expected.periodoHasta) violations.push(`ventas_mensuales.csv termina en ${csvPeriods.at(-1) ?? 'N/A'}, no en ${expected.periodoHasta}`);
if (new Set(csvPeriods).size !== expected.calendario) violations.push(`ventas_mensuales.csv no cubre ${expected.calendario} meses únicos`);

const productIds = new Set();
for (const product of productos) {
  if (!product.producto_id) violations.push('Producto sin producto_id');
  if (!product.categoria_producto) violations.push(`Producto ${product.producto_id || 'sin ID'} sin categoria_producto`);
  if (product.producto_id) productIds.add(product.producto_id);
  if (product.dato_sintetico !== true) violations.push(`Producto ${product.producto_id || 'sin ID'} no marcado dato_sintetico=true`);
  if (violations.length > 50) break;
}
assertCount('productos únicos', productIds.size, expected.productos, violations);

const clientIds = new Set();
const clientById = new Map();
for (const client of ventasClienteTotales) {
  const id = client.cliente_id;
  if (!id) violations.push('Cliente agregado sin cliente_id');
  if (!client.provincia_id) violations.push(`Cliente ${id || 'sin ID'} sin provincia_id`);
  if (!client.departamento_id) violations.push(`Cliente ${id || 'sin ID'} sin departamento_id`);
  if (!Number.isFinite(Number(client.lat))) violations.push(`Cliente ${id || 'sin ID'} sin lat válida`);
  if (!Number.isFinite(Number(client.lon))) violations.push(`Cliente ${id || 'sin ID'} sin lon válida`);
  if (client.dato_sintetico !== true) violations.push(`Cliente ${id || 'sin ID'} no marcado dato_sintetico=true`);
  if (id) {
    clientIds.add(id);
    clientById.set(id, client);
  }
  if (violations.length > 50) break;
}
assertCount('clientes únicos en ventas_cliente_totales', clientIds.size, expected.clientes, violations);

const clientesGeoIds = new Set();
for (const feature of clientesGeo.features ?? []) {
  const props = feature.properties ?? {};
  const id = props.cliente_id;
  if (!id) violations.push('Feature de clientes.geojson sin cliente_id');
  if (id) clientesGeoIds.add(id);
  if (!props.provincia_id) violations.push(`Feature cliente ${id || 'sin ID'} sin provincia_id`);
  if (!props.departamento_id) violations.push(`Feature cliente ${id || 'sin ID'} sin departamento_id`);
  if (props.dato_sintetico !== true) violations.push(`Feature cliente ${id || 'sin ID'} sin dato_sintetico=true`);
  if (!feature.geometry) violations.push(`Feature cliente ${id || 'sin ID'} sin geometría`);
  if (id && !clientIds.has(id)) violations.push(`clientes.geojson referencia cliente no existente en agregados: ${id}`);
  if (violations.length > 50) break;
}
assertCount('clientes únicos en clientes.geojson', clientesGeoIds.size, expected.clientes, violations);

let csvVentaNeta = 0;
const csvClientIds = new Set();
const csvProductIds = new Set();
const aggClient = new Map();
const aggDeptMonth = new Map();
const aggProductMonth = new Map();
const aggProvinceMonth = new Map();

function bucket(map, key) {
  if (!map.has(key)) map.set(key, emptyMetrics());
  return map.get(key);
}

for (const sale of ventasMensuales) {
  const client = clientById.get(sale.cliente_id);
  if (!client) violations.push(`Venta ${sale.venta_id || ''} referencia cliente inexistente: ${sale.cliente_id}`);
  if (!productIds.has(sale.producto_id)) violations.push(`Venta ${sale.venta_id || ''} referencia producto inexistente: ${sale.producto_id}`);
  if (violations.length > 50) break;

  csvClientIds.add(sale.cliente_id);
  csvProductIds.add(sale.producto_id);
  csvVentaNeta += toNumber(sale.venta_neta);

  const clientAgg = bucket(aggClient, sale.cliente_id);
  addMetric(clientAgg, sale);
  clientAgg.clientes.add(sale.cliente_id);
  const dept = bucket(aggDeptMonth, `${client.departamento_id}|${sale.periodo}`);
  addMetric(dept, sale);
  dept.clientes.add(sale.cliente_id);

  const product = bucket(aggProductMonth, `${sale.producto_id}|${sale.periodo}`);
  addMetric(product, sale);
  product.clientes.add(sale.cliente_id);

  const province = bucket(aggProvinceMonth, `${client.provincia_id}|${sale.periodo}`);
  addMetric(province, sale);
  province.clientes.add(sale.cliente_id);
}

assertPositive('venta_neta total CSV', csvVentaNeta, violations);
assertCount('clientes únicos con ventas en CSV', csvClientIds.size, expected.clientes, violations);
assertCount('productos únicos con ventas en CSV', csvProductIds.size, expected.productos, violations);

compareAggregates(ventasClienteTotales, aggClient, (row) => row.cliente_id, 'ventas_cliente_totales_vs_csv', violations);
compareAggregates(ventasDepartamentoMes, aggDeptMonth, (row) => `${row.departamento_id}|${row.periodo}`, 'ventas_departamento_mes_vs_csv', violations);
compareAggregates(ventasProductoMes, aggProductMonth, (row) => `${row.producto_id}|${row.periodo}`, 'ventas_producto_mes_vs_csv', violations);
compareAggregates(ventasProvinciaMes, aggProvinceMonth, (row) => `${row.provincia_id}|${row.periodo}`, 'ventas_provincia_mes_vs_csv', violations);

const buenosAiresClients = ventasClienteTotales.filter((client) => client.provincia_id === 'provincia:06');
assertPositive('clientes Buenos Aires', buenosAiresClients.length, violations);
const bolivarClients = ventasClienteTotales.filter((client) => String(client.departamento_nombre ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'bolivar');
assertPositive('clientes Bolívar', bolivarClients.length, violations);
const defaultVentaNeta = ventasProvinciaMes.reduce((sum, row) => sum + toNumber(row.venta_neta), 0);
assertPositive('venta_neta sin filtros desde agregados provincia/mes', defaultVentaNeta, violations);

if (metadata?.status !== 'OK') warnings.push(`metadata_business_v6.status no es OK: ${metadata?.status ?? 'N/A'}`);

const report = {
  phase: 'V10.3 — Business contract checks',
  generated_at: new Date().toISOString(),
  status: finalStatus(violations),
  expected,
  actual: {
    clientes_geojson_features: clientesGeo.features?.length ?? 0,
    clientes_agregados: ventasClienteTotales.length,
    productos: productos.length,
    ventas_mensuales_csv: ventasMensuales.length,
    calendario: calendario.length,
    ventas_departamento_mes: ventasDepartamentoMes.length,
    ventas_producto_mes: ventasProductoMes.length,
    ventas_provincia_mes: ventasProvinciaMes.length,
    csv_clientes_unicos: csvClientIds.size,
    csv_productos_unicos: csvProductIds.size,
    buenos_aires_clientes: buenosAiresClients.length,
    bolivar_clientes: bolivarClients.length,
    venta_neta_total_csv: +csvVentaNeta.toFixed(2),
    venta_neta_total_agregado_inicial: +defaultVentaNeta.toFixed(2),
  },
  warnings,
  violations,
};

writeJson(join(docsDir, 'BUSINESS_CONTRACT_AUDIT_V10_3.json'), report);
writeMd(join(docsDir, 'BUSINESS_CONTRACT_AUDIT_V10_3.md'), `# Mapa 2 — Auditoría contrato comercial V10.3\n\n` +
  `**Resultado:** ${report.status}\n\n` +
  `## Conteos\n\n` +
  `- Clientes GeoJSON: \`${report.actual.clientes_geojson_features}\`\n` +
  `- Clientes agregados: \`${report.actual.clientes_agregados}\`\n` +
  `- Productos: \`${report.actual.productos}\`\n` +
  `- Ventas CSV: \`${report.actual.ventas_mensuales_csv}\`\n` +
  `- Calendario: \`${report.actual.calendario}\` meses, de \`${expected.periodoDesde}\` a \`${expected.periodoHasta}\`\n` +
  `- Buenos Aires clientes: \`${report.actual.buenos_aires_clientes}\`\n` +
  `- Bolívar clientes: \`${report.actual.bolivar_clientes}\`\n` +
  `- Venta neta CSV: \`${report.actual.venta_neta_total_csv}\`\n\n` +
  `## Advertencias\n\n${warnings.length ? warnings.map((item) => `- ${item}`).join('\n') : '- Sin advertencias.'}\n\n` +
  `## Errores bloqueantes\n\n${violations.length ? violations.map((item) => `- ${item}`).join('\n') : '- Sin errores bloqueantes.'}\n`);

console.log('[business-contracts-v10.3] OK auditoría comercial generada');
console.log(`[business-contracts-v10.3] clientes=${ventasClienteTotales.length} productos=${productos.length} ventas_csv=${ventasMensuales.length} bolivar=${bolivarClients.length}`);
exitIfViolations('business-contracts-v10.3', violations);
