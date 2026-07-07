export type ViewMode =
  | 'base'
  | 'clientes'
  | 'clusters'
  | 'heatmap'
  | 'choropleth-provincia'
  | 'choropleth-departamento'
  | 'localidades';

export interface FilterState {
  provinciaId: string;
  departamentoId: string;
  tipoCliente: string;
  segmentoCliente: string;
  clienteQuery: string;
  localidadQuery: string;
  categoriaProducto: string;
  productoId: string;
  anio: string;
  mes: string;
  periodoDesde: string;
  periodoHasta: string;
  viewMode: ViewMode;
}

export interface CalendarRecord {
  periodo: string;
  anio: number;
  mes: number;
  fecha_mes: string;
  mes_nombre: string;
  trimestre: string;
  semestre: string;
  orden_periodo: number;
  dato_sintetico: boolean;
}

export interface ProductRecord {
  producto_id: string;
  categoria_producto: string;
  subcategoria_producto: string;
  producto_nombre: string;
  marca_ficticia: string;
  unidad_medida: string;
  precio_base: number;
  peso_estimado_kg: number;
  margen_base_pct: number;
  activo: boolean;
  dato_sintetico: boolean;
}

export interface ProvinceMonthSale {
  periodo: string;
  anio: number;
  mes: number;
  provincia_id: string;
  provincia_codigo?: string;
  provincia_nombre: string;
  registros_venta: number;
  clientes_unicos: number;
  unidades: number;
  venta_neta: number;
  costo_estimado: number;
  margen_bruto: number;
  margen_bruto_pct: number;
  volumen_kg: number;
  dato_sintetico: boolean;
}

export interface DepartmentMonthSale {
  periodo: string;
  anio: number;
  mes: number;
  provincia_id: string;
  provincia_nombre: string;
  departamento_id: string;
  departamento_nombre: string;
  registros_venta: number;
  clientes_unicos: number;
  unidades: number;
  venta_neta: number;
  costo_estimado: number;
  margen_bruto: number;
  margen_bruto_pct: number;
  volumen_kg: number;
  dato_sintetico: boolean;
}

export interface ProductMonthSale {
  periodo: string;
  anio: number;
  mes: number;
  producto_id: string;
  categoria_producto: string;
  subcategoria_producto: string;
  producto_nombre: string;
  registros_venta: number;
  clientes_unicos: number;
  unidades: number;
  venta_neta: number;
  costo_estimado: number;
  margen_bruto: number;
  margen_bruto_pct: number;
  volumen_kg: number;
  dato_sintetico: boolean;
}

export interface ClientTotalSale {
  cliente_id: string;
  cliente_nombre: string;
  tipo_cliente: string;
  segmento_cliente: string;
  provincia_id: string;
  provincia_nombre: string;
  departamento_id: string;
  departamento_nombre: string;
  localidad_id: string;
  localidad_nombre: string;
  lat: number;
  lon: number;
  registros_venta: number;
  clientes_unicos: number;
  unidades: number;
  venta_neta: number;
  costo_estimado: number;
  margen_bruto: number;
  margen_bruto_pct: number;
  volumen_kg: number;
  dato_sintetico: boolean;
}

export interface DetailedSaleRow {
  venta_id: string;
  cliente_id: string;
  producto_id: string;
  periodo: string;
  anio: number;
  mes: number;
  unidades: number;
  venta_neta: number;
  costo_estimado: number;
  margen_bruto: number;
  volumen_kg: number;
}

export interface SalesMetrics {
  clientesVisibles: number;
  ventaNeta: number;
  unidades: number;
  margenBruto: number;
  volumenKg: number;
  ticketPromedio: number;
  provinciaLider: string;
  productoLider: string;
  categoriaLider: string;
  registros: number;
  fuente: 'agregados' | 'cliente-agregado' | 'departamento-agregado' | 'detalle-csv';
}

export interface AggregatedBucket {
  id: string;
  name: string;
  venta_neta: number;
  unidades: number;
  margen_bruto: number;
  volumen_kg: number;
  clientes: Set<string>;
  /**
   * Recuento disponible cuando la fuente ya viene agregada y no incluye IDs de clientes.
   * En buckets con IDs, el Set `clientes` sigue siendo la fuente más precisa.
   */
  clientes_unicos: number;
  registros: number;
}

export interface V7ComputedData {
  metrics: SalesMetrics;
  provinceSales: Map<string, AggregatedBucket>;
  departmentSales: Map<string, AggregatedBucket>;
  productSales: Map<string, AggregatedBucket>;
  categorySales: Map<string, AggregatedBucket>;
  filteredClientIds: Set<string> | null;
}
