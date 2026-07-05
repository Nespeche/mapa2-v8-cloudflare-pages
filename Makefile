.PHONY: seed download gpkg diagnose full postgis validate codgeo census-ready check-census map-ready-v5-1 check-map-ready-v5-1 sizes-v5-1 business-v6 check-business-v6 sizes-v6

seed:
	python src/create_seed_sqlite.py --seed-dir data/semilla --out data/output/arg_geo_censo_semilla.sqlite

download:
	python src/download_sources.py --config config/sources.yml --raw-dir data/raw

gpkg: seed
	python src/build_full_gpkg.py --config config/sources.yml --raw-dir data/raw --seed-db data/output/arg_geo_censo_semilla.sqlite --out data/output/arg_geo_censo_full.gpkg

diagnose:
	python src/diagnose_and_align.py --sqlite data/output/arg_geo_censo_semilla.sqlite --gpkg data/output/arg_geo_censo_full.gpkg --out-md data/output/diagnostico_alineacion.md --out-json data/output/diagnostico_alineacion.json

full:
	python src/run_full_pipeline.py

codgeo:
	python src/import_codgeo_2022.py --input-dir data/raw/indec/codgeo_2022 --sqlite data/output/arg_geo_censo_semilla.sqlite --upsert-entidades

postgis: seed
	python src/build_postgis.py --config config/sources.yml --raw-dir data/raw --seed-db data/output/arg_geo_censo_semilla.sqlite --database-url "$${DATABASE_URL}" --replace-spatial
	psql "$${DATABASE_URL}" -f sql/02_diagnostico_postgis.sql

validate:
	python src/validate_base.py --sqlite data/output/arg_geo_censo_semilla.sqlite --raw-dir data/raw

census-ready:
	python src/enrich_census_and_localidades.py --input data/output/arg_geo_censo_full.gpkg --out data/output/arg_geo_censo_census_ready_v4.gpkg --diag-md data/output/diagnostico_censo_geometria_v4.md --diag-json data/output/diagnostico_censo_geometria_v4.json

check-census:
	python src/check_census_ready.py --gpkg data/output/arg_geo_censo_census_ready_v4.gpkg

map-ready-v5-1:
	python src/export_map_ready_v5_1.py --input data/output/arg_geo_censo_census_ready_v4.gpkg --out-dir public/data --diag-md data/output/diagnostico_map_ready_v5_1.md --diag-json data/output/diagnostico_map_ready_v5_1.json

check-map-ready-v5-1:
	python src/check_map_ready_v5_1.py --data-dir public/data --diag data/output/diagnostico_map_ready_v5_1.json --out data/output/check_map_ready_v5_1.txt

sizes-v5-1:
	python -c "from pathlib import Path; rows=sorted([(p.stat().st_size,p) for p in Path('public/data').rglob('*') if p.is_file()], reverse=True); out=Path('data/output/v5_1_file_sizes.txt'); out.parent.mkdir(parents=True, exist_ok=True); out.write_text('V5.1 file sizes - public/data\nsize_bytes\tsize_mib\trelative_path\n' + ''.join(f'{s}\t{s/1024/1024:.3f}\t{p.as_posix()}\n' for s,p in rows), encoding='utf-8'); print(f'wrote {out}')"

business-v6:
	python src/generate_business_v6.py --base-data public/data --out-data data/output/business_v6 --public-out public/data/business --diag-md data/output/diagnostico_business_v6.md --diag-json data/output/diagnostico_business_v6.json --seed 20260705

check-business-v6:
	python src/check_business_v6.py --base-data public/data --business-data public/data/business --diag data/output/diagnostico_business_v6.json --out data/output/check_business_v6.txt

sizes-v6:
	python -c "from pathlib import Path; rows=sorted([(p.stat().st_size,p) for p in Path('public/data').rglob('*') if p.is_file()], reverse=True); out=Path('data/output/v6_file_sizes.txt'); out.parent.mkdir(parents=True, exist_ok=True); out.write_text('V6 file sizes - public/data\nsize_bytes\tsize_mib\trelative_path\n' + ''.join(f'{s}\t{s/1024/1024:.3f}\t{p.as_posix()}\n' for s,p in rows), encoding='utf-8'); print(f'wrote {out}')"
