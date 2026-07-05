export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits }).format(value || 0);
}

export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value || 0);
  if (abs >= 1_000_000_000) return `${formatNumber(value / 1_000_000_000, 1)} B ARS`;
  if (abs >= 1_000_000) return `${formatNumber(value / 1_000_000, 1)} M ARS`;
  return formatCurrency(value);
}

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function periodLabel(from: string, to: string): string {
  if (from && to) return `${from} a ${to}`;
  if (from) return `desde ${from}`;
  if (to) return `hasta ${to}`;
  return 'todo el período';
}
