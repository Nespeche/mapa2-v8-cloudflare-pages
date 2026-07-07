import type {
  AggregatedBucket,
  ClientTotalSale,
  DepartmentMonthSale,
  DetailedSaleRow,
  FilterState,
  ProductRecord,
  ProvinceMonthSale,
  SalesMetrics,
  V7ComputedData,
} from '../types/business';
import type { GeoJsonFeature, GeoJsonFeatureCollection } from '../types/geo';
import { normalizeText } from './formatters';

export const DEFAULT_FILTERS: FilterState = {
  provinciaId: '',
  departamentoId: '',
  tipoCliente: '',
  segmentoCliente: '',
  clienteQuery: '',
  localidadQuery: '',
  categoriaProducto: '',
  productoId: '',
  anio: '',
  mes: '',
  periodoDesde: '',
  periodoHasta: '',
  viewMode: 'base',
};

function emptyBucket(id: string, name: string): AggregatedBucket {
  return {
    id,
    name,
    venta_neta: 0,
    unidades: 0,
    margen_bruto: 0,
    volumen_kg: 0,
    clientes: new Set<string>(),
    clientes_unicos: 0,
    registros: 0,
  };
}

function addToBucket(
  map: Map<string, AggregatedBucket>,
  id: string,
  name: string,
  clienteId: string,
  ventaNeta: number,
  unidades: number,
  margenBruto: number,
  volumenKg: number,
  registros = 1,
  clientesUnicos = 0,
): void {
  if (!id) return;
  const bucket = map.get(id) ?? emptyBucket(id, name || id);
  bucket.venta_neta += ventaNeta || 0;
  bucket.unidades += unidades || 0;
  bucket.margen_bruto += margenBruto || 0;
  bucket.volumen_kg += volumenKg || 0;
  bucket.registros += registros;
  if (clienteId) bucket.clientes.add(clienteId);
  // En agregados por mes/departamento no existen IDs de clientes. Guardamos el
  // máximo de clientes únicos informado por la fuente para no mostrar 0 en tooltip.
  if (clientesUnicos > 0) bucket.clientes_unicos = Math.max(bucket.clientes_unicos, clientesUnicos);
  map.set(id, bucket);
}

export function getBucketClientCount(bucket: AggregatedBucket | undefined): number {
  if (!bucket) return 0;
  return Math.max(bucket.clientes.size, bucket.clientes_unicos || 0);
}

function periodMatches(periodo: string, anio: number, mes: number, filters: FilterState): boolean {
  if (filters.anio && String(anio) !== filters.anio) return false;
  if (filters.mes && String(mes).padStart(2, '0') !== filters.mes.padStart(2, '0')) return false;
  if (filters.periodoDesde && periodo < filters.periodoDesde) return false;
  if (filters.periodoHasta && periodo > filters.periodoHasta) return false;
  return true;
}

function clientMatches(client: ClientTotalSale | undefined, filters: FilterState): boolean {
  if (!client) return false;
  if (filters.provinciaId && client.provincia_id !== filters.provinciaId) return false;
  if (filters.departamentoId && client.departamento_id !== filters.departamentoId) return false;
  if (filters.tipoCliente && client.tipo_cliente !== filters.tipoCliente) return false;
  if (filters.segmentoCliente && client.segmento_cliente !== filters.segmentoCliente) return false;
  if (filters.localidadQuery) {
    const localText = normalizeText(`${client.localidad_nombre} ${client.departamento_nombre}`);
    if (!localText.includes(normalizeText(filters.localidadQuery))) return false;
  }
  if (filters.clienteQuery) {
    const clientText = normalizeText(`${client.cliente_id} ${client.cliente_nombre}`);
    if (!clientText.includes(normalizeText(filters.clienteQuery))) return false;
  }
  return true;
}

function topBucketName(map: Map<string, AggregatedBucket>, fallback: string): string {
  let winner: AggregatedBucket | null = null;
  for (const bucket of map.values()) {
    if (!winner || bucket.venta_neta > winner.venta_neta) winner = bucket;
  }
  return winner && winner.venta_neta > 0 ? winner.name : fallback;
}

function baseMetricsFromBuckets(
  source: 'agregados' | 'cliente-agregado' | 'departamento-agregado' | 'detalle-csv',
  provinceSales: Map<string, AggregatedBucket>,
  productSales: Map<string, AggregatedBucket>,
  categorySales: Map<string, AggregatedBucket>,
  visibleClientCount: number,
  fallbackProduct: string,
): SalesMetrics {
  let ventaNeta = 0;
  let unidades = 0;
  let margenBruto = 0;
  let volumenKg = 0;
  let registros = 0;

  for (const bucket of provinceSales.values()) {
    ventaNeta += bucket.venta_neta;
    unidades += bucket.unidades;
    margenBruto += bucket.margen_bruto;
    volumenKg += bucket.volumen_kg;
    registros += bucket.registros;
  }

  const clientesVisibles = source === 'detalle-csv'
    ? new Set([...provinceSales.values()].flatMap((bucket) => [...bucket.clientes])).size
    : visibleClientCount;

  return {
    clientesVisibles,
    ventaNeta,
    unidades,
    margenBruto,
    volumenKg,
    ticketPromedio: clientesVisibles > 0 ? ventaNeta / clientesVisibles : 0,
    provinciaLider: topBucketName(provinceSales, 'Sin datos'),
    productoLider: topBucketName(productSales, fallbackProduct),
    categoriaLider: topBucketName(categorySales, 'Sin datos'),
    registros,
    fuente: source,
  };
}

export function buildLookupMaps(clientTotals: ClientTotalSale[], products: ProductRecord[]) {
  return {
    clientsById: new Map(clientTotals.map((client) => [client.cliente_id, client])),
    productsById: new Map(products.map((product) => [product.producto_id, product])),
  };
}


function hasProductLevelFilter(filters: FilterState): boolean {
  return Boolean(filters.productoId || filters.categoriaProducto);
}

function hasPeriodLevelFilter(filters: FilterState): boolean {
  return Boolean(filters.anio || filters.mes || filters.periodoDesde || filters.periodoHasta);
}

function hasClientLevelFilter(filters: FilterState): boolean {
  return Boolean(
    filters.tipoCliente ||
    filters.segmentoCliente ||
    filters.clienteQuery.trim() ||
    filters.departamentoId ||
    filters.localidadQuery.trim()
  );
}

export function canUseClientTotals(filters: FilterState): boolean {
  return hasClientLevelFilter(filters) && !hasProductLevelFilter(filters) && !hasPeriodLevelFilter(filters);
}

export function needsDepartmentAggregates(filters: FilterState): boolean {
  return Boolean(filters.departamentoId) && !hasProductLevelFilter(filters) && !filters.tipoCliente && !filters.segmentoCliente && !filters.clienteQuery.trim() && !filters.localidadQuery.trim();
}

export function computeDataFromProvinceAggregates(
  rows: ProvinceMonthSale[],
  clientTotals: ClientTotalSale[],
  products: ProductRecord[],
  filters: FilterState,
  fallbackProduct: string,
): V7ComputedData {
  const provinceSales = new Map<string, AggregatedBucket>();
  const productSales = new Map<string, AggregatedBucket>();
  const categorySales = new Map<string, AggregatedBucket>();
  const departmentSales = new Map<string, AggregatedBucket>();

  for (const row of rows) {
    if (!periodMatches(row.periodo, row.anio, row.mes, filters)) continue;
    if (filters.provinciaId && row.provincia_id !== filters.provinciaId) continue;
    addToBucket(
      provinceSales,
      row.provincia_id,
      row.provincia_nombre,
      '',
      row.venta_neta,
      row.unidades,
      row.margen_bruto,
      row.volumen_kg,
      row.registros_venta,
      row.clientes_unicos,
    );
  }

  let visibleClientCount = 0;
  for (const client of clientTotals) {
    if (clientMatches(client, filters)) visibleClientCount += 1;
  }

  for (const product of products) {
    addToBucket(productSales, product.producto_id, product.producto_nombre, '', 0, 0, 0, 0, 0);
    addToBucket(categorySales, product.categoria_producto, product.categoria_producto, '', 0, 0, 0, 0, 0);
  }

  return {
    metrics: baseMetricsFromBuckets('agregados', provinceSales, productSales, categorySales, visibleClientCount, fallbackProduct),
    provinceSales,
    departmentSales,
    productSales,
    categorySales,
    filteredClientIds: null,
  };
}

export function computeDataFromClientTotals(
  clientTotals: ClientTotalSale[],
  products: ProductRecord[],
  filters: FilterState,
  fallbackProduct: string,
): V7ComputedData {
  const provinceSales = new Map<string, AggregatedBucket>();
  const departmentSales = new Map<string, AggregatedBucket>();
  const productSales = new Map<string, AggregatedBucket>();
  const categorySales = new Map<string, AggregatedBucket>();
  const filteredClientIds = new Set<string>();

  for (const client of clientTotals) {
    if (!clientMatches(client, filters)) continue;
    filteredClientIds.add(client.cliente_id);
    addToBucket(
      provinceSales,
      client.provincia_id,
      client.provincia_nombre,
      client.cliente_id,
      client.venta_neta,
      client.unidades,
      client.margen_bruto,
      client.volumen_kg,
      client.registros_venta,
    );
    addToBucket(
      departmentSales,
      client.departamento_id,
      client.departamento_nombre,
      client.cliente_id,
      client.venta_neta,
      client.unidades,
      client.margen_bruto,
      client.volumen_kg,
      client.registros_venta,
    );
  }

  for (const product of products) {
    addToBucket(productSales, product.producto_id, product.producto_nombre, '', 0, 0, 0, 0, 0);
    addToBucket(categorySales, product.categoria_producto, product.categoria_producto, '', 0, 0, 0, 0, 0);
  }

  return {
    metrics: baseMetricsFromBuckets('cliente-agregado', provinceSales, productSales, categorySales, filteredClientIds.size, fallbackProduct),
    provinceSales,
    departmentSales,
    productSales,
    categorySales,
    filteredClientIds,
  };
}

export function computeDataFromDepartmentAggregates(
  rows: DepartmentMonthSale[],
  clientTotals: ClientTotalSale[],
  products: ProductRecord[],
  filters: FilterState,
  fallbackProduct: string,
): V7ComputedData {
  const provinceSales = new Map<string, AggregatedBucket>();
  const departmentSales = new Map<string, AggregatedBucket>();
  const productSales = new Map<string, AggregatedBucket>();
  const categorySales = new Map<string, AggregatedBucket>();
  const filteredClientIds = new Set<string>();

  for (const client of clientTotals) {
    if (clientMatches(client, filters)) filteredClientIds.add(client.cliente_id);
  }

  for (const row of rows) {
    if (!periodMatches(row.periodo, row.anio, row.mes, filters)) continue;
    if (filters.provinciaId && row.provincia_id !== filters.provinciaId) continue;
    if (filters.departamentoId && row.departamento_id !== filters.departamentoId) continue;

    addToBucket(
      provinceSales,
      row.provincia_id,
      row.provincia_nombre,
      '',
      row.venta_neta,
      row.unidades,
      row.margen_bruto,
      row.volumen_kg,
      row.registros_venta,
      row.clientes_unicos,
    );
    addToBucket(
      departmentSales,
      row.departamento_id,
      row.departamento_nombre,
      '',
      row.venta_neta,
      row.unidades,
      row.margen_bruto,
      row.volumen_kg,
      row.registros_venta,
      row.clientes_unicos,
    );
  }

  for (const product of products) {
    addToBucket(productSales, product.producto_id, product.producto_nombre, '', 0, 0, 0, 0, 0);
    addToBucket(categorySales, product.categoria_producto, product.categoria_producto, '', 0, 0, 0, 0, 0);
  }

  return {
    metrics: baseMetricsFromBuckets('departamento-agregado', provinceSales, productSales, categorySales, filteredClientIds.size, fallbackProduct),
    provinceSales,
    departmentSales,
    productSales,
    categorySales,
    filteredClientIds,
  };
}


export function computeDataFromDetailedSales(
  rows: DetailedSaleRow[],
  clientTotals: ClientTotalSale[],
  products: ProductRecord[],
  filters: FilterState,
  fallbackProduct: string,
): V7ComputedData {
  const { clientsById, productsById } = buildLookupMaps(clientTotals, products);
  const provinceSales = new Map<string, AggregatedBucket>();
  const departmentSales = new Map<string, AggregatedBucket>();
  const productSales = new Map<string, AggregatedBucket>();
  const categorySales = new Map<string, AggregatedBucket>();
  const filteredClientIds = new Set<string>();

  for (const row of rows) {
    if (!periodMatches(row.periodo, row.anio, row.mes, filters)) continue;
    const client = clientsById.get(row.cliente_id);
    if (!clientMatches(client, filters) || !client) continue;
    const product = productsById.get(row.producto_id);
    if (!product) continue;
    if (filters.productoId && row.producto_id !== filters.productoId) continue;
    if (filters.categoriaProducto && product.categoria_producto !== filters.categoriaProducto) continue;

    filteredClientIds.add(row.cliente_id);
    addToBucket(
      provinceSales,
      client.provincia_id,
      client.provincia_nombre,
      row.cliente_id,
      row.venta_neta,
      row.unidades,
      row.margen_bruto,
      row.volumen_kg,
    );
    addToBucket(
      departmentSales,
      client.departamento_id,
      client.departamento_nombre,
      row.cliente_id,
      row.venta_neta,
      row.unidades,
      row.margen_bruto,
      row.volumen_kg,
    );
    addToBucket(
      productSales,
      row.producto_id,
      product.producto_nombre,
      row.cliente_id,
      row.venta_neta,
      row.unidades,
      row.margen_bruto,
      row.volumen_kg,
    );
    addToBucket(
      categorySales,
      product.categoria_producto,
      product.categoria_producto,
      row.cliente_id,
      row.venta_neta,
      row.unidades,
      row.margen_bruto,
      row.volumen_kg,
    );
  }

  return {
    metrics: baseMetricsFromBuckets('detalle-csv', provinceSales, productSales, categorySales, filteredClientIds.size, fallbackProduct),
    provinceSales,
    departmentSales,
    productSales,
    categorySales,
    filteredClientIds,
  };
}

export function filterClientGeoJson(
  clientesGeo: GeoJsonFeatureCollection,
  clientTotals: ClientTotalSale[],
  filters: FilterState,
  detailedClientIds: Set<string> | null,
): GeoJsonFeatureCollection {
  const clientsById = new Map(clientTotals.map((client) => [client.cliente_id, client]));
  const features = clientesGeo.features.filter((feature) => {
    const props = feature.properties;
    const clienteId = String(props.cliente_id ?? '');
    if (detailedClientIds && !detailedClientIds.has(clienteId)) return false;
    return clientMatches(clientsById.get(clienteId), filters);
  }).map((feature) => ({ ...feature, properties: { ...feature.properties } }));

  return { ...clientesGeo, features };
}

export function enrichGeoJsonWithSales(
  geojson: GeoJsonFeatureCollection,
  salesMap: Map<string, AggregatedBucket>,
  idFields: string[],
): GeoJsonFeatureCollection {
  const features = geojson.features.map((feature) => {
    const props = feature.properties ?? {};
    const id = idFields.map((field) => String(props[field] ?? '')).find(Boolean) ?? '';
    const bucket = salesMap.get(id);
    return {
      ...feature,
      properties: {
        ...props,
        venta_neta_v7: bucket?.venta_neta ?? 0,
        unidades_v7: bucket?.unidades ?? 0,
        margen_bruto_v7: bucket?.margen_bruto ?? 0,
        volumen_kg_v7: bucket?.volumen_kg ?? 0,
        clientes_v7: getBucketClientCount(bucket),
      },
    };
  });
  return { ...geojson, features };
}

export function enrichClientGeoJsonWithSales(
  geojson: GeoJsonFeatureCollection,
  salesByClient: Map<string, AggregatedBucket> | null,
): GeoJsonFeatureCollection {
  if (!salesByClient) return geojson;
  const features: GeoJsonFeature[] = geojson.features.map((feature) => {
    const clienteId = String(feature.properties?.cliente_id ?? '');
    const bucket = salesByClient.get(clienteId);
    return {
      ...feature,
      properties: {
        ...feature.properties,
        venta_neta_v7: bucket?.venta_neta ?? Number(feature.properties?.venta_neta ?? 0),
      },
    };
  });
  return { ...geojson, features };
}

export function getTopSalesValue(map: Map<string, AggregatedBucket>): number {
  return Math.max(0, ...[...map.values()].map((bucket) => bucket.venta_neta));
}

export function shouldLoadDetailedSales(filters: FilterState): boolean {
  if (hasProductLevelFilter(filters)) return true;
  return hasClientLevelFilter(filters) && hasPeriodLevelFilter(filters);
}


export function computeDepartmentSalesFromAggregates(
  rows: DepartmentMonthSale[],
  filters: FilterState,
): Map<string, AggregatedBucket> {
  const departmentSales = new Map<string, AggregatedBucket>();
  for (const row of rows) {
    if (!periodMatches(row.periodo, row.anio, row.mes, filters)) continue;
    if (filters.provinciaId && row.provincia_id !== filters.provinciaId) continue;
    if (filters.departamentoId && row.departamento_id !== filters.departamentoId) continue;
    addToBucket(
      departmentSales,
      row.departamento_id,
      row.departamento_nombre,
      '',
      row.venta_neta,
      row.unidades,
      row.margen_bruto,
      row.volumen_kg,
      row.registros_venta,
      row.clientes_unicos,
    );
  }
  return departmentSales;
}


export function computeDepartmentSalesFromClientTotals(
  clientTotals: ClientTotalSale[],
  filters: FilterState,
): Map<string, AggregatedBucket> {
  const departmentSales = new Map<string, AggregatedBucket>();
  for (const client of clientTotals) {
    if (!clientMatches(client, filters)) continue;
    addToBucket(
      departmentSales,
      client.departamento_id,
      client.departamento_nombre,
      client.cliente_id,
      client.venta_neta,
      client.unidades,
      client.margen_bruto,
      client.volumen_kg,
      client.registros_venta,
      1,
    );
  }
  return departmentSales;
}

export function mergeClientCountsIntoDepartmentSales(
  departmentSales: Map<string, AggregatedBucket>,
  clientTotals: ClientTotalSale[],
  filters: FilterState,
): Map<string, AggregatedBucket> {
  const merged = new Map<string, AggregatedBucket>();

  for (const [id, bucket] of departmentSales.entries()) {
    merged.set(id, {
      ...bucket,
      clientes: new Set(bucket.clientes),
      clientes_unicos: bucket.clientes_unicos || bucket.clientes.size,
    });
  }

  const clientTotalsByDepartment = computeDepartmentSalesFromClientTotals(clientTotals, filters);
  for (const [id, clientBucket] of clientTotalsByDepartment.entries()) {
    const existing = merged.get(id);
    if (!existing) {
      merged.set(id, clientBucket);
      continue;
    }
    for (const clientId of clientBucket.clientes) existing.clientes.add(clientId);
    existing.clientes_unicos = Math.max(existing.clientes_unicos, clientBucket.clientes.size, clientBucket.clientes_unicos);
  }

  return merged;
}

export function computeSalesByClientFromDetailed(
  rows: DetailedSaleRow[],
  clientTotals: ClientTotalSale[],
  products: ProductRecord[],
  filters: FilterState,
): Map<string, AggregatedBucket> {
  const { clientsById, productsById } = buildLookupMaps(clientTotals, products);
  const clientSales = new Map<string, AggregatedBucket>();
  for (const row of rows) {
    if (!periodMatches(row.periodo, row.anio, row.mes, filters)) continue;
    const client = clientsById.get(row.cliente_id);
    if (!clientMatches(client, filters) || !client) continue;
    const product = productsById.get(row.producto_id);
    if (!product) continue;
    if (filters.productoId && row.producto_id !== filters.productoId) continue;
    if (filters.categoriaProducto && product.categoria_producto !== filters.categoriaProducto) continue;
    addToBucket(
      clientSales,
      row.cliente_id,
      client.cliente_nombre,
      row.cliente_id,
      row.venta_neta,
      row.unidades,
      row.margen_bruto,
      row.volumen_kg,
    );
  }
  return clientSales;
}
