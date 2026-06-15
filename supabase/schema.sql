-- ============================================================
-- Terminal Workdesk App — Database Schema
-- Jalankan di Supabase SQL Editor (semua sekaligus)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('super_admin', 'spv_manager', 'leader_divisi', 'staff', 'head_director');
CREATE TYPE project_status AS ENUM ('Draft', 'Waiting Approval', 'Not Started', 'In Progress', 'Need Review', 'Revision', 'Completed', 'On Hold', 'Cancelled');
CREATE TYPE task_status AS ENUM ('To Do', 'In Progress', 'Need Review', 'Revision', 'Completed', 'On Hold', 'Cancelled');
CREATE TYPE priority_level AS ENUM ('Low', 'Medium', 'High', 'Urgent');
CREATE TYPE approval_request_status AS ENUM ('Pending', 'Approved', 'Rejected', 'Revision');
CREATE TYPE approval_type AS ENUM ('project', 'budget', 'asset', 'kpi');
CREATE TYPE approver_role AS ENUM ('spv', 'manager', 'director');
CREATE TYPE approval_action AS ENUM ('pending', 'approve', 'reject', 'revision');
CREATE TYPE kpi_status AS ENUM ('Draft', 'Reviewed', 'Final');
CREATE TYPE event_type AS ENUM ('Meeting', 'Shooting', 'Visit', 'Deadline', 'Other');
CREATE TYPE point_source AS ENUM ('task', 'project', 'kpi', 'kudos', 'bonus', 'manual');
CREATE TYPE asset_status AS ENUM ('Draft', 'Need Review', 'Approved', 'Rejected', 'Archived');
CREATE TYPE budget_payment_status AS ENUM ('Draft', 'Waiting Approval', 'Approved', 'Used', 'Partially Paid', 'Paid', 'Rejected');
CREATE TYPE notification_type AS ENUM ('task_assigned', 'deadline', 'overdue', 'approval_request', 'approval_result', 'mention', 'kpi_reminder', 'asset_new', 'project_done', 'revision_requested', 'budget_exceeded', 'event_assigned', 'gamification');

-- ============================================================
-- TABLE: divisions
-- ============================================================
CREATE TABLE divisions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_divisions_deleted ON divisions(deleted_at);

-- ============================================================
-- TABLE: users (extends auth.users)
-- ============================================================
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  avatar_url  TEXT,
  role        user_role NOT NULL DEFAULT 'staff',
  division_id UUID REFERENCES divisions(id),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_users_role       ON users(role);
CREATE INDEX idx_users_division   ON users(division_id);
CREATE INDEX idx_users_deleted    ON users(deleted_at);

-- ============================================================
-- TABLE: projects
-- ============================================================
CREATE TABLE projects (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_code         TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  division_id          UUID NOT NULL REFERENCES divisions(id),
  project_type         TEXT NOT NULL DEFAULT 'General',
  pic_id               UUID NOT NULL REFERENCES users(id),
  objective            TEXT NOT NULL,
  deliverables         TEXT NOT NULL,
  start_date           DATE NOT NULL,
  deadline             DATE NOT NULL,
  status               project_status NOT NULL DEFAULT 'Draft',
  priority             priority_level NOT NULL DEFAULT 'Medium',
  progress             INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  budget_planned       BIGINT,
  budget_approved      BIGINT,
  budget_actual        BIGINT NOT NULL DEFAULT 0,
  approval_status      approval_request_status,
  current_approval_step INTEGER,
  attachment_url       TEXT,
  notes                TEXT,
  is_overdue           BOOLEAN NOT NULL DEFAULT FALSE,
  created_by           UUID NOT NULL REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);
CREATE INDEX idx_projects_division  ON projects(division_id);
CREATE INDEX idx_projects_status    ON projects(status);
CREATE INDEX idx_projects_deadline  ON projects(deadline);
CREATE INDEX idx_projects_overdue   ON projects(is_overdue);
CREATE INDEX idx_projects_deleted   ON projects(deleted_at);
CREATE INDEX idx_projects_pic       ON projects(pic_id);

-- Auto-generate project code
CREATE OR REPLACE FUNCTION generate_project_code()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  seq_num INT;
BEGIN
  -- Get abbreviation from division or use GEN
  prefix := 'PRJ';
  seq_num := (SELECT COUNT(*) + 1 FROM projects WHERE deleted_at IS NULL);
  NEW.project_code := prefix || '-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_code
  BEFORE INSERT ON projects
  FOR EACH ROW
  WHEN (NEW.project_code IS NULL OR NEW.project_code = '')
  EXECUTE FUNCTION generate_project_code();

-- ============================================================
-- TABLE: project_members
-- ============================================================
CREATE TABLE project_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user    ON project_members(user_id);

-- ============================================================
-- TABLE: tasks
-- ============================================================
CREATE TABLE tasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  division_id       UUID NOT NULL REFERENCES divisions(id),
  created_by        UUID NOT NULL REFERENCES users(id),
  due_date          TIMESTAMPTZ NOT NULL,
  priority          priority_level NOT NULL DEFAULT 'Medium',
  status            task_status NOT NULL DEFAULT 'To Do',
  description       TEXT,
  checklist         JSONB,
  attachment_url    TEXT,
  output_url        TEXT,
  review_result     TEXT,
  recurring_rule    TEXT,
  reminder_at       TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  is_overdue        BOOLEAN NOT NULL DEFAULT FALSE,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_tasks_project   ON tasks(project_id);
CREATE INDEX idx_tasks_division  ON tasks(division_id);
CREATE INDEX idx_tasks_status    ON tasks(status);
CREATE INDEX idx_tasks_due_date  ON tasks(due_date);
CREATE INDEX idx_tasks_overdue   ON tasks(is_overdue);
CREATE INDEX idx_tasks_deleted   ON tasks(deleted_at);

-- ============================================================
-- TABLE: task_assignees
-- ============================================================
CREATE TABLE task_assignees (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);
CREATE INDEX idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);

-- ============================================================
-- TABLE: kpi_templates
-- ============================================================
CREATE TABLE kpi_templates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role         user_role NOT NULL,
  division_id  UUID REFERENCES divisions(id),
  kpi_name     TEXT NOT NULL,
  weight       NUMERIC(5,2) NOT NULL DEFAULT 10,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

-- ============================================================
-- TABLE: kpi_items (monthly, per user)
-- ============================================================
CREATE TABLE kpi_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id),
  period_month     SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year      SMALLINT NOT NULL,
  kpi_name         TEXT NOT NULL,
  weight           NUMERIC(5,2) NOT NULL,
  target           NUMERIC(12,2),
  realization      NUMERIC(12,2),
  max_score        NUMERIC(5,2) NOT NULL,
  auto_score       NUMERIC(5,2),
  final_score      NUMERIC(5,2),
  evaluation_note  TEXT,
  improvement_plan TEXT,
  status           kpi_status NOT NULL DEFAULT 'Draft',
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);
CREATE INDEX idx_kpi_items_user   ON kpi_items(user_id);
CREATE INDEX idx_kpi_items_period ON kpi_items(period_year, period_month);
CREATE INDEX idx_kpi_items_deleted ON kpi_items(deleted_at);

-- ============================================================
-- TABLE: calendar_events
-- ============================================================
CREATE TABLE calendar_events (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title              TEXT NOT NULL,
  event_type         event_type NOT NULL DEFAULT 'Other',
  division_id        UUID REFERENCES divisions(id),
  related_project_id UUID REFERENCES projects(id),
  start_at           TIMESTAMPTZ NOT NULL,
  end_at             TIMESTAMPTZ NOT NULL,
  all_day            BOOLEAN NOT NULL DEFAULT FALSE,
  location           TEXT,
  link               TEXT,
  reminder_rule      TEXT,
  created_by         UUID NOT NULL REFERENCES users(id),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);
CREATE INDEX idx_calendar_events_start    ON calendar_events(start_at);
CREATE INDEX idx_calendar_events_division ON calendar_events(division_id);
CREATE INDEX idx_calendar_events_deleted  ON calendar_events(deleted_at);

-- ============================================================
-- TABLE: event_participants
-- ============================================================
CREATE TABLE event_participants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id      UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  role_in_event TEXT,
  notified_at   TIMESTAMPTZ,
  UNIQUE(event_id, user_id)
);
CREATE INDEX idx_event_participants_event ON event_participants(event_id);
CREATE INDEX idx_event_participants_user  ON event_participants(user_id);

-- ============================================================
-- TABLE: approval_requests
-- ============================================================
CREATE TABLE approval_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                approval_type NOT NULL DEFAULT 'project',
  related_entity_type TEXT NOT NULL,
  related_entity_id   UUID NOT NULL,
  requested_by        UUID NOT NULL REFERENCES users(id),
  current_step        SMALLINT NOT NULL DEFAULT 1,
  status              approval_request_status NOT NULL DEFAULT 'Pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_approval_requests_entity  ON approval_requests(related_entity_id);
CREATE INDEX idx_approval_requests_status  ON approval_requests(status);
CREATE INDEX idx_approval_requests_by      ON approval_requests(requested_by);

-- ============================================================
-- TABLE: approval_steps
-- ============================================================
CREATE TABLE approval_steps (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step_order          SMALLINT NOT NULL,
  approver_role       approver_role NOT NULL,
  approver_user_id    UUID REFERENCES users(id),
  action              approval_action NOT NULL DEFAULT 'pending',
  note                TEXT,
  acted_at            TIMESTAMPTZ
);
CREATE INDEX idx_approval_steps_request ON approval_steps(approval_request_id);

-- ============================================================
-- TABLE: assets
-- ============================================================
CREATE TABLE assets (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name               TEXT NOT NULL,
  category           TEXT NOT NULL,
  division_id        UUID NOT NULL REFERENCES divisions(id),
  drive_link         TEXT NOT NULL,
  version            TEXT,
  status             asset_status NOT NULL DEFAULT 'Draft',
  uploaded_by        UUID NOT NULL REFERENCES users(id),
  related_project_id UUID REFERENCES projects(id),
  description        TEXT,
  tags               TEXT[],
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);
CREATE INDEX idx_assets_division ON assets(division_id);
CREATE INDEX idx_assets_status   ON assets(status);
CREATE INDEX idx_assets_deleted  ON assets(deleted_at);

-- ============================================================
-- TABLE: budgets
-- ============================================================
CREATE TABLE budgets (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,
  planned        BIGINT NOT NULL DEFAULT 0,
  approved       BIGINT,
  actual         BIGINT NOT NULL DEFAULT 0,
  vendor         TEXT,
  invoice_link   TEXT,
  reimburse_link TEXT,
  payment_status budget_payment_status NOT NULL DEFAULT 'Draft',
  notes          TEXT,
  created_by     UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX idx_budgets_project ON budgets(project_id);
CREATE INDEX idx_budgets_deleted ON budgets(deleted_at);

-- ============================================================
-- TABLE: project_comments
-- ============================================================
CREATE TABLE project_comments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id),
  content        TEXT NOT NULL,
  attachment_url TEXT,
  is_edited      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX idx_project_comments_project ON project_comments(project_id);
CREATE INDEX idx_project_comments_deleted ON project_comments(deleted_at);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE notifications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id),
  title               TEXT NOT NULL,
  message             TEXT NOT NULL,
  type                notification_type NOT NULL,
  related_entity_type TEXT,
  related_entity_id   UUID,
  is_read             BOOLEAN NOT NULL DEFAULT FALSE,
  send_email          BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user    ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- ============================================================
-- TABLE: points_ledger (append-only)
-- ============================================================
CREATE TABLE points_ledger (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id),
  division_id  UUID REFERENCES divisions(id),
  source_type  point_source NOT NULL,
  source_id    UUID,
  points       INTEGER NOT NULL,
  period_month SMALLINT NOT NULL,
  period_year  SMALLINT NOT NULL,
  awarded_by   UUID REFERENCES users(id),
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_points_ledger_user   ON points_ledger(user_id);
CREATE INDEX idx_points_ledger_period ON points_ledger(period_year, period_month);

-- ============================================================
-- TABLE: gamification_rules
-- ============================================================
CREATE TABLE gamification_rules (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_key  TEXT NOT NULL UNIQUE,
  points     INTEGER NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: badges & user_badges
-- ============================================================
CREATE TABLE badges (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  description  TEXT,
  icon         TEXT,
  criteria_key TEXT
);

CREATE TABLE user_badges (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id),
  badge_id   UUID NOT NULL REFERENCES badges(id),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period     TEXT,
  UNIQUE(user_id, badge_id)
);

-- ============================================================
-- TABLE: monthly_rewards
-- ============================================================
CREATE TABLE monthly_rewards (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_month     SMALLINT NOT NULL,
  period_year      SMALLINT NOT NULL,
  rank             SMALLINT NOT NULL DEFAULT 1,
  reward_name      TEXT NOT NULL,
  reward_image_link TEXT,
  winner_user_id   UUID REFERENCES users(id),
  notes            TEXT,
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(period_month, period_year, rank)
);

-- ============================================================
-- TABLE: activity_logs
-- ============================================================
CREATE TABLE activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_id);
CREATE INDEX idx_activity_logs_user   ON activity_logs(user_id);

-- ============================================================
-- TRIGGER: auto updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'divisions','users','projects','tasks','kpi_templates','kpi_items',
    'calendar_events','approval_requests','assets','budgets',
    'project_comments','monthly_rewards'
  ]
  LOOP
    EXECUTE FORMAT(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ============================================================
-- TRIGGER: auto-create user profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'staff')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_steps    ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger     ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_rewards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs     ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: is admin or manager
CREATE OR REPLACE FUNCTION is_admin_or_manager()
RETURNS BOOLEAN AS $$
  SELECT auth_user_role() IN ('super_admin', 'spv_manager');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- USERS ----
CREATE POLICY "users: all authenticated can read active users"
  ON users FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND is_active = TRUE);

CREATE POLICY "users: can update own profile"
  ON users FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users: admin can do everything"
  ON users FOR ALL TO authenticated
  USING (is_admin_or_manager());

-- ---- DIVISIONS ----
CREATE POLICY "divisions: all can read"
  ON divisions FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "divisions: admin can manage"
  ON divisions FOR ALL TO authenticated
  USING (auth_user_role() = 'super_admin');

-- ---- PROJECTS ----
CREATE POLICY "projects: all authenticated can read non-deleted"
  ON projects FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "projects: admin/spv full access"
  ON projects FOR ALL TO authenticated
  USING (is_admin_or_manager());

CREATE POLICY "projects: leader can manage own division"
  ON projects FOR ALL TO authenticated
  USING (
    auth_user_role() = 'leader_divisi'
    AND division_id = (SELECT division_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "projects: staff can update assigned projects"
  ON projects FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE pic_id = auth.uid()
    )
  );

-- ---- TASKS ----
CREATE POLICY "tasks: all can read non-deleted"
  ON tasks FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "tasks: admin/spv full access"
  ON tasks FOR ALL TO authenticated
  USING (is_admin_or_manager());

CREATE POLICY "tasks: leader can manage own division"
  ON tasks FOR ALL TO authenticated
  USING (
    auth_user_role() = 'leader_divisi'
    AND division_id = (SELECT division_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "tasks: staff can update assigned tasks"
  ON tasks FOR UPDATE TO authenticated
  USING (
    id IN (SELECT task_id FROM task_assignees WHERE user_id = auth.uid())
  );

-- ---- KPI ITEMS — strict RLS ----
CREATE POLICY "kpi_items: staff see only own"
  ON kpi_items FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      user_id = auth.uid()
      OR is_admin_or_manager()
      OR (
        auth_user_role() = 'leader_divisi'
        AND user_id IN (
          SELECT u.id FROM users u
          WHERE u.division_id = (SELECT division_id FROM users WHERE id = auth.uid())
        )
      )
      OR auth_user_role() = 'head_director'
    )
  );

CREATE POLICY "kpi_items: admin/spv full write"
  ON kpi_items FOR ALL TO authenticated
  USING (is_admin_or_manager());

-- ---- NOTIFICATIONS — user sees only own ----
CREATE POLICY "notifications: own only"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications: update own"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications: system can insert"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- ---- POINTS LEDGER ----
CREATE POLICY "points_ledger: all can read"
  ON points_ledger FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "points_ledger: admin can insert"
  ON points_ledger FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_manager());

-- ---- GENERAL PERMISSIVE POLICIES (read-all for most tables) ----
CREATE POLICY "read all: project_members"     ON project_members     FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read all: task_assignees"      ON task_assignees      FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read all: kpi_templates"       ON kpi_templates       FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "read all: calendar_events"     ON calendar_events     FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "read all: event_participants"  ON event_participants  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read all: approval_requests"   ON approval_requests   FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read all: approval_steps"      ON approval_steps      FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read all: assets"              ON assets              FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "read all: budgets"             ON budgets             FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "read all: project_comments"   ON project_comments    FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "read all: gamification_rules" ON gamification_rules  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read all: badges"             ON badges              FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read all: user_badges"        ON user_badges         FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read all: monthly_rewards"    ON monthly_rewards     FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read all: activity_logs"      ON activity_logs       FOR SELECT TO authenticated USING (TRUE);

-- Write policies for non-admin roles
CREATE POLICY "write: admin manage all tables"
  ON project_members FOR ALL TO authenticated USING (is_admin_or_manager());
CREATE POLICY "write: task_assignees admin"
  ON task_assignees FOR ALL TO authenticated USING (is_admin_or_manager());
CREATE POLICY "write: calendar_events admin"
  ON calendar_events FOR ALL TO authenticated USING (is_admin_or_manager());
CREATE POLICY "write: event_participants admin"
  ON event_participants FOR ALL TO authenticated USING (is_admin_or_manager());
CREATE POLICY "write: approval_requests all"
  ON approval_requests FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "write: approval_requests update admin"
  ON approval_requests FOR UPDATE TO authenticated USING (is_admin_or_manager() OR auth_user_role() IN ('leader_divisi', 'head_director'));
CREATE POLICY "write: approval_steps all"
  ON approval_steps FOR ALL TO authenticated USING (TRUE);
CREATE POLICY "write: assets all auth"
  ON assets FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "write: assets update owner"
  ON assets FOR UPDATE TO authenticated USING (uploaded_by = auth.uid() OR is_admin_or_manager());
CREATE POLICY "write: budgets admin"
  ON budgets FOR ALL TO authenticated USING (is_admin_or_manager());
CREATE POLICY "write: project_comments insert"
  ON project_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "write: project_comments update own"
  ON project_comments FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "write: monthly_rewards admin"
  ON monthly_rewards FOR ALL TO authenticated USING (auth_user_role() = 'super_admin');
CREATE POLICY "write: gamification_rules admin"
  ON gamification_rules FOR ALL TO authenticated USING (auth_user_role() = 'super_admin');
CREATE POLICY "write: task_assignees insert"
  ON task_assignees FOR INSERT TO authenticated WITH CHECK (is_admin_or_manager() OR auth_user_role() = 'leader_divisi');
CREATE POLICY "write: project_members insert"
  ON project_members FOR INSERT TO authenticated WITH CHECK (is_admin_or_manager() OR auth_user_role() = 'leader_divisi');
CREATE POLICY "write: calendar_events insert"
  ON calendar_events FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "write: event_participants insert"
  ON event_participants FOR INSERT TO authenticated WITH CHECK (TRUE);

-- ============================================================
-- SEED DATA — Gamification Rules
-- ============================================================
INSERT INTO gamification_rules (event_key, points) VALUES
  ('task_completed_on_time',    10),
  ('task_completed_late',        3),
  ('task_overdue',              -5),
  ('project_completed_pic',     30),
  ('project_completed_member',  15),
  ('kpi_final_90_percent',      25),
  ('no_major_revision',          5),
  ('on_time_streak_5x',         15),
  ('kudos_from_leader',          5);

-- ============================================================
-- SEED DATA — Divisions
-- ============================================================
INSERT INTO divisions (id, name, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Branding',            'Tim Branding & Visual Identity'),
  ('22222222-2222-2222-2222-222222222222', 'Creative Marketing',  'Tim Creative & Content Marketing'),
  ('33333333-3333-3333-3333-333333333333', 'Retail',              'Tim Retail & Dealer Support');

-- ============================================================
-- SEED DATA — Badges
-- ============================================================
INSERT INTO badges (name, description, criteria_key) VALUES
  ('On-Time Streak',      'Selesaikan 5 task berturut-turut tepat waktu', 'on_time_streak_5x'),
  ('Top Contributor',     'Peringkat #1 di leaderboard bulan ini',         'top_monthly'),
  ('Zero Overdue',        'Tidak ada task overdue dalam satu bulan',        'zero_overdue'),
  ('Campaign Hero',       'Selesaikan project campaign besar',              'campaign_hero'),
  ('Quality Champion',    'Tidak ada major revision dalam 3 project',       'quality_champion');
