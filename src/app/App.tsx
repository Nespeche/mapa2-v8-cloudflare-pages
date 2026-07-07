import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { APP_VERSION, APP_VERSION_NAME } from '../domain/appVersion';
import { ErrorState } from '../components/ErrorState';
import { FilterPanel, type OptionItem } from '../components/FilterPanel';
import { KpiCards } from '../components/KpiCards';
import { LayerControls } from '../components/LayerControls';
import { Legend } from '../components/Legend';
import { LoadingState } from '../components/LoadingState';
import { TooltipPanel, type TooltipInfo } from '../components/TooltipPanel';
import {
  loadClientesGeo,
  loadDepartmentMonthSales,
  loadDetailedSalesCsv,
  loadInitialData,
  loadProductMonthSales,
  loadProvinceLayer,
  type InitialDataBundle,
} from '../data/dataClient';
import type { DepartmentMonthSale, DetailedSaleRow, ProductMonthSale, SalesMetrics, ViewMode } from '../types/business';
import type { GeoJsonFeatureCollection } from '../types/geo';
import {
  DEFAULT_FILTERS,
  canUseClientTotals,
  computeDataFromClientTotals,
  computeDataFromDepartmentAggregates,
  computeDataFromDetailedSales,
  computeDataFromProvinceAggregates,
  computeDepartmentSalesFromAggregates,
  computeSalesByClientFromDetailed,
  getTopSalesValue,
  mergeClientCountsIntoDepartmentSales,
  needsDepartmentAggregates,
  shouldLoadDetailedSales,
} from '../services/commercialMetrics';
import {
  enrichClientGeoJsonWithSales,
  enrichGeoJsonWithSales,
  filterClientGeoJson,
} from '../services/geoEnrichment';
import { formatCompactCurrency } from '../utils/formatters';


const MapView = lazy(() => import('../components/MapView').then((module) => ({ default: module.MapView })));

const CLIENT_LAYER_MODES: ViewMode[] = ['clientes', 'clusters', 'heatmap'];

function sourceLabel(source: SalesMetrics['fuente']): string {
  if (source === 'detalle-csv') return 'detalle CSV bajo demanda';
  if (source === 'cliente-agregado') return 'agregados cliente V10';
  if (source === 'departamento-agregado') return 'agregados territoriales V10';
  return 'agregados iniciales';
}

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  base: 'Territorial base',
  clientes: 'Clientes',
  clusters: 'Clusters',
  heatmap: 'Heatmap',
  'choropleth-provincia': 'Coroplético provincia',
  'choropleth-departamento': 'Coroplético departamento',
  localidades: 'Puntos localidades',
};

function emptyFeatureCollection(): GeoJsonFeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function optionSort(a: OptionItem, b: OptionItem) {
  return a.name.localeCompare(b.name, 'es');
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

function fallbackTopProduct(data: InitialDataBundle | null): string {
  return String(data?.businessMetadata?.sales_summary?.top_productos_por_ventas?.[0]?.name ?? 'Sin datos');
}

function selectedProvinceName(data: InitialDataBundle | null, provinciaId: string): string {
  if (!data || !provinciaId) return '';
  const entry = data.provinciasIndex.provinces[provinciaId];
  return entry?.provincia_nombre ?? '';
}

function countActiveFilters(filters: typeof DEFAULT_FILTERS): number {
  return [
    filters.provinciaId,
    filters.departamentoId,
    filters.tipoCliente,
    filters.segmentoCliente,
    filters.clienteQuery,
    filters.localidadQuery,
    filters.categoriaProducto,
    filters.productoId,
    filters.anio,
    filters.mes,
    filters.periodoDesde,
    filters.periodoHasta,
  ].filter(Boolean).length;
}

export default function App() {
  const [data, setData] = useState<InitialDataBundle | null>(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [initialError, setInitialError] = useState<string>('');
  const [hoverInfo, setHoverInfo] = useState<TooltipInfo | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<TooltipInfo | null>(null);

  const [departamentosGeo, setDepartamentosGeo] = useState<GeoJsonFeatureCollection | null>(null);
  const [localidadesGeo, setLocalidadesGeo] = useState<GeoJsonFeatureCollection | null>(null);
  const [clientesGeo, setClientesGeo] = useState<GeoJsonFeatureCollection | null>(null);
  const [departmentMonthSales, setDepartmentMonthSales] = useState<DepartmentMonthSale[] | null>(null);
  const [productMonthSales, setProductMonthSales] = useState<ProductMonthSale[] | null>(null);
  const [detailedSales, setDetailedSales] = useState<DetailedSaleRow[] | null>(null);
  const [lazyStatus, setLazyStatus] = useState('Carga inicial optimizada · CSV no cargado');
  const [detailedStatus, setDetailedStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  useEffect(() => {
    let active = true;
    loadInitialData()
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((error) => {
        if (active) setInitialError(error instanceof Error ? error.message : String(error));
      });
    return () => { active = false; };
  }, []);

  const patchFilters = (patch: Partial<typeof DEFAULT_FILTERS>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSelectedInfo(null);
  };

  const needsDetailed = shouldLoadDetailedSales(filters);
  const needsClientGeometry = CLIENT_LAYER_MODES.includes(filters.viewMode);
  const needsDepartmentData = filters.viewMode === 'choropleth-departamento' || needsDepartmentAggregates(filters);

  useEffect(() => {
    if (!data || !needsClientGeometry || clientesGeo) return undefined;
    let active = true;
    setLazyStatus('Cargando geometría de clientes bajo demanda…');
    loadClientesGeo()
      .then((payload) => {
        if (active) {
          setClientesGeo(payload);
          setLazyStatus(`Clientes cargados bajo demanda · ${payload.features.length.toLocaleString('es-AR')} puntos`);
        }
      })
      .catch((error) => {
        if (active) setLazyStatus(`Error al cargar clientes: ${error instanceof Error ? error.message : error}`);
      });
    return () => { active = false; };
  }, [data, needsClientGeometry, clientesGeo]);

  useEffect(() => {
    if (!data || !filters.provinciaId) {
      setDepartamentosGeo(null);
      setLocalidadesGeo(null);
      return;
    }
    const entry = data.provinciasIndex.provinces[filters.provinciaId];
    const departamentosPath = entry?.layers?.departamentos?.relative_path;
    if (!departamentosPath) return;
    let active = true;
    setLazyStatus('Cargando departamentos/partidos bajo demanda…');
    loadProvinceLayer(departamentosPath)
      .then((payload) => {
        if (active) {
          setDepartamentosGeo(payload);
          setLazyStatus('Departamentos/partidos cargados bajo demanda');
        }
      })
      .catch((error) => {
        if (active) setLazyStatus(`Error al cargar departamentos: ${error instanceof Error ? error.message : error}`);
      });
    return () => { active = false; };
  }, [data, filters.provinciaId]);

  useEffect(() => {
    if (!data || !filters.provinciaId || filters.viewMode !== 'localidades') {
      setLocalidadesGeo(null);
      return;
    }
    const entry = data.provinciasIndex.provinces[filters.provinciaId];
    const puntosPath = entry?.layers?.localidades_puntos?.relative_path;
    if (!puntosPath) {
      setLazyStatus('La provincia seleccionada no tiene puntos de localidades disponibles');
      return;
    }
    let active = true;
    setLazyStatus('Cargando puntos de localidades V5.1 bajo demanda…');
    loadProvinceLayer(puntosPath)
      .then((payload) => {
        if (active) {
          setLocalidadesGeo(payload);
          setLazyStatus('Puntos de localidades cargados bajo demanda');
        }
      })
      .catch((error) => {
        if (active) setLazyStatus(`Error al cargar localidades: ${error instanceof Error ? error.message : error}`);
      });
    return () => { active = false; };
  }, [data, filters.provinciaId, filters.viewMode]);

  useEffect(() => {
    if (!data || !needsDepartmentData || departmentMonthSales) return;
    let active = true;
    setLazyStatus('Cargando ventas por departamento/partido bajo demanda…');
    loadDepartmentMonthSales()
      .then((payload) => {
        if (active) {
          setDepartmentMonthSales(payload);
          setLazyStatus('Ventas por departamento/partido cargadas bajo demanda');
        }
      })
      .catch((error) => {
        if (active) setLazyStatus(`Error al cargar ventas departamentales: ${error instanceof Error ? error.message : error}`);
      });
    return () => { active = false; };
  }, [data, needsDepartmentData, departmentMonthSales]);

  useEffect(() => {
    if (!data || (!filters.productoId && !filters.categoriaProducto) || productMonthSales) return;
    let active = true;
    setLazyStatus('Cargando ventas por producto bajo demanda…');
    loadProductMonthSales()
      .then((payload) => {
        if (active) {
          setProductMonthSales(payload);
          setLazyStatus('Ventas por producto cargadas bajo demanda');
        }
      })
      .catch((error) => {
        if (active) setLazyStatus(`Error al cargar ventas por producto: ${error instanceof Error ? error.message : error}`);
      });
    return () => { active = false; };
  }, [data, filters.productoId, filters.categoriaProducto, productMonthSales]);

  useEffect(() => {
    if (!data || !needsDetailed || detailedSales) {
      if (!needsDetailed && !detailedSales) setDetailedStatus('idle');
      return undefined;
    }

    let active = true;
    setDetailedStatus('loading');
    setLazyStatus('Cargando ventas_mensuales.csv bajo demanda para filtros detallados…');
    loadDetailedSalesCsv()
      .then((payload) => {
        if (active) {
          setDetailedSales(payload);
          setDetailedStatus('loaded');
          setLazyStatus(`Detalle CSV cargado bajo demanda · ${payload.length.toLocaleString('es-AR')} ventas`);
        }
      })
      .catch((error) => {
        if (active) {
          setDetailedStatus('error');
          setLazyStatus(`Error al cargar CSV detallado: ${error instanceof Error ? error.message : error}`);
        }
      });
    return () => { active = false; };
  }, [data, needsDetailed, detailedSales]);

  const options = useMemo(() => {
    if (!data) {
      return {
        provinces: [],
        departments: [],
        tipoClientes: [],
        segmentos: [],
        categorias: [],
      };
    }
    const provinces = data.provinciasGeo.features.map((feature) => ({
      id: String(feature.properties.id_entidad ?? feature.properties.provincia_id ?? ''),
      name: String(feature.properties.nombre ?? feature.properties.provincia_nombre ?? ''),
    })).filter((option) => option.id && option.name).sort(optionSort);

    const departmentSource = data.ventasClienteTotales
      .filter((client) => !filters.provinciaId || client.provincia_id === filters.provinciaId)
      .map((client) => ({ id: client.departamento_id, name: client.departamento_nombre }));

    const departments = [...new Map(departmentSource.filter((item) => item.id && item.name).map((item) => [item.id, item])).values()].sort(optionSort);

    return {
      provinces,
      departments,
      tipoClientes: uniqueSorted(data.ventasClienteTotales.map((client) => client.tipo_cliente)),
      segmentos: uniqueSorted(data.ventasClienteTotales.map((client) => client.segmento_cliente)),
      categorias: uniqueSorted(data.productos.map((product) => product.categoria_producto)),
    };
  }, [data, filters.provinciaId]);

  const computed = useMemo(() => {
    if (!data) return null;
    const fallback = fallbackTopProduct(data);
    if (detailedSales && needsDetailed) {
      return computeDataFromDetailedSales(detailedSales, data.ventasClienteTotales, data.productos, filters, fallback);
    }
    if (departmentMonthSales && needsDepartmentAggregates(filters)) {
      return computeDataFromDepartmentAggregates(departmentMonthSales, data.ventasClienteTotales, data.productos, filters, fallback);
    }
    if (canUseClientTotals(filters)) {
      return computeDataFromClientTotals(data.ventasClienteTotales, data.productos, filters, fallback);
    }
    return computeDataFromProvinceAggregates(data.ventasProvinciaMes, data.ventasClienteTotales, data.productos, filters, fallback);
  }, [data, departmentMonthSales, detailedSales, filters, needsDetailed]);

  const departmentSalesMap = useMemo(() => {
    if (!data || !computed) return new Map();

    const baseDepartmentSales = computed.departmentSales.size > 0
      ? computed.departmentSales
      : departmentMonthSales
        ? computeDepartmentSalesFromAggregates(departmentMonthSales, filters)
        : new Map();

    if (computed.metrics.fuente === 'detalle-csv') return baseDepartmentSales;

    return mergeClientCountsIntoDepartmentSales(baseDepartmentSales, data.ventasClienteTotales, filters);
  }, [computed, data, departmentMonthSales, filters]);

  const clientSalesMap = useMemo(() => {
    if (!data || !detailedSales || !needsDetailed) return null;
    return computeSalesByClientFromDetailed(detailedSales, data.ventasClienteTotales, data.productos, filters);
  }, [data, detailedSales, filters, needsDetailed]);

  const mapData = useMemo(() => {
    if (!data || !computed) {
      return {
        provinciasGeo: emptyFeatureCollection(),
        departamentosGeo: null,
        localidadesGeo,
        clientesGeo: emptyFeatureCollection(),
      };
    }
    const provinceGeo = enrichGeoJsonWithSales(data.provinciasGeo, computed.provinceSales, ['id_entidad', 'provincia_id']);
    const deptGeo = departamentosGeo ? enrichGeoJsonWithSales(departamentosGeo, departmentSalesMap, ['id_entidad', 'departamento_id']) : null;
    const clientGeoFiltered = clientesGeo ? filterClientGeoJson(clientesGeo, data.ventasClienteTotales, filters, computed.filteredClientIds) : emptyFeatureCollection();
    const clientGeo = enrichClientGeoJsonWithSales(clientGeoFiltered, clientSalesMap);
    return { provinciasGeo: provinceGeo, departamentosGeo: deptGeo, localidadesGeo, clientesGeo: clientGeo };
  }, [data, computed, departamentosGeo, localidadesGeo, clientesGeo, filters, departmentSalesMap, clientSalesMap]);

  const selectedProvince = selectedProvinceName(data, filters.provinciaId);
  const maxProvinceSales = computed ? getTopSalesValue(computed.provinceSales) : 0;
  const maxDepartmentSales = getTopSalesValue(departmentSalesMap);

  if (initialError) {
    return <ErrorState title={`No se pudo iniciar Mapa 2 · ${APP_VERSION}`} message={initialError} />;
  }

  if (!data || !computed) {
    return <LoadingState label={`Preparando Mapa 2 · ${APP_VERSION}…`} />;
  }

  const syntheticNotice = String(data.businessMetadata.synthetic_data_notice ?? 'Clientes, productos y ventas son ficticios.');
  const filteredProductName = filters.productoId
    ? data.productos.find((product) => product.producto_id === filters.productoId)?.producto_nombre
    : '';
  const productSummary = productMonthSales && (filters.productoId || filters.categoriaProducto)
    ? `${productMonthSales.length.toLocaleString('es-AR')} agregados producto/mes disponibles`
    : 'Producto/mes se carga bajo demanda';
  const activeFilterCount = countActiveFilters(filters);
  const hasNoCommercialResults = computed.metrics.clientesVisibles === 0 && detailedStatus !== 'loading';

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label={`Panel de control Mapa 2 ${APP_VERSION}`}>
        <header className="brand-header">
          <div className="brand-topline">
            <span className="eyebrow">MAPA 2 · {APP_VERSION}</span>
            <span className="release-pill">Cloudflare Pages</span>
          </div>
          <h1>Mapa territorial comercial</h1>
          <p>{syntheticNotice}</p>
          <div className="brand-meta" aria-label="Estado de datos preservados">
            <span>Censo V5.1</span>
            <span>Ventas sintéticas V6</span>
            <span>Contratos V10.3</span>
            <span>Arquitectura V10.4</span>
          </div>
        </header>

        <KpiCards metrics={computed.metrics} />

        <LayerControls filters={filters} onChange={patchFilters} />

        <FilterPanel
          filters={filters}
          provinces={options.provinces}
          departments={options.departments}
          tipoClientes={options.tipoClientes}
          segmentos={options.segmentos}
          categorias={options.categorias}
          productos={data.productos}
          calendario={data.calendario}
          detailedStatus={detailedStatus}
          lazyStatus={lazyStatus}
          activeFilterCount={activeFilterCount}
          onChange={patchFilters}
          onReset={resetFilters}
        />

        <div className="data-note" aria-label="Estrategia de carga de datos">
          <strong>Carga optimizada</strong>
          <p>Inicio: provincias, productos, calendario y agregados provincia/cliente.</p>
          <p>Bajo demanda: motor MapLibre, geometría de clientes, departamentos, localidades, producto/mes y CSV detallado.</p>
          <p>{APP_VERSION_NAME}</p>
          <p>{productSummary}{filteredProductName ? ` · ${filteredProductName}` : ''}</p>
        </div>
      </aside>

      <main className="map-stage" aria-label="Mapa interactivo y análisis visual">
        <div className="topbar glass-card">
          <div>
            <span>{selectedProvince || 'Argentina'}</span>
            <strong>{VIEW_MODE_LABELS[filters.viewMode]}</strong>
          </div>
          <div className="topbar-metrics" aria-live="polite">
            <span>{formatCompactCurrency(computed.metrics.ventaNeta)}</span>
            <small>{sourceLabel(computed.metrics.fuente)}</small>
          </div>
        </div>

        <Suspense fallback={<div className="map-suspense glass-card" role="status" aria-live="polite"><span className="spinner" /> Cargando motor de mapa bajo demanda…</div>}>
          <MapView
            mode={filters.viewMode}
            provinciasGeo={mapData.provinciasGeo}
            departamentosGeo={mapData.departamentosGeo}
            localidadesGeo={mapData.localidadesGeo}
            clientesGeo={mapData.clientesGeo}
            selectedProvinceId={filters.provinciaId}
            provinceSales={computed.provinceSales}
            departmentSales={departmentSalesMap}
            maxProvinceSales={maxProvinceSales}
            maxDepartmentSales={maxDepartmentSales}
            onProvinceSelect={(provinceId) => patchFilters({ provinciaId: provinceId, departamentoId: '' })}
            onClientSelect={(info) => setSelectedInfo(info)}
            onHoverInfo={setHoverInfo}
          />
        </Suspense>

        <div className="right-rail">
          <Legend mode={filters.viewMode} maxValue={filters.viewMode === 'choropleth-departamento' ? maxDepartmentSales : maxProvinceSales} selectedProvince={selectedProvince} />
          <TooltipPanel info={selectedInfo ?? hoverInfo} />
        </div>

        {hasNoCommercialResults && (
          <div className="empty-results-card" role="status" aria-live="polite">
            <strong>Sin resultados comerciales</strong>
            <span>Los filtros actuales no encuentran clientes o ventas. Probá limpiar filtros o ampliar el período.</span>
          </div>
        )}

        {detailedStatus === 'loading' && (
          <div className="lazy-status-card" role="status" aria-live="polite">
            <span className="spinner" />
            <span>Cargando detalle comercial bajo demanda sin bloquear el mapa…</span>
          </div>
        )}
      </main>
    </div>
  );
}
