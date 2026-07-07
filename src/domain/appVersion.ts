export const APP_VERSION = 'V10.3' as const;
export const APP_VERSION_NAME = 'V10.3 — Estabilización, contratos de datos y anti-regresión' as const;
export const APP_VERSION_SOURCE = 'V10.2 — Client Count Tooltip Fix' as const;

export const APP_PHASE_ORDER = [
  'V10.3 — Estabilización, contratos de datos y anti-regresión',
  'V10.4 — Decisión de arquitectura de carga de datos y backend',
  'V11 — Implementación de carga de datos/backend si se justifica',
  'V12 — Refactor y mejora profesional del frontend',
  'V13 — Analytics comercial avanzado y storytelling',
  'V14 — Producto final, documentación pública y mantenimiento',
] as const;

export const RELEASE_GUARDS = {
  preserveCensusV51: true,
  preserveSyntheticBusinessV6: true,
  preserveCloudflareV8: true,
  preserveUiUxV9: true,
  preserveProgressiveLoadingV10: true,
  noBackendInThisPhase: true,
  noDataRegenerationInThisPhase: true,
} as const;
