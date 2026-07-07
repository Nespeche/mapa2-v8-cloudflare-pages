# Mapa 2 — Optimización de build Cloudflare V10.4

## 1. Hallazgo V10.3

Cloudflare Pages detectaba `requirements.txt` en la raíz del proyecto y ejecutaba:

```text
pip install -r requirements.txt
```

Esto no rompía el deploy, pero era innecesario para un build frontend estático con React/Vite.

## 2. Cambio aplicado en V10.4

Se movió:

```text
requirements.txt
```

a:

```text
tools/python/requirements.txt
```

Y se agregó en `Makefile`:

```bash
make python-install
```

## 3. Motivo

Cloudflare Pages solo necesita Node/npm para ejecutar:

```bash
npm run build
```

con output:

```text
dist
```

Aislar dependencias Python mejora limpieza de build, reduce tiempo potencial y evita instalaciones que no forman parte del deploy frontend.

## 4. Flujo local ETL preservado

Para instalar dependencias Python localmente:

```bash
python -m pip install -r tools/python/requirements.txt
```

O:

```bash
make python-install
```

Los scripts Python históricos siguen en `src/` y los datos históricos se preservan.

## 5. Validación esperada en Cloudflare

En el próximo build log de Cloudflare debe verificarse que no aparezca:

```text
pip install -r requirements.txt
```

Si Cloudflare sigue instalando Python, revisar configuración del proyecto, variables, framework preset o scripts custom.

## 6. Configuración Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Node: compatible con `.node-version` (`22.16.0`)
- No configurar backend, Functions, D1 ni Railway en V10.4

## 7. Rollback

Si algún flujo local depende de `requirements.txt` en raíz, se puede crear una instrucción documental o comando que apunte a `tools/python/requirements.txt`. No se recomienda restaurar `requirements.txt` en raíz para el deploy frontend.
