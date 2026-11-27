-- ============================================================================
-- WAVE B (MIGRATION 04): DYNAMIC APPROVAL MATRIX (approval_rules)
-- + PESSIMISTIC BUDGET LOCK RPCs (SELECT ... FOR UPDATE)
-- + MULTI-STEP TIERED APPROVAL RPC
-- ============================================================================

BEGIN;

-- 1. Tabel Dinamis Matriks Persetujuan (approval_rules)
CREATE TABLE IF NOT EXISTS public.approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('PR', 'PO', 'KASBON', 'CASH_OUT', 'SPK')),
  cost_category TEXT NOT NULL DEFAULT 'ALL',
  min_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  max_amount NUMERIC(18,2),
  approver_roles JSONB NOT NULL DEFAULT '["Project Manager"]'::jsonb,
  require_mfa BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_rules_lookup
  ON public.approval_rules(document_type, cost_category, is_active, priority);

ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wave_b_rules_select ON public.approval_rules;
CREATE POLICY wave_b_rules_select ON public.approval_rules
  FOR SELECT TO authenticated
  USING (project_id IS NULL OR public.has_project_access(project_id));

DROP POLICY IF EXISTS wave_b_rules_write ON public.approval_rules;
CREATE POLICY wave_b_rules_write ON public.approval_rules
  FOR ALL TO authenticated
  USING (
    public.is_corporate_admin()
    OR (project_id IS NOT NULL AND public.is_project_approver(project_id))
  )
  WITH CHECK (
    public.is_corporate_admin()
    OR (project_id IS NOT NULL AND public.is_project_approver(project_id))
  );

-- 2. Seed Default Enterprise Approval Matrix (Idempoten — hanya isi jika kosong)
DO $$
DECLARE
  doc_t TEXT;
  doc_types TEXT[] := ARRAY['CASH_OUT', 'PO', 'PR', 'KASBON', 'SPK'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.approval_rules LIMIT 1) THEN
    FOREACH doc_t IN ARRAY doc_types LOOP
      INSERT INTO public.approval_rules
        (project_id, rule_name, document_type, cost_category, min_amount, max_amount, approver_roles, require_mfa, priority)
      VALUES
        (NULL, doc_t || ' Tier 1 (< Rp 5 Juta)', doc_t, 'ALL', 0, 4999999.99, '["Project Manager"]'::jsonb, false, 10);

      INSERT INTO public.approval_rules
        (project_id, rule_name, document_type, cost_category, min_amount, max_amount, approver_roles, require_mfa, priority)
      VALUES
        (NULL, doc_t || ' Tier 2 (Rp 5 Jt - 50 Jt)', doc_t, 'ALL', 5000000, 50000000, '["Project Manager", "Finance Manager"]'::jsonb, true, 20);

      INSERT INTO public.approval_rules
        (project_id, rule_name, document_type, cost_category, min_amount, max_amount, approver_roles, require_mfa, priority)
      VALUES
        (NULL, doc_t || ' Tier 3 (> Rp 50 Juta)', doc_t, 'ALL', 50000000.01, NULL, '["Project Manager", "Finance Manager", "Owner"]'::jsonb, true, 30);
    END LOOP;
  END IF;
END $$;

-- 3. Helper: Resolusi Jenjang Approval Dinamis dari Tabel approval_rules
CREATE OR REPLACE FUNCTION public.fn_resolve_approval_chain(
  p_project_id UUID,
  p_document_type TEXT,
  p_cost_category TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chain JSONB;
BEGIN
  SELECT r.approver_roles
  INTO v_chain
  FROM public.approval_rules r
  WHERE r.is_active = true
    AND UPPER(r.document_type) = UPPER(COALESCE(p_document_type, 'CASH_OUT'))
    AND (r.project_id = p_project_id OR r.project_id IS NULL)
    AND (LOWER(r.cost_category) = LOWER(COALESCE(p_cost_category, 'ALL')) OR UPPER(r.cost_category) = 'ALL')
    AND COALESCE(p_amount, 0) >= r.min_amount
    AND (r.max_amount IS NULL OR COALESCE(p_amount, 0) <= r.max_amount)
  ORDER BY
    (CASE WHEN r.project_id = p_project_id THEN 0 ELSE 1 END) ASC,
    (CASE WHEN UPPER(r.cost_category) <> 'ALL' THEN 0 ELSE 1 END) ASC,
    r.priority ASC,
    r.min_amount DESC
  LIMIT 1;

  IF v_chain IS NULL OR jsonb_array_length(v_chain) = 0 THEN
    RETURN '["Project Manager"]'::jsonb;
  END IF;

  RETURN v_chain;
END;
$$;

-- 4. RPC Hard-Stop & Pessimistic Lock (SELECT ... FOR UPDATE) untuk Pengajuan Kas Keluar
CREATE OR REPLACE FUNCTION public.rpc_submit_budgeted_cashflow(
  p_project_id UUID,
  p_type TEXT,
  p_category TEXT,
  p_description TEXT,
  p_amount NUMERIC,
  p_transaction_date DATE,
  p_payment_method TEXT,
  p_vendor_or_ref TEXT DEFAULT NULL,
  p_wbs_code TEXT DEFAULT NULL,
  p_attachment_url TEXT DEFAULT NULL,
  p_overbudget_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hard_stop BOOLEAN := true;
  v_pagu NUMERIC(18,2) := 0;
  v_committed NUMERIC(18,2) := 0;
  v_actual NUMERIC(18,2) := 0;
  v_available NUMERIC(18,2) := 0;
  v_chain JSONB;
  v_steps INT;
  v_inserted_id UUID;
  v_wbs_clean TEXT := NULLIF(TRIM(COALESCE(p_wbs_code, '')), '');
  v_doc_type TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Sesi login diperlukan.';
  END IF;

  IF NOT public.has_project_write_access(p_project_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Anda tidak memiliki izin tulis pada proyek ini.';
  END IF;

  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Nominal transaksi harus lebih besar dari 0.';
  END IF;

  -- PESSIMISTIC CONCURRENCY LOCK: Kunci baris proyek terlebih dahulu agar dua staf tidak memakai sisa pagu bersamaan
  SELECT COALESCE(p.budget_hard_stop, true)
  INTO v_hard_stop
  FROM public.projects p
  WHERE p.id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND: Proyek tidak ditemukan.';
  END IF;

  -- Validasi Hard-Stop untuk Kas Keluar (OUT / Expense)
  IF UPPER(COALESCE(p_type, 'OUT')) IN ('OUT', 'EXPENSE') THEN
    IF v_wbs_clean IS NOT NULL THEN
      -- Kunci baris WBS spesifik (SELECT ... FOR UPDATE)
      PERFORM 1
      FROM public.wbs_tasks wt
      WHERE wt.project_id = p_project_id AND wt.wbs_code = v_wbs_clean
      FOR UPDATE;

      SELECT
        COALESCE(v.pagu_rab, 0),
        COALESCE(v.committed_budget, 0),
        COALESCE(v.actual_cost, 0),
        COALESCE(v.available_budget, 0)
      INTO v_pagu, v_committed, v_actual, v_available
      FROM public.v_budget_3layer_wbs v
      WHERE v.project_id = p_project_id AND v.wbs_code = v_wbs_clean
      LIMIT 1;
    ELSE
      SELECT
        COALESCE(s.pagu_rab, 0),
        COALESCE(s.committed_budget, 0),
        COALESCE(s.actual_cost, 0),
        COALESCE(s.available_budget, 0)
      INTO v_pagu, v_committed, v_actual, v_available
      FROM public.v_project_budget_summary s
      WHERE s.project_id = p_project_id
      LIMIT 1;
    END IF;

    IF v_hard_stop AND v_pagu > 0 AND p_amount > v_available THEN
      RAISE EXCEPTION 'BUDGET_EXCEEDED: Pengajuan Rp % ditolak (Hard-Stop). Available Budget tersisa Rp % (Pagu Rp % - Committed Rp % - Actual Rp %).',
        TO_CHAR(p_amount, 'FM999,999,999,990'),
        TO_CHAR(v_available, 'FM999,999,999,990'),
        TO_CHAR(v_pagu, 'FM999,999,999,990'),
        TO_CHAR(v_committed, 'FM999,999,999,990'),
        TO_CHAR(v_actual, 'FM999,999,999,990');
    END IF;
  END IF;

  v_doc_type := CASE
    WHEN LOWER(COALESCE(p_category, '')) LIKE '%kasbon%' THEN 'KASBON'
    ELSE 'CASH_OUT'
  END;

  v_chain := public.fn_resolve_approval_chain(p_project_id, v_doc_type, p_category, p_amount);
  v_steps := GREATEST(1, jsonb_array_length(v_chain));

  INSERT INTO public.cash_flows (
    project_id,
    type,
    category,
    description,
    amount,
    transaction_date,
    payment_method,
    vendor_or_ref,
    wbs_code,
    attachment_url,
    overbudget_reason,
    approval_status,
    current_approval_step,
    required_approval_steps,
    approval_chain,
    approval_history
  ) VALUES (
    p_project_id,
    p_type,
    p_category,
    p_description,
    p_amount,
    COALESCE(p_transaction_date, CURRENT_DATE),
    COALESCE(p_payment_method, 'Transfer'),
    p_vendor_or_ref,
    v_wbs_clean,
    p_attachment_url,
    p_overbudget_reason,
    'Pending',
    1,
    v_steps,
    v_chain,
    '[]'::jsonb
  )
  RETURNING id INTO v_inserted_id;

  RETURN jsonb_build_object(
    'id', v_inserted_id,
    'approval_chain', v_chain,
    'required_approval_steps', v_steps,
    'available_budget_after', GREATEST(0, v_available - p_amount)
  );
END;
$$;

-- 5. RPC Validasi & Penguncian Anggaran PO (SELECT ... FOR UPDATE)
CREATE OR REPLACE FUNCTION public.rpc_validate_and_lock_po_budget(
  p_project_id UUID,
  p_wbs_code TEXT,
  p_grand_total NUMERIC,
  p_cost_category TEXT DEFAULT 'Material'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hard_stop BOOLEAN := true;
  v_pagu NUMERIC(18,2) := 0;
  v_committed NUMERIC(18,2) := 0;
  v_actual NUMERIC(18,2) := 0;
  v_available NUMERIC(18,2) := 0;
  v_wbs_clean TEXT := NULLIF(TRIM(COALESCE(p_wbs_code, '')), '');
  v_chain JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Sesi login diperlukan.';
  END IF;

  IF NOT public.has_project_write_access(p_project_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Anda tidak memiliki izin membuat PO pada proyek ini.';
  END IF;

  SELECT COALESCE(p.budget_hard_stop, true)
  INTO v_hard_stop
  FROM public.projects p
  WHERE p.id = p_project_id
  FOR UPDATE;

  IF v_wbs_clean IS NOT NULL THEN
    PERFORM 1
    FROM public.wbs_tasks wt
    WHERE wt.project_id = p_project_id AND wt.wbs_code = v_wbs_clean
    FOR UPDATE;

    SELECT COALESCE(pagu_rab, 0), COALESCE(committed_budget, 0), COALESCE(actual_cost, 0), COALESCE(available_budget, 0)
    INTO v_pagu, v_committed, v_actual, v_available
    FROM public.v_budget_3layer_wbs
    WHERE project_id = p_project_id AND wbs_code = v_wbs_clean
    LIMIT 1;
  ELSE
    SELECT COALESCE(pagu_rab, 0), COALESCE(committed_budget, 0), COALESCE(actual_cost, 0), COALESCE(available_budget, 0)
    INTO v_pagu, v_committed, v_actual, v_available
    FROM public.v_project_budget_summary
    WHERE project_id = p_project_id
    LIMIT 1;
  END IF;

  IF v_hard_stop AND v_pagu > 0 AND COALESCE(p_grand_total, 0) > v_available THEN
    RAISE EXCEPTION 'BUDGET_EXCEEDED: Nilai PO Rp % melebihi Available Budget Rp % (Pagu Rp % - Committed Rp % - Actual Rp %). PO diblokir otomatis (Hard-Stop).',
      TO_CHAR(p_grand_total, 'FM999,999,999,990'),
      TO_CHAR(v_available, 'FM999,999,999,990'),
      TO_CHAR(v_pagu, 'FM999,999,999,990'),
      TO_CHAR(v_committed, 'FM999,999,999,990'),
      TO_CHAR(v_actual, 'FM999,999,999,990');
  END IF;

  v_chain := public.fn_resolve_approval_chain(p_project_id, 'PO', p_cost_category, p_grand_total);

  RETURN jsonb_build_object(
    'allowed', true,
    'pagu_rab', v_pagu,
    'committed_budget', v_committed,
    'actual_cost', v_actual,
    'available_budget', v_available,
    'approval_chain', v_chain,
    'required_approval_steps', GREATEST(1, jsonb_array_length(v_chain))
  );
END;
$$;

-- 6. RPC Pemrosesan Multi-Step Tiered Approval pada cash_flows
CREATE OR REPLACE FUNCTION public.rpc_process_tiered_approval(
  p_record_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.cash_flows%ROWTYPE;
  v_chain JSONB;
  v_total_steps INT;
  v_curr_step INT;
  v_required_role TEXT;
  v_global_role TEXT;
  v_project_role TEXT;
  v_is_authorized BOOLEAN := false;
  v_new_status TEXT;
  v_next_step INT;
  v_entry JSONB;
  v_history JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Sesi login diperlukan.';
  END IF;

  SELECT * INTO v_row
  FROM public.cash_flows
  WHERE id = p_record_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Dokumen transaksi tidak ditemukan.';
  END IF;

  IF v_row.approval_status NOT IN ('Pending', 'Pending Overbudget') THEN
    RAISE EXCEPTION 'INVALID_STATE: Transaksi ini sudah berstatus %.', v_row.approval_status;
  END IF;

  v_chain := COALESCE(v_row.approval_chain, '["Project Manager"]'::jsonb);
  IF jsonb_array_length(v_chain) = 0 THEN
    v_chain := '["Project Manager"]'::jsonb;
  END IF;

  v_total_steps := GREATEST(1, COALESCE(v_row.required_approval_steps, jsonb_array_length(v_chain)));
  v_curr_step := LEAST(GREATEST(1, COALESCE(v_row.current_approval_step, 1)), v_total_steps);
  v_required_role := LOWER(TRIM(COALESCE(v_chain->>(v_curr_step - 1), 'Project Manager')));

  v_global_role := public.get_my_global_role();

  SELECT LOWER(TRIM(COALESCE(pm.role, '')))
  INTO v_project_role
  FROM public.project_members pm
  WHERE pm.project_id = v_row.project_id AND pm.user_id = auth.uid()
  LIMIT 1;

  IF v_global_role IN ('owner', 'super admin', 'super_admin') THEN
    v_is_authorized := true;
  ELSIF v_required_role IN ('project manager', 'pm') AND v_project_role IN ('project manager', 'pm', 'owner') THEN
    v_is_authorized := true;
  ELSIF v_required_role IN ('finance manager', 'finance_manager', 'project director', 'project_director')
    AND v_global_role IN ('finance manager', 'finance_manager') THEN
    v_is_authorized := true;
  ELSIF v_required_role IN ('central procurement', 'central_procurement')
    AND v_global_role IN ('central procurement', 'central_procurement') THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'FORBIDDEN_TIER: Tahap persetujuan %/% memerlukan peran "%".',
      v_curr_step, v_total_steps, COALESCE(v_chain->>(v_curr_step - 1), 'Approver');
  END IF;

  v_entry := jsonb_build_object(
    'step', v_curr_step,
    'required_role', COALESCE(v_chain->>(v_curr_step - 1), 'Approver'),
    'decision', UPPER(p_decision),
    'actor_id', auth.uid(),
    'actor_role', COALESCE(NULLIF(v_global_role, 'user'), v_project_role, 'approver'),
    'reason', p_reason,
    'decided_at', NOW()
  );

  v_history := COALESCE(v_row.approval_history, '[]'::jsonb) || jsonb_build_array(v_entry);

  IF UPPER(p_decision) = 'REJECTED' THEN
    v_new_status := 'Rejected';
    v_next_step := v_curr_step;
  ELSIF v_curr_step < v_total_steps THEN
    v_new_status := 'Pending';
    v_next_step := v_curr_step + 1;
  ELSE
    v_new_status := 'Approved';
    v_next_step := v_total_steps;
  END IF;

  UPDATE public.cash_flows
  SET
    approval_status = v_new_status,
    current_approval_step = v_next_step,
    required_approval_steps = v_total_steps,
    approval_chain = v_chain,
    approval_history = v_history,
    rejection_reason = CASE WHEN UPPER(p_decision) = 'REJECTED' THEN p_reason ELSE rejection_reason END
  WHERE id = p_record_id;

  RETURN jsonb_build_object(
    'id', p_record_id,
    'approval_status', v_new_status,
    'current_approval_step', v_next_step,
    'required_approval_steps', v_total_steps,
    'next_required_role', CASE WHEN v_new_status = 'Pending' THEN v_chain->>(v_next_step - 1) ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_resolve_approval_chain(UUID, TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_submit_budgeted_cashflow(UUID, TEXT, TEXT, TEXT, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_validate_and_lock_po_budget(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_process_tiered_approval(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
