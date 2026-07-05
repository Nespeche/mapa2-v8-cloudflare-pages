from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from utils import normalize_code, normalize_text, sqlite_connect

PROVINCE_CODES = {
    '02': 'Ciudad Autónoma de Buenos Aires',
    '06': 'Buenos Aires',
    '10': 'Catamarca',
    '14': 'Córdoba',
    '18': 'Corrientes',
    '22': 'Chaco',
    '26': 'Chubut',
    '30': 'Entre Ríos',
    '34': 'Formosa',
    '38': 'Jujuy',
    '42': 'La Pampa',
    '46': 'La Rioja',
    '50': 'Mendoza',
    '54': 'Misiones',
    '58': 'Neuquén',
    '62': 'Río Negro',
    '66': 'Salta',
    '70': 'San Juan',
    '74': 'San Luis',
    '78': 'Santa Cruz',
    '82': 'Santa Fe',
    '86': 'Santiago del Estero',
    '90': 'Tucumán',
    '94': 'Tierra del Fuego, Antártida e Islas del Atlántico Sur',
}

EXPECTED_MIN = {
    'pais': 1,
    'provincia': 24,
    # Estos mínimos son controles orientativos. Los conteos reales pueden cambiar con actualizaciones oficiales.
    'departamento_partido_comuna': 0,
    'departamento': 0,
    'partido': 0,
    'comuna_caba': 0,
    'municipio': 0,
    'gobierno_local': 0,
    'localidad': 0,
    'localidad_censal': 0,
    'asentamiento': 0,
    'fraccion_censal': 0,
    'radio_censal': 0,
    'barrio': 0,
    'barrio_popular': 0,
}

PARENT_COLS = ['provincia_id', 'departamento_id', 'municipio_id', 'gobierno_local_id', 'localidad_id']


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_diag_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        '''
        CREATE TABLE IF NOT EXISTS geo_relacion (
            id_relacion INTEGER PRIMARY KEY AUTOINCREMENT,
            id_origen TEXT NOT NULL,
            id_destino TEXT NOT NULL,
            tipo_relacion TEXT NOT NULL,
            porcentaje_area REAL,
            porcentaje_poblacion REAL,
            metodo TEXT NOT NULL,
            fuente TEXT,
            atributos_json TEXT DEFAULT '{}',
            UNIQUE(id_origen, id_destino, tipo_relacion, metodo)
        );

        CREATE TABLE IF NOT EXISTS staging_match_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entidad_tipo TEXT,
            fuente TEXT,
            codigo_fuente TEXT,
            nombre_fuente TEXT,
            id_entidad_match TEXT,
            score REAL,
            metodo_match TEXT,
            estado TEXT,
            detalle TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS diagnostico_cobertura (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ejecutado_en TEXT NOT NULL,
            tipo_entidad TEXT NOT NULL,
            entidades INTEGER NOT NULL,
            con_codigo_indec INTEGER NOT NULL,
            con_codigo_georef INTEGER NOT NULL,
            con_codigo_refeglo INTEGER NOT NULL,
            con_centroide INTEGER NOT NULL,
            con_geom_wkt INTEGER NOT NULL,
            con_poblacion_2022 INTEGER NOT NULL,
            poblacion_oficial_directa INTEGER NOT NULL,
            poblacion_oficial_procesada INTEGER NOT NULL,
            poblacion_estimada INTEGER NOT NULL,
            relaciones_padre INTEGER NOT NULL,
            relaciones_huerfanas INTEGER NOT NULL,
            estado TEXT NOT NULL,
            observaciones TEXT
        );

        CREATE TABLE IF NOT EXISTS diagnostico_faltantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ejecutado_en TEXT NOT NULL,
            severidad TEXT NOT NULL,
            categoria TEXT NOT NULL,
            entidad_tipo TEXT,
            id_entidad TEXT,
            descripcion TEXT NOT NULL,
            accion_recomendada TEXT,
            fuente_sugerida TEXT
        );
        '''
    )


def normalize_geo_entities(conn: sqlite3.Connection) -> int:
    rows = conn.execute('SELECT id_entidad, nombre FROM geo_entidad').fetchall()
    updated = 0
    for entity_id, name in rows:
        norm = normalize_text(name)
        conn.execute('UPDATE geo_entidad SET nombre_normalizado=? WHERE id_entidad=?', (norm, entity_id))
        updated += 1
    return updated


def infer_province_id(row: sqlite3.Row | tuple[Any, ...], columns: list[str]) -> str | None:
    data = dict(zip(columns, row))
    # Prioridad: provincia_id explícito; luego prefijos de códigos INDEC/Georef/REFEGLO.
    existing = data.get('provincia_id')
    if isinstance(existing, str) and existing.startswith('provincia:'):
        return existing
    for key in ['codigo_indec', 'codigo_georef', 'codigo_refeglo']:
        code = normalize_code(data.get(key))
        if code and len(code) >= 2:
            prov = code[:2]
            if prov in PROVINCE_CODES:
                return f'provincia:{prov}'
    return None


def infer_hierarchy(conn: sqlite3.Connection) -> dict[str, int]:
    conn.row_factory = sqlite3.Row
    rows = conn.execute('SELECT * FROM geo_entidad').fetchall()
    columns = [c[1] for c in conn.execute('PRAGMA table_info(geo_entidad)').fetchall()]
    valid_ids = {r['id_entidad'] for r in rows}
    updates = {'provincia_id': 0, 'departamento_id': 0, 'relaciones': 0}

    for r in rows:
        entity_id = r['id_entidad']
        tipo = r['tipo_entidad']
        provincia_id = infer_province_id(tuple(r), columns)
        if provincia_id and provincia_id in valid_ids and provincia_id != entity_id and r['provincia_id'] != provincia_id:
            conn.execute('UPDATE geo_entidad SET provincia_id=? WHERE id_entidad=?', (provincia_id, entity_id))
            updates['provincia_id'] += 1

        # Deriva departamento por prefijo de 5 dígitos cuando la entidad tiene código compatible y el departamento existe.
        code = normalize_code(r['codigo_indec']) or normalize_code(r['codigo_georef'])
        if code and len(code) >= 5 and tipo not in {'pais', 'provincia', 'departamento', 'partido', 'comuna_caba', 'departamento_partido_comuna'}:
            depto_id = f'departamento:{code[:5]}'
            if depto_id in valid_ids and r['departamento_id'] != depto_id:
                conn.execute('UPDATE geo_entidad SET departamento_id=? WHERE id_entidad=?', (depto_id, entity_id))
                updates['departamento_id'] += 1

    # Relaciones país -> provincias.
    if 'pais:argentina' in valid_ids:
        for prov_code in PROVINCE_CODES:
            prov_id = f'provincia:{prov_code}'
            if prov_id in valid_ids:
                conn.execute(
                    '''INSERT OR IGNORE INTO geo_relacion
                       (id_origen,id_destino,tipo_relacion,metodo,fuente,atributos_json)
                       VALUES (?,?,?,?,?,?)''',
                    (prov_id, 'pais:argentina', 'pertenece_a', 'codigo_indec', 'indec_censo_2022_resumen', '{}'),
                )
                updates['relaciones'] += 1

    # Relaciones por columnas padre.
    rows = conn.execute('SELECT id_entidad, provincia_id, departamento_id, municipio_id, gobierno_local_id, localidad_id FROM geo_entidad').fetchall()
    for r in rows:
        src = r['id_entidad']
        for col in PARENT_COLS:
            dst = r[col]
            if dst and dst in valid_ids and dst != src:
                conn.execute(
                    '''INSERT OR IGNORE INTO geo_relacion
                       (id_origen,id_destino,tipo_relacion,metodo,fuente,atributos_json)
                       VALUES (?,?,?,?,?,?)''',
                    (src, dst, 'pertenece_a', f'{col}_normalizado', 'georef/refeglo/indec', '{}'),
                )
                updates['relaciones'] += 1
    conn.row_factory = None
    return updates


def build_coverage(conn: sqlite3.Connection) -> pd.DataFrame:
    return pd.read_sql_query(
        '''
        WITH pop AS (
          SELECT id_entidad,
                 MAX(CASE WHEN clasificacion_fuente='oficial_directa' THEN 1 ELSE 0 END) AS oficial_directa,
                 MAX(CASE WHEN clasificacion_fuente='oficial_procesada' THEN 1 ELSE 0 END) AS oficial_procesada,
                 MAX(CASE WHEN clasificacion_fuente='estimada' THEN 1 ELSE 0 END) AS estimada
          FROM censo_poblacion
          WHERE anio_censo=2022
          GROUP BY id_entidad
        ), rel AS (
          SELECT id_origen AS id_entidad,
                 COUNT(*) AS relaciones_padre,
                 SUM(CASE WHEN d.id_entidad IS NULL THEN 1 ELSE 0 END) AS relaciones_huerfanas
          FROM geo_relacion r
          LEFT JOIN geo_entidad d ON d.id_entidad = r.id_destino
          WHERE r.tipo_relacion='pertenece_a'
          GROUP BY id_origen
        )
        SELECT
            g.tipo_entidad,
            COUNT(*) AS entidades,
            SUM(CASE WHEN g.codigo_indec IS NOT NULL AND g.codigo_indec <> '' THEN 1 ELSE 0 END) AS con_codigo_indec,
            SUM(CASE WHEN g.codigo_georef IS NOT NULL AND g.codigo_georef <> '' THEN 1 ELSE 0 END) AS con_codigo_georef,
            SUM(CASE WHEN g.codigo_refeglo IS NOT NULL AND g.codigo_refeglo <> '' THEN 1 ELSE 0 END) AS con_codigo_refeglo,
            SUM(CASE WHEN g.centroid_lat IS NOT NULL AND g.centroid_lon IS NOT NULL THEN 1 ELSE 0 END) AS con_centroide,
            SUM(CASE WHEN g.geom_wkt IS NOT NULL AND g.geom_wkt <> '' THEN 1 ELSE 0 END) AS con_geom_wkt,
            SUM(CASE WHEN p.id_entidad IS NOT NULL THEN 1 ELSE 0 END) AS con_poblacion_2022,
            SUM(COALESCE(pop.oficial_directa,0)) AS poblacion_oficial_directa,
            SUM(COALESCE(pop.oficial_procesada,0)) AS poblacion_oficial_procesada,
            SUM(COALESCE(pop.estimada,0)) AS poblacion_estimada,
            SUM(COALESCE(rel.relaciones_padre,0)) AS relaciones_padre,
            SUM(COALESCE(rel.relaciones_huerfanas,0)) AS relaciones_huerfanas
        FROM geo_entidad g
        LEFT JOIN censo_poblacion p ON p.id_entidad = g.id_entidad AND p.anio_censo=2022
        LEFT JOIN pop ON pop.id_entidad = g.id_entidad
        LEFT JOIN rel ON rel.id_entidad = g.id_entidad
        GROUP BY g.tipo_entidad
        ORDER BY g.tipo_entidad
        ''',
        conn,
    )


def detect_missing(conn: sqlite3.Connection, coverage: pd.DataFrame) -> list[dict[str, Any]]:
    missing: list[dict[str, Any]] = []
    cov_by_type = {r['tipo_entidad']: r for _, r in coverage.iterrows()}

    # Controles duros de semilla.
    provincias = cov_by_type.get('provincia')
    if provincias is None or int(provincias['entidades']) != 24:
        missing.append({
            'severidad': 'alta',
            'categoria': 'cobertura',
            'entidad_tipo': 'provincia',
            'id_entidad': None,
            'descripcion': 'No hay exactamente 24 jurisdicciones provinciales/CABA en la base.',
            'accion_recomendada': 'Recrear semilla y descargar Georef provincias + resumen INDEC Censo 2022.',
            'fuente_sugerida': 'Georef + INDEC Censo 2022 resumen',
        })
    elif int(provincias['con_poblacion_2022']) != 24:
        missing.append({
            'severidad': 'alta',
            'categoria': 'censo',
            'entidad_tipo': 'provincia',
            'id_entidad': None,
            'descripcion': 'Hay provincias sin población Censo 2022.',
            'accion_recomendada': 'Reimportar c2022_tp_c_resumen.xlsx.',
            'fuente_sugerida': 'INDEC Censo 2022 resumen',
        })

    # Entidades sin provincia cuando deberían tenerla.
    no_prov = pd.read_sql_query(
        '''SELECT id_entidad, tipo_entidad, nombre, codigo_indec, codigo_georef, codigo_refeglo
           FROM geo_entidad
           WHERE tipo_entidad NOT IN ('pais','provincia')
             AND (provincia_id IS NULL OR provincia_id='')
           ORDER BY tipo_entidad, nombre
           LIMIT 50''',
        conn,
    )
    for _, r in no_prov.iterrows():
        missing.append({
            'severidad': 'media',
            'categoria': 'relacion',
            'entidad_tipo': r['tipo_entidad'],
            'id_entidad': r['id_entidad'],
            'descripcion': f"Entidad sin provincia vinculada: {r['nombre']}.",
            'accion_recomendada': 'Derivar por prefijo de código INDEC/Georef/REFEGLO; si no existe, cruzar por Georef ubicación o match nombre+provincia.',
            'fuente_sugerida': 'Georef API / INDEC Codgeo / REFEGLO',
        })

    # Tipos esperados para base completa que no aparecen todavía.
    expected_final = {
        'departamento_partido_comuna': 'Descargar Georef departamentos y vincular con Censo 2022 por departamento/partido/comuna.',
        'municipio': 'Descargar Georef municipios; cruzar con gobiernos locales cuando corresponda.',
        'localidad': 'Descargar Georef localidades; usar BAHRA/Georef y relación provincia/departamento/localidad.',
        'localidad_censal': 'Descargar Georef localidades_censales; importar población desde REDATAM/Codgeo exportado.',
        'fraccion_censal': 'Descargar o importar fracciones censales INDEC/Georef v2 si están disponibles.',
        'radio_censal': 'Descargar o importar radios censales INDEC/Georef v2 si están disponibles; necesario para estimar barrios.',
        'barrio': 'Incorporar capas oficiales municipales/provinciales o OSM como no oficial.',
        'barrio_popular': 'Incorporar RENABAP como capa parcial de barrios populares.',
    }
    present_types = set(coverage['tipo_entidad']) if not coverage.empty else set()
    for tipo, action in expected_final.items():
        if tipo not in present_types:
            severity = 'alta' if tipo in {'departamento_partido_comuna', 'localidad_censal'} else 'media'
            if tipo in {'barrio', 'barrio_popular'}:
                severity = 'informativa'
            missing.append({
                'severidad': severity,
                'categoria': 'fuente_no_materializada',
                'entidad_tipo': tipo,
                'id_entidad': None,
                'descripcion': f'La jerarquía {tipo} no está materializada en la base semilla actual.',
                'accion_recomendada': action,
                'fuente_sugerida': 'Georef / INDEC / REDATAM / RENABAP / fuente municipal según corresponda',
            })

    # Población por entidad no provincial/local.
    no_pop = pd.read_sql_query(
        '''SELECT g.id_entidad, g.tipo_entidad, g.nombre
           FROM geo_entidad g
           LEFT JOIN censo_poblacion p ON p.id_entidad=g.id_entidad AND p.anio_censo=2022
           WHERE p.id_entidad IS NULL
           ORDER BY g.tipo_entidad, g.nombre
           LIMIT 100''',
        conn,
    )
    for _, r in no_pop.iterrows():
        severity = 'media'
        if r['tipo_entidad'] in {'barrio', 'barrio_popular'}:
            severity = 'informativa'
        missing.append({
            'severidad': severity,
            'categoria': 'poblacion_2022',
            'entidad_tipo': r['tipo_entidad'],
            'id_entidad': r['id_entidad'],
            'descripcion': f"Entidad sin población censal 2022 vinculada: {r['nombre']}.",
            'accion_recomendada': 'Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada.',
            'fuente_sugerida': 'INDEC Censo 2022 / REDATAM / radios censales / fuente municipal',
        })

    return missing


def population_controls(conn: sqlite3.Connection) -> dict[str, Any]:
    out: dict[str, Any] = {}
    total_pais = conn.execute("SELECT poblacion_total FROM censo_poblacion WHERE id_entidad='pais:argentina' AND anio_censo=2022 LIMIT 1").fetchone()
    prov_sum = conn.execute("SELECT SUM(poblacion_total) FROM censo_poblacion WHERE id_entidad LIKE 'provincia:%' AND anio_censo=2022").fetchone()
    gl_sum = conn.execute("SELECT SUM(poblacion_total) FROM censo_poblacion WHERE id_entidad LIKE 'gobierno_local:%' AND anio_censo=2022").fetchone()
    out['poblacion_pais'] = total_pais[0] if total_pais else None
    out['suma_provincias'] = prov_sum[0] if prov_sum else None
    out['diferencia_pais_vs_provincias'] = (out['poblacion_pais'] or 0) - (out['suma_provincias'] or 0)
    out['suma_gobiernos_locales'] = gl_sum[0] if gl_sum else None
    out['nota_gobiernos_locales'] = 'Control informativo: gobiernos locales no siempre son una partición simple equivalente a provincias/departamentos.'
    return out


def gpkg_diagnostics(gpkg: Path | None) -> dict[str, Any]:
    if gpkg is None or not gpkg.exists():
        return {'existe': False, 'capas': []}
    conn = sqlite3.connect(gpkg)
    try:
        layers = pd.read_sql_query("SELECT table_name, data_type, identifier FROM gpkg_contents ORDER BY table_name", conn)
        counts = []
        for table in layers['table_name'].tolist():
            try:
                n = conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            except Exception:
                n = None
            counts.append({'table_name': table, 'registros': n})
        return {'existe': True, 'capas': layers.to_dict(orient='records'), 'conteos': counts}
    finally:
        conn.close()


def persist_diagnostics(conn: sqlite3.Connection, coverage: pd.DataFrame, missing: list[dict[str, Any]], executed_at: str) -> None:
    conn.execute('DELETE FROM diagnostico_cobertura')
    conn.execute('DELETE FROM diagnostico_faltantes')
    for _, r in coverage.iterrows():
        estado = 'ok'
        obs = ''
        if int(r['relaciones_huerfanas']) > 0:
            estado = 'error_relacion'
            obs = 'Hay relaciones que apuntan a entidades inexistentes.'
        if r['tipo_entidad'] in {'barrio', 'barrio_popular'}:
            obs = 'Jerarquía parcial o estimada; no existe capa nacional homogénea con población censal directa.'
        conn.execute(
            '''INSERT INTO diagnostico_cobertura
               (ejecutado_en,tipo_entidad,entidades,con_codigo_indec,con_codigo_georef,con_codigo_refeglo,
                con_centroide,con_geom_wkt,con_poblacion_2022,poblacion_oficial_directa,poblacion_oficial_procesada,
                poblacion_estimada,relaciones_padre,relaciones_huerfanas,estado,observaciones)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (executed_at, r['tipo_entidad'], int(r['entidades']), int(r['con_codigo_indec']), int(r['con_codigo_georef']),
             int(r['con_codigo_refeglo']), int(r['con_centroide']), int(r['con_geom_wkt']), int(r['con_poblacion_2022']),
             int(r['poblacion_oficial_directa']), int(r['poblacion_oficial_procesada']), int(r['poblacion_estimada']),
             int(r['relaciones_padre']), int(r['relaciones_huerfanas']), estado, obs),
        )
    for m in missing:
        conn.execute(
            '''INSERT INTO diagnostico_faltantes
               (ejecutado_en,severidad,categoria,entidad_tipo,id_entidad,descripcion,accion_recomendada,fuente_sugerida)
               VALUES (?,?,?,?,?,?,?,?)''',
            (executed_at, m['severidad'], m['categoria'], m.get('entidad_tipo'), m.get('id_entidad'),
             m['descripcion'], m.get('accion_recomendada'), m.get('fuente_sugerida')),
        )


def render_markdown(coverage: pd.DataFrame, missing: list[dict[str, Any]], pop: dict[str, Any], gpkg: dict[str, Any], updates: dict[str, int]) -> str:
    lines: list[str] = []
    lines.append('# Diagnóstico de alineación y cobertura')
    lines.append('')
    lines.append(f'Generado: {now_iso()}')
    lines.append('')
    lines.append('## Normalización aplicada')
    lines.append('')
    lines.append(f"- Nombres normalizados: {updates.get('nombres_normalizados', 0):,}")
    lines.append(f"- Provincia inferida por prefijo de código: {updates.get('provincia_id', 0):,}")
    lines.append(f"- Departamento inferido por prefijo de código: {updates.get('departamento_id', 0):,}")
    lines.append(f"- Relaciones padre/hijo insertadas o verificadas: {updates.get('relaciones', 0):,}")
    lines.append('')
    lines.append('## Cobertura por jerarquía')
    lines.append('')
    if coverage.empty:
        lines.append('No hay entidades cargadas.')
    else:
        lines.append(coverage.to_markdown(index=False))
    lines.append('')
    lines.append('## Control poblacional')
    lines.append('')
    lines.append(f"- Población total país: {pop.get('poblacion_pais'):,}" if pop.get('poblacion_pais') is not None else '- Población total país: sin dato')
    lines.append(f"- Suma provincias: {pop.get('suma_provincias'):,}" if pop.get('suma_provincias') is not None else '- Suma provincias: sin dato')
    lines.append(f"- Diferencia país vs provincias: {pop.get('diferencia_pais_vs_provincias'):,}")
    lines.append(f"- Suma gobiernos locales: {pop.get('suma_gobiernos_locales'):,}" if pop.get('suma_gobiernos_locales') is not None else '- Suma gobiernos locales: sin dato')
    lines.append(f"- Nota: {pop.get('nota_gobiernos_locales')}")
    lines.append('')
    lines.append('## GeoPackage')
    lines.append('')
    if not gpkg.get('existe'):
        lines.append('No se detectó GeoPackage. Esto es normal si aún no se ejecutó `build_full_gpkg.py`.')
    else:
        layers_df = pd.DataFrame(gpkg.get('conteos', []))
        lines.append(layers_df.to_markdown(index=False) if not layers_df.empty else 'GeoPackage sin capas detectadas.')
    lines.append('')
    lines.append('## Faltantes y acciones recomendadas')
    lines.append('')
    if missing:
        miss_df = pd.DataFrame(missing)
        # Evita Markdown inmanejable: muestra resumen por categoría y severidad + primeros detalles.
        summary = miss_df.groupby(['severidad', 'categoria', 'entidad_tipo'], dropna=False).size().reset_index(name='cantidad')
        lines.append(summary.to_markdown(index=False))
        lines.append('')
        lines.append('### Primeros faltantes detectados')
        lines.append('')
        cols = ['severidad', 'categoria', 'entidad_tipo', 'id_entidad', 'descripcion', 'accion_recomendada']
        lines.append(miss_df[cols].head(60).to_markdown(index=False))
    else:
        lines.append('No se detectaron faltantes en la base cargada.')
    lines.append('')
    lines.append('## Interpretación')
    lines.append('')
    lines.append('- `oficial_directa`: el dato proviene de una fuente oficial sin estimación propia.')
    lines.append('- `oficial_procesada`: el dato proviene de una fuente oficial, pero fue exportado/procesado para poder vincularlo.')
    lines.append('- `oficial_parcial`: fuente oficial pero no cubre todo el universo nacional, por ejemplo RENABAP o barrios CABA.')
    lines.append('- `estimada`: población calculada por overlay espacial, especialmente barrios contra radios censales.')
    lines.append('- `no_oficial`: complemento como OSM; nunca pisa una fuente oficial.')
    return '\n'.join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description='Normaliza vínculos y genera diagnóstico de cobertura/errores/faltantes.')
    parser.add_argument('--sqlite', required=True, help='SQLite semilla/base relacional.')
    parser.add_argument('--gpkg', default=None, help='GeoPackage generado, opcional.')
    parser.add_argument('--out-md', required=True)
    parser.add_argument('--out-json', default=None)
    args = parser.parse_args()

    sqlite_path = Path(args.sqlite)
    conn = sqlite_connect(sqlite_path)
    ensure_diag_schema(conn)
    executed_at = now_iso()
    updates: dict[str, int] = {}
    updates['nombres_normalizados'] = normalize_geo_entities(conn)
    updates.update(infer_hierarchy(conn))
    coverage = build_coverage(conn)
    missing = detect_missing(conn, coverage)
    pop = population_controls(conn)
    gpkg_info = gpkg_diagnostics(Path(args.gpkg) if args.gpkg else None)
    persist_diagnostics(conn, coverage, missing, executed_at)
    conn.commit()
    conn.close()

    md = render_markdown(coverage, missing, pop, gpkg_info, updates)
    out_md = Path(args.out_md)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_md.write_text(md, encoding='utf-8')
    if args.out_json:
        payload = {
            'ejecutado_en': executed_at,
            'updates': updates,
            'coverage': coverage.to_dict(orient='records'),
            'population_controls': pop,
            'gpkg': gpkg_info,
            'missing': missing,
        }
        out_json = Path(args.out_json)
        out_json.parent.mkdir(parents=True, exist_ok=True)
        out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Diagnóstico escrito: {out_md}')


if __name__ == '__main__':
    main()
