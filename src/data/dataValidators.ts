import { BUSINESS_EXPECTED_COUNTS, BUSINESS_EXPECTED_PERIOD } from '../domain/businessContracts';
import { GEO_EXPECTED_COUNTS } from '../domain/geoContracts';
import type {
  CalendarRecord,
  ClientTotalSale,
  DepartmentMonthSale,
  DetailedSaleRow,
  ProductMonthSale,
  ProductRecord,
  ProvinceMonthSale,
} from '../types/business';
import type { GeoJsonFeatureCollection, ProvincesIndex } from '../types/geo';

type InitialDataContractInput = {
  provinciasGeo: GeoJsonFeatureCollection;
  provinciasIndex: ProvincesIndex;
  ventasProvinciaMes: ProvinceMonthSale[];
  ventasClienteTotales: ClientTotalSale[];
  productos: ProductRecord[];
  calendario: CalendarRecord[];
};

export class DataContractError extends Error {
  constructor(message: string, public readonly violations: string[]) {
    super(`${message}: ${violations.join(' | ')}`);
    this.name = 'DataContractError';
  }
}

function assertNoViolations(scope: string, violations: string[]): void {
  if (violations.length > 0) throw new DataContractError(scope, violations);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function requireCount(scope: string, actual: number, expected: number, violations: string[]): void {
  if (actual !== expected) violations.push(`${scope}: esperado ${expected}, recibido ${actual}`);
}

function provinceIdsFromGeo(geojson: GeoJsonFeatureCollection): Set<string> {
  return new Set(
    geojson.features
      .map((feature) => String(feature.properties?.id_entidad ?? feature.properties?.provincia_id ?? ''))
      .filter(Boolean),
  );
}

export function validateInitialDataBundle(payload: InitialDataContractInput): void {
  const violations: string[] = [];
  const provinceIds = provinceIdsFromGeo(payload.provinciasGeo);

  requireCount('provincias.geojson features', payload.provinciasGeo.features.length, GEO_EXPECTED_COUNTS.provinciasGeojsonFeatures, violations);
  requireCount('provincias_index.json provincias', Object.keys(payload.provinciasIndex.provinces ?? {}).length, GEO_EXPECTED_COUNTS.provinciasIndex, violations);
  requireCount('ventas_provincia_mes.json records', payload.ventasProvinciaMes.length, BUSINESS_EXPECTED_COUNTS.ventasProvinciaMes, violations);
  requireCount('ventas_cliente_totales.json records', payload.ventasClienteTotales.length, BUSINESS_EXPECTED_COUNTS.ventasClienteTotales, violations);
  requireCount('productos.json records', payload.productos.length, BUSINESS_EXPECTED_COUNTS.productos, violations);
  requireCount('calendario.json records', payload.calendario.length, BUSINESS_EXPECTED_COUNTS.calendarioMeses, violations);

  const calendarPeriods = payload.calendario.map((row) => row.periodo).sort();
  if (calendarPeriods[0] !== BUSINESS_EXPECTED_PERIOD.from) violations.push(`calendario inicia en ${calendarPeriods[0] ?? 'N/A'}, no en ${BUSINESS_EXPECTED_PERIOD.from}`);
  if (calendarPeriods[calendarPeriods.length - 1] !== BUSINESS_EXPECTED_PERIOD.to) violations.push(`calendario termina en ${calendarPeriods[calendarPeriods.length - 1] ?? 'N/A'}, no en ${BUSINESS_EXPECTED_PERIOD.to}`);

  const productIds = new Set<string>();
  for (const product of payload.productos) {
    if (!product.producto_id) violations.push('producto sin producto_id');
    if (!product.categoria_producto) violations.push(`producto ${product.producto_id || 'sin ID'} sin categoria_producto`);
    if (product.producto_id) productIds.add(product.producto_id);
  }

  const clientIds = new Set<string>();
  for (const client of payload.ventasClienteTotales) {
    if (!client.cliente_id) violations.push('cliente sin cliente_id en ventas_cliente_totales');
    if (!client.provincia_id) violations.push(`cliente ${client.cliente_id || 'sin ID'} sin provincia_id`);
    if (!client.departamento_id) violations.push(`cliente ${client.cliente_id || 'sin ID'} sin departamento_id`);
    if (!isFiniteNumber(client.lat)) violations.push(`cliente ${client.cliente_id || 'sin ID'} sin lat numérica`);
    if (!isFiniteNumber(client.lon)) violations.push(`cliente ${client.cliente_id || 'sin ID'} sin lon numérica`);
    if (client.dato_sintetico !== true) violations.push(`cliente ${client.cliente_id || 'sin ID'} no marcado como dato_sintetico=true`);
    if (client.provincia_id && !provinceIds.has(client.provincia_id)) violations.push(`cliente ${client.cliente_id} referencia provincia inexistente: ${client.provincia_id}`);
    if (client.cliente_id) clientIds.add(client.cliente_id);
  }

  if (clientIds.size !== BUSINESS_EXPECTED_COUNTS.clientes) violations.push(`clientes únicos esperados ${BUSINESS_EXPECTED_COUNTS.clientes}, recibidos ${clientIds.size}`);
  if (productIds.size !== BUSINESS_EXPECTED_COUNTS.productos) violations.push(`productos únicos esperados ${BUSINESS_EXPECTED_COUNTS.productos}, recibidos ${productIds.size}`);

  const ventasNetas = payload.ventasProvinciaMes.reduce((sum, row) => sum + Number(row.venta_neta || 0), 0);
  if (ventasNetas <= 0) violations.push('venta_neta total desde ventas_provincia_mes es 0');

  assertNoViolations('Contrato inicial V10.3 inválido', violations.slice(0, 25));
}

export function validateClientesGeo(payload: GeoJsonFeatureCollection): void {
  const violations: string[] = [];
  requireCount('clientes.geojson features', payload.features.length, BUSINESS_EXPECTED_COUNTS.clientes, violations);
  for (const feature of payload.features) {
    const props = feature.properties ?? {};
    if (!props.cliente_id) violations.push('feature cliente sin cliente_id');
    if (!props.provincia_id) violations.push(`feature cliente ${String(props.cliente_id ?? '')} sin provincia_id`);
    if (!props.departamento_id) violations.push(`feature cliente ${String(props.cliente_id ?? '')} sin departamento_id`);
    if (props.dato_sintetico !== true) violations.push(`feature cliente ${String(props.cliente_id ?? '')} sin dato_sintetico=true`);
    if (!feature.geometry) violations.push(`feature cliente ${String(props.cliente_id ?? '')} sin geometría`);
    if (violations.length > 25) break;
  }
  assertNoViolations('Contrato clientes.geojson V10.3 inválido', violations);
}

export function validateDepartmentMonthSales(rows: DepartmentMonthSale[]): void {
  const violations: string[] = [];
  requireCount('ventas_departamento_mes.json records', rows.length, BUSINESS_EXPECTED_COUNTS.ventasDepartamentoMes, violations);
  if (rows.every((row) => Number(row.clientes_unicos || 0) <= 0)) violations.push('todos los agregados departamentales tienen clientes_unicos=0');
  const bolivarRows = rows.filter((row) => String(row.departamento_nombre ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'bolivar');
  if (bolivarRows.length > 0 && Math.max(...bolivarRows.map((row) => Number(row.clientes_unicos || 0))) <= 0) {
    violations.push('caso Bolívar tiene clientes_unicos=0 en todos los períodos');
  }
  assertNoViolations('Contrato ventas_departamento_mes V10.3 inválido', violations);
}

export function validateProductMonthSales(rows: ProductMonthSale[]): void {
  const violations: string[] = [];
  requireCount('ventas_producto_mes.json records', rows.length, BUSINESS_EXPECTED_COUNTS.ventasProductoMes, violations);
  if (rows.every((row) => Number(row.venta_neta || 0) <= 0)) violations.push('ventas_producto_mes no contiene venta_neta positiva');
  assertNoViolations('Contrato ventas_producto_mes V10.3 inválido', violations);
}

export function validateDetailedSales(rows: DetailedSaleRow[]): void {
  const violations: string[] = [];
  requireCount('ventas_mensuales.csv records', rows.length, BUSINESS_EXPECTED_COUNTS.ventasMensualesCsv, violations);
  if (rows.every((row) => Number(row.venta_neta || 0) <= 0)) violations.push('ventas_mensuales.csv no contiene venta_neta positiva');
  const periods = rows.map((row) => row.periodo).filter(Boolean).sort();
  if (periods[0] !== BUSINESS_EXPECTED_PERIOD.from) violations.push(`ventas_mensuales.csv inicia en ${periods[0] ?? 'N/A'}, no en ${BUSINESS_EXPECTED_PERIOD.from}`);
  if (periods[periods.length - 1] !== BUSINESS_EXPECTED_PERIOD.to) violations.push(`ventas_mensuales.csv termina en ${periods[periods.length - 1] ?? 'N/A'}, no en ${BUSINESS_EXPECTED_PERIOD.to}`);
  assertNoViolations('Contrato ventas_mensuales.csv V10.3 inválido', violations);
}

export function validateProvinceLayer(payload: GeoJsonFeatureCollection, label: string): void {
  const violations: string[] = [];
  if (payload.type !== 'FeatureCollection') violations.push(`${label} no es FeatureCollection`);
  if (!Array.isArray(payload.features)) violations.push(`${label} no tiene features[]`);
  if (Array.isArray(payload.features) && payload.features.length === 0) violations.push(`${label} no tiene features`);
  if (Array.isArray(payload.features) && payload.features.some((feature) => !feature.geometry)) violations.push(`${label} contiene geometrías vacías`);
  assertNoViolations(`Contrato capa geográfica ${label} V10.3 inválido`, violations.slice(0, 25));
}
