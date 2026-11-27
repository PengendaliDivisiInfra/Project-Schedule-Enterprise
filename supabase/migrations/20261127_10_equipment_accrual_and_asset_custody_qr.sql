-- ============================================================================
-- WAVE E (MIGRATION 10): EQUIPMENT DAILY RENTAL COST ACCRUAL, EXPIRY ALERTS,
-- DAN ASSET CUSTODY TRANSFER ANTAR-PM DENGAN QR ASSET TAG
-- Idempotent & Production-Safe untuk Project Schedule Enterprise (Supabase)
-- ============================================================================

BEGIN;

-- 1. Perluas equipment_units untuk Asset Tag (QR Code), Kepemilikan & Custodian PM
ALTER TABLE public.equipment_units
  ADD COLUMN IF NOT EXISTS asset_tag TEXT,
  ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'RENTED',
  ADD COLUMN IF NOT EXISTS custodian_user_id UUID,
  ADD COLUMN IF NOT EXISTS custodian_name TEXT,
  ADD COLUMN IF NOT EXISTS condition_status TEXT NOT NULL DEFAULT 'GOOD';

UPDATE public.equipment_units
SET asset_tag = 'AST-' || UPPER(REGEXP_REPLACE(COALESCE(unit_code, id::TEXT), '[^A-Za-z0-9\-]', '', 'g'))
WHERE asset_tag IS NULL OR TRIM(asset_tag) = '';

CREATE INDEX IF NOT EXISTS idx_equipment_units_asset_tag ON public.equipment_units(asset_tag);

-- 2. Tabel Akumulasi Biaya Sewa Harian Alat (Rental Cost Accrual)
CREATE TABLE IF NOT EXISTS public.equipment_rental_accruals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.equipment_contracts(id) ON DELETE CASCADE,
  accrual_date DATE NOT NULL DEFAULT CURRENT_DATE,
  rental_basis TEXT NOT NULL DEFAULT 'Hourly',
  daily_rate NUMERIC(18,2) NOT NULL DEFAULT 0,
  accrued_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Accrued' CHECK (status IN ('Accrued', 'Billed', 'Void')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, accrual_date)
);

CREATE INDEX IF NOT EXISTS idx_rental_accruals_project_date
  ON public.equipment_rental_accruals(project_id, accrual_date DESC);

-- 3. View Kesehatan Sewa Alat & Pengingat Jatuh Tempo Masa Sewa
CREATE OR REPLACE VIEW public.v_equipment_rental_health AS
WITH acc AS (
  SELECT
    contract_id,
    COUNT(*)::INT AS accrued_days,
    SUM(COALESCE(accrued_amount, 0))::NUMERIC(18,2) AS total_accrued_amount,
    MAX(accrual_date) AS last_accrual_date
  FROM public.equipment_rental_accruals
  WHERE status <> 'Void'
  GROUP BY contract_id
)
SELECT
  ec.id AS contract_id,
  ec.project_id,
  ec.contract_number,
  ec.vendor_name,
  ec.rental_basis,
  COALESCE(ec.rate_per_hour, 0)::NUMERIC(18,2) AS base_rate,
  COALESCE(ec.daily_normal_hours_limit, 8)::NUMERIC(6,2) AS daily_hours_limit,
  ec.start_date,
  ec.end_date,
  (ec.end_date - CURRENT_DATE)::INT AS days_to_expiry,
  CASE
    WHEN ec.end_date < CURRENT_DATE THEN 'EXPIRED'
    WHEN (ec.end_date - CURRENT_DATE) <= 3 THEN 'CRITICAL_3D'
    WHEN (ec.end_date - CURRENT_DATE) <= 7 THEN 'WARNING_7D'
    WHEN (ec.end_date - CURRENT_DATE) <= 14 THEN 'UPCOMING_14D'
    ELSE 'SAFE'
  END AS expiry_severity,
  CASE
    WHEN LOWER(COALESCE(ec.rental_basis, 'hourly')) = 'monthly' THEN ROUND(COALESCE(ec.rate_per_hour, 0) / 30.0, 2)
    WHEN LOWER(COALESCE(ec.rental_basis, 'hourly')) = 'daily' THEN COALESCE(ec.rate_per_hour, 0)
    ELSE ROUND(COALESCE(ec.rate_per_hour, 0) * COALESCE(ec.daily_normal_hours_limit, 8), 2)
  END::NUMERIC(18,2) AS estimated_daily_burn,
  COALESCE(a.accrued_days, 0) AS accrued_days,
  COALESCE(a.total_accrued_amount, 0)::NUMERIC(18,2) AS total_accrued_amount,
  a.last_accrual_date
FROM public.equipment_contracts ec
LEFT JOIN acc a ON a.contract_id = ec.id
WHERE COALESCE(ec.is_active, true) = true;

-- 4. RPC Posting Daily Rental Cost Accrual secara Idempoten (ke equipment_rental_accruals + actual_costs)
CREATE OR REPLACE FUNCTION public.rpc_post_daily_rental_accrual(
  p_project_id UUID,
  p_accrual_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_daily_amount NUMERIC(18,2);
  v_accrual_id UUID;
  v_posted_count INT := 0;
  v_total_posted NUMERIC(18,2) := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Sesi login diperlukan.';
  END IF;

  IF NOT public.has_project_write_access(p_project_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Anda tidak memiliki izin mencatat accrual sewa proyek ini.';
  END IF;

  FOR v_rec IN
    SELECT *
    FROM public.equipment_contracts
    WHERE project_id = p_project_id
      AND COALESCE(is_active, true) = true
      AND start_date <= p_accrual_date
      AND end_date >= p_accrual_date
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.equipment_rental_accruals
      WHERE contract_id = v_rec.id AND accrual_date = p_accrual_date
    ) THEN
      v_daily_amount := CASE
        WHEN LOWER(COALESCE(v_rec.rental_basis, 'hourly')) = 'monthly' THEN ROUND(COALESCE(v_rec.rate_per_hour, 0) / 30.0, 2)
        WHEN LOWER(COALESCE(v_rec.rental_basis, 'hourly')) = 'daily' THEN COALESCE(v_rec.rate_per_hour, 0)
        ELSE ROUND(COALESCE(v_rec.rate_per_hour, 0) * COALESCE(v_rec.daily_normal_hours_limit, 8), 2)
      END;

      IF v_daily_amount > 0 THEN
        INSERT INTO public.equipment_rental_accruals (
          project_id, contract_id, accrual_date, rental_basis, daily_rate, accrued_amount, status, notes, created_by
        ) VALUES (
          p_project_id, v_rec.id, p_accrual_date, COALESCE(v_rec.rental_basis, 'Hourly'),
          v_daily_amount, v_daily_amount, 'Accrued',
          'Auto daily accrual kontrak ' || v_rec.contract_number, auth.uid()
        ) RETURNING id INTO v_accrual_id;

        INSERT INTO public.actual_costs (
          project_id, task_id, resource_type, cost_amount, source_id, reference_type, recorded_at
        ) VALUES (
          p_project_id, NULL, 'Equipment', v_daily_amount, v_accrual_id, 'equipment_rental_accrual', NOW()
        );

        v_posted_count := v_posted_count + 1;
        v_total_posted := v_total_posted + v_daily_amount;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'accrual_date', p_accrual_date,
    'posted_contracts', v_posted_count,
    'total_accrued_amount', v_total_posted
  );
END;
$$;

-- 5. Tabel Serah Terima Aset Antar-PM (Asset Custody Transfer)
CREATE TABLE IF NOT EXISTS public.asset_custody_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number TEXT NOT NULL,
  unit_id UUID NOT NULL REFERENCES public.equipment_units(id) ON DELETE CASCADE,
  asset_tag TEXT NOT NULL,
  from_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  to_project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_custodian_id UUID,
  from_custodian_name TEXT,
  to_custodian_id UUID,
  to_custodian_name TEXT NOT NULL,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  condition_at_handover TEXT NOT NULL DEFAULT 'GOOD',
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Rejected')),
  handover_notes TEXT,
  requested_by UUID,
  accepted_by UUID,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_custody_projects
  ON public.asset_custody_transfers(from_project_id, to_project_id, status);

-- 6. RPC Atomik Penerimaan Serah Terima Aset Antar-PM (SELECT ... FOR UPDATE)
CREATE OR REPLACE FUNCTION public.rpc_accept_asset_custody_transfer(
  p_transfer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tr public.asset_custody_transfers%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Sesi login diperlukan.';
  END IF;

  SELECT * INTO v_tr
  FROM public.asset_custody_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Dokumen Serah Terima Aset tidak ditemukan.';
  END IF;

  IF v_tr.status = 'Accepted' THEN
    RAISE EXCEPTION 'ALREADY_ACCEPTED: Serah terima aset ini sudah diterima sebelumnya.';
  END IF;

  IF v_tr.status = 'Rejected' THEN
    RAISE EXCEPTION 'INVALID_STATE: Serah terima yang ditolak tidak dapat diterima.';
  END IF;

  IF NOT public.has_project_write_access(v_tr.to_project_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Hanya tim proyek tujuan / Admin yang dapat menerima serah terima aset ini.';
  END IF;

  -- Kunci unit aset dan pindahkan custody ke proyek & PM tujuan secara atomik
  PERFORM 1 FROM public.equipment_units WHERE id = v_tr.unit_id FOR UPDATE;

  UPDATE public.equipment_units
  SET
    project_id = v_tr.to_project_id,
    custodian_user_id = COALESCE(v_tr.to_custodian_id, auth.uid()),
    custodian_name = v_tr.to_custodian_name,
    condition_status = v_tr.condition_at_handover
  WHERE id = v_tr.unit_id;

  UPDATE public.asset_custody_transfers
  SET
    status = 'Accepted',
    accepted_by = auth.uid(),
    accepted_at = NOW()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object(
    'transfer_id', p_transfer_id,
    'unit_id', v_tr.unit_id,
    'asset_tag', v_tr.asset_tag,
    'new_project_id', v_tr.to_project_id,
    'new_custodian', v_tr.to_custodian_name
  );
END;
$$;

-- 7. RLS Policies & Audit Triggers
ALTER TABLE public.equipment_rental_accruals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_e_accrual_select ON public.equipment_rental_accruals;
CREATE POLICY wave_e_accrual_select ON public.equipment_rental_accruals
  FOR SELECT TO authenticated USING (public.has_project_access(project_id));
DROP POLICY IF EXISTS wave_e_accrual_write ON public.equipment_rental_accruals;
CREATE POLICY wave_e_accrual_write ON public.equipment_rental_accruals
  FOR ALL TO authenticated
  USING (public.has_project_write_access(project_id))
  WITH CHECK (public.has_project_write_access(project_id));

ALTER TABLE public.asset_custody_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_e_custody_select ON public.asset_custody_transfers;
CREATE POLICY wave_e_custody_select ON public.asset_custody_transfers
  FOR SELECT TO authenticated
  USING (
    public.has_project_access(to_project_id)
    OR (from_project_id IS NOT NULL AND public.has_project_access(from_project_id))
  );
DROP POLICY IF EXISTS wave_e_custody_write ON public.asset_custody_transfers;
CREATE POLICY wave_e_custody_write ON public.asset_custody_transfers
  FOR ALL TO authenticated
  USING (
    public.has_project_write_access(to_project_id)
    OR (from_project_id IS NOT NULL AND public.has_project_write_access(from_project_id))
  )
  WITH CHECK (
    public.has_project_write_access(to_project_id)
    OR (from_project_id IS NOT NULL AND public.has_project_write_access(from_project_id))
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_log_audit_trigger') THEN
    DROP TRIGGER IF EXISTS trg_wave_e_audit_custody ON public.asset_custody_transfers;
    CREATE TRIGGER trg_wave_e_audit_custody
      AFTER INSERT OR UPDATE OR DELETE ON public.asset_custody_transfers
      FOR EACH ROW EXECUTE FUNCTION public.fn_log_audit_trigger();
  END IF;
END $$;

GRANT SELECT ON public.v_equipment_rental_health TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_post_daily_rental_accrual(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_accept_asset_custody_transfer(UUID) TO authenticated;

COMMIT;
