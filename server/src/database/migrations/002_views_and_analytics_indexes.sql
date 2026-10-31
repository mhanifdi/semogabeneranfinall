-- ============================================================================
-- VERTIKAL SMA JAWARA 28 — PRODUCTION INDEXES & ANALYTICAL VIEWS
-- Migration: 002_views_and_analytics_indexes.sql
-- Target RDBMS: PostgreSQL 15+
-- ============================================================================

BEGIN;

-- 1. Authentication & Session Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_scope ON user_roles(user_id, is_active, scope_type, scope_id);

-- 2. Academic & Membership Indexes (750+ Students Scale)
CREATE INDEX IF NOT EXISTS idx_students_class_status ON students(class_name, account_status);
CREATE INDEX IF NOT EXISTS idx_students_rombel_status ON students(rombel_name, account_status);
CREATE INDEX IF NOT EXISTS idx_students_cohort_status ON students(cohort_id, account_status);
CREATE INDEX IF NOT EXISTS idx_students_leaderboard ON students(account_status, xp DESC, poin_hebat DESC, streak DESC);
CREATE INDEX IF NOT EXISTS idx_scm_student_current ON student_class_memberships(student_id, is_current);
CREATE INDEX IF NOT EXISTS idx_srm_student_current ON student_rombel_memberships(student_id, is_current);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON teacher_assignments(teacher_id, is_active);

-- 3. Journals, Habit Entries, Sessions & Components Indexes
CREATE INDEX IF NOT EXISTS idx_journals_student_date ON journals(student_id, journal_date DESC);
CREATE INDEX IF NOT EXISTS idx_journals_date_status ON journals(journal_date, journal_status);
CREATE INDEX IF NOT EXISTS idx_habit_entries_student_date ON habit_entries(student_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_entries_date_habit ON habit_entries(log_date, habit_code);
CREATE INDEX IF NOT EXISTS idx_habit_entries_student_habit ON habit_entries(student_id, habit_code, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_entries_covering_habit_score ON habit_entries(habit_code, student_id, final_score);
CREATE INDEX IF NOT EXISTS idx_habit_entries_student_covering ON habit_entries(student_id, habit_code, final_score);
CREATE INDEX IF NOT EXISTS idx_habit_sessions_entry ON habit_sessions(habit_entry_id);
CREATE INDEX IF NOT EXISTS idx_habit_sessions_student_date ON habit_sessions(student_id, log_date, habit_code);
CREATE INDEX IF NOT EXISTS idx_habit_components_entry ON habit_components(habit_entry_id);

-- 4. Points, Events, Validations & Audit Indexes
CREATE INDEX IF NOT EXISTS idx_point_tx_student_date ON point_transactions(student_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_event_bonuses_student_date ON event_bonuses(student_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_admin_validations_student ON admin_validations(student_id, verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_corrections_student_date ON data_corrections(student_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id, created_at DESC);

-- 5. Analytical Views for Fast Reporting
CREATE OR REPLACE VIEW vw_student_habit_summary AS
SELECT
    s.id AS student_id,
    s.nisn,
    s.name AS student_name,
    s.class_name,
    s.rombel_name,
    he.habit_code,
    COUNT(he.id) AS entry_count,
    ROUND(AVG(he.final_score), 2) AS avg_final_score,
    MAX(he.log_date) AS last_log_date
FROM students s
LEFT JOIN habit_entries he ON he.student_id = s.id
WHERE s.account_status = 'ACTIVE'
GROUP BY s.id, s.nisn, s.name, s.class_name, s.rombel_name, he.habit_code;

CREATE OR REPLACE VIEW vw_class_participation_summary AS
SELECT
    c.id AS class_id,
    c.name AS class_name,
    c.walas_name,
    COUNT(DISTINCT s.id) AS total_students,
    COUNT(DISTINCT he.student_id) AS participating_students,
    COALESCE(ROUND(AVG(he.final_score), 2), 0) AS avg_habit_score
FROM classes c
LEFT JOIN students s ON s.class_name = c.name AND s.account_status = 'ACTIVE'
LEFT JOIN habit_entries he ON he.student_id = s.id
WHERE c.is_active = TRUE
GROUP BY c.id, c.name, c.walas_name;

COMMIT;
