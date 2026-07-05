from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import geopandas as gpd
import pandas as pd
import pyogrio

VERSION = "v5_1_map_ready_cloudflare_fix"
NATIONAL_POPULATION_EXPECTED = 45_892_285
CF_SINGLE_ASSET_LIMIT_MIB = 25.0
CF_WARN_MIB = 15.0
CF_PREDEPLOY_WARN_MIB = 20.0
COORDINATE_PRECISION = 6


def slugify(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-zA-Z0-9]+", "_", text.lower()).strip("_")
    return text or "sin_nombre"


def safe_int(value: Any, default: int = 0) -> int:
    try:
        if pd.isna(value):
            return default
        return int(round(float(value)))
    except Exception:
        return default


def size_info(path: Path) -> dict[str, Any]:
    return {
        "size_bytes": path.stat().st_size,
        "size_mib": round(path.stat().st_size / 1024 / 1024, 3),
        "size_mb": round(path.stat().st_size / 1024 / 1024, 3),
    }


def rel_to_data(path: Path, data_dir: Path) -> str:
    return path.relative_to(data_dir).as_posix()


def export_geojson(gdf: gpd.GeoDataFrame, out_path: Path) -> dict[str, Any]:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()
    pyogrio.write_dataframe(
        gdf,
        out_path,
        driver="GeoJSON",
        layer_options={"COORDINATE_PRECISION": str(COORDINATE_PRECISION)},
    )
    return size_info(out_path)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def run_base_v5_export(args: argparse.Namespace, temp_diag_json: Path, temp_diag_md: Path) -> None:
    script = Path(__file__).with_name("export_map_ready_v5.py")
    cmd = [
        sys.executable,
        str(script),
        "--input",
        args.input,
        "--out-dir",
        args.out_dir,
        "--diag-md",
        str(temp_diag_md),
        "--diag-json",
        str(temp_diag_json),
        "--previews-dir",
        args.previews_dir,
    ]
    if args.skip_previews:
        cmd.append("--skip-previews")
    subprocess.run(cmd, check=True)


def build_department_lookup(data_dir: Path) -> dict[str, dict[str, Any]]:
    dept_path = data_dir / "provincias" / "provincia_06_buenos_aires" / "departamentos.geojson"
    if not dept_path.exists():
        raise FileNotFoundError(f"No existe departamentos de Buenos Aires: {dept_path}")
    deps = gpd.read_file(dept_path)
    lookup: dict[str, dict[str, Any]] = {}
    for _, row in deps.iterrows():
        dept_id = str(row.get("id_entidad") or row.get("departamento_id") or "").strip()
        if not dept_id:
            continue
        codigo = str(row.get("codigo_indec") or row.get("codigo_georef") or re.sub(r"\D", "", dept_id)).zfill(5)
        lookup[dept_id] = {
            "departamento_id": dept_id,
            "departamento_codigo": codigo,
            "departamento_nombre": str(row.get("nombre") or row.get("nombre_normalizado") or dept_id),
            "departamento_population_sum": safe_int(row.get("poblacion_total")),
        }
    return lookup


def partition_buenos_aires_radios(data_dir: Path) -> dict[str, Any]:
    ba_folder = data_dir / "provincias" / "provincia_06_buenos_aires"
    radios_path = ba_folder / "radios.geojson"
    radios_dir = ba_folder / "radios"
    index_path = radios_dir / "index.json"

    if not radios_path.exists() and index_path.exists():
        # Idempotent mode: rebuild summary from existing index.
        return load_json(index_path)
    if not radios_path.exists():
        raise FileNotFoundError(f"No existe radios monolítico de Buenos Aires para particionar: {radios_path}")

    dept_lookup = build_department_lookup(data_dir)
    radios = gpd.read_file(radios_path)
    radios = radios.copy()
    radios["departamento_id"] = radios["departamento_id"].astype(str)

    def dept_codigo(dept_id: str) -> str:
        meta = dept_lookup.get(dept_id, {})
        return str(meta.get("departamento_codigo") or re.sub(r"\D", "", dept_id)).zfill(5)

    def dept_nombre(dept_id: str) -> str:
        meta = dept_lookup.get(dept_id, {})
        return str(meta.get("departamento_nombre") or dept_id or "sin_departamento")

    radios["departamento_codigo"] = radios["departamento_id"].map(dept_codigo)
    radios["departamento_nombre"] = radios["departamento_id"].map(dept_nombre)
    radios["loading_strategy"] = "Cargar radios de Buenos Aires por departamento/partido mediante radios/index.json."

    if radios_dir.exists():
        for old in radios_dir.glob("*.geojson"):
            old.unlink()
        if index_path.exists():
            index_path.unlink()
    radios_dir.mkdir(parents=True, exist_ok=True)

    files: list[dict[str, Any]] = []
    group_cols = ["departamento_codigo", "departamento_nombre", "departamento_id"]
    grouped = radios.sort_values(["departamento_codigo", "id_entidad"]).groupby(group_cols, dropna=False)
    for (codigo, nombre, dept_id), subset in grouped:
        codigo = str(codigo).zfill(5)
        nombre = str(nombre or "sin_nombre")
        dept_id = str(dept_id or f"departamento:{codigo}")
        file_name = f"d_{codigo}.geojson"
        out_path = radios_dir / file_name
        info = export_geojson(subset, out_path)
        files.append(
            {
                "departamento_id": dept_id,
                "departamento_codigo": codigo,
                "departamento_nombre": nombre,
                "relative_path": rel_to_data(out_path, data_dir),
                "feature_count": int(len(subset)),
                "population_sum": safe_int(pd.to_numeric(subset["poblacion_total"], errors="coerce").fillna(0).sum()),
                "size_bytes": info["size_bytes"],
                "size_mb": info["size_mb"],
            }
        )

    original_info = size_info(radios_path)
    original_feature_count = int(len(radios))
    original_population_sum = safe_int(pd.to_numeric(radios["poblacion_total"], errors="coerce").fillna(0).sum())
    max_file = max(files, key=lambda item: item["size_bytes"]) if files else None
    index = {
        "version": VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "layer_id": "radios",
        "provincia_id": "provincia:06",
        "provincia_codigo": "06",
        "provincia_nombre": "Buenos Aires",
        "partition_strategy": "departamento_partido",
        "original_monolithic_relative_path": rel_to_data(radios_path, data_dir),
        "original_monolithic_size_mb": original_info["size_mb"],
        "monolithic_file_removed_from_public": True,
        "total_features": original_feature_count,
        "total_population": original_population_sum,
        "partition_count": len(files),
        "max_partition_size_mb": max_file["size_mb"] if max_file else 0,
        "max_partition_relative_path": max_file["relative_path"] if max_file else None,
        "files": files,
        "usage_frontend": "Después de seleccionar Buenos Aires y un departamento/partido, cargar el GeoJSON correspondiente desde este índice.",
        "cloudflare_note": "Ningún partido queda como asset monolítico provincial mayor a 25 MiB. Los archivos usan nombres cortos d_<codigo>.geojson para evitar rutas largas en Windows.",
    }
    write_json(index_path, index)
    radios_path.unlink()
    return index


def remove_national_points_and_index(data_dir: Path, metadata: dict[str, Any]) -> dict[str, Any]:
    points_path = data_dir / "localidades_puntos.geojson"
    original: dict[str, Any] = {
        "layer_id": "localidades_puntos",
        "national_file_removed_from_public": False,
        "reason": "El archivo nacional no existía al aplicar V5.1.",
    }
    if points_path.exists():
        original = {
            "layer_id": "localidades_puntos",
            "national_file_removed_from_public": True,
            "original_relative_path": rel_to_data(points_path, data_dir),
            "original_size_mb": size_info(points_path)["size_mb"],
            "reason": "Archivo nacional cercano al límite de Cloudflare; los puntos se conservan completos por provincia.",
        }
        points_path.unlink()

    point_splits = [s for s in metadata.get("province_splits", []) if s.get("layer_id") == "localidades_puntos"]
    index = {
        "version": VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "layer_id": "localidades_puntos",
        "partition_strategy": "provincia",
        "national_file_removed_from_public": original.get("national_file_removed_from_public", False),
        "original_size_mb": original.get("original_size_mb"),
        "total_features": sum(int(s.get("feature_count", 0)) for s in point_splits),
        "total_population": sum(int(s.get("population_sum", 0)) for s in point_splits),
        "files": point_splits,
        "usage_frontend": "Usar puntos por provincia para clusters, tooltips y heatmap. No cargar un archivo nacional por defecto.",
    }
    write_json(data_dir / "indexes" / "localidades_puntos_index.json", index)
    return {"original": original, "index": index}


def update_layer_metadata(metadata: dict[str, Any], layer_id: str, **updates: Any) -> None:
    for layer in metadata.get("layers", []):
        if layer.get("layer_id") == layer_id:
            layer.update(updates)
            return
    raise KeyError(f"No se encontró layer_id en metadata: {layer_id}")


def rebuild_indexes(data_dir: Path, metadata: dict[str, Any]) -> None:
    indexes_dir = data_dir / "indexes"
    indexes_dir.mkdir(parents=True, exist_ok=True)

    layers_index = {
        "version": metadata["version"],
        "generated_at": metadata["generated_at"],
        "cloudflare_single_asset_limit_mib": CF_SINGLE_ASSET_LIMIT_MIB,
        "layers": [
            {
                "layer_id": layer["layer_id"],
                "relative_path": layer.get("relative_path"),
                "national_export": layer.get("national_export", True),
                "partitioned": bool(layer.get("partitioning")),
                "partitioning": layer.get("partitioning"),
                "aditiva": layer["aditiva"],
                "no_aditiva": layer["no_aditiva"],
                "feature_count": layer["feature_count"],
                "size_mb": layer.get("size_mb", 0),
                "usage": layer["usage"],
                "loading_strategy": layer["loading_strategy"],
            }
            for layer in metadata.get("layers", [])
        ],
    }
    write_json(indexes_dir / "layers_index.json", layers_index)

    provinces_index: dict[str, Any] = {
        "version": metadata["version"],
        "generated_at": metadata["generated_at"],
        "cloudflare_single_asset_limit_mib": CF_SINGLE_ASSET_LIMIT_MIB,
        "provinces": {},
    }
    for split in metadata.get("province_splits", []):
        province_key = split["provincia_id"]
        provinces_index["provinces"].setdefault(
            province_key,
            {
                "provincia_id": split["provincia_id"],
                "provincia_codigo": split["provincia_codigo"],
                "provincia_nombre": split["provincia_nombre"],
                "folder": str(Path(split["relative_path"]).parent).replace("\\", "/"),
                "layers": {},
            },
        )
        provinces_index["provinces"][province_key]["layers"][split["layer_id"]] = {
            "relative_path": split["relative_path"],
            "feature_count": split["feature_count"],
            "population_sum": split["population_sum"],
            "size_mb": split["size_mb"],
        }

    for part in metadata.get("partitioned_splits", []):
        province_key = part["provincia_id"]
        provinces_index["provinces"].setdefault(
            province_key,
            {
                "provincia_id": part["provincia_id"],
                "provincia_codigo": part["provincia_codigo"],
                "provincia_nombre": part["provincia_nombre"],
                "folder": str(Path(part["index_relative_path"]).parent.parent).replace("\\", "/"),
                "layers": {},
            },
        )
        provinces_index["provinces"][province_key]["layers"][part["layer_id"]] = {
            "partitioned": True,
            "partition_strategy": part["partition_strategy"],
            "index_relative_path": part["index_relative_path"],
            "feature_count": part["feature_count"],
            "population_sum": part["population_sum"],
            "partition_count": part["partition_count"],
            "max_partition_size_mb": part["max_partition_size_mb"],
        }

    write_json(indexes_dir / "provincias_index.json", provinces_index)


def scan_public_files(public_dir: Path) -> dict[str, Any]:
    files = []
    for path in public_dir.rglob("*"):
        if not path.is_file():
            continue
        info = size_info(path)
        rel = path.relative_to(public_dir).as_posix()
        files.append({"relative_path": rel, **info})
    files.sort(key=lambda item: item["size_bytes"], reverse=True)
    too_large = [f for f in files if f["size_mib"] > CF_SINGLE_ASSET_LIMIT_MIB]
    warn_20 = [f for f in files if CF_PREDEPLOY_WARN_MIB < f["size_mib"] <= CF_SINGLE_ASSET_LIMIT_MIB]
    warn_15 = [f for f in files if CF_WARN_MIB < f["size_mib"] <= CF_PREDEPLOY_WARN_MIB]
    return {
        "file_count": len(files),
        "max_file": files[0] if files else None,
        "files_over_25_mib": too_large,
        "files_between_20_and_25_mib": warn_20,
        "files_between_15_and_20_mib": warn_15,
        "top_20_files": files[:20],
    }


def render_markdown(metadata: dict[str, Any], diag_md: Path) -> None:
    audit = metadata.get("public_file_audit", {})
    ba = metadata.get("v5_1_fixes", {}).get("buenos_aires_radios_partition", {})
    points = metadata.get("v5_1_fixes", {}).get("localidades_puntos_partition", {})
    rows = []
    for layer in metadata.get("layers", []):
        rows.append(
            {
                "layer": layer.get("layer_id"),
                "archivo_nacional": layer.get("relative_path") or "no publicado/indexado",
                "features": layer.get("feature_count"),
                "size_mb": layer.get("size_mb"),
                "aditiva": layer.get("aditiva"),
                "pop_sum": layer.get("population_sum"),
                "loading": layer.get("loading_strategy"),
            }
        )
    df = pd.DataFrame(rows)
    top = pd.DataFrame(audit.get("top_20_files", []))

    md: list[str] = []
    md.append("# Diagnóstico Map Ready V5.1 — Cloudflare Fix\n\n")
    md.append(f"Generado: {metadata.get('generated_at')}\n\n")
    md.append(f"Estado final del export V5.1: **{metadata.get('status')}**\n\n")
    md.append("## Objetivo\n\n")
    md.append("La V5.1 corrige la V5 Map Ready para que los assets publicados en `public/` sean compatibles con Cloudflare Pages Free, sin avanzar a V6 y sin modificar la lógica censal validada.\n\n")
    md.append("## Problema corregido\n\n")
    md.append("- Archivo problemático V5: `public/data/provincias/provincia_06_buenos_aires/radios.geojson`.\n")
    md.append(f"- Peso original: `{ba.get('original_monolithic_size_mb')} MB`.\n")
    md.append("- Corrección: partición de radios censales de Buenos Aires por departamento/partido con nombres cortos `d_<codigo>.geojson` para evitar rutas largas en Windows.\n")
    md.append(f"- Particiones generadas: `{ba.get('partition_count')}`.\n")
    md.append(f"- Radios conservados: `{ba.get('total_features')}`.\n")
    md.append(f"- Población conservada: `{ba.get('total_population')}`.\n")
    md.append(f"- Peso máximo de partición: `{ba.get('max_partition_size_mb')} MB`.\n")
    md.append(f"- Índice: `{ba.get('index_relative_path')}`.\n\n")
    md.append("## Corrección preventiva\n\n")
    md.append("- `localidades_puntos.geojson` nacional se retiró del bundle público como archivo monolítico.\n")
    md.append(f"- Peso original: `{points.get('original', {}).get('original_size_mb')} MB`.\n")
    md.append("- Los puntos se conservan completos por provincia y se indexan en `public/data/indexes/localidades_puntos_index.json`.\n\n")
    md.append("## Capas principales\n\n")
    md.append(df.to_markdown(index=False) if not df.empty else "Sin capas registradas.")
    md.append("\n\n## Auditoría de archivos en public/\n\n")
    md.append(f"- Cantidad de archivos en `public/`: `{audit.get('file_count')}`.\n")
    max_file = audit.get("max_file") or {}
    md.append(f"- Archivo más pesado: `{max_file.get('relative_path')}` — `{max_file.get('size_mib')} MiB`.\n")
    md.append(f"- Archivos > 25 MiB: `{len(audit.get('files_over_25_mib', []))}`.\n")
    md.append(f"- Archivos entre 20 y 25 MiB: `{len(audit.get('files_between_20_and_25_mib', []))}`.\n")
    md.append(f"- Archivos entre 15 y 20 MiB: `{len(audit.get('files_between_15_and_20_mib', []))}`.\n\n")
    if not top.empty:
        md.append("### Top archivos por peso\n\n")
        md.append(top[["relative_path", "size_mib", "size_bytes"]].to_markdown(index=False))
        md.append("\n")
    md.append("\n## Reglas de carga recomendadas\n\n")
    md.append("- Vista nacional: `provincias.geojson`.\n")
    md.append("- Click en provincia: usar `provincias/<provincia>/departamentos.geojson`.\n")
    md.append("- Zoom alto: usar fracciones por provincia o radios bajo demanda.\n")
    md.append("- Buenos Aires radios: usar `provincias/provincia_06_buenos_aires/radios/index.json` y cargar un partido/departamento por vez.\n")
    md.append("- Puntos/localidades: usar `indexes/localidades_puntos_index.json` y archivos `puntos.geojson` por provincia.\n")
    md.append("- Coroplético: usar una sola jerarquía aditiva por vez.\n\n")
    md.append("## Errores\n\n")
    if metadata.get("errors"):
        for e in metadata["errors"]:
            md.append(f"- ERROR: {e}\n")
    else:
        md.append("- Sin errores bloqueantes.\n")
    md.append("\n## Advertencias\n\n")
    if metadata.get("warnings"):
        for w in metadata["warnings"]:
            md.append(f"- WARN: {w}\n")
    else:
        md.append("- Sin advertencias.\n")
    md.append("\n## Resultado\n\n")
    md.append("V5.1 queda limitada a corrección Cloudflare. No se generaron clientes ficticios, ventas ni frontend completo.\n")
    diag_md.parent.mkdir(parents=True, exist_ok=True)
    diag_md.write_text("".join(md), encoding="utf-8")


def apply_v5_1_fixes(data_dir: Path, metadata: dict[str, Any], diag_json: Path, diag_md: Path) -> dict[str, Any]:
    metadata = dict(metadata)
    metadata["version"] = VERSION
    metadata["generated_at"] = datetime.now(timezone.utc).isoformat()
    metadata["status"] = "OK"
    metadata["warnings"] = []
    metadata["errors"] = []
    metadata["phase"] = "V5.1 Map Ready Cloudflare Fix"
    metadata["no_phase_advance"] = "No se avanzó a V6; no se generaron clientes ficticios, ventas ni frontend completo."
    metadata["file_size_policy"] = {
        "cloudflare_pages_single_asset_limit_mib": CF_SINGLE_ASSET_LIMIT_MIB,
        "warn_mib": CF_WARN_MIB,
        "predeploy_warn_mib": CF_PREDEPLOY_WARN_MIB,
        "strategy": "Publicar assets por provincia/departamento cuando un archivo se acerque o supere el límite de Cloudflare Pages.",
    }
    metadata["recommended_flow"] = {
        "vista_nacional": "provincias.geojson",
        "click_provincia": "provincias/<provincia>/departamentos.geojson",
        "zoom_intermedio": "gobiernos_locales/municipios por provincia, no aditivos",
        "zoom_alto": "fracciones por provincia; radios por provincia o por departamento/partido en Buenos Aires",
        "puntos_clusters_heatmap": "indexes/localidades_puntos_index.json y puntos.geojson por provincia",
        "coropletico": "una sola jerarquía aditiva a la vez",
    }

    ba_index = partition_buenos_aires_radios(data_dir)
    points_info = remove_national_points_and_index(data_dir, metadata)

    # Remove monolithic BA radios split from normal province_splits. It is replaced by partitioned_splits.
    old_splits = metadata.get("province_splits", [])
    metadata["province_splits"] = [
        s for s in old_splits if not (s.get("layer_id") == "radios" and s.get("provincia_id") == "provincia:06")
    ]
    metadata["partitioned_splits"] = [
        {
            "layer_id": "radios",
            "provincia_id": "provincia:06",
            "provincia_codigo": "06",
            "provincia_nombre": "Buenos Aires",
            "partition_strategy": ba_index["partition_strategy"],
            "index_relative_path": "provincias/provincia_06_buenos_aires/radios/index.json",
            "feature_count": ba_index["total_features"],
            "population_sum": ba_index["total_population"],
            "partition_count": ba_index["partition_count"],
            "max_partition_size_mb": ba_index["max_partition_size_mb"],
            "files": ba_index["files"],
        }
    ]

    update_layer_metadata(
        metadata,
        "radios",
        loading_strategy="Cargar por provincia bajo demanda. Para Buenos Aires, cargar radios por departamento/partido desde provincias/provincia_06_buenos_aires/radios/index.json.",
        notes="V5.1 reemplaza el split provincial monolítico de Buenos Aires por particiones por departamento/partido para Cloudflare Pages Free.",
        partitioning={
            "enabled": True,
            "province:06": {
                "strategy": "departamento_partido",
                "index_relative_path": "provincias/provincia_06_buenos_aires/radios/index.json",
                "partition_count": ba_index["partition_count"],
                "max_partition_size_mb": ba_index["max_partition_size_mb"],
            },
        },
    )
    update_layer_metadata(
        metadata,
        "localidades_puntos",
        national_export=False,
        relative_path=None,
        output_file=None,
        size_bytes=0,
        size_mb=0,
        loading_strategy="No publicar/cargar archivo nacional. Usar indexes/localidades_puntos_index.json y puntos.geojson por provincia.",
        notes="V5.1 retira el GeoJSON nacional de puntos por margen Cloudflare; los datos se conservan en splits provinciales.",
        partitioning={
            "enabled": True,
            "strategy": "provincia",
            "index_relative_path": "indexes/localidades_puntos_index.json",
        },
    )

    metadata["v5_1_fixes"] = {
        "buenos_aires_radios_partition": {
            **{k: v for k, v in ba_index.items() if k != "files"},
            "index_relative_path": "provincias/provincia_06_buenos_aires/radios/index.json",
        },
        "localidades_puntos_partition": points_info,
    }

    rebuild_indexes(data_dir, metadata)
    public_dir = data_dir.parent
    audit = scan_public_files(public_dir)
    metadata["public_file_audit"] = audit

    for item in audit["files_over_25_mib"]:
        metadata["errors"].append(f"Archivo supera 25 MiB: {item['relative_path']} ({item['size_mib']} MiB)")
    for item in audit["files_between_20_and_25_mib"]:
        metadata["warnings"].append(f"Archivo entre 20 y 25 MiB: {item['relative_path']} ({item['size_mib']} MiB)")
    for item in audit["files_between_15_and_20_mib"]:
        metadata["warnings"].append(f"Archivo entre 15 y 20 MiB: {item['relative_path']} ({item['size_mib']} MiB)")

    # Validate preserved population/count for BA radios.
    part_feature_sum = sum(int(f["feature_count"]) for f in ba_index["files"])
    part_pop_sum = sum(int(f["population_sum"]) for f in ba_index["files"])
    if part_feature_sum != ba_index["total_features"]:
        metadata["errors"].append(f"Particiones BA radios no conservan features: {part_feature_sum} vs {ba_index['total_features']}")
    if part_pop_sum != ba_index["total_population"]:
        metadata["errors"].append(f"Particiones BA radios no conservan población: {part_pop_sum} vs {ba_index['total_population']}")

    metadata["status"] = "ERROR" if metadata["errors"] else ("WARN" if metadata["warnings"] else "OK")
    metadata["metadata_files"] = {
        "metadata": "public/data/metadata.json",
        "layers_index": "public/data/indexes/layers_index.json",
        "provinces_index": "public/data/indexes/provincias_index.json",
        "localidades_puntos_index": "public/data/indexes/localidades_puntos_index.json",
        "buenos_aires_radios_index": "public/data/provincias/provincia_06_buenos_aires/radios/index.json",
    }

    write_json(data_dir / "metadata.json", metadata)
    write_json(diag_json, metadata)
    render_markdown(metadata, diag_md)
    write_public_readme(data_dir)
    return metadata


def write_public_readme(data_dir: Path) -> None:
    text = """# public/data — V5.1 Map Ready Cloudflare Fix

Esta carpeta contiene los GeoJSON listos para consumir desde un frontend estático compatible con Cloudflare Pages Free.

Regla principal: **no mezclar capas superpuestas para sumar población**.

## Carga recomendada

- `provincias.geojson`: vista nacional y coroplético provincial.
- `localidades_poligonos_departamentos.geojson`: drill-down nacional liviano; preferir splits por provincia luego del click.
- `localidades_poligonos_fracciones.geojson`: zoom alto; no cargar por defecto si no hace falta.
- Radios censales: no existe GeoJSON nacional. Se cargan por provincia; en Buenos Aires se cargan por departamento/partido usando `provincias/provincia_06_buenos_aires/radios/index.json`.
- Puntos/localidades: usar `indexes/localidades_puntos_index.json` y `provincias/<provincia>/puntos.geojson`.
- Gobiernos locales, municipios y aglomerados: render layers no aditivas.

## Cloudflare

V5.1 garantiza que ningún archivo dentro de `public/` supere 25 MiB. Los archivos mayores a 15 MiB deben tratarse como advertencia preventiva.
"""
    (data_dir / "README_PUBLIC_DATA.md").write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera V5.1 Map Ready Cloudflare Fix desde V5 Map Ready.")
    parser.add_argument("--input", default="data/output/arg_geo_censo_census_ready_v4.gpkg", help="GeoPackage census-ready V4.")
    parser.add_argument("--out-dir", default="public/data", help="Directorio public/data.")
    parser.add_argument("--diag-md", default="data/output/diagnostico_map_ready_v5_1.md", help="Diagnóstico Markdown V5.1.")
    parser.add_argument("--diag-json", default="data/output/diagnostico_map_ready_v5_1.json", help="Diagnóstico JSON V5.1.")
    parser.add_argument("--previews-dir", default="public/previews", help="Directorio de previews.")
    parser.add_argument("--skip-base-export", action="store_true", help="Usa salidas V5 existentes y solo aplica correcciones V5.1.")
    parser.add_argument("--skip-previews", action="store_true", help="No regenerar previews al correr export base V5.")
    args = parser.parse_args()

    data_dir = Path(args.out_dir)
    diag_md = Path(args.diag_md)
    diag_json = Path(args.diag_json)
    temp_diag_json = Path("data/output/_diagnostico_map_ready_v5_base_tmp.json")
    temp_diag_md = Path("data/output/_diagnostico_map_ready_v5_base_tmp.md")

    if not args.skip_base_export:
        run_base_v5_export(args, temp_diag_json, temp_diag_md)
        base_metadata = load_json(temp_diag_json)
    else:
        candidate = data_dir / "metadata.json"
        if not candidate.exists():
            raise SystemExit(f"ERROR: --skip-base-export requiere metadata V5 existente en {candidate}")
        base_metadata = load_json(candidate)

    metadata = apply_v5_1_fixes(data_dir, base_metadata, diag_json, diag_md)
    print(f"Export V5.1 finalizado con estado {metadata['status']}")
    print(f"Metadata: {data_dir / 'metadata.json'}")
    print(f"Diagnóstico MD: {diag_md}")
    print(f"Diagnóstico JSON: {diag_json}")
    max_file = metadata.get("public_file_audit", {}).get("max_file") or {}
    print(f"Archivo público más pesado: {max_file.get('relative_path')} ({max_file.get('size_mib')} MiB)")
    if metadata["errors"]:
        for err in metadata["errors"]:
            print(f"ERROR: {err}")
        raise SystemExit(2)
    if metadata["warnings"]:
        for warn in metadata["warnings"]:
            print(f"WARN: {warn}")


if __name__ == "__main__":
    main()
