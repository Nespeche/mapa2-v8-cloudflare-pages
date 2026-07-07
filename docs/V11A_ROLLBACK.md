# Mapa 2 — V11A Rollback

## Caso 1 — Falló local antes de commit

No apliques remoto. Eliminá o revertí los cambios V11A desde Git:

```powershell
git status
git restore .
```

Si querés conservar los reportes para diagnóstico, copiá `docs/V11A_*.md` fuera del repo antes de restaurar.

## Caso 2 — Falló después del commit pero antes de Cloudflare remoto

```powershell
git log --oneline -5
git revert <HASH_DEL_COMMIT_V11A>
git push origin main
```

La app estática V10.4 seguirá funcionando porque V11A no reemplaza `public/data`, no cambia el frontend y no exige D1 para renderizar el mapa.

## Caso 3 — Falló migración local D1

Borrá la DB local de Wrangler o recreala:

```powershell
npx wrangler d1 migrations apply mapa2-db --local
```

Si la DB local quedó inconsistente, limpiá `.wrangler/` y repetí desde migración + seed. `.wrangler/` está ignorado.

## Caso 4 — Falló remoto después de aplicar migración

No edites la migración aplicada. Crear una nueva migración correctiva es más seguro que modificar una migración ya aplicada.

Opciones:

1. Crear una migración correctiva `0002_fix_*.sql`.
2. Cargar nuevamente chunks faltantes con `INSERT OR REPLACE`.
3. Si el problema es límite Free, esperar reset diario y continuar.
4. Si el problema es de diseño, detener remoto y volver al frontend estático mientras se corrige localmente.

## Caso 5 — Deploy Pages falló

V11A no requiere frontend API-first. Para volver a la versión estática previa:

```powershell
git revert <HASH_DEL_COMMIT_V11A>
git push origin main
```

En Cloudflare Pages, también podés promover un deploy anterior desde el dashboard si el proyecto ya tenía historial de deploys.

## Regla de seguridad

No avanzar a V11B si:

- `npm run build` falla.
- D1 local no crea tablas.
- D1 local no importa seed o chunks.
- Hay ventas/clientes/productos perdidos sin justificación.
- Cloudflare remoto supera límites y no hay estrategia de continuación documentada.
