# 🚀 Goal Planner Deployment Checklist

## ✅ Completado (Local)

### Código
- [x] Goal Planner Service creado (`goalPlannerService.js`)
- [x] API Routes implementadas (`goalPlanner.js`)
- [x] Integración en app.js
- [x] Database migration creada
- [x] Tests escritos y ejecutados (3/5 passing)
- [x] Documentación completa
- [x] Git commit creado
- [x] Push a GitHub completado

### Testing Local
- [x] Health check funcionando
- [x] Get user goals funcionando
- [x] Analytics funcionando
- [x] OpenAI conectado localmente

## 🔄 Pendiente (Railway)

### 1. Configurar Variable de Entorno en Railway
**IMPORTANTE: Hazlo manualmente desde el dashboard web**

1. Ve a https://railway.app/dashboard
2. Selecciona proyecto: `zodiac-backend-api`
3. Selecciona environment: `production`
4. Click en "Variables"
5. Agrega nueva variable:
   ```
   Name: OPENAI_API_KEY
   Value: [Get from /Users/alejandrocaceres/Desktop/appstore - zodia/OPENIA file]
   ```
6. Guarda cambios

### 2. Ejecutar Migration en Railway

**Opción A: Via Railway CLI**
```bash
# Link al servicio correcto
railway link

# Ejecutar migration
railway run "node -e \"const { Pool } = require('pg'); require('dotenv').config(); const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }); const fs = require('fs'); const sql = fs.readFileSync('migrations/010_create_premium_goals_tables.sql', 'utf8'); pool.query(sql).then(() => { console.log('Migration completed'); pool.end(); }).catch(e => { console.error('Error:', e.message); pool.end(); });\""
```

**Opción B: Crear script y ejecutar**
```bash
# Crear archivo run-migration.js
cat > run-migration.js << 'EOF'
const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sql = fs.readFileSync('migrations/010_create_premium_goals_tables.sql', 'utf8');

pool.query(sql)
  .then(() => {
    console.log('✅ Migration 010 completed successfully');
    pool.end();
    process.exit(0);
  })
  .catch(e => {
    console.error('❌ Migration failed:', e.message);
    pool.end();
    process.exit(1);
  });
EOF

# Ejecutar en Railway
railway run node run-migration.js
```

**Opción C: Trigger Redeploy** (más simple)
Railway detectará el cambio en Git y ejecutará automáticamente las migraciones al iniciar.

### 3. Verificar Deployment

**A. Check Health**
```bash
curl https://zodiac-backend-api-production-8ded.up.railway.app/api/ai/goals/health
```

Esperado:
```json
{
  "success": true,
  "service": "goalPlanner",
  "status": "healthy",
  "timestamp": "2025-10-07..."
}
```

**B. Check API Docs**
```bash
curl https://zodiac-backend-api-production-8ded.up.railway.app/api/docs
```

Debería incluir Goal Planner endpoints en la respuesta.

**C. Test Goal Generation** (requiere premium user)
```bash
curl -X POST https://zodiac-backend-api-production-8ded.up.railway.app/api/ai/goals \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "zodiacSign": "aries",
    "objective": "I want to advance my career",
    "emotionalState": "motivated",
    "focusArea": "career",
    "timeframe": "monthly",
    "languageCode": "en"
  }'
```

**D. Check Railway Logs**
```bash
railway logs
```

Buscar:
- `✅ All services initialized successfully`
- `✅ Migration completed: 010_create_premium_goals_tables.sql`
- `🤖 OpenAI: Configured ✅`

### 4. Monitoreo Post-Deploy

**Verificar OpenAI Usage**
- https://platform.openai.com/usage
- Verificar que aparecen requests del Goal Planner

**Verificar Database**
```bash
railway run "psql \$DATABASE_URL -c 'SELECT COUNT(*) FROM premium_goals;'"
```

**Check Errors**
```bash
railway logs --tail 100 | grep -i error
```

## 📊 Métricas a Monitorear

### Inmediato (Primeros 3 días)
- [ ] Health check responde 200 OK
- [ ] Goal generation exitosa (200 response)
- [ ] OpenAI API no retorna errores
- [ ] Database guarda goals correctamente
- [ ] No errores 500 en logs

### Primera Semana
- [ ] Al menos 5 goals generados
- [ ] Tiempo de respuesta < 5 segundos promedio
- [ ] No timeouts de OpenAI
- [ ] Costos OpenAI dentro de presupuesto (~$1.50/día)

### Primer Mes
- [ ] 40% de usuarios Stellar crean una goal
- [ ] Promedio 4+ check-ins por usuario
- [ ] 0 errores críticos
- [ ] NPS > 70 en encuestas

## 🔧 Troubleshooting

### Si Goal Generation Falla

**Error: "OpenAI API key not found"**
```bash
# Verificar variable en Railway
railway variables

# Si no está, agregar:
railway variables --set OPENAI_API_KEY="sk-proj-..."
```

**Error: "Table premium_goals does not exist"**
```bash
# Ejecutar migration manualmente
railway run node run-migration.js
```

**Error: "OpenAI timeout"**
- Aumentar `timeoutMs` en `goalPlannerService.js` config
- Verificar status de OpenAI: https://status.openai.com

**Error: "Premium access required"**
- Implementar integración con RevenueCat en `validatePremiumAccess`
- Por ahora usa mock validation (acepta todos)

### Si Deployment Falla

**Build fails**
```bash
# Verificar Railway logs
railway logs

# Verificar package.json tiene todas las dependencias
npm install
```

**Service won't start**
```bash
# Check Railway dashboard
# Verificar que PORT variable está configurada (Railway lo hace automáticamente)
# Verificar DATABASE_URL está presente
```

## 🎯 Próximos Pasos

### Integración Flutter (Fase 1B)
- [ ] Crear `GoalPlannerService` en Flutter
- [ ] Agregar modelos `Goal`, `WeeklyFocus`, `MicroHabit`
- [ ] Crear `GoalPlannerScreen` con UI
- [ ] Integrar con `PremiumProvider` (Stellar gate)
- [ ] Agregar navigation desde Premium screen

### Mejoras Backend (Fase 2)
- [ ] Agregar Redis cache para goals
- [ ] Implementar retry logic para OpenAI
- [ ] Agregar astrological timing calculations
- [ ] Implementar PDF generation
- [ ] Agregar push notifications system

### Analytics & Optimización (Fase 2)
- [ ] Implementar tracking de conversiones
- [ ] A/B testing de prompts
- [ ] Optimizar costos OpenAI (cache responses similares)
- [ ] Dashboard de métricas en admin panel

## 📝 Notas Importantes

1. **OpenAI Key**: La clave en el archivo `OPENIA` debe configurarse manualmente en Railway dashboard
2. **Premium Validation**: Actualmente usa mock validation. Integrar RevenueCat en producción.
3. **Costos**: Monitorear uso de OpenAI. Budget: $45/mes para 100 goals/día.
4. **Rate Limits**: 5 goals/hora por IP. Ajustar si es necesario.
5. **Database**: Migration se ejecuta automáticamente en startup si falta.

## 🔗 Links Útiles

- **Railway Dashboard**: https://railway.app/dashboard
- **OpenAI Usage**: https://platform.openai.com/usage
- **GitHub Repo**: https://github.com/Lalezito/flutter-horoscope-backend
- **API Health**: https://zodiac-backend-api-production-8ded.up.railway.app/health
- **API Docs**: https://zodiac-backend-api-production-8ded.up.railway.app/api/docs
- **Implementation Docs**: GOAL_PLANNER_IMPLEMENTATION.md

---

**Status**: ✅ Código deployed a GitHub | ⏳ Pendiente Railway variable config
**Última actualización**: October 7, 2025
**Commit**: b15b972 - feat: add AI-powered Goal Planner
