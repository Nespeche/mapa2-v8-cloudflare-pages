from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def run(cmd: list[str], *, allow_fail: bool = False) -> None:
    print('\n$ ' + ' '.join(cmd))
    result = subprocess.run(cmd, check=False)
    if result.returncode != 0 and not allow_fail:
        raise SystemExit(result.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(description='Ejecuta pipeline completo recomendado: semilla, descargas, GPKG y diagnóstico.')
    parser.add_argument('--skip-download', action='store_true', help='No descarga fuentes, usa data/raw existente.')
    parser.add_argument('--config', default='config/sources.yml')
    parser.add_argument('--seed-dir', default='data/semilla')
    parser.add_argument('--raw-dir', default='data/raw')
    parser.add_argument('--out-dir', default='data/output')
    parser.add_argument('--database-url', default=None, help='Opcional: si se informa, carga también PostGIS.')
    args = parser.parse_args()

    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    seed = out / 'arg_geo_censo_semilla.sqlite'
    gpkg = out / 'arg_geo_censo_full.gpkg'
    diag_md = out / 'diagnostico_alineacion.md'
    diag_json = out / 'diagnostico_alineacion.json'

    py = sys.executable
    run([py, 'src/create_seed_sqlite.py', '--seed-dir', args.seed_dir, '--out', str(seed)])
    if not args.skip_download:
        run([py, 'src/download_sources.py', '--config', args.config, '--raw-dir', args.raw_dir], allow_fail=True)
    run([py, 'src/build_full_gpkg.py', '--config', args.config, '--raw-dir', args.raw_dir, '--seed-db', str(seed), '--out', str(gpkg)], allow_fail=True)
    run([py, 'src/diagnose_and_align.py', '--sqlite', str(seed), '--gpkg', str(gpkg), '--out-md', str(diag_md), '--out-json', str(diag_json)])
    if args.database_url:
        run([py, 'src/build_postgis.py', '--config', args.config, '--raw-dir', args.raw_dir, '--seed-db', str(seed), '--database-url', args.database_url, '--replace-spatial'], allow_fail=False)
        print('Recordá ejecutar: psql "$DATABASE_URL" -f sql/02_diagnostico_postgis.sql')
    print('\nPipeline finalizado.')
    print(f'- SQLite: {seed}')
    print(f'- GeoPackage: {gpkg}')
    print(f'- Diagnóstico: {diag_md}')


if __name__ == '__main__':
    main()
