export const DATA_MANIFEST = {
  initial: {
    metadata: 'data/metadata.json',
    provinciasGeo: 'data/provincias.geojson',
    provinciasIndex: 'data/indexes/provincias_index.json',
    businessMetadata: 'data/business/metadata_business_v6.json',
    ventasProvinciaMes: 'data/business/agregados/ventas_provincia_mes.json',
    ventasClienteTotales: 'data/business/agregados/ventas_cliente_totales.json',
    productos: 'data/business/productos.json',
    calendario: 'data/business/calendario.json',
  },
  lazy: {
    clientesGeo: 'data/business/clientes.geojson',
    ventasDepartamentoMes: 'data/business/agregados/ventas_departamento_mes.json',
    ventasProductoMes: 'data/business/agregados/ventas_producto_mes.json',
    ventasMensualesCsv: 'data/business/ventas_mensuales.csv',
  },
} as const;

export const FORBIDDEN_INITIAL_DATA_PATTERNS = [
  'radios.geojson',
  '/radios/',
  'data/business/clientes.geojson',
  'data/business/ventas_mensuales.csv',
] as const;
