import type { FilterState, ViewMode } from '../types/business';

const modes: Array<{ id: ViewMode; label: string; help: string }> = [
  { id: 'base', label: 'Territorial base', help: 'Provincias y selección territorial.' },
  { id: 'clientes', label: 'Clientes', help: 'Puntos individuales filtrados.' },
  { id: 'clusters', label: 'Clusters', help: 'Agrupación dinámica de clientes.' },
  { id: 'heatmap', label: 'Heatmap', help: 'Concentración por venta o clientes.' },
  { id: 'choropleth-provincia', label: 'Coroplético provincia', help: 'Ventas agregadas por provincia.' },
  { id: 'choropleth-departamento', label: 'Coroplético departamento', help: 'Ventas por departamento/partido bajo demanda.' },
  { id: 'localidades', label: 'Puntos localidades', help: 'Puntos V5.1 bajo demanda por provincia.' },
];

export function LayerControls({ filters, onChange }: { filters: FilterState; onChange: (patch: Partial<FilterState>) => void }) {
  return (
    <section className="control-section" aria-labelledby="layers-title">
      <div className="section-title section-title--stacked">
        <div>
          <span id="layers-title">Capas</span>
          <small>Modo de visualización</small>
        </div>
      </div>
      <div className="layer-grid" role="group" aria-label="Seleccionar modo de visualización del mapa">
        {modes.map((mode) => (
          <button
            className={`layer-button ${filters.viewMode === mode.id ? 'is-active' : ''}`}
            key={mode.id}
            type="button"
            title={mode.help}
            aria-pressed={filters.viewMode === mode.id}
            onClick={() => onChange({ viewMode: mode.id })}
          >
            <span>{mode.label}</span>
            <small>{mode.help}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
