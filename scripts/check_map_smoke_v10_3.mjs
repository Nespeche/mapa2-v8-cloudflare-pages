import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { exitIfViolations, finalStatus, writeJson, writeMd } from './lib/contract_helpers.mjs';

const root = process.cwd();
const docsDir = join(root, 'docs');
const violations = [];
const warnings = [];

function read(relativePath) {
  const absolute = join(root, relativePath);
  if (!existsSync(absolute)) {
    violations.push(`Falta archivo requerido para smoke map: ${relativePath}`);
    return '';
  }
  return readFileSync(absolute, 'utf8');
}

const main = read('src/app/main.tsx');
const app = read('src/app/App.tsx');
const mapView = read('src/components/MapView.tsx');
const styles = read('src/app/styles.css');
const dataPaths = read('src/data/dataManifest.ts');
const aggregations = read('src/utils/aggregations.ts');

const checks = [
  { id: 'maplibre_css_import', ok: main.includes("maplibre-gl/dist/maplibre-gl.css"), fail: 'main.tsx no importa maplibre-gl/dist/maplibre-gl.css.' },
  { id: 'map_container_class', ok: mapView.includes('className="map-canvas"'), fail: 'MapView no renderiza contenedor .map-canvas.' },
  { id: 'map_constructor', ok: /new\s+maplibregl\.Map/.test(mapView), fail: 'MapView no inicializa MapLibre con new maplibregl.Map.' },
  { id: 'map_resize_guard', ok: mapView.includes('ResizeObserver') && mapView.includes('map.resize()'), fail: 'MapView no tiene ResizeObserver/map.resize para evitar canvas con tamaño cero.' },
  { id: 'provincias_fill_layer', ok: mapView.includes("id: 'provincias-fill'") || mapView.includes('id: "provincias-fill"'), fail: 'MapView no declara layer provincias-fill.' },
  { id: 'department_lazy_layer', ok: app.includes('loadProvinceLayer') && app.includes('departamentosPath'), fail: 'App no mantiene carga bajo demanda de departamentos al seleccionar provincia.' },
  { id: 'clientes_lazy_load', ok: dataPaths.includes("clientesGeo: 'data/business/clientes.geojson'") && app.includes('loadClientesGeo()'), fail: 'clientes.geojson no está configurado como carga bajo demanda.' },
  { id: 'csv_lazy_load', ok: dataPaths.includes("ventasMensualesCsv: 'data/business/ventas_mensuales.csv'") && app.includes('loadDetailedSalesCsv()'), fail: 'ventas_mensuales.csv no está configurado como carga bajo demanda.' },
  { id: 'product_filter_triggers_csv', ok: aggregations.includes('if (hasProductLevelFilter(filters)) return true'), fail: 'Filtro producto/categoría no fuerza carga del CSV detallado.' },
  { id: 'clusters_layer', ok: mapView.includes("id: 'clusters-circle'") && mapView.includes("mode === 'clusters'"), fail: 'MapView no mantiene layer/visibilidad de clusters.' },
  { id: 'heatmap_layer', ok: mapView.includes("id: 'clientes-heatmap'") && mapView.includes("mode === 'heatmap'"), fail: 'MapView no mantiene layer/visibilidad de heatmap.' },
  { id: 'map_canvas_css_position', ok: /\.map-canvas\s*\{[\s\S]*position:\s*absolute[\s\S]*inset:\s*0[\s\S]*z-index:\s*1/.test(styles), fail: '.map-canvas no conserva CSS visible/inset/z-index.' },
  { id: 'map_stage_height', ok: /\.map-stage\s*\{[\s\S]*height:\s*100vh/.test(styles), fail: '.map-stage no conserva height: 100vh.' },
  { id: 'no_persistent_detail_loading_text', ok: !app.includes('Cargando detalle comercial bajo demanda…'), fail: 'Se reintrodujo texto persistente de carga de detalle comercial.' },
];

for (const check of checks) {
  if (!check.ok) violations.push(check.fail);
}

const report = {
  phase: 'V10.3 — MapLibre static smoke checks',
  generated_at: new Date().toISOString(),
  status: finalStatus(violations),
  checks: checks.map(({ id, ok }) => ({ id, ok })),
  warnings,
  violations,
};

writeJson(join(docsDir, 'MAP_SMOKE_AUDIT_V10_3.json'), report);
writeMd(join(docsDir, 'MAP_SMOKE_AUDIT_V10_3.md'), `# Mapa 2 — Smoke test estático MapLibre V10.3\n\n` +
  `**Resultado:** ${report.status}\n\n` +
  `## Checks\n\n${checks.map((check) => `- ${check.ok ? 'OK' : 'ERROR'} — ${check.id}`).join('\n')}\n\n` +
  `## Advertencias\n\n${warnings.length ? warnings.map((item) => `- ${item}`).join('\n') : '- Sin advertencias.'}\n\n` +
  `## Errores bloqueantes\n\n${violations.length ? violations.map((item) => `- ${item}`).join('\n') : '- Sin errores bloqueantes.'}\n`);

console.log('[map-smoke-v10.3] OK smoke test estático generado');
exitIfViolations('map-smoke-v10.3', violations);
