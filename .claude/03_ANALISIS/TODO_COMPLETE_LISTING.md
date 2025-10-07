# Listado Completo de TODOs y Pendientes - Zodiac App

**Fecha:** 2025-10-05
**Directorio:** `/Users/alejandrocaceres/Desktop/appstore - zodia/zodiac_app/lib`

---

## TODOs Explícitos (Comentarios TODO/FIXME)

### 1. Premium Provider - Pricing Info

**Archivo:** `providers/premium_provider.dart`
**Línea:** 76
**Categoría:** ALTA
**Estado:** Pendiente

```dart
// TODO: Define SubscriptionPricingInfo class or use existing pricing models
// final pricingInfoProvider = FutureProvider<SubscriptionPricingInfo?>((ref) async {
//   final manager = ref.watch(premiumSubscriptionManagerProvider);
//   return await manager.getPricingInfo();
// });
```

**Acción Requerida:**
- Definir clase `SubscriptionPricingInfo` o usar modelo existente
- Descomentar y activar el provider
- Integrar con RevenueCat para obtener precios dinámicos

---

### 2. Ascendant Screen - Calculation

**Archivo:** `screens/ascendant_screen.dart`
**Línea:** 59
**Categoría:** CRÍTICA
**Estado:** Pendiente

```dart
void _calculateAscendant() {
  if (_birthDate == null || _birthTime == null || _birthPlace == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Please fill all fields')),
    );
    return;
  }

  logInfo('Calculating ascendant', category: LogCategory.astrology);
  // TODO: Implement ascendant calculation
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('Ascendant calculation coming soon!')),
  );
}
```

**Acción Requerida:**
- Implementar cálculo real de ascendente usando `AscendantService`
- El servicio ya existe en `/services/ascendant_service.dart`
- Solo falta conectar UI con servicio

---

### 3. Ascendant Screen - Place Picker

**Archivo:** `screens/ascendant_screen.dart`
**Línea:** 102
**Categoría:** ALTA
**Estado:** Pendiente

```dart
ListTile(
  leading: const Icon(Icons.location_on),
  title: const Text('Birth Place'),
  subtitle: Text(_birthPlace ?? 'Not selected'),
  onTap: () {
    // TODO: Implement place picker
    setState(() => _birthPlace = 'Sample City');
  },
),
```

**Acción Requerida:**
- Implementar selector de ubicación geográfica
- Integrar con Google Places API o similar
- Obtener coordenadas (lat/long) para cálculo de ascendente

---

### 4-10. Prediction Notification Service - Multiple TODOs

**Archivo:** `services/prediction_notification_service.dart`
**Categoría:** CRÍTICA
**Estado:** Pendiente

#### TODO 4: Schedule Notifications (Línea 143)
```dart
Future<void> scheduleNotification({
  required NotificationType type,
  required String title,
  required String body,
  required DateTime scheduledTime,
  String? payload,
}) async {
  if (!_preferences.isTypeEnabled(type)) return;

  // TODO: Implement actual notification scheduling
  debugPrint('Scheduled notification: $title for ${scheduledTime.toIso8601String()}');
}
```

#### TODO 5: Cancel All Notifications (Línea 149)
```dart
Future<void> cancelAllNotifications() async {
  // TODO: Implement actual notification cancellation
  debugPrint('All notifications cancelled');
}
```

#### TODO 6: Cancel Type-Specific Notifications (Línea 155)
```dart
Future<void> cancelNotificationsOfType(NotificationType type) async {
  // TODO: Implement type-specific notification cancellation
  debugPrint('Cancelled notifications of type: ${type.displayName}');
}
```

#### TODO 7: Send Notification (Línea 245)
```dart
Future<void> _sendNotification({
  required NotificationType type,
  required String title,
  required String body,
  String? payload,
}) async {
  if (!_preferences.shouldSendNotification(DateTime.now())) return;

  try {
    // TODO: Implement actual notification sending
    debugPrint('Sending ${type.displayName} notification: $title');

    // Mock notification sending
    await Future.delayed(const Duration(milliseconds: 100));
  } catch (e) {
    debugPrint('Error sending notification: $e');
  }
}
```

#### TODO 8: Load Preferences (Línea 258)
```dart
Future<void> _loadPreferences() async {
  try {
    // TODO: Implement actual storage loading
    // For now, use defaults
    _preferences = PredictionNotificationPreferences.defaultPreferences;
  } catch (e) {
    debugPrint('Error loading preferences: $e');
    _preferences = PredictionNotificationPreferences.defaultPreferences;
  }
}
```

#### TODO 9: Save Preferences (Línea 270)
```dart
Future<void> _savePreferences() async {
  try {
    // TODO: Implement actual storage saving
    debugPrint('Saving notification preferences');
  } catch (e) {
    debugPrint('Error saving preferences: $e');
  }
}
```

**Acción Requerida (Global para 4-9):**
- Implementar integración con Firebase Cloud Messaging (FCM)
- Usar `flutter_local_notifications` para scheduling
- Implementar persistencia con `SharedPreferences` o `Hive`
- Configurar backend endpoint para envío de notificaciones push

---

### 11. Core Compatibility Service - User ID

**Archivo:** `services/consolidated_compatibility/core_compatibility_service.dart`
**Línea:** 563
**Categoría:** ALTA
**Estado:** Pendiente

```dart
final event = CompatibilityAnalysisEvent(
  timestamp: DateTime.now(),
  sign1: sign1,
  sign2: sign2,
  compatibilityType: compatibilityType,
  compatibilityScores: compatibilityScores,
  processingTime: processingTime,
  wasFromCache: wasFromCache,
  userId: 'anonymous', // TODO: Get from PreferencesService
  additionalData: additionalData ?? {},
);
```

**Acción Requerida:**
- Obtener user ID real desde `PreferencesService`
- Implementar en todos los servicios de analytics
- Considerar GDPR compliance y anonimización

---

### 12. Ultimate Compatibility Service - Reactivar Cache

**Archivo:** `services/ultimate_compatibility_service.dart`
**Línea:** 64
**Categoría:** CRÍTICA
**Estado:** Desactivado temporalmente

```dart
// Check cache first (if available) - TEMPORALMENTE DESACTIVADO PARA TESTING
final cacheKey = 'ultimate_compatibility_${normalizedSign1}_${normalizedSign2}_$language';
Map<String, dynamic>? cached;
// TODO: Reactivar cache después de verificar que funciona
// if (_cache != null) {
//   try {
//     cached = await _cache!.get<Map<String, dynamic>>(cacheKey);
//     if (cached != null) {
//       return UltimateCompatibilityResult.fromJson(cached);
//     }
//   } catch (e) {
//     AppLogger.debug('Cache read failed: $e');
//   }
// }
```

**Acción Requerida:**
- Verificar y resolver bugs en `CacheService`
- Testing exhaustivo de memoria
- Reactivar cache después de validar estabilidad

---

## Pendientes Implícitos (Sin TODO explícito)

### 13. Home Screen - Download All Horoscopes

**Archivo:** `screens/home_screen.dart`
**Línea:** 58
**Categoría:** CRÍTICA
**Estado:** Desactivado temporalmente

```dart
// 🚨 TEMPORALMENTE DESACTIVADO - Causa bucle infinito con Railway backend
// await BackendService().downloadAllHoroscopes();
```

**Acción Requerida:**
- Resolver loop infinito en backend integration
- Implementar debouncing/throttling
- Verificar rate limiting en backend

---

### 14. Cache Service - Memory Pressure

**Archivo:** `services/cache_service.dart`
**Línea:** 910
**Categoría:** ALTA
**Estado:** Método no implementado

```dart
Future<void> _performCleanup() async {
  try {
    await _removeExpiredEntries();
    // await _handleMemoryPressure(); // Method not implemented
    await _compactCacheFiles();

    if (kDebugMode) {
      logInfo('Cache cleanup completed');
    }
  } catch (e) {
    if (kDebugMode) {
      logError('Error occurred', error: e);
    }
  }
}
```

**Acción Requerida:**
- Implementar `_handleMemoryPressure()` method
- Detectar estado de memoria del dispositivo
- Liberar cache cuando memoria es baja

---

### 15-21. Background Calendar Processor - Completamente Deshabilitado

**Archivo:** `services/calendar/background_calendar_processor.dart`
**Categoría:** ALTA
**Estado:** Todo el archivo deshabilitado

**Líneas afectadas:** 2, 3, 5, 9, 13, 20, 28, 36, 44, 51

```dart
// import 'package:injectable/injectable.dart'; // TEMPORALMENTE DESHABILITADO
// import 'package:workmanager/workmanager.dart'; // TEMPORALMENTE DESHABILITADO

/// 📅 BACKGROUND CALENDAR PROCESSOR - TEMPORALMENTE DESHABILITADO
/// Maneja el procesamiento en segundo plano de eventos del calendario

// @lazySingleton // TEMPORALMENTE DESHABILITADO
class BackgroundCalendarProcessor {
  // STUB: Método deshabilitado temporalmente
  Future<void> initialize() async {
    print('BackgroundCalendarProcessor: Temporalmente deshabilitado');
  }

  // STUB: Método deshabilitado temporalmente
  Future<void> scheduleBackgroundSync() async {
    // Stub implementation
  }

  // ... (7 stubs más)
}
```

**Acción Requerida:**
- Decidir si es feature para MVP o post-lanzamiento
- Si es MVP: reactivar y configurar `workmanager`
- Si es post-launch: eliminar código stub

---

### 22-28. Compatibility Cache Service - Multiple Managers Disabled

**Archivo:** `services/compatibility_cache_service.dart`
**Categoría:** ALTA
**Estado:** Deshabilitado por crashes de memoria

**Líneas afectadas:** 23, 54, 121, 161, 197, 232, 265, 298

```dart
// final CompatibilityCacheManager _compatibilityCache = CompatibilityCacheManager(); // Disabled - service removed

// Note: CompatibilityCacheManager initialization disabled to prevent memory crashes

// CompatibilityCacheManager functionality disabled (repetido 6 veces en diferentes métodos)
```

**Acción Requerida:**
- Investigar causa root de crashes de memoria
- Rediseñar CompatibilityCacheManager si es necesario
- Considerar alternativa: Hive o Isar para persistencia
- Reactivar después de resolver issues de estabilidad

---

### 29. AI Insights Generator - Temporalmente Deshabilitado

**Archivo:** `services/ai_insights/ai_insights_generator_service.dart`
**Líneas:** 1009, 1018
**Categoría:** MEDIA
**Estado:** Deshabilitado para evitar errores de compilación

```dart
// Temporarily disable this implementation to avoid compilation errors

Future<Map<String, dynamic>> generateInsights() async {
  throw UnimplementedError('Temporarily disabled for compilation');
}
```

**Acción Requerida:**
- Decidir si es feature para MVP
- Resolver errores de compilación
- Si no es MVP, eliminar o mover a feature flags

---

### 30. RevenueCat API Keys - Development Placeholders

**Archivo:** `services/revenue_cat_service.dart`
**Líneas:** 128, 129, 137
**Categoría:** CRÍTICA para producción
**Estado:** Usando placeholders de desarrollo

```dart
if (kDebugMode) print('⚠️ RevenueCat API key not configured - using development placeholder');
// Allow initialization with placeholder for development

await Purchases.configure(
  PurchasesConfiguration(
    apiKey ?? (Platform.isIOS ? 'appl_development_placeholder' : 'goog_development_placeholder'),
  ),
);
```

**Acción Requerida:**
- CRÍTICO: Configurar API keys reales antes de lanzamiento
- iOS: Obtener key de RevenueCat dashboard
- Android: Obtener key de RevenueCat dashboard
- Configurar en variables de entorno o secure config

---

### 31. Personalization Settings Screen - Not Implemented

**Archivo:** `main.dart`
**Línea:** 475
**Categoría:** MEDIA
**Estado:** Ruta comentada

```dart
// '/personalization-settings': (context) => const PersonalizationSettingsScreen(), // Not implemented yet
```

**Acción Requerida:**
- Crear screen `PersonalizationSettingsScreen`
- Diseñar UI para ajustes de personalización
- Integrar con `PreferencesService`

---

### 32. Prediction Notification Settings - Removed

**Archivo:** `main.dart`
**Línea:** 479
**Categoría:** BAJA
**Estado:** Comentado - Removed

```dart
// '/prediction-notification-settings': (context) => const PredictionNotificationSettingsScreen(), // Removed
```

**Acción Requerida:**
- Verificar si fue removido intencionalmente
- Si se necesita, reimplementar
- Si no, eliminar comentario

---

### 33. Google Calendar Connection - Coming Soon

**Archivo:** `screens/premium_timing_dashboard_screen.dart`
**Línea:** 1360
**Categoría:** MEDIA
**Estado:** Placeholder

```dart
SnackBar(content: Text('Google Calendar connection coming soon'),
```

**Acción Requerida:**
- Implementar integración con Google Calendar API
- OAuth flow para autenticación
- Sincronización de eventos cósmicos

---

### 34. Outlook Calendar Sync - Placeholder

**Archivo:** `services/calendar/multi_calendar_sync_service.dart`
**Líneas:** 290, 292
**Categoría:** BAJA
**Estado:** Placeholder implementation

```dart
// This is a placeholder for Outlook/Exchange sync
if (kDebugMode) debugPrint('Outlook Calendar sync - placeholder implementation');
```

**Acción Requerida:**
- Feature futura - no crítica para MVP
- Requiere Microsoft Graph API
- Enterprise feature

---

### 35-37. Export Features - Coming Soon

**Archivos:** Multiple localization files
**Categoría:** BAJA
**Estado:** Mensajes "coming soon"

```dart
// app_localizations_en.dart
String get pdfExportFeatureComingSoon => 'PDF export feature coming soon';
String get csvExportFeatureComingSoon => 'CSV export feature coming soon';
String get shareFeatureComingSoon => 'Share feature coming soon';
```

**Acción Requerida:**
- Features nice-to-have, no críticas para MVP
- Implementar post-lanzamiento
- PDF: usar `pdf` package
- CSV: usar `csv` package
- Share: usar `share_plus` package

---

### 38. Prediction History - Share Feature

**Archivo:** `screens/prediction_history_screen.dart`
**Línea:** 122
**Categoría:** BAJA
**Estado:** Coming soon

```dart
const SnackBar(content: Text('Sharing feature coming soon!')),
```

**Acción Requerida:**
- Implementar compartir predicciones verificadas
- Usar `share_plus` package
- Diseñar imagen/texto para compartir

---

### 39. Consultation Session - Placeholder Implementation

**Archivo:** `services/consultation_session_service.dart`
**Líneas:** 114, 134
**Categoría:** BAJA
**Estado:** Placeholder

```dart
// For now, we'll use a placeholder implementation
```

**Acción Requerida:**
- Feature futura - consultas con astrólogos
- Requiere backend para scheduling
- Video call integration

---

### 40-41. Dynamic Content Service - Cache Clearing Disabled

**Archivo:** `services/dynamic_content_service.dart`
**Línea:** 223
**Categoría:** MEDIA
**Estado:** Deshabilitado

```dart
// AdvancedCompatibilityService cache clearing disabled
```

**Acción Requerida:**
- Relacionado con issue #28 (CompatibilityCacheManager)
- Resolver junto con ese issue

---

## Resumen por Categoría

### CRÍTICOS (3)
1. Push Notifications (6 TODOs relacionados - #4-9)
2. Ascendant Calculation (#2)
3. Home Download Loop (#13)
4. RevenueCat API Keys (#30)
5. Reactivar Compatibility Cache (#12)

### ALTOS (8)
1. Ascendant Place Picker (#3)
2. User ID en Analytics (#11)
3. Cache Memory Pressure (#14)
4. Background Calendar Processor (#15-21)
5. Compatibility Cache Manager (#22-28)
6. Pricing Info Provider (#1)

### MEDIOS (15)
1. Personalization Settings (#31)
2. Google Calendar Connection (#33)
3. AI Insights Generator (#29)
4. Dynamic Content Cache (#40-41)
5. Export Features (PDF/CSV) (#35-37)
6. Prediction Share (#38)
7. Outlook Calendar Sync (#34)

### BAJOS (15)
1. Consultation Sessions (#39)
2. Prediction Notification Settings (#32)
3. Múltiples placeholder methods en monetization
4. Gamification placeholders
5. Advanced analytics placeholders

---

## Archivos con Más TODOs

1. `services/prediction_notification_service.dart` - 6 TODOs
2. `services/calendar/background_calendar_processor.dart` - 7 áreas deshabilitadas
3. `services/compatibility_cache_service.dart` - 6 managers deshabilitados
4. `screens/ascendant_screen.dart` - 2 TODOs
5. `services/cache_service.dart` - 1 método crítico
6. Múltiples archivos de monetization - placeholders

---

## Timeline Estimado

### Críticos (Pre-Lanzamiento)
- **RevenueCat Keys:** 1 hora
- **Push Notifications:** 12-16 horas
- **Home Download Loop:** 4-6 horas
- **Ascendant Calculation:** 4-6 horas
- **Reactivar Cache:** 6-8 horas
**TOTAL:** ~35-40 horas (5-6 días laborables)

### Altos (Post-Lanzamiento Inmediato)
- **Place Picker:** 3-4 horas
- **User ID Analytics:** 3-4 horas
- **Memory Pressure:** 4-6 horas
- **Pricing Info:** 2-3 horas
**TOTAL:** ~15-20 horas (2-3 días laborables)

### Medios (Sprint 2-3)
- **Calendar Integrations:** 16-24 horas
- **Export Features:** 8-12 horas
**TOTAL:** ~30-40 horas (4-5 días laborables)

### TOTAL ESTIMADO: 80-100 horas (10-13 días laborables)

---

**Generado por:** Claude Code Agent
**Última actualización:** 2025-10-05
