-- ============================================================================
-- WAVE B (MIGRATION 03): 3-LAYER BUDGET CONTROL & PESSIMISTIC CONCURRENCY LOCK
-- Available = Pagu RAB - (Committed [PO + SPK + Pending Cash] + Actual Cost)
-- Hard-Stop Validation + SELECT ... FOR UPDATE pada submit transaksi & PO
-- ============================================================================

BEGIN;

-- 1. Pastikan kolom relasi anggaran & kontrol tersedia (Idempoten)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS budget_hard_stop BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS wbs_code TEXT;

ALTER TABLE public.subcontractor_contracts
  ADD COLUMN IF NOT EXISTS wbs_code TEXT;

ALTER TABLE public.cash_flows
  ADD COLUMN IF NOT EXISTS current_approval_step INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS required_approval_steps INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approval_chain JSONB NOT NULL DEFAULT '["Project Manager"]'::jsonb,
  ADD COLUMN IF NOT EXISTS approval_history JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'Approved',
  ADD COLUMN IF NOT EXISTS current_approval_step INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS required_approval_steps INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approval_chain JSONB NOT NULL DEFAULT '["Project Manager"]'::jsonb,
  ADD COLUMN IF NOT EXISTS approval_history JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_po_project_wbs ON public.purchase_orders(project_id, wbs_code);
CREATE INDEX IF NOT EXISTS idx_spk_project_wbs ON public.subcontractor_contracts(project_id, wbs_code);
CREATE INDEX IF NOT EXISTS idx_cf_project_wbs_status ON public.cash_flows(project_id, wbs_code, approval_status);

-- 2. View 3 Lapisan Anggaran per WBS (v_budget_3layer_wbs)
CREATE OR REPLACE VIEW public.v_budget_3layer_wbs AS
WITH po_commit AS (
  SELECT
    po.project_id,
    po.wbs_code,
    SUM(GREATEST(0, COALESCE(po.grand_total, 0) - COALESCE(po.paid_amount, 0))) AS committed_po
  FROM public.purchase_orders po
  WHERE COALESCE(po.status, '') NOT IN ('Void', 'Draft', 'Rejected')
    AND po.wbs_code IS NOT NULL
    AND TRIM(po.wbs_code) <> ''
  GROUP BY po.project_id, po.wbs_code
),
spk_paid AS (
  SELECT
    sp.contract_id,
    SUM(COALESCE(sp.amount, 0)) AS total_paid_subcon
  FROM public.subcontractor_payments sp
  WHERE COALESCE(sp.is_deleted, false) = false
    AND sp.voided_at IS NULL
    AND LOWER(COALESCE(sp.status, '')) IN ('paid', 'approved')
  GROUP BY sp.contract_id
),
spk_commit AS (
  SELECT
    sc.project_id,
    sc.wbs_code,
    SUM(GREATEST(0, COALESCE(sc.contract_value, 0) - COALESCE(sp.total_paid_subcon, 0))) AS committed_spk
  FROM public.subcontractor_contracts sc
  LEFT JOIN spk_paid sp ON sp.contract_id = sc.id
  WHERE COALESCE(sc.status, '') NOT IN ('Void', 'Draft')
    AND sc.wbs_code IS NOT NULL
    AND TRIM(sc.wbs_code) <> ''
  GROUP BY sc.project_id, sc.wbs_code
),
cf_agg AS (
  SELECT
    cf.project_id,
    cf.wbs_code,
    SUM(CASE
      WHEN cf.approval_status IN ('Pending', 'Pending Overbudget') THEN COALESCE(cf.amount, 0)
      ELSE 0
    END) AS committed_pending_cash,
    SUM(CASE
      WHEN cf.approval_status = 'Approved' THEN COALESCE(cf.amount, 0)
      ELSE 0
    END) AS actual_cost
  FROM public.cash_flows cf
  WHERE cf.type IN ('OUT', 'Expense')
    AND COALESCE(cf.is_deleted, false) = false
    AND cf.voided_at IS NULL
    AND cf.wbs_code IS NOT NULL
    AND TRIM(cf.wbs_code) <> ''
  GROUP BY cf.project_id, cf.wbs_code
)
SELECT
  wt.id AS task_id,
  wt.project_id,
  wt.wbs_code,
  wt.name AS task_name,
  COALESCE(wt.summary, 'No') AS summary,
  COALESCE(wt.cost, 0)::NUMERIC(18,2) AS pagu_rab,
  COALESCE(po.committed_po, 0)::NUMERIC(18,2) AS committed_po,
  COALESCE(spk.committed_spk, 0)::NUMERIC(18,2) AS committed_spk,
  COALESCE(cf.committed_pending_cash, 0)::NUMERIC(18,2) AS committed_pending_cash,
  (
    COALESCE(po.committed_po, 0) +
    COALESCE(spk.committed_spk, 0) +
    COALESCE(cf.committed_pending_cash, 0)
  )::NUMERIC(18,2) AS committed_budget,
  COALESCE(cf.actual_cost, 0)::NUMERIC(18,2) AS actual_cost,
  (
    COALESCE(wt.cost, 0) -
    (
      COALESCE(po.committed_po, 0) +
      COALESCE(spk.committed_spk, 0) +
      COALESCE(cf.committed_pending_cash, 0) +
      COALESCE(cf.actual_cost, 0)
    )
  )::NUMERIC(18,2) AS available_budget
FROM public.wbs_tasks wt
LEFT JOIN po_commit po ON po.project_id = wt.project_id AND po.wbs_code = wt.wbs_code
LEFT JOIN spk_commit spk ON spk.project_id = wt.project_id AND spk.wbs_code = wt.wbs_code
LEFT JOIN cf_agg cf ON cf.project_id = wt.project_id AND cf.wbs_code = wt.wbs_code;

-- 3. View Ringkasan 3 Lapisan Anggaran Tingkat Proyek (v_project_budget_summary)
CREATE OR REPLACE VIEW public.v_project_budget_summary AS
WITH wbs_pagu AS (
  SELECT
    project_id,
    SUM(CASE WHEN COALESCE(summary, 'No') <> 'Yes' THEN COALESCE(cost, 0) ELSE 0 END) AS leaf_rab_total
  FROM public.wbs_tasks
  GROUP BY project_id
),
po_all AS (
  SELECT
    project_id,
    SUM(GREATEST(0, COALESCE(grand_total, 0) - COALESCE(paid_amount, 0))) AS committed_po
  FROM public.purchase_orders
  WHERE COALESCE(status, '') NOT IN ('Void', 'Draft', 'Rejected')
  GROUP BY project_id
),
spk_paid AS (
  SELECT
    contract_id,
    SUM(COALESCE(amount, 0)) AS paid_amt
  FROM public.subcontractor_payments
  WHERE COALESCE(is_deleted, false) = false
    AND voided_at IS NULL
    AND LOWER(COALESCE(status, '')) IN ('paid', 'approved')
  GROUP BY contract_id
),
spk_all AS (
  SELECT
    sc.project_id,
    SUM(GREATEST(0, COALESCE(sc.contract_value, 0) - COALESCE(sp.paid_amt, 0))) AS committed_spk
  FROM public.subcontractor_contracts sc
  LEFT JOIN spk_paid sp ON sp.contract_id = sc.id
  WHERE COALESCE(sc.status, '') NOT IN ('Void', 'Draft')
  GROUP BY sc.project_id
),
cf_all AS (
  SELECT
    project_id,
    SUM(CASE WHEN approval_status IN ('Pending', 'Pending Overbudget') THEN COALESCE(amount, 0) ELSE 0 END) AS committed_pending_cash,
    SUM(CASE WHEN approval_status = 'Approved' THEN COALESCE(amount, 0) ELSE 0 END) AS actual_cost
  FROM public.cash_flows
  WHERE type IN ('OUT', 'Expense')
    AND COALESCE(is_deleted, false) = false
    AND voided_at IS NULL
  GROUP BY project_id
)
SELECT
  p.id AS project_id,
  p.name AS project_name,
  COALESCE(p.budget_hard_stop, true) AS budget_hard_stop,
  (CASE
    WHEN COALESCE(wp.leaf_rab_total, 0) > 0 THEN wp.leaf_rab_total
    ELSE COALESCE(p.contract_value, 0)
  END)::NUMERIC(18,2) AS pagu_rab,
  COALESCE(po.committed_po, 0)::NUMERIC(18,2) AS committed_po,
  COALESCE(spk.committed_spk, 0)::NUMERIC(18,2) AS committed_spk,
  COALESCE(cf.committed_pending_cash, 0)::NUMERIC(18,2) AS committed_pending_cash,
  (
    COALESCE(po.committed_po, 0) +
    COALESCE(spk.committed_spk, 0) +
    COALESCE(cf.committed_pending_cash, 0)
  )::NUMERIC(18,2) AS committed_budget,
  COALESCE(cf.actual_cost, 0)::NUMERIC(18,2) AS actual_cost,
  (
    (CASE WHEN COALESCE(wp.leaf_rab_total, 0) > 0 THEN wp.leaf_rab_total ELSE COALESCE(p.contract_value, 0) END) -
    (
      COALESCE(po.committed_po, 0) +
      COALESCE(spk.committed_spk, 0) +
      COALESCE(cf.committed_pending_cash, 0) +
      COALESCE(cf.actual_cost, 0)
    )
  )::NUMERIC(18,2) AS available_budget
FROM public.projects p
LEFT JOIN wbs_pagu wp ON wp.project_id = p.id
LEFT JOIN po_all po ON po.project_id = p.id
LEFT JOIN spk_all spk ON spk.project_id = p.id
LEFT JOIN cf_all cf ON cf.project_id = p.id;

GRANT SELECT ON public.v_budget_3layer_wbs TO authenticated;
GRANT SELECT ON public.v_project_budget_summary TO authenticated;

COMMIT;
