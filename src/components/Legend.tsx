import type { ViewMode } from '../types/business';
import { formatCompactCurrency } from '../utils/formatters';

export function Legend({ mode, maxValue, selectedProvince }: { mode: ViewMode; maxValue: number; selectedProvince: string }) {
  const isChoropleth = mode === 'choropleth-provincia' || mode === 'choropleth-departamento';
  return (
    <section className="legend-card" aria-label="Leyenda dinámica">
      <div className="legend-title">
        <strong>Leyenda</strong>
        <span>{selectedProvince || 'Argentina'}</span>
      </div>
      {isChoropleth ? (
        <>
          <div className="legend-ramp" />
          <div className="legend-scale">
            <span>$0</span>
            <span>{formatCompactCurrency(maxValue)}</span>
          </div>
          <small>Intensidad por venta neta sintética agregada.</small>
        </>
      ) : mode === 'heatmap' ? (
        <small>Áreas cálidas representan concentración de clientes y/o venta estimada.</small>
      ) : mode === 'clusters' ? (
        <small>Los círculos agrupan clientes sintéticos cercanos según zoom.</small>
      ) : mode === 'clientes' ? (
        <small>Cada punto representa un cliente ficticio de autopartes.</small>
      ) : mode === 'localidades' ? (
        <small>Puntos de localidades V5.1 cargados bajo demanda por provincia.</small>
      ) : (
        <small>Vista base territorial censal V5.1.</small>
      )}
    </section>
  );
}
