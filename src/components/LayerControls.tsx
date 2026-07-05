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
    <section className="control-section">
      <div className="section-title">
        <span>Capas</span>
        <small>Modo de visualización</small>
      </div>
      <div className="layer-grid">
        {modes.map((mode) => (
          <button
            className={`layer-button ${filters.viewMode === mode.id ? 'is-active' : ''}`}
            key={mode.id}
            type="button"
            title={mode.help}
            onClick={() => onChange({ viewMode: mode.id })}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </section>
  );
}
