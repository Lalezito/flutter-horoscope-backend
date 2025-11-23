# 🔥 Sistema Serie Giornaliere - Documentazione Completa

**Creato:** 23 gennaio 2025
**Versione:** 1.0.0
**Impatto Previsto:** +800% retention utenti attraverso FOMO e formazione abitudini

---

## 📋 Indice

1. [Panoramica](#panoramica)
2. [Architettura](#architettura)
3. [Schema Database](#schema-database)
4. [Integrazione API](#integrazione-api)
5. [Sistema Traguardi](#sistema-traguardi)
6. [Esempi d'Uso](#esempi-duso)
7. [Guida Integrazione Frontend](#guida-integrazione-frontend)
8. [Checklist Testing](#checklist-testing)
9. [Istruzioni Deployment](#istruzioni-deployment)

---

## 🎯 Panoramica

Il Sistema Serie Giornaliere è una funzionalità di gamification progettata per aumentare la retention utenti attraverso:

- **Check-in giornalieri**: Tracciamento automatico quando gli utenti interagiscono con AI Coach
- **Tracciamento serie**: Serie corrente e record personale (serie più lunga)
- **Ricompense traguardi**: Ricompense progressive a numeri chiave serie (3, 7, 14, 30, 60, 90, 180, 365 giorni)
- **Punti cosmici**: Sistema accumulo punti (+10 per giorno + bonus ai traguardi)
- **Sistema badge**: Badge di achievement per traguardi principali
- **Meccaniche FOMO**: Paura di perdere la serie incoraggia ritorni quotidiani

### Metriche Chiave

- **Frequenza check-in**: Giornaliera
- **Calcolo serie**: Giorni consecutivi (si interrompe se l'utente salta un giorno)
- **Punti per check-in**: 10 punti cosmici
- **Traguardi totali**: 8 traguardi principali
- **Lingue supportate**: Spagnolo (es), Inglese (en)

---

## 🏗️ Architettura

### Componenti

```
┌─────────────────────────────────────────────────────────┐
│                Frontend (Flutter)                        │
│  - Visualizza serie nell'UI                             │
│  - Mostra achievement traguardi                          │
│  - Componente classifica                                 │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│            Backend - aiCoachService.js                   │
│  - Chiama streakService.checkIn() ad ogni messaggio     │
│  - Restituisce info serie nella risposta                │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│            streakService.js (Nuovo File)                 │
│  - checkIn(userId, language)                             │
│  - getStreak(userId)                                     │
│  - getLeaderboard(limit)                                 │
│  - Logica calcolo traguardi                              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│         PostgreSQL - tabella user_streaks                │
│  - Memorizza tutti i dati serie                          │
│  - Indicizzata per performance                           │
└─────────────────────────────────────────────────────────┘
```

---

## 💾 Schema Database

### Tabella: `user_streaks`

```sql
CREATE TABLE user_streaks (
  -- Identificazione primaria
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Tracciamento serie
  current_streak INT DEFAULT 0 NOT NULL,      -- Giorni consecutivi correnti
  longest_streak INT DEFAULT 0 NOT NULL,      -- Record personale
  last_check_in DATE,                         -- Data ultimo check-in (UTC)
  total_check_ins INT DEFAULT 0 NOT NULL,     -- Totale lifetime

  -- Gamification
  cosmic_points INT DEFAULT 0 NOT NULL,       -- Punti accumulati
  badges JSONB DEFAULT '[]'::jsonb NOT NULL,  -- Array badge guadagnati
  milestones_achieved JSONB DEFAULT '[]'::jsonb NOT NULL,  -- Numeri traguardi raggiunti

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

---

## 🔌 Integrazione API

### Integrazione Automatica (AI Coach)

Il sistema serie è **automaticamente attivato** quando gli utenti inviano messaggi ad AI Coach. Non servono chiamate API aggiuntive!

**Modificato in `aiCoachService.js`:**

```javascript
// Righe 32 (import)
const streakService = require('./streakService');

// Righe 365-368 (logica check-in)
const userLanguage = options.language || 'es';
const streakInfo = await streakService.checkIn(userId, userLanguage);

// Riga 396 (restituisce serie nella risposta)
streak: streakInfo
```

### Formato Risposta

Ogni messaggio AI Coach ora include dati serie:

```json
{
  "success": true,
  "response": {
    "content": "La tua risposta AI coach...",
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
      "name": "Guerriero di una Settimana",
      "badge": "week_warrior",
      "reward": "Lettura speciale Luna (gratis)",
      "cosmicPoints": 70
    },
    "badges": ["beginner", "week_warrior"],
    "message": "🔥 Serie corrente: 7 giorni\n🏆 NUOVO RECORD PERSONALE!\n\n✨ TRAGUARDO SBLOCCATO: Guerriero di una Settimana!\n🎁 Ricompensa: Lettura speciale Luna (gratis)\n💎 +70 punti cosmici extra\n\n💪 Prossimo obiettivo: 7 giorni per \"Dedicato\"\n🎯 Ricompensa: 1 lettura premium gratis"
  }
}
```

---

## 🏆 Sistema Traguardi

### Tabella Traguardi Completa

| Giorni Serie | Nome Italiano | Nome Inglese | Badge | Ricompensa | Punti Bonus |
|--------------|---------------|--------------|-------|------------|-------------|
| **3** | Iniziando | Getting Started | `beginner` | Badge: Iniziando | +30 |
| **7** | Guerriero di una Settimana | Week Warrior | `week_warrior` | Lettura speciale Luna (gratis) | +70 |
| **14** | Dedicato | Dedicated | `dedicated` | 1 lettura premium gratis | +150 |
| **30** | Guerriero Cosmico | Cosmic Warrior | `cosmic_warrior` | Lettura annuale 2026 | +300 |
| **60** | Maestro delle Abitudini | Habit Master | `habit_master` | 3 letture premium gratis | +600 |
| **90** | Illuminato | Enlightened | `enlightened` | 1 mese premium gratis | +1000 |
| **180** | Devoto Cosmico | Cosmic Devotee | `cosmic_devotee` | 3 mesi premium gratis | +2000 |
| **365** | Leggenda Cosmica | Cosmic Legend | `cosmic_legend` | Premium lifetime | +5000 |

---

## 📱 Esempi d'Uso

### Esempio 1: Utente Prima Volta

**Richiesta:**
```javascript
POST /ai-coach/sessions/{sessionId}/messages
{
  "message": "Come va la mia giornata oggi?",
  "language": "it"
}
```

**Risposta:**
```json
{
  "success": true,
  "response": { /* Risposta AI */ },
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
    "message": "🔥 Prima serie! Torna domani per mantenerla viva.\n💫 +10 punti cosmici guadagnati"
  }
}
```

### Esempio 2: Raggiungimento Traguardo 7 Giorni

**Risposta:**
```json
{
  "streak": {
    "current_streak": 7,
    "longest_streak": 7,
    "is_new_record": true,
    "cosmic_points_earned": 80,
    "milestone": {
      "streak": 7,
      "name": "Guerriero di una Settimana",
      "badge": "week_warrior",
      "reward": "Lettura Luna Gratis",
      "cosmicPoints": 70
    },
    "message": "🔥 Serie corrente: 7 giorni\n🏆 NUOVO RECORD PERSONALE!\n\n✨ TRAGUARDO SBLOCCATO: Guerriero di una Settimana!\n🎁 Ricompensa: Lettura Luna Gratis\n💎 +70 punti cosmici bonus"
  }
}
```

---

## 🎨 Guida Integrazione Frontend

### Esempio Widget Flutter

```dart
class StreakWidget extends StatelessWidget {
  final Map<String, dynamic> streakData;

  @override
  Widget build(BuildContext context) {
    final currentStreak = streakData['current_streak'] ?? 0;
    final cosmicPoints = streakData['total_cosmic_points'] ?? 0;

    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text('🔥', style: TextStyle(fontSize: 24)),
                    SizedBox(width: 8),
                    Text(
                      '$currentStreak giorni',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Text('💎', style: TextStyle(fontSize: 20)),
                    SizedBox(width: 4),
                    Text('$cosmicPoints', style: TextStyle(fontSize: 18)),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## ✅ Checklist Testing

### Test Backend

#### Test 1: Primo Check-in
```javascript
const result = await streakService.checkIn(userId, 'it');
// Previsto: current_streak = 1, longest_streak = 1, is_first_time = true
```

#### Test 2: Giorni Consecutivi
```javascript
// Giorno 1
await streakService.checkIn(userId, 'it');
// Giorno 2
const result = await streakService.checkIn(userId, 'it');
// Previsto: current_streak = 2, streak_broken = false
```

#### Test 3: Raggiungimento Traguardo
```javascript
// Impostare manualmente serie a 6 nel database
// Fare check-in giorno 7
const result = await streakService.checkIn(userId, 'it');
// Previsto: milestone.name = 'Guerriero di una Settimana'
```

---

## 🚀 Istruzioni Deployment

### Step 1: Eseguire Migrazione Database

```bash
# Produzione
psql $DATABASE_URL -f migrations/011_create_user_streaks_table.sql

# Sviluppo
psql -U your_user -d your_db -f migrations/011_create_user_streaks_table.sql
```

### Step 2: Verificare Migrazione

```sql
-- Verificare che la tabella esista
SELECT COUNT(*) FROM user_streaks;

-- Verificare indici
SELECT indexname FROM pg_indexes WHERE tablename = 'user_streaks';
```

### Step 3: Deployare Codice Backend

```bash
git add migrations/011_create_user_streaks_table.sql
git add src/services/streakService.js
git commit -m "feat: implementare sistema gamification serie giornaliere"
git push
```

---

## 📊 Metriche & KPI Previsti

### Metriche Retention

| Metrica | Prima Serie | Target Dopo Serie | Periodo Misurazione |
|---------|-------------|-------------------|---------------------|
| **Retention Giorno 1** | ~40% | ~70% | 30 giorni |
| **Retention Giorno 7** | ~15% | ~45% | 30 giorni |
| **Retention Giorno 30** | ~5% | ~25% | 90 giorni |
| **Utenti Attivi Giornalieri** | Baseline | +800% | 90 giorni |

### Metriche Engagement

- **Frequenza sessione media**: Target 5x/settimana (da 1-2x/settimana)
- **Tasso completamento serie (7 giorni)**: Target 30% utenti
- **Tasso completamento serie (30 giorni)**: Target 10% utenti

---

## 🔧 Risoluzione Problemi

### Problema: Serie non si aggiorna

**Sintomi:** L'utente fa check-in ma la serie rimane a 0
**Soluzione:**
```sql
-- Verificare se esiste il record
SELECT * FROM user_streaks WHERE user_id = 'uuid';

-- Se non esiste record, il primo check-in dovrebbe crearne uno
-- Controllare log server per errori in streakService.checkIn()
```

### Problema: Punti non si accumulano

**Soluzione:**
```javascript
// Verificare valore di ritorno streakService.checkIn()
console.log(streakInfo);

// Verificare: cosmic_points_earned > 0, total_cosmic_points in aumento
```

---

## 📈 Miglioramenti Futuri

1. **Funzionalità Social**
   - Condividere achievement traguardi
   - Confronto serie amici
   - Sfide team/gruppo

2. **Ricompense Avanzate**
   - Assicurazione serie (1 giorno perso perdonato al mese)
   - Recupero serie (pagare punti cosmici per ripristinare serie interrotta)
   - Bonus serie settimanali/mensili

3. **Personalizzazione**
   - Orari promemoria personalizzati
   - Ricompense traguardi personalizzate in base a preferenze utente
   - Congelamenti serie per vacanze

---

## 📝 Changelog

### v1.0.0 (2025-01-23)
- ✨ Release iniziale
- 🗄️ Schema database con tabella user_streaks
- 🔥 Tracciamento serie core (corrente, più lunga, totale)
- 🏆 Sistema traguardi 8 livelli (3-365 giorni)
- 💎 Gamification punti cosmici
- 🎖️ Sistema badge
- 🌍 Supporto bilingue (ES/EN)
- 🔗 Auto-integrazione con AI Coach
- 📊 Funzionalità classifica

---

**Costruito con 💜 per utenti Zodia**
*Rendere la guida cosmica quotidiana un'abitudine, una serie alla volta.*
