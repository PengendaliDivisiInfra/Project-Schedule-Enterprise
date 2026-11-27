-- ============================================================================
-- WAVE D (MIGRATION 08): LOCKED RAB VERSIONS (BASELINE v0 -> REVISED v1, v2...),
-- CONTRACT CHANGE ORDERS (CCO / ADDENDUM) & UNAPPROVED VARIATION WORK ALERT
-- Idempotent & Production-Safe untuk Project Schedule Enterprise (Supabase)
-- ============================================================================

BEGIN;

-- 1. Penanda Versi RAB Terkunci pada projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS rab_baseline_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS active_rab_version INT NOT NULL DEFAULT 0;

-- 2. Tabel Contract Change Orders (CCO / Addendum Klien)
CREATE TABLE IF NOT EXISTS public.contract_change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  cco_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cco_type TEXT NOT NULL DEFAULT 'ADDITION' CHECK (cco_type IN ('ADDITION', 'DEDUCTION', 'MIXED')),
  wbs_code TEXT,
  delta_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  base_version_no INT NOT NULL DEFAULT 0,
  resulting_version_no INT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Signed', 'Rejected')),
  signed_date DATE,
  signed_doc_url TEXT,
  requested_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cco_project_status ON public.contract_change_orders(project_id, status);

-- 3. Tabel Versi RAB Terkunci (Versi 0 = Baseline Kontrak, Versi 1+ = Hasil Addendum/CCO)
CREATE TABLE IF NOT EXISTS public.rab_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_no INT NOT NULL DEFAULT 0,
  version_label TEXT NOT NULL,
  cco_id UUID REFERENCES public.contract_change_orders(id) ON DELETE SET NULL,
  total_rab NUMERIC(18,2) NOT NULL DEFAULT 0,
  task_count INT NOT NULL DEFAULT 0,
  snapshot_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_locked BOOLEAN NOT NULL DEFAULT true,
  locked_by UUID,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  UNIQUE (project_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_rab_versions_project ON public.rab_versions(project_id, version_no DESC);

-- 4. Tag Pekerjaan Tambah (Variation Work) pada wbs_tasks, cash_flows, dan purchase_orders
ALTER TABLE public.wbs_tasks
  ADD COLUMN IF NOT EXISTS is_variation_work BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cco_id UUID REFERENCES public.contract_change_orders(id) ON DELETE SET NULL;

ALTER TABLE public.cash_flows
  ADD COLUMN IF NOT EXISTS is_variation_work BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cco_id UUID REFERENCES public.contract_change_orders(id) ON DELETE SET NULL;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS is_variation_work BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cco_id UUID REFERENCES public.contract_change_orders(id) ON DELETE SET NULL;

-- 5. View Deteksi Pekerjaan Tambah Tanpa Addendum/SPK Resmi (Unapproved Work Alert)
CREATE OR REPLACE VIEW public.v_unapproved_variation_work AS
SELECT
  cf.id AS record_id,
  'CASH_FLOW'::TEXT AS source_type,
  cf.project_id,
  cf.wbs_code,
  COALESCE(cf.description, cf.vendor_or_ref, cf.category) AS work_label,
  COALESCE(cf.amount, 0)::NUMERIC(18,2) AS incurred_cost,
  cf.transaction_date AS incurred_date,
  cf.cco_id,
  cco.cco_number,
  COALESCE(cco.status, 'NO_CCO') AS cco_status
FROM public.cash_flows cf
LEFT JOIN public.contract_change_orders cco ON cco.id = cf.cco_id
WHERE cf.type IN ('OUT', 'Expense')
  AND COALESCE(cf.is_deleted, false) = false
  AND cf.voided_at IS NULL
  AND (cf.is_variation_work = true OR cf.cco_id IS NOT NULL)
  AND COALESCE(cco.status, 'NO_CCO') NOT IN ('Signed', 'Approved')

UNION ALL

SELECT
  po.id AS record_id,
  'PURCHASE_ORDER'::TEXT AS source_type,
  po.project_id,
  po.wbs_code,
  'PO ' || po.po_number AS work_label,
  COALESCE(po.grand_total, 0)::NUMERIC(18,2) AS incurred_cost,
  po.po_date AS incurred_date,
  po.cco_id,
  cco.cco_number,
  COALESCE(cco.status, 'NO_CCO') AS cco_status
FROM public.purchase_orders po
LEFT JOIN public.contract_change_orders cco ON cco.id = po.cco_id
WHERE COALESCE(po.status, '') NOT IN ('Void', 'Draft', 'Rejected')
  AND (po.is_variation_work = true OR po.cco_id IS NOT NULL)
  AND COALESCE(cco.status, 'NO_CCO') NOT IN ('Signed', 'Approved');

-- 6. RPC Kunci RAB Baseline (Versi 0) secara Atomik (SELECT ... FOR UPDATE)
CREATE OR REPLACE FUNCTION public.rpc_lock_rab_baseline(
  p_project_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_rab NUMERIC(18,2) := 0;
  v_task_count INT := 0;
  v_snapshot JSONB := '[]'::jsonb;
  v_version_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Sesi login diperlukan.';
  END IF;

  IF NOT public.is_project_approver(p_project_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Hanya PM / Owner / Finance Manager yang dapat mengunci RAB Baseline.';
  END IF;

  PERFORM 1 FROM public.projects WHERE id = p_project_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.rab_versions WHERE project_id = p_project_id AND version_no = 0) THEN
    RAISE EXCEPTION 'BASELINE_ALREADY_LOCKED: RAB Baseline (Versi 0) sudah terkunci dan tidak dapat ditimpa.';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN COALESCE(summary, 'No') <> 'Yes' THEN COALESCE(cost, 0) ELSE 0 END), 0),
    COUNT(*),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'wbs_code', wbs_code,
          'name', name,
          'summary', COALESCE(summary, 'No'),
          'volume', COALESCE(volume, 0),
          'cost', COALESCE(cost, 0)
        ) ORDER BY wbs_code
      ),
      '[]'::jsonb
    )
  INTO v_total_rab, v_task_count, v_snapshot
  FROM public.wbs_tasks
  WHERE project_id = p_project_id;

  INSERT INTO public.rab_versions (
    project_id, version_no, version_label, total_rab, task_count, snapshot_items, is_locked, locked_by, notes
  ) VALUES (
    p_project_id, 0, 'Baseline Kontrak (Versi 0)', v_total_rab, v_task_count, v_snapshot, true, auth.uid(),
    COALESCE(p_notes, 'Penguncian awal RAB Baseline Kontrak')
  ) RETURNING id INTO v_version_id;

  UPDATE public.projects
  SET rab_baseline_locked = true,
      active_rab_version = 0
  WHERE id = p_project_id;

  RETURN jsonb_build_object(
    'version_id', v_version_id,
    'version_no', 0,
    'total_rab', v_total_rab,
    'task_count', v_task_count
  );
END;
$$;

-- 7. RPC Tandatangani CCO & Terbitkan Revisi RAB Baru (Versi 1, 2, ...) Tanpa Hapus Histori
CREATE OR REPLACE FUNCTION public.rpc_sign_cco_and_create_rab_version(
  p_cco_id UUID,
  p_signed_date DATE DEFAULT CURRENT_DATE,
  p_signed_doc_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cco public.contract_change_orders%ROWTYPE;
  v_prev_ver INT := 0;
  v_prev_total NUMERIC(18,2) := 0;
  v_next_ver INT := 1;
  v_new_total NUMERIC(18,2) := 0;
  v_snapshot JSONB := '[]'::jsonb;
  v_task_count INT := 0;
  v_version_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Sesi login diperlukan.';
  END IF;

  SELECT * INTO v_cco
  FROM public.contract_change_orders
  WHERE id = p_cco_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Dokumen CCO / Addendum tidak ditemukan.';
  END IF;

  IF NOT public.is_project_approver(v_cco.project_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Hanya PM / Owner / Finance Manager yang dapat menandatangani CCO.';
  END IF;

  IF v_cco.status = 'Signed' THEN
    RAISE EXCEPTION 'ALREADY_SIGNED: CCO ini sudah ditandatangani dan membentuk versi RAB.';
  END IF;

  IF v_cco.status = 'Rejected' THEN
    RAISE EXCEPTION 'INVALID_STATE: CCO yang ditolak tidak dapat ditandatangani.';
  END IF;

  PERFORM 1 FROM public.projects WHERE id = v_cco.project_id FOR UPDATE;

  -- Pastikan Versi 0 (Baseline) ada secara otomatis bila belum pernah dikunci
  IF NOT EXISTS (SELECT 1 FROM public.rab_versions WHERE project_id = v_cco.project_id AND version_no = 0) THEN
    PERFORM public.rpc_lock_rab_baseline(v_cco.project_id, 'Auto-lock Baseline v0 sebelum CCO ' || v_cco.cco_number);
  END IF;

  SELECT COALESCE(MAX(version_no), 0)
  INTO v_prev_ver
  FROM public.rab_versions
  WHERE project_id = v_cco.project_id;

  SELECT COALESCE(total_rab, 0)
  INTO v_prev_total
  FROM public.rab_versions
  WHERE project_id = v_cco.project_id AND version_no = v_prev_ver
  LIMIT 1;

  v_next_ver := v_prev_ver + 1;
  v_new_total := GREATEST(0, v_prev_total + COALESCE(v_cco.delta_amount, 0));

  -- Jika CCO menargetkan wbs_code spesifik, tambahkan/kurangi pagu WBS tersebut
  IF v_cco.wbs_code IS NOT NULL AND TRIM(v_cco.wbs_code) <> '' THEN
    UPDATE public.wbs_tasks
    SET cost = GREATEST(0, COALESCE(cost, 0) + COALESCE(v_cco.delta_amount, 0)),
        cco_id = v_cco.id
    WHERE project_id = v_cco.project_id
      AND wbs_code = TRIM(v_cco.wbs_code);
  END IF;

  -- Ambil snapshot WBS terbaru untuk Versi RAB baru
  SELECT
    COUNT(*),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'wbs_code', wbs_code,
          'name', name,
          'summary', COALESCE(summary, 'No'),
          'volume', COALESCE(volume, 0),
          'cost', COALESCE(cost, 0)
        ) ORDER BY wbs_code
      ),
      '[]'::jsonb
    )
  INTO v_task_count, v_snapshot
  FROM public.wbs_tasks
  WHERE project_id = v_cco.project_id;

  INSERT INTO public.rab_versions (
    project_id, version_no, version_label, cco_id, total_rab, task_count, snapshot_items, is_locked, locked_by, notes
  ) VALUES (
    v_cco.project_id,
    v_next_ver,
    'Revisi RAB v' || v_next_ver || ' (' || v_cco.cco_number || ')',
    v_cco.id,
    v_new_total,
    v_task_count,
    v_snapshot,
    true,
    auth.uid(),
    v_cco.title
  ) RETURNING id INTO v_version_id;

  UPDATE public.contract_change_orders
  SET status = 'Signed',
      resulting_version_no = v_next_ver,
      signed_date = COALESCE(p_signed_date, CURRENT_DATE),
      signed_doc_url = COALESCE(p_signed_doc_url, signed_doc_url),
      approved_by = auth.uid(),
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_cco_id;

  UPDATE public.projects
  SET active_rab_version = v_next_ver,
      contract_value = GREATEST(0, COALESCE(contract_value, 0) + COALESCE(v_cco.delta_amount, 0))
  WHERE id = v_cco.project_id;

  UPDATE public.client_contracts
  SET contract_value = GREATEST(0, COALESCE(contract_value, 0) + COALESCE(v_cco.delta_amount, 0)),
      updated_at = NOW()
  WHERE project_id = v_cco.project_id AND is_active = true;

  RETURN jsonb_build_object(
    'cco_id', p_cco_id,
    'version_id', v_version_id,
    'version_no', v_next_ver,
    'previous_rab', v_prev_total,
    'delta_amount', v_cco.delta_amount,
    'new_total_rab', v_new_total
  );
END;
$$;

-- 8. RLS Policies & Audit Triggers
ALTER TABLE public.contract_change_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_d_cco_select ON public.contract_change_orders;
CREATE POLICY wave_d_cco_select ON public.contract_change_orders
  FOR SELECT TO authenticated USING (public.has_project_access(project_id));
DROP POLICY IF EXISTS wave_d_cco_write ON public.contract_change_orders;
CREATE POLICY wave_d_cco_write ON public.contract_change_orders
  FOR ALL TO authenticated
  USING (public.has_project_write_access(project_id))
  WITH CHECK (public.has_project_write_access(project_id));

ALTER TABLE public.rab_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_d_rabv_select ON public.rab_versions;
CREATE POLICY wave_d_rabv_select ON public.rab_versions
  FOR SELECT TO authenticated USING (public.has_project_access(project_id));
DROP POLICY IF EXISTS wave_d_rabv_insert ON public.rab_versions;
CREATE POLICY wave_d_rabv_insert ON public.rab_versions
  FOR INSERT TO authenticated WITH CHECK (public.is_project_approver(project_id));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_log_audit_trigger') THEN
    DROP TRIGGER IF EXISTS trg_wave_d_audit_cco ON public.contract_change_orders;
    CREATE TRIGGER trg_wave_d_audit_cco
      AFTER INSERT OR UPDATE OR DELETE ON public.contract_change_orders
      FOR EACH ROW EXECUTE FUNCTION public.fn_log_audit_trigger();
  END IF;
END $$;

GRANT SELECT ON public.v_unapproved_variation_work TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_rab_baseline(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sign_cco_and_create_rab_version(UUID, DATE, TEXT) TO authenticated;

COMMIT;
