import type { SalesMetrics } from '../types/business';
import { formatCompactCurrency, formatCurrency, formatNumber } from '../utils/formatters';

function sourceLabel(source: SalesMetrics['fuente']): string {
  if (source === 'detalle-csv') return 'Detalle CSV bajo demanda';
  if (source === 'cliente-agregado') return 'Agregado cliente V10';
  if (source === 'departamento-agregado') return 'Agregado territorial V10';
  return 'Agregados iniciales';
}

export function KpiCards({ metrics }: { metrics: SalesMetrics }) {
  const cards = [
    { label: 'Clientes visibles', value: formatNumber(metrics.clientesVisibles), hint: `${formatNumber(metrics.registros)} registros`, tone: 'default' },
    { label: 'Venta neta total', value: formatCompactCurrency(metrics.ventaNeta), hint: formatCurrency(metrics.ventaNeta), tone: 'hero' },
    { label: 'Unidades vendidas', value: formatNumber(metrics.unidades), hint: 'unidades sintéticas', tone: 'default' },
    { label: 'Margen bruto estimado', value: formatCompactCurrency(metrics.margenBruto), hint: 'estimación V6', tone: 'default' },
    { label: 'Volumen kg', value: formatNumber(metrics.volumenKg, 1), hint: 'volumen físico', tone: 'default' },
    { label: 'Ticket promedio aprox.', value: formatCompactCurrency(metrics.ticketPromedio), hint: 'venta / clientes visibles', tone: 'default' },
    { label: 'Provincia líder', value: metrics.provinciaLider, hint: 'por venta neta', tone: 'default' },
    { label: 'Producto/categoría líder', value: metrics.productoLider || metrics.categoriaLider, hint: metrics.categoriaLider || 'por venta neta', tone: 'default' },
  ];

  return (
    <section className="kpi-grid" aria-label="Indicadores principales">
      {cards.map((card) => (
        <article className={`kpi-card ${card.tone === 'hero' ? 'kpi-card--hero' : ''}`} key={card.label}>
          <span>{card.label}</span>
          <strong title={card.value}>{card.value}</strong>
          <small>{card.hint}</small>
        </article>
      ))}
      <div className="kpi-source" aria-label="Fuente de cálculo de indicadores">
        <span>{sourceLabel(metrics.fuente)}</span>
      </div>
    </section>
  );
}
