from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any

import pandas as pd

from utils import normalize_code, normalize_text, sqlite_connect


def read_any_table(path: Path) -> pd.DataFrame | None:
    if path.suffix.lower() in {'.xlsx', '.xls'}:
        try:
            frames = pd.read_excel(path, dtype=str, sheet_name=None)
        except Exception as exc:  # noqa: BLE001
            print(f'No pude leer {path}: {exc}')
            return None
        pieces = []
        for sheet, df in frames.items():
            if df.empty:
                continue
            df = df.copy()
            df['_sheet'] = sheet
            pieces.append(df)
        return pd.concat(pieces, ignore_index=True) if pieces else None
    if path.suffix.lower() in {'.csv', '.txt'}:
        try:
            sample = path.read_text(encoding='utf-8', errors='ignore')[:4096]
            dialect = csv.Sniffer().sniff(sample, delimiters=',;\t|')
            return pd.read_csv(path, dtype=str, sep=dialect.delimiter)
        except Exception:
            for sep in [';', ',', '\t', '|']:
                try:
                    return pd.read_csv(path, dtype=str, sep=sep)
                except Exception:
                    pass
    return None


def norm_col(c: Any) -> str:
    return normalize_text(c) or ''


def find_col(columns: list[str], contains_any: list[str]) -> str | None:
    normed = [(c, norm_col(c)) for c in columns]
    for c, n in normed:
        if any(term in n for term in contains_any):
            return c
    return None


def guess_tipo(code: str | None, name: str | None, file_name: str) -> str | None:
    f = norm_col(file_name)
    if 'jurisdic' in f or 'provincia' in f:
        return 'provincia'
    if 'partido' in f or 'departamento' in f or 'comuna' in f:
        return 'departamento_partido_comuna'
    if 'gobierno' in f or 'municipio' in f:
        return 'gobierno_local'
    if 'localidad' in f:
        return 'localidad_censal'
    if 'aglomerado' in f:
        return 'aglomerado'
    if not code:
        return None
    if len(code) == 2:
        return 'provincia'
    if len(code) == 5:
        return 'departamento_partido_comuna'
    if len(code) == 6:
        return 'gobierno_local'
    if len(code) == 8:
        return 'localidad_censal'
    if len(code) == 4:
        return 'aglomerado'
    return None


def entity_id_for(tipo: str, code: str) -> str:
    prefix = {
        'provincia': 'provincia',
        'departamento_partido_comuna': 'departamento',
        'gobierno_local': 'gobierno_local',
        'localidad_censal': 'localidad_censal',
        'aglomerado': 'aglomerado',
    }.get(tipo, tipo)
    return f'{prefix}:{code}'


def ensure_schema(conn) -> None:
    conn.executescript(
        '''
        CREATE TABLE IF NOT EXISTS codgeo_2022_raw (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            archivo TEXT NOT NULL,
            hoja TEXT,
            fila INTEGER NOT NULL,
            codigo TEXT,
            nombre TEXT,
            tipo_entidad_guess TEXT,
            provincia_id TEXT,
            departamento_id TEXT,
            localidad_id TEXT,
            columnas_json TEXT NOT NULL
        );
        '''
    )


def upsert_entity(conn, tipo: str, code: str, name: str | None) -> str:
    entity_id = entity_id_for(tipo, code)
    provincia_id = f'provincia:{code[:2]}' if len(code) >= 2 and code[:2].isdigit() else None
    departamento_id = f'departamento:{code[:5]}' if len(code) >= 5 and tipo not in {'provincia', 'departamento_partido_comuna'} else None
    conn.execute(
        '''INSERT OR IGNORE INTO geo_entidad
           (id_entidad,tipo_entidad,codigo_indec,nombre,nombre_normalizado,provincia_id,departamento_id,
            fuente_geografica,clasificacion_fuente,metodo_geometria,nivel_confianza,anio_fuente,atributos_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        (entity_id, tipo, code, name or code, normalize_text(name or code), provincia_id, departamento_id,
         'indec_codgeo_2022', 'oficial_procesada', 'sin_geometria_codgeo', 'alta', 2022, '{}'),
    )
    return entity_id


def import_dir(input_dir: Path, sqlite_path: Path, upsert: bool) -> None:
    conn = sqlite_connect(sqlite_path)
    ensure_schema(conn)
    conn.execute('DELETE FROM codgeo_2022_raw')
    files = [p for p in input_dir.rglob('*') if p.suffix.lower() in {'.csv', '.txt', '.xlsx', '.xls'}]
    total = 0
    upserts = 0
    for path in files:
        df = read_any_table(path)
        if df is None or df.empty:
            continue
        columns = list(df.columns)
        code_col = find_col(columns, ['codigo', 'cod', 'id'])
        name_col = find_col(columns, ['nombre', 'descripcion', 'denominacion'])
        for i, row in df.iterrows():
            raw_code = row.get(code_col) if code_col else None
            code = normalize_code(raw_code)
            name = str(row.get(name_col)).strip() if name_col and pd.notna(row.get(name_col)) else None
            if not code and not name:
                continue
            tipo = guess_tipo(code, name, path.name)
            prov = f'provincia:{code[:2]}' if code and len(code) >= 2 and code[:2].isdigit() else None
            depto = f'departamento:{code[:5]}' if code and len(code) >= 5 and code[:5].isdigit() else None
            loc = f'localidad_censal:{code[:8]}' if code and len(code) >= 8 and code[:8].isdigit() else None
            conn.execute(
                '''INSERT INTO codgeo_2022_raw
                   (archivo,hoja,fila,codigo,nombre,tipo_entidad_guess,provincia_id,departamento_id,localidad_id,columnas_json)
                   VALUES (?,?,?,?,?,?,?,?,?,?)''',
                (str(path.relative_to(input_dir)), row.get('_sheet'), int(i) + 2, code, name, tipo, prov, depto, loc,
                 json.dumps({str(k): (None if pd.isna(v) else str(v)) for k, v in row.items()}, ensure_ascii=False)),
            )
            total += 1
            if upsert and tipo and code:
                upsert_entity(conn, tipo, code, name)
                upserts += 1
    conn.commit()
    conn.close()
    print(f'Codgeo importado: {total:,} filas crudas; entidades insertadas/ignoradas: {upserts:,}')


def main() -> None:
    parser = argparse.ArgumentParser(description='Importa códigos geográficos INDEC Codgeo/REDATAM 2022 a staging y opcionalmente geo_entidad.')
    parser.add_argument('--input-dir', required=True)
    parser.add_argument('--sqlite', required=True)
    parser.add_argument('--upsert-entidades', action='store_true')
    args = parser.parse_args()
    import_dir(Path(args.input_dir), Path(args.sqlite), args.upsert_entidades)


if __name__ == '__main__':
    main()
