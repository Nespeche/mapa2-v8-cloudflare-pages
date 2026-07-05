# Diagnóstico v3 — estado de la base incluida

## Resultado sobre la base incluida en el ZIP

Esta versión trae una **base semilla alineada** y un **constructor completo** para materializar las capas oficiales cuando se ejecute `download_sources.py` con conexión a Internet.

Controles ya ejecutados sobre la semilla:

- País: 1 entidad con población Censo 2022.
- Provincias/CABA: 24 entidades con población Censo 2022.
- Gobiernos locales: 2.345 entidades REFEGLO/INDEC.
- Gobiernos locales con población Censo 2022 directa: 2.291.
- Gobiernos locales REFEGLO sin población 2022 directa en el cuadro importado: 54.
- Suma provincias = total país: 45.892.285.
- Suma gobiernos locales con dato 2022 = total país: 45.892.285.
- Relaciones provincia/país y gobierno local/provincia: alineadas, sin relaciones huérfanas en la semilla.

El reporte ejecutable queda en:

```text
DATA/output/diagnostico_alineacion.md
```

## Qué queda pendiente hasta ejecutar descargas

Estas jerarquías no están materializadas dentro de la semilla, pero el ZIP ya trae scripts y fuentes configuradas para incorporarlas:

- Departamentos / partidos / comunas.
- Municipios.
- Localidades.
- Localidades censales.
- Fracciones censales.
- Radios censales.
- Barrios oficiales municipales/provinciales.
- Barrios populares RENABAP.

## Por qué no se fuerza barrio como jerarquía completa nacional

No existe una única capa oficial nacional de “barrios” equivalente a provincia, departamento, municipio o localidad con población censal directa 2022. Por eso el modelo separa:

- barrios oficiales municipales/provinciales,
- CABA,
- RENABAP como universo parcial de barrios populares,
- OSM como complemento no oficial,
- población por barrio estimada con radios censales cuando no exista dato oficial directo.

## Orden de normalización aplicado

1. Código INDEC / Codgeo.
2. Código Georef.
3. Código REFEGLO para gobiernos locales.
4. Prefijo jerárquico de códigos: provincia 2 dígitos, departamento 5, fracción 7, radio 9, localidad 8.
5. Nombre normalizado + provincia.
6. Coordenada / overlay espacial.
7. Código Postal Argentino solo como señal auxiliar, nunca como clave maestra.

## Comando recomendado

```bash
python src/run_full_pipeline.py
```

Si ya tenés los datos descargados en `data/raw`, podés ejecutar:

```bash
python src/run_full_pipeline.py --skip-download
```
