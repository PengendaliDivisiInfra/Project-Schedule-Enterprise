-- ============================================================================
-- WAVE D (MIGRATION 07): RING-FENCED PROJECT CASHFLOW,
-- BANK GUARANTEES, RETENTION MATURITY & BAKP AUTO-PROGRESS BILLING
-- Idempotent & Production-Safe untuk Project Schedule Enterprise (Supabase)
-- ============================================================================

BEGIN;

-- 1. Kontrol Ring-Fenced Cashflow per Proyek
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS ring_fenced_cashflow BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hq_dropping_limit NUMERIC(18,2) NOT NULL DEFAULT 0;

-- 2. Tanggal Jatuh Tempo Pencairan Retensi & Kolom BAKP pada Termin
ALTER TABLE public.client_contracts
  ADD COLUMN IF NOT EXISTS retention_due_date DATE;

ALTER TABLE public.subcontractor_contracts
  ADD COLUMN IF NOT EXISTS retention_due_date DATE;

ALTER TABLE public.project_termins
  ADD COLUMN IF NOT EXISTS bakp_number TEXT,
  ADD COLUMN IF NOT EXISTS bakp_date DATE,
  ADD COLUMN IF NOT EXISTS bakp_verified_progress_pct NUMERIC(6,2);

-- 3. Tabel Manajemen Bank Garansi (Jaminan Pelaksanaan, Uang Muka, Pemeliharaan)
CREATE TABLE IF NOT EXISTS public.bank_guarantees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.client_contracts(id) ON DELETE SET NULL,
  guarantee_type TEXT NOT NULL CHECK (
    guarantee_type IN ('PERFORMANCE_BOND', 'ADVANCE_PAYMENT_BOND', 'MAINTENANCE_BOND', 'BID_BOND')
  ),
  guarantee_number TEXT NOT NULL,
  issuing_bank TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Released', 'Claimed', 'Expired')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_guarantees_project_expiry
  ON public.bank_guarantees(project_id, expiry_date);

-- 4. View Ring-Fenced Cashflow Real-Time per Proyek
CREATE OR REPLACE VIEW public.v_project_ringfenced_cashflow AS
WITH cf_stats AS (
  SELECT
    cf.project_id,
    SUM(CASE
      WHEN cf.type IN ('IN', 'Income')
        AND cf.approval_status = 'Approved'
        AND LOWER(COALESCE(cf.category, '')) NOT LIKE '%dropping%'
        AND LOWER(COALESCE(cf.category, '')) NOT LIKE '%pusat%'
      THEN COALESCE(cf.amount, 0)
      ELSE 0
    END) AS total_client_inflow,
    SUM(CASE
      WHEN cf.type IN ('IN', 'Income')
        AND cf.approval_status = 'Approved'
        AND (
          LOWER(COALESCE(cf.category, '')) LIKE '%dropping%'
          OR LOWER(COALESCE(cf.category, '')) LIKE '%pusat%'
        )
      THEN COALESCE(cf.amount, 0)
      ELSE 0
    END) AS total_hq_dropping,
    SUM(CASE
      WHEN cf.type IN ('OUT', 'Expense') AND cf.approval_status = 'Approved'
      THEN COALESCE(cf.amount, 0)
      ELSE 0
    END) AS total_actual_outflow,
    SUM(CASE
      WHEN cf.type IN ('OUT', 'Expense') AND cf.approval_status IN ('Pending', 'Pending Overbudget')
      THEN COALESCE(cf.amount, 0)
      ELSE 0
    END) AS total_pending_outflow
  FROM public.cash_flows cf
  WHERE COALESCE(cf.is_deleted, false) = false
    AND cf.voided_at IS NULL
  GROUP BY cf.project_id
)
SELECT
  p.id AS project_id,
  p.name AS project_name,
  COALESCE(p.ring_fenced_cashflow, true) AS ring_fenced_cashflow,
  COALESCE(p.hq_dropping_limit, 0)::NUMERIC(18,2) AS hq_dropping_limit,
  COALESCE(c.total_client_inflow, 0)::NUMERIC(18,2) AS total_client_inflow,
  COALESCE(c.total_hq_dropping, 0)::NUMERIC(18,2) AS total_hq_dropping,
  COALESCE(c.total_actual_outflow, 0)::NUMERIC(18,2) AS total_actual_outflow,
  COALESCE(c.total_pending_outflow, 0)::NUMERIC(18,2) AS total_pending_outflow,
  (
    COALESCE(c.total_client_inflow, 0) +
    COALESCE(c.total_hq_dropping, 0) -
    COALESCE(c.total_actual_outflow, 0) -
    COALESCE(c.total_pending_outflow, 0)
  )::NUMERIC(18,2) AS ringfenced_cash_balance,
  (
    (COALESCE(c.total_client_inflow, 0) + COALESCE(c.total_hq_dropping, 0)) <
    (COALESCE(c.total_actual_outflow, 0) + COALESCE(c.total_pending_outflow, 0))
  ) AS is_deficit
FROM public.projects p
LEFT JOIN cf_stats c ON c.project_id = p.id;

-- 5. RLS & Audit Trigger pada bank_guarantees
ALTER TABLE public.bank_guarantees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wave_d_bg_select ON public.bank_guarantees;
CREATE POLICY wave_d_bg_select ON public.bank_guarantees
  FOR SELECT TO authenticated
  USING (public.has_project_access(project_id));

DROP POLICY IF EXISTS wave_d_bg_write ON public.bank_guarantees;
CREATE POLICY wave_d_bg_write ON public.bank_guarantees
  FOR ALL TO authenticated
  USING (public.has_project_write_access(project_id))
  WITH CHECK (public.has_project_write_access(project_id));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_log_audit_trigger') THEN
    DROP TRIGGER IF EXISTS trg_wave_d_audit_bg ON public.bank_guarantees;
    CREATE TRIGGER trg_wave_d_audit_bg
      AFTER INSERT OR UPDATE OR DELETE ON public.bank_guarantees
      FOR EACH ROW EXECUTE FUNCTION public.fn_log_audit_trigger();
  END IF;
END $$;

GRANT SELECT ON public.v_project_ringfenced_cashflow TO authenticated;

COMMIT;
