export const BUSINESS_CONTRACT_VERSION = 'business-v6-contract-v10.3' as const;

export const BUSINESS_EXPECTED_COUNTS = {
  clientes: 2_000,
  productos: 65,
  ventasMensualesCsv: 128_998,
  calendarioMeses: 24,
  ventasClienteTotales: 2_000,
  ventasDepartamentoMes: 6_432,
  ventasProductoMes: 1_560,
  ventasProvinciaMes: 264,
} as const;

export const BUSINESS_EXPECTED_PERIOD = {
  from: '2025-01',
  to: '2026-12',
} as const;

export const REQUIRED_CLIENT_FIELDS = [
  'cliente_id',
  'provincia_id',
  'departamento_id',
  'lat',
  'lon',
  'dato_sintetico',
] as const;

export const REQUIRED_PRODUCT_FIELDS = [
  'producto_id',
  'categoria_producto',
] as const;

export const REQUIRED_DETAILED_SALE_FIELDS = [
  'cliente_id',
  'producto_id',
  'periodo',
  'anio',
  'mes',
  'unidades',
  'venta_neta',
  'margen_bruto',
] as const;

export const KPI_SEMANTICS = {
  clientesVisibles:
    'Cantidad de clientes territoriales filtrados cuando se usan agregados; con detalle CSV cargado, cantidad de clientes con ventas activas en el período/producto filtrado.',
  ventaNeta: 'Suma de venta_neta del conjunto comercial filtrado, expresada en pesos sintéticos.',
  unidades: 'Suma de unidades vendidas del conjunto comercial filtrado.',
  margenBruto: 'Suma de margen_bruto del conjunto comercial filtrado.',
  ticketPromedio: 'ventaNeta / clientesVisibles. Si clientesVisibles es 0, el resultado es 0.',
  provinciaLider: 'Provincia con mayor venta_neta dentro del filtro activo.',
  productoLider: 'Producto con mayor venta_neta si el detalle lo permite; con agregados iniciales usa el principal informado por metadata como fallback.',
  categoriaLider: 'Categoría con mayor venta_neta si el detalle lo permite; con agregados iniciales puede quedar sin datos.',
  fuente:
    'Origen de cálculo del KPI: agregados iniciales, agregados por cliente, agregados por departamento o CSV detallado cargado bajo demanda.',
} as const;
