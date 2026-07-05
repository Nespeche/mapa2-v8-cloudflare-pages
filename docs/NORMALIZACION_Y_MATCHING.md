# Normalización y matching territorial

## Claves fuertes

La base prioriza claves oficiales antes que texto:

1. `codigo_indec` / Codgeo.
2. `codigo_georef`.
3. `codigo_refeglo`.
4. Prefijos de códigos censales.
5. Geometría / coordenadas.
6. Nombre normalizado como respaldo.
7. Código Postal Argentino como señal auxiliar.

## Prefijos usados

- Provincia: 2 dígitos. Ejemplo `06`.
- Departamento / partido / comuna: 5 dígitos. Ejemplo `06007`.
- Fracción censal: 7 dígitos. Ejemplo `0600702`.
- Radio censal: 9 dígitos. Ejemplo `060070201`.
- Localidad censal: 8 dígitos. Ejemplo `06007010`.
- Gobierno local / municipio: 6 dígitos.

## Texto normalizado

Los nombres se pasan a minúsculas, sin acentos, sin puntuación y con espacios colapsados. Ejemplos:

- `Sgo. del Estero` → `sgo del estero`.
- `Tierra del Fuego, Antártida e Islas del Atlántico Sur` → `tierra del fuego antartida e islas del atlantico sur`.

El texto normalizado no reemplaza el código oficial; solo ayuda cuando la fuente externa viene sin código.

## Código postal

El CPA puede ayudar a inferir provincia porque la primera letra identifica jurisdicción. No se usa como fuente maestra porque Correo Argentino informa que no emite listados públicos de códigos postales/localidades y que el CP histórico de 4 dígitos no tiene mantenimiento desde 1974.

## Reglas para barrios

- Si hay población oficial municipal/provincial por barrio, se carga como `oficial_directa` u `oficial_procesada`.
- Si solo hay polígono de barrio, se carga la geometría y queda sin población hasta cruzar radios censales.
- Si se estima con radios censales, se marca `clasificacion_fuente=estimada` y `metodo_dato=overlay_radio_area`.
- OSM se carga como `no_oficial` y no pisa registros oficiales.
