#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mapa2 V6 — generación reproducible de base comercial sintética de autopartes.

Alcance:
- No modifica la base censal ni las capas geográficas V5.1.
- Usa índices y puntos existentes en public/data para ubicar clientes ficticios.
- Exporta datos comerciales para pruebas de frontend V7.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

VERSION = "v6_business_synthetic_autoparts"
PHASE = "V6 — Base ficticia de clientes y ventas de autopartes"
DEFAULT_SEED = 20260705
CLIENT_TARGET = 2000
ARG_BBOX = {"lon_min": -74.2, "lon_max": -52.0, "lat_min": -56.2, "lat_max": -21.0}

PROVINCE_TARGETS = {
    "provincia:06": 1400,  # Buenos Aires — 70%
    "provincia:02": 160,   # CABA — 8%
    "provincia:14": 130,   # Córdoba — 6.5%
    "provincia:82": 120,   # Santa Fe — 6%
    "provincia:50": 50,    # Mendoza — 2.5%
    "provincia:30": 40,    # Entre Ríos — 2%
    "provincia:90": 35,    # Tucumán — 1.75%
    "provincia:58": 20,    # Neuquén — 1%
    "provincia:66": 20,    # Salta — 1%
    "provincia:62": 15,    # Río Negro — 0.75%
    "provincia:74": 10,    # San Luis — 0.5%
}

AMBA_DEPARTAMENTOS = {
    "almirante brown", "avellaneda", "berazategui", "berisso", "brandsen", "campana",
    "canuelas", "cañuelas", "ensenada", "escobar", "esteban echeverria", "esteban echeverría",
    "ezeiza", "exaltacion de la cruz", "exaltación de la cruz", "florencio varela",
    "general las heras", "general rodriguez", "general san martin", "general san martín",
    "hurlingham", "ituzaingo", "ituzaingó", "jose c paz", "josé c. paz", "jose c. paz",
    "la matanza", "la plata", "lanus", "lanús", "lomas de zamora", "lujan", "luján",
    "malvinas argentinas", "marcos paz", "merlo", "moreno", "moron", "morón", "pilar",
    "presidente peron", "presidente perón", "quilmes", "san fernando", "san isidro",
    "san miguel", "san vicente", "tigre", "tres de febrero", "vicente lopez", "vicente lópez",
    "zarate", "zárate",
}

CLIENT_TYPES = [
    "Casa de repuestos",
    "Taller mecánico",
    "Distribuidor mayorista",
    "Concesionario",
    "Lubricentro",
    "Rectificadora",
    "Flota comercial",
    "Servicio técnico",
]

CLIENT_TYPE_WEIGHTS = {
    "Casa de repuestos": 0.30,
    "Taller mecánico": 0.26,
    "Distribuidor mayorista": 0.09,
    "Concesionario": 0.08,
    "Lubricentro": 0.12,
    "Rectificadora": 0.05,
    "Flota comercial": 0.05,
    "Servicio técnico": 0.05,
}

SEGMENT_WEIGHTS_BY_TYPE = {
    "Distribuidor mayorista": [("Grande", 0.45), ("Mediano", 0.45), ("Pequeño", 0.10)],
    "Concesionario": [("Grande", 0.30), ("Mediano", 0.50), ("Pequeño", 0.20)],
    "Flota comercial": [("Grande", 0.25), ("Mediano", 0.50), ("Pequeño", 0.25)],
    "Casa de repuestos": [("Grande", 0.12), ("Mediano", 0.52), ("Pequeño", 0.36)],
    "Taller mecánico": [("Grande", 0.06), ("Mediano", 0.40), ("Pequeño", 0.54)],
    "Lubricentro": [("Grande", 0.08), ("Mediano", 0.45), ("Pequeño", 0.47)],
    "Rectificadora": [("Grande", 0.10), ("Mediano", 0.50), ("Pequeño", 0.40)],
    "Servicio técnico": [("Grande", 0.07), ("Mediano", 0.42), ("Pequeño", 0.51)],
}

TYPE_NAME_PREFIX = {
    "Casa de repuestos": ["Repuestos", "Autopartes", "Casa Motor", "RepuCentro"],
    "Taller mecánico": ["Taller", "Mecánica", "Servicio Integral", "Box Motor"],
    "Distribuidor mayorista": ["Distribuidora", "Mayorista", "Red Autopartes", "Centro Logístico"],
    "Concesionario": ["Concesionario", "Automotores", "Ruta Auto", "MotorHaus"],
    "Lubricentro": ["Lubricentro", "LubriMax", "Aceites", "LubriRuta"],
    "Rectificadora": ["Rectificadora", "Motores", "TecnoRectif", "Block Sur"],
    "Flota comercial": ["Flota", "Transporte", "Logística", "Movilidad"],
    "Servicio técnico": ["Servicio Técnico", "ElectroAuto", "Diagnóstico", "AutoService"],
}

NAME_ROOTS = [
    "Austral", "Pampa", "Ruta", "Federal", "Andes", "Sur", "Norte", "Delta", "Río",
    "Platino", "Nexo", "Impulso", "Central", "Fénix", "Tracción", "Vector", "Garage",
    "Dínamo", "Urbano", "Horizonte", "Biela", "Pistón", "Rodar", "Vial",
]

BRANDS = [
    "RotorMax", "PampaDrive", "AndesPart", "FerroRuta", "AustralGear", "RíoParts",
    "NexoMotor", "DeltaFix", "SurMotion", "VectorAuto", "BielaPro", "FederalParts",
]

CATEGORIES: Dict[str, List[Tuple[str, str, float, float, float]]] = {
    # subcategoria, producto, precio_base, peso_kg, margen_base_pct
    "Frenos": [
        ("Pastillas", "Pastillas de freno delanteras", 28500, 1.8, 0.31),
        ("Discos", "Disco de freno ventilado", 52000, 6.5, 0.28),
        ("Campanas", "Campana de freno trasera", 46500, 7.2, 0.27),
        ("Líquidos", "Líquido de frenos DOT 4", 8200, 1.1, 0.36),
        ("Sensores", "Sensor ABS universal", 25500, 0.35, 0.34),
    ],
    "Suspensión": [
        ("Amortiguadores", "Amortiguador delantero", 69000, 5.6, 0.29),
        ("Bujes", "Kit de bujes de parrilla", 23500, 1.2, 0.33),
        ("Parrillas", "Parrilla de suspensión", 78000, 4.8, 0.27),
        ("Espirales", "Espiral reforzado", 61000, 7.0, 0.26),
        ("Cazoletas", "Cazoleta de amortiguador", 31000, 1.5, 0.32),
    ],
    "Filtros": [
        ("Aceite", "Filtro de aceite", 9500, 0.4, 0.39),
        ("Aire", "Filtro de aire", 11500, 0.5, 0.38),
        ("Combustible", "Filtro de combustible", 13600, 0.45, 0.37),
        ("Habitáculo", "Filtro de habitáculo", 10400, 0.35, 0.40),
        ("Kits", "Kit de filtros service", 38500, 1.4, 0.35),
    ],
    "Baterías": [
        ("Livianas", "Batería 12V 55Ah", 119000, 13.8, 0.24),
        ("Medianas", "Batería 12V 75Ah", 159000, 17.2, 0.23),
        ("Pesadas", "Batería utilitario 90Ah", 218000, 21.0, 0.22),
        ("Accesorios", "Borne reforzado", 6200, 0.2, 0.36),
        ("Cargadores", "Cargador inteligente", 72000, 1.3, 0.31),
    ],
    "Lubricantes": [
        ("Aceites", "Aceite sintético 5W30 4L", 42000, 3.9, 0.30),
        ("Aceites", "Aceite mineral 15W40 4L", 28500, 3.9, 0.32),
        ("Transmisión", "Aceite transmisión 75W90", 36000, 1.1, 0.31),
        ("Grasas", "Grasa multipropósito 1Kg", 8500, 1.0, 0.37),
        ("Aditivos", "Aditivo limpia inyectores", 10500, 0.35, 0.38),
    ],
    "Correas": [
        ("Distribución", "Kit correa de distribución", 86500, 2.0, 0.29),
        ("Alternador", "Correa poli V", 18500, 0.35, 0.36),
        ("Tensor", "Tensor de correa", 43000, 0.9, 0.31),
        ("Bomba", "Correa bomba de agua", 15200, 0.3, 0.35),
        ("Kits", "Kit correas service", 112000, 2.8, 0.28),
    ],
    "Embrague": [
        ("Kits", "Kit de embrague", 178000, 7.8, 0.25),
        ("Rulemanes", "Rulemán de empuje", 39500, 0.7, 0.32),
        ("Bombines", "Bombín de embrague", 54500, 1.2, 0.30),
        ("Cables", "Cable de embrague", 24500, 0.8, 0.34),
        ("Platos", "Plato de embrague", 99000, 4.1, 0.26),
    ],
    "Encendido": [
        ("Bujías", "Juego de bujías", 23500, 0.4, 0.36),
        ("Bobinas", "Bobina de encendido", 61000, 0.9, 0.31),
        ("Cables", "Cable de bujías", 28500, 0.6, 0.35),
        ("Sensores", "Sensor de posición", 48000, 0.3, 0.33),
        ("Módulos", "Módulo de encendido", 76000, 0.5, 0.30),
    ],
    "Iluminación": [
        ("Lámparas", "Lámpara halógena H7", 7200, 0.1, 0.42),
        ("LED", "Kit LED alta potencia", 45500, 0.5, 0.35),
        ("Ópticas", "Óptica delantera", 124000, 2.4, 0.26),
        ("Faros", "Faro auxiliar antiniebla", 38500, 0.9, 0.34),
        ("Señalización", "Baliza portátil", 18500, 0.6, 0.37),
    ],
    "Neumáticos": [
        ("Autos", "Neumático 175/65 R14", 128000, 8.5, 0.20),
        ("Autos", "Neumático 195/55 R16", 174000, 9.6, 0.19),
        ("Utilitarios", "Neumático utilitario R15", 218000, 12.5, 0.18),
        ("Balanceo", "Válvula y kit balanceo", 7200, 0.2, 0.38),
        ("Reparación", "Parche radial", 4500, 0.05, 0.45),
    ],
    "Refrigeración": [
        ("Radiadores", "Radiador compacto", 142000, 5.8, 0.24),
        ("Bombas", "Bomba de agua", 78000, 2.6, 0.29),
        ("Termostatos", "Termostato", 25500, 0.35, 0.34),
        ("Mangueras", "Manguera superior radiador", 18500, 0.5, 0.36),
        ("Líquidos", "Refrigerante concentrado 1L", 8800, 1.1, 0.39),
    ],
    "Transmisión": [
        ("Semiejes", "Semieje completo", 156000, 6.2, 0.24),
        ("Homocinéticas", "Junta homocinética", 69500, 2.1, 0.30),
        ("Crapodinas", "Crapodina", 44500, 1.1, 0.31),
        ("Retenes", "Retén transmisión", 12500, 0.15, 0.40),
        ("Soportes", "Soporte de caja", 34000, 1.4, 0.33),
    ],
    "Accesorios": [
        ("Escobillas", "Juego de escobillas", 17500, 0.4, 0.39),
        ("Herramientas", "Kit herramientas emergencia", 28500, 2.2, 0.34),
        ("Interior", "Cubre alfombras universal", 24500, 1.8, 0.35),
        ("Exterior", "Cubre auto liviano", 36500, 2.0, 0.33),
        ("Seguridad", "Matafuego vehicular", 41500, 2.5, 0.31),
    ],
}

CATEGORY_BASE_DEMAND = {
    "Frenos": 1.18,
    "Suspensión": 1.08,
    "Filtros": 1.40,
    "Baterías": 0.88,
    "Lubricantes": 1.46,
    "Correas": 0.88,
    "Embrague": 0.72,
    "Encendido": 0.90,
    "Iluminación": 0.78,
    "Neumáticos": 1.05,
    "Refrigeración": 0.72,
    "Transmisión": 0.66,
    "Accesorios": 0.82,
}

CLIENT_CATEGORY_PREFS = {
    "Casa de repuestos": {"Filtros": 1.35, "Frenos": 1.25, "Lubricantes": 1.20, "Accesorios": 1.15, "Suspensión": 1.10},
    "Taller mecánico": {"Filtros": 1.35, "Frenos": 1.30, "Lubricantes": 1.25, "Correas": 1.15, "Encendido": 1.10},
    "Distribuidor mayorista": {cat: 1.25 for cat in CATEGORIES},
    "Concesionario": {"Frenos": 1.15, "Suspensión": 1.15, "Filtros": 1.20, "Lubricantes": 1.10, "Iluminación": 1.08},
    "Lubricentro": {"Lubricantes": 2.75, "Filtros": 1.65, "Baterías": 1.20, "Accesorios": 1.05},
    "Rectificadora": {"Correas": 1.55, "Embrague": 1.40, "Refrigeración": 1.35, "Transmisión": 1.20, "Encendido": 1.15},
    "Flota comercial": {"Neumáticos": 1.55, "Lubricantes": 1.35, "Filtros": 1.25, "Frenos": 1.20, "Baterías": 1.15},
    "Servicio técnico": {"Encendido": 1.55, "Iluminación": 1.25, "Baterías": 1.20, "Filtros": 1.15, "Accesorios": 1.10},
}

SEASONALITY = {
    1: 0.84,
    2: 0.90,
    3: 1.07,
    4: 1.02,
    5: 1.05,
    6: 1.10,
    7: 1.02,
    8: 1.04,
    9: 1.11,
    10: 1.15,
    11: 1.18,
    12: 1.24,
}

MONTH_NAMES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
    7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
}

BASE_UNITS_BY_TYPE = {
    "Casa de repuestos": 14,
    "Taller mecánico": 7,
    "Distribuidor mayorista": 48,
    "Concesionario": 18,
    "Lubricentro": 12,
    "Rectificadora": 8,
    "Flota comercial": 24,
    "Servicio técnico": 6,
}

SEGMENT_MULTIPLIER = {"Grande": 1.75, "Mediano": 1.00, "Pequeño": 0.48}

PROVINCE_DEMAND_FACTOR = {
    "provincia:06": 1.08,
    "provincia:02": 1.12,
    "provincia:14": 1.04,
    "provincia:82": 1.03,
    "provincia:50": 0.94,
    "provincia:30": 0.90,
    "provincia:90": 0.88,
    "provincia:58": 0.86,
    "provincia:66": 0.86,
    "provincia:62": 0.84,
    "provincia:74": 0.82,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip().lower()
    text = "".join(ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn")
    text = text.replace(".", " ").replace("-", " ")
    return " ".join(text.split())


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def write_csv(path: Path, rows: Sequence[Dict[str, Any]], fieldnames: Sequence[str]) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def weighted_choice(items: Sequence[Any], weights: Sequence[float], rng: random.Random) -> Any:
    total = float(sum(max(0.0, w) for w in weights))
    if total <= 0:
        return items[rng.randrange(len(items))]
    threshold = rng.random() * total
    cumulative = 0.0
    for item, weight in zip(items, weights):
        cumulative += max(0.0, weight)
        if cumulative >= threshold:
            return item
    return items[-1]


@dataclass
class GeoPoint:
    provincia_id: str
    provincia_codigo: str
    provincia_nombre: str
    departamento_id: str
    departamento_nombre: str
    localidad_id: str
    localidad_nombre: str
    lat: float
    lon: float
    poblacion_total: int
    zona_ba: str = ""


def load_departments_for_province(base_data: Path, province_info: Dict[str, Any]) -> Dict[str, str]:
    rel_path = province_info.get("layers", {}).get("departamentos", {}).get("relative_path")
    if not rel_path:
        return {}
    path = base_data / rel_path
    if not path.exists():
        return {}
    gj = read_json(path)
    result = {}
    for feat in gj.get("features", []):
        props = feat.get("properties") or {}
        dept_id = props.get("id_entidad") or props.get("departamento_id") or props.get("codigo_georef")
        name = props.get("nombre") or props.get("tooltip_nombre") or props.get("nombre_normalizado")
        if dept_id and name:
            result[str(dept_id)] = str(name)
    return result


def load_geo_points(base_data: Path, provinces_index: Dict[str, Any]) -> Dict[str, List[GeoPoint]]:
    points_by_province: Dict[str, List[GeoPoint]] = {}
    for provincia_id, province_info in provinces_index.items():
        layers = province_info.get("layers", {})
        rel_path = layers.get("localidades_puntos", {}).get("relative_path")
        if not rel_path:
            continue
        path = base_data / rel_path
        if not path.exists():
            continue
        dept_names = load_departments_for_province(base_data, province_info)
        gj = read_json(path)
        province_points: List[GeoPoint] = []
        for feat in gj.get("features", []):
            geom = feat.get("geometry") or {}
            coords = geom.get("coordinates") or []
            if geom.get("type") != "Point" or len(coords) < 2:
                continue
            lon, lat = float(coords[0]), float(coords[1])
            if not (ARG_BBOX["lon_min"] <= lon <= ARG_BBOX["lon_max"] and ARG_BBOX["lat_min"] <= lat <= ARG_BBOX["lat_max"]):
                continue
            props = feat.get("properties") or {}
            dept_id = str(props.get("departamento_id") or "")
            dept_name = dept_names.get(dept_id) or props.get("departamento_nombre") or props.get("nombre") or "Sin departamento"
            localidad_id = str(props.get("id_entidad") or props.get("localidad_id") or props.get("codigo_georef") or "")
            localidad_nombre = str(props.get("nombre") or props.get("tooltip_nombre") or "Sin localidad")
            pop = props.get("poblacion_total") or 1
            try:
                pop_int = int(float(pop))
            except Exception:
                pop_int = 1
            zone = ""
            if provincia_id == "provincia:06":
                zone = "AMBA" if normalize_text(dept_name) in {normalize_text(x) for x in AMBA_DEPARTAMENTOS} else "Interior bonaerense"
            province_points.append(
                GeoPoint(
                    provincia_id=provincia_id,
                    provincia_codigo=str(props.get("provincia_codigo") or province_info.get("provincia_codigo") or ""),
                    provincia_nombre=str(props.get("provincia_nombre") or province_info.get("provincia_nombre") or ""),
                    departamento_id=dept_id,
                    departamento_nombre=str(dept_name),
                    localidad_id=localidad_id,
                    localidad_nombre=localidad_nombre,
                    lat=lat,
                    lon=lon,
                    poblacion_total=max(1, pop_int),
                    zona_ba=zone,
                )
            )
        if province_points:
            points_by_province[provincia_id] = province_points
    return points_by_province


def build_products(rng: random.Random) -> List[Dict[str, Any]]:
    products: List[Dict[str, Any]] = []
    idx = 1
    for category, entries in CATEGORIES.items():
        for subcategory, product_name, price, weight, margin in entries:
            brand = BRANDS[(idx - 1) % len(BRANDS)]
            # Pequeña variación reproducible para evitar catálogo plano.
            price_factor = rng.uniform(0.96, 1.08)
            margin_factor = rng.uniform(-0.018, 0.018)
            products.append(
                {
                    "producto_id": f"P{idx:04d}",
                    "categoria_producto": category,
                    "subcategoria_producto": subcategory,
                    "producto_nombre": product_name,
                    "marca_ficticia": brand,
                    "unidad_medida": "unidad",
                    "precio_base": round(price * price_factor, 2),
                    "peso_estimado_kg": round(weight, 3),
                    "margen_base_pct": round(max(0.12, min(0.50, margin + margin_factor)), 4),
                    "activo": True,
                    "dato_sintetico": True,
                }
            )
            idx += 1
    return products


def select_client_type(rng: random.Random) -> str:
    items = list(CLIENT_TYPE_WEIGHTS.keys())
    weights = [CLIENT_TYPE_WEIGHTS[x] for x in items]
    return str(weighted_choice(items, weights, rng))


def select_segment(client_type: str, rng: random.Random) -> str:
    entries = SEGMENT_WEIGHTS_BY_TYPE[client_type]
    return str(weighted_choice([e[0] for e in entries], [e[1] for e in entries], rng))


def jitter_point(point: GeoPoint, rng: random.Random) -> Tuple[float, float]:
    # Jitter leve para evitar superposición exacta de clientes sintéticos sobre el centroide/punto V5.1.
    if point.provincia_id == "provincia:02":
        radius = rng.uniform(0.0015, 0.008)
    else:
        radius = rng.uniform(0.003, 0.025)
    angle = rng.uniform(0, math.tau)
    lat = point.lat + math.sin(angle) * radius
    lon = point.lon + math.cos(angle) * radius
    lat = max(ARG_BBOX["lat_min"], min(ARG_BBOX["lat_max"], lat))
    lon = max(ARG_BBOX["lon_min"], min(ARG_BBOX["lon_max"], lon))
    return round(lat, 6), round(lon, 6)


def choose_geo_point(points: List[GeoPoint], rng: random.Random) -> GeoPoint:
    # Peso por raíz de población: privilegia centros poblados sin anular localidades medianas/chicas.
    weights = [math.sqrt(max(1, p.poblacion_total)) for p in points]
    return weighted_choice(points, weights, rng)


def generate_clients(points_by_province: Dict[str, List[GeoPoint]], rng: random.Random) -> List[Dict[str, Any]]:
    clients: List[Dict[str, Any]] = []
    client_seq = 1

    for provincia_id, target in PROVINCE_TARGETS.items():
        province_points = points_by_province.get(provincia_id, [])
        if not province_points:
            raise RuntimeError(f"No hay puntos/localidades V5.1 disponibles para {provincia_id}")

        batches: List[Tuple[str, int, List[GeoPoint]]]
        if provincia_id == "provincia:06":
            amba_points = [p for p in province_points if p.zona_ba == "AMBA"]
            interior_points = [p for p in province_points if p.zona_ba != "AMBA"]
            amba_count = int(round(target * 0.62))
            batches = [
                ("AMBA", amba_count, amba_points or province_points),
                ("Interior bonaerense", target - amba_count, interior_points or province_points),
            ]
        else:
            batches = [("", target, province_points)]

        for zona, count, selectable_points in batches:
            for _ in range(count):
                point = choose_geo_point(selectable_points, rng)
                client_type = select_client_type(rng)
                segment = select_segment(client_type, rng)
                prefix = rng.choice(TYPE_NAME_PREFIX[client_type])
                root = rng.choice(NAME_ROOTS)
                loc_token = point.localidad_nombre.split(" ")[0][:18]
                client_id = f"C{client_seq:05d}"
                lat, lon = jitter_point(point, rng)
                alta_year = rng.choices([2018, 2019, 2020, 2021, 2022, 2023, 2024], weights=[5, 8, 12, 16, 20, 22, 17], k=1)[0]
                fecha_alta = date(alta_year, rng.randint(1, 12), rng.randint(1, 28)).isoformat()
                clients.append(
                    {
                        "cliente_id": client_id,
                        "cliente_nombre": f"{prefix} {root} {loc_token} {client_seq:04d}",
                        "tipo_cliente": client_type,
                        "segmento_cliente": segment,
                        "provincia_id": point.provincia_id,
                        "provincia_codigo": point.provincia_codigo,
                        "provincia_nombre": point.provincia_nombre,
                        "departamento_id": point.departamento_id,
                        "departamento_nombre": point.departamento_nombre,
                        "localidad_id": point.localidad_id,
                        "localidad_nombre": point.localidad_nombre,
                        "lat": lat,
                        "lon": lon,
                        "metodo_geocodificacion": "punto_localidad_v5_1_con_jitter_sintetico",
                        "confianza_geocodificacion": 0.88,
                        "fuente_dato": "sintetico_v6",
                        "dato_sintetico": True,
                        "activo": True,
                        "fecha_alta": fecha_alta,
                        "zona_buenos_aires": zona or (point.zona_ba if point.provincia_id == "provincia:06" else "No aplica"),
                    }
                )
                client_seq += 1
    if len(clients) != CLIENT_TARGET:
        raise RuntimeError(f"Cantidad de clientes generada inválida: {len(clients)} != {CLIENT_TARGET}")
    return clients


def product_weights_for_client(client_type: str, products: List[Dict[str, Any]]) -> List[float]:
    prefs = CLIENT_CATEGORY_PREFS.get(client_type, {})
    result = []
    for product in products:
        cat = product["categoria_producto"]
        base = CATEGORY_BASE_DEMAND.get(cat, 1.0)
        pref = prefs.get(cat, 1.0)
        # Penaliza levemente productos de ticket muy alto para que no dominen frecuencia.
        price = float(product["precio_base"])
        price_penalty = 1.0 / (1.0 + max(0.0, price - 50000) / 450000.0)
        result.append(base * pref * price_penalty)
    return result


def product_count_for_client(client_type: str, segment: str, rng: random.Random) -> int:
    ranges = {
        "Distribuidor mayorista": (3, 6),
        "Concesionario": (2, 5),
        "Flota comercial": (2, 4),
        "Casa de repuestos": (2, 4),
        "Taller mecánico": (1, 3),
        "Lubricentro": (1, 3),
        "Rectificadora": (1, 3),
        "Servicio técnico": (1, 3),
    }
    lo, hi = ranges[client_type]
    count = rng.randint(lo, hi)
    if segment == "Grande" and rng.random() < 0.65:
        count += 1
    if segment == "Pequeño" and count > 1 and rng.random() < 0.35:
        count -= 1
    return max(1, min(6, count))


def category_month_factor(category: str, month: int) -> float:
    if category == "Baterías" and month in (5, 6, 7, 8):
        return 1.28
    if category == "Lubricantes" and month in (3, 9, 10, 11):
        return 1.15
    if category == "Filtros" and month in (3, 9, 10):
        return 1.18
    if category == "Neumáticos" and month in (3, 4, 10, 11, 12):
        return 1.14
    if category == "Refrigeración" and month in (11, 12, 1, 2):
        return 1.20
    if category == "Iluminación" and month in (5, 6, 7):
        return 1.12
    return 1.0


def select_products_for_sale(client_type: str, products: List[Dict[str, Any]], count: int, rng: random.Random) -> List[Dict[str, Any]]:
    selected: List[Dict[str, Any]] = []
    available = list(products)
    weights = product_weights_for_client(client_type, available)
    for _ in range(count):
        if not available:
            break
        chosen = weighted_choice(available, weights, rng)
        idx = available.index(chosen)
        selected.append(chosen)
        available.pop(idx)
        weights.pop(idx)
    return selected


def build_calendar() -> List[Dict[str, Any]]:
    rows = []
    order = 1
    for year in (2025, 2026):
        for month in range(1, 13):
            rows.append(
                {
                    "periodo": f"{year}-{month:02d}",
                    "anio": year,
                    "mes": month,
                    "fecha_mes": f"{year}-{month:02d}-01",
                    "mes_nombre": MONTH_NAMES[month],
                    "trimestre": f"T{((month - 1) // 3) + 1}",
                    "semestre": "S1" if month <= 6 else "S2",
                    "orden_periodo": order,
                    "dato_sintetico": True,
                }
            )
            order += 1
    return rows


def generate_sales(clients: List[Dict[str, Any]], products: List[Dict[str, Any]], calendar: List[Dict[str, Any]], rng: random.Random) -> List[Dict[str, Any]]:
    sales: List[Dict[str, Any]] = []
    sale_seq = 1
    for period in calendar:
        year = int(period["anio"])
        month = int(period["mes"])
        months_since_start = (year - 2025) * 12 + month - 1
        year_units_factor = 1.00 if year == 2025 else 1.07
        price_index = (1.010 ** months_since_start) * (1.035 if year == 2026 else 1.0)
        for client in clients:
            client_type = client["tipo_cliente"]
            segment = client["segmento_cliente"]
            prod_count = product_count_for_client(client_type, segment, rng)
            selected_products = select_products_for_sale(client_type, products, prod_count, rng)
            base_units = BASE_UNITS_BY_TYPE[client_type]
            segment_mult = SEGMENT_MULTIPLIER[segment]
            province_factor = PROVINCE_DEMAND_FACTOR.get(client["provincia_id"], 0.9)
            for product in selected_products:
                category = product["categoria_producto"]
                demand = (
                    base_units
                    * segment_mult
                    * province_factor
                    * SEASONALITY[month]
                    * category_month_factor(category, month)
                    * CATEGORY_BASE_DEMAND.get(category, 1.0)
                    * year_units_factor
                )
                # Gamma crea cola realista: pocos tickets muy grandes y muchos medianos/chicos.
                noise_units = rng.gammavariate(2.0, max(0.1, demand / 2.0))
                units = max(1, int(round(noise_units)))
                unit_price = float(product["precio_base"]) * price_index * rng.uniform(0.94, 1.08)
                if segment == "Grande":
                    discount = rng.uniform(0.08, 0.17)
                elif segment == "Mediano":
                    discount = rng.uniform(0.035, 0.115)
                else:
                    discount = rng.uniform(0.0, 0.075)
                if client_type == "Distribuidor mayorista":
                    discount += rng.uniform(0.015, 0.035)
                discount = min(0.22, discount)
                venta_neta = units * unit_price * (1.0 - discount)
                margin = float(product["margen_base_pct"]) + rng.uniform(-0.025, 0.025)
                if segment == "Grande":
                    margin -= 0.015
                if client_type == "Distribuidor mayorista":
                    margin -= 0.025
                margin = max(0.08, min(0.48, margin))
                costo = venta_neta * (1.0 - margin)
                margen_bruto = venta_neta - costo
                volume = units * float(product["peso_estimado_kg"])
                sales.append(
                    {
                        "venta_id": f"V{sale_seq:07d}",
                        "cliente_id": client["cliente_id"],
                        "producto_id": product["producto_id"],
                        "periodo": period["periodo"],
                        "anio": year,
                        "mes": month,
                        "fecha_mes": period["fecha_mes"],
                        "unidades": units,
                        "precio_unitario": round(unit_price, 2),
                        "venta_neta": round(venta_neta, 2),
                        "descuento_pct": round(discount, 4),
                        "costo_estimado": round(costo, 2),
                        "margen_bruto": round(margen_bruto, 2),
                        "margen_bruto_pct": round(margin, 4),
                        "volumen_kg": round(volume, 3),
                        "dato_sintetico": True,
                    }
                )
                sale_seq += 1
    return sales


def aggregate_sales(clients: List[Dict[str, Any]], products: List[Dict[str, Any]], sales: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    client_map = {c["cliente_id"]: c for c in clients}
    product_map = {p["producto_id"]: p for p in products}

    def empty_agg() -> Dict[str, Any]:
        return {
            "registros_venta": 0,
            "unidades": 0,
            "venta_neta": 0.0,
            "costo_estimado": 0.0,
            "margen_bruto": 0.0,
            "volumen_kg": 0.0,
            "clientes": set(),
        }

    prov: Dict[Tuple[str, str], Dict[str, Any]] = defaultdict(empty_agg)
    dept: Dict[Tuple[str, str], Dict[str, Any]] = defaultdict(empty_agg)
    prod: Dict[Tuple[str, str], Dict[str, Any]] = defaultdict(empty_agg)
    cliente_tot: Dict[str, Dict[str, Any]] = defaultdict(empty_agg)

    for s in sales:
        c = client_map[s["cliente_id"]]
        p = product_map[s["producto_id"]]
        period = s["periodo"]
        prov_key = (period, c["provincia_id"])
        dept_key = (period, c["departamento_id"])
        prod_key = (period, s["producto_id"])
        client_key = s["cliente_id"]
        for key, bucket in ((prov_key, prov), (dept_key, dept), (prod_key, prod), (client_key, cliente_tot)):
            agg = bucket[key]
            agg["registros_venta"] += 1
            agg["unidades"] += int(s["unidades"])
            agg["venta_neta"] += float(s["venta_neta"])
            agg["costo_estimado"] += float(s["costo_estimado"])
            agg["margen_bruto"] += float(s["margen_bruto"])
            agg["volumen_kg"] += float(s["volumen_kg"])
            agg["clientes"].add(s["cliente_id"])

    def finalize_metrics(agg: Dict[str, Any]) -> Dict[str, Any]:
        venta = round(agg["venta_neta"], 2)
        margen = round(agg["margen_bruto"], 2)
        return {
            "registros_venta": agg["registros_venta"],
            "clientes_unicos": len(agg["clientes"]),
            "unidades": agg["unidades"],
            "venta_neta": venta,
            "costo_estimado": round(agg["costo_estimado"], 2),
            "margen_bruto": margen,
            "margen_bruto_pct": round(margen / venta, 4) if venta else 0,
            "volumen_kg": round(agg["volumen_kg"], 3),
            "dato_sintetico": True,
        }

    prov_rows: List[Dict[str, Any]] = []
    for (period, provincia_id), agg in sorted(prov.items()):
        any_client = next(c for c in clients if c["provincia_id"] == provincia_id)
        y, m = period.split("-")
        prov_rows.append({
            "periodo": period,
            "anio": int(y),
            "mes": int(m),
            "provincia_id": provincia_id,
            "provincia_codigo": any_client["provincia_codigo"],
            "provincia_nombre": any_client["provincia_nombre"],
            **finalize_metrics(agg),
        })

    dept_rows: List[Dict[str, Any]] = []
    dept_info = {}
    for c in clients:
        dept_info[c["departamento_id"]] = c
    for (period, departamento_id), agg in sorted(dept.items()):
        c = dept_info[departamento_id]
        y, m = period.split("-")
        dept_rows.append({
            "periodo": period,
            "anio": int(y),
            "mes": int(m),
            "provincia_id": c["provincia_id"],
            "provincia_nombre": c["provincia_nombre"],
            "departamento_id": departamento_id,
            "departamento_nombre": c["departamento_nombre"],
            **finalize_metrics(agg),
        })

    prod_rows: List[Dict[str, Any]] = []
    for (period, product_id), agg in sorted(prod.items()):
        p = product_map[product_id]
        y, m = period.split("-")
        prod_rows.append({
            "periodo": period,
            "anio": int(y),
            "mes": int(m),
            "producto_id": product_id,
            "categoria_producto": p["categoria_producto"],
            "subcategoria_producto": p["subcategoria_producto"],
            "producto_nombre": p["producto_nombre"],
            **finalize_metrics(agg),
        })

    cliente_rows: List[Dict[str, Any]] = []
    for cliente_id, agg in sorted(cliente_tot.items()):
        c = client_map[cliente_id]
        cliente_rows.append({
            "cliente_id": cliente_id,
            "cliente_nombre": c["cliente_nombre"],
            "tipo_cliente": c["tipo_cliente"],
            "segmento_cliente": c["segmento_cliente"],
            "provincia_id": c["provincia_id"],
            "provincia_nombre": c["provincia_nombre"],
            "departamento_id": c["departamento_id"],
            "departamento_nombre": c["departamento_nombre"],
            "localidad_id": c["localidad_id"],
            "localidad_nombre": c["localidad_nombre"],
            "lat": c["lat"],
            "lon": c["lon"],
            **finalize_metrics(agg),
        })

    return {
        "provincia_mes": prov_rows,
        "departamento_mes": dept_rows,
        "producto_mes": prod_rows,
        "cliente_totales": cliente_rows,
    }


def clients_to_geojson(clients: List[Dict[str, Any]]) -> Dict[str, Any]:
    features = []
    for c in clients:
        props = {k: v for k, v in c.items() if k not in ("lat", "lon")}
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [float(c["lon"]), float(c["lat"])]},
            "properties": props,
        })
    return {"type": "FeatureCollection", "features": features}


def heatmap_to_geojson(client_totals: List[Dict[str, Any]]) -> Dict[str, Any]:
    features = []
    max_sale = max(float(c["venta_neta"]) for c in client_totals) if client_totals else 1
    for c in client_totals:
        intensity = round(float(c["venta_neta"]) / max_sale, 6) if max_sale else 0
        props = dict(c)
        props["heatmap_weight"] = intensity
        props["render_layer"] = "clientes_heatmap"
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [float(c["lon"]), float(c["lat"])]},
            "properties": {k: v for k, v in props.items() if k not in ("lat", "lon")},
        })
    return {"type": "FeatureCollection", "features": features}


def write_public_json_array(path: Path, rows: Sequence[Dict[str, Any]], metadata: Optional[Dict[str, Any]] = None) -> None:
    payload = {
        "version": VERSION,
        "generated_at": now_iso(),
        "dato_sintetico": True,
        "records": rows,
    }
    if metadata:
        payload["metadata"] = metadata
    write_json(path, payload)


def file_size_rows(paths: Iterable[Path], root: Path) -> List[Dict[str, Any]]:
    rows = []
    for p in paths:
        if p.is_file():
            size = p.stat().st_size
            rows.append({"relative_path": p.relative_to(root).as_posix(), "size_bytes": size, "size_mib": round(size / 1024 / 1024, 3)})
    return sorted(rows, key=lambda r: r["size_bytes"], reverse=True)


def top_n(counter: Counter, n: int = 10) -> List[Dict[str, Any]]:
    return [{"name": k, "count": v} for k, v in counter.most_common(n)]


def sum_by(rows: List[Dict[str, Any]], key: str, value: str, n: int = 10) -> List[Dict[str, Any]]:
    acc: Dict[Any, float] = defaultdict(float)
    for row in rows:
        acc[row[key]] += float(row[value])
    return [{"name": k, "value": round(v, 2)} for k, v in sorted(acc.items(), key=lambda item: item[1], reverse=True)[:n]]


def build_diagnostics(
    seed: int,
    clients: List[Dict[str, Any]],
    products: List[Dict[str, Any]],
    sales: List[Dict[str, Any]],
    calendar: List[Dict[str, Any]],
    aggregates: Dict[str, List[Dict[str, Any]]],
    base_data: Path,
    out_data: Path,
    public_out: Path,
) -> Dict[str, Any]:
    public_data = public_out.parent
    public_files = list(public_data.rglob("*"))
    business_files = list(public_out.rglob("*"))
    output_files = list(out_data.rglob("*"))
    sales_2025 = round(sum(float(s["venta_neta"]) for s in sales if int(s["anio"]) == 2025), 2)
    sales_2026 = round(sum(float(s["venta_neta"]) for s in sales if int(s["anio"]) == 2026), 2)
    diag = {
        "project": "Mapa2",
        "version": VERSION,
        "phase": PHASE,
        "generated_at": now_iso(),
        "seed": seed,
        "synthetic_data_notice": "Clientes, productos y ventas son ficticios. No representan datos reales.",
        "base_v5_1": {
            "metadata_path": str(base_data / "metadata.json"),
            "provincias_index_path": str(base_data / "indexes" / "provincias_index.json"),
            "localidades_puntos_index_path": str(base_data / "indexes" / "localidades_puntos_index.json"),
            "census_logic_modified": False,
        },
        "counts": {
            "clientes": len(clients),
            "productos": len(products),
            "ventas_registros": len(sales),
            "meses": len(calendar),
            "periodo_desde": calendar[0]["periodo"],
            "periodo_hasta": calendar[-1]["periodo"],
            "agregados_provincia_mes": len(aggregates["provincia_mes"]),
            "agregados_departamento_mes": len(aggregates["departamento_mes"]),
            "agregados_producto_mes": len(aggregates["producto_mes"]),
            "agregados_cliente": len(aggregates["cliente_totales"]),
        },
        "distribution": {
            "clientes_por_provincia": dict(Counter(c["provincia_nombre"] for c in clients).most_common()),
            "clientes_por_tipo": dict(Counter(c["tipo_cliente"] for c in clients).most_common()),
            "clientes_por_segmento": dict(Counter(c["segmento_cliente"] for c in clients).most_common()),
            "buenos_aires_zona": dict(Counter(c["zona_buenos_aires"] for c in clients if c["provincia_id"] == "provincia:06").most_common()),
        },
        "sales_summary": {
            "venta_neta_total": round(sales_2025 + sales_2026, 2),
            "venta_neta_2025": sales_2025,
            "venta_neta_2026": sales_2026,
            "variacion_2026_vs_2025_pct": round(((sales_2026 / sales_2025) - 1.0) * 100.0, 2) if sales_2025 else None,
            "top_provincias_por_ventas": sum_by(aggregates["provincia_mes"], "provincia_nombre", "venta_neta", 10),
            "top_productos_por_ventas": sum_by(aggregates["producto_mes"], "producto_nombre", "venta_neta", 10),
            "top_tipos_cliente": top_n(Counter(c["tipo_cliente"] for c in clients), 10),
        },
        "geocoding": {
            "method": "Asignación de clientes ficticios a puntos/localidades existentes V5.1 con jitter sintético controlado.",
            "metodo_geocodificacion": "punto_localidad_v5_1_con_jitter_sintetico",
            "confianza_geocodificacion": 0.88,
            "source_layers": [
                "public/data/indexes/provincias_index.json",
                "public/data/indexes/localidades_puntos_index.json",
                "public/data/provincias/<provincia>/puntos.geojson",
                "public/data/provincias/<provincia>/departamentos.geojson",
            ],
        },
        "generated_files": {
            "business_output": file_size_rows(output_files, out_data.parent.parent if out_data.parts[-2:] == ("output", "business_v6") else out_data.parent),
            "business_public": file_size_rows(business_files, public_data),
            "public_data_top_20": file_size_rows(public_files, public_data)[:20],
        },
        "validation": {
            "status": "PENDING_CHECK",
            "warnings": [],
            "errors": [],
            "note": "Ejecutar src/check_business_v6.py para validación final.",
        },
        "no_phase_advance": "No se avanzó a V7; no se creó frontend completo ni deploy.",
        "status": "PENDING_CHECK",
    }
    return diag


def render_diagnostics_md(diag: Dict[str, Any]) -> str:
    counts = diag["counts"]
    sales = diag["sales_summary"]
    dist = diag["distribution"]
    lines = [
        "# Diagnóstico Business V6 — Mapa2",
        "",
        f"Versión: `{diag['version']}`",
        f"Fase: **{diag['phase']}**",
        f"Generado: `{diag['generated_at']}`",
        f"Seed: `{diag['seed']}`",
        "",
        "## Aviso de datos sintéticos",
        "",
        "Los clientes, productos y ventas generados en V6 son **ficticios**. No representan clientes reales, operaciones reales ni precios reales. Se usan únicamente para pruebas de visualización, filtros y agregaciones comerciales en la futura V7.",
        "",
        "## Confirmación de alcance",
        "",
        "- No se modificó la lógica censal validada en V5.1.",
        "- No se destruyó ni reemplazó la base maestra.",
        "- No se creó frontend completo.",
        "- No se hizo deploy.",
        "- No se avanzó a V7.",
        "",
        "## Resumen cuantitativo",
        "",
        f"- Clientes generados: **{counts['clientes']}**",
        f"- Productos generados: **{counts['productos']}**",
        f"- Registros de ventas: **{counts['ventas_registros']}**",
        f"- Meses cubiertos: **{counts['meses']}** ({counts['periodo_desde']} a {counts['periodo_hasta']})",
        f"- Agregados provincia-mes: **{counts['agregados_provincia_mes']}**",
        f"- Agregados departamento-mes: **{counts['agregados_departamento_mes']}**",
        f"- Agregados producto-mes: **{counts['agregados_producto_mes']}**",
        f"- Agregados cliente: **{counts['agregados_cliente']}**",
        "",
        "## Ventas sintéticas",
        "",
        f"- Venta neta total 2025: **{sales['venta_neta_2025']:,.2f}**",
        f"- Venta neta total 2026: **{sales['venta_neta_2026']:,.2f}**",
        f"- Variación 2026 vs 2025: **{sales['variacion_2026_vs_2025_pct']}%**",
        "",
        "## Distribución de clientes por provincia",
        "",
    ]
    for prov, count in dist["clientes_por_provincia"].items():
        lines.append(f"- {prov}: {count}")
    lines.extend(["", "## Distribución por tipo de cliente", ""])
    for t, count in dist["clientes_por_tipo"].items():
        lines.append(f"- {t}: {count}")
    lines.extend(["", "## Buenos Aires — AMBA vs interior", ""])
    for zone, count in dist["buenos_aires_zona"].items():
        lines.append(f"- {zone}: {count}")
    lines.extend(["", "## Top provincias por ventas", ""])
    for row in sales["top_provincias_por_ventas"]:
        lines.append(f"- {row['name']}: {row['value']:,.2f}")
    lines.extend(["", "## Top productos por ventas", ""])
    for row in sales["top_productos_por_ventas"]:
        lines.append(f"- {row['name']}: {row['value']:,.2f}")
    lines.extend([
        "",
        "## Método de geocodificación",
        "",
        f"- Método: `{diag['geocoding']['metodo_geocodificacion']}`",
        f"- Confianza: `{diag['geocoding']['confianza_geocodificacion']}`",
        "- Descripción: se asignan clientes ficticios a puntos/localidades V5.1 y se aplica jitter sintético leve para evitar superposición exacta.",
        "- Fuente geográfica: capas públicas V5.1 en `public/data/provincias/<provincia>/puntos.geojson` y `departamentos.geojson`.",
        "",
        "## Archivos generados — public/data/business",
        "",
    ])
    for row in diag["generated_files"]["business_public"]:
        lines.append(f"- `{row['relative_path']}` — {row['size_mib']} MiB")
    lines.extend([
        "",
        "## Validaciones",
        "",
        "Estado inicial: `PENDING_CHECK`.",
        "",
        "Ejecutar:",
        "",
        "```powershell",
        "python src\\check_business_v6.py --base-data public\\data --business-data public\\data\\business --diag data\\output\\diagnostico_business_v6.json --out data\\output\\check_business_v6.txt",
        "```",
        "",
        "<!-- VALIDATION_BLOCK_START -->",
        "Validación final pendiente de ejecución de `check_business_v6.py`.",
        "<!-- VALIDATION_BLOCK_END -->",
        "",
        "## Resultado final",
        "",
        "Estado: `PENDING_CHECK` hasta ejecutar el check V6.",
    ])
    return "\n".join(lines) + "\n"


def update_root_metadata(base_data: Path, diag: Dict[str, Any]) -> None:
    metadata_path = base_data / "metadata.json"
    metadata = read_json(metadata_path)
    metadata["business_v6"] = {
        "version": VERSION,
        "phase": PHASE,
        "generated_at": diag["generated_at"],
        "dato_sintetico": True,
        "source": "sintetico_v6",
        "census_logic_modified": False,
        "frontend_complete_created": False,
        "deploy_created": False,
        "public_path": "business/metadata_business_v6.json",
        "clientes": diag["counts"]["clientes"],
        "productos": diag["counts"]["productos"],
        "ventas_registros": diag["counts"]["ventas_registros"],
        "periodo": {"desde": diag["counts"]["periodo_desde"], "hasta": diag["counts"]["periodo_hasta"]},
        "recommended_frontend_use_v7": [
            "clusters de clientes",
            "heatmap de ventas por cliente",
            "coroplético por ventas agregadas contra departamentos/provincias V5.1",
            "filtros por provincia, departamento/localidad, cliente, producto, categoría y calendario",
        ],
    }
    write_json(metadata_path, metadata)


def main() -> int:
    parser = argparse.ArgumentParser(description="Genera datos comerciales sintéticos V6 para Mapa2.")
    parser.add_argument("--base-data", default="public/data", help="Directorio base V5.1 public/data")
    parser.add_argument("--out-data", default="data/output/business_v6", help="Directorio de salida analítica")
    parser.add_argument("--public-out", default="public/data/business", help="Directorio público liviano")
    parser.add_argument("--diag-md", default="data/output/diagnostico_business_v6.md", help="Diagnóstico Markdown")
    parser.add_argument("--diag-json", default="data/output/diagnostico_business_v6.json", help="Diagnóstico JSON")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED, help="Semilla reproducible")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    base_data = Path(args.base_data)
    out_data = Path(args.out_data)
    public_out = Path(args.public_out)
    diag_md = Path(args.diag_md)
    diag_json = Path(args.diag_json)
    public_aggs = public_out / "agregados"

    required = [
        base_data / "metadata.json",
        base_data / "indexes" / "provincias_index.json",
        base_data / "indexes" / "localidades_puntos_index.json",
    ]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        raise FileNotFoundError(f"Faltan insumos V5.1 requeridos: {missing}")

    metadata = read_json(base_data / "metadata.json")
    if metadata.get("status") != "OK":
        raise RuntimeError(f"La metadata V5.1 no está OK. status={metadata.get('status')}")

    provinces_index = read_json(base_data / "indexes" / "provincias_index.json").get("provinces", {})
    points_by_province = load_geo_points(base_data, provinces_index)

    products = build_products(rng)
    clients = generate_clients(points_by_province, rng)
    calendar = build_calendar()
    sales = generate_sales(clients, products, calendar, rng)
    aggregates = aggregate_sales(clients, products, sales)

    client_fields = [
        "cliente_id", "cliente_nombre", "tipo_cliente", "segmento_cliente", "provincia_id", "provincia_codigo",
        "provincia_nombre", "departamento_id", "departamento_nombre", "localidad_id", "localidad_nombre", "lat", "lon",
        "metodo_geocodificacion", "confianza_geocodificacion", "fuente_dato", "dato_sintetico", "activo", "fecha_alta",
        "zona_buenos_aires",
    ]
    product_fields = [
        "producto_id", "categoria_producto", "subcategoria_producto", "producto_nombre", "marca_ficticia", "unidad_medida",
        "precio_base", "peso_estimado_kg", "margen_base_pct", "activo", "dato_sintetico",
    ]
    sales_fields = [
        "venta_id", "cliente_id", "producto_id", "periodo", "anio", "mes", "fecha_mes", "unidades", "precio_unitario",
        "venta_neta", "descuento_pct", "costo_estimado", "margen_bruto", "margen_bruto_pct", "volumen_kg", "dato_sintetico",
    ]
    calendar_fields = ["periodo", "anio", "mes", "fecha_mes", "mes_nombre", "trimestre", "semestre", "orden_periodo", "dato_sintetico"]

    # data/output/business_v6
    write_csv(out_data / "clientes_v6.csv", clients, client_fields)
    write_json(out_data / "clientes_v6.geojson", clients_to_geojson(clients))
    write_csv(out_data / "productos_v6.csv", products, product_fields)
    write_csv(out_data / "ventas_mensuales_v6.csv", sales, sales_fields)
    write_csv(out_data / "calendario_v6.csv", calendar, calendar_fields)
    write_csv(out_data / "agregados_provincia_mes_v6.csv", aggregates["provincia_mes"], list(aggregates["provincia_mes"][0].keys()))
    write_csv(out_data / "agregados_departamento_mes_v6.csv", aggregates["departamento_mes"], list(aggregates["departamento_mes"][0].keys()))
    write_csv(out_data / "agregados_producto_mes_v6.csv", aggregates["producto_mes"], list(aggregates["producto_mes"][0].keys()))
    write_csv(out_data / "agregados_cliente_v6.csv", aggregates["cliente_totales"], list(aggregates["cliente_totales"][0].keys()))

    # public/data/business
    ensure_dir(public_aggs)
    write_json(public_out / "clientes.geojson", clients_to_geojson(clients))
    write_public_json_array(public_out / "productos.json", products, {"records_count": len(products)})
    write_public_json_array(public_out / "calendario.json", calendar, {"periodo_desde": calendar[0]["periodo"], "periodo_hasta": calendar[-1]["periodo"]})
    write_csv(public_out / "ventas_mensuales.csv", sales, sales_fields)
    write_public_json_array(public_aggs / "ventas_provincia_mes.json", aggregates["provincia_mes"], {"grain": "provincia_mes"})
    write_public_json_array(public_aggs / "ventas_departamento_mes.json", aggregates["departamento_mes"], {"grain": "departamento_mes"})
    write_public_json_array(public_aggs / "ventas_producto_mes.json", aggregates["producto_mes"], {"grain": "producto_mes"})
    write_public_json_array(public_aggs / "ventas_cliente_totales.json", aggregates["cliente_totales"], {"grain": "cliente_totales"})
    write_json(public_aggs / "heatmap_clientes_ventas.geojson", heatmap_to_geojson(aggregates["cliente_totales"]))

    diag = build_diagnostics(args.seed, clients, products, sales, calendar, aggregates, base_data, out_data, public_out)
    write_json(public_out / "metadata_business_v6.json", {
        "project": "Mapa2",
        "version": VERSION,
        "phase": PHASE,
        "generated_at": diag["generated_at"],
        "seed": args.seed,
        "dato_sintetico": True,
        "source": "sintetico_v6",
        "synthetic_data_notice": diag["synthetic_data_notice"],
        "counts": diag["counts"],
        "distribution": diag["distribution"],
        "sales_summary": diag["sales_summary"],
        "geocoding": diag["geocoding"],
        "public_files": diag["generated_files"]["business_public"],
        "status": "PENDING_CHECK",
        "no_phase_advance": diag["no_phase_advance"],
    })
    update_root_metadata(base_data, diag)

    # Recalcular tamaños luego de escribir metadata pública.
    diag = build_diagnostics(args.seed, clients, products, sales, calendar, aggregates, base_data, out_data, public_out)
    write_json(diag_json, diag)
    ensure_dir(diag_md.parent)
    diag_md.write_text(render_diagnostics_md(diag), encoding="utf-8")

    print(f"OK generación V6: clientes={len(clients)} productos={len(products)} ventas={len(sales)}")
    print(f"Diagnóstico MD: {diag_md}")
    print(f"Diagnóstico JSON: {diag_json}")
    print(f"Salida pública: {public_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
