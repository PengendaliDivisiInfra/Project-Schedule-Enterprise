-- ============================================================================
-- WAVE F (MIGRATION 11): HSE / K3 COMPLIANCE GATE (JSA & WORK PERMIT)
-- & FIELD READINESS (OFFLINE PHOTO ATTACHMENT ON DAILY PROGRESS)
-- Idempotent & Production-Safe untuk Project Schedule Enterprise (Supabase)
-- ============================================================================

BEGIN;

-- 1. Penanda Pekerjaan Risiko Tinggi (High-Risk) pada wbs_tasks
ALTER TABLE public.wbs_tasks
  ADD COLUMN IF NOT EXISTS is_high_risk BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS risk_category TEXT;

-- 2. Lampiran Foto Progres Terkompresi & Referensi Izin Kerja pada daily_progress
ALTER TABLE public.daily_progress
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS hse_permit_id UUID;

-- 3. Tabel Dokumen JSA, Work Permit (Izin Kerja) & Zero-Accident Clearance
CREATE TABLE IF NOT EXISTS public.hse_work_permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  wbs_code TEXT,
  permit_type TEXT NOT NULL CHECK (permit_type IN ('JSA', 'WORK_PERMIT', 'ZERO_ACCIDENT')),
  permit_number TEXT NOT NULL,
  work_title TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'HIGH' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE NOT NULL,
  pic_name TEXT,
  hse_officer_name TEXT,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Draft', 'Active', 'Expired', 'Revoked')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hse_permits_project_wbs_dates
  ON public.hse_work_permits(project_id, wbs_code, status, valid_from, valid_until);

-- 4. Database-Level HSE Compliance Gate Trigger pada daily_progress
-- Memblokir input progres pekerjaan BERISIKO TINGGI bila belum ada JSA / Work Permit aktif
CREATE OR REPLACE FUNCTION public.fn_enforce_hse_compliance_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_has_jsa_or_ptw BOOLEAN := false;
BEGIN
  IF NEW.task_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, project_id, wbs_code, name, COALESCE(is_high_risk, false) AS is_high_risk
  INTO v_task
  FROM public.wbs_tasks
  WHERE id = NEW.task_id
  LIMIT 1;

  IF NOT FOUND OR v_task.is_high_risk = false THEN
    RETURN NEW;
  END IF;

  -- Cek keberadaan JSA atau WORK_PERMIT berstatus Active pada tanggal progres
  SELECT EXISTS (
    SELECT 1
    FROM public.hse_work_permits p
    WHERE p.project_id = v_task.project_id
      AND p.status = 'Active'
      AND p.permit_type IN ('JSA', 'WORK_PERMIT')
      AND COALESCE(NEW.record_date, CURRENT_DATE) BETWEEN p.valid_from AND p.valid_until
      AND (
        p.wbs_code IS NULL
        OR TRIM(p.wbs_code) = ''
        OR p.wbs_code = v_task.wbs_code
      )
  ) INTO v_has_jsa_or_ptw;

  IF NOT v_has_jsa_or_ptw THEN
    RAISE EXCEPTION 'HSE_GATE_BLOCKED: Pekerjaan risiko tinggi "[%] %" wajib memiliki dokumen JSA atau Work Permit (Izin Kerja) aktif pada tanggal % sebelum progres dapat divalidasi.',
      v_task.wbs_code, v_task.name, TO_CHAR(COALESCE(NEW.record_date, CURRENT_DATE), 'YYYY-MM-DD');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wave_f_hse_progress_gate ON public.daily_progress;
CREATE TRIGGER trg_wave_f_hse_progress_gate
  BEFORE INSERT ON public.daily_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enforce_hse_compliance_gate();

-- 5. RLS & Audit Trail Trigger pada hse_work_permits
ALTER TABLE public.hse_work_permits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wave_f_hse_permits_select ON public.hse_work_permits;
CREATE POLICY wave_f_hse_permits_select ON public.hse_work_permits
  FOR SELECT TO authenticated
  USING (public.has_project_access(project_id));

DROP POLICY IF EXISTS wave_f_hse_permits_write ON public.hse_work_permits;
CREATE POLICY wave_f_hse_permits_write ON public.hse_work_permits
  FOR ALL TO authenticated
  USING (public.has_project_write_access(project_id))
  WITH CHECK (public.has_project_write_access(project_id));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_log_audit_trigger') THEN
    DROP TRIGGER IF EXISTS trg_wave_f_audit_hse_permits ON public.hse_work_permits;
    CREATE TRIGGER trg_wave_f_audit_hse_permits
      AFTER INSERT OR UPDATE OR DELETE ON public.hse_work_permits
      FOR EACH ROW EXECUTE FUNCTION public.fn_log_audit_trigger();
  END IF;
END $$;

COMMIT;
