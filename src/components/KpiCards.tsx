import type { SalesMetrics } from '../types/business';
import { formatCompactCurrency, formatCurrency, formatNumber } from '../utils/formatters';

export function KpiCards({ metrics }: { metrics: SalesMetrics }) {
  const cards = [
    { label: 'Clientes visibles', value: formatNumber(metrics.clientesVisibles), hint: `${formatNumber(metrics.registros)} registros` },
    { label: 'Venta neta total', value: formatCompactCurrency(metrics.ventaNeta), hint: formatCurrency(metrics.ventaNeta) },
    { label: 'Unidades vendidas', value: formatNumber(metrics.unidades), hint: 'unidades sintéticas' },
    { label: 'Margen bruto estimado', value: formatCompactCurrency(metrics.margenBruto), hint: 'estimación V6' },
    { label: 'Volumen kg', value: formatNumber(metrics.volumenKg, 1), hint: 'volumen físico' },
    { label: 'Ticket promedio aprox.', value: formatCompactCurrency(metrics.ticketPromedio), hint: 'venta / clientes visibles' },
    { label: 'Provincia líder', value: metrics.provinciaLider, hint: 'por venta neta' },
    { label: 'Producto/categoría líder', value: metrics.productoLider || metrics.categoriaLider, hint: metrics.categoriaLider || 'por venta neta' },
  ];

  return (
    <section className="kpi-grid" aria-label="Indicadores principales">
      {cards.map((card) => (
        <article className="kpi-card" key={card.label}>
          <span>{card.label}</span>
          <strong title={card.value}>{card.value}</strong>
          <small>{card.hint}</small>
        </article>
      ))}
    </section>
  );
}
