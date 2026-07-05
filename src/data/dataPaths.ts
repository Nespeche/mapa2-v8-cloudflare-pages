export const INITIAL_DATA_PATHS = [
  'data/metadata.json',
  'data/provincias.geojson',
  'data/indexes/provincias_index.json',
  'data/business/metadata_business_v6.json',
  'data/business/agregados/ventas_provincia_mes.json',
  'data/business/agregados/ventas_cliente_totales.json',
  'data/business/clientes.geojson',
  'data/business/productos.json',
  'data/business/calendario.json',
] as const;

export const LAZY_DATA_PATHS = {
  ventasDepartamentoMes: 'data/business/agregados/ventas_departamento_mes.json',
  ventasProductoMes: 'data/business/agregados/ventas_producto_mes.json',
  ventasMensualesCsv: 'data/business/ventas_mensuales.csv',
} as const;

export function assetUrl(relativePath: string): string {
  const normalizedBase = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  const normalizedPath = relativePath.replace(/^\//, '');
  return `${normalizedBase}${normalizedPath}`;
}
