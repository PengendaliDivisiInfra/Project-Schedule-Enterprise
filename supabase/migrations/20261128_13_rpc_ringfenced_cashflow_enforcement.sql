-- ============================================================================
-- FINAL HARDENING (MIGRATION 13): DATABASE-LEVEL RING-FENCED CASHFLOW GUARD
-- Menegakkan Ring-Fenced Cashflow (Saldo Kas Proyek + Plafon Dropping HQ)
-- secara atomik di dalam rpc_submit_budgeted_cashflow (SELECT ... FOR UPDATE)
-- Idempotent & Production-Safe untuk Project Schedule Enterprise (Supabase)
-- ============================================================================

BEGIN;

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
  v_ring_fenced BOOLEAN := true;
  v_hq_dropping_limit NUMERIC(18,2) := 0;
  v_pagu NUMERIC(18,2) := 0;
  v_committed NUMERIC(18,2) := 0;
  v_actual NUMERIC(18,2) := 0;
  v_available NUMERIC(18,2) := 0;
  v_rf_balance NUMERIC(18,2) := 0;
  v_projected_rf_balance NUMERIC(18,2) := 0;
  v_deficit NUMERIC(18,2) := 0;
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

  -- PESSIMISTIC CONCURRENCY LOCK: Kunci baris proyek terlebih dahulu
  SELECT
    COALESCE(p.budget_hard_stop, true),
    COALESCE(p.ring_fenced_cashflow, true),
    COALESCE(p.hq_dropping_limit, 0)
  INTO v_hard_stop, v_ring_fenced, v_hq_dropping_limit
  FROM public.projects p
  WHERE p.id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND: Proyek tidak ditemukan.';
  END IF;

  -- Validasi Ganda untuk Kas Keluar (OUT / Expense):
  -- (A) 3-Layer Budget Hard-Stop & (B) Ring-Fenced Project Cashflow Guard
  IF UPPER(COALESCE(p_type, 'OUT')) IN ('OUT', 'EXPENSE') THEN
    -- (A) Validasi Pagu RAB 3 Lapisan
    IF v_wbs_clean IS NOT NULL THEN
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

    -- (B) Validasi Ring-Fenced Cashflow Proyek secara Atomik (Di Dalam Lock)
    SELECT COALESCE(rf.ringfenced_cash_balance, 0)
    INTO v_rf_balance
    FROM public.v_project_ringfenced_cashflow rf
    WHERE rf.project_id = p_project_id
    LIMIT 1;

    v_projected_rf_balance := COALESCE(v_rf_balance, 0) - p_amount;
    IF v_ring_fenced AND v_projected_rf_balance < 0 THEN
      v_deficit := ABS(v_projected_rf_balance);
      IF v_deficit > v_hq_dropping_limit THEN
        RAISE EXCEPTION 'RING_FENCED_DEFICIT: Pengajuan Rp % ditolak (Ring-Fenced Cashflow). Proyek akan defisit Rp % melebihi plafon Dropping HQ Rp %. Tagih termin klien atau ajukan Dropping Kantor Pusat terlebih dahulu.',
          TO_CHAR(p_amount, 'FM999,999,999,990'),
          TO_CHAR(v_deficit, 'FM999,999,999,990'),
          TO_CHAR(v_hq_dropping_limit, 'FM999,999,999,990');
      END IF;
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
    'available_budget_after', GREATEST(0, v_available - p_amount),
    'ringfenced_balance_after', v_projected_rf_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_submit_budgeted_cashflow(UUID, TEXT, TEXT, TEXT, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
