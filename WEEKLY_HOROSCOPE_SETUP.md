# 🌟 Weekly Horoscope Generation Setup

## Sistema Autónomo con OpenAI

Este sistema genera automáticamente 72 horóscopos semanales (12 signos × 6 idiomas) usando OpenAI GPT-4o-mini.

---

## 📋 Requisitos Previos

1. **OpenAI API Key**
   - Crea una cuenta en https://platform.openai.com
   - Ve a https://platform.openai.com/api-keys
   - Crea una nueva API key
   - Costo estimado: ~$0.05-0.10 por generación completa de 72 horóscopos

2. **Railway Variables Configuradas**
   - `OPENAI_API_KEY` - Tu API key de OpenAI
   - `ADMIN_KEY` - Ya configurada: `ZodiacLifeCoach2025AdminKey64CharactersLongForSecurityPurposes`
   - `DATABASE_URL` - Ya configurada automáticamente por Railway

---

## ⚙️ Configuración

### Opción A: Railway Dashboard (Recomendado)

1. Ve a [Railway Dashboard](https://railway.app)
2. Selecciona el proyecto `zodiac-backend-api-production`
3. Ve a la pestaña **Variables**
4. Click en **+ New Variable**
5. Agrega:
   ```
   Name: OPENAI_API_KEY
   Value: sk-proj-...tu-api-key...
   ```
6. Click **Add**
7. Railway redesplegará automáticamente el backend (~30-60 segundos)

### Opción B: Railway CLI

```bash
# Instalar Railway CLI (si no lo tienes)
npm install -g @railway/cli

# Login
railway login

# Link al proyecto
cd backend/flutter-horoscope-backend
railway link

# Agregar variable
railway variables set OPENAI_API_KEY=sk-proj-...tu-api-key...
```

---

## 🚀 Uso

### 1. Generar Horóscopos Semanales

```bash
# Método 1: Usando el script helper
cd backend/flutter-horoscope-backend
export ADMIN_KEY=ZodiacLifeCoach2025AdminKey64CharactersLongForSecurityPurposes
./generate_weekly.sh

# Método 2: Curl directo
curl -X POST "https://zodiac-backend-api-production-8ded.up.railway.app/api/weekly/generate?admin_key=ZodiacLifeCoach2025AdminKey64CharactersLongForSecurityPurposes"
```

**Tiempo estimado**: 1-2 minutos (genera 72 horóscopos)
**Costo estimado**: $0.05-0.10 USD

### 2. Verificar Coverage

```bash
curl "https://zodiac-backend-api-production-8ded.up.railway.app/api/weekly/checkMissing?admin_key=ZodiacLifeCoach2025AdminKey64CharactersLongForSecurityPurposes" | jq '.'
```

**Respuesta esperada**:
```json
{
  "missing_count": 0,
  "expected_total": 72,
  "missing_horoscopes": [],
  "coverage_percentage": 100
}
```

### 3. Forzar Regeneración

Si quieres regenerar los horóscopos de esta semana:

```bash
curl -X POST "https://zodiac-backend-api-production-8ded.up.railway.app/api/weekly/generate?admin_key=ZodiacLifeCoach2025AdminKey64CharactersLongForSecurityPurposes&force=true"
```

---

## 📊 Endpoints Disponibles

### GET `/api/weekly/getWeeklyHoroscope`
Obtiene un horóscopo semanal específico.

```bash
curl "https://zodiac-backend-api-production-8ded.up.railway.app/api/weekly/getWeeklyHoroscope?sign=Aries&lang=en"
```

### GET `/api/weekly/getAllWeeklyHoroscopes`
Obtiene todos los horóscopos semanales (opcionalmente filtrados por idioma).

```bash
curl "https://zodiac-backend-api-production-8ded.up.railway.app/api/weekly/getAllWeeklyHoroscopes?lang=es"
```

### GET `/api/weekly/checkMissing`
Verifica qué horóscopos faltan (requiere admin_key).

```bash
curl "https://zodiac-backend-api-production-8ded.up.railway.app/api/weekly/checkMissing?admin_key=YOUR_ADMIN_KEY"
```

### POST `/api/weekly/generate`
Genera todos los horóscopos semanales usando OpenAI (requiere admin_key).

```bash
curl -X POST "https://zodiac-backend-api-production-8ded.up.railway.app/api/weekly/generate?admin_key=YOUR_ADMIN_KEY"
```

---

## 🤖 Automatización (Opcional)

### Opción 1: Cron Job en Railway

Agrega a `src/app-production.js`:

```javascript
const cron = require('node-cron');

// Ejecutar cada lunes a las 6 AM
cron.schedule('0 6 * * 1', async () => {
  console.log('🌟 Running weekly horoscope generation...');
  try {
    const weeklyController = require('./controllers/weeklyController');
    const result = await weeklyController.generateWeeklyHoroscopes({
      query: { admin_key: process.env.ADMIN_KEY, force: false }
    }, {
      json: (data) => console.log('Generation result:', data),
      status: (code) => ({ json: (data) => console.log('Error:', data) })
    });
    console.log('✅ Weekly horoscopes generated');
  } catch (error) {
    console.error('❌ Failed to generate weekly horoscopes:', error);
  }
});
```

### Opción 2: GitHub Actions

Crea `.github/workflows/weekly-horoscopes.yml`:

```yaml
name: Generate Weekly Horoscopes

on:
  schedule:
    - cron: '0 6 * * 1'  # Cada lunes a las 6 AM UTC
  workflow_dispatch:  # Permite ejecución manual

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - name: Generate Weekly Horoscopes
        run: |
          curl -X POST "https://zodiac-backend-api-production-8ded.up.railway.app/api/weekly/generate?admin_key=${{ secrets.ADMIN_KEY }}"
```

---

## 🔍 Troubleshooting

### Error: "Connection error"
- **Causa**: OPENAI_API_KEY no configurada o inválida
- **Solución**: Verifica que la variable esté configurada en Railway

### Error: "Unauthorized"
- **Causa**: ADMIN_KEY incorrecta
- **Solución**: Usa la key correcta: `ZodiacLifeCoach2025AdminKey64CharactersLongForSecurityPurposes`

### Error: "Horoscopes already exist for this week"
- **Causa**: Ya se generaron horóscopos para esta semana
- **Solución**: Usa `force=true` para regenerar

### La app Flutter muestra "fallback local"
- **Causa**: No hay horóscopos en la base de datos para esta semana
- **Solución**: Ejecuta la generación con `./generate_weekly.sh`

---

## 💡 Tips

1. **Frecuencia**: Genera cada lunes para tener contenido fresco toda la semana
2. **Costo**: Muy económico con GPT-4o-mini (~$0.10 por semana)
3. **Calidad**: El prompt está optimizado para generar horóscopos detallados y útiles
4. **Cache**: Los horóscopos se guardan en PostgreSQL y se sirven desde ahí
5. **Multiidioma**: Genera automáticamente en 6 idiomas

---

## 📝 Notas

- Los horóscopos generados son **únicos cada semana**
- Se almacenan en la tabla `weekly_horoscopes` de PostgreSQL
- La app Flutter tiene fallback local si no hay datos
- El sistema es completamente autónomo (no depende de n8n)
- Usa GPT-4o-mini para balance costo/calidad óptimo

---

## ✅ Checklist de Implementación

- [ ] Crear API key en OpenAI
- [ ] Configurar `OPENAI_API_KEY` en Railway
- [ ] Esperar redeployment de Railway (~60 segundos)
- [ ] Ejecutar primera generación con `./generate_weekly.sh`
- [ ] Verificar coverage con `/checkMissing`
- [ ] Probar endpoint `/getWeeklyHoroscope` desde la app
- [ ] (Opcional) Configurar cron job para automatización semanal

---

**Creado**: Octubre 2025
**Backend**: https://zodiac-backend-api-production-8ded.up.railway.app
**Modelo**: GPT-4o-mini
**Costo**: ~$0.05-0.10 por generación completa
