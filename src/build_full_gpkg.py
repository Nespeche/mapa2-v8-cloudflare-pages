from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any

import geopandas as gpd
import pandas as pd
from shapely.geometry import shape

from load_to_gpkg import read_georef_resource
from utils import load_yaml, normalize_code, normalize_text, sqlite_connect


def _get_nested(row: pd.Series, key: str) -> Any:
    """Obtiene valores anidados o columnas planas provenientes de Georef.

    Ejemplos soportados:
    - row['provincia'] = {'id': '06', 'nombre': 'Buenos Aires'}
    - row['provincia.id'] = '06'
    - row['provincia_id'] = '06'
    """
    direct_keys = [key, key.replace('.', '_')]
    for k in direct_keys:
        if k in row and pd.notna(row[k]):
            return row[k]
    if '.' in key:
        root, child = key.split('.', 1)
        obj = row.get(root) if root in row else None
        if isinstance(obj, dict):
            return obj.get(child)
        if isinstance(obj, str) and obj.strip().startswith('{'):
            try:
                parsed = json.loads(obj)
                if isinstance(parsed, dict):
                    return parsed.get(child)
            except json.JSONDecodeError:
                return None
    return None


def _code(row: pd.Series, candidates: list[str], width: int | None = None) -> str | None:
    for c in candidates:
        value = _get_nested(row, c)
        code = normalize_code(value, width)
        if code:
            return code
    return None


def _name(row: pd.Series) -> str:
    for c in ['nombre', 'nombre_completo', 'name', 'nam']:
        if c in row and pd.notna(row[c]) and str(row[c]).strip():
            return str(row[c]).strip()
    return ''


def georef_to_entidades(gdf: gpd.GeoDataFrame, resource: str, meta: dict[str, Any]) -> gpd.GeoDataFrame:
    tipo = meta['tipo_entidad']
    width_by_tipo = {
        'provincia': 2,
        'departamento_partido_comuna': None,
        'municipio': None,
        'gobierno_local': 6,
        'localidad': None,
        'localidad_censal': None,
        'asentamiento': None,
        'fraccion_censal': 7,
        'radio_censal': 9,
        'aglomerado': None,
    }
    rows = []
    geoms = []
    for idx, row in gdf.iterrows():
        codigo = _code(row, ['id', 'codigo', 'cod_indec'], width_by_tipo.get(tipo)) or str(idx)
        name = _name(row) or codigo
        provincia_code = _code(row, ['provincia.id', 'provincia_id', 'codprov', 'codigo_provincia'], 2)
        departamento_code = _code(row, ['departamento.id', 'departamento_id', 'coddepto', 'codigo_departamento'])
        municipio_code = _code(row, ['municipio.id', 'municipio_id', 'codigo_municipio'])
        gl_code = _code(row, ['gobierno_local.id', 'gobierno_local_id', 'codigo_gobierno_local', 'codigo_refeglo'], 6)

        if tipo == 'provincia':
            id_entidad = f'provincia:{codigo}'
            codigo_indec = codigo
        elif tipo == 'gobierno_local':
            id_entidad = f'gobierno_local:{codigo}'
            codigo_indec = codigo
        elif tipo == 'departamento_partido_comuna':
            id_entidad = f'departamento:{codigo}'
            codigo_indec = codigo
        elif tipo == 'municipio':
            id_entidad = f'municipio:{codigo}'
            codigo_indec = codigo
        elif tipo == 'localidad_censal':
            id_entidad = f'localidad_censal:{codigo}'
            codigo_indec = codigo
        elif tipo == 'localidad':
            id_entidad = f'localidad:{codigo}'
            codigo_indec = None
        elif tipo == 'fraccion_censal':
            id_entidad = f'fraccion_censal:{codigo}'
            codigo_indec = codigo
        elif tipo == 'radio_censal':
            id_entidad = f'radio_censal:{codigo}'
            codigo_indec = codigo
        else:
            id_entidad = f'{tipo}:{codigo}'
            codigo_indec = codigo

        rows.append({
            'id_entidad': id_entidad,
            'tipo_entidad': tipo,
            'codigo_indec': codigo_indec,
            'codigo_georef': codigo,
            'codigo_refeglo': codigo if tipo == 'gobierno_local' else gl_code,
            'nombre': name,
            'nombre_normalizado': normalize_text(name),
            'provincia_id': f'provincia:{provincia_code}' if provincia_code else None,
            'departamento_id': f'departamento:{departamento_code}' if departamento_code else None,
            'municipio_id': f'municipio:{municipio_code}' if municipio_code else None,
            'gobierno_local_id': f'gobierno_local:{gl_code}' if gl_code else None,
            'localidad_id': None,
            'fuente_geografica': 'georef',
            'clasificacion_fuente': meta.get('clasificacion_fuente', 'oficial_directa'),
            'metodo_geometria': 'descarga_georef_normalizada',
            'nivel_confianza': meta.get('nivel_confianza', 'alta'),
            'anio_fuente': None,
            'source_resource': resource,
        })
        geoms.append(row.geometry)
    out = gpd.GeoDataFrame(rows, geometry=geoms, crs=gdf.crs or 'EPSG:4326')
    if out.crs is None:
        out = out.set_crs('EPSG:4326')
    return out.to_crs('EPSG:4326')


def seed_tables(seed_db: Path) -> dict[str, pd.DataFrame]:
    conn = sqlite_connect(seed_db)
    out = {}
    for table in ['fuente_catalogo', 'geo_entidad', 'censo_poblacion', 'refeglo_gobiernos_locales', 'control_cobertura']:
        out[table] = pd.read_sql_query(f'SELECT * FROM {table}', conn)
    conn.close()
    return out


def add_population_columns(entidades: gpd.GeoDataFrame, censo: pd.DataFrame) -> gpd.GeoDataFrame:
    cols = [
        'id_entidad', 'anio_censo', 'poblacion_total', 'viviendas_total',
        'fuente_censo', 'clasificacion_fuente', 'metodo_dato', 'nivel_confianza'
    ]
    pop = censo[censo['anio_censo'].astype(str) == '2022'][cols].copy()
    pop = pop.rename(columns={
        'clasificacion_fuente': 'clasificacion_censo',
        'nivel_confianza': 'confianza_censo',
    })
    return entidades.merge(pop, on='id_entidad', how='left')


def write_relations(entidades: gpd.GeoDataFrame, gpkg: Path) -> None:
    rels = []
    for _, r in entidades.iterrows():
        src = r['id_entidad']
        for parent_col in ['provincia_id', 'departamento_id', 'municipio_id', 'gobierno_local_id', 'localidad_id']:
            dst = r.get(parent_col)
            if isinstance(dst, str) and dst and dst != src:
                rels.append({
                    'id_origen': src,
                    'id_destino': dst,
                    'tipo_relacion': 'pertenece_a',
                    'metodo': 'codigos_georef',
                    'fuente': 'georef',
                })
    df = pd.DataFrame(rels).drop_duplicates() if rels else pd.DataFrame(columns=['id_origen','id_destino','tipo_relacion','metodo','fuente'])
    with sqlite3.connect(gpkg) as conn:
        df.to_sql('geo_relacion', conn, if_exists='replace', index=False)


def configured_georef_resources(cfg: dict) -> list[tuple[str, dict]]:
    """Devuelve recursos obligatorios y opcionales con alias de descarga.

    Para recursos opcionales nuevos de Georef, `resource` es el primer candidato
    que exista en data/raw/georef. Si ninguno existe, se usa la clave lógica para
    que el warning sea claro.
    """
    items: list[tuple[str, dict]] = list(cfg['georef']['resources'].items())
    for key, meta in (cfg.get('georef', {}).get('optional_resources', {}) or {}).items():
        candidates = meta.get('candidates') or [key]
        selected = candidates[0]
        meta2 = dict(meta)
        meta2['_logical_name'] = key
        meta2['_candidates'] = candidates
        items.append((selected, meta2))
    return items


def read_any_georef_resource(raw: Path, resource: str, meta: dict[str, Any]) -> tuple[str, gpd.GeoDataFrame | None]:
    candidates = meta.get('_candidates') or [resource]
    for c in candidates:
        gdf = read_georef_resource(raw, c)
        if gdf is not None and not gdf.empty:
            return c, gdf
    return resource, None


def main() -> None:
    parser = argparse.ArgumentParser(description='Construye un GeoPackage normalizado con capas Georef + población semilla para mapa.')
    parser.add_argument('--config', required=True)
    parser.add_argument('--raw-dir', required=True)
    parser.add_argument('--seed-db', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()

    cfg = load_yaml(args.config)
    raw = Path(args.raw_dir)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()

    seed = seed_tables(Path(args.seed_db))
    normalized_layers: list[gpd.GeoDataFrame] = []

    for resource, meta in configured_georef_resources(cfg):
        resource_read, gdf = read_any_georef_resource(raw, resource, meta)
        if gdf is None or gdf.empty:
            logical = meta.get('_logical_name', resource)
            print(f'WARNING: falta descarga Georef {logical}; se omite capa normalizada.')
            continue
        norm = georef_to_entidades(gdf, resource_read, meta)
        norm_pop = add_population_columns(norm, seed['censo_poblacion'])
        layer = f'georef_{resource_read.replace("-", "_")}'
        norm_pop.to_file(out, layer=layer, driver='GPKG')
        normalized_layers.append(norm_pop)
        print(f'Capa normalizada escrita: {layer} ({len(norm_pop):,})')

    if normalized_layers:
        all_entities = pd.concat(normalized_layers, ignore_index=True)
        all_entities = gpd.GeoDataFrame(all_entities, geometry='geometry', crs='EPSG:4326')
        all_entities.to_file(out, layer='entidades_mapa', driver='GPKG')
    else:
        all_entities = gpd.GeoDataFrame({'id_entidad': []}, geometry=[], crs='EPSG:4326')
        all_entities.to_file(out, layer='entidades_mapa', driver='GPKG')

    with sqlite3.connect(out) as conn:
        for table, df in seed.items():
            df.to_sql(table, conn, if_exists='replace', index=False)
    write_relations(all_entities, out)
    print(f'GeoPackage normalizado generado: {out}')


if __name__ == '__main__':
    main()
