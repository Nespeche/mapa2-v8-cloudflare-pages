from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path

import pandas as pd

from utils import normalize_code, normalize_text, safe_int, sqlite_connect


def main() -> None:
    parser = argparse.ArgumentParser(description='Importa población 2022 por localidad/localidad censal exportada desde REDATAM.')
    parser.add_argument('--csv', required=True)
    parser.add_argument('--sqlite', required=True)
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise SystemExit(f'No existe {csv_path}')
    conn = sqlite_connect(args.sqlite)
    now = dt.datetime.utcnow().isoformat()
    df = pd.read_csv(csv_path, dtype=str)
    required = {'codigo_provincia', 'codigo_departamento', 'codigo_localidad_censal', 'nombre_localidad', 'poblacion_total'}
    missing = required - set(df.columns)
    if missing:
        raise SystemExit(f'Faltan columnas: {sorted(missing)}')
    conn.execute(
        """INSERT OR IGNORE INTO fuente_catalogo
           (id_fuente,nombre_fuente,organismo,url_origen,tipo_fuente,fecha_extraccion,observaciones)
           VALUES (?,?,?,?,?,?,?)""",
        ('indec_redatam_localidades_2022', 'Exportación REDATAM Censo 2022 por localidad', 'INDEC', None, 'procesada', now, 'Importada desde CSV manual/automatizado.')
    )
    for _, row in df.iterrows():
        prov = normalize_code(row.get('codigo_provincia'), 2)
        dpto = normalize_code(row.get('codigo_departamento'))
        loc = normalize_code(row.get('codigo_localidad_censal'))
        name = row.get('nombre_localidad')
        if not loc or not name:
            continue
        entity_id = f'localidad_censal:{loc}'
        conn.execute(
            """INSERT OR IGNORE INTO geo_entidad
               (id_entidad,tipo_entidad,codigo_indec,nombre,nombre_normalizado,provincia_id,departamento_id,
                fuente_geografica,clasificacion_fuente,metodo_geometria,nivel_confianza,anio_fuente,atributos_json)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (entity_id, 'localidad_censal', loc, name, normalize_text(name), f'provincia:{prov}' if prov else None,
             f'departamento:{dpto}' if dpto else None, 'indec_redatam_localidades_2022', 'oficial_procesada',
             'match_georef_o_redatam', 'alta', 2022, '{}')
        )
        conn.execute(
            """INSERT INTO censo_poblacion
               (id_entidad,anio_censo,poblacion_total,viviendas_total,fuente_censo,clasificacion_fuente,metodo_dato,nivel_confianza,fecha_extraccion,observaciones)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (entity_id, 2022, safe_int(row.get('poblacion_total')), safe_int(row.get('viviendas_total')),
             'indec_redatam_localidades_2022', 'oficial_procesada', 'redatam_export', 'alta', now, row.get('fuente_url'))
        )
    conn.commit()
    print(f'Importación REDATAM finalizada: {csv_path}')


if __name__ == '__main__':
    main()
