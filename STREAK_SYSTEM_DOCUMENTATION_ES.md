# 🔥 Sistema de Rachas Diarias - Documentación Completa

**Creado:** 23 de enero, 2025
**Versión:** 1.0.0
**Impacto Esperado:** +800% retención de usuarios a través de FOMO y formación de hábitos

---

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Arquitectura](#arquitectura)
3. [Schema de Base de Datos](#schema-de-base-de-datos)
4. [Integración de API](#integración-de-api)
5. [Sistema de Milestones](#sistema-de-milestones)
6. [Ejemplos de Uso](#ejemplos-de-uso)
7. [Guía de Integración del Frontend](#guía-de-integración-del-frontend)
8. [Lista de Verificación de Testing](#lista-de-verificación-de-testing)
9. [Instrucciones de Deployment](#instrucciones-de-deployment)

---

## 🎯 Descripción General

El Sistema de Rachas Diarias es una funcionalidad de gamificación diseñada para incrementar la retención de usuarios a través de:

- **Check-ins diarios**: Rastreo automático cuando los usuarios interactúan con AI Coach
- **Rastreo de rachas**: Racha actual y récord personal (racha más larga)
- **Recompensas por milestones**: Recompensas progresivas en números clave de racha (3, 7, 14, 30, 60, 90, 180, 365 días)
- **Puntos cósmicos**: Sistema de acumulación de puntos (+10 por día + bonus en milestones)
- **Sistema de badges**: Badges de logros para milestones mayores
- **Mecánicas FOMO**: El miedo a perder la racha fomenta regresos diarios

### Métricas Clave

- **Frecuencia de check-in**: Diaria
- **Cálculo de racha**: Días consecutivos (se rompe si el usuario pierde un día)
- **Puntos por check-in**: 10 puntos cósmicos
- **Total de milestones**: 8 milestones mayores
- **Idiomas soportados**: Español (es), Inglés (en)

---

## 🏗️ Arquitectura

### Componentes

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Flutter)                    │
│  - Mostrar racha en UI                                  │
│  - Mostrar logros de milestones                         │
│  - Componente de leaderboard                            │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Backend - aiCoachService.js                │
│  - Llama streakService.checkIn() en cada mensaje        │
│  - Devuelve info de racha en respuesta                  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              streakService.js (Archivo Nuevo)           │
│  - checkIn(userId, language)                            │
│  - getStreak(userId)                                    │
│  - getLeaderboard(limit)                                │
│  - Lógica de cálculo de milestones                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│          PostgreSQL - tabla user_streaks                │
│  - Almacena todos los datos de rachas                   │
│  - Indexado para performance                            │
└─────────────────────────────────────────────────────────┘
```

### Estructura de Archivos

```
backend/flutter-horoscope-backend/
├── migrations/
│   └── 011_create_user_streaks_table.sql  [NUEVO ✨]
├── src/
│   ├── services/
│   │   ├── streakService.js               [NUEVO ✨]
│   │   └── aiCoachService.js              [MODIFICADO]
│   └── config/
│       └── db.js
└── STREAK_SYSTEM_DOCUMENTATION.md          [NUEVO ✨]
```

---

## 💾 Schema de Base de Datos

### Tabla: `user_streaks`

```sql
CREATE TABLE user_streaks (
  -- Identificación primaria
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Rastreo de rachas
  current_streak INT DEFAULT 0 NOT NULL,      -- Días consecutivos actuales
  longest_streak INT DEFAULT 0 NOT NULL,      -- Récord personal
  last_check_in DATE,                         -- Última fecha de check-in (UTC)
  total_check_ins INT DEFAULT 0 NOT NULL,     -- Total de toda la vida

  -- Gamificación
  cosmic_points INT DEFAULT 0 NOT NULL,       -- Puntos acumulados
  badges JSONB DEFAULT '[]'::jsonb NOT NULL,  -- Array de badges ganados
  milestones_achieved JSONB DEFAULT '[]'::jsonb NOT NULL,  -- Números de milestones logrados

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Índices

```sql
CREATE INDEX idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX idx_user_streaks_current_streak ON user_streaks(current_streak DESC);
CREATE INDEX idx_user_streaks_last_check_in ON user_streaks(last_check_in DESC);
CREATE INDEX idx_user_streaks_cosmic_points ON user_streaks(cosmic_points DESC);
```

### Trigger de Auto-actualización

```sql
CREATE TRIGGER trigger_update_user_streaks_timestamp
BEFORE UPDATE ON user_streaks
FOR EACH ROW
EXECUTE FUNCTION update_user_streaks_updated_at();
```

---

## 🔌 Integración de API

### Integración Automática (AI Coach)

El sistema de rachas se **activa automáticamente** cuando los usuarios envían mensajes a AI Coach. ¡No se necesitan llamadas adicionales a la API!

**Modificado en `aiCoachService.js`:**

```javascript
// Líneas 32 (import)
const streakService = require('./streakService');

// Líneas 365-368 (lógica de check-in)
const userLanguage = options.language || 'es';
const streakInfo = await streakService.checkIn(userId, userLanguage);

// Línea 396 (devolver racha en respuesta)
streak: streakInfo
```

### Formato de Respuesta

Cada mensaje de AI Coach ahora incluye datos de racha:

```json
{
  "success": true,
  "response": {
    "content": "Tu respuesta del coach de IA...",
    "sessionId": "uuid",
    "messageId": "uuid"
  },
  "usage": {
    "remainingMessages": 10,
    "resetTime": "2025-01-24T00:00:00Z"
  },
  "streak": {
    "success": true,
    "current_streak": 7,
    "longest_streak": 7,
    "is_new_record": true,
    "already_checked_in": false,
    "streak_broken": false,
    "cosmic_points_earned": 80,
    "total_cosmic_points": 150,
    "total_check_ins": 7,
    "milestone": {
      "streak": 7,
      "name": "Guerrero de una Semana",
      "badge": "week_warrior",
      "reward": "Lectura especial Luna (gratis)",
      "cosmicPoints": 70
    },
    "badges": ["beginner", "week_warrior"],
    "message": "🔥 Racha actual: 7 días\n🏆 ¡NUEVO RÉCORD PERSONAL!\n\n✨ ¡MILESTONE DESBLOQUEADO: Guerrero de una Semana!\n🎁 Recompensa: Lectura especial Luna (gratis)\n💎 +70 puntos cósmicos extra\n\n💪 Próximo objetivo: 7 días para \"Dedicado\"\n🎯 Recompensa: 1 consulta premium gratis"
  }
}
```

---

## 🏆 Sistema de Milestones

### Tabla Completa de Milestones

| Días de Racha | Nombre Español | Nombre Inglés | Badge | Recompensa | Puntos Bonus |
|-------------|-------------|--------------|-------|--------|--------------|
| **3** | Empezando | Getting Started | `beginner` | Badge: Empezando | +30 |
| **7** | Guerrero de una Semana | Week Warrior | `week_warrior` | Lectura especial Luna (gratis) | +70 |
| **14** | Dedicado | Dedicated | `dedicated` | 1 consulta premium gratis | +150 |
| **30** | Guerrero Cósmico | Cosmic Warrior | `cosmic_warrior` | Lectura anual 2026 | +300 |
| **60** | Maestro de Hábitos | Habit Master | `habit_master` | 3 consultas premium gratis | +600 |
| **90** | Iluminado | Enlightened | `enlightened` | 1 mes premium gratis | +1000 |
| **180** | Devoto Cósmico | Cosmic Devotee | `cosmic_devotee` | 3 meses premium gratis | +2000 |
| **365** | Leyenda Cósmica | Cosmic Legend | `cosmic_legend` | Premium de por vida | +5000 |

### Lógica de Milestones

1. **Recompensas únicas**: Los milestones solo se pueden lograr una vez por usuario
2. **Rastreado en base de datos**: El array JSONB `milestones_achieved` almacena números de milestones logrados
3. **Desbloqueo de badges**: Los badges se agregan al array `badges` al lograr el milestone
4. **Puntos bonus**: Puntos cósmicos extra otorgados además de los +10 diarios

---

## 📱 Ejemplos de Uso

### Ejemplo 1: Usuario Primerizo

**Petición:**
```javascript
// Usuario envía primer mensaje a AI Coach
POST /ai-coach/sessions/{sessionId}/messages
{
  "message": "¿Qué me dice mi horóscopo hoy?",
  "language": "es"
}
```

**Respuesta:**
```json
{
  "success": true,
  "response": { /* Respuesta de IA */ },
  "streak": {
    "success": true,
    "current_streak": 1,
    "longest_streak": 1,
    "is_new_record": true,
    "is_first_time": true,
    "cosmic_points_earned": 10,
    "total_cosmic_points": 10,
    "total_check_ins": 1,
    "milestone": null,
    "message": "🔥 ¡Primera racha! Vuelve mañana para mantenerla viva.\n💫 +10 puntos cósmicos ganados"
  }
}
```

### Ejemplo 2: Alcanzando Milestone de 7 Días

**Respuesta:**
```json
{
  "success": true,
  "response": { /* Respuesta de IA */ },
  "streak": {
    "success": true,
    "current_streak": 7,
    "longest_streak": 7,
    "is_new_record": true,
    "cosmic_points_earned": 80,
    "total_cosmic_points": 150,
    "total_check_ins": 7,
    "milestone": {
      "streak": 7,
      "name": "Guerrero de una Semana",
      "badge": "week_warrior",
      "reward": "Lectura especial Luna (gratis)",
      "cosmicPoints": 70
    },
    "badges": ["beginner", "week_warrior"],
    "message": "🔥 Racha actual: 7 días\n🏆 ¡NUEVO RÉCORD PERSONAL!\n\n✨ ¡MILESTONE DESBLOQUEADO: Guerrero de una Semana!\n🎁 Recompensa: Lectura especial Luna (gratis)\n💎 +70 puntos cósmicos bonus\n\n💪 Próximo objetivo: 7 días para \"Dedicado\"\n🎯 Recompensa: 1 Consulta Premium Gratis"
  }
}
```

---

## 🎨 Guía de Integración del Frontend

### Ejemplo de Widget Flutter

```dart
// streak_widget.dart
import 'package:flutter/material.dart';

class StreakWidget extends StatelessWidget {
  final Map<String, dynamic> streakData;

  const StreakWidget({Key? key, required this.streakData}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (!streakData['success']) return SizedBox.shrink();

    final currentStreak = streakData['current_streak'] ?? 0;
    final cosmicPoints = streakData['total_cosmic_points'] ?? 0;
    final milestone = streakData['milestone'];

    return Card(
      margin: EdgeInsets.all(16),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Contador de racha
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text('🔥', style: TextStyle(fontSize: 24)),
                    SizedBox(width: 8),
                    Text(
                      '$currentStreak días',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Text('💎', style: TextStyle(fontSize: 20)),
                    SizedBox(width: 4),
                    Text(
                      '$cosmicPoints',
                      style: TextStyle(fontSize: 18, color: Colors.purple),
                    ),
                  ],
                ),
              ],
            ),

            // Notificación de milestone
            if (milestone != null) ...[
              SizedBox(height: 12),
              Container(
                padding: EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.purple.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.purple),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '✨ ¡MILESTONE DESBLOQUEADO!',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.purple,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      milestone['name'],
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 4),
                    Text('🎁 ${milestone['reward']}'),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
```

---

## ✅ Lista de Verificación de Testing

### Migración de Base de Datos

- [ ] Ejecutar migración: `psql -d tu_db -f migrations/011_create_user_streaks_table.sql`
- [ ] Verificar tabla creada: `\d user_streaks`
- [ ] Verificar índices creados: `\di idx_user_streaks_*`
- [ ] Verificar trigger creado: `\df update_user_streaks_updated_at`

---

## 🚀 Instrucciones de Deployment

### Paso 1: Ejecutar Migración de Base de Datos

```bash
# Producción
psql $DATABASE_URL -f migrations/011_create_user_streaks_table.sql

# Desarrollo
psql -U tu_usuario -d tu_db -f migrations/011_create_user_streaks_table.sql
```

### Paso 2: Verificar Migración

```sql
-- Verificar que existe la tabla
SELECT COUNT(*) FROM user_streaks;

-- Verificar índices
SELECT indexname FROM pg_indexes WHERE tablename = 'user_streaks';
```

---

## 📊 Métricas y KPIs Esperados

### Métricas de Retención

| Métrica | Antes de Rachas | Objetivo Después de Rachas | Período de Medición |
|--------|---------------|---------------------|-------------------|
| **Retención Día 1** | ~40% | ~70% | 30 días |
| **Retención Día 7** | ~15% | ~45% | 30 días |
| **Retención Día 30** | ~5% | ~25% | 90 días |
| **Usuarios Activos Diarios** | Línea Base | +800% | 90 días |

---

## 📝 Changelog

### v1.0.0 (2025-01-23)
- ✨ Lanzamiento inicial
- 🗄️ Schema de base de datos con tabla user_streaks
- 🔥 Rastreo central de rachas (actual, más larga, total)
- 🏆 Sistema de 8 niveles de milestones (3 a 365 días)
- 💎 Gamificación de puntos cósmicos
- 🎖️ Sistema de badges
- 🌍 Soporte bilingüe (ES/EN)
- 🔗 Auto-integración con AI Coach
- 📊 Funcionalidad de leaderboard

---

**Construido con 💜 para usuarios de Zodia**
*Haciendo de la guía cósmica diaria un hábito, una racha a la vez.*
