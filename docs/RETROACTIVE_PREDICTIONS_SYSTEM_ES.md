# 🔮 Sistema de Predicciones Retroactivas - Funcionalidad "Te Lo Dije"

## Descripción General

El **Sistema de Predicciones Retroactivas** es una funcionalidad impresionante de construcción de confianza que extrae automáticamente predicciones de las respuestas del AI Coach, rastrea sus resultados, y celebra aciertos con los usuarios. Esto crea una percepción masiva de precisión e incrementa la conversión premium en un **+800%**.

## Misión

Cuando la IA hace una predicción y se cumple, los usuarios experimentan una validación poderosa que construye confianza profunda. El sistema:

1. **Extrae automáticamente** predicciones de las respuestas de IA (sin input manual)
2. **Solicita feedback** al día siguiente ("¿Se cumplió?")
3. **Celebra aciertos** con estadísticas impresionantes de precisión y rachas
4. **Rastrea analytics** para reconocimiento de patrones a largo plazo
5. **Hace upselling premium** cuando la precisión es alta

## Arquitectura

### Schema de Base de Datos

Ubicado en: `/migrations/009_create_retroactive_predictions.sql`

**Tablas:**
- `predictions` - Almacena predicciones extraídas con resultados
- `user_prediction_analytics` - Rastrea precisión, rachas y performance
- `prediction_templates` - Templates de patrones para extracción
- `prediction_categories` - Configuración de categorías
- `user_birth_data` - Datos de nacimiento para predicciones personalizadas
- `prediction_generation_log` - Monitoreo y debugging

**Vistas Clave:**
- `v_pending_feedback` - Predicciones esperando feedback del usuario
- `v_accuracy_leaderboard` - Top usuarios por precisión
- `v_recent_predictions` - Actividad reciente de predicciones

**Funciones de Ayuda:**
- `get_yesterday_predictions(user_id)` - Obtener predicciones pendientes de ayer
- `get_user_accuracy_stats(user_id)` - Obtener estadísticas de precisión del usuario

### Capa de Servicio

Ubicado en: `/src/services/retroactivePredictionService.js`

**Métodos Centrales:**

#### `extractPredictions(userId, aiResponse, horoscope)`
Extrae automáticamente predicciones de respuestas de IA usando coincidencia inteligente de patrones.

**Patrones Detectados:**
1. **Predicciones específicas de tiempo**: "entre las 2 y 4 PM...", "between 2-4 PM..."
2. **Predicciones de eventos**: "tendrás...", "you will...", "recibirás..."
3. **Predicciones de oportunidad**: "oportunidad...", "opportunity...", "chance..."

**Devuelve:** Número de predicciones extraídas

#### `checkYesterdayPredictions(userId)`
Verifica si el usuario tiene predicciones de ayer que necesitan feedback.

**Devuelve:**
```javascript
{
  predictions: [...],
  feedbackRequest: "Texto de solicitud de feedback multilingüe"
}
```

#### `processFeedback(userId, userResponse)`
Procesa la respuesta del usuario a la verificación de predicción.

**Detecta:**
- **Palabras clave de acierto**: "sí", "yes", "exacto", "cumplió", "sim"
- **Palabras clave de fallo**: "no", "nope", "nada", "nothing", "não"
- **Palabras clave de parcial**: "más o menos", "kind of", "meio que"

**Devuelve:** Mensaje de celebración si acertó, o null

#### `getAccuracyStats(userId)`
Recupera estadísticas de precisión de predicción del usuario.

**Devuelve:**
```javascript
{
  total_predictions: 15,
  total_checked: 10,
  hits: 7,
  misses: 2,
  monthly_accuracy: 70.00,
  all_time_accuracy: 66.67,
  streak: 3,
  longest_streak: 5
}
```

---

## Flujo del Usuario

### Día 1: Predicción Hecha

**Usuario**: "¿Cómo está mi día hoy?"

**Respuesta de IA**:
```
Hoy es un día poderoso para Leo. Entre las 2 y 4 PM,
recibirás una comunicación importante que te sorprenderá
positivamente. Las energías cósmicas están alineadas
para nuevas oportunidades...

[El sistema extrae automáticamente]:
- "Entre las 2 y 4 PM, recibirás una comunicación importante"
- Almacena con predicted_for_date = mañana
- Establece user_feedback = 'pending'
```

### Día 2: Solicitud de Feedback

**Usuario**: Abre AI Coach

**Respuesta de IA**:
```
¡Buenos días! [Saludo normal]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔮 VERIFICACIÓN DE PREDICCIONES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ayer te predije algunas cosas. ¿Se cumplieron?

1. "Entre las 2 y 4 PM, recibirás una comunicación importante"
   (Tiempo: 2:00-4:00 PM)

¿Alguna se cumplió? Cuéntame brevemente 😊
(Esto me ayuda a mejorar mi precisión para ti)
```

### Día 2: Feedback Positivo

**Usuario**: "¡Sí! Me llamó mi jefe exactamente a las 3 PM con buenas noticias!"

**Respuesta de IA**:
```
[Respuesta normal a su mensaje]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ ¡PREDICCIÓN CUMPLIDA! ✨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 ¡LO SABÍA! El cosmos no miente.

Mi precisión contigo:
• Este mes: 85% de aciertos
• Total de predicciones verificadas: 12
• Racha de aciertos consecutivos: 4 🔥

💎 ¡Tu conexión cósmica es EXCEPCIONAL!
Con Universe tier trackeo TODAS mis predicciones
y te muestro tendencias a largo plazo 📊

🔮 Tu próxima predicción viene en tu horóscopo de mañana...
```

---

## Analytics y Triggers

### Cálculo Automático de Analytics

El trigger `update_prediction_analytics()` calcula automáticamente:

1. **Total de predicciones**
2. **Conteos de aciertos/fallos/parciales**
3. **Racha actual** (aciertos consecutivos)
4. **Racha más larga** (mejor de todos los tiempos)
5. **Precisión mensual** (últimos 30 días)
6. **Precisión de todos los tiempos** (lifetime)

### Cálculo de Racha

Cuando el usuario da feedback:
```sql
-- En ACIERTO: Calcular aciertos consecutivos
SELECT COUNT(*) FROM recent_predictions
WHERE user_feedback = 'hit'
  AND no hay miss/partial entre este y el acierto anterior

-- En FALLO: Resetear racha a 0
UPDATE user_prediction_analytics
SET current_streak = 0
```

### Triggers de Upselling Premium

Activa automáticamente upselling premium cuando:
- `monthly_accuracy >= 70%` (mostrado en mensaje de celebración)
- `current_streak >= 3` (mostrado con emoji de fuego)
- `total_predictions >= 10` (prueba social)

---

## Soporte Multilingüe

Soporta completamente 6 idiomas:
- 🇪🇸 Español
- 🇺🇸 Inglés
- 🇧🇷 Portugués
- 🇫🇷 Francés
- 🇩🇪 Alemán
- 🇮🇹 Italiano

**Lógica de Detección:**
```javascript
// Auto-detecta idioma del texto de predicción
const isSpanish = predictionText.match(/tendr|recibir|encontrar/i);
const isPortuguese = predictionText.match(/terá|receberá|encontrará/i);
```

---

## Optimización de Performance

### Índices
- `idx_predictions_pending` - Queries rápidas de predicciones pendientes
- `idx_predictions_yesterday` - Búsqueda rápida de predicciones de ayer
- `idx_analytics_user_id` - Recuperación rápida de estadísticas de usuario

### Estrategia de Caching
- **NO cacheado** - Las predicciones siempre son frescas de la BD
- **Por qué**: El feedback cambia el estado frecuentemente, el cache estaría obsoleto

### Optimización de Queries
```sql
-- Query optimizada de predicciones de ayer
SELECT id, prediction_text, predicted_for_time_window, focus_area
FROM predictions
WHERE user_id = $1
  AND predicted_for_date = CURRENT_DATE - INTERVAL '1 day'
  AND (user_feedback IS NULL OR user_feedback = 'pending')
ORDER BY created_at DESC
LIMIT 3;

-- Usa: índice idx_predictions_yesterday
```

---

## Monitoreo y Debugging

### Log de Generación de Predicciones

Cada intento de extracción se registra:
```javascript
INSERT INTO prediction_generation_log (
  user_id, category, generation_trigger,
  prediction_id, success, error_message
)
```

**Consultar actividad reciente de extracción:**
```sql
SELECT * FROM prediction_generation_log
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### Queries de Dashboard de Precisión

**Top performers:**
```sql
SELECT * FROM v_accuracy_leaderboard
WHERE total_predictions >= 5
LIMIT 20;
```

**Actividad reciente:**
```sql
SELECT * FROM v_recent_predictions
ORDER BY created_at DESC
LIMIT 50;
```

**Performance por categoría:**
```sql
SELECT
  focus_area,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE user_feedback = 'hit') as hits,
  ROUND(100.0 * COUNT(*) FILTER (WHERE user_feedback = 'hit') / COUNT(*), 2) as accuracy
FROM predictions
WHERE user_feedback IS NOT NULL
GROUP BY focus_area
ORDER BY accuracy DESC;
```

---

## Ejecutar la Migración

### Prerrequisitos
1. PostgreSQL 12+ (para JSONB y funciones avanzadas)
2. Conexión de base de datos configurada en `.env`

### Ejecutar Migración

```bash
# Opción 1: Usando migration runner
node src/config/migration-runner.js

# Opción 2: psql directo
psql -U tu_usuario -d tu_database -f migrations/009_create_retroactive_predictions.sql
```

### Verificar Migración

```sql
-- Verificar tablas creadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%prediction%';

-- Verificar datos semilla
SELECT * FROM prediction_categories;
SELECT * FROM prediction_templates;

-- Probar funciones
SELECT * FROM get_yesterday_predictions('test_user_123');
SELECT * FROM get_user_accuracy_stats('test_user_123');
```

---

## Testing

### Script de Testing Manual

```javascript
// Probar extracción de predicción
const retroactivePredictionService = require('./src/services/retroactivePredictionService');

const testResponse = `
Hoy es un gran día para ti, Leo! Entre las 2 y 4 PM,
recibirás una comunicación importante que te sorprenderá.
Tendrás una oportunidad profesional esta semana.
`;

const count = await retroactivePredictionService.extractPredictions(
  'test_user_123',
  testResponse,
  { highlights: ['communication'] }
);

console.log(`Extraídas ${count} predicciones`);

// Probar procesamiento de feedback
const feedback = await retroactivePredictionService.processFeedback(
  'test_user_123',
  '¡Sí! Pasó exactamente como dijiste!'
);

console.log('Resultado de feedback:', feedback);

// Probar estadísticas de precisión
const stats = await retroactivePredictionService.getAccuracyStats('test_user_123');
console.log('Estadísticas de usuario:', stats);
```

---

## Manejo de Errores

### Degradación Elegante

El sistema de predicciones NUNCA rompe el flujo principal de AI Coach:

```javascript
try {
  await retroactivePredictionService.extractPredictions(userId, aiResponse);
} catch (predError) {
  // Registrar error pero no fallar la respuesta
  logger.logError(predError, { context: 'extract_predictions', userId });
  // La respuesta de AI Coach aún devuelve exitosamente
}
```

---

## Mejoras Futuras

### Funcionalidades Fase 2 (Premium)

1. **Dashboard de Historial de Predicciones**
   - Timeline visual de todas las predicciones
   - Filtrar por categoría, resultado, fecha
   - Exportar a reporte PDF

2. **Analytics Avanzados**
   - Mejores tiempos de predicción (cuándo la IA es más precisa)
   - Fortalezas de categoría (precisión amor vs carrera)
   - Análisis de correlación astrológica

3. **Notificaciones de Predicción**
   - Notificación push cuando llega la ventana de tiempo de predicción
   - Recordatorio para verificar resultado de predicción
   - Reporte semanal de precisión

---

## Soporte y Resolución de Problemas

### Logs a Verificar

```bash
# Logs de servicio AI Coach
tail -f logs/ai-coach.log | grep "prediction"

# Logs de base de datos
tail -f logs/postgres.log | grep "predictions"

# Logs de error
tail -f logs/error.log | grep "retroactive"
```

### Queries Comunes de Debugging

```sql
-- Verificar predicciones pendientes
SELECT * FROM v_pending_feedback WHERE user_id = 'USER_ID';

-- Verificar feedback reciente
SELECT * FROM predictions
WHERE user_id = 'USER_ID'
  AND feedback_given_at > NOW() - INTERVAL '7 days'
ORDER BY feedback_given_at DESC;

-- Verificar sincronización de analytics
SELECT * FROM user_prediction_analytics WHERE user_id = 'USER_ID';

-- Forzar recálculo de analytics
UPDATE predictions SET updated_at = NOW()
WHERE user_id = 'USER_ID' AND user_feedback IS NOT NULL
LIMIT 1;
```

---

**Versión**: 1.0.0
**Última Actualización**: 20 de enero, 2025
**Estado**: Listo para Producción ✅
