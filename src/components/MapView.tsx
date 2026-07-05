import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { AggregatedBucket, ViewMode } from '../types/business';
import type { GeoJsonFeatureCollection } from '../types/geo';
import { boundsFromFeature, findFeatureById } from '../map/bounds';
import { argentinaInitialCenter, argentinaInitialZoom, choroplethFill, heatmapWeight, mapBaseStyle } from '../map/mapStyle';
import { formatCompactCurrency, formatNumber } from '../utils/formatters';
import type { TooltipInfo } from './TooltipPanel';

interface MapViewProps {
  mode: ViewMode;
  provinciasGeo: GeoJsonFeatureCollection;
  departamentosGeo: GeoJsonFeatureCollection | null;
  localidadesGeo: GeoJsonFeatureCollection | null;
  clientesGeo: GeoJsonFeatureCollection;
  selectedProvinceId: string;
  provinceSales: Map<string, AggregatedBucket>;
  departmentSales: Map<string, AggregatedBucket>;
  maxProvinceSales: number;
  maxDepartmentSales: number;
  onProvinceSelect: (provinceId: string) => void;
  onClientSelect: (info: TooltipInfo) => void;
  onHoverInfo: (info: TooltipInfo | null) => void;
}

const SOURCE_PROVINCIAS = 'mapa2-provincias-source';
const SOURCE_DEPARTAMENTOS = 'mapa2-departamentos-source';
const SOURCE_CLIENTES = 'mapa2-clientes-source';
const SOURCE_LOCALIDADES = 'mapa2-localidades-source';

function updateGeoJsonSource(map: MapLibreMap, sourceId: string, data: GeoJsonFeatureCollection, cluster = false): void {
  const existing = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data as any);
    return;
  }
  map.addSource(sourceId, {
    type: 'geojson',
    data: data as any,
    cluster,
    clusterRadius: 46,
    clusterMaxZoom: 11,
  } as any);
}

function setVisibility(map: MapLibreMap, layerId: string, visible: boolean): void {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  }
}

function tooltipFromProvince(props: Record<string, any>, sales?: AggregatedBucket): TooltipInfo {
  return {
    title: String(props.nombre ?? props.provincia_nombre ?? 'Provincia'),
    subtitle: 'Provincia · Censo V5.1 + ventas V6',
    rows: [
      { label: 'Población 2022', value: formatNumber(Number(props.poblacion_total ?? props.tooltip_poblacion ?? 0)) },
      { label: 'Venta neta', value: formatCompactCurrency(sales?.venta_neta ?? Number(props.venta_neta_v7 ?? 0)) },
      { label: 'Unidades', value: formatNumber(sales?.unidades ?? Number(props.unidades_v7 ?? 0)) },
      { label: 'Margen bruto', value: formatCompactCurrency(sales?.margen_bruto ?? Number(props.margen_bruto_v7 ?? 0)) },
    ],
  };
}

function tooltipFromDepartment(props: Record<string, any>, sales?: AggregatedBucket): TooltipInfo {
  return {
    title: String(props.nombre ?? props.departamento_nombre ?? props.tooltip_nombre ?? 'Departamento'),
    subtitle: 'Departamento / partido · bajo demanda',
    rows: [
      { label: 'Población 2022', value: formatNumber(Number(props.poblacion_total ?? props.tooltip_poblacion ?? 0)) },
      { label: 'Venta neta', value: formatCompactCurrency(sales?.venta_neta ?? Number(props.venta_neta_v7 ?? 0)) },
      { label: 'Clientes', value: sales?.clientes.size ?? Number(props.clientes_v7 ?? 0) },
    ],
  };
}

function tooltipFromClient(props: Record<string, any>): TooltipInfo {
  return {
    title: String(props.cliente_nombre ?? props.cliente_id ?? 'Cliente'),
    subtitle: 'Cliente sintético V6',
    rows: [
      { label: 'ID', value: String(props.cliente_id ?? '') },
      { label: 'Tipo', value: String(props.tipo_cliente ?? '') },
      { label: 'Segmento', value: String(props.segmento_cliente ?? '') },
      { label: 'Provincia', value: String(props.provincia_nombre ?? '') },
      { label: 'Localidad', value: String(props.localidad_nombre ?? props.departamento_nombre ?? '') },
      { label: 'Venta neta', value: formatCompactCurrency(Number(props.venta_neta_v7 ?? props.venta_neta ?? 0)) },
      { label: 'Dato', value: props.dato_sintetico ? 'Sintético' : 'No identificado' },
    ],
  };
}

export function MapView({
  mode,
  provinciasGeo,
  departamentosGeo,
  localidadesGeo,
  clientesGeo,
  selectedProvinceId,
  provinceSales,
  departmentSales,
  maxProvinceSales,
  maxDepartmentSales,
  onProvinceSelect,
  onClientSelect,
  onHoverInfo,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [isReady, setIsReady] = useState(false);

  const salesRefs = useMemo(() => ({ provinceSales, departmentSales }), [provinceSales, departmentSales]);
  const salesRefsRef = useRef(salesRefs);
  salesRefsRef.current = salesRefs;

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapBaseStyle,
      center: argentinaInitialCenter,
      zoom: argentinaInitialZoom,
      minZoom: 2.6,
      maxZoom: 14,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    mapRef.current = map;

    map.on('load', () => {
      updateGeoJsonSource(map, SOURCE_PROVINCIAS, provinciasGeo);
      updateGeoJsonSource(map, SOURCE_DEPARTAMENTOS, departamentosGeo ?? { type: 'FeatureCollection', features: [] });
      updateGeoJsonSource(map, SOURCE_CLIENTES, clientesGeo, true);
      updateGeoJsonSource(map, SOURCE_LOCALIDADES, localidadesGeo ?? { type: 'FeatureCollection', features: [] });

      map.addLayer({
        id: 'provincias-fill',
        type: 'fill',
        source: SOURCE_PROVINCIAS,
        paint: {
          'fill-color': 'rgba(242, 246, 255, 0.62)',
          'fill-outline-color': 'rgba(55, 74, 102, 0.3)',
        },
      });
      map.addLayer({
        id: 'provincias-line',
        type: 'line',
        source: SOURCE_PROVINCIAS,
        paint: {
          'line-color': 'rgba(18, 31, 55, 0.54)',
          'line-width': ['case', ['==', ['get', 'id_entidad'], selectedProvinceId || '__none__'], 2.4, 0.8],
        },
      });

      map.addLayer({
        id: 'departamentos-fill',
        type: 'fill',
        source: SOURCE_DEPARTAMENTOS,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': 'rgba(125, 162, 255, 0.24)',
          'fill-outline-color': 'rgba(31, 56, 95, 0.34)',
        },
      });
      map.addLayer({
        id: 'departamentos-line',
        type: 'line',
        source: SOURCE_DEPARTAMENTOS,
        layout: { visibility: 'none' },
        paint: {
          'line-color': 'rgba(19, 31, 57, 0.42)',
          'line-width': 0.7,
        },
      });

      map.addLayer({
        id: 'clientes-heatmap',
        type: 'heatmap',
        source: SOURCE_CLIENTES,
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': heatmapWeight(1) as any,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3, 0.9, 9, 2.2],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 12, 9, 30],
          'heatmap-opacity': 0.82,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(48, 85, 160, 0)',
            0.2, 'rgba(135, 185, 255, 0.55)',
            0.45, 'rgba(77, 133, 255, 0.72)',
            0.7, 'rgba(255, 168, 80, 0.78)',
            1, 'rgba(255, 86, 86, 0.88)',
          ],
        },
      });

      map.addLayer({
        id: 'clusters-circle',
        type: 'circle',
        source: SOURCE_CLIENTES,
        filter: ['has', 'point_count'],
        layout: { visibility: 'none' },
        paint: {
          'circle-color': ['step', ['get', 'point_count'], 'rgba(75, 123, 255, 0.78)', 40, 'rgba(37, 78, 202, 0.82)', 140, 'rgba(20, 42, 118, 0.88)'],
          'circle-radius': ['step', ['get', 'point_count'], 17, 40, 24, 140, 32],
          'circle-stroke-color': 'rgba(255, 255, 255, 0.92)',
          'circle-stroke-width': 1.5,
        },
      });
      map.addLayer({
        id: 'clientes-circle',
        type: 'circle',
        source: SOURCE_CLIENTES,
        filter: ['!', ['has', 'point_count']],
        layout: { visibility: 'none' },
        paint: {
          'circle-color': 'rgba(5, 23, 52, 0.82)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 8, 6, 12, 9],
          'circle-stroke-width': 1.1,
          'circle-stroke-color': 'rgba(255,255,255,0.92)',
        },
      });

      map.addLayer({
        id: 'localidades-circle',
        type: 'circle',
        source: SOURCE_LOCALIDADES,
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2, 9, 5],
          'circle-color': 'rgba(0, 128, 133, 0.72)',
          'circle-stroke-width': 0.8,
          'circle-stroke-color': 'rgba(255,255,255,0.86)',
        },
      });

      map.on('mousemove', 'provincias-fill', (event) => {
        const feature = event.features?.[0];
        if (!feature?.properties) return;
        const provinceId = String(feature.properties.id_entidad ?? feature.properties.provincia_id ?? '');
        onHoverInfo(tooltipFromProvince(feature.properties, salesRefsRef.current.provinceSales.get(provinceId)));
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'provincias-fill', () => {
        onHoverInfo(null);
        map.getCanvas().style.cursor = '';
      });
      map.on('click', 'provincias-fill', (event) => {
        const feature = event.features?.[0];
        if (!feature?.properties) return;
        const provinceId = String(feature.properties.id_entidad ?? feature.properties.provincia_id ?? '');
        if (provinceId) onProvinceSelect(provinceId);
      });

      map.on('mousemove', 'departamentos-fill', (event) => {
        const feature = event.features?.[0];
        if (!feature?.properties) return;
        const departmentId = String(feature.properties.id_entidad ?? feature.properties.departamento_id ?? '');
        onHoverInfo(tooltipFromDepartment(feature.properties, salesRefsRef.current.departmentSales.get(departmentId)));
      });
      map.on('mouseleave', 'departamentos-fill', () => onHoverInfo(null));

      map.on('mousemove', 'clusters-circle', (event) => {
        const feature = event.features?.[0];
        const pointCount = Number(feature?.properties?.point_count ?? 0);
        onHoverInfo({
          title: 'Cluster de clientes',
          subtitle: 'Agrupación dinámica MapLibre',
          rows: [
            { label: 'Clientes agrupados', value: formatNumber(pointCount) },
            { label: 'Acción', value: 'Click para acercar' },
          ],
        });
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'clusters-circle', () => {
        onHoverInfo(null);
        map.getCanvas().style.cursor = '';
      });
      map.on('click', 'clusters-circle', (event) => {
        const features = map.queryRenderedFeatures(event.point, { layers: ['clusters-circle'] });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource(SOURCE_CLIENTES) as GeoJSONSource | undefined;
        if (clusterId !== undefined && source?.getClusterExpansionZoom) {
          source.getClusterExpansionZoom(clusterId).then((zoom) => {
            map.easeTo({ center: event.lngLat, zoom, duration: 650 });
          }).catch(() => undefined);
        }
      });

      const clientHover = (event: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const feature = event.features?.[0];
        if (!feature?.properties) return;
        onHoverInfo(tooltipFromClient(feature.properties));
        map.getCanvas().style.cursor = 'pointer';
      };
      map.on('mousemove', 'clientes-circle', clientHover);
      map.on('mouseleave', 'clientes-circle', () => {
        onHoverInfo(null);
        map.getCanvas().style.cursor = '';
      });
      map.on('click', 'clientes-circle', (event) => {
        const feature = event.features?.[0];
        if (feature?.properties) onClientSelect(tooltipFromClient(feature.properties));
      });

      setIsReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setIsReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady) return;
    updateGeoJsonSource(map, SOURCE_PROVINCIAS, provinciasGeo);
    updateGeoJsonSource(map, SOURCE_DEPARTAMENTOS, departamentosGeo ?? { type: 'FeatureCollection', features: [] });
    updateGeoJsonSource(map, SOURCE_CLIENTES, clientesGeo, true);
    updateGeoJsonSource(map, SOURCE_LOCALIDADES, localidadesGeo ?? { type: 'FeatureCollection', features: [] });
  }, [isReady, provinciasGeo, departamentosGeo, clientesGeo, localidadesGeo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady) return;
    const isProvinceChoro = mode === 'choropleth-provincia';
    const isDepartmentChoro = mode === 'choropleth-departamento';

    map.setPaintProperty(
      'provincias-fill',
      'fill-color',
      (isProvinceChoro ? choroplethFill(maxProvinceSales) : 'rgba(242, 246, 255, 0.62)') as any,
    );
    map.setPaintProperty(
      'departamentos-fill',
      'fill-color',
      (isDepartmentChoro ? choroplethFill(maxDepartmentSales) : 'rgba(125, 162, 255, 0.24)') as any,
    );
    map.setPaintProperty('clientes-heatmap', 'heatmap-weight', heatmapWeight(maxProvinceSales) as any);
    map.setPaintProperty('provincias-line', 'line-width', ['case', ['==', ['get', 'id_entidad'], selectedProvinceId || '__none__'], 2.4, 0.8] as any);

    setVisibility(map, 'departamentos-fill', isDepartmentChoro || Boolean(selectedProvinceId && departamentosGeo));
    setVisibility(map, 'departamentos-line', isDepartmentChoro || Boolean(selectedProvinceId && departamentosGeo));
    setVisibility(map, 'clientes-circle', mode === 'clientes');
    setVisibility(map, 'clusters-circle', mode === 'clusters');
    setVisibility(map, 'clientes-heatmap', mode === 'heatmap');
    setVisibility(map, 'localidades-circle', mode === 'localidades');
  }, [mode, isReady, maxProvinceSales, maxDepartmentSales, selectedProvinceId, departamentosGeo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady || !selectedProvinceId) return;
    const feature = findFeatureById(provinciasGeo, selectedProvinceId);
    const bounds = feature ? boundsFromFeature(feature) : null;
    if (bounds) map.fitBounds(bounds, { padding: 62, duration: 700, maxZoom: 7.4 });
  }, [selectedProvinceId, provinciasGeo, isReady]);

  return <div ref={mapContainerRef} className="map-canvas" aria-label="Mapa interactivo de Argentina" />;
}
