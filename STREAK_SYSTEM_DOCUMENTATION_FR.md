# 🔥 Système de Séquences Quotidiennes - Documentation Complète

**Créé :** 23 janvier 2025
**Version :** 1.0.0
**Impact Attendu :** +800% de rétention utilisateur grâce au FOMO et à la formation d'habitudes

---

## 📋 Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Schéma de Base de Données](#schéma-de-base-de-données)
4. [Intégration API](#intégration-api)
5. [Système de Jalons](#système-de-jalons)
6. [Exemples d'Utilisation](#exemples-dutilisation)
7. [Guide d'Intégration Frontend](#guide-dintégration-frontend)
8. [Liste de Vérification des Tests](#liste-de-vérification-des-tests)
9. [Instructions de Déploiement](#instructions-de-déploiement)

---

## 🎯 Vue d'Ensemble

Le Système de Séquences Quotidiennes est une fonctionnalité de gamification conçue pour augmenter la rétention utilisateur grâce à :

- **Enregistrements quotidiens** : Suivi automatique lorsque les utilisateurs interagissent avec AI Coach
- **Suivi des séquences** : Séquence actuelle et record personnel (séquence la plus longue)
- **Récompenses de jalons** : Récompenses progressives aux nombres clés de séquences (3, 7, 14, 30, 60, 90, 180, 365 jours)
- **Points cosmiques** : Système d'accumulation de points (+10 par jour + bonus aux jalons)
- **Système de badges** : Badges de réussite pour les jalons majeurs
- **Mécaniques FOMO** : La peur de perdre la séquence encourage les retours quotidiens

### Métriques Clés

- **Fréquence d'enregistrement** : Quotidienne
- **Calcul de séquence** : Jours consécutifs (se casse si l'utilisateur manque un jour)
- **Points par enregistrement** : 10 points cosmiques
- **Jalons totaux** : 8 jalons majeurs
- **Langues supportées** : Espagnol (es), Anglais (en)

---

## 🏗️ Architecture

### Composants

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Flutter)                    │
│  - Afficher la séquence dans l'UI                      │
│  - Montrer les réalisations de jalons                  │
│  - Composant classement                                │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Backend - aiCoachService.js                │
│  - Appelle streakService.checkIn() à chaque message    │
│  - Retourne les infos de séquence dans la réponse     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              streakService.js (Nouveau Fichier)         │
│  - checkIn(userId, language)                            │
│  - getStreak(userId)                                    │
│  - getLeaderboard(limit)                                │
│  - Logique de calcul des jalons                        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│          PostgreSQL - table user_streaks                │
│  - Stocke toutes les données de séquences              │
│  - Indexé pour la performance                          │
└─────────────────────────────────────────────────────────┘
```

### Structure des Fichiers

```
backend/flutter-horoscope-backend/
├── migrations/
│   └── 011_create_user_streaks_table.sql  [NOUVEAU ✨]
├── src/
│   ├── services/
│   │   ├── streakService.js               [NOUVEAU ✨]
│   │   └── aiCoachService.js              [MODIFIÉ]
│   └── config/
│       └── db.js
└── STREAK_SYSTEM_DOCUMENTATION.md          [NOUVEAU ✨]
```

---

## 💾 Schéma de Base de Données

### Table : `user_streaks`

```sql
CREATE TABLE user_streaks (
  -- Identification principale
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Suivi des séquences
  current_streak INT DEFAULT 0 NOT NULL,      -- Jours consécutifs actuels
  longest_streak INT DEFAULT 0 NOT NULL,      -- Record personnel
  last_check_in DATE,                         -- Date du dernier enregistrement (UTC)
  total_check_ins INT DEFAULT 0 NOT NULL,     -- Total à vie

  -- Gamification
  cosmic_points INT DEFAULT 0 NOT NULL,       -- Points accumulés
  badges JSONB DEFAULT '[]'::jsonb NOT NULL,  -- Tableau de badges gagnés
  milestones_achieved JSONB DEFAULT '[]'::jsonb NOT NULL,  -- Nombres de jalons atteints

  -- Métadonnées
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Index

```sql
CREATE INDEX idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX idx_user_streaks_current_streak ON user_streaks(current_streak DESC);
CREATE INDEX idx_user_streaks_last_check_in ON user_streaks(last_check_in DESC);
CREATE INDEX idx_user_streaks_cosmic_points ON user_streaks(cosmic_points DESC);
```

### Trigger de Mise à Jour Automatique

```sql
CREATE TRIGGER trigger_update_user_streaks_timestamp
BEFORE UPDATE ON user_streaks
FOR EACH ROW
EXECUTE FUNCTION update_user_streaks_updated_at();
```

---

## 🔌 Intégration API

### Intégration Automatique (AI Coach)

Le système de séquences est **automatiquement déclenché** lorsque les utilisateurs envoient des messages à AI Coach. Aucun appel API supplémentaire nécessaire !

**Modifié dans `aiCoachService.js` :**

```javascript
// Ligne 32 (import)
const streakService = require('./streakService');

// Lignes 365-368 (logique d'enregistrement)
const userLanguage = options.language || 'es';
const streakInfo = await streakService.checkIn(userId, userLanguage);

// Ligne 396 (retourner la séquence dans la réponse)
streak: streakInfo
```

### Format de Réponse

Chaque message AI Coach inclut maintenant les données de séquence :

```json
{
  "success": true,
  "response": {
    "content": "Votre réponse AI coach...",
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
      "name": "Guerrier d'une Semaine",
      "badge": "week_warrior",
      "reward": "Lecture Lune spéciale (gratuite)",
      "cosmicPoints": 70
    },
    "badges": ["beginner", "week_warrior"],
    "message": "🔥 Séquence actuelle : 7 jours\n🏆 NOUVEAU RECORD PERSONNEL !\n\n✨ JALON DÉBLOQUÉ : Guerrier d'une Semaine !\n🎁 Récompense : Lecture Lune spéciale (gratuite)\n💎 +70 points cosmiques bonus\n\n💪 Prochain objectif : 7 jours pour \"Dévoué\"\n🎯 Récompense : 1 lecture premium gratuite"
  }
}
```

---

## 🏆 Système de Jalons

### Table Complète des Jalons

| Jours de Séquence | Nom Français | Nom Anglais | Badge | Récompense | Points Bonus |
|-------------|-------------|--------------|-------|--------|--------------|
| **3** | Démarrage | Getting Started | `beginner` | Badge : Démarrage | +30 |
| **7** | Guerrier d'une Semaine | Week Warrior | `week_warrior` | Lecture Lune spéciale (gratuite) | +70 |
| **14** | Dévoué | Dedicated | `dedicated` | 1 lecture premium gratuite | +150 |
| **30** | Guerrier Cosmique | Cosmic Warrior | `cosmic_warrior` | Lecture annuelle 2026 | +300 |
| **60** | Maître des Habitudes | Habit Master | `habit_master` | 3 lectures premium gratuites | +600 |
| **90** | Illuminé | Enlightened | `enlightened` | 1 mois premium gratuit | +1000 |
| **180** | Dévoué Cosmique | Cosmic Devotee | `cosmic_devotee` | 3 mois premium gratuits | +2000 |
| **365** | Légende Cosmique | Cosmic Legend | `cosmic_legend` | Premium à vie | +5000 |

### Logique des Jalons

1. **Récompenses uniques** : Les jalons ne peuvent être atteints qu'une seule fois par utilisateur
2. **Suivi en base de données** : Le tableau JSONB `milestones_achieved` stocke les numéros de jalons atteints
3. **Déblocage de badge** : Les badges sont ajoutés au tableau `badges` lors de la réalisation du jalon
4. **Points bonus** : Points cosmiques supplémentaires attribués en plus des +10 quotidiens

### Exemples de Calcul de Points

```javascript
// Jour 1 : Premier enregistrement
cosmic_points_earned = 10
total_cosmic_points = 10

// Jour 3 : Jalon "Démarrage"
cosmic_points_earned = 10 + 30 = 40
total_cosmic_points = 10 + 10 + 40 = 60

// Jour 7 : Jalon "Guerrier d'une Semaine"
cosmic_points_earned = 10 + 70 = 80
total_cosmic_points = 60 + 10 + 10 + 10 + 80 = 170

// Jour 8 : Jour régulier (jalon jour 7 déjà obtenu)
cosmic_points_earned = 10
total_cosmic_points = 170 + 10 = 180
```

---

## 📱 Exemples d'Utilisation

### Exemple 1 : Utilisateur Première Fois

**Requête :**
```javascript
// L'utilisateur envoie son premier message AI Coach
POST /ai-coach/sessions/{sessionId}/messages
{
  "message": "Que dit mon horoscope aujourd'hui ?",
  "language": "fr"
}
```

**Réponse :**
```json
{
  "success": true,
  "response": { /* Réponse AI */ },
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
    "message": "🔥 Première séquence ! Revenez demain pour la maintenir en vie.\n💫 +10 points cosmiques gagnés"
  }
}
```

### Exemple 2 : Atteindre le Jalon de 7 Jours

**Requête :**
```javascript
// 7ème jour consécutif de l'utilisateur
POST /ai-coach/sessions/{sessionId}/messages
{
  "message": "Bonjour, quel est mon horoscope ?",
  "language": "fr"
}
```

**Réponse :**
```json
{
  "success": true,
  "response": { /* Réponse AI */ },
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
      "name": "Guerrier d'une Semaine",
      "badge": "week_warrior",
      "reward": "Lecture Lune Gratuite",
      "cosmicPoints": 70
    },
    "badges": ["beginner", "week_warrior"],
    "message": "🔥 Séquence actuelle : 7 jours\n🏆 NOUVEAU RECORD PERSONNEL !\n\n✨ JALON DÉBLOQUÉ : Guerrier d'une Semaine !\n🎁 Récompense : Lecture Lune Gratuite\n💎 +70 points cosmiques bonus\n\n💪 Prochain objectif : 7 jours pour \"Dévoué\"\n🎯 Récompense : 1 Lecture Premium Gratuite"
  }
}
```

### Exemple 3 : Déjà Enregistré Aujourd'hui

**Requête :**
```javascript
// L'utilisateur envoie un deuxième message le même jour
POST /ai-coach/sessions/{sessionId}/messages
{
  "message": "Une autre question...",
  "language": "fr"
}
```

**Réponse :**
```json
{
  "success": true,
  "response": { /* Réponse AI */ },
  "streak": {
    "success": true,
    "current_streak": 7,
    "longest_streak": 7,
    "already_checked_in": true,
    "cosmic_points_earned": 0,
    "total_cosmic_points": 150,
    "total_check_ins": 7,
    "milestone": null,
    "message": "🔥 Déjà enregistré aujourd'hui. Séquence actuelle : 7 jours"
  }
}
```

### Exemple 4 : Séquence Cassée

**Requête :**
```javascript
// L'utilisateur revient après avoir manqué 2+ jours
POST /ai-coach/sessions/{sessionId}/messages
{
  "message": "Je suis de retour !",
  "language": "fr"
}
```

**Réponse :**
```json
{
  "success": true,
  "response": { /* Réponse AI */ },
  "streak": {
    "success": true,
    "current_streak": 1,
    "longest_streak": 7,
    "is_new_record": false,
    "streak_broken": true,
    "previous_streak": 7,
    "cosmic_points_earned": 10,
    "total_cosmic_points": 160,
    "total_check_ins": 8,
    "milestone": null,
    "message": "💔 Votre séquence a été cassée, mais chaque jour est un nouveau départ.\n🔥 Séquence actuelle : 1 jour\n\n💪 Prochain objectif : 2 jours pour \"Démarrage\"\n🎯 Récompense : Badge : Démarrage"
  }
}
```

---

## 🎨 Guide d'Intégration Frontend

### Exemple de Widget Flutter

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
    final alreadyCheckedIn = streakData['already_checked_in'] ?? false;

    return Card(
      margin: EdgeInsets.all(16),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Compteur de séquence
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text('🔥', style: TextStyle(fontSize: 24)),
                    SizedBox(width: 8),
                    Text(
                      '$currentStreak jours',
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

            SizedBox(height: 12),

            // Notification de jalon
            if (milestone != null) ...[
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
                      '✨ JALON DÉBLOQUÉ !',
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

            // Statut d'enregistrement
            if (alreadyCheckedIn) ...[
              SizedBox(height: 8),
              Text(
                '✅ Déjà enregistré aujourd\'hui',
                style: TextStyle(color: Colors.green),
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

## ✅ Liste de Vérification des Tests

### Migration de Base de Données

- [ ] Exécuter la migration : `psql -d your_db -f migrations/011_create_user_streaks_table.sql`
- [ ] Vérifier la table créée : `\d user_streaks`
- [ ] Vérifier les index créés : `\di idx_user_streaks_*`
- [ ] Vérifier le trigger créé : `\df update_user_streaks_updated_at`
- [ ] Tester la contrainte : Essayer d'insérer une séquence négative (devrait échouer)

### Tests de Service Backend

#### Test 1 : Premier Enregistrement
```javascript
const userId = 'test-user-uuid';
const result = await streakService.checkIn(userId, 'fr');

// Attendu :
// - current_streak = 1
// - longest_streak = 1
// - is_first_time = true
// - cosmic_points_earned = 10
// - Enregistrement database créé
```

#### Test 2 : Jours Consécutifs
```javascript
// Jour 1
await streakService.checkIn(userId, 'fr');

// Attendre ou simuler la date au lendemain
// Jour 2
const result = await streakService.checkIn(userId, 'fr');

// Attendu :
// - current_streak = 2
// - streak_broken = false
```

#### Test 3 : Enregistrement en Double le Même Jour
```javascript
await streakService.checkIn(userId, 'fr');
const result = await streakService.checkIn(userId, 'fr');

// Attendu :
// - already_checked_in = true
// - cosmic_points_earned = 0
// - current_streak inchangé
```

---

## 🚀 Instructions de Déploiement

### Étape 1 : Exécuter la Migration Database

```bash
# Production
psql $DATABASE_URL -f migrations/011_create_user_streaks_table.sql

# Développement
psql -U your_user -d your_db -f migrations/011_create_user_streaks_table.sql
```

### Étape 2 : Vérifier la Migration

```sql
-- Vérifier l'existence de la table
SELECT COUNT(*) FROM user_streaks;

-- Vérifier les index
SELECT indexname FROM pg_indexes WHERE tablename = 'user_streaks';

-- Devrait retourner :
-- idx_user_streaks_user_id
-- idx_user_streaks_current_streak
-- idx_user_streaks_last_check_in
-- idx_user_streaks_cosmic_points
```

### Étape 3 : Déployer le Code Backend

```bash
# S'assurer que les nouveaux fichiers sont commités
git add migrations/011_create_user_streaks_table.sql
git add src/services/streakService.js
git add STREAK_SYSTEM_DOCUMENTATION.md
git commit -m "feat: implémenter système de gamification séquences quotidiennes"

# Déployer en production
git push heroku main
# OU votre méthode de déploiement
```

### Étape 4 : Vérifier le Déploiement

```bash
# Vérifier les logs pour les erreurs
heroku logs --tail

# Tester le endpoint API
curl -X POST https://your-api.com/ai-coach/sessions/{sessionId}/messages \
  -H "Content-Type: application/json" \
  -d '{"message": "Test", "language": "fr"}'

# Vérifier le champ 'streak' dans la réponse
```

---

## 📊 Métriques Attendues et KPI

### Métriques de Rétention

| Métrique | Avant Séquences | Cible Après Séquences | Période de Mesure |
|--------|---------------|---------------------|-------------------|
| **Rétention Jour 1** | ~40% | ~70% | 30 jours |
| **Rétention Jour 7** | ~15% | ~45% | 30 jours |
| **Rétention Jour 30** | ~5% | ~25% | 90 jours |
| **Utilisateurs Actifs Quotidiens** | Baseline | +800% | 90 jours |

### Métriques d'Engagement

- **Fréquence de session moyenne** : Cible 5x/semaine (contre 1-2x/semaine)
- **Taux de complétion séquence (7 jours)** : Cible 30% des utilisateurs
- **Taux de complétion séquence (30 jours)** : Cible 10% des utilisateurs
- **Taux de réalisation de jalons** : Suivre le % d'utilisateurs atteignant chaque jalon

### Impact sur les Revenus

- **Conversions premium depuis séquences** : Suivre les utilisateurs qui upgradent après avoir atteint des jalons
- **Augmentation de la valeur vie client** : Attendre 3-5x LTV pour les utilisateurs avec séquences de 30+ jours

---

## 🔧 Dépannage

### Problème : Séquence ne se met pas à jour

**Symptômes :** L'utilisateur s'enregistre mais la séquence reste à 0
**Solution :**
```sql
-- Vérifier si l'enregistrement existe
SELECT * FROM user_streaks WHERE user_id = 'uuid';

-- Si aucun enregistrement, le premier enregistrement devrait en créer un
-- Vérifier les logs serveur pour erreurs dans streakService.checkIn()
```

### Problème : Jalon attribué plusieurs fois

**Symptômes :** L'utilisateur reçoit le même jalon deux fois
**Solution :**
```sql
-- Vérifier le tableau milestones_achieved
SELECT milestones_achieved FROM user_streaks WHERE user_id = 'uuid';

-- Devrait être : [3, 7, 14, 30] (les nombres n'apparaissent qu'une fois)
-- Si doublons existent, corriger les données :
UPDATE user_streaks
SET milestones_achieved = (
  SELECT jsonb_agg(DISTINCT elem)
  FROM jsonb_array_elements_text(milestones_achieved) elem
)
WHERE user_id = 'uuid';
```

---

## 📈 Améliorations Futures

1. **Fonctionnalités Sociales**
   - Partager les réalisations de jalons
   - Comparaisons de séquences entre amis
   - Challenges d'équipe/groupe

2. **Récompenses Avancées**
   - Assurance séquence (1 jour manqué pardonné par mois)
   - Récupération de séquence (payer des points cosmiques pour restaurer une séquence cassée)
   - Bonus de séquence hebdomadaire/mensuelle

3. **Personnalisation**
   - Horaires de rappel personnalisés
   - Récompenses de jalons personnalisées selon les préférences utilisateur
   - Gel de séquence pour les vacances

4. **Tableau de Bord Analytics**
   - Vue admin des statistiques de séquences
   - Analyse de cohorte par niveau de séquence
   - Visualisation de l'entonnoir de rétention

---

## 📝 Changelog

### v1.0.0 (2025-01-23)
- ✨ Version initiale
- 🗄️ Schéma de base de données avec table user_streaks
- 🔥 Suivi des séquences de base (actuel, plus long, total)
- 🏆 Système de jalons à 8 niveaux (3 à 365 jours)
- 💎 Gamification points cosmiques
- 🎖️ Système de badges
- 🌍 Support bilingue (ES/EN)
- 🔗 Auto-intégration avec AI Coach
- 📊 Fonctionnalité classement

---

## 🆘 Support

Pour questions ou problèmes :
- **Documentation :** Ce fichier
- **Emplacement du code :** `/src/services/streakService.js`
- **Base de données :** Table `user_streaks`
- **Logs :** Vérifier `loggingService` pour erreurs liées aux séquences

---

**Construit avec 💜 pour les utilisateurs Zodia**
*Faire du guidage cosmique quotidien une habitude, une séquence à la fois.*
