# Mapa 2 — Matriz de decisión backend/datos V10.4

**Base:** V10.3 aprobada  
**Fase:** V10.4 — decisión, no implementación de backend

Escala: 1 = desfavorable / alto riesgo, 5 = favorable / bajo riesgo para el estado actual de Mapa 2.

| Criterio | A. Pages estático optimizado | B. Pages + particionado estático | C. Pages + R2 | D. Pages Functions / Workers | E. D1 | F. Railway/Postgres/PostGIS |
|---|---:|---:|---:|---:|---:|---:|
| Performance carga inicial | 4 | 5 | 4 | 4 | 3 | 3 |
| Velocidad de filtros | 3 | 5 | 4 | 4 | 3 | 5 |
| Peso del deploy | 3 | 4 | 5 | 4 | 4 | 5 |
| Complejidad técnica | 5 | 4 | 3 | 3 | 3 | 2 |
| Costo | 5 | 5 | 4 | 4 | 4 | 2 |
| Mantenibilidad | 4 | 5 | 4 | 3 | 3 | 3 |
| Riesgo de regresión | 5 | 4 | 3 | 3 | 3 | 2 |
| Facilidad de deploy | 5 | 5 | 4 | 3 | 3 | 2 |
| Compatibilidad Cloudflare Free | 5 | 5 | 4 | 4 | 4 | 1 |
| Escalabilidad datos | 3 | 4 | 5 | 4 | 3 | 5 |
| Filtros avanzados | 3 | 4 | 4 | 4 | 3 | 5 |
| Visuales futuros | 3 | 5 | 5 | 4 | 3 | 5 |
| Soporte backend | 1 | 1 | 2 | 5 | 4 | 5 |
| Impacto UX | 4 | 5 | 4 | 4 | 3 | 4 |
| Impacto censal | 5 | 5 | 4 | 3 | 3 | 3 |
| Impacto comercial | 4 | 5 | 4 | 4 | 3 | 5 |
| Trazabilidad | 4 | 5 | 5 | 4 | 4 | 4 |
| Reproducibilidad | 5 | 5 | 4 | 3 | 3 | 3 |
| Seguridad | 5 | 5 | 4 | 3 | 3 | 3 |
| Necesidad de secretos | 5 | 5 | 4 | 2 | 2 | 1 |
| Rollback | 5 | 5 | 4 | 3 | 3 | 2 |
| Dependencia externa | 5 | 5 | 4 | 3 | 3 | 1 |

## Recomendación

1. **Principal:** Opción B — Cloudflare Pages + datos estáticos mejor particionados.
2. **Plan B:** Opción C — Cloudflare Pages + R2 para datasets pesados o versionados fuera del build.
3. **Condicional:** Opción D — Workers/Pages Functions solo para endpoints livianos concretos.
4. **Limitada:** Opción E — D1 solo para metadata, catálogos e índices livianos.
5. **No recomendada por ahora:** Opción F — Railway/Postgres/PostGIS, salvo necesidad real de consultas geoespaciales dinámicas o persistencia transaccional.

## Pros y contras por opción

### A — Cloudflare Pages estático optimizado

**Pros:** máxima simplicidad, menor costo, sin secretos, deploy conocido, rollback simple.  
**Contras:** si crecen los datasets, el build puede volverse pesado; los filtros complejos requieren precálculo.

### B — Cloudflare Pages + particionado estático

**Pros:** mejora fuerte en velocidad de filtros, reduce carga inicial, mantiene simplicidad y Cloudflare Free.  
**Contras:** requiere diseñar manifests, índices y contratos de chunks; aumenta cantidad de archivos.

### C — Cloudflare Pages + R2

**Pros:** separa app y datos, mejora estrategia de rollback de datasets, prepara crecimiento.  
**Contras:** agrega gestión de bucket, CORS, cache, versionado y publicación de objetos.

### D — Pages Functions / Workers

**Pros:** habilita endpoints livianos, healthchecks, proxy a R2, cache server-side.  
**Contras:** aumenta complejidad, requiere runtime Cloudflare y potencial configuración adicional.

### E — D1

**Pros:** útil para metadata liviana y catálogos.  
**Contras:** no reemplaza PostGIS ni conviene para geometrías pesadas.

### F — Railway/Postgres/PostGIS

**Pros:** excelente para GIS dinámico, queries espaciales, usuarios, edición y datos vivos.  
**Contras:** costo, secretos, mantenimiento, complejidad, riesgo de regresión y dependencia externa.

## Criterio final

Mapa 2 todavía puede resolver sus próximos objetivos con datos estáticos precalculados, particionados y cacheados. No hay evidencia suficiente para migrar a Railway/PostGIS ni implementar backend completo en V10.4.
