-- =========================================
-- COMPLETE POSTGRESQL INDEX FIX
-- =========================================
-- Ejecutar este script en Railway PostgreSQL Console
-- para crear todos los índices correctamente
-- Fecha: 2025-12-04
-- =========================================

-- =========================================
-- 1. DROP EXISTING INCORRECT INDEXES
-- =========================================

-- Drop indexes from 005_create_goal_planner_tables.sql
DROP INDEX IF EXISTS idx_goals_user_id;
DROP INDEX IF EXISTS idx_goals_status;
DROP INDEX IF EXISTS idx_goals_focus_area;
DROP INDEX IF EXISTS idx_goals_created_at;
DROP INDEX IF EXISTS idx_micro_habits_goal_id;
DROP INDEX IF EXISTS idx_milestones_goal_id;
DROP INDEX IF EXISTS idx_milestones_completed;
DROP INDEX IF EXISTS idx_obstacles_goal_id;
DROP INDEX IF EXISTS idx_checkins_goal_id;
DROP INDEX IF EXISTS idx_checkins_created_at;

-- Drop indexes from 012_create_revenue_optimization_tables.sql
DROP INDEX IF EXISTS idx_user_analytics_user_id;
DROP INDEX IF EXISTS idx_user_analytics_created_at;
DROP INDEX IF EXISTS idx_feature_usage_user_id;
DROP INDEX IF EXISTS idx_feature_usage_created_at;
DROP INDEX IF EXISTS idx_subscriptions_user_id;
DROP INDEX IF EXISTS idx_subscriptions_status;
DROP INDEX IF EXISTS idx_subscriptions_created_at;
DROP INDEX IF EXISTS idx_user_events_user_id;
DROP INDEX IF EXISTS idx_user_events_type;
DROP INDEX IF EXISTS idx_user_events_created_at;
DROP INDEX IF EXISTS idx_checkout_sessions_user_id;
DROP INDEX IF EXISTS idx_checkout_sessions_status;
DROP INDEX IF EXISTS idx_offers_sent_user_id;
DROP INDEX IF EXISTS idx_offers_sent_type;
DROP INDEX IF EXISTS idx_support_tickets_user_id;
DROP INDEX IF EXISTS idx_support_tickets_status;
DROP INDEX IF EXISTS idx_payment_attempts_user_id;
DROP INDEX IF EXISTS idx_payment_attempts_status;
DROP INDEX IF EXISTS idx_churn_interventions_user_id;
DROP INDEX IF EXISTS idx_churn_interventions_type;
DROP INDEX IF EXISTS idx_ltv_strategies_user_id;
DROP INDEX IF EXISTS idx_ltv_strategies_type;
DROP INDEX IF EXISTS idx_pricing_experiments_tier;
DROP INDEX IF EXISTS idx_pricing_experiments_status;
DROP INDEX IF EXISTS idx_experiment_assignments_user_id;
DROP INDEX IF EXISTS idx_experiment_assignments_experiment;
DROP INDEX IF EXISTS idx_notifications_sent_user_id;
DROP INDEX IF EXISTS idx_support_alerts_user_id;
DROP INDEX IF EXISTS idx_support_alerts_type;
DROP INDEX IF EXISTS idx_support_alerts_resolved;
DROP INDEX IF EXISTS idx_revenue_metrics_date;

-- Drop other potential indexes
DROP INDEX IF EXISTS idx_users_country;
DROP INDEX IF EXISTS idx_users_subscription_tier;
DROP INDEX IF EXISTS idx_users_last_active;

-- =========================================
-- 2. CREATE ALL INDEXES CORRECTLY
-- =========================================

-- =========================================
-- Indexes from 005_create_goal_planner_tables.sql
-- =========================================

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_focus_area ON goals(focus_area);
CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at);
CREATE INDEX IF NOT EXISTS idx_micro_habits_goal_id ON goal_micro_habits(goal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_goal_id ON goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_completed ON goal_milestones(is_completed);
CREATE INDEX IF NOT EXISTS idx_obstacles_goal_id ON goal_obstacles(goal_id);
CREATE INDEX IF NOT EXISTS idx_checkins_goal_id ON goal_checkins(goal_id);
CREATE INDEX IF NOT EXISTS idx_checkins_created_at ON goal_checkins(created_at);

-- =========================================
-- Indexes from 012_create_revenue_optimization_tables.sql
-- =========================================

-- user_analytics indexes
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON user_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_created_at ON user_analytics(created_at);

-- feature_usage indexes
CREATE INDEX IF NOT EXISTS idx_feature_usage_user_id ON feature_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_created_at ON feature_usage(created_at);

-- subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at);

-- user_events indexes
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON user_events(created_at);

-- checkout_sessions indexes
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_user_id ON checkout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON checkout_sessions(status);

-- offers_sent indexes
CREATE INDEX IF NOT EXISTS idx_offers_sent_user_id ON offers_sent(user_id);
CREATE INDEX IF NOT EXISTS idx_offers_sent_type ON offers_sent(offer_type);

-- support_tickets indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- payment_attempts indexes
CREATE INDEX IF NOT EXISTS idx_payment_attempts_user_id ON payment_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);

-- churn_interventions indexes
CREATE INDEX IF NOT EXISTS idx_churn_interventions_user_id ON churn_interventions(user_id);
CREATE INDEX IF NOT EXISTS idx_churn_interventions_type ON churn_interventions(intervention_type);

-- ltv_strategies indexes
CREATE INDEX IF NOT EXISTS idx_ltv_strategies_user_id ON ltv_strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_ltv_strategies_type ON ltv_strategies(strategy_type);

-- pricing_experiments indexes
CREATE INDEX IF NOT EXISTS idx_pricing_experiments_tier ON pricing_experiments(tier);
CREATE INDEX IF NOT EXISTS idx_pricing_experiments_status ON pricing_experiments(status);

-- experiment_assignments indexes
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_user_id ON experiment_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_experiment ON experiment_assignments(experiment_id);

-- notifications_sent indexes
CREATE INDEX IF NOT EXISTS idx_notifications_sent_user_id ON notifications_sent(user_id);

-- support_alerts indexes
CREATE INDEX IF NOT EXISTS idx_support_alerts_user_id ON support_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_support_alerts_type ON support_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_support_alerts_resolved ON support_alerts(resolved);

-- revenue_metrics indexes
CREATE INDEX IF NOT EXISTS idx_revenue_metrics_date ON revenue_metrics(date);

-- users table indexes
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);

-- =========================================
-- 3. VERIFY ALL INDEXES WERE CREATED
-- =========================================

DO $$
BEGIN
  RAISE NOTICE '✅ All indexes created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Verifying indexes...';
END $$;

-- Show all indexes for verification
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM
    pg_indexes
WHERE
    schemaname = 'public'
    AND (
        tablename IN (
            'goals', 'goal_micro_habits', 'goal_milestones', 'goal_obstacles', 'goal_checkins',
            'user_analytics', 'feature_usage', 'subscriptions', 'user_events', 'checkout_sessions',
            'offers_sent', 'support_tickets', 'payment_attempts', 'churn_interventions',
            'ltv_strategies', 'pricing_experiments', 'experiment_assignments',
            'notifications_sent', 'support_alerts', 'revenue_metrics', 'users'
        )
    )
ORDER BY
    tablename, indexname;

-- Count indexes per table
SELECT
    tablename,
    COUNT(*) as index_count
FROM
    pg_indexes
WHERE
    schemaname = 'public'
    AND tablename IN (
        'goals', 'goal_micro_habits', 'goal_milestones', 'goal_obstacles', 'goal_checkins',
        'user_analytics', 'feature_usage', 'subscriptions', 'user_events', 'checkout_sessions',
        'offers_sent', 'support_tickets', 'payment_attempts', 'churn_interventions',
        'ltv_strategies', 'pricing_experiments', 'experiment_assignments',
        'notifications_sent', 'support_alerts', 'revenue_metrics', 'users'
    )
GROUP BY
    tablename
ORDER BY
    tablename;

-- =========================================
-- 4. SUCCESS MESSAGE
-- =========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ COMPLETE! All PostgreSQL indexes have been fixed.';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Fixed tables:';
  RAISE NOTICE '   - goals (4 indexes)';
  RAISE NOTICE '   - goal_micro_habits (1 index)';
  RAISE NOTICE '   - goal_milestones (2 indexes)';
  RAISE NOTICE '   - goal_obstacles (1 index)';
  RAISE NOTICE '   - goal_checkins (2 indexes)';
  RAISE NOTICE '   - user_analytics (2 indexes)';
  RAISE NOTICE '   - feature_usage (2 indexes)';
  RAISE NOTICE '   - subscriptions (3 indexes)';
  RAISE NOTICE '   - user_events (3 indexes)';
  RAISE NOTICE '   - checkout_sessions (2 indexes)';
  RAISE NOTICE '   - offers_sent (2 indexes)';
  RAISE NOTICE '   - support_tickets (2 indexes)';
  RAISE NOTICE '   - payment_attempts (2 indexes)';
  RAISE NOTICE '   - churn_interventions (2 indexes)';
  RAISE NOTICE '   - ltv_strategies (2 indexes)';
  RAISE NOTICE '   - pricing_experiments (2 indexes)';
  RAISE NOTICE '   - experiment_assignments (2 indexes)';
  RAISE NOTICE '   - notifications_sent (1 index)';
  RAISE NOTICE '   - support_alerts (3 indexes)';
  RAISE NOTICE '   - revenue_metrics (1 index)';
  RAISE NOTICE '   - users (3 indexes)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Total: ~48 indexes created/verified';
END $$;
