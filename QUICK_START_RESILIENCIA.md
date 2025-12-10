# ⚡ QUICK START - Resiliencia Backend

**Lectura rápida: 5 minutos**

---

## 🎯 ¿Qué hemos implementado?

Tu backend ahora tiene **protección completa contra caídas** con:

- ✅ **PM2**: Auto-restart si el proceso crashea
- ✅ **Circuit Breakers**: Protección contra servicios fallando
- ✅ **Retry Logic**: Reintentos automáticos en errores
- ✅ **Health Monitoring**: Monitoreo 24/7
- ✅ **Alerting**: Notificaciones automáticas
- ✅ **Database Resilience**: Auto-reconnect a PostgreSQL

---

## 🚀 Deploy en Railway (3 pasos)

### 1. Push a GitHub
```bash
git add .
git commit -m "feat: backend resilience system complete"
git push origin main
```

### 2. Crear Proyecto en Railway
1. Ir a [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub repo"
3. Seleccionar tu repositorio
4. Railway auto-detecta `nixpacks.toml` y `Procfile`

### 3. Agregar PostgreSQL
1. Click "Add Service" → "Database" → "PostgreSQL"
2. Railway auto-provisiona `DATABASE_URL`
3. Agregar variables de entorno (ver abajo)

---

## 🔐 Variables de Entorno CRÍTICAS

Copiar estas en Railway Dashboard → Variables:

```bash
# Core
NODE_ENV=production
PORT=3000

# OpenAI
OPENAI_API_KEY=sk-xxxxx

# Security
JWT_SECRET=tu-secret-super-seguro
ADMIN_KEY=tu-admin-key

# Monitoring (opcional)
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxxxx

# Database (auto-provisionada por Railway)
DATABASE_URL=${RAILWAY_DATABASE_URL}
```

---

## ✅ Verificar que funciona

### 1. Health Check
```bash
curl https://tu-app.railway.app/health
```

Debe retornar:
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "api": "operational"
  }
}
```

### 2. Ver Logs
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Ver logs en tiempo real
railway logs -f
```

### 3. Test Auto-Restart

El backend se reiniciará automáticamente si:
- Process crashea → PM2 reinicia en 4 segundos
- Memory > 500MB → PM2 reinicia automáticamente
- Health check falla → Railway reinicia el servicio

---

## 📊 Monitoreo

### Dashboard de Salud
```bash
# Health general
curl https://tu-app.railway.app/health

# Health detallada (admin)
curl "https://tu-app.railway.app/api/admin/health?admin_key=TU_KEY"
```

### Ver Métricas en Railway
1. Ir a Railway Dashboard
2. Seleccionar tu servicio
3. Ver gráficas de:
   - CPU usage
   - Memory usage
   - Request rate
   - Response time

---

## 🚨 Alertas

### Configurar Slack (Recomendado)

1. Crear Slack Incoming Webhook:
   - Ir a https://api.slack.com/messaging/webhooks
   - Create New Webhook
   - Copiar URL

2. Agregar en Railway:
   ```bash
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxxxx
   ```

3. Recibirás alertas cuando:
   - Database se desconecta
   - Memory > 90%
   - Circuit breaker se abre
   - 3+ health checks fallan

---

## 🛠️ Troubleshooting Rápido

### Problema: "Database connection failed"
**Solución**: El backend auto-reconecta en 30 segundos. Ver logs:
```bash
railway logs | grep "database"
```

### Problema: "Circuit breaker is OPEN"
**Solución**: Esperar 30 segundos para que reset automáticamente. O reiniciar:
```bash
railway restart
```

### Problema: "Memory limit exceeded"
**Solución**: PM2 reinicia automáticamente. Si persiste, ver logs:
```bash
railway logs | grep "Memory"
```

### Problema: "Health check timeout"
**Solución**: Servicios pueden tardar en inicializar. Esperar 2 minutos después de deploy.

---

## 📁 Archivos Clave

```
backend/
├── ecosystem.config.js           # Configuración PM2
├── Procfile                       # Railway start command
├── nixpacks.toml                  # Railway build config
├── src/
│   ├── config/
│   │   ├── resilience.js          # Circuit breakers, retry logic
│   │   └── db-resilient.js        # Database auto-reconnect
│   └── services/
│       ├── healthMonitor.js       # Health checks continuos
│       └── alerting.js            # Sistema de alertas
└── BACKEND_RESILIENCIA_COMPLETA.md  # Documentación completa
```

---

## 🎯 Próximos Pasos

1. **Deploy** → Seguir los 3 pasos arriba
2. **Verificar** → Probar `/health` endpoint
3. **Configurar Alertas** → Agregar Slack webhook
4. **Monitorear** → Ver logs y métricas en Railway

---

## 📚 Documentación Completa

Para detalles avanzados, ver:
- **[BACKEND_RESILIENCIA_COMPLETA.md](./BACKEND_RESILIENCIA_COMPLETA.md)** - Documentación detallada (50+ páginas)

---

## ✨ Resultado Final

Tu backend ahora:
- ✅ **SE REINICIA SOLO** si crashea
- ✅ **SE RECONECTA SOLO** si pierde database
- ✅ **TE AVISA** cuando algo falla
- ✅ **SE MONITOREA** 24/7
- ✅ **NUNCA SE CAE** permanentemente

**¡Listo para producción!** 🚀

---

*Para soporte: ver logs con `railway logs` o contactar admin@zodiacapp.com*
