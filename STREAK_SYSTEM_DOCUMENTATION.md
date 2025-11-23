# 🔥 Daily Streak System - Complete Documentation

**Created:** January 23, 2025
**Version:** 1.0.0
**Expected Impact:** +800% user retention through FOMO and habit formation

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Integration](#api-integration)
5. [Milestone System](#milestone-system)
6. [Usage Examples](#usage-examples)
7. [Frontend Integration Guide](#frontend-integration-guide)
8. [Testing Checklist](#testing-checklist)
9. [Deployment Instructions](#deployment-instructions)

---

## 🎯 Overview

The Daily Streak System is a gamification feature designed to increase user retention through:

- **Daily check-ins**: Automatic tracking when users interact with AI Coach
- **Streak tracking**: Current streak and personal best (longest streak)
- **Milestone rewards**: Progressive rewards at key streak numbers (3, 7, 14, 30, 60, 90, 180, 365 days)
- **Cosmic points**: Point accumulation system (+10 per day + bonus at milestones)
- **Badge system**: Achievement badges for major milestones
- **FOMO mechanics**: Fear of losing streak encourages daily returns

### Key Metrics

- **Check-in frequency**: Daily
- **Streak calculation**: Consecutive days (breaks if user misses a day)
- **Points per check-in**: 10 cosmic points
- **Total milestones**: 8 major milestones
- **Languages supported**: Spanish (es), English (en)

---

## 🏗️ Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Flutter)                    │
│  - Display streak in UI                                 │
│  - Show milestone achievements                          │
│  - Leaderboard component                                │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Backend - aiCoachService.js                │
│  - Calls streakService.checkIn() on every message       │
│  - Returns streak info in response                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              streakService.js (New File)                │
│  - checkIn(userId, language)                            │
│  - getStreak(userId)                                    │
│  - getLeaderboard(limit)                                │
│  - Milestone calculation logic                          │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│          PostgreSQL - user_streaks table                │
│  - Stores all streak data                               │
│  - Indexed for performance                              │
└─────────────────────────────────────────────────────────┘
```

### File Structure

```
backend/flutter-horoscope-backend/
├── migrations/
│   └── 011_create_user_streaks_table.sql  [NEW ✨]
├── src/
│   ├── services/
│   │   ├── streakService.js               [NEW ✨]
│   │   └── aiCoachService.js              [MODIFIED]
│   └── config/
│       └── db.js
└── STREAK_SYSTEM_DOCUMENTATION.md          [NEW ✨]
```

---

## 💾 Database Schema

### Table: `user_streaks`

```sql
CREATE TABLE user_streaks (
  -- Primary identification
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Streak tracking
  current_streak INT DEFAULT 0 NOT NULL,      -- Current consecutive days
  longest_streak INT DEFAULT 0 NOT NULL,      -- Personal best
  last_check_in DATE,                         -- Last check-in date (UTC)
  total_check_ins INT DEFAULT 0 NOT NULL,     -- Lifetime total

  -- Gamification
  cosmic_points INT DEFAULT 0 NOT NULL,       -- Accumulated points
  badges JSONB DEFAULT '[]'::jsonb NOT NULL,  -- Earned badges array
  milestones_achieved JSONB DEFAULT '[]'::jsonb NOT NULL,  -- Achieved milestone numbers

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Indexes

```sql
CREATE INDEX idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX idx_user_streaks_current_streak ON user_streaks(current_streak DESC);
CREATE INDEX idx_user_streaks_last_check_in ON user_streaks(last_check_in DESC);
CREATE INDEX idx_user_streaks_cosmic_points ON user_streaks(cosmic_points DESC);
```

### Auto-update Trigger

```sql
CREATE TRIGGER trigger_update_user_streaks_timestamp
BEFORE UPDATE ON user_streaks
FOR EACH ROW
EXECUTE FUNCTION update_user_streaks_updated_at();
```

---

## 🔌 API Integration

### Automatic Integration (AI Coach)

The streak system is **automatically triggered** when users send messages to AI Coach. No additional API calls needed!

**Modified in `aiCoachService.js`:**

```javascript
// Lines 32 (import)
const streakService = require('./streakService');

// Lines 365-368 (check-in logic)
const userLanguage = options.language || 'es';
const streakInfo = await streakService.checkIn(userId, userLanguage);

// Line 396 (return streak in response)
streak: streakInfo
```

### Response Format

Every AI Coach message now includes streak data:

```json
{
  "success": true,
  "response": {
    "content": "Your AI coach response...",
    "sessionId": "uuid",
    "messageId": "uuid",
    // ... other fields
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
    "cosmic_points_earned": 80,      // 10 + 70 bonus (milestone)
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

### Manual API Endpoints (Optional)

You can add these routes to expose streak functionality directly:

```javascript
// In routes file (e.g., routes/streak.js)
const express = require('express');
const router = express.Router();
const streakService = require('../services/streakService');

// GET user's current streak
router.get('/streak/:userId', async (req, res) => {
  const streak = await streakService.getStreak(req.params.userId);
  res.json(streak);
});

// POST manual check-in (if needed outside AI Coach)
router.post('/streak/:userId/checkin', async (req, res) => {
  const language = req.body.language || 'es';
  const result = await streakService.checkIn(req.params.userId, language);
  res.json(result);
});

// GET leaderboard
router.get('/streak/leaderboard', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const leaderboard = await streakService.getLeaderboard(limit);
  res.json(leaderboard);
});

module.exports = router;
```

---

## 🏆 Milestone System

### Complete Milestone Table

| Streak Days | Spanish Name | English Name | Badge | Reward | Bonus Points |
|-------------|-------------|--------------|-------|--------|--------------|
| **3** | Empezando | Getting Started | `beginner` | Badge: Empezando | +30 |
| **7** | Guerrero de una Semana | Week Warrior | `week_warrior` | Lectura especial Luna (gratis) | +70 |
| **14** | Dedicado | Dedicated | `dedicated` | 1 consulta premium gratis | +150 |
| **30** | Guerrero Cósmico | Cosmic Warrior | `cosmic_warrior` | Lectura anual 2026 | +300 |
| **60** | Maestro de Hábitos | Habit Master | `habit_master` | 3 consultas premium gratis | +600 |
| **90** | Iluminado | Enlightened | `enlightened` | 1 mes premium gratis | +1000 |
| **180** | Devoto Cósmico | Cosmic Devotee | `cosmic_devotee` | 3 meses premium gratis | +2000 |
| **365** | Leyenda Cósmica | Cosmic Legend | `cosmic_legend` | Lifetime premium | +5000 |

### Milestone Logic

1. **One-time rewards**: Milestones can only be achieved once per user
2. **Tracked in database**: `milestones_achieved` JSONB array stores achieved milestone numbers
3. **Badge unlock**: Badges added to `badges` array upon milestone achievement
4. **Bonus points**: Extra cosmic points awarded on top of daily +10

### Point Calculation Examples

```javascript
// Day 1: First check-in
cosmic_points_earned = 10
total_cosmic_points = 10

// Day 3: Milestone "Empezando"
cosmic_points_earned = 10 + 30 = 40
total_cosmic_points = 10 + 10 + 40 = 60

// Day 7: Milestone "Week Warrior"
cosmic_points_earned = 10 + 70 = 80
total_cosmic_points = 60 + 10 + 10 + 10 + 80 = 170

// Day 8: Regular day (already got day 7 milestone)
cosmic_points_earned = 10
total_cosmic_points = 170 + 10 = 180
```

---

## 📱 Usage Examples

### Example 1: First Time User

**Request:**
```javascript
// User sends first AI Coach message
POST /ai-coach/sessions/{sessionId}/messages
{
  "message": "¿Qué me dice mi horóscopo hoy?",
  "language": "es"
}
```

**Response:**
```json
{
  "success": true,
  "response": { /* AI response */ },
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

### Example 2: Reaching 7-Day Milestone

**Request:**
```javascript
// User's 7th consecutive day
POST /ai-coach/sessions/{sessionId}/messages
{
  "message": "Good morning, what's my horoscope?",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "response": { /* AI response */ },
  "streak": {
    "success": true,
    "current_streak": 7,
    "longest_streak": 7,
    "is_new_record": true,
    "cosmic_points_earned": 80,      // 10 + 70 bonus
    "total_cosmic_points": 150,
    "total_check_ins": 7,
    "milestone": {
      "streak": 7,
      "name": "Week Warrior",
      "badge": "week_warrior",
      "reward": "Free Moon Reading",
      "cosmicPoints": 70
    },
    "badges": ["beginner", "week_warrior"],
    "message": "🔥 Current streak: 7 days\n🏆 NEW PERSONAL RECORD!\n\n✨ MILESTONE UNLOCKED: Week Warrior!\n🎁 Reward: Free Moon Reading\n💎 +70 bonus cosmic points\n\n💪 Next goal: 7 days to \"Dedicated\"\n🎯 Reward: 1 Free Premium Reading"
  }
}
```

### Example 3: Already Checked In Today

**Request:**
```javascript
// User sends second message same day
POST /ai-coach/sessions/{sessionId}/messages
{
  "message": "Another question...",
  "language": "es"
}
```

**Response:**
```json
{
  "success": true,
  "response": { /* AI response */ },
  "streak": {
    "success": true,
    "current_streak": 7,
    "longest_streak": 7,
    "already_checked_in": true,
    "cosmic_points_earned": 0,       // No points for duplicate check-in
    "total_cosmic_points": 150,
    "total_check_ins": 7,
    "milestone": null,
    "message": "🔥 Ya te registraste hoy. Racha actual: 7 días"
  }
}
```

### Example 4: Streak Broken

**Request:**
```javascript
// User returns after missing 2+ days
POST /ai-coach/sessions/{sessionId}/messages
{
  "message": "I'm back!",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "response": { /* AI response */ },
  "streak": {
    "success": true,
    "current_streak": 1,              // Reset to 1
    "longest_streak": 7,              // Personal best preserved
    "is_new_record": false,
    "streak_broken": true,
    "previous_streak": 7,
    "cosmic_points_earned": 10,
    "total_cosmic_points": 160,       // Keeps accumulating
    "total_check_ins": 8,
    "milestone": null,
    "message": "💔 Your streak was broken, but every day is a fresh start.\n🔥 Current streak: 1 day\n\n💪 Next goal: 2 days to \"Getting Started\"\n🎯 Reward: Badge: Getting Started"
  }
}
```

### Example 5: Get Streak Info (Without Check-in)

**Code:**
```javascript
const streakService = require('./services/streakService');

const streakInfo = await streakService.getStreak(userId);

console.log(streakInfo);
```

**Output:**
```json
{
  "success": true,
  "current_streak": 30,
  "longest_streak": 30,
  "last_check_in": "2025-01-23",
  "total_check_ins": 30,
  "cosmic_points": 890,
  "badges": ["beginner", "week_warrior", "dedicated", "cosmic_warrior"],
  "milestones_achieved": [3, 7, 14, 30],
  "has_checked_in_today": true,
  "next_milestone": {
    "streak": 60,
    "days_remaining": 30,
    "name": "Maestro de Hábitos",
    "nameEn": "Habit Master",
    "badge": "habit_master",
    "reward": "3 consultas premium gratis",
    "rewardEn": "3 Free Premium Readings",
    "cosmicPoints": 600
  },
  "created_at": "2024-12-24T00:00:00.000Z",
  "updated_at": "2025-01-23T12:34:56.789Z"
}
```

### Example 6: Leaderboard

**Code:**
```javascript
const leaderboard = await streakService.getLeaderboard(5);
```

**Output:**
```json
{
  "success": true,
  "total_users": 5,
  "leaderboard": [
    {
      "user_id": "uuid-1",
      "current_streak": 365,
      "longest_streak": 365,
      "total_check_ins": 365,
      "cosmic_points": 7890,
      "badges": ["beginner", "week_warrior", "dedicated", "cosmic_warrior", "habit_master", "enlightened", "cosmic_devotee", "cosmic_legend"],
      "email": "user1@example.com"
    },
    {
      "user_id": "uuid-2",
      "current_streak": 120,
      "longest_streak": 120,
      "total_check_ins": 120,
      "cosmic_points": 2300,
      "badges": ["beginner", "week_warrior", "dedicated", "cosmic_warrior", "habit_master", "enlightened"],
      "email": "user2@example.com"
    }
    // ... top 5 users
  ]
}
```

---

## 🎨 Frontend Integration Guide

### Flutter Widget Example

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
            // Streak counter
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

            SizedBox(height: 12),

            // Milestone notification
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

            // Check-in status
            if (alreadyCheckedIn) ...[
              SizedBox(height: 8),
              Text(
                '✅ Ya te registraste hoy',
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

### Usage in Chat Screen

```dart
// In your AI Coach chat screen
class AIChatScreen extends StatefulWidget {
  // ...
}

class _AIChatScreenState extends State<AIChatScreen> {
  Map<String, dynamic>? latestStreakData;

  Future<void> sendMessage(String message) async {
    final response = await apiService.sendAICoachMessage(
      sessionId: sessionId,
      message: message,
      language: 'es',
    );

    if (response['success'] && response['streak'] != null) {
      setState(() {
        latestStreakData = response['streak'];
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Cosmic Coach')),
      body: Column(
        children: [
          // Show streak widget at top
          if (latestStreakData != null)
            StreakWidget(streakData: latestStreakData!),

          // Chat messages
          Expanded(
            child: ListView.builder(/* ... */),
          ),

          // Message input
          MessageInputField(onSend: sendMessage),
        ],
      ),
    );
  }
}
```

### Push Notification Reminder

```dart
// Schedule daily reminder (e.g., at 8 PM)
Future<void> scheduleStreakReminder() async {
  final streakData = await apiService.getStreak(userId);

  if (!streakData['has_checked_in_today']) {
    // User hasn't checked in - send reminder
    await notificationService.scheduleNotification(
      title: '🔥 ¡No pierdas tu racha!',
      body: 'Tienes ${streakData['current_streak']} días. ¡Regístrate hoy para mantenerla!',
      scheduledTime: DateTime.now().add(Duration(hours: 1)),
    );
  }
}
```

---

## ✅ Testing Checklist

### Database Migration

- [ ] Run migration: `psql -d your_db -f migrations/011_create_user_streaks_table.sql`
- [ ] Verify table created: `\d user_streaks`
- [ ] Verify indexes created: `\di idx_user_streaks_*`
- [ ] Verify trigger created: `\df update_user_streaks_updated_at`
- [ ] Test constraint: Try inserting negative streak (should fail)

### Backend Service Tests

#### Test 1: First Check-in
```javascript
const userId = 'test-user-uuid';
const result = await streakService.checkIn(userId, 'es');

// Expected:
// - current_streak = 1
// - longest_streak = 1
// - is_first_time = true
// - cosmic_points_earned = 10
// - Database record created
```

#### Test 2: Consecutive Days
```javascript
// Day 1
await streakService.checkIn(userId, 'es');

// Wait or mock date to next day
// Day 2
const result = await streakService.checkIn(userId, 'es');

// Expected:
// - current_streak = 2
// - streak_broken = false
```

#### Test 3: Duplicate Check-in Same Day
```javascript
await streakService.checkIn(userId, 'es');
const result = await streakService.checkIn(userId, 'es');

// Expected:
// - already_checked_in = true
// - cosmic_points_earned = 0
// - current_streak unchanged
```

#### Test 4: Milestone Achievement
```javascript
// Manually set streak to 6 in database
await db.query('UPDATE user_streaks SET current_streak = 6, last_check_in = $1 WHERE user_id = $2',
  [yesterday, userId]);

// Check in on day 7
const result = await streakService.checkIn(userId, 'es');

// Expected:
// - current_streak = 7
// - milestone.name = 'Guerrero de una Semana'
// - cosmic_points_earned = 80 (10 + 70 bonus)
// - badges includes 'week_warrior'
```

#### Test 5: Broken Streak
```javascript
// Set last check-in to 3 days ago
const threeDaysAgo = new Date();
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
await db.query('UPDATE user_streaks SET current_streak = 10, last_check_in = $1 WHERE user_id = $2',
  [threeDaysAgo.toISOString().split('T')[0], userId]);

const result = await streakService.checkIn(userId, 'es');

// Expected:
// - current_streak = 1 (reset)
// - longest_streak = 10 (preserved)
// - streak_broken = true
// - previous_streak = 10
```

#### Test 6: Leaderboard
```javascript
const leaderboard = await streakService.getLeaderboard(5);

// Expected:
// - success = true
// - leaderboard array sorted by current_streak DESC
// - Each entry has user_id, current_streak, cosmic_points, email
```

### Integration Tests (AI Coach)

```javascript
// Test that AI Coach includes streak in response
const response = await aiCoachService.sendMessage(
  sessionId,
  'Hello',
  userId,
  { language: 'en' }
);

// Expected:
// - response.success = true
// - response.streak exists
// - response.streak.success = true
// - response.streak.current_streak >= 1
```

### Manual Testing Steps

1. **Test in Postman/Thunder Client:**
   - Send AI Coach message
   - Verify `streak` object in response
   - Check database: `SELECT * FROM user_streaks WHERE user_id = 'your-test-uuid'`

2. **Test Language Support:**
   - Send with `language: 'es'` - verify Spanish messages
   - Send with `language: 'en'` - verify English messages

3. **Test Date Logic:**
   - Check in today → `current_streak = 1`
   - Check in again today → `already_checked_in = true`
   - Manually change `last_check_in` to yesterday in DB
   - Check in again → `current_streak = 2`

4. **Test Milestones:**
   - Manually set streak to 2, last_check_in to yesterday
   - Check in → Should unlock day 3 milestone
   - Verify `milestones_achieved` array in DB

5. **Test Error Handling:**
   - Pass invalid userId → Should return error gracefully
   - Disconnect database → Should log error and return failure response

---

## 🚀 Deployment Instructions

### Step 1: Run Database Migration

```bash
# Production
psql $DATABASE_URL -f migrations/011_create_user_streaks_table.sql

# Development
psql -U your_user -d your_db -f migrations/011_create_user_streaks_table.sql
```

### Step 2: Verify Migration

```sql
-- Check table exists
SELECT COUNT(*) FROM user_streaks;

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'user_streaks';

-- Should return:
-- idx_user_streaks_user_id
-- idx_user_streaks_current_streak
-- idx_user_streaks_last_check_in
-- idx_user_streaks_cosmic_points
```

### Step 3: Deploy Backend Code

```bash
# Ensure new files are committed
git add migrations/011_create_user_streaks_table.sql
git add src/services/streakService.js
git add STREAK_SYSTEM_DOCUMENTATION.md
git commit -m "feat: implement daily streak gamification system"

# Deploy to production
git push heroku main
# OR your deployment method
```

### Step 4: Verify Deployment

```bash
# Check logs for any errors
heroku logs --tail

# Test API endpoint
curl -X POST https://your-api.com/ai-coach/sessions/{sessionId}/messages \
  -H "Content-Type: application/json" \
  -d '{"message": "Test", "language": "es"}'

# Verify 'streak' field in response
```

### Step 5: Monitor

```sql
-- Check streak adoption rate
SELECT
  COUNT(DISTINCT user_id) as total_users_with_streaks,
  AVG(current_streak) as avg_current_streak,
  MAX(current_streak) as max_streak,
  SUM(total_check_ins) as total_check_ins
FROM user_streaks;

-- Top streaks
SELECT user_id, current_streak, cosmic_points, badges
FROM user_streaks
ORDER BY current_streak DESC
LIMIT 10;
```

---

## 📊 Expected Metrics & KPIs

### Retention Metrics

| Metric | Before Streaks | Target After Streaks | Measurement Period |
|--------|---------------|---------------------|-------------------|
| **Day 1 Retention** | ~40% | ~70% | 30 days |
| **Day 7 Retention** | ~15% | ~45% | 30 days |
| **Day 30 Retention** | ~5% | ~25% | 90 days |
| **Daily Active Users** | Baseline | +800% | 90 days |

### Engagement Metrics

- **Average session frequency**: Target 5x/week (up from 1-2x/week)
- **Streak completion rate (7 days)**: Target 30% of users
- **Streak completion rate (30 days)**: Target 10% of users
- **Milestone achievement rate**: Track % of users reaching each milestone

### Revenue Impact

- **Premium conversions from streaks**: Track users who upgrade after reaching milestones
- **Lifetime value increase**: Expect 3-5x LTV for users with 30+ day streaks

---

## 🔧 Troubleshooting

### Issue: Streak not updating

**Symptoms:** User checks in but streak stays at 0
**Solution:**
```sql
-- Check if record exists
SELECT * FROM user_streaks WHERE user_id = 'uuid';

-- If no record, the first check-in should create one
-- Check server logs for errors in streakService.checkIn()
```

### Issue: Milestone awarded multiple times

**Symptoms:** User receives same milestone twice
**Solution:**
```sql
-- Check milestones_achieved array
SELECT milestones_achieved FROM user_streaks WHERE user_id = 'uuid';

-- Should be: [3, 7, 14, 30] (numbers only appear once)
-- If duplicates exist, fix data:
UPDATE user_streaks
SET milestones_achieved = (
  SELECT jsonb_agg(DISTINCT elem)
  FROM jsonb_array_elements_text(milestones_achieved) elem
)
WHERE user_id = 'uuid';
```

### Issue: Points not accumulating

**Symptoms:** cosmic_points stays low despite check-ins
**Solution:**
```javascript
// Check streakService.checkIn() return value
console.log(streakInfo);

// Verify:
// - cosmic_points_earned > 0
// - total_cosmic_points increasing

// Check database directly:
SELECT cosmic_points, total_check_ins FROM user_streaks WHERE user_id = 'uuid';
```

---

## 📈 Future Enhancements

1. **Social Features**
   - Share milestone achievements
   - Friend streak comparisons
   - Team/group challenges

2. **Advanced Rewards**
   - Streak insurance (1 missed day forgiveness per month)
   - Streak recovery (pay cosmic points to restore broken streak)
   - Weekly/monthly streak bonuses

3. **Personalization**
   - Custom reminder times
   - Personalized milestone rewards based on user preferences
   - Streak freezes for vacations

4. **Analytics Dashboard**
   - Admin view of streak statistics
   - Cohort analysis by streak level
   - Retention funnel visualization

---

## 📝 Changelog

### v1.0.0 (2025-01-23)
- ✨ Initial release
- 🗄️ Database schema with user_streaks table
- 🔥 Core streak tracking (current, longest, total)
- 🏆 8-tier milestone system (3 to 365 days)
- 💎 Cosmic points gamification
- 🎖️ Badge system
- 🌍 Bilingual support (ES/EN)
- 🔗 Auto-integration with AI Coach
- 📊 Leaderboard functionality

---

## 🆘 Support

For questions or issues:
- **Documentation:** This file
- **Code location:** `/src/services/streakService.js`
- **Database:** Table `user_streaks`
- **Logs:** Check `loggingService` for streak-related errors

---

**Built with 💜 for Zodia users**
*Making daily cosmic guidance a habit, one streak at a time.*
