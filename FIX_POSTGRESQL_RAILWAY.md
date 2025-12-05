# Fix PostgreSQL Error - Railway Deployment

## Error
```
ERROR:  functions in index predicate must be marked IMMUTABLE
```

## Problem
The migration `009_create_retroactive_predictions.sql` has indexes using volatile functions (`CURRENT_DATE`, `NOW()`).

## Lines with errors:
- Line 119: `WHERE predicted_for_date = CURRENT_DATE - INTERVAL '1 day'`
- Line 160: `EXTRACT(DAYS FROM NOW() - p.predicted_for_date)`

## Solution
Remove the problematic indexes and replace with simpler ones.

## SQL Fix Script
Run this in Railway PostgreSQL console:

```sql
-- Drop the problematic indexes
DROP INDEX IF EXISTS idx_predictions_yesterday;

-- Create a simpler index without the WHERE clause
CREATE INDEX IF NOT EXISTS idx_predictions_user_date
  ON predictions(user_id, predicted_for_date DESC);

-- The view is fine, just the index needs fixing
```

## Alternative: Update the migration file
Edit `migrations/009_create_retroactive_predictions.sql`:

Remove lines 116-119 (the idx_predictions_yesterday index) and replace with:
```sql
-- Simple index for date queries
CREATE INDEX IF NOT EXISTS idx_predictions_user_date
  ON predictions(user_id, predicted_for_date DESC);
```