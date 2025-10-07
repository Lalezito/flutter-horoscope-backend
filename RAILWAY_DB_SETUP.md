# 🗄️ RAILWAY DATABASE SETUP - FCM Tokens Table

**Purpose**: Create `fcm_tokens` table for push notifications
**Date**: October 7, 2025
**Estimated Time**: 5 minutes

---

## 📋 Instructions

### Step 1: Access Railway Database (2 min)

1. Go to https://railway.app
2. Select project: **zodiac-backend-api-production**
3. Click on **PostgreSQL** service
4. Click on **Data** tab (or **Query** tab if available)

---

### Step 2: Execute SQL Script (2 min)

**Option A: Copy-Paste SQL**

Copy the entire content from `migrations/create_fcm_tokens_table.sql` and paste it into the Railway query editor, then click "Run" or "Execute".

**Option B: Manual Commands**

If you prefer to run commands one by one:

```sql
-- 1. Create table
CREATE TABLE fcm_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  fcm_token TEXT NOT NULL,
  device_type VARCHAR(50) DEFAULT 'unknown',
  device_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create indices
CREATE INDEX idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX idx_fcm_tokens_fcm_token ON fcm_tokens(fcm_token);
CREATE INDEX idx_fcm_tokens_created_at ON fcm_tokens(created_at);

-- 3. Create trigger function
CREATE OR REPLACE FUNCTION update_fcm_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Create trigger
CREATE TRIGGER trigger_update_fcm_tokens_updated_at
  BEFORE UPDATE ON fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_fcm_tokens_updated_at();
```

---

### Step 3: Verify Table Created (1 min)

Run this query to verify:

```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'fcm_tokens'
ORDER BY ordinal_position;
```

**Expected Output**:

```
column_name | data_type         | is_nullable | column_default
------------+-------------------+-------------+-------------------------
id          | integer           | NO          | nextval('fcm_tokens_id_seq'::regclass)
user_id     | character varying | YES         | NULL
fcm_token   | text              | NO          | NULL
device_type | character varying | YES         | 'unknown'::character varying
device_id   | character varying | NO          | NULL
created_at  | timestamp         | YES         | CURRENT_TIMESTAMP
updated_at  | timestamp         | YES         | CURRENT_TIMESTAMP
```

---

## ✅ Testing

### Test 1: Insert Sample Token

```sql
INSERT INTO fcm_tokens (user_id, fcm_token, device_type, device_id)
VALUES ('test_user', 'test_token_123', 'iOS', 'test_device_001');
```

**Expected**: No errors

---

### Test 2: Verify Insert

```sql
SELECT * FROM fcm_tokens WHERE device_id = 'test_device_001';
```

**Expected**: 1 row with your test data

---

### Test 3: Test Trigger (updated_at auto-update)

```sql
-- Wait 2 seconds
SELECT pg_sleep(2);

-- Update token
UPDATE fcm_tokens
SET fcm_token = 'updated_token_456'
WHERE device_id = 'test_device_001';

-- Verify updated_at changed
SELECT
  device_id,
  created_at,
  updated_at,
  (updated_at > created_at) AS trigger_working
FROM fcm_tokens
WHERE device_id = 'test_device_001';
```

**Expected**: `trigger_working = true`

---

### Test 4: Cleanup Test Data

```sql
DELETE FROM fcm_tokens WHERE device_id = 'test_device_001';
```

---

## 🧪 Test from Backend API

Once table is created, test the endpoint:

```bash
curl -X POST https://zodiac-backend-api-production-8ded.up.railway.app/api/notifications/register-token \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "api_test_user",
    "fcm_token": "eLHPxHEY2UMSv6P0a_xl_api_test",
    "device_type": "iOS",
    "device_id": "api_test_device_123"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "FCM token registered successfully"
}
```

**Verify in DB**:
```sql
SELECT * FROM fcm_tokens WHERE device_id = 'api_test_device_123';
```

**Cleanup**:
```sql
DELETE FROM fcm_tokens WHERE device_id = 'api_test_device_123';
```

---

## 🚨 Troubleshooting

### Error: "relation fcm_tokens already exists"

**Solution**:
```sql
DROP TABLE fcm_tokens CASCADE;
-- Then run CREATE TABLE again
```

---

### Error: "function update_fcm_tokens_updated_at already exists"

**Solution**:
```sql
DROP FUNCTION IF EXISTS update_fcm_tokens_updated_at() CASCADE;
-- Then run CREATE FUNCTION again
```

---

### Error: Backend still returns 500

**Possible causes**:
1. Table not created in correct database
2. Backend doesn't have DB credentials
3. Column names don't match

**Verification**:
```sql
-- Check if table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'fcm_tokens';

-- Should return: fcm_tokens
```

---

## ✅ Success Criteria

- [ ] Table `fcm_tokens` created without errors
- [ ] 7 columns present (id, user_id, fcm_token, device_type, device_id, created_at, updated_at)
- [ ] 3 indices created (user_id, fcm_token, created_at)
- [ ] Trigger `trigger_update_fcm_tokens_updated_at` working
- [ ] Test insert successful
- [ ] Test update successful (trigger fires)
- [ ] API endpoint returns 200 (not 500)
- [ ] Test data cleaned up

---

**Created**: October 7, 2025
**For**: Railway PostgreSQL Database
**Project**: zodiac-backend-api-production
