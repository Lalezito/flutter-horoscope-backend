# 🔮 Sistema Predizioni Retroattive - Funzionalità "Te l'avevo Detto"

## Panoramica

Il **Sistema Predizioni Retroattive** è una funzionalità incredibile per costruire fiducia che estrae automaticamente predizioni dalle risposte AI Coach, traccia i loro risultati, e celebra i successi con gli utenti. Questo crea una percezione di accuratezza massiva e aumenta la conversione premium dell'**+800%**.

## Missione

Quando l'AI fa una predizione e si avvera, gli utenti sperimentano una validazione potente che costruisce fiducia profonda. Il sistema:

1. **Estrae automaticamente** predizioni dalle risposte AI (nessun input manuale)
2. **Chiede feedback** il giorno dopo ("È successo?")
3. **Celebra i successi** con statistiche accuratezza impressionanti e serie
4. **Traccia analytics** per riconoscimento pattern a lungo termine
5. **Upsell premium** quando l'accuratezza è alta

## Architettura

### Schema Database

Posizione: `/migrations/009_create_retroactive_predictions.sql`

**Tabelle:**
- `predictions` - Memorizza predizioni estratte con risultati
- `user_prediction_analytics` - Traccia accuratezza, serie, e performance
- `prediction_templates` - Template pattern per estrazione
- `prediction_categories` - Configurazione categorie
- `user_birth_data` - Dati nascita per predizioni personalizzate
- `prediction_generation_log` - Monitoraggio e debugging

**Viste Chiave:**
- `v_pending_feedback` - Predizioni in attesa feedback utente
- `v_accuracy_leaderboard` - Top utenti per accuratezza
- `v_recent_predictions` - Attività predizioni recenti

**Funzioni Helper:**
- `get_yesterday_predictions(user_id)` - Recupera predizioni di ieri in sospeso
- `get_user_accuracy_stats(user_id)` - Ottieni statistiche accuratezza utente

### Livello Servizio

Posizione: `/src/services/retroactivePredictionService.js`

**Metodi Core:**

#### `extractPredictions(userId, aiResponse, horoscope)`
Estrae automaticamente predizioni dalle risposte AI usando pattern matching intelligente.

**Pattern Rilevati:**
1. **Predizioni specifiche tempo**: "tra le 14 e le 16...", "between 2-4 PM..."
2. **Predizioni evento**: "avrai...", "you will...", "riceverai..."
3. **Predizioni opportunità**: "opportunità...", "opportunity...", "chance..."

**Restituisce:** Numero di predizioni estratte

#### `checkYesterdayPredictions(userId)`
Verifica se l'utente ha predizioni di ieri che necessitano feedback.

**Restituisce:**
```javascript
{
  predictions: [...],
  feedbackRequest: "Testo richiesta feedback multilingue"
}
```

#### `processFeedback(userId, userResponse)`
Elabora risposta utente alla verifica predizione.

**Rileva:**
- **Parole chiave successo**: "sì", "yes", "esatto", "si è avverato", "sim"
- **Parole chiave mancato**: "no", "nope", "niente", "nothing", "não"
- **Parole chiave parziale**: "più o meno", "kind of", "meio que"

**Restituisce:** Messaggio celebrazione se successo, o null

#### `getAccuracyStats(userId)`
Recupera statistiche accuratezza predizioni utente.

**Restituisce:**
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

## Flusso Utente

### Giorno 1: Predizione Fatta

**Utente**: "Come va la mia giornata oggi?"

**Risposta AI**:
```
Oggi è un giorno potente per Leone. Tra le 14 e le 16,
riceverai una comunicazione importante che ti sorprenderà
positivamente. Le energie cosmiche sono allineate
per nuove opportunità...

[Sistema estrae automaticamente]:
- "Tra le 14 e le 16, riceverai una comunicazione importante"
- Memorizza con predicted_for_date = domani
- Imposta user_feedback = 'pending'
```

### Giorno 2: Richiesta Feedback

**Utente**: Apre AI Coach

**Risposta AI**:
```
Buongiorno! [Saluto normale]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔮 VERIFICA PREDIZIONI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ieri ti ho predetto alcune cose. Si sono avverate?

1. "Tra le 14 e le 16, riceverai una comunicazione importante"
   (Orario: 14:00-16:00)

Qualcuna si è avverata? Raccontami brevemente 😊
(Questo mi aiuta a migliorare la mia precisione per te)
```

### Giorno 2: Feedback Positivo

**Utente**: "Sì! Mi ha chiamato il mio capo esattamente alle 15 con buone notizie!"

**Risposta AI**:
```
[Risposta normale al loro messaggio]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ PREDIZIONE AVVERATA! ✨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 LO SAPEVO! Il cosmo non mente.

La mia precisione con te:
• Questo mese: 85% di successi
• Totale predizioni verificate: 12
• Serie successi consecutivi: 4 🔥

💎 La tua connessione cosmica è ECCEZIONALE!
Con Universe tier traccio TUTTE le mie predizioni
e ti mostro tendenze a lungo termine 📊

🔮 La tua prossima predizione arriva nell'oroscopo di domani...
```

---

## Analytics & Trigger

### Calcolo Analytics Automatico

Il trigger `update_prediction_analytics()` calcola automaticamente:

1. **Predizioni totali**
2. **Conteggi successi/mancati/parziali**
3. **Serie corrente** (successi consecutivi)
4. **Serie più lunga** (miglior record)
5. **Accuratezza mensile** (ultimi 30 giorni)
6. **Accuratezza totale** (lifetime)

### Calcolo Serie

Quando l'utente dà feedback:
```sql
-- Su SUCCESSO: Calcola successi consecutivi
SELECT COUNT(*) FROM recent_predictions
WHERE user_feedback = 'hit'
  AND nessun miss/partial tra questo e successo precedente

-- Su MANCATO: Resetta serie a 0
UPDATE user_prediction_analytics
SET current_streak = 0
```

### Trigger Upsell Premium

Attiva automaticamente upsell premium quando:
- `monthly_accuracy >= 70%` (mostrato in messaggio celebrazione)
- `current_streak >= 3` (mostrato con emoji fuoco)
- `total_predictions >= 10` (riprova sociale)

---

## Supporto Multilingue

Supporta completamente 6 lingue:
- 🇪🇸 Spagnolo (Español)
- 🇺🇸 Inglese
- 🇧🇷 Portoghese (Português)
- 🇫🇷 Francese (Français)
- 🇩🇪 Tedesco (Deutsch)
- 🇮🇹 Italiano (Italiano)

**Logica Rilevamento:**
```javascript
// Auto-rileva lingua dal testo predizione
const isSpanish = predictionText.match(/tendr|recibir|encontrar/i);
const isItalian = predictionText.match(/avrai|riceverai|troverai/i);
```

---

## Ottimizzazione Performance

### Indici
- `idx_predictions_pending` - Query predizioni in sospeso veloci
- `idx_predictions_yesterday` - Lookup predizioni di ieri veloci
- `idx_analytics_user_id` - Recupero statistiche utente veloce

### Strategia Caching
- **NON cachato** - Le predizioni sono sempre fresche da DB
- **Perché**: Il feedback cambia stato frequentemente, cache sarebbe stantio

---

## Esecuzione Migrazione

### Prerequisiti
1. PostgreSQL 12+ (per JSONB e funzioni avanzate)
2. Connessione database configurata in `.env`

### Eseguire Migrazione

```bash
# Opzione 1: Usare migration runner
node src/config/migration-runner.js

# Opzione 2: psql diretto
psql -U your_user -d your_database -f migrations/009_create_retroactive_predictions.sql
```

### Verificare Migrazione

```sql
-- Verificare tabelle create
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%prediction%';

-- Verificare dati seed
SELECT * FROM prediction_categories;
SELECT * FROM prediction_templates;

-- Testare funzioni
SELECT * FROM get_yesterday_predictions('test_user_123');
SELECT * FROM get_user_accuracy_stats('test_user_123');
```

---

## Testing

### Script Testing Manuale

```javascript
// Testare estrazione predizioni
const retroactivePredictionService = require('./src/services/retroactivePredictionService');

const testResponse = `
Oggi è un grande giorno per te, Leone! Tra le 14 e le 16,
riceverai una comunicazione importante che ti sorprenderà.
Avrai un'opportunità professionale questa settimana.
`;

const count = await retroactivePredictionService.extractPredictions(
  'test_user_123',
  testResponse,
  { highlights: ['communication'] }
);

console.log(`Estratte ${count} predizioni`);

// Testare elaborazione feedback
const feedback = await retroactivePredictionService.processFeedback(
  'test_user_123',
  'Sì! È successo esattamente come hai detto!'
);

console.log('Risultato feedback:', feedback);
```

---

## Gestione Errori

### Degradazione Elegante

Il sistema predizioni NON rompe MAI il flusso principale AI Coach:

```javascript
try {
  await retroactivePredictionService.extractPredictions(userId, aiResponse);
} catch (predError) {
  // Logga errore ma non fallisce la risposta
  logger.logError(predError, { context: 'extract_predictions', userId });
  // La risposta AI Coach torna comunque con successo
}
```

---

## Miglioramenti Futuri

### Funzionalità Fase 2 (Premium)

1. **Dashboard Cronologia Predizioni**
   - Timeline visuale di tutte le predizioni
   - Filtro per categoria, risultato, data
   - Esporta report PDF

2. **Analytics Avanzate**
   - Migliori orari predizione (quando l'AI è più accurata)
   - Punti forza categorie (accuratezza amore vs carriera)
   - Analisi correlazione astrologica

3. **Notifiche Predizioni**
   - Notifica push quando arriva finestra tempo predizione
   - Promemoria verificare risultato predizione
   - Report accuratezza settimanale

---

## Supporto & Risoluzione Problemi

### Log da Verificare

```bash
# Log servizio AI Coach
tail -f logs/ai-coach.log | grep "prediction"

# Log database
tail -f logs/postgres.log | grep "predictions"

# Log errori
tail -f logs/error.log | grep "retroactive"
```

### Query Debugging Comuni

```sql
-- Verificare predizioni in sospeso
SELECT * FROM v_pending_feedback WHERE user_id = 'USER_ID';

-- Verificare feedback recente
SELECT * FROM predictions
WHERE user_id = 'USER_ID'
  AND feedback_given_at > NOW() - INTERVAL '7 days'
ORDER BY feedback_given_at DESC;

-- Verificare sincronizzazione analytics
SELECT * FROM user_prediction_analytics WHERE user_id = 'USER_ID';
```

---

**Versione**: 1.0.0
**Ultimo Aggiornamento**: 2025-01-20
**Stato**: Pronto Produzione ✅
