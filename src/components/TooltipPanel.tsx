import { formatCompactCurrency, formatNumber } from '../utils/formatters';

export interface TooltipInfo {
  title: string;
  subtitle?: string;
  rows: Array<{ label: string; value: string | number }>;
}

export function TooltipPanel({ info }: { info: TooltipInfo | null }) {
  if (!info) {
    return (
      <aside className="detail-panel detail-panel--empty" aria-label="Detalle contextual vacío">
        <span>Detalle contextual</span>
        <strong>Explorá el mapa</strong>
        <p>Pasá el cursor por una provincia, departamento o cliente para ver información contextual. Hacé click para fijar filtros o abrir ficha.</p>
      </aside>
    );
  }

  return (
    <aside className="detail-panel" aria-label="Detalle contextual seleccionado">
      <span>{info.subtitle || 'Detalle'}</span>
      <strong>{info.title}</strong>
      <dl>
        {info.rows.map((row) => (
          <div key={`${row.label}-${row.value}`}>
            <dt>{row.label}</dt>
            <dd>{typeof row.value === 'number' ? formatNumber(row.value) : row.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

export function formatTooltipMoney(value: unknown): string {
  return formatCompactCurrency(Number(value ?? 0));
}
