# Mapa 2 — Architecture Decision Record V10.4

**Fase:** V10.4 — Decisión de arquitectura de carga de datos y backend  
**Base aprobada:** V10.3 — Estabilización, contratos de datos y anti-regresión  
**Fecha:** 2026-07-07  
**Estado:** Aprobación técnica local pendiente de validación visual del usuario en navegador y Cloudflare  
**Decisión:** mantener Mapa 2 como app estática optimizada en Cloudflare Pages, evolucionando hacia particionado de datos estáticos. Preparar R2 como plan B para datasets pesados futuros. No implementar backend en V10.4.

---

## 1. Contexto

Mapa 2 ya funciona como aplicación React/Vite/TypeScript con MapLibre, datos públicos en `public/data`, carga bajo demanda, contratos de datos V10.3 y checks anti-regresión. La validación de V10.3 confirmó:

- 2.000 clientes sintéticos V6.
- 268 departamentos/partidos con clientes.
- Caso Bolívar con 7 clientes.
- Build Vite correcto.
- `dist` desplegable en Cloudflare Pages Free.
- Sin errores bloqueantes de Cloudflare.
- Carga bajo demanda preservada para clientes, ventas detalladas y capas provinciales.

La fase V10.4 no implementa backend. Define la arquitectura recomendada para evitar complejidad prematura y preparar las próximas fases.

---

## 2. Problema a resolver

El proyecto necesita decidir cómo evolucionar antes de:

1. incorporar backend;
2. mover datos fuera del build;
3. refactorizar frontend profesionalmente;
4. mejorar filtros cruzados, visuales y velocidad percibida;
5. preparar datasets comerciales o censales más grandes.

El riesgo principal es sobredimensionar la arquitectura con Railway/PostGIS o Workers antes de agotar mejoras estáticas más simples, baratas, reproducibles y compatibles con Cloudflare Pages Free.

---

## 3. Decisión principal

### Arquitectura recomendada principal

**Cloudflare Pages + datos estáticos mejor particionados + contratos de carga.**

Mantener el frontend estático y evolucionar la capa de datos mediante:

- manifiesto de datasets versionado;
- particionado por provincia, capa, período, producto/categoría y tipo de agregación;
- agregados comerciales precalculados;
- carga bajo demanda estricta;
- cache HTTP mediante `_headers`;
- scripts anti-regresión sobre contratos de datos;
- auditorías de assets, dependencias y estrategia de carga.

Esta opción evita backend innecesario, preserva Cloudflare Pages Free y permite mejorar filtros/velocidad sin introducir secretos ni servicios pagos.

---

## 4. Plan B

### Arquitectura secundaria

**Cloudflare Pages + Cloudflare R2 para datasets pesados o futuros.**

R2 debe incorporarse si aparece al menos una condición:

- assets de datos cercanos o superiores al límite operativo definido;
- crecimiento fuerte de GeoJSON/CSV;
- necesidad de versionar datasets separados del deploy frontend;
- necesidad de rollback de datos independiente del rollback de UI;
- deploys lentos por peso de datasets;
- publicación de múltiples versiones de datos.

R2 puede usarse con URLs públicas cacheadas y un manifest remoto. No requiere backend al inicio si los objetos son públicos y se resuelve CORS/cache correctamente.

---

## 5. Backend no recomendado por ahora

### Pages Functions / Workers

No se implementan en V10.4. Solo convienen si se necesita:

- endpoint de metadata o healthcheck;
- proxy controlado a R2;
- firma/control de acceso a datasets;
- cache server-side de agregados;
- logs livianos;
- validaciones server-side;
- configuración remota.

### D1

No se recomienda como base geoespacial. Puede servir más adelante para:

- metadata relacional;
- catálogos livianos;
- preferencias;
- versiones de datasets;
- auditoría;
- configuración.

### Railway/Postgres/PostGIS

No se recomienda ahora. Solo corresponde si el producto requiere:

- consultas geoespaciales dinámicas;
- intersecciones server-side;
- edición o carga frecuente de datos;
- usuarios y panel administrativo;
- datasets vivos;
- persistencia transaccional;
- análisis espacial dinámico no precalculable.

---

## 6. Criterios para reabrir la decisión

Reabrir V10.4 si ocurre cualquiera de estos eventos:

- `dist` supera límites operativos de Cloudflare Pages o se vuelve lento de publicar.
- El mayor asset supera el límite admitido por el pipeline.
- Los filtros requieren resolver combinaciones de alta cardinalidad en tiempo real.
- Aparecen datos reales vivos con actualización frecuente.
- Se requiere edición de clientes, usuarios, permisos o panel admin.
- Los datos comerciales dejan de ser sintéticos y requieren seguridad/secretos.
- Se necesita PostGIS para operaciones espaciales server-side no precalculables.

---

## 7. Impacto esperado sobre filtros, visuales y navegación

La arquitectura recomendada permitirá mejorar sin backend inmediato:

- filtros por provincia y localidad/departamento mediante índices y particiones territoriales;
- filtros por producto/categoría/período mediante agregados precalculados;
- filtros cruzados mediante manifests y chunks específicos;
- KPIs consistentes porque todos los paneles leen del mismo contrato de agregación;
- clusters/heatmap porque clientes siguen bajo demanda y enriquecidos solo cuando corresponde;
- coroplético por provincia/departamento con agregados territoriales dedicados;
- detalle comercial bajo demanda sin cargar el CSV al inicio;
- velocidad percibida por reducción de carga inicial y prefetch controlado;
- navegabilidad al reducir esperas invisibles y estados de carga persistentes;
- futuras vistas ejecutivas con datasets analíticos ya modelados.

---

## 8. Decisión sobre Python / ETL

En V10.3, Cloudflare Pages detectaba `requirements.txt` en raíz e intentaba ejecutar `pip install -r requirements.txt` durante el build frontend. V10.4 mueve esas dependencias a:

```text
tools/python/requirements.txt
```

Se agrega el target:

```bash
make python-install
```

Esto preserva el flujo local de ETL/datos y evita que Cloudflare instale Python cuando solo necesita Node/Vite.

---

## 9. Referencias operativas

- Cloudflare Pages: build command `npm run build`, output directory `dist`.
- Vite: `vite build` genera assets estáticos desde `index.html`.
- Cloudflare Pages Free: revisar límites vigentes antes de cada deploy.
- Cloudflare R2: considerar solo si ayuda a separar datasets pesados del deploy de Pages.

---

## 10. Conclusión técnica

**Conviene avanzar a la siguiente fase solo después de validar V10.4 en local y Cloudflare.**

La siguiente fase recomendada es **V11 — Implementación de arquitectura elegida para datos/backend si se justifica**, priorizando particionado estático y contratos de carga. Backend real requiere autorización explícita posterior.
