# Mapa 2 — Roadmap posterior a V10.4

## Roadmap vigente

```text
V10.3 — Estabilización, contratos de datos y anti-regresión. Aprobada.
V10.4 — Decisión de arquitectura de carga de datos y backend.
V11   — Implementación de arquitectura elegida para datos/backend si se justifica.
V12   — Refactor y mejora profesional del frontend.
V13   — Analytics comercial avanzado y storytelling.
V14   — Producto final, documentación pública y mantenimiento.
```

## V11 recomendada

Implementar primero la arquitectura elegida sin backend completo:

1. manifest extendido de datasets;
2. particionado comercial por provincia/período/producto/categoría;
3. índices territoriales y comerciales;
4. checks anti-regresión de carga inicial/lazy;
5. prefetch controlado;
6. estrategia opcional R2 solo si se justifica por tamaño o deploy.

## Backend

No se implementa automáticamente. Debe existir autorización explícita y evidencia técnica.

## Criterios para autorizar backend

- datos vivos con actualización frecuente;
- edición de clientes o datasets;
- usuarios/permisos;
- queries geoespaciales dinámicas;
- necesidad de secretos;
- análisis espacial no precalculable;
- datasets demasiado pesados para Pages estático.

## V12 recomendada

Una vez estabilizada la arquitectura de datos, refactor frontend profesional:

- separación de contenedores/presentacionales;
- estado de filtros más explícito;
- navegación ejecutiva;
- paneles analíticos;
- estados de carga/error por capa;
- consistencia entre mapa, KPIs y filtros.

## V13 recomendada

Analytics comercial avanzado:

- ranking clientes/productos/provincias;
- crecimiento mensual/anual;
- ventas por habitante;
- clientes por población;
- oportunidades territoriales;
- storytelling ejecutivo.

## V14 recomendada

Cierre de producto:

- documentación pública;
- runbook de mantenimiento;
- landing/demo;
- guía de fuentes;
- límites conocidos;
- roadmap público.
