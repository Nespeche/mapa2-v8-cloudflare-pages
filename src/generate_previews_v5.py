from __future__ import annotations

import argparse
import json
from pathlib import Path

import geopandas as gpd
import matplotlib.pyplot as plt


def save_polygon_preview(gdf: gpd.GeoDataFrame, out: Path, title: str) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(9, 9))
    gdf.plot(ax=ax, column="poblacion_total", legend=True, linewidth=0.2, edgecolor="black")
    ax.set_axis_off()
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(out, dpi=160)
    plt.close(fig)


def save_points_preview(points: gpd.GeoDataFrame, out: Path, title: str) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(9, 9))
    points = points[points.geometry.notna() & ~points.geometry.is_empty].copy()
    ax.scatter(points.geometry.x, points.geometry.y, s=1, alpha=0.7)
    ax.set_axis_off()
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(out, dpi=160)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera previews estáticas V5 desde public/data.")
    parser.add_argument("--data-dir", default="public/data")
    parser.add_argument("--previews-dir", default="public/previews")
    parser.add_argument("--metadata", default="public/data/metadata.json")
    parser.add_argument("--diag-json", default="data/output/diagnostico_map_ready_v5.json")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    previews_dir = Path(args.previews_dir)
    results = []

    try:
        provincias = gpd.read_file(data_dir / "provincias.geojson")
        out = previews_dir / "v5_coropletico_argentina_provincias.png"
        save_polygon_preview(provincias, out, "V5 provincias")
        results.append({"file": str(out).replace("\\", "/"), "status": "OK"})
    except Exception as exc:
        results.append({"file": "public/previews/v5_coropletico_argentina_provincias.png", "status": "WARN", "message": str(exc)})

    try:
        departamentos = gpd.read_file(data_dir / "localidades_poligonos_departamentos.geojson")
        ba = departamentos[departamentos["provincia_id"] == "provincia:06"].copy()
        out = previews_dir / "v5_coropletico_buenos_aires_departamentos.png"
        save_polygon_preview(ba, out, "V5 Buenos Aires departamentos")
        results.append({"file": str(out).replace("\\", "/"), "status": "OK"})
    except Exception as exc:
        results.append({"file": "public/previews/v5_coropletico_buenos_aires_departamentos.png", "status": "WARN", "message": str(exc)})

    try:
        puntos = gpd.read_file(data_dir / "localidades_puntos.geojson")
        ba_points = puntos[puntos["provincia_id"] == "provincia:06"].copy()
        out = previews_dir / "v5_puntos_localidades_buenos_aires.png"
        save_points_preview(ba_points, out, "V5 Buenos Aires puntos")
        results.append({"file": str(out).replace("\\", "/"), "status": "OK"})
    except Exception as exc:
        results.append({"file": "public/previews/v5_puntos_localidades_buenos_aires.png", "status": "WARN", "message": str(exc)})

    for path_value in [args.metadata, args.diag_json]:
        path = Path(path_value)
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            data["previews"] = results
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({"previews": results}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
