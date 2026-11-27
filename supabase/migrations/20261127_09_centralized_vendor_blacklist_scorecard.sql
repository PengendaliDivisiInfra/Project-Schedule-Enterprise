-- ============================================================================
-- WAVE E (MIGRATION 09): CENTRALIZED VENDOR MASTER, BLACKLIST & NPWP/PKP GUARD,
-- DAN VENDOR PERFORMANCE SCORECARD (LINTAS PROYEK)
-- Idempotent & Production-Safe untuk Project Schedule Enterprise (Supabase)
-- ============================================================================

BEGIN;

-- 1. Perluas tabel vendors agar mendukung Master Terpusat, Blacklist, & Kepatuhan Pajak/Legal
ALTER TABLE public.vendors
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS is_centralized BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vendor_code TEXT,
  ADD COLUMN IF NOT EXISTS npwp_number TEXT,
  ADD COLUMN IF NOT EXISTS pkp_status TEXT NOT NULL DEFAULT 'NON_PKP',
  ADD COLUMN IF NOT EXISTS pkp_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS legal_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blacklist_reason TEXT,
  ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blacklisted_by UUID;

-- 2. Perluas tabel subcontractors dengan kontrol Blacklist & Legal/Pajak yang sama
ALTER TABLE public.subcontractors
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.subcontractors
  ADD COLUMN IF NOT EXISTS is_centralized BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS npwp_number TEXT,
  ADD COLUMN IF NOT EXISTS pkp_status TEXT NOT NULL DEFAULT 'NON_PKP',
  ADD COLUMN IF NOT EXISTS pkp_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS legal_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blacklist_reason TEXT,
  ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blacklisted_by UUID;

CREATE INDEX IF NOT EXISTS idx_vendors_blacklist_central ON public.vendors(is_blacklisted, is_centralized);
CREATE INDEX IF NOT EXISTS idx_subcontractors_blacklist ON public.subcontractors(is_blacklisted, is_centralized);

-- 3. Perbarui RLS vendors & subcontractors agar seluruh PM dapat membaca Master Terpusat
DROP POLICY IF EXISTS wave_a_select ON public.vendors;
DROP POLICY IF EXISTS wave_e_vendors_select ON public.vendors;
CREATE POLICY wave_e_vendors_select ON public.vendors
  FOR SELECT TO authenticated
  USING (
    project_id IS NULL
    OR is_centralized = true
    OR public.has_project_access(project_id)
  );

DROP POLICY IF EXISTS wave_a_update ON public.vendors;
DROP POLICY IF EXISTS wave_e_vendors_update ON public.vendors;
CREATE POLICY wave_e_vendors_update ON public.vendors
  FOR UPDATE TO authenticated
  USING (
    public.is_corporate_admin()
    OR public.get_my_global_role() IN ('central procurement', 'central_procurement', 'finance manager', 'finance_manager')
    OR (project_id IS NOT NULL AND public.has_project_write_access(project_id))
  )
  WITH CHECK (
    public.is_corporate_admin()
    OR public.get_my_global_role() IN ('central procurement', 'central_procurement', 'finance manager', 'finance_manager')
    OR (project_id IS NOT NULL AND public.has_project_write_access(project_id))
  );

DROP POLICY IF EXISTS wave_a_select ON public.subcontractors;
DROP POLICY IF EXISTS wave_e_subcons_select ON public.subcontractors;
CREATE POLICY wave_e_subcons_select ON public.subcontractors
  FOR SELECT TO authenticated
  USING (
    project_id IS NULL
    OR is_centralized = true
    OR public.has_project_access(project_id)
  );

-- 4. Database-Level Hard-Block Trigger: Blokir Pembuatan PO ke Vendor Blacklist / Pajak Kedaluwarsa
CREATE OR REPLACE FUNCTION public.fn_assert_vendor_compliant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  -- Izinkan pembatalan/Void atau update status pembayaran PO historis tanpa re-block
  IF TG_OP = 'UPDATE' AND (
    COALESCE(NEW.status, '') = 'Void'
    OR (NEW.vendor_id = OLD.vendor_id AND NEW.status = OLD.status)
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.vendor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name, is_blacklisted, blacklist_reason, pkp_status, pkp_expiry_date, legal_expiry_date
  INTO v_rec
  FROM public.vendors
  WHERE id = NEW.vendor_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_rec.is_blacklisted, false) = true THEN
    RAISE EXCEPTION 'VENDOR_BLOCKED: Vendor "%" sedang dalam status BLACKLIST (%). Pembuatan PO diblokir otomatis di seluruh proyek.',
      v_rec.name, COALESCE(NULLIF(v_rec.blacklist_reason, ''), 'Pelanggaran kepatuhan');
  END IF;

  IF UPPER(COALESCE(v_rec.pkp_status, 'NON_PKP')) = 'PKP'
     AND v_rec.pkp_expiry_date IS NOT NULL
     AND v_rec.pkp_expiry_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'VENDOR_BLOCKED: Status PKP / NPWP vendor "%" telah kedaluwarsa sejak %. Hubungi tim Central Procurement.',
      v_rec.name, TO_CHAR(v_rec.pkp_expiry_date, 'YYYY-MM-DD');
  END IF;

  IF v_rec.legal_expiry_date IS NOT NULL AND v_rec.legal_expiry_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'VENDOR_BLOCKED: Dokumen legalitas vendor "%" telah kedaluwarsa sejak %. Hubungi tim Central Procurement.',
      v_rec.name, TO_CHAR(v_rec.legal_expiry_date, 'YYYY-MM-DD');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wave_e_po_vendor_guard ON public.purchase_orders;
CREATE TRIGGER trg_wave_e_po_vendor_guard
  BEFORE INSERT OR UPDATE OF vendor_id ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_assert_vendor_compliant();

-- 5. Database-Level Hard-Block Trigger: Blokir Pembuatan SPK ke Subkontraktor Blacklist / Pajak Kedaluwarsa
CREATE OR REPLACE FUNCTION public.fn_assert_subcon_compliant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s_rec RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    COALESCE(NEW.status, '') = 'Void'
    OR NEW.subcontractor_id = OLD.subcontractor_id
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.subcontractor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT company_name, is_blacklisted, blacklist_reason, pkp_status, pkp_expiry_date, legal_expiry_date
  INTO s_rec
  FROM public.subcontractors
  WHERE id = NEW.subcontractor_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF COALESCE(s_rec.is_blacklisted, false) = true THEN
    RAISE EXCEPTION 'SUBCON_BLOCKED: Subkontraktor "%" sedang BLACKLIST (%). Pembuatan SPK diblokir otomatis.',
      s_rec.company_name, COALESCE(NULLIF(s_rec.blacklist_reason, ''), 'Pelanggaran kepatuhan');
  END IF;

  IF UPPER(COALESCE(s_rec.pkp_status, 'NON_PKP')) = 'PKP'
     AND s_rec.pkp_expiry_date IS NOT NULL
     AND s_rec.pkp_expiry_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'SUBCON_BLOCKED: PKP subkontraktor "%" telah kedaluwarsa sejak %.',
      s_rec.company_name, TO_CHAR(s_rec.pkp_expiry_date, 'YYYY-MM-DD');
  END IF;

  IF s_rec.legal_expiry_date IS NOT NULL AND s_rec.legal_expiry_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'SUBCON_BLOCKED: Dokumen legalitas/SBU subkontraktor "%" kedaluwarsa sejak %.',
      s_rec.company_name, TO_CHAR(s_rec.legal_expiry_date, 'YYYY-MM-DD');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wave_e_spk_subcon_guard ON public.subcontractor_contracts;
CREATE TRIGGER trg_wave_e_spk_subcon_guard
  BEFORE INSERT OR UPDATE OF subcontractor_id ON public.subcontractor_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_assert_subcon_compliant();

-- 6. Tabel Vendor & Subcontractor Performance Scorecard (Lintas Proyek)
CREATE TABLE IF NOT EXISTS public.vendor_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL DEFAULT 'VENDOR' CHECK (entity_type IN ('VENDOR', 'SUBCONTRACTOR')),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  subcontractor_id UUID REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  delivery_score NUMERIC(3,2) NOT NULL CHECK (delivery_score >= 1 AND delivery_score <= 5),
  quality_score NUMERIC(3,2) NOT NULL CHECK (quality_score >= 1 AND quality_score <= 5),
  safety_score NUMERIC(3,2) NOT NULL CHECK (safety_score >= 1 AND safety_score <= 5),
  overall_score NUMERIC(4,2) NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D')),
  recommendation TEXT NOT NULL DEFAULT 'APPROVED',
  evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  evaluated_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_scorecards_vendor ON public.vendor_scorecards(vendor_id, evaluation_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_scorecards_subcon ON public.vendor_scorecards(subcontractor_id, evaluation_date DESC);

-- View Ringkasan Rata-Rata Scorecard Lintas Proyek
CREATE OR REPLACE VIEW public.v_vendor_scorecard_summary AS
SELECT
  entity_type,
  COALESCE(vendor_id, subcontractor_id) AS entity_id,
  MAX(vendor_name) AS vendor_name,
  COUNT(*)::INT AS evaluation_count,
  ROUND(AVG(delivery_score), 2)::NUMERIC(4,2) AS avg_delivery_score,
  ROUND(AVG(quality_score), 2)::NUMERIC(4,2) AS avg_quality_score,
  ROUND(AVG(safety_score), 2)::NUMERIC(4,2) AS avg_safety_score,
  ROUND(AVG(overall_score), 2)::NUMERIC(4,2) AS avg_overall_score,
  CASE
    WHEN AVG(overall_score) >= 4.25 THEN 'A'
    WHEN AVG(overall_score) >= 3.50 THEN 'B'
    WHEN AVG(overall_score) >= 2.50 THEN 'C'
    ELSE 'D'
  END AS avg_grade,
  MAX(evaluation_date) AS last_evaluated_at
FROM public.vendor_scorecards
GROUP BY entity_type, COALESCE(vendor_id, subcontractor_id);

-- RLS & Audit Trigger Scorecard
ALTER TABLE public.vendor_scorecards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wave_e_scorecard_select ON public.vendor_scorecards;
CREATE POLICY wave_e_scorecard_select ON public.vendor_scorecards
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS wave_e_scorecard_write ON public.vendor_scorecards;
CREATE POLICY wave_e_scorecard_write ON public.vendor_scorecards
  FOR ALL TO authenticated
  USING (public.has_project_write_access(project_id))
  WITH CHECK (public.has_project_write_access(project_id));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_log_audit_trigger') THEN
    DROP TRIGGER IF EXISTS trg_wave_e_audit_scorecard ON public.vendor_scorecards;
    CREATE TRIGGER trg_wave_e_audit_scorecard
      AFTER INSERT OR UPDATE OR DELETE ON public.vendor_scorecards
      FOR EACH ROW EXECUTE FUNCTION public.fn_log_audit_trigger();
  END IF;
END $$;

GRANT SELECT ON public.v_vendor_scorecard_summary TO authenticated;

COMMIT;
