# Priorización de salida: PostGIS, GeoPackage o ambos

La priorización no cambia la fuente de los datos. Cambia **cómo queda empaquetada la base final** y, por lo tanto, cómo se va a consultar, actualizar y servir en un mapa.

## Opción A: PostGIS puro

Recomendado para producción, aplicaciones web y mapas interactivos con muchos filtros.

Ventajas:

- Permite consultas espaciales rápidas: `ST_Intersects`, `ST_Contains`, `ST_DWithin`, `ST_AsGeoJSON`.
- Maneja relaciones complejas muchos-a-muchos entre departamentos, gobiernos locales, localidades, barrios y radios censales.
- Permite actualizar fuentes sin reconstruir todo el archivo final.
- Es lo más adecuado para una API o backend Node/Express/Nest, Python/FastAPI o similar.
- Permite índices espaciales GiST para polígonos pesados.

Desventajas:

- Requiere instalar PostgreSQL + PostGIS.
- Es menos cómodo para compartir como archivo único.
- Requiere más configuración inicial.

Usar PostGIS si el objetivo es una app web final con mapa, filtros, capas, búsquedas y datos censales.

## Opción B: GeoPackage puro

Recomendado para QGIS, análisis local, compartir un archivo y validar visualmente capas.

Ventajas:

- Es un archivo único `.gpkg`.
- Se abre directo en QGIS.
- Soporta múltiples capas vectoriales y tablas relacionales.
- Es ideal para revisión, QA, edición manual y distribución.

Desventajas:

- No es tan práctico como base de producción concurrente.
- Las consultas espaciales complejas y actualizaciones masivas son menos cómodas.
- Para una web, normalmente hay que convertirlo a tiles, GeoJSON filtrado o cargarlo a PostGIS.

Usar GeoPackage si el objetivo principal es revisar, corregir, validar o compartir la base.

## Opción C: Ambos

Recomendado para este proyecto.

Flujo sugerido:

1. GeoPackage como artefacto de control y revisión en QGIS.
2. PostGIS como base productiva para la aplicación web y el mapa.
3. Exportaciones livianas desde PostGIS para frontend: GeoJSON, PMTiles, MBTiles o vector tiles.

Esta opción evita quedar atado a una sola herramienta: QGIS para auditar y PostGIS para servir.
