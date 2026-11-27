-- ============================================================================
-- WAVE F (MIGRATION 12): ANTI-GHOST WORKERS (CROSS-PROJECT NIK GUARD)
-- & PENAUTAN BIAYA UPAH / PAYROLL KE POS WBS RAB PROYEK
-- Idempotent & Production-Safe untuk Project Schedule Enterprise (Supabase)
-- ============================================================================

BEGIN;

-- 1. Kolom Relasi WBS Tenaga Kerja pada employees, employee_attendances, payrolls, & actual_costs
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS default_wbs_code TEXT;

ALTER TABLE public.employee_attendances
  ADD COLUMN IF NOT EXISTS wbs_code TEXT;

ALTER TABLE public.payrolls
  ADD COLUMN IF NOT EXISTS wbs_code TEXT,
  ADD COLUMN IF NOT EXISTS task_id UUID;

ALTER TABLE public.actual_costs
  ADD COLUMN IF NOT EXISTS wbs_code TEXT;

CREATE INDEX IF NOT EXISTS idx_employees_nik_clean
  ON public.employees ((REGEXP_REPLACE(TRIM(COALESCE(nik, '')), '[^0-9]', '', 'g')));

CREATE INDEX IF NOT EXISTS idx_emp_att_date_status
  ON public.employee_attendances(attendance_date, status);

-- 2. Database-Level Hard-Block Trigger: Anti-Ghost Workers Lintas Proyek
-- Memblokir absensi 'Present' jika NIK yang sama sudah tercatat HADIR di proyek LAIN pada tanggal yang sama
CREATE OR REPLACE FUNCTION public.fn_prevent_ghost_worker_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp RECORD;
  v_clean_nik TEXT;
  v_conflict RECORD;
BEGIN
  -- Hanya validasi jika status menunjukkan kehadiran aktif bekerja
  IF LOWER(COALESCE(NEW.status, '')) NOT IN ('present', 'hadir', 'overtime', 'half day', 'half_day') THEN
    RETURN NEW;
  END IF;

  SELECT id, project_id, name, nik
  INTO v_emp
  FROM public.employees
  WHERE id = NEW.employee_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_clean_nik := REGEXP_REPLACE(TRIM(COALESCE(v_emp.nik, '')), '[^0-9]', '', 'g');
  IF LENGTH(v_clean_nik) < 6 THEN
    RETURN NEW;
  END IF;

  SELECT
    e.id AS other_employee_id,
    e.name AS other_employee_name,
    e.project_id AS other_project_id,
    COALESCE(p.name, e.project_id::TEXT) AS other_project_name
  INTO v_conflict
  FROM public.employee_attendances a
  JOIN public.employees e ON e.id = a.employee_id
  LEFT JOIN public.projects p ON p.id = e.project_id
  WHERE a.attendance_date = NEW.attendance_date
    AND LOWER(COALESCE(a.status, '')) IN ('present', 'hadir', 'overtime', 'half day', 'half_day')
    AND e.project_id IS DISTINCT FROM v_emp.project_id
    AND REGEXP_REPLACE(TRIM(COALESCE(e.nik, '')), '[^0-9]', '', 'g') = v_clean_nik
    AND a.id IS DISTINCT FROM NEW.id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'GHOST_WORKER_DETECTED: Klaim upah ganda diblokir! Pekerja "%" (NIK %) sudah tercatat HADIR pada % di proyek lain ("%").',
      v_emp.name, v_clean_nik, TO_CHAR(NEW.attendance_date, 'YYYY-MM-DD'), v_conflict.other_project_name;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wave_f_anti_ghost_worker ON public.employee_attendances;
CREATE TRIGGER trg_wave_f_anti_ghost_worker
  BEFORE INSERT OR UPDATE ON public.employee_attendances
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_ghost_worker_attendance();

-- 3. RPC Pengecekan Konflik Ghost Worker sebelum Simpan Absensi (untuk UI real-time)
CREATE OR REPLACE FUNCTION public.rpc_check_ghost_worker_conflict(
  p_employee_id UUID,
  p_attendance_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp RECORD;
  v_clean_nik TEXT;
  v_conflict RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Sesi login diperlukan.';
  END IF;

  SELECT id, project_id, name, nik
  INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_conflict', false);
  END IF;

  v_clean_nik := REGEXP_REPLACE(TRIM(COALESCE(v_emp.nik, '')), '[^0-9]', '', 'g');
  IF LENGTH(v_clean_nik) < 6 THEN
    RETURN jsonb_build_object('has_conflict', false);
  END IF;

  SELECT
    e.project_id AS conflict_project_id,
    COALESCE(p.name, e.project_id::TEXT) AS conflict_project_name,
    e.name AS conflict_employee_name
  INTO v_conflict
  FROM public.employee_attendances a
  JOIN public.employees e ON e.id = a.employee_id
  LEFT JOIN public.projects p ON p.id = e.project_id
  WHERE a.attendance_date = p_attendance_date
    AND LOWER(COALESCE(a.status, '')) IN ('present', 'hadir', 'overtime', 'half day', 'half_day')
    AND e.project_id IS DISTINCT FROM v_emp.project_id
    AND REGEXP_REPLACE(TRIM(COALESCE(e.nik, '')), '[^0-9]', '', 'g') = v_clean_nik
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'has_conflict', true,
      'nik', v_clean_nik,
      'employee_name', v_emp.name,
      'conflict_project_id', v_conflict.conflict_project_id,
      'conflict_project_name', v_conflict.conflict_project_name,
      'attendance_date', p_attendance_date
    );
  END IF;

  RETURN jsonb_build_object('has_conflict', false);
END;
$$;

-- 4. View Audit Pekerja Terdaftar Ganda Lintas Proyek (v_cross_project_nik_audit)
CREATE OR REPLACE VIEW public.v_cross_project_nik_audit AS
SELECT
  REGEXP_REPLACE(TRIM(COALESCE(e.nik, '')), '[^0-9]', '', 'g') AS normalized_nik,
  COUNT(DISTINCT e.project_id)::INT AS project_count,
  ARRAY_AGG(DISTINCT COALESCE(p.name, e.project_id::TEXT)) AS project_names,
  MAX(e.name) AS employee_name
FROM public.employees e
LEFT JOIN public.projects p ON p.id = e.project_id
WHERE COALESCE(e.is_active, true) = true
  AND LENGTH(REGEXP_REPLACE(TRIM(COALESCE(e.nik, '')), '[^0-9]', '', 'g')) >= 6
GROUP BY REGEXP_REPLACE(TRIM(COALESCE(e.nik, '')), '[^0-9]', '', 'g')
HAVING COUNT(DISTINCT e.project_id) > 1;

GRANT SELECT ON public.v_cross_project_nik_audit TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_check_ghost_worker_conflict(UUID, DATE) TO authenticated;

COMMIT;
