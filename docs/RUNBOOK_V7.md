# RUNBOOK V7 — Mapa2 Frontend interactivo

## Objetivo

Ejecutar y validar localmente la V7 del proyecto Mapa2: frontend interactivo con datos censales V5.1 y datos comerciales sintéticos V6.

## Requisitos

- Windows 10/11.
- VSCode.
- Python 3.10+.
- Node.js 20+ recomendado.
- PowerShell.

## Instalación Python

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## Instalación frontend

```powershell
npm install
```

## Ejecutar app en desarrollo

```powershell
npm run dev
```

Abrir la URL que indique Vite, normalmente:

```text
http://127.0.0.1:5173/
```

## Build local

```powershell
npm run build
```

Resultado esperado:

```text
✓ built
```

## Preview local del build

```powershell
npm run preview
```

## Validación V7

```powershell
python src\check_frontend_v7.py --project-root . --out data\output\check_frontend_v7.txt
```

Resultado esperado:

```text
Estado final: OK
```

## Auditoría de tamaños

```powershell
Get-ChildItem public\data -Recurse -File | Select-Object FullName,Length | Sort-Object Length -Descending | Out-File data\output\v7_file_sizes.txt
```

## Diagnósticos generados

```text
data/output/diagnostico_frontend_v7.md
data/output/diagnostico_frontend_v7.json
data/output/check_frontend_v7.txt
data/output/v7_file_sizes.txt
```

## Qué revisar visualmente

1. La app abre sin pantalla blanca.
2. El mapa de Argentina carga correctamente.
3. El panel lateral muestra KPIs.
4. El aviso de datos sintéticos es visible.
5. Las capas cambian desde el selector:
   - Territorial base.
   - Clientes.
   - Clusters.
   - Heatmap.
   - Coroplético provincia.
   - Coroplético departamento/partido.
   - Puntos localidades.
6. Al hacer click en una provincia, se selecciona y se cargan departamentos/partidos bajo demanda.
7. Al activar puntos de localidades con provincia seleccionada, se cargan puntos V5.1 bajo demanda.
8. Al filtrar producto, categoría, cliente, tipo o segmento, se carga `ventas_mensuales.csv` bajo demanda.
9. Los KPIs cambian según filtros.
10. Hover/click muestran detalle de provincias, departamentos y clientes.

## Reglas de datos

La V7 no debe cargar radios nacionales al inicio.  
La V7 no debe modificar la base censal V5.1.  
La V7 no debe regenerar ni alterar la base comercial V6.  
Los datos comerciales son sintéticos y deben permanecer identificados como tales.

## Cloudflare Pages Free

La app queda preparada para deploy futuro en V8:

```text
Build command: npm run build
Output directory: dist
```

En V7 no se hizo deploy.

## Errores comunes

### `npm` no reconocido

Instalar Node.js y reiniciar la terminal.

### PowerShell bloquea Activate.ps1

Ejecutar solo si tu política local lo permite:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Mapa sin tiles base

La app usa tiles OSM públicos sin token. Si el equipo o red bloquea dominios externos, las capas GeoJSON propias igual deberían cargar sobre fondo vacío.

### Filtros de producto demoran

Es esperado la primera vez: `ventas_mensuales.csv` pesa aproximadamente 14 MiB y se carga bajo demanda.

## No avanzar de fase

No avanzar a V8 hasta validar localmente V7 y recibir autorización explícita del usuario.

---

## Nota V7.1 — Corrección runtime

Si en `npm run dev` quedaba fijo el mensaje `Cargando detalle comercial bajo demanda…`, usar esta versión V7.1. El problema estaba asociado al doble ciclo de efectos de React en modo desarrollo y fue corregido sin modificar datos censales ni comerciales.

Flujo limpio recomendado después de extraer el ZIP V7.1 en una ruta corta:

```powershell
cd C:\Mapa2\mapa2_v7_1_frontend_runtime_fix
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

npm config set registry https://registry.npmjs.org/
npm install
npm run dev
```

Validación posterior:

```powershell
npm run build
python src\check_frontend_v7.py --project-root . --out data\output\check_frontend_v7.txt
Get-ChildItem public\data -Recurse -File | Select-Object FullName,Length | Sort-Object Length -Descending | Out-File data\output\v7_file_sizes.txt
```

Resultado esperado después de instalar dependencias:

```text
Estado final: OK
```

Los warnings 404 de `demotiles.maplibre.org/font/...pbf` ya no deberían aparecer porque la V7.1 no usa una capa `symbol` que requiera glyphs externos.

