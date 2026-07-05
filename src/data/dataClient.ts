import { INITIAL_DATA_PATHS, LAZY_DATA_PATHS, assetUrl } from './dataPaths';
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
  clientesGeo: GeoJsonFeatureCollection;
  productos: ProductRecord[];
  calendario: CalendarRecord[];
}

async function fetchJson<T>(relativePath: string): Promise<T> {
  const response = await fetch(assetUrl(relativePath));
  if (!response.ok) {
    throw new Error(`No se pudo cargar ${relativePath}: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function fetchText(relativePath: string): Promise<string> {
  const response = await fetch(assetUrl(relativePath));
  if (!response.ok) {
    throw new Error(`No se pudo cargar ${relativePath}: HTTP ${response.status}`);
  }
  return response.text();
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
    clientesGeo,
    productosPayload,
    calendarioPayload,
  ] = await Promise.all([
    fetchJson<Record<string, unknown>>(INITIAL_DATA_PATHS[0]),
    fetchJson<GeoJsonFeatureCollection>(INITIAL_DATA_PATHS[1]),
    fetchJson<ProvincesIndex>(INITIAL_DATA_PATHS[2]),
    fetchJson<Record<string, any>>(INITIAL_DATA_PATHS[3]),
    fetchJson<{ records: ProvinceMonthSale[] }>(INITIAL_DATA_PATHS[4]),
    fetchJson<{ records: ClientTotalSale[] }>(INITIAL_DATA_PATHS[5]),
    fetchJson<GeoJsonFeatureCollection>(INITIAL_DATA_PATHS[6]),
    fetchJson<{ records: ProductRecord[] }>(INITIAL_DATA_PATHS[7]),
    fetchJson<{ records: CalendarRecord[] }>(INITIAL_DATA_PATHS[8]),
  ]);

  return {
    metadata,
    provinciasGeo,
    provinciasIndex,
    businessMetadata,
    ventasProvinciaMes: recordsOf(ventasProvinciaPayload),
    ventasClienteTotales: recordsOf(ventasClientePayload),
    clientesGeo,
    productos: recordsOf(productosPayload),
    calendario: recordsOf(calendarioPayload),
  };
}

export async function loadDepartmentMonthSales(): Promise<DepartmentMonthSale[]> {
  const payload = await fetchJson<{ records: DepartmentMonthSale[] }>(LAZY_DATA_PATHS.ventasDepartamentoMes);
  return recordsOf(payload);
}

export async function loadProductMonthSales(): Promise<ProductMonthSale[]> {
  const payload = await fetchJson<{ records: ProductMonthSale[] }>(LAZY_DATA_PATHS.ventasProductoMes);
  return recordsOf(payload);
}

export async function loadDetailedSalesCsv(): Promise<DetailedSaleRow[]> {
  const csvText = await fetchText(LAZY_DATA_PATHS.ventasMensualesCsv);
  return parseDetailedSalesCsv(csvText);
}

export async function loadProvinceLayer(relativePath: string): Promise<GeoJsonFeatureCollection> {
  return fetchJson<GeoJsonFeatureCollection>(`data/${relativePath.replace(/^data\//, '')}`);
}
