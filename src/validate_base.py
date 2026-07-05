from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from utils import sqlite_connect


def check_sqlite(path: Path) -> list[str]:
    warnings: list[str] = []
    conn = sqlite_connect(path)
    total_country = pd.read_sql_query("SELECT poblacion_total FROM censo_poblacion WHERE id_entidad='pais:argentina' AND anio_censo=2022", conn)
    prov_sum = pd.read_sql_query("""
        SELECT SUM(p.poblacion_total) AS s
        FROM censo_poblacion p
        JOIN geo_entidad g ON g.id_entidad=p.id_entidad
        WHERE g.tipo_entidad='provincia' AND p.anio_censo=2022
    """, conn)
    if not total_country.empty and not prov_sum.empty:
        delta = int(total_country.iloc[0, 0]) - int(prov_sum.iloc[0, 0])
        if delta != 0:
            warnings.append(f'Diferencia país vs suma provincias: {delta}')
    dup = pd.read_sql_query("""
        SELECT tipo_entidad, codigo_indec, COUNT(*) c
        FROM geo_entidad
        WHERE codigo_indec IS NOT NULL
        GROUP BY tipo_entidad, codigo_indec HAVING c > 1
    """, conn)
    if not dup.empty:
        warnings.append(f'Códigos INDEC duplicados: {len(dup)} grupos')
    no_pop = pd.read_sql_query("""
        SELECT tipo_entidad, COUNT(*) c
        FROM geo_entidad g
        WHERE NOT EXISTS (SELECT 1 FROM censo_poblacion p WHERE p.id_entidad=g.id_entidad AND p.anio_censo=2022)
        GROUP BY tipo_entidad
    """, conn)
    if not no_pop.empty:
        warnings.append('Entidades sin población 2022: ' + no_pop.to_dict(orient='records').__repr__())
    conn.close()
    return warnings


def check_raw(raw_dir: Path) -> list[str]:
    warnings: list[str] = []
    georef_dir = raw_dir / 'georef'
    expected = ['provincias', 'departamentos', 'municipios', 'gobiernos-locales', 'localidades', 'localidades_censales', 'asentamientos']
    for resource in expected:
        if not any((georef_dir / f'{resource}.{ext}').exists() for ext in ['ndjson', 'geojson', 'zip']):
            warnings.append(f'Falta descarga Georef: {resource}')
    return warnings


def main() -> None:
    parser = argparse.ArgumentParser(description='Valida cobertura mínima de la base.')
    parser.add_argument('--sqlite', required=True)
    parser.add_argument('--raw-dir', required=True)
    args = parser.parse_args()

    warnings = check_sqlite(Path(args.sqlite)) + check_raw(Path(args.raw_dir))
    if warnings:
        print('VALIDACIÓN CON OBSERVACIONES')
        for w in warnings:
            print(f' - {w}')
    else:
        print('VALIDACIÓN OK')


if __name__ == '__main__':
    main()
