CREATE OR REPLACE VIEW vw_mapa_entidades AS
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
    g.clasificacion_fuente AS clasificacion_geografica,
    g.metodo_geometria,
    g.nivel_confianza AS confianza_geografica,
    p.anio_censo,
    p.poblacion_total,
    p.viviendas_total,
    p.densidad_hab_km2,
    p.clasificacion_fuente AS clasificacion_censo,
    p.metodo_dato AS metodo_censo,
    p.nivel_confianza AS confianza_censo,
    g.fuente_geografica,
    p.fuente_censo,
    g.geom,
    COALESCE(g.centroide, ST_PointOnSurface(g.geom)) AS centroide
FROM geo_entidad g
LEFT JOIN LATERAL (
    SELECT *
    FROM censo_poblacion p2
    WHERE p2.id_entidad = g.id_entidad
    ORDER BY p2.anio_censo DESC,
             CASE p2.clasificacion_fuente
                WHEN 'oficial_directa' THEN 1
                WHEN 'oficial_procesada' THEN 2
                WHEN 'oficial_parcial' THEN 3
                WHEN 'estimada' THEN 4
                ELSE 5
             END
    LIMIT 1
) p ON true;

CREATE OR REPLACE VIEW vw_mapa_entidades_geojson AS
SELECT
    id_entidad,
    tipo_entidad,
    codigo_indec,
    codigo_georef,
    codigo_refeglo,
    nombre,
    provincia_id,
    departamento_id,
    municipio_id,
    gobierno_local_id,
    localidad_id,
    anio_censo,
    poblacion_total,
    viviendas_total,
    clasificacion_geografica,
    clasificacion_censo,
    metodo_censo,
    confianza_censo,
    ST_AsGeoJSON(geom)::json AS geometry
FROM vw_mapa_entidades
WHERE geom IS NOT NULL;

CREATE OR REPLACE VIEW vw_control_cobertura AS
SELECT
    g.tipo_entidad,
    COUNT(*) AS entidades,
    COUNT(*) FILTER (WHERE g.geom IS NOT NULL) AS con_geom,
    COUNT(*) FILTER (WHERE p.id_poblacion IS NOT NULL) AS con_poblacion,
    COUNT(*) FILTER (WHERE p.clasificacion_fuente = 'oficial_directa') AS poblacion_oficial_directa,
    COUNT(*) FILTER (WHERE p.clasificacion_fuente = 'estimada') AS poblacion_estimada
FROM geo_entidad g
LEFT JOIN censo_poblacion p ON p.id_entidad = g.id_entidad AND p.anio_censo = 2022
GROUP BY g.tipo_entidad
ORDER BY g.tipo_entidad;
