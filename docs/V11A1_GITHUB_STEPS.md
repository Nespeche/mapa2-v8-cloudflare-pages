# V11A.1 — GitHub Steps

## Antes de commitear

Ejecutar desde PowerShell en la raíz del proyecto:

```powershell
npm install
npm run data:d1:build
npm run data:d1:validate
npm run data:d1:readmodels
npm run data:api-cache:build
npm run audit:d1
npm run audit:api-budget
npm run audit:query-plans
npm run build
npm run validate:v11a
npm run validate:v11a1
```

## Verificar archivos prohibidos

```powershell
git status --short
git ls-files | Select-String -Pattern "node_modules|\.env|dist|\.zip$|\.sqlite$|\.db$|\.wrangler|\.git"
```

No subir:

- `node_modules/`
- `dist/`
- `.env`
- `.wrangler/`
- `.git/`
- `*.sqlite`, `*.db`, `*.zip`

El `.gitignore` conserva reglas para no subir datos pesados no requeridos por Cloudflare Pages.

## Commit

```powershell
git status
git add .
git commit -m "V11A.1 Cloudflare Free optimization and API read models"
git push origin main
```

## Validación posterior

Después del push, revisar en GitHub:

- Que no se hayan subido secretos.
- Que no aparezcan binarios locales prohibidos.
- Que los scripts y docs V11A.1 estén incluidos.
- Que Cloudflare Pages inicie deploy automático.
