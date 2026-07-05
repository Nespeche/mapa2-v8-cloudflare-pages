# RUNBOOK V6 — Base ficticia de clientes y ventas de autopartes

## Objetivo

Regenerar y validar la V6 comercial sintética sobre la base V5.1 aprobada de Mapa2.

## Alcance

V6 genera datos comerciales ficticios de autopartes para pruebas de visualización. No modifica la lógica censal, no crea frontend completo y no hace deploy.

## Requisitos

- Python 3.10 o superior.
- Windows PowerShell o terminal equivalente.
- ZIP completo V6 extraído en una ruta corta, por ejemplo:

```text
C:\Mapa2\m2_v6_business
```

Evitar rutas largas como Escritorio sincronizado con OneDrive o subcarpetas profundas.

## 1. Crear entorno virtual

```powershell
python -m venv .venv
```

## 2. Activar entorno

```powershell
.\.venv\Scripts\Activate.ps1
```

Si PowerShell bloquea scripts:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

## 3. Instalar dependencias

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 4. Ejecutar generación V6

```powershell
python src\generate_business_v6.py --base-data public\data --out-data data\output\business_v6 --public-out public\data\business --diag-md data\output\diagnostico_business_v6.md --diag-json data\output\diagnostico_business_v6.json --seed 20260705
```

Resultado esperado:

```text
OK generación V6: clientes=2000 productos=65 ventas=128998
```

## 5. Ejecutar check V6

```powershell
python src\check_business_v6.py --base-data public\data --business-data public\data\business --diag data\output\diagnostico_business_v6.json --out data\output\check_business_v6.txt
```

Resultado esperado:

```text
Estado final: OK
Clientes: 2000
Productos: 65
Registros de ventas: 128998
Archivos >25 MiB: 0
No se avanzó a V7
```

## 6. Generar archivo de pesos

```powershell
Get-ChildItem public\data -Recurse -File | Select-Object FullName,Length | Sort-Object Length -Descending | Out-File data\output\v6_file_sizes.txt
```

El archivo público más pesado esperado es:

```text
public/data/business/ventas_mensuales.csv — aproximadamente 14.000 MiB
```

## 7. Abrir diagnósticos

```powershell
code data\output\diagnostico_business_v6.md
code data\output\diagnostico_business_v6.json
code data\output\check_business_v6.txt
code data\output\v6_file_sizes.txt
```

## 8. Revisar outputs comerciales

```powershell
code public\data\business\metadata_business_v6.json
code public\data\business\productos.json
code public\data\business\calendario.json
code public\data\business\ventas_mensuales.csv
```

Para listar outputs:

```powershell
Get-ChildItem public\data\business -Recurse -File | Select-Object FullName,Length | Sort-Object FullName
```

## 9. Validación visual opcional en QGIS

Abrir:

```text
public/data/business/clientes.geojson
```

Validar:

- puntos dentro de Argentina;
- concentración principal en Buenos Aires;
- presencia en CABA, Córdoba, Santa Fe y provincias restantes;
- campos `cliente_id`, `tipo_cliente`, `segmento_cliente`, `provincia_nombre`, `departamento_nombre`, `localidad_nombre`;
- `dato_sintetico=true`.

También puede abrirse:

```text
public/data/business/agregados/heatmap_clientes_ventas.geojson
```

## 10. Validaciones esperadas

El check debe cerrar con:

```text
Estado final: OK
```

No debe haber errores bloqueantes.

## 11. Archivos que conviene compartir para revisión posterior

Si se necesita validar V6 en otro chat o después de ejecutarla localmente, compartir:

```text
data/output/check_business_v6.txt
data/output/diagnostico_business_v6.md
data/output/diagnostico_business_v6.json
data/output/v6_file_sizes.txt
public/data/business/metadata_business_v6.json
```

Si aparece un error, compartir también:

```text
la salida completa de PowerShell
el comando exacto ejecutado
captura o texto del error
```

## 12. Próximo paso

No avanzar a V7 hasta que el usuario confirme que V6 funciona correctamente.
