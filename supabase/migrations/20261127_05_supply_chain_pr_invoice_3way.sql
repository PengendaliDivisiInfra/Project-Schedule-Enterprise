-- ============================================================================
-- WAVE C (MIGRATION 05): SUPPLY CHAIN DOCUMENT CHAINING & THREE-WAY MATCHING
-- RAB/WBS -> Purchase Request (PR) -> Purchase Order (PO) -> GRN (GPS+Foto SJ) -> Vendor Invoice
-- Idempotent & Production-Safe untuk Project Schedule Enterprise (Supabase)
-- ============================================================================

BEGIN;

-- 1. Tabel Purchase Requests (PR) terikat WBS/RAB
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pr_number TEXT NOT NULL,
  wbs_code TEXT,
  requested_by UUID,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  needed_date DATE,
  justification TEXT,
  estimated_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Draft', 'Pending', 'Approved', 'Converted_to_PO', 'Rejected')),
  approval_chain JSONB NOT NULL DEFAULT '["Project Manager"]'::jsonb,
  current_approval_step INT NOT NULL DEFAULT 1,
  required_approval_steps INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  hsd_id UUID,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'Unit',
  requested_qty NUMERIC(18,4) NOT NULL DEFAULT 0,
  estimated_unit_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  estimated_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pr_project_status ON public.purchase_requests(project_id, status);
CREATE INDEX IF NOT EXISTS idx_pr_items_pr_id ON public.purchase_request_items(pr_id);

-- 2. Hubungkan Purchase Order ke Purchase Request (Document Chaining)
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS pr_id UUID REFERENCES public.purchase_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_po_pr_id ON public.purchase_orders(pr_id);

-- 3. Perluas Goods Receipts (GRN) dengan Bukti Fisik Digital (Foto Surat Jalan + Timestamp + GPS)
ALTER TABLE public.goods_receipts
  ADD COLUMN IF NOT EXISTS surat_jalan_url TEXT,
  ADD COLUMN IF NOT EXISTS gps_latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS gps_longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS gps_accuracy NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID;

-- 4. Tabel Vendor Invoices & Vendor Invoice Items (Three-Way Matching)
CREATE TABLE IF NOT EXISTS public.vendor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  invoiced_qty_total NUMERIC(18,4) NOT NULL DEFAULT 0,
  invoiced_subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  ppn_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  pph_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  invoiced_grand_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  invoice_file_url TEXT,
  price_tolerance_pct NUMERIC(6,2) NOT NULL DEFAULT 1.00,
  qty_match_ok BOOLEAN NOT NULL DEFAULT false,
  price_match_ok BOOLEAN NOT NULL DEFAULT false,
  evidence_match_ok BOOLEAN NOT NULL DEFAULT false,
  three_way_status TEXT NOT NULL DEFAULT 'PENDING_EVIDENCE' CHECK (three_way_status IN ('MATCHED', 'MISMATCH', 'PENDING_EVIDENCE')),
  match_notes TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Verified', 'Paid', 'Rejected')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vendor_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.vendor_invoices(id) ON DELETE CASCADE,
  po_item_id UUID REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
  hsd_id UUID,
  item_name TEXT NOT NULL,
  invoiced_qty NUMERIC(18,4) NOT NULL DEFAULT 0,
  invoiced_unit_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  invoiced_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vi_project_po ON public.vendor_invoices(project_id, po_id);
CREATE INDEX IF NOT EXISTS idx_vi_items_invoice_id ON public.vendor_invoice_items(invoice_id);

-- 5. Aktifkan RLS pada seluruh tabel Supply Chain baru
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_c_pr_select ON public.purchase_requests;
CREATE POLICY wave_c_pr_select ON public.purchase_requests
  FOR SELECT TO authenticated USING (public.has_project_access(project_id));
DROP POLICY IF EXISTS wave_c_pr_write ON public.purchase_requests;
CREATE POLICY wave_c_pr_write ON public.purchase_requests
  FOR ALL TO authenticated
  USING (public.has_project_write_access(project_id))
  WITH CHECK (public.has_project_write_access(project_id));

ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_c_pri_select ON public.purchase_request_items;
CREATE POLICY wave_c_pri_select ON public.purchase_request_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_requests pr WHERE pr.id = pr_id AND public.has_project_access(pr.project_id)));
DROP POLICY IF EXISTS wave_c_pri_write ON public.purchase_request_items;
CREATE POLICY wave_c_pri_write ON public.purchase_request_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_requests pr WHERE pr.id = pr_id AND public.has_project_write_access(pr.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_requests pr WHERE pr.id = pr_id AND public.has_project_write_access(pr.project_id)));

ALTER TABLE public.vendor_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_c_vi_select ON public.vendor_invoices;
CREATE POLICY wave_c_vi_select ON public.vendor_invoices
  FOR SELECT TO authenticated USING (public.has_project_access(project_id));
DROP POLICY IF EXISTS wave_c_vi_write ON public.vendor_invoices;
CREATE POLICY wave_c_vi_write ON public.vendor_invoices
  FOR ALL TO authenticated
  USING (public.has_project_write_access(project_id))
  WITH CHECK (public.has_project_write_access(project_id));

ALTER TABLE public.vendor_invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_c_vii_select ON public.vendor_invoice_items;
CREATE POLICY wave_c_vii_select ON public.vendor_invoice_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendor_invoices vi WHERE vi.id = invoice_id AND public.has_project_access(vi.project_id)));
DROP POLICY IF EXISTS wave_c_vii_write ON public.vendor_invoice_items;
CREATE POLICY wave_c_vii_write ON public.vendor_invoice_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendor_invoices vi WHERE vi.id = invoice_id AND public.has_project_write_access(vi.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_invoices vi WHERE vi.id = invoice_id AND public.has_project_write_access(vi.project_id)));

-- 6. Pasang Audit Trail Trigger (dari Wave A) pada tabel baru
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_log_audit_trigger') THEN
    DROP TRIGGER IF EXISTS trg_wave_c_audit_pr ON public.purchase_requests;
    CREATE TRIGGER trg_wave_c_audit_pr
      AFTER INSERT OR UPDATE OR DELETE ON public.purchase_requests
      FOR EACH ROW EXECUTE FUNCTION public.fn_log_audit_trigger();

    DROP TRIGGER IF EXISTS trg_wave_c_audit_vi ON public.vendor_invoices;
    CREATE TRIGGER trg_wave_c_audit_vi
      AFTER INSERT OR UPDATE OR DELETE ON public.vendor_invoices
      FOR EACH ROW EXECUTE FUNCTION public.fn_log_audit_trigger();
  END IF;
END $$;

COMMIT;
