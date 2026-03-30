-- ============================================================
-- Migration 020 — Audit log (DORA/NIS2 compliance baseline)
-- ============================================================
-- Creates an immutable audit_log table with:
--   • RLS: GP-only SELECT, authenticated INSERT, no UPDATE/DELETE
--   • log_audit() helper for client-side RPC calls (login/logout)
--   • AFTER triggers on tasks + threads for automatic row-level logging
--
-- Trigger functions are SECURITY DEFINER so they run as the function
-- owner (postgres) and bypass RLS — audit inserts are always committed
-- regardless of the calling user's permissions.
-- auth.uid() still returns the API caller's UUID because PostgREST
-- sets request.jwt.claims as a GUC, which persists across security
-- context changes within the same transaction.
-- ============================================================

BEGIN;

-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action        text NOT NULL,       -- 'create' | 'update' | 'delete' | 'login' | 'logout'
  resource_type text NOT NULL,       -- 'task' | 'thread' | 'category' | 'company' | 'profile' | 'session'
  resource_id   text,                -- PK of the affected row (cast to text for generality)
  metadata      jsonb DEFAULT '{}',  -- changed fields, old/new values, etc.
  ip_address    text,
  created_at    timestamptz DEFAULT now() NOT NULL
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS audit_log_user_created
  ON audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_resource
  ON audit_log (resource_type, resource_id);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- GPs can read all audit log entries
CREATE POLICY "audit_log_select"
  ON audit_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'gp'
    )
  );

-- Any authenticated user can insert (client-side login/logout events via RPC)
CREATE POLICY "audit_log_insert"
  ON audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- Dev-bypass: anon can also insert (matches the pattern from migration 013)
CREATE POLICY "audit_log_anon_select"
  ON audit_log FOR SELECT TO anon
  USING (true);

CREATE POLICY "audit_log_anon_insert"
  ON audit_log FOR INSERT TO anon
  WITH CHECK (true);

-- No UPDATE or DELETE policies → audit_log rows are immutable

-- ── 4. log_audit() — client-callable RPC ─────────────────────────────────────
-- SECURITY DEFINER: runs as postgres, bypasses RLS, always succeeds.
-- auth.uid() is still the caller's UUID (set by PostgREST via JWT GUC).

CREATE OR REPLACE FUNCTION log_audit(
  p_action        text,
  p_resource_type text,
  p_resource_id   text  DEFAULT NULL,
  p_metadata      jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip text;
BEGIN
  -- Extract client IP from PostgREST request headers (best-effort)
  BEGIN
    v_ip := nullif(trim(
              split_part(
                coalesce(
                  current_setting('request.headers', true)::json->>'x-forwarded-for',
                  current_setting('request.headers', true)::json->>'x-real-ip'
                ),
                ',', 1
              )
            ), '');
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata, ip_address)
  VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, p_metadata, v_ip);
END;
$$;

-- ── 5. Shared IP-extraction helper (used by both trigger functions) ───────────

CREATE OR REPLACE FUNCTION _audit_get_ip()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN nullif(trim(
    split_part(
      coalesce(
        current_setting('request.headers', true)::json->>'x-forwarded-for',
        current_setting('request.headers', true)::json->>'x-real-ip'
      ),
      ',', 1
    )
  ), '');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- ── 6. Trigger function: tasks ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_audit_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip      text;
  v_changed jsonb := '{}';
BEGIN
  v_ip := _audit_get_ip();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata, ip_address)
    VALUES (
      auth.uid(),
      'create',
      'task',
      NEW.id::text,
      jsonb_build_object(
        'title',       NEW.title,
        'status',      NEW.status,
        'priority',    NEW.priority,
        'assignee_id', NEW.assignee_id,
        'thread_id',   NEW.thread_id,
        'company_id',  NEW.company_id
      ),
      v_ip
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Only capture columns that actually changed (notes/description omitted for privacy)
    IF OLD.title        IS DISTINCT FROM NEW.title        THEN
      v_changed := v_changed || jsonb_build_object('title',
        jsonb_build_object('from', OLD.title, 'to', NEW.title));
    END IF;
    IF OLD.status       IS DISTINCT FROM NEW.status       THEN
      v_changed := v_changed || jsonb_build_object('status',
        jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    IF OLD.priority     IS DISTINCT FROM NEW.priority     THEN
      v_changed := v_changed || jsonb_build_object('priority',
        jsonb_build_object('from', OLD.priority, 'to', NEW.priority));
    END IF;
    IF OLD.assignee_id  IS DISTINCT FROM NEW.assignee_id  THEN
      v_changed := v_changed || jsonb_build_object('assignee_id',
        jsonb_build_object('from', OLD.assignee_id, 'to', NEW.assignee_id));
    END IF;
    IF OLD.due_date     IS DISTINCT FROM NEW.due_date     THEN
      v_changed := v_changed || jsonb_build_object('due_date',
        jsonb_build_object('from', OLD.due_date, 'to', NEW.due_date));
    END IF;
    IF OLD.category_id  IS DISTINCT FROM NEW.category_id  THEN
      v_changed := v_changed || jsonb_build_object('category_id',
        jsonb_build_object('from', OLD.category_id, 'to', NEW.category_id));
    END IF;
    IF OLD.company_id   IS DISTINCT FROM NEW.company_id   THEN
      v_changed := v_changed || jsonb_build_object('company_id',
        jsonb_build_object('from', OLD.company_id, 'to', NEW.company_id));
    END IF;
    IF OLD.thread_id    IS DISTINCT FROM NEW.thread_id    THEN
      v_changed := v_changed || jsonb_build_object('thread_id',
        jsonb_build_object('from', OLD.thread_id, 'to', NEW.thread_id));
    END IF;
    IF OLD.visibility   IS DISTINCT FROM NEW.visibility   THEN
      v_changed := v_changed || jsonb_build_object('visibility',
        jsonb_build_object('from', OLD.visibility, 'to', NEW.visibility));
    END IF;
    -- Notes and description: log that they changed, not the content
    IF OLD.notes        IS DISTINCT FROM NEW.notes        THEN
      v_changed := v_changed || jsonb_build_object('notes_changed', true);
    END IF;
    IF OLD.description  IS DISTINCT FROM NEW.description  THEN
      v_changed := v_changed || jsonb_build_object('description_changed', true);
    END IF;

    -- Skip if nothing meaningful changed (e.g. only updated_at touched)
    IF v_changed <> '{}' THEN
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata, ip_address)
      VALUES (
        auth.uid(),
        'update',
        'task',
        NEW.id::text,
        v_changed || jsonb_build_object('title', NEW.title),
        v_ip
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata, ip_address)
    VALUES (
      auth.uid(),
      'delete',
      'task',
      OLD.id::text,
      jsonb_build_object(
        'title',     OLD.title,
        'thread_id', OLD.thread_id,
        'status',    OLD.status
      ),
      v_ip
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── 7. Trigger function: threads ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_audit_threads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip      text;
  v_changed jsonb := '{}';
BEGIN
  v_ip := _audit_get_ip();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata, ip_address)
    VALUES (
      auth.uid(),
      'create',
      'thread',
      NEW.id::text,
      jsonb_build_object('name', NEW.name, 'status', NEW.status),
      v_ip
    );

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.name        IS DISTINCT FROM NEW.name        THEN
      v_changed := v_changed || jsonb_build_object('name',
        jsonb_build_object('from', OLD.name, 'to', NEW.name));
    END IF;
    IF OLD.status      IS DISTINCT FROM NEW.status      THEN
      v_changed := v_changed || jsonb_build_object('status',
        jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    IF OLD.company_id  IS DISTINCT FROM NEW.company_id  THEN
      v_changed := v_changed || jsonb_build_object('company_id',
        jsonb_build_object('from', OLD.company_id, 'to', NEW.company_id));
    END IF;
    IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
      v_changed := v_changed || jsonb_build_object('assignee_id',
        jsonb_build_object('from', OLD.assignee_id, 'to', NEW.assignee_id));
    END IF;
    IF OLD.due_date    IS DISTINCT FROM NEW.due_date    THEN
      v_changed := v_changed || jsonb_build_object('due_date',
        jsonb_build_object('from', OLD.due_date, 'to', NEW.due_date));
    END IF;
    IF OLD.description IS DISTINCT FROM NEW.description THEN
      v_changed := v_changed || jsonb_build_object('description_changed', true);
    END IF;

    IF v_changed <> '{}' THEN
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata, ip_address)
      VALUES (
        auth.uid(),
        'update',
        'thread',
        NEW.id::text,
        v_changed || jsonb_build_object('name', NEW.name),
        v_ip
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata, ip_address)
    VALUES (
      auth.uid(),
      'delete',
      'thread',
      OLD.id::text,
      jsonb_build_object('name', OLD.name, 'status', OLD.status),
      v_ip
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── 8. Attach triggers ────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS audit_tasks ON tasks;
CREATE TRIGGER audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION trg_audit_tasks();

DROP TRIGGER IF EXISTS audit_threads ON threads;
CREATE TRIGGER audit_threads
  AFTER INSERT OR UPDATE OR DELETE ON threads
  FOR EACH ROW EXECUTE FUNCTION trg_audit_threads();

-- ── 9. Grant EXECUTE on public functions ──────────────────────────────────────
-- log_audit is called by the client via supabase.rpc(); both authenticated
-- and anon roles need EXECUTE (anon covers the dev-bypass mode).

GRANT EXECUTE ON FUNCTION log_audit(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit(text, text, text, jsonb) TO anon;

COMMIT;
