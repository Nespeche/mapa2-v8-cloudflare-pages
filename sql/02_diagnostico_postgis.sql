-- Diagnósticos de cobertura, alineación y geometrías para PostGIS.
-- Ejecutar después de cargar sql/00_schema_postgis.sql, sql/01_views.sql y los datos.

CREATE OR REPLACE VIEW vw_diagnostico_cobertura AS
WITH pop AS (
  SELECT id_entidad,
         max(CASE WHEN anio_censo = 2022 THEN 1 ELSE 0 END) AS con_poblacion_2022,
         max(CASE WHEN anio_censo = 2022 AND clasificacion_fuente = 'oficial_directa' THEN 1 ELSE 0 END) AS poblacion_oficial_directa,
         max(CASE WHEN anio_censo = 2022 AND clasificacion_fuente = 'oficial_procesada' THEN 1 ELSE 0 END) AS poblacion_oficial_procesada,
         max(CASE WHEN anio_censo = 2022 AND clasificacion_fuente = 'estimada' THEN 1 ELSE 0 END) AS poblacion_estimada
  FROM censo_poblacion
  GROUP BY id_entidad
), rel AS (
  SELECT r.id_origen AS id_entidad,
         count(*) AS relaciones_padre,
         sum(CASE WHEN d.id_entidad IS NULL THEN 1 ELSE 0 END) AS relaciones_huerfanas
  FROM geo_relacion r
  LEFT JOIN geo_entidad d ON d.id_entidad = r.id_destino
  WHERE r.tipo_relacion = 'pertenece_a'
  GROUP BY r.id_origen
)
SELECT
  g.tipo_entidad,
  count(*) AS entidades,
  sum(CASE WHEN g.codigo_indec IS NOT NULL THEN 1 ELSE 0 END) AS con_codigo_indec,
  sum(CASE WHEN g.codigo_georef IS NOT NULL THEN 1 ELSE 0 END) AS con_codigo_georef,
  sum(CASE WHEN g.codigo_refeglo IS NOT NULL THEN 1 ELSE 0 END) AS con_codigo_refeglo,
  sum(CASE WHEN g.geom IS NOT NULL THEN 1 ELSE 0 END) AS con_geometria,
  sum(CASE WHEN g.centroide IS NOT NULL THEN 1 ELSE 0 END) AS con_centroide,
  sum(coalesce(pop.con_poblacion_2022,0)) AS con_poblacion_2022,
  sum(coalesce(pop.poblacion_oficial_directa,0)) AS poblacion_oficial_directa,
  sum(coalesce(pop.poblacion_oficial_procesada,0)) AS poblacion_oficial_procesada,
  sum(coalesce(pop.poblacion_estimada,0)) AS poblacion_estimada,
  sum(coalesce(rel.relaciones_padre,0)) AS relaciones_padre,
  sum(coalesce(rel.relaciones_huerfanas,0)) AS relaciones_huerfanas
FROM geo_entidad g
LEFT JOIN pop ON pop.id_entidad = g.id_entidad
LEFT JOIN rel ON rel.id_entidad = g.id_entidad
GROUP BY g.tipo_entidad
ORDER BY g.tipo_entidad;

CREATE OR REPLACE VIEW vw_faltantes_poblacion_2022 AS
SELECT g.id_entidad, g.tipo_entidad, g.codigo_indec, g.codigo_georef, g.codigo_refeglo, g.nombre, g.provincia_id
FROM geo_entidad g
LEFT JOIN censo_poblacion p ON p.id_entidad = g.id_entidad AND p.anio_censo = 2022
WHERE p.id_entidad IS NULL
ORDER BY g.tipo_entidad, g.nombre;

CREATE OR REPLACE VIEW vw_relaciones_huerfanas AS
SELECT r.*
FROM geo_relacion r
LEFT JOIN geo_entidad o ON o.id_entidad = r.id_origen
LEFT JOIN geo_entidad d ON d.id_entidad = r.id_destino
WHERE o.id_entidad IS NULL OR d.id_entidad IS NULL;

CREATE OR REPLACE VIEW vw_geometrias_invalidas AS
SELECT id_entidad, tipo_entidad, nombre, ST_IsValidReason(geom) AS motivo
FROM geo_entidad
WHERE geom IS NOT NULL AND NOT ST_IsValid(geom);

CREATE OR REPLACE VIEW vw_entidades_mapa AS
SELECT
  g.id_entidad,
  g.tipo_entidad,
  g.codigo_indec,
  g.codigo_georef,
  g.codigo_refeglo,
  g.nombre,
  g.nombre_normalizado,
  g.provincia_id,
  g.departamento_id,
  g.municipio_id,
  g.gobierno_local_id,
  g.localidad_id,
  p.anio_censo,
  p.poblacion_total,
  p.viviendas_total,
  p.fuente_censo,
  p.clasificacion_fuente AS clasificacion_censo,
  p.metodo_dato,
  g.clasificacion_fuente AS clasificacion_geografica,
  g.nivel_confianza,
  g.geom,
  g.centroide
FROM geo_entidad g
LEFT JOIN censo_poblacion p ON p.id_entidad = g.id_entidad AND p.anio_censo = 2022;
