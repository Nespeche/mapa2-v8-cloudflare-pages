BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS fuente_catalogo (
    id_fuente TEXT PRIMARY KEY,
    nombre_fuente TEXT NOT NULL,
    organismo TEXT,
    url_origen TEXT,
    tipo_fuente TEXT NOT NULL CHECK (tipo_fuente IN ('oficial','provincial','municipal','no_oficial','estimada','procesada')),
    licencia TEXT,
    fecha_publicacion DATE,
    fecha_actualizacion DATE,
    fecha_extraccion TIMESTAMPTZ DEFAULT now(),
    observaciones TEXT
);

CREATE TABLE IF NOT EXISTS geo_entidad (
    id_entidad TEXT PRIMARY KEY,
    tipo_entidad TEXT NOT NULL CHECK (tipo_entidad IN (
        'pais','provincia','departamento','partido','comuna_caba','departamento_partido_comuna',
        'municipio','gobierno_local','localidad','localidad_censal','asentamiento',
        'fraccion_censal','radio_censal','aglomerado','barrio','barrio_popular'
    )),
    codigo_indec TEXT,
    codigo_georef TEXT,
    codigo_refeglo TEXT,
    codigo_bahra TEXT,
    codigo_osm TEXT,
    nombre TEXT NOT NULL,
    nombre_normalizado TEXT,
    provincia_id TEXT,
    departamento_id TEXT,
    municipio_id TEXT,
    gobierno_local_id TEXT,
    localidad_id TEXT,
    fuente_geografica TEXT REFERENCES fuente_catalogo(id_fuente),
    clasificacion_fuente TEXT NOT NULL CHECK (clasificacion_fuente IN ('oficial_directa','oficial_procesada','oficial_parcial','no_oficial','estimada')),
    metodo_geometria TEXT NOT NULL DEFAULT 'descarga_directa',
    nivel_confianza TEXT NOT NULL CHECK (nivel_confianza IN ('alta','media','baja')),
    anio_fuente INTEGER,
    geom geometry(GEOMETRY,4326),
    centroide geometry(POINT,4326),
    atributos JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geo_entidad_tipo ON geo_entidad(tipo_entidad);
CREATE INDEX IF NOT EXISTS idx_geo_entidad_codigo_indec ON geo_entidad(codigo_indec);
CREATE INDEX IF NOT EXISTS idx_geo_entidad_codigo_georef ON geo_entidad(codigo_georef);
CREATE INDEX IF NOT EXISTS idx_geo_entidad_nombre_norm ON geo_entidad(nombre_normalizado);
CREATE INDEX IF NOT EXISTS idx_geo_entidad_geom ON geo_entidad USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_geo_entidad_centroide ON geo_entidad USING GIST(centroide);

CREATE TABLE IF NOT EXISTS geo_relacion (
    id_relacion BIGSERIAL PRIMARY KEY,
    id_origen TEXT NOT NULL REFERENCES geo_entidad(id_entidad) ON DELETE CASCADE,
    id_destino TEXT NOT NULL REFERENCES geo_entidad(id_entidad) ON DELETE CASCADE,
    tipo_relacion TEXT NOT NULL CHECK (tipo_relacion IN ('contiene','pertenece_a','intersecta','administra','estimado_por_overlay','equivalente_a')),
    porcentaje_area NUMERIC,
    porcentaje_poblacion NUMERIC,
    metodo TEXT NOT NULL,
    fuente TEXT REFERENCES fuente_catalogo(id_fuente),
    atributos JSONB DEFAULT '{}'::jsonb,
    UNIQUE(id_origen, id_destino, tipo_relacion, metodo)
);

CREATE INDEX IF NOT EXISTS idx_geo_relacion_origen ON geo_relacion(id_origen);
CREATE INDEX IF NOT EXISTS idx_geo_relacion_destino ON geo_relacion(id_destino);

CREATE TABLE IF NOT EXISTS censo_poblacion (
    id_poblacion BIGSERIAL PRIMARY KEY,
    id_entidad TEXT NOT NULL REFERENCES geo_entidad(id_entidad) ON DELETE CASCADE,
    anio_censo INTEGER NOT NULL,
    poblacion_total BIGINT,
    poblacion_varones BIGINT,
    poblacion_mujeres BIGINT,
    poblacion_x BIGINT,
    poblacion_viviendas_particulares BIGINT,
    poblacion_viviendas_colectivas BIGINT,
    poblacion_situacion_calle BIGINT,
    viviendas_total BIGINT,
    viviendas_particulares BIGINT,
    viviendas_colectivas BIGINT,
    hogares BIGINT,
    superficie_km2 NUMERIC,
    densidad_hab_km2 NUMERIC,
    fuente_censo TEXT REFERENCES fuente_catalogo(id_fuente),
    clasificacion_fuente TEXT NOT NULL CHECK (clasificacion_fuente IN ('oficial_directa','oficial_procesada','oficial_parcial','no_oficial','estimada')),
    metodo_dato TEXT NOT NULL,
    nivel_confianza TEXT NOT NULL CHECK (nivel_confianza IN ('alta','media','baja')),
    fecha_extraccion TIMESTAMPTZ DEFAULT now(),
    observaciones TEXT,
    UNIQUE(id_entidad, anio_censo, fuente_censo, metodo_dato)
);

CREATE INDEX IF NOT EXISTS idx_censo_poblacion_entidad ON censo_poblacion(id_entidad);
CREATE INDEX IF NOT EXISTS idx_censo_poblacion_anio ON censo_poblacion(anio_censo);

CREATE TABLE IF NOT EXISTS staging_match_log (
    id BIGSERIAL PRIMARY KEY,
    entidad_tipo TEXT,
    fuente TEXT,
    codigo_fuente TEXT,
    nombre_fuente TEXT,
    id_entidad_match TEXT,
    score NUMERIC,
    metodo_match TEXT,
    estado TEXT CHECK (estado IN ('match_codigo','match_nombre','sin_match','duplicado','manual')),
    detalle TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMIT;
