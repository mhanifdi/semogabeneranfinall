-- ============================================================================
-- VERTIKAL SMA JAWARA 28 — PRODUCTION POSTGRESQL SCHEMA
-- Migration: 001_initial_postgresql_schema.sql
-- Target RDBMS: PostgreSQL 15+
-- ============================================================================

BEGIN;

-- Migration History Tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    checksum VARCHAR(128) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3.1 TABEL AUTENTIKASI, PENGGUNA, DAN HAK AKSES (RBAC)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(160) UNIQUE,
    password_hash TEXT NOT NULL,
    password_algo VARCHAR(32) NOT NULL DEFAULT 'scrypt',
    full_name VARCHAR(160) NOT NULL,
    account_status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE'
        CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED')),
    failed_login_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE
        CHECK (code IN ('SISWA', 'GURU_WALAS', 'GURU_WALI', 'TIM_7_KAIH', 'SUPER_ADMIN')),
    name VARCHAR(120) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(64) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(64) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id VARCHAR(64) NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    scope_type VARCHAR(32) NOT NULL DEFAULT 'GLOBAL'
        CHECK (scope_type IN ('SELF', 'CLASS', 'ROMBEL', 'COHORT', 'SCHOOL', 'GLOBAL')),
    scope_id VARCHAR(64),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, role_id, scope_type, scope_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    active_role VARCHAR(64) NOT NULL,
    ip_address VARCHAR(64),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(160),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    requested_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3.2 TABEL PROFIL DAN STRUKTUR AKADEMIK
-- ============================================================================

CREATE TABLE IF NOT EXISTS academic_years (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(32) NOT NULL UNIQUE, -- e.g. '2026/2027'
    semester VARCHAR(16) NOT NULL DEFAULT 'GANJIL'
        CHECK (semester IN ('GANJIL', 'GENAP')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS cohorts (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE, -- e.g. 'Angkatan 2026'
    entry_year INTEGER NOT NULL CHECK (entry_year BETWEEN 2000 AND 2100),
    grade_level VARCHAR(16) NOT NULL CHECK (grade_level IN ('X', 'XI', 'XII', 'ALUMNI')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teachers (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    nip VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    gender VARCHAR(8) CHECK (gender IN ('L', 'P')),
    phone VARCHAR(32),
    role_title VARCHAR(120) NOT NULL,
    assignment_type VARCHAR(32) NOT NULL DEFAULT 'WALAS'
        CHECK (assignment_type IN ('WALAS', 'GURU_WALI', 'BOTH', 'TIM_7_KAIH', 'ADMIN')),
    class_name VARCHAR(64),
    rombel_name VARCHAR(64),
    avatar_url TEXT,
    account_status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE'
        CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE, -- e.g. 'XI-MIPA-1'
    grade_level VARCHAR(16) NOT NULL CHECK (grade_level IN ('X', 'XI', 'XII')),
    cohort_id VARCHAR(64) REFERENCES cohorts(id) ON DELETE SET NULL,
    academic_year_id VARCHAR(64) REFERENCES academic_years(id) ON DELETE RESTRICT,
    walas_teacher_id VARCHAR(64) REFERENCES teachers(id) ON DELETE SET NULL,
    walas_name VARCHAR(160),
    capacity INTEGER NOT NULL DEFAULT 36 CHECK (capacity > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rombels (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE, -- e.g. 'Rombel Sains & Riset A'
    description TEXT,
    academic_year_id VARCHAR(64) REFERENCES academic_years(id) ON DELETE RESTRICT,
    wali_teacher_id VARCHAR(64) REFERENCES teachers(id) ON DELETE SET NULL,
    wali_name VARCHAR(160),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    nisn VARCHAR(32) NOT NULL UNIQUE,
    nis VARCHAR(32) UNIQUE,
    name VARCHAR(160) NOT NULL,
    gender VARCHAR(8) NOT NULL DEFAULT 'L' CHECK (gender IN ('L', 'P')),
    religion VARCHAR(32) NOT NULL DEFAULT 'Islam'
        CHECK (religion IN ('Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu')),
    cohort_id VARCHAR(64) REFERENCES cohorts(id) ON DELETE SET NULL,
    class_id VARCHAR(64) REFERENCES classes(id) ON DELETE SET NULL,
    class_name VARCHAR(64) NOT NULL,
    rombel_id VARCHAR(64) REFERENCES rombels(id) ON DELETE SET NULL,
    rombel_name VARCHAR(64),
    xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    poin_hebat INTEGER NOT NULL DEFAULT 0 CHECK (poin_hebat >= 0),
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
    best_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
    predicate VARCHAR(64) NOT NULL DEFAULT 'Perlu Pembinaan',
    walas_notes TEXT,
    walas_recommendation TEXT,
    avatar_url TEXT,
    account_status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE'
        CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'GRADUATED', 'MUTATED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_class_memberships (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id VARCHAR(64) NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    class_name VARCHAR(64) NOT NULL,
    academic_year_id VARCHAR(64) NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    move_reason TEXT,
    changed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_rombel_memberships (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    rombel_id VARCHAR(64) NOT NULL REFERENCES rombels(id) ON DELETE RESTRICT,
    rombel_name VARCHAR(64) NOT NULL,
    academic_year_id VARCHAR(64) NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    move_reason TEXT,
    changed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teacher_assignments (
    id VARCHAR(64) PRIMARY KEY,
    teacher_id VARCHAR(64) NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    academic_year_id VARCHAR(64) NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    assignment_role VARCHAR(32) NOT NULL
        CHECK (assignment_role IN ('GURU_WALAS', 'GURU_WALI', 'TIM_7_KAIH', 'SUPER_ADMIN')),
    class_id VARCHAR(64) REFERENCES classes(id) ON DELETE CASCADE,
    rombel_id VARCHAR(64) REFERENCES rombels(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3.3 TABEL 7 KEBIASAAN ANAK INDONESIA HEBAT DAN JURNAL HARIAN
-- ============================================================================

CREATE TABLE IF NOT EXISTS scoring_rule_versions (
    id VARCHAR(64) PRIMARY KEY,
    version_code VARCHAR(32) NOT NULL UNIQUE, -- e.g. '7KAIH-FINAL-2026.1'
    title VARCHAR(160) NOT NULL,
    rules_json JSONB NOT NULL,
    no_missed_penalty BOOLEAN NOT NULL DEFAULT TRUE,
    bonus_cap_score Numeric(5,2) NOT NULL DEFAULT 100.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS habit_definitions (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE
        CHECK (code IN ('bangun', 'ibadah', 'olahraga', 'makan', 'belajar', 'masyarakat', 'tidur')),
    order_no INTEGER NOT NULL UNIQUE CHECK (order_no BETWEEN 1 AND 7),
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    multi_session BOOLEAN NOT NULL DEFAULT FALSE,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 100.00 CHECK (max_score = 100.00),
    min_description_chars INTEGER NOT NULL DEFAULT 10,
    max_point_description_chars INTEGER NOT NULL DEFAULT 15,
    form_schema_json JSONB NOT NULL,
    scoring_version_id VARCHAR(64) REFERENCES scoring_rule_versions(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS habit_schedules (
    id VARCHAR(64) PRIMARY KEY,
    habit_code VARCHAR(32) NOT NULL REFERENCES habit_definitions(code) ON DELETE CASCADE,
    session_code VARCHAR(32) NOT NULL, -- e.g. 'subuh', 'zuhur', 'asar', 'magrib', 'isya', 'pagi', 'siang', 'malam', 'default'
    label VARCHAR(64) NOT NULL,
    window_start TIME NOT NULL,
    window_end TIME NOT NULL,
    is_flexible_until_midnight BOOLEAN NOT NULL DEFAULT TRUE,
    academic_year_id VARCHAR(64) REFERENCES academic_years(id) ON DELETE SET NULL,
    updated_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (habit_code, session_code)
);

CREATE TABLE IF NOT EXISTS journals (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    journal_date DATE NOT NULL,
    academic_year_id VARCHAR(64) REFERENCES academic_years(id) ON DELETE SET NULL,
    class_id_snapshot VARCHAR(64) REFERENCES classes(id) ON DELETE SET NULL,
    rombel_id_snapshot VARCHAR(64) REFERENCES rombels(id) ON DELETE SET NULL,
    completed_habits_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_habits_count BETWEEN 0 AND 7),
    in_progress_habits_count INTEGER NOT NULL DEFAULT 0 CHECK (in_progress_habits_count BETWEEN 0 AND 7),
    missed_habits_count INTEGER NOT NULL DEFAULT 0 CHECK (missed_habits_count BETWEEN 0 AND 7),
    daily_average_score NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (daily_average_score BETWEEN 0 AND 100),
    journal_status VARCHAR(32) NOT NULL DEFAULT 'BELUM_DIMULAI'
        CHECK (journal_status IN ('BELUM_DIMULAI', 'SEDANG_DIISI', 'SELESAI', 'BELUM_DIISI_TERLEWAT')),
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, journal_date)
);

CREATE TABLE IF NOT EXISTS habit_entries (
    id SERIAL PRIMARY KEY,
    entry_uuid VARCHAR(64) NOT NULL UNIQUE,
    journal_id VARCHAR(64) NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
    student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    habit_code VARCHAR(32) NOT NULL REFERENCES habit_definitions(code) ON DELETE RESTRICT,
    log_date DATE NOT NULL,
    sub_category VARCHAR(64) NOT NULL DEFAULT '',
    card_status VARCHAR(32) NOT NULL DEFAULT 'SELESAI'
        CHECK (card_status IN ('BELUM_DIMULAI', 'SEDANG_DIISI', 'SELESAI', 'BELUM_DIISI_TERLEWAT')),
    entry_mode VARCHAR(32) NOT NULL DEFAULT 'TEPAT_HARI'
        CHECK (entry_mode IN ('TEPAT_HARI', 'TEPAT_HARI_FLEKSIBEL', 'TEPAT_HARI_TIMESTAMP', 'FORMULIR_TERLEWAT')),
    base_score NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (base_score BETWEEN 0 AND 100),
    bonus_score NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (bonus_score >= 0),
    final_score NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (final_score BETWEEN 0 AND 100),
    overflow_bonus_points NUMERIC(6,2) NOT NULL DEFAULT 0.00 CHECK (overflow_bonus_points >= 0),
    is_locked BOOLEAN NOT NULL DEFAULT TRUE,
    is_counter_entry BOOLEAN NOT NULL DEFAULT FALSE,
    is_missed BOOLEAN NOT NULL DEFAULT FALSE,
    description_text TEXT,
    description_length INTEGER NOT NULL DEFAULT 0,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    scoring_version_id VARCHAR(64) REFERENCES scoring_rule_versions(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, log_date, habit_code, sub_category)
);

CREATE TABLE IF NOT EXISTS habit_sessions (
    id VARCHAR(64) PRIMARY KEY,
    habit_entry_id INTEGER NOT NULL REFERENCES habit_entries(id) ON DELETE CASCADE,
    student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    habit_code VARCHAR(32) NOT NULL REFERENCES habit_definitions(code) ON DELETE RESTRICT,
    session_code VARCHAR(64) NOT NULL, -- e.g. 'subuh', 'zuhur', 'asar', 'magrib', 'isya', 'pagi', 'siang', 'malam', 'halangan'
    session_status VARCHAR(32) NOT NULL DEFAULT 'SELESAI'
        CHECK (session_status IN ('BELUM_DIMULAI', 'SEDANG_DIISI', 'SELESAI', 'HALANGAN', 'PUASA')),
    execution_time VARCHAR(16), -- HH:mm
    raw_session_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    normalized_session_score NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (normalized_session_score BETWEEN 0 AND 100),
    session_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, log_date, habit_code, session_code)
);

CREATE TABLE IF NOT EXISTS habit_components (
    id VARCHAR(64) PRIMARY KEY,
    habit_entry_id INTEGER NOT NULL REFERENCES habit_entries(id) ON DELETE CASCADE,
    habit_session_id VARCHAR(64) REFERENCES habit_sessions(id) ON DELETE CASCADE,
    component_key VARCHAR(64) NOT NULL, -- e.g. 'waktu_bangun', 'kerapian_tempat_tidur', 'kebugaran', 'durasi_olahraga', 'karbohidrat', 'protein', 'sayur_buah', 'minum_air'
    component_label VARCHAR(120) NOT NULL,
    component_value TEXT,
    score_earned NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    max_possible_score NUMERIC(6,2) NOT NULL DEFAULT 100.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS habit_entry_revisions (
    id VARCHAR(64) PRIMARY KEY,
    habit_entry_id INTEGER NOT NULL REFERENCES habit_entries(id) ON DELETE CASCADE,
    revision_no INTEGER NOT NULL CHECK (revision_no >= 1),
    previous_base_score NUMERIC(5,2) NOT NULL,
    previous_bonus_score NUMERIC(5,2) NOT NULL,
    previous_final_score NUMERIC(5,2) NOT NULL,
    new_base_score NUMERIC(5,2) NOT NULL,
    new_bonus_score NUMERIC(5,2) NOT NULL,
    new_final_score NUMERIC(5,2) NOT NULL,
    previous_payload_json JSONB NOT NULL,
    new_payload_json JSONB NOT NULL,
    change_source VARCHAR(32) NOT NULL
        CHECK (change_source IN ('STUDENT_SUBMIT', 'EVENT_BONUS', 'ADMIN_CORRECTION', 'MIGRATION')),
    reason TEXT NOT NULL,
    changed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (habit_entry_id, revision_no)
);

-- ============================================================================
-- 3.4 TABEL POIN, STREAK, EVENT, DAN LEADERBOARD
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE, -- e.g. 'AKTIVITAS_SERU_HARIAN'
    name VARCHAR(160) NOT NULL,
    description TEXT,
    bonus_score_amount NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (bonus_score_amount >= 0),
    min_story_chars INTEGER NOT NULL DEFAULT 15,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_bonuses (
    id SERIAL PRIMARY KEY,
    bonus_uuid VARCHAR(64) NOT NULL UNIQUE,
    event_id VARCHAR(64) NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    habit_entry_id INTEGER REFERENCES habit_entries(id) ON DELETE SET NULL,
    log_date DATE NOT NULL,
    habit_code VARCHAR(32) NOT NULL REFERENCES habit_definitions(code) ON DELETE RESTRICT,
    story TEXT NOT NULL CHECK (char_length(story) >= 15),
    bonus_awarded NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (bonus_awarded >= 0),
    applied_to_habit_score NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (applied_to_habit_score >= 0),
    overflow_to_poin_hebat NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (overflow_to_poin_hebat >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, log_date)
);

CREATE TABLE IF NOT EXISTS point_transactions (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    point_bucket VARCHAR(32) NOT NULL
        CHECK (point_bucket IN ('XP', 'POIN_HEBAT', 'STREAK_BONUS')),
    source_type VARCHAR(48) NOT NULL
        CHECK (source_type IN ('HABIT_COMPLETION', 'EVENT_OVERFLOW', 'STREAK_MILESTONE', 'ADMIN_ADJUSTMENT', 'MIGRATION')),
    source_id VARCHAR(128) NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    description TEXT NOT NULL,
    created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, point_bucket, source_type, source_id)
);

CREATE TABLE IF NOT EXISTS streak_records (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
    longest_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
    total_complete_days INTEGER NOT NULL DEFAULT 0 CHECK (total_complete_days >= 0),
    total_active_days INTEGER NOT NULL DEFAULT 0 CHECK (total_active_days >= 0),
    last_completed_date DATE,
    last_evaluated_date DATE,
    streak_status VARCHAR(32) NOT NULL DEFAULT 'INACTIVE'
        CHECK (streak_status IN ('ACTIVE', 'AT_RISK', 'BROKEN', 'INACTIVE')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
    id VARCHAR(64) PRIMARY KEY,
    period_type VARCHAR(32) NOT NULL
        CHECK (period_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'SEMESTER', 'ALL_TIME')),
    period_key VARCHAR(32) NOT NULL, -- e.g. '2026-10', 'ALL_TIME'
    scope_type VARCHAR(32) NOT NULL
        CHECK (scope_type IN ('SCHOOL', 'CLASS', 'ROMBEL', 'COHORT')),
    scope_id VARCHAR(64) NOT NULL DEFAULT 'SCHOOL',
    student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    rank_position INTEGER NOT NULL CHECK (rank_position >= 1),
    average_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    total_xp INTEGER NOT NULL DEFAULT 0,
    poin_hebat INTEGER NOT NULL DEFAULT 0,
    streak_days INTEGER NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (period_type, period_key, scope_type, scope_id, student_id)
);

-- ============================================================================
-- 3.5 TABEL ADMINISTRASI, VALIDASI, KOREKSI, DAN AUDIT
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_validations (
    id SERIAL PRIMARY KEY,
    validation_uuid VARCHAR(64) NOT NULL UNIQUE,
    student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    verification_score INTEGER NOT NULL CHECK (verification_score BETWEEN 1 AND 10),
    verified_by_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    verified_by VARCHAR(160) NOT NULL,
    notes TEXT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS data_corrections (
    id SERIAL PRIMARY KEY,
    correction_uuid VARCHAR(64) NOT NULL UNIQUE,
    habit_entry_id INTEGER REFERENCES habit_entries(id) ON DELETE SET NULL,
    student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    habit_type VARCHAR(32) NOT NULL REFERENCES habit_definitions(code) ON DELETE RESTRICT,
    sub_category VARCHAR(64) NOT NULL DEFAULT '',
    old_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    new_score NUMERIC(5,2) NOT NULL CHECK (new_score BETWEEN 0 AND 100),
    old_payload TEXT,
    new_payload TEXT,
    reason TEXT NOT NULL CHECK (char_length(reason) >= 5),
    actor_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(160) NOT NULL,
    corrected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    actor_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    actor_username VARCHAR(64),
    actor_role VARCHAR(64),
    action VARCHAR(80) NOT NULL, -- e.g. 'AUTH_LOGIN', 'HABIT_SUBMIT', 'JOURNAL_CORRECTION', 'STUDENT_MOVE_GROUP'
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(128) NOT NULL,
    before_state_json JSONB,
    after_state_json JSONB,
    reason TEXT,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    value_type VARCHAR(24) NOT NULL DEFAULT 'STRING'
        CHECK (value_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON')),
    description TEXT,
    updated_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    subtitle TEXT,
    widget_type VARCHAR(48) NOT NULL
        CHECK (widget_type IN ('METRIC_CARD', 'CHART_TREND', 'ANNOUNCEMENT_BANNER', 'LEADERBOARD_TABLE', 'HABIT_DISTRIBUTION')),
    visible_public INTEGER NOT NULL DEFAULT 1 CHECK (visible_public IN (0, 1)),
    visible_student INTEGER NOT NULL DEFAULT 1 CHECK (visible_student IN (0, 1)),
    visible_teacher INTEGER NOT NULL DEFAULT 1 CHECK (visible_teacher IN (0, 1)),
    display_order INTEGER NOT NULL DEFAULT 1,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
