import type { CalendarRecord, FilterState, ProductRecord } from '../types/business';
import { periodLabel } from '../utils/formatters';

export interface OptionItem {
  id: string;
  name: string;
}

interface FilterPanelProps {
  filters: FilterState;
  provinces: OptionItem[];
  departments: OptionItem[];
  tipoClientes: string[];
  segmentos: string[];
  categorias: string[];
  productos: ProductRecord[];
  calendario: CalendarRecord[];
  detailedStatus: 'idle' | 'loading' | 'loaded' | 'error';
  lazyStatus: string;
  activeFilterCount: number;
  onChange: (patch: Partial<FilterState>) => void;
  onReset: () => void;
}

export function FilterPanel({
  filters,
  provinces,
  departments,
  tipoClientes,
  segmentos,
  categorias,
  productos,
  calendario,
  detailedStatus,
  lazyStatus,
  activeFilterCount,
  onChange,
  onReset,
}: FilterPanelProps) {
  const years = [...new Set(calendario.map((row) => String(row.anio)))];
  const months = [...new Set(calendario.map((row) => String(row.mes).padStart(2, '0')))]
    .map((month) => ({ id: month, name: calendario.find((row) => String(row.mes).padStart(2, '0') === month)?.mes_nombre ?? month }));
  const periods = calendario.map((row) => row.periodo);
  const filteredProducts = filters.categoriaProducto
    ? productos.filter((product) => product.categoria_producto === filters.categoriaProducto)
    : productos;

  return (
    <section className="control-section filters-section" aria-labelledby="filters-title">
      <div className="section-title section-title--stacked">
        <div>
          <span id="filters-title">Filtros</span>
          <small>{periodLabel(filters.periodoDesde, filters.periodoHasta)}</small>
        </div>
        <strong className="count-pill" aria-label={`${activeFilterCount} filtros activos`}>{activeFilterCount} activos</strong>
      </div>

      <div className="form-grid">
        <label htmlFor="filter-provincia">
          Provincia
          <select
            id="filter-provincia"
            name="provincia"
            value={filters.provinciaId}
            onChange={(event) => onChange({ provinciaId: event.target.value, departamentoId: '' })}
          >
            <option value="">Todas</option>
            {provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
          </select>
        </label>

        <label htmlFor="filter-departamento">
          Localidad / departamento / partido
          <select
            id="filter-departamento"
            name="departamento"
            value={filters.departamentoId}
            onChange={(event) => onChange({ departamentoId: event.target.value })}
            disabled={!filters.provinciaId && departments.length === 0}
          >
            <option value="">Todos</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>

        <label htmlFor="filter-localidad-query">
          Buscar localidad
          <input
            id="filter-localidad-query"
            name="localidadQuery"
            type="search"
            autoComplete="off"
            value={filters.localidadQuery}
            placeholder="Ej.: Morón, Rosario, Comuna 1"
            onChange={(event) => onChange({ localidadQuery: event.target.value })}
          />
        </label>

        <label htmlFor="filter-cliente-query">
          Cliente
          <input
            id="filter-cliente-query"
            name="clienteQuery"
            type="search"
            autoComplete="off"
            value={filters.clienteQuery}
            placeholder="ID o nombre del cliente"
            onChange={(event) => onChange({ clienteQuery: event.target.value })}
          />
        </label>

        <label htmlFor="filter-tipo-cliente">
          Tipo de cliente
          <select
            id="filter-tipo-cliente"
            name="tipoCliente"
            value={filters.tipoCliente}
            onChange={(event) => onChange({ tipoCliente: event.target.value })}
          >
            <option value="">Todos</option>
            {tipoClientes.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
          </select>
        </label>

        <label htmlFor="filter-segmento">
          Segmento
          <select
            id="filter-segmento"
            name="segmentoCliente"
            value={filters.segmentoCliente}
            onChange={(event) => onChange({ segmentoCliente: event.target.value })}
          >
            <option value="">Todos</option>
            {segmentos.map((segmento) => <option key={segmento} value={segmento}>{segmento}</option>)}
          </select>
        </label>

        <label htmlFor="filter-categoria-producto">
          Categoría producto
          <select
            id="filter-categoria-producto"
            name="categoriaProducto"
            value={filters.categoriaProducto}
            onChange={(event) => onChange({ categoriaProducto: event.target.value, productoId: '' })}
          >
            <option value="">Todas</option>
            {categorias.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
          </select>
        </label>

        <label htmlFor="filter-producto">
          Producto
          <select
            id="filter-producto"
            name="producto"
            value={filters.productoId}
            onChange={(event) => onChange({ productoId: event.target.value })}
          >
            <option value="">Todos</option>
            {filteredProducts.map((product) => (
              <option key={product.producto_id} value={product.producto_id}>{product.producto_nombre}</option>
            ))}
          </select>
        </label>

        <label htmlFor="filter-anio">
          Año
          <select id="filter-anio" name="anio" value={filters.anio} onChange={(event) => onChange({ anio: event.target.value })}>
            <option value="">Todos</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>

        <label htmlFor="filter-mes">
          Mes
          <select id="filter-mes" name="mes" value={filters.mes} onChange={(event) => onChange({ mes: event.target.value })}>
            <option value="">Todos</option>
            {months.map((month) => <option key={month.id} value={month.id}>{month.name}</option>)}
          </select>
        </label>

        <label htmlFor="filter-periodo-desde">
          Desde período
          <select id="filter-periodo-desde" name="periodoDesde" value={filters.periodoDesde} onChange={(event) => onChange({ periodoDesde: event.target.value })}>
            <option value="">Inicio</option>
            {periods.map((period) => <option key={period} value={period}>{period}</option>)}
          </select>
        </label>

        <label htmlFor="filter-periodo-hasta">
          Hasta período
          <select id="filter-periodo-hasta" name="periodoHasta" value={filters.periodoHasta} onChange={(event) => onChange({ periodoHasta: event.target.value })}>
            <option value="">Fin</option>
            {periods.map((period) => <option key={period} value={period}>{period}</option>)}
          </select>
        </label>
      </div>

      <div className="filter-footer">
        <button className="secondary-button" type="button" onClick={onReset} aria-label="Restablecer todos los filtros">Reset filtros</button>
        <span className={`lazy-pill lazy-pill--${detailedStatus}`} role="status" aria-live="polite">{lazyStatus}</span>
      </div>
    </section>
  );
}
