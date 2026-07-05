from __future__ import annotations

import json
import re
import sqlite3
import unicodedata
from pathlib import Path
from typing import Any, Iterable

import yaml


def load_yaml(path: str | Path) -> dict[str, Any]:
    with open(path, 'r', encoding='utf-8') as fh:
        return yaml.safe_load(fh)


def ensure_dir(path: str | Path) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    text = unicodedata.normalize('NFKD', text)
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r'[^a-z0-9]+', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text or None


def normalize_code(value: Any, width: int | None = None) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value).strip()
    if text.lower() in {'nan', 'none', '', '///'}:
        return None
    text = re.sub(r'\.0$', '', text)
    text = re.sub(r'[^0-9A-Za-z_-]', '', text)
    if width and text.isdigit():
        text = text.zfill(width)
    return text or None


def safe_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if value != value:
            return None
        return int(round(value))
    text = str(value).strip().replace('.', '').replace(',', '.')
    if text in {'', '///', '-'}:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def safe_float(value: Any) -> float | None:
    """Parsea floats argentinos/internacionales sin destruir coordenadas.

    Regla:
    - Si hay coma y punto, asumimos formato argentino/europeo: 1.234,56 -> 1234.56.
    - Si hay solo coma, asumimos decimal: -34,61 -> -34.61.
    - Si hay solo punto, asumimos decimal internacional: -34.61 -> -34.61.
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value != value:
            return None
        return float(value)
    text = str(value).strip()
    if text.lower() in {'', '///', '-', 'nan', 'none'}:
        return None
    if ',' in text and '.' in text:
        text = text.replace('.', '').replace(',', '.')
    elif ',' in text:
        text = text.replace(',', '.')
    # si solo tiene punto, se conserva como separador decimal
    try:
        return float(text)
    except ValueError:
        return None


def sqlite_connect(path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute('PRAGMA foreign_keys = ON')
    conn.execute('PRAGMA journal_mode = WAL')
    return conn


def write_jsonl(path: str | Path, rows: Iterable[dict[str, Any]]) -> None:
    with open(path, 'w', encoding='utf-8') as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + '\n')

CPA_PROV_LETTER_TO_CODE = {
    'C': '02',  # Ciudad Autónoma de Buenos Aires
    'B': '06',  # Buenos Aires
    'K': '10',  # Catamarca
    'H': '22',  # Chaco
    'U': '26',  # Chubut
    'X': '14',  # Córdoba
    'W': '18',  # Corrientes
    'E': '30',  # Entre Ríos
    'P': '34',  # Formosa
    'Y': '38',  # Jujuy
    'L': '42',  # La Pampa
    'F': '46',  # La Rioja
    'M': '50',  # Mendoza
    'N': '54',  # Misiones
    'Q': '58',  # Neuquén
    'R': '62',  # Río Negro
    'A': '66',  # Salta
    'J': '70',  # San Juan
    'D': '74',  # San Luis
    'Z': '78',  # Santa Cruz
    'S': '82',  # Santa Fe
    'G': '86',  # Santiago del Estero
    'V': '94',  # Tierra del Fuego, Antártida e Islas del Atlántico Sur
    'T': '90',  # Tucumán
}


def normalize_codigo_postal(value: Any) -> str | None:
    """Normaliza CP/CPA sin usarlo como clave censal primaria.

    Acepta formatos como "C1426BMD", "C 1426 BMD" o "1426". Si el valor tiene
    letra provincial + 4 dígitos + 3 letras, devuelve CPA de 8 caracteres. Si
    tiene solo 4 dígitos, devuelve el CP histórico como cadena, pero debe tratarse
    como señal débil, no como identificador único.
    """
    if value is None:
        return None
    text = str(value).strip().upper()
    if text.lower() in {'', 'nan', 'none', '///', '-'}:
        return None
    text = re.sub(r'[^A-Z0-9]', '', text)
    if re.fullmatch(r'[A-Z][0-9]{4}[A-Z]{3}', text):
        return text
    if re.fullmatch(r'[0-9]{4}', text):
        return text
    if re.fullmatch(r'[A-Z][0-9]{4}', text):
        return text
    return None


def provincia_id_from_cpa(value: Any) -> str | None:
    cpa = normalize_codigo_postal(value)
    if not cpa or not cpa[0].isalpha():
        return None
    code = CPA_PROV_LETTER_TO_CODE.get(cpa[0])
    return f'provincia:{code}' if code else None
