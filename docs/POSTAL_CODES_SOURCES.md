# Mapa 2 — V11A Postal Codes Sources

## Regla de diseño

El código postal se incorpora como señal auxiliar territorial. Nunca reemplaza a:

- Provincia.
- Localidad normalizada.
- Alias territorial.
- Código oficial INDEC/Georef.
- Coordenadas.
- Método de matching y nivel de confianza.

## Fuente interna usada en V11A

Se detectó dentro del proyecto:

```text
data/semilla/datos-refeglo_25-09-2023.csv
```

Este archivo contiene gobiernos locales y una columna de dirección postal de sede de gobierno. V11A extrae códigos postales básicos con regex sobre valores del tipo `(NNNN)`.

## Resultado

- Registros `postal_code_area`: 943.
- Fuente: `mininterior_refeglo_2023`.
- Tipo de fuente: `official`.
- Método con match de localidad: `refeglo_address_postal_code_regex_plus_province_locality_match`.
- Método sin match de localidad: `refeglo_address_postal_code_regex_only`.

## Limitaciones

1. No es una base CPA exhaustiva.
2. Representa direcciones de sedes de gobiernos locales, no cobertura postal completa.
3. Un mismo código postal puede cubrir más de una zona o localidad.
4. La confianza es media: útil para mejorar matching, no para reemplazar jerarquía territorial.
5. Si se incorpora CPA/Correo Argentino u otra fuente postal oficial, debe entrar como nueva fuente trazada en `source_catalog`.

## Fuentes recomendadas para completar en fases futuras

1. Correo Argentino / CPA, si se obtiene dataset compatible con uso del proyecto.
2. Datos.gob.ar / Georef, especialmente normalización territorial y calles cuando aplique.
3. INDEC / CODGEO / Censo 2022 para códigos territoriales.
4. Fuentes provinciales o municipales oficiales.
5. Fuentes extraoficiales solo si se marcan como `unofficial` y con menor `confidence_score`.

## Campos mínimos esperados para importar nueva fuente postal

```text
postal_code
postal_code_type
province_name_original
locality_name_original
province_id
locality_id
source_id
source_type
confidence_score
match_method
notes
```

## Criterio de confianza sugerido

| Caso | Confidence score |
|---|---:|
| CPA oficial con provincia + localidad + coordenada/calle | 0.90 - 0.98 |
| Fuente oficial con provincia + localidad | 0.75 - 0.89 |
| REFLO dirección de sede local con match territorial | 0.70 - 0.75 |
| REFLO dirección de sede local sin match de localidad | 0.50 - 0.60 |
| Fuente extraoficial documentada | 0.35 - 0.65 |

## Próximo paso recomendado

En V11B/V11C, usar `postal_code_area` solo como señal auxiliar dentro de `/api/search/territory?q=&provinceId=&postalCode=` y en logs de matching, no como filtro territorial único.
