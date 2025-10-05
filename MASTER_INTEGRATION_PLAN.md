# 🚀 PLAN MAESTRO DE INTEGRACIÓN BACKEND-FLUTTER

**Fecha Creación:** 2025-10-05
**Objetivo:** Conectar todas las funcionalidades disponibles del backend con Flutter
**Timeline Total:** 1-2 días de desarrollo
**Prioridad:** ALTA - Features premium listas para producción

---

## 📋 ÍNDICE DE IMPLEMENTACIONES

1. [FASE 1: Horóscopos Semanales](#fase-1-horóscopos-semanales) - 2-3 horas ⭐⭐⭐
2. [FASE 2: Push Notifications Completas](#fase-2-push-notifications-completas) - 1 hora ⭐⭐⭐
3. [FASE 3: Compatibilidad Backend-Enhanced](#fase-3-compatibilidad-backend-enhanced) - 1-2 horas ⭐⭐
4. [FASE 4: Coaching AI Mejorado](#fase-4-coaching-ai-mejorado) - 1 hora ⭐⭐
5. [FASE 5: Health Monitoring & Analytics](#fase-5-health-monitoring--analytics) - 1 hora ⭐
6. [FASE 6: Admin Features (Opcional)](#fase-6-admin-features-opcional) - Variable ⭐

**TOTAL ESTIMADO:** 6-9 horas de desarrollo

---

# FASE 1: HORÓSCOPOS SEMANALES

## 🎯 Objetivo
Conectar los 72 horóscopos semanales del backend (12 signos × 6 idiomas) con la app Flutter.

## 📊 Estado Actual
- **Backend:** ✅ Endpoint `/api/weekly/getWeeklyHoroscope` funcionando
- **Flutter:** ❌ No existe servicio ni UI

## 🔧 Implementación

### PASO 1.1: Crear Modelo de Datos (15 min)

**Archivo:** `lib/models/weekly_horoscope.dart`

```dart
class WeeklyHoroscope {
  final String sign;
  final String language;
  final DateTime weekStart;
  final DateTime weekEnd;
  final String content;
  final String overview;
  final String loveAdvice;
  final String careerAdvice;
  final String healthAdvice;
  final String luckyDay;
  final String luckyColor;
  final int loveRating;
  final int careerRating;
  final int healthRating;
  final int overallRating;
  final DateTime createdAt;

  WeeklyHoroscope({
    required this.sign,
    required this.language,
    required this.weekStart,
    required this.weekEnd,
    required this.content,
    required this.overview,
    required this.loveAdvice,
    required this.careerAdvice,
    required this.healthAdvice,
    required this.luckyDay,
    required this.luckyColor,
    required this.loveRating,
    required this.careerRating,
    required this.healthRating,
    required this.overallRating,
    required this.createdAt,
  });

  factory WeeklyHoroscope.fromJson(Map<String, dynamic> json) {
    return WeeklyHoroscope(
      sign: json['sign'] ?? '',
      language: json['language_code'] ?? json['language'] ?? 'en',
      weekStart: DateTime.parse(json['week_start']),
      weekEnd: DateTime.parse(json['week_end']),
      content: json['content'] ?? json['weekly'] ?? '',
      overview: json['overview'] ?? json['general'] ?? '',
      loveAdvice: json['love_advice'] ?? json['love'] ?? '',
      careerAdvice: json['career_advice'] ?? json['career'] ?? '',
      healthAdvice: json['health_advice'] ?? json['health'] ?? '',
      luckyDay: json['lucky_day'] ?? '',
      luckyColor: json['lucky_color'] ?? '',
      loveRating: json['love_rating'] ?? 3,
      careerRating: json['career_rating'] ?? 3,
      healthRating: json['health_rating'] ?? 3,
      overallRating: json['overall_rating'] ?? 3,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'sign': sign,
      'language': language,
      'week_start': weekStart.toIso8601String(),
      'week_end': weekEnd.toIso8601String(),
      'content': content,
      'overview': overview,
      'love_advice': loveAdvice,
      'career_advice': careerAdvice,
      'health_advice': healthAdvice,
      'lucky_day': luckyDay,
      'lucky_color': luckyColor,
      'love_rating': loveRating,
      'career_rating': careerRating,
      'health_rating': healthRating,
      'overall_rating': overallRating,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
```

---

### PASO 1.2: Crear Servicio Weekly Horoscope (30 min)

**Archivo:** `lib/services/weekly_horoscope_service.dart`

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:zodiac_app/models/weekly_horoscope.dart';
import 'package:zodiac_app/utils/app_logger.dart';

/// 🗓️ SERVICIO DE HORÓSCOPOS SEMANALES
/// Conecta con backend Railway para obtener horóscopos semanales
class WeeklyHoroscopeService {
  static final WeeklyHoroscopeService _instance = WeeklyHoroscopeService._internal();
  factory WeeklyHoroscopeService() => _instance;
  WeeklyHoroscopeService._internal();

  static const String _baseUrl =
      'https://zodiac-backend-api-production-8ded.up.railway.app';

  // Cache keys
  static const String _cacheKeyPrefix = 'weekly_horoscope_';
  static const String _cacheTimestampPrefix = 'weekly_timestamp_';
  static const Duration _cacheValidDuration = Duration(days: 6); // Cache por 6 días

  /// Obtener horóscopo semanal desde backend
  Future<WeeklyHoroscope?> getWeeklyHoroscope({
    required String sign,
    String? language,
  }) async {
    try {
      language ??= await _detectUserLanguage();

      // Intentar desde cache primero
      final cached = await _getFromCache(sign, language);
      if (cached != null) {
        AppLogger.debug('Weekly horoscope from cache: $sign ($language)');
        return cached;
      }

      // Solicitar al backend
      AppLogger.debug('Requesting weekly horoscope: $sign ($language)');

      final response = await http.get(
        Uri.parse('$_baseUrl/api/weekly/getWeeklyHoroscope').replace(
          queryParameters: {
            'sign': _capitalizeFirst(sign),
            'lang': language,
          },
        ),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);

        // Verificar si hay error en la respuesta
        if (data['error'] != null) {
          AppLogger.warning('Backend returned error: ${data['error']}');
          return null;
        }

        final horoscope = WeeklyHoroscope.fromJson(data);

        // Guardar en cache
        await _saveToCache(sign, language, horoscope);

        AppLogger.info('Weekly horoscope loaded from backend: $sign');
        return horoscope;
      } else {
        AppLogger.warning('Backend returned ${response.statusCode}');
        return null;
      }
    } catch (e) {
      AppLogger.error('Error getting weekly horoscope', e);
      return null;
    }
  }

  /// Obtener todos los horóscopos semanales (12 signos)
  Future<Map<String, WeeklyHoroscope>> getAllWeeklyHoroscopes({
    String? language,
  }) async {
    try {
      language ??= await _detectUserLanguage();

      final response = await http.get(
        Uri.parse('$_baseUrl/api/weekly/getAllWeeklyHoroscopes').replace(
          queryParameters: {'lang': language},
        ),
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final Map<String, WeeklyHoroscope> horoscopes = {};

        if (data is Map && data['horoscopes'] is List) {
          for (var item in data['horoscopes']) {
            final horoscope = WeeklyHoroscope.fromJson(item);
            horoscopes[horoscope.sign.toLowerCase()] = horoscope;

            // Cache individual
            await _saveToCache(horoscope.sign, language!, horoscope);
          }
        }

        AppLogger.info('Loaded ${horoscopes.length} weekly horoscopes');
        return horoscopes;
      }
    } catch (e) {
      AppLogger.error('Error getting all weekly horoscopes', e);
    }

    return {};
  }

  /// Cache helpers
  Future<WeeklyHoroscope?> _getFromCache(String sign, String language) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cacheKey = '$_cacheKeyPrefix${sign.toLowerCase()}_$language';
      final timestampKey = '$_cacheTimestampPrefix${sign.toLowerCase()}_$language';

      final cachedData = prefs.getString(cacheKey);
      final cachedTimestamp = prefs.getInt(timestampKey);

      if (cachedData != null && cachedTimestamp != null) {
        final cacheAge = DateTime.now().difference(
          DateTime.fromMillisecondsSinceEpoch(cachedTimestamp),
        );

        if (cacheAge < _cacheValidDuration) {
          return WeeklyHoroscope.fromJson(json.decode(cachedData));
        }
      }
    } catch (e) {
      AppLogger.debug('Cache read error: $e');
    }
    return null;
  }

  Future<void> _saveToCache(String sign, String language, WeeklyHoroscope horoscope) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cacheKey = '$_cacheKeyPrefix${sign.toLowerCase()}_$language';
      final timestampKey = '$_cacheTimestampPrefix${sign.toLowerCase()}_$language';

      await prefs.setString(cacheKey, json.encode(horoscope.toJson()));
      await prefs.setInt(timestampKey, DateTime.now().millisecondsSinceEpoch);
    } catch (e) {
      AppLogger.debug('Cache write error: $e');
    }
  }

  /// Limpiar cache
  Future<void> clearCache() async {
    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys();

    for (var key in keys) {
      if (key.startsWith(_cacheKeyPrefix) || key.startsWith(_cacheTimestampPrefix)) {
        await prefs.remove(key);
      }
    }

    AppLogger.info('Weekly horoscope cache cleared');
  }

  /// Detectar idioma del usuario
  Future<String> _detectUserLanguage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString('user_language') ?? 'en';
    } catch (e) {
      return 'en';
    }
  }

  /// Capitalizar primera letra
  String _capitalizeFirst(String text) {
    if (text.isEmpty) return text;
    return text[0].toUpperCase() + text.substring(1).toLowerCase();
  }
}
```

---

### PASO 1.3: Crear Widget de Horóscopo Semanal (45 min)

**Archivo:** `lib/widgets/weekly_horoscope_card.dart`

```dart
import 'package:flutter/material.dart';
import 'package:zodiac_app/models/weekly_horoscope.dart';
import 'package:zodiac_app/themes/app_theme.dart';
import 'package:intl/intl.dart';

class WeeklyHoroscopeCard extends StatelessWidget {
  final WeeklyHoroscope horoscope;
  final VoidCallback? onTap;

  const WeeklyHoroscopeCard({
    Key? key,
    required this.horoscope,
    this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppTheme.primaryColor.withOpacity(0.1),
                AppTheme.accentColor.withOpacity(0.05),
              ],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header con fechas
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '🗓️ Esta Semana',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    _formatWeekRange(),
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Ratings
              _buildRatings(),

              const SizedBox(height: 16),

              // Overview
              Text(
                horoscope.overview,
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.5,
                ),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),

              const SizedBox(height: 12),

              // Lucky info
              Row(
                children: [
                  _buildLuckyChip('🍀 ${horoscope.luckyDay}'),
                  const SizedBox(width: 8),
                  _buildLuckyChip('🎨 ${horoscope.luckyColor}'),
                ],
              ),

              if (onTap != null) ...[
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    'Ver más →',
                    style: TextStyle(
                      color: AppTheme.primaryColor,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRatings() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: [
        _buildRatingColumn('💕', 'Amor', horoscope.loveRating),
        _buildRatingColumn('💼', 'Carrera', horoscope.careerRating),
        _buildRatingColumn('🏃', 'Salud', horoscope.healthRating),
      ],
    );
  }

  Widget _buildRatingColumn(String emoji, String label, int rating) {
    return Column(
      children: [
        Text(emoji, style: const TextStyle(fontSize: 20)),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: Colors.grey[600],
          ),
        ),
        const SizedBox(height: 4),
        Row(
          children: List.generate(
            5,
            (index) => Icon(
              index < rating ? Icons.star : Icons.star_border,
              size: 12,
              color: Colors.amber,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLuckyChip(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppTheme.primaryColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: const TextStyle(fontSize: 12),
      ),
    );
  }

  String _formatWeekRange() {
    final formatter = DateFormat('MMM d');
    return '${formatter.format(horoscope.weekStart)} - ${formatter.format(horoscope.weekEnd)}';
  }
}
```

---

### PASO 1.4: Integrar en HomeScreen (30 min)

**Modificar:** `lib/screens/home_screen.dart`

Agregar después de la sección de horóscopo diario:

```dart
// Import
import 'package:zodiac_app/services/weekly_horoscope_service.dart';
import 'package:zodiac_app/widgets/weekly_horoscope_card.dart';

// En el State
WeeklyHoroscope? _weeklyHoroscope;
final WeeklyHoroscopeService _weeklyService = WeeklyHoroscopeService();

// En initState o al cargar
Future<void> _loadWeeklyHoroscope() async {
  final sign = _userPrefs?.userSign;
  if (sign != null) {
    final weekly = await _weeklyService.getWeeklyHoroscope(sign: sign);
    if (mounted) {
      setState(() {
        _weeklyHoroscope = weekly;
      });
    }
  }
}

// En el Widget tree (después del daily horoscope)
if (_weeklyHoroscope != null)
  Padding(
    padding: const EdgeInsets.all(16),
    child: WeeklyHoroscopeCard(
      horoscope: _weeklyHoroscope!,
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => WeeklyHoroscopeDetailScreen(
              horoscope: _weeklyHoroscope!,
            ),
          ),
        );
      },
    ),
  ),
```

---

### PASO 1.5: Crear Pantalla de Detalle (30 min)

**Archivo:** `lib/screens/weekly_horoscope_detail_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:zodiac_app/models/weekly_horoscope.dart';
import 'package:zodiac_app/themes/app_theme.dart';
import 'package:intl/intl.dart';

class WeeklyHoroscopeDetailScreen extends StatelessWidget {
  final WeeklyHoroscope horoscope;

  const WeeklyHoroscopeDetailScreen({
    Key? key,
    required this.horoscope,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Horóscopo Semanal - ${horoscope.sign}'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Week range
            Center(
              child: Chip(
                label: Text(_formatWeekRange()),
                avatar: const Icon(Icons.calendar_today, size: 16),
              ),
            ),

            const SizedBox(height: 24),

            // Overall rating
            _buildOverallRating(),

            const SizedBox(height: 24),

            // Overview section
            _buildSection(
              title: '🌟 Panorama General',
              content: horoscope.overview,
            ),

            const SizedBox(height: 20),

            // Love advice
            _buildSection(
              title: '💕 Amor y Relaciones',
              content: horoscope.loveAdvice,
              rating: horoscope.loveRating,
            ),

            const SizedBox(height: 20),

            // Career advice
            _buildSection(
              title: '💼 Carrera y Finanzas',
              content: horoscope.careerAdvice,
              rating: horoscope.careerRating,
            ),

            const SizedBox(height: 20),

            // Health advice
            _buildSection(
              title: '🏃 Salud y Bienestar',
              content: horoscope.healthAdvice,
              rating: horoscope.healthRating,
            ),

            const SizedBox(height: 24),

            // Lucky info
            _buildLuckyInfo(),

            const SizedBox(height: 24),

            // Full content
            if (horoscope.content.isNotEmpty)
              _buildSection(
                title: '📖 Lectura Completa',
                content: horoscope.content,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildOverallRating() {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            const Text(
              'Calificación General',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                5,
                (index) => Icon(
                  index < horoscope.overallRating
                      ? Icons.star
                      : Icons.star_border,
                  size: 32,
                  color: Colors.amber,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${horoscope.overallRating}/5',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection({
    required String title,
    required String content,
    int? rating,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            if (rating != null) ...[
              const SizedBox(width: 12),
              Row(
                children: List.generate(
                  rating,
                  (index) => const Icon(
                    Icons.star,
                    size: 16,
                    color: Colors.amber,
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        Text(
          content,
          style: const TextStyle(
            fontSize: 15,
            height: 1.6,
          ),
        ),
      ],
    );
  }

  Widget _buildLuckyInfo() {
    return Card(
      elevation: 2,
      color: AppTheme.primaryColor.withOpacity(0.1),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            Column(
              children: [
                const Text('🍀', style: TextStyle(fontSize: 24)),
                const SizedBox(height: 8),
                const Text(
                  'Día de Suerte',
                  style: TextStyle(fontSize: 12),
                ),
                const SizedBox(height: 4),
                Text(
                  horoscope.luckyDay,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            Column(
              children: [
                const Text('🎨', style: TextStyle(fontSize: 24)),
                const SizedBox(height: 8),
                const Text(
                  'Color de Suerte',
                  style: TextStyle(fontSize: 12),
                ),
                const SizedBox(height: 4),
                Text(
                  horoscope.luckyColor,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatWeekRange() {
    final formatter = DateFormat('MMM d, yyyy');
    return '${formatter.format(horoscope.weekStart)} - ${formatter.format(horoscope.weekEnd)}';
  }
}
```

---

### ✅ CHECKLIST FASE 1

- [ ] Crear `weekly_horoscope.dart` modelo
- [ ] Crear `weekly_horoscope_service.dart` servicio
- [ ] Crear `weekly_horoscope_card.dart` widget
- [ ] Modificar `home_screen.dart` para mostrar semanal
- [ ] Crear `weekly_horoscope_detail_screen.dart`
- [ ] Probar con diferentes signos e idiomas
- [ ] Verificar cache funciona correctamente

**Tiempo Total:** 2-3 horas

---

# FASE 2: PUSH NOTIFICATIONS COMPLETAS

## 🎯 Objetivo
Completar la integración de Firebase Cloud Messaging enviando el FCM token al backend.

## 📊 Estado Actual
- **Backend:** ✅ Firebase Admin SDK configurado
- **Flutter:** ⚠️ FCM configurado pero token no se registra en backend

## 🔧 Implementación

### PASO 2.1: Crear Endpoint de Registro de Token (Backend)

**Archivo Backend:** `src/routes/notification.js` (NUEVO)

```javascript
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const firebaseService = require('../services/firebaseService');

// Register FCM token
router.post('/register-token', async (req, res) => {
  try {
    const { user_id, fcm_token, device_type, device_id } = req.body;

    // Validar
    if (!fcm_token) {
      return res.status(400).json({ error: 'FCM token required' });
    }

    // Guardar o actualizar token en database
    await db.query(
      `INSERT INTO fcm_tokens (user_id, fcm_token, device_type, device_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (device_id)
       DO UPDATE SET fcm_token = $2, updated_at = NOW()`,
      [user_id || null, fcm_token, device_type || 'unknown', device_id || fcm_token]
    );

    console.log(`✅ FCM token registered: ${fcm_token.substring(0, 20)}...`);

    res.json({
      success: true,
      message: 'FCM token registered successfully'
    });
  } catch (error) {
    console.error('FCM token registration error:', error);
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// Send test notification
router.post('/send-test', async (req, res) => {
  try {
    const { fcm_token } = req.body;

    if (!fcm_token) {
      return res.status(400).json({ error: 'FCM token required' });
    }

    const message = {
      notification: {
        title: '🌟 Zodiac Life Coach',
        body: 'Tu horóscopo diario está listo!',
      },
      data: {
        type: 'daily_horoscope',
        timestamp: new Date().toISOString(),
      },
      token: fcm_token,
    };

    await firebaseService.sendNotification(message);

    res.json({
      success: true,
      message: 'Test notification sent'
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

**Agregar a:** `src/app-production.js`

```javascript
// Agregar import
loadRoute('/api/notifications', './routes/notification', 'Notification routes');
```

**Crear tabla en database:**

```sql
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  fcm_token TEXT NOT NULL,
  device_type VARCHAR(50),
  device_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX idx_fcm_tokens_device_id ON fcm_tokens(device_id);
```

---

### PASO 2.2: Extender Firebase Service (Backend)

**Archivo Backend:** `src/services/firebaseService.js`

Agregar método:

```javascript
/**
 * Send push notification
 */
async function sendNotification(message) {
  if (!initialized || mockMode) {
    console.warn('Firebase in mock mode - notification not sent');
    return { success: false, mockMode: true };
  }

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent successfully:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    throw error;
  }
}

/**
 * Send notification to multiple tokens
 */
async function sendMulticastNotification(message, tokens) {
  if (!initialized || mockMode) {
    console.warn('Firebase in mock mode - notifications not sent');
    return { success: false, mockMode: true };
  }

  try {
    const multicastMessage = {
      ...message,
      tokens: tokens,
    };

    const response = await admin.messaging().sendMulticast(multicastMessage);
    console.log(`✅ Sent ${response.successCount} notifications`);

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses,
    };
  } catch (error) {
    console.error('❌ Error sending multicast notification:', error);
    throw error;
  }
}

module.exports = {
  initialize,
  getStatus,
  sendNotification,        // NUEVO
  sendMulticastNotification, // NUEVO
};
```

---

### PASO 2.3: Registrar Token en Flutter (30 min)

**Archivo:** `lib/services/unified_notification_service.dart`

Agregar método de registro:

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class UnifiedNotificationService {
  static const String _baseUrl =
      'https://zodiac-backend-api-production-8ded.up.railway.app';

  // ... existing code ...

  /// Registrar FCM token en el backend
  Future<bool> registerFCMToken(String token) async {
    try {
      // Obtener device info
      final deviceId = await _getDeviceId();
      final deviceType = Platform.isIOS ? 'ios' : 'android';

      final response = await http.post(
        Uri.parse('$_baseUrl/api/notifications/register-token'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'fcm_token': token,
          'device_type': deviceType,
          'device_id': deviceId,
          // Si tienes user_id, agrégalo aquí
          // 'user_id': userId,
        }),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        AppLogger.info('FCM token registered successfully');
        return data['success'] ?? false;
      } else {
        AppLogger.warning('Failed to register FCM token: ${response.statusCode}');
        return false;
      }
    } catch (e) {
      AppLogger.error('Error registering FCM token', e);
      return false;
    }
  }

  /// Obtener device ID único
  Future<String> _getDeviceId() async {
    try {
      // Usar package device_info_plus
      final deviceInfo = DeviceInfoPlugin();

      if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        return iosInfo.identifierForVendor ?? 'unknown_ios';
      } else {
        final androidInfo = await deviceInfo.androidInfo;
        return androidInfo.id ?? 'unknown_android';
      }
    } catch (e) {
      return 'unknown_device';
    }
  }

  /// Solicitar permisos y registrar token
  Future<void> initializeAndRegister() async {
    try {
      // Solicitar permisos
      final settings = await _firebaseMessaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        AppLogger.info('Push notification permission granted');

        // Obtener token
        final token = await _firebaseMessaging.getToken();

        if (token != null) {
          AppLogger.info('FCM Token: ${token.substring(0, 20)}...');

          // Registrar en backend
          await registerFCMToken(token);

          // Escuchar cambios de token
          _firebaseMessaging.onTokenRefresh.listen((newToken) {
            AppLogger.info('FCM Token refreshed');
            registerFCMToken(newToken);
          });
        }
      } else {
        AppLogger.warning('Push notification permission denied');
      }
    } catch (e) {
      AppLogger.error('Error initializing push notifications', e);
    }
  }
}
```

**Modificar:** `lib/main.dart`

En la función `_initializeFirebaseMessaging()`:

```dart
Future<void> _initializeFirebaseMessaging() async {
  try {
    final notificationService = UnifiedNotificationService();

    // Inicializar Y registrar token
    await notificationService.initializeAndRegister();

    AppLogger.info('Firebase Messaging initialized and token registered');
  } catch (e) {
    AppLogger.error('Firebase Messaging initialization failed', e);
  }
}
```

---

### PASO 2.4: Agregar Dependencias (5 min)

**Archivo:** `pubspec.yaml`

Asegurar que estén estas dependencias:

```yaml
dependencies:
  device_info_plus: ^9.1.0  # Para device ID
  # ... otras dependencias existentes
```

Ejecutar:
```bash
flutter pub get
```

---

### ✅ CHECKLIST FASE 2

**Backend:**
- [ ] Crear `src/routes/notification.js`
- [ ] Agregar tabla `fcm_tokens` a database
- [ ] Extender `firebaseService.js` con métodos de envío
- [ ] Agregar ruta en `app-production.js`
- [ ] Deploy a Railway

**Flutter:**
- [ ] Modificar `unified_notification_service.dart`
- [ ] Agregar `device_info_plus` a `pubspec.yaml`
- [ ] Modificar `main.dart` para registrar token
- [ ] Probar permisos en iOS y Android
- [ ] Enviar notificación de prueba desde backend

**Tiempo Total:** 1 hora

---

# FASE 3: COMPATIBILIDAD BACKEND-ENHANCED

## 🎯 Objetivo
Mejorar el servicio de compatibilidad usando el análisis del backend como opción premium.

## 🔧 Implementación (30 min)

**Modificar:** `lib/services/consolidated_compatibility/core_compatibility_service.dart`

Agregar método:

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class CoreCompatibilityService {
  static const String _baseUrl =
      'https://zodiac-backend-api-production-8ded.up.railway.app';

  // ... existing code ...

  /// Obtener compatibilidad desde backend (feature premium)
  Future<CompatibilityResult?> getBackendCompatibility({
    required String sign1,
    required String sign2,
    String language = 'en',
  }) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/compatibility').replace(
          queryParameters: {
            'sign1': sign1.toLowerCase(),
            'sign2': sign2.toLowerCase(),
            'language': language,
          },
        ),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);

        // Convertir respuesta del backend a CompatibilityResult
        return CompatibilityResult(
          sign1: sign1,
          sign2: sign2,
          overallScore: (data['overall_percentage'] ?? 0).toDouble(),
          loveScore: (data['love_percentage'] ?? 0).toDouble(),
          friendshipScore: (data['friendship_percentage'] ?? 0).toDouble(),
          workScore: (data['work_percentage'] ?? 0).toDouble(),
          description: data['description'] ?? '',
          strengths: List<String>.from(data['strengths'] ?? []),
          challenges: List<String>.from(data['challenges'] ?? []),
          advice: List<String>.from(data['advice'] ?? []),
          fromBackend: true, // Flag para saber que es del backend
        );
      }
    } catch (e) {
      AppLogger.error('Backend compatibility error', e);
    }
    return null;
  }

  /// Método híbrido: intenta backend primero, luego local
  Future<CompatibilityResult> getCompatibilityHybrid({
    required String sign1,
    required String sign2,
    bool preferBackend = true,
  }) async {
    // Si el usuario es premium, intentar backend primero
    if (preferBackend) {
      final backendResult = await getBackendCompatibility(
        sign1: sign1,
        sign2: sign2,
      );

      if (backendResult != null) {
        return backendResult;
      }
    }

    // Fallback a cálculo local
    return calculateCompatibility(sign1: sign1, sign2: sign2);
  }
}
```

---

# FASE 4: COACHING AI MEJORADO

## 🎯 Objetivo
Aprovechar el endpoint `/api/coaching` del backend para análisis AI más profundos.

**Modificar:** `lib/services/consolidated_ai/coaching_ai_service.dart`

Agregar opción de usar backend:

```dart
Future<String> getEnhancedCoaching({
  required String sign,
  required String language,
  Map<String, dynamic>? context,
}) async {
  try {
    final response = await http.post(
      Uri.parse('$_baseUrl/api/coaching/enhanced'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'sign': sign,
        'language': language,
        'context': context,
      }),
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['coaching'] ?? '';
    }
  } catch (e) {
    AppLogger.error('Enhanced coaching error', e);
  }

  // Fallback a local
  return getLocalCoaching(sign: sign);
}
```

**Tiempo:** 30 min

---

# FASE 5: HEALTH MONITORING & ANALYTICS

## 🎯 Objetivo
Agregar monitoreo de salud del backend desde la app (admin feature).

**Crear:** `lib/services/backend_health_service.dart`

```dart
class BackendHealthService {
  static const String _baseUrl =
      'https://zodiac-backend-api-production-8ded.up.railway.app';

  Future<Map<String, dynamic>> getBackendHealth() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/health'),
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        return json.decode(response.body);
      }
    } catch (e) {
      return {'status': 'error', 'error': e.toString()};
    }
    return {'status': 'unknown'};
  }

  Future<Map<String, dynamic>> getRoutesStatus() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/routes'),
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        return json.decode(response.body);
      }
    } catch (e) {
      return {'error': e.toString()};
    }
    return {};
  }
}
```

**Crear:** `lib/screens/admin/backend_status_screen.dart` (opcional)

**Tiempo:** 30 min

---

# FASE 6: ADMIN FEATURES (OPCIONAL)

**Endpoints disponibles:**
- `/api/admin/*` - Gestión administrativa
- `/api/monitoring/*` - Monitoreo del sistema

**Solo implementar si necesitas:**
- Dashboard de administración
- Herramientas de debugging
- Estadísticas internas

**Tiempo:** Variable

---

## 📊 RESUMEN FINAL

| Fase | Feature | Prioridad | Tiempo | Impacto |
|------|---------|-----------|---------|---------|
| 1 | Horóscopos Semanales | ⭐⭐⭐ | 2-3 hrs | ALTO |
| 2 | Push Notifications | ⭐⭐⭐ | 1 hr | ALTO |
| 3 | Compatibilidad Backend | ⭐⭐ | 30 min | MEDIO |
| 4 | Coaching AI Mejorado | ⭐⭐ | 30 min | MEDIO |
| 5 | Health Monitoring | ⭐ | 30 min | BAJO |
| 6 | Admin Features | ⭐ | Variable | BAJO |

**TOTAL: 6-9 horas** para implementar todo

---

## 🚀 ORDEN DE IMPLEMENTACIÓN RECOMENDADO

### DÍA 1 (4-5 horas)
1. ✅ **Fase 1:** Horóscopos Semanales (2-3 hrs)
2. ✅ **Fase 2:** Push Notifications (1 hr)

### DÍA 2 (2-3 horas)
3. ✅ **Fase 3:** Compatibilidad Backend (30 min)
4. ✅ **Fase 4:** Coaching AI Mejorado (30 min)
5. ⚠️ **Fase 5:** Health Monitoring (30 min - opcional)

---

## ✅ TESTING CHECKLIST

Después de cada fase:

- [ ] Probar en iOS
- [ ] Probar en Android
- [ ] Probar con diferentes idiomas (en, es, de, fr, it, pt)
- [ ] Probar con diferentes signos
- [ ] Verificar cache funciona
- [ ] Verificar fallback a local si backend falla
- [ ] Probar en modo offline
- [ ] Verificar logs no tienen errores

---

## 📝 NOTAS FINALES

### Backend Ya Tiene
- ✅ 6 rutas API funcionando
- ✅ Firebase configurado
- ✅ 72 horóscopos diarios
- ✅ 72 horóscopos semanales
- ✅ Compatibilidad entre signos
- ✅ Receipt validation
- ✅ Seguridad configurada

### Solo Falta en Flutter
- 🔴 Conectar weekly horoscopes (PRIORITARIO)
- 🔴 Registrar FCM tokens (PRIORITARIO)
- 🟡 Aprovechar backend compatibility
- 🟡 Usar coaching AI del backend
- 🟢 Features admin (opcional)

---

**¿Listo para empezar con Fase 1? 👇**

**Documento Versión:** 1.0
**Última Actualización:** 2025-10-05
**Status:** Plan completo listo para implementar
