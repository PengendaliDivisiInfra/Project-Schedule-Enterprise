-- ============================================================================
-- WAVE A (MIGRATION 02): IMMUTABLE AUDIT TRAIL (INSERT ONLY)
-- Merekam user_id, actor_role, ip_address, user_agent, old_data, new_data
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  user_id UUID,
  actor_role TEXT,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tambahkan kolom baru secara idempoten jika tabel audit_logs sudah ada sebelumnya
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_role TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS record_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS old_data JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_data JSONB;

CREATE INDEX IF NOT EXISTS idx_audit_logs_project_created ON public.audit_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_action ON public.audit_logs(table_name, action);

-- 1. Kunci Hak Akses Tabel: INSERT & SELECT ONLY (Tolak UPDATE, DELETE, TRUNCATE)
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM anon, authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

-- 2. Trigger Keras di Level Database agar Baris Log Tidak Pernah Bisa Diubah/Dihapus
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_AUDIT_LOG: Tabel audit_logs bersifat INSERT ONLY dan tidak dapat diubah atau dihapus.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- 3. Kebijakan RLS pada audit_logs (Baca khusus Owner/Super Admin/Auditor/Finance Manager/PM proyek)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wave_a_audit_select ON public.audit_logs;
CREATE POLICY wave_a_audit_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_corporate_admin()
    OR public.get_my_global_role() IN ('auditor', 'finance manager', 'finance_manager')
    OR (project_id IS NOT NULL AND public.is_project_approver(project_id))
  );

DROP POLICY IF EXISTS wave_a_audit_insert ON public.audit_logs;
CREATE POLICY wave_a_audit_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 4. Fungsi Trigger Otomatis untuk Tabel Keuangan & Tata Kelola Kritis
CREATE OR REPLACE FUNCTION public.fn_log_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_record_id TEXT;
  v_role TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_project_id := NULLIF(to_jsonb(OLD)->>'project_id', '')::UUID;
    v_record_id := to_jsonb(OLD)->>'id';
  ELSE
    v_project_id := NULLIF(to_jsonb(NEW)->>'project_id', '')::UUID;
    v_record_id := to_jsonb(NEW)->>'id';
  END IF;

  SELECT COALESCE(NULLIF(global_role, ''), NULLIF(role, ''), 'User')
  INTO v_role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  INSERT INTO public.audit_logs (
    project_id,
    user_id,
    actor_role,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    v_project_id,
    auth.uid(),
    COALESCE(v_role, 'System'),
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Pasang trigger audit otomatis pada tabel kritis bila tabel tersedia
DO $$
DECLARE
  tname TEXT;
  critical_tables TEXT[] := ARRAY[
    'cash_flows',
    'purchase_orders',
    'subcontractor_contracts',
    'subcontractor_payments',
    'project_termins',
    'payrolls',
    'project_members'
  ];
BEGIN
  FOREACH tname IN ARRAY critical_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tname) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_wave_a_audit_%I ON public.%I;', tname, tname);
      EXECUTE format(
        'CREATE TRIGGER trg_wave_a_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_log_audit_trigger();',
        tname, tname
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
