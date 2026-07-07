import { INITIAL_DATA_PATHS, LAZY_DATA_PATHS, assetUrl } from './dataPaths';
import {
  validateClientesGeo,
  validateDepartmentMonthSales,
  validateDetailedSales,
  validateInitialDataBundle,
  validateProductMonthSales,
  validateProvinceLayer,
} from './dataValidators';
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

export interface InitialDataBundle {
  metadata: Record<string, unknown>;
  provinciasGeo: GeoJsonFeatureCollection;
  provinciasIndex: ProvincesIndex;
  businessMetadata: Record<string, any>;
  ventasProvinciaMes: ProvinceMonthSale[];
  ventasClienteTotales: ClientTotalSale[];
  productos: ProductRecord[];
  calendario: CalendarRecord[];
}

const jsonCache = new Map<string, Promise<unknown>>();
const textCache = new Map<string, Promise<string>>();

async function fetchJson<T>(relativePath: string): Promise<T> {
  const url = assetUrl(relativePath);
  const cacheKey = `json:${url}`;
  const cached = jsonCache.get(cacheKey) as Promise<T> | undefined;
  if (cached) return cached;

  const request = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`No se pudo cargar ${relativePath}: HTTP ${response.status}`);
      }
      return response.json() as Promise<T>;
    })
    .catch((error) => {
      jsonCache.delete(cacheKey);
      throw error;
    });

  jsonCache.set(cacheKey, request as Promise<unknown>);
  return request;
}

async function fetchText(relativePath: string): Promise<string> {
  const url = assetUrl(relativePath);
  const cacheKey = `text:${url}`;
  const cached = textCache.get(cacheKey);
  if (cached) return cached;

  const request = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`No se pudo cargar ${relativePath}: HTTP ${response.status}`);
      }
      return response.text();
    })
    .catch((error) => {
      textCache.delete(cacheKey);
      throw error;
    });

  textCache.set(cacheKey, request);
  return request;
}

function recordsOf<T>(payload: { records?: T[] } | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.records ?? [];
}

function parseNumber(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseDetailedSalesCsv(csvText: string): DetailedSaleRow[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^\uFEFF/, ''));
  const index = new Map(headers.map((header, column) => [header, column]));
  const get = (columns: string[], field: string) => columns[index.get(field) ?? -1] ?? '';

  return lines.slice(1).filter(Boolean).map((line) => {
    const columns = parseCsvLine(line);
    return {
      venta_id: get(columns, 'venta_id'),
      cliente_id: get(columns, 'cliente_id'),
      producto_id: get(columns, 'producto_id'),
      periodo: get(columns, 'periodo'),
      anio: parseNumber(get(columns, 'anio')),
      mes: parseNumber(get(columns, 'mes')),
      unidades: parseNumber(get(columns, 'unidades')),
      venta_neta: parseNumber(get(columns, 'venta_neta')),
      costo_estimado: parseNumber(get(columns, 'costo_estimado')),
      margen_bruto: parseNumber(get(columns, 'margen_bruto')),
      volumen_kg: parseNumber(get(columns, 'volumen_kg')),
    };
  });
}

export async function loadInitialData(): Promise<InitialDataBundle> {
  const [
    metadata,
    provinciasGeo,
    provinciasIndex,
    businessMetadata,
    ventasProvinciaPayload,
    ventasClientePayload,
    productosPayload,
    calendarioPayload,
  ] = await Promise.all([
    fetchJson<Record<string, unknown>>(INITIAL_DATA_PATHS.metadata),
    fetchJson<GeoJsonFeatureCollection>(INITIAL_DATA_PATHS.provinciasGeo),
    fetchJson<ProvincesIndex>(INITIAL_DATA_PATHS.provinciasIndex),
    fetchJson<Record<string, any>>(INITIAL_DATA_PATHS.businessMetadata),
    fetchJson<{ records: ProvinceMonthSale[] }>(INITIAL_DATA_PATHS.ventasProvinciaMes),
    fetchJson<{ records: ClientTotalSale[] }>(INITIAL_DATA_PATHS.ventasClienteTotales),
    fetchJson<{ records: ProductRecord[] }>(INITIAL_DATA_PATHS.productos),
    fetchJson<{ records: CalendarRecord[] }>(INITIAL_DATA_PATHS.calendario),
  ]);

  const bundle = {
    metadata,
    provinciasGeo,
    provinciasIndex,
    businessMetadata,
    ventasProvinciaMes: recordsOf(ventasProvinciaPayload),
    ventasClienteTotales: recordsOf(ventasClientePayload),
    productos: recordsOf(productosPayload),
    calendario: recordsOf(calendarioPayload),
  };

  validateInitialDataBundle(bundle);
  return bundle;
}

export async function loadClientesGeo(): Promise<GeoJsonFeatureCollection> {
  const payload = await fetchJson<GeoJsonFeatureCollection>(LAZY_DATA_PATHS.clientesGeo);
  validateClientesGeo(payload);
  return payload;
}

export async function loadDepartmentMonthSales(): Promise<DepartmentMonthSale[]> {
  const payload = await fetchJson<{ records: DepartmentMonthSale[] }>(LAZY_DATA_PATHS.ventasDepartamentoMes);
  const rows = recordsOf(payload);
  validateDepartmentMonthSales(rows);
  return rows;
}

export async function loadProductMonthSales(): Promise<ProductMonthSale[]> {
  const payload = await fetchJson<{ records: ProductMonthSale[] }>(LAZY_DATA_PATHS.ventasProductoMes);
  const rows = recordsOf(payload);
  validateProductMonthSales(rows);
  return rows;
}

export async function loadDetailedSalesCsv(): Promise<DetailedSaleRow[]> {
  const csvText = await fetchText(LAZY_DATA_PATHS.ventasMensualesCsv);
  const rows = parseDetailedSalesCsv(csvText);
  validateDetailedSales(rows);
  return rows;
}

export async function loadProvinceLayer(relativePath: string): Promise<GeoJsonFeatureCollection> {
  const normalizedPath = `data/${relativePath.replace(/^data\//, '')}`;
  const payload = await fetchJson<GeoJsonFeatureCollection>(normalizedPath);
  validateProvinceLayer(payload, normalizedPath);
  return payload;
}
