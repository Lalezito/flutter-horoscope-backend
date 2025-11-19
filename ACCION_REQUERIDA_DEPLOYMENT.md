# ⚠️ ACCIÓN REQUERIDA: Railway Deployment Manual

## Situación Actual - 19 Nov 2025, 20:45 NZDT

### ❌ Problema Identificado

Railway **SÍ está haciendo auto-deploy** cuando hay push a GitHub (confirmado por el uptime de 47 segundos después del último commit), PERO está deployando código cacheado/antiguo con versión **2.1.1** en lugar de **2.2.0**.

### ✅ Estado del Código

```bash
✅ Código local: Version 2.2.0
✅ GitHub remoto: Version 2.2.0 (commit 887a411)
✅ package.json: "version": "2.2.0"
✅ src/app.js: version: '2.2.0' (4 ocurrencias)
❌ Railway producción: Version 2.1.1-production-gpt4omini
```

### 🔍 Diagnóstico

Railway está usando un **build cacheado** o tiene configuración que no está rebuilding correctamente. Los últimos 3 commits intentaron forzar rebuild:
- `095facd` - "force Railway rebuild - clear cache"
- `ad39fbf` - "bump version to 2.2.0 to force Railway redeploy"
- `887a411` - "trigger Railway deployment to v2.2.0" (commit vacío)

**Todos fallaron** - Railway sigue deployando versión antigua.

---

## 🎯 SOLUCIÓN: Deployment Manual via Railway Dashboard

### Opción 1: Re-deploy Manual (RECOMENDADO)

**Pasos:**

1. **Ir a Railway Dashboard:**
   ```
   https://railway.app/project/a06dde84-af4b-4c32-99d4-b1f536176a7d
   ```

2. **Login** con tu cuenta Railway

3. **Seleccionar el servicio** del backend (debería aparecer en el proyecto)

4. **Click en "Settings"** (engranaje en el sidebar)

5. **Buscar sección "Deploy"** o "Source"

6. **Verificar/Cambiar configuración:**
   - **Branch:** Debe ser `main` (NO `master` ni otro)
   - **Root Directory:** Debe estar vacío o `/`
   - **Build Command:** Debe usar nixpacks (default) o `npm install`
   - **Start Command:** `npm start`

7. **Ir a "Deployments" tab**

8. **Click en los 3 puntos** (...) del último deployment

9. **Click en "Redeploy"** o **"Deploy from source"**

10. **IMPORTANTE:** Marcar checkbox **"Clear build cache"** si existe

11. **Click en "Deploy"**

12. **Esperar 2-3 minutos** mientras Railway hace el build completo

13. **Verificar en "Deployment Logs"** que esté usando:
    - ✅ Commit: `887a411` o `ad39fbf` o `095facd`
    - ✅ Building con nixpacks
    - ✅ Installing dependencies
    - ✅ Starting app

14. **Una vez completado**, verificar con:
    ```bash
    curl https://zodiac-backend-api-production-8ded.up.railway.app/health | grep version
    ```
    Debe mostrar: `"version": "2.2.0"`

---

### Opción 2: Railway CLI (Alternativa)

Si prefieres usar la terminal:

```bash
# 1. Ir al directorio del backend
cd /Users/alejandrocaceres/Desktop/appstore.zodia/backend/flutter-horoscope-backend

# 2. Login a Railway (abrirá navegador)
railway login

# 3. Verificar autenticación
railway whoami

# 4. Verificar proyecto linked
railway status

# 5. Deployar con force clean build
railway up --detach

# 6. Esperar y verificar
sleep 120
curl https://zodiac-backend-api-production-8ded.up.railway.app/health | grep version
```

**Nota:** El login requerirá autenticación via navegador.

---

### Opción 3: Cambiar Configuración de Auto-Deploy

Si quieres que futuros commits se deployen automáticamente SIN cache:

1. **Railway Dashboard** → **Settings** → **Deploy**
2. **Buscar:** "Watch Paths" o "Deploy Configuration"
3. **Verificar:**
   - ✅ Auto-Deploy: Enabled
   - ✅ Branch: `main`
   - ✅ Production Branch: `main`
4. **Buscar opción:** "Build Settings" o "Nixpacks Configuration"
5. **Agregar variable de entorno:**
   ```
   NIXPACKS_NO_CACHE=1
   ```
   Esto forzará rebuilds limpios en cada deployment

---

## 🔍 Verificación Post-Deployment

Una vez deployado, ejecuta estos comandos para verificar:

### 1. Verificar versión y uptime
```bash
curl -s https://zodiac-backend-api-production-8ded.up.railway.app/health | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f\"Version: {data['version']}\")
print(f\"Uptime: {data['uptime']:.0f} segundos\")
print(f\"Status: {data['status']}\")
print('')
if '2.2.0' in data['version']:
    print('✅ DEPLOYMENT EXITOSO!')
else:
    print('❌ Aún en versión anterior')
"
```

**Esperado:**
```
Version: 2.2.0
Uptime: < 300 segundos
Status: healthy
✅ DEPLOYMENT EXITOSO!
```

### 2. Verificar endpoints críticos
```bash
# Health check
curl -s https://zodiac-backend-api-production-8ded.up.railway.app/health | jq .

# Horóscopo diario
curl -s "https://zodiac-backend-api-production-8ded.up.railway.app/api/coaching/getTodaysHoroscope?sign=aries&lang=es" | jq '.horoscope' | head -5

# Goal Planner (feature de v2.2.0)
curl -s "https://zodiac-backend-api-production-8ded.up.railway.app/api/goal-planner/health" | jq .
```

---

## 🐛 Si el Problema Persiste

Si después de hacer **Redeploy con "Clear Cache"** la versión sigue siendo 2.1.1:

### Posibles Causas:

1. **Railway está deployando desde un branch diferente**
   - Verificar en Settings → Deploy → Branch
   - Cambiar a `main` si está en otro branch

2. **Hay un rollback automático configurado**
   - Verificar en Deployments si hay rollback policy
   - Deshabilitar rollbacks automáticos

3. **Build está fallando y Railway usa deployment anterior**
   - Revisar logs del último deployment
   - Buscar errores en build logs
   - Verificar que `package.json` sea válido

4. **Railway está usando un snapshot/backup antiguo**
   - Contactar Railway Support
   - Explicar que está deployando código cacheado

### Solución Drástica: Re-crear Deployment

Si todo falla, crear un nuevo deployment desde cero:

1. Railway Dashboard → Settings → "Delete Service" (NO borrar proyecto completo)
2. Railway Dashboard → "New Service" → "Deploy from GitHub"
3. Seleccionar repo: `Lalezito/flutter-horoscope-backend`
4. Branch: `main`
5. Configurar variables de entorno (copiar del servicio anterior)
6. Deploy

---

## 📊 Configuración Actual

### Project Details
- **Project ID:** a06dde84-af4b-4c32-99d4-b1f536176a7d
- **Environment:** production (b2dab336-9e51-4742-bf4b-55e0092f4384)
- **URL:** https://zodiac-backend-api-production-8ded.up.railway.app
- **GitHub Repo:** https://github.com/Lalezito/flutter-horoscope-backend
- **Branch:** main (debe ser este)

### Archivos Relevantes
- ✅ `railway.toml` - Config de Railway
- ✅ `package.json` - Dependencies y version
- ✅ `src/app.js` - Main app con version hardcoded
- ✅ `.railway.json` - Local project config

---

## ⏱️ Tiempo Estimado

- **Opción 1 (Dashboard):** 5 minutos
- **Opción 2 (CLI):** 7 minutos (incluye login)
- **Opción 3 (Config):** 3 minutos + tiempo de Opción 1

---

## 📞 Ayuda Adicional

### Railway Docs
- Deploy from GitHub: https://docs.railway.app/deploy/deployments
- Clear Cache: https://docs.railway.app/deploy/builds#cache

### Railway Support
- Help Center: https://railway.app/help
- Discord: https://discord.gg/railway

---

## ✅ Checklist Final

Antes de cerrar este deployment, verificar:

- [ ] Versión en producción es 2.2.0
- [ ] Uptime < 5 minutos (deployment reciente)
- [ ] Health endpoint responde correctamente
- [ ] Endpoints de horóscopo funcionan
- [ ] Goal Planner endpoint responde
- [ ] Logs no muestran errores críticos
- [ ] Auto-deploy configurado correctamente para futuros pushes

---

*Documento creado: 19 Nov 2025, 20:45 NZDT*
*Última verificación: Railway deployando v2.1.1 (incorrect)*
*Acción requerida: Manual redeploy via Dashboard*
