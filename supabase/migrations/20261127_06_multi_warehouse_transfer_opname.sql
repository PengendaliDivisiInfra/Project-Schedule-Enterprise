-- ============================================================================
-- WAVE C (MIGRATION 06): MULTI-WAREHOUSE (PUSAT VS SITE),
-- MATERIAL TRANSFER REQUEST (SITE-TO-SITE + COST REALLOCATION) & STOCK OPNAME
-- Idempotent & Production-Safe untuk Project Schedule Enterprise (Supabase)
-- ============================================================================

BEGIN;

-- 1. Tabel Master Gudang Multi-Lokasi (Gudang Pusat vs Gudang Site Proyek)
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  warehouse_type TEXT NOT NULL DEFAULT 'SITE' CHECK (warehouse_type IN ('CENTRAL', 'SITE')),
  location TEXT,
  pic_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_project_type ON public.warehouses(project_id, warehouse_type);

-- Seed 1 Gudang Pusat (Central) default bila belum ada
INSERT INTO public.warehouses (project_id, code, name, warehouse_type, location, pic_name)
SELECT NULL, 'WH-CENTRAL-01', 'Gudang Pusat (Kantor Pusat)', 'CENTRAL', 'Pool & Logistik Pusat', 'Kepala Logistik Pusat'
WHERE NOT EXISTS (
  SELECT 1 FROM public.warehouses WHERE warehouse_type = 'CENTRAL'
);

-- Hubungkan inventory_materials ke master warehouses
ALTER TABLE public.inventory_materials
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warehouse_type TEXT NOT NULL DEFAULT 'SITE';

-- 2. Tabel Material Transfer Request (Antar-Proyek / Pusat-ke-Site)
CREATE TABLE IF NOT EXISTS public.material_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number TEXT NOT NULL,
  source_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  target_project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  target_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  hsd_id UUID NOT NULL,
  quantity NUMERIC(18,4) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In_Transit', 'Received', 'Rejected')),
  requested_by UUID,
  approved_by UUID,
  received_by UUID,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mtr_source_target ON public.material_transfers(source_project_id, target_project_id, status);

-- 3. Tabel Stock Opname Berkala
CREATE TABLE IF NOT EXISTS public.stock_opnames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  opname_number TEXT NOT NULL,
  opname_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved')),
  conducted_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  total_variance_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_opname_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id UUID NOT NULL REFERENCES public.stock_opnames(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES public.inventory_materials(id) ON DELETE SET NULL,
  hsd_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'Unit',
  system_qty NUMERIC(18,4) NOT NULL DEFAULT 0,
  physical_qty NUMERIC(18,4) NOT NULL DEFAULT 0,
  variance_qty NUMERIC(18,4) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  variance_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opname_project ON public.stock_opnames(project_id, opname_date DESC);
CREATE INDEX IF NOT EXISTS idx_opname_items_opname_id ON public.stock_opname_items(opname_id);

-- 4. RPC Atomik Eksekusi Material Transfer Request (Pindah Stok + Pindah Beban Biaya Antar-Proyek)
CREATE OR REPLACE FUNCTION public.rpc_execute_material_transfer(
  p_transfer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tr public.material_transfers%ROWTYPE;
  v_src_inv public.inventory_materials%ROWTYPE;
  v_tgt_inv public.inventory_materials%ROWTYPE;
  v_total_cost NUMERIC(18,2);
  v_src_trx_id UUID;
  v_tgt_trx_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Sesi login diperlukan.';
  END IF;

  SELECT * INTO v_tr
  FROM public.material_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Dokumen Material Transfer tidak ditemukan.';
  END IF;

  IF v_tr.status = 'Received' THEN
    RAISE EXCEPTION 'ALREADY_RECEIVED: Transfer material ini sudah dieksekusi sebelumnya.';
  END IF;

  IF v_tr.status = 'Rejected' THEN
    RAISE EXCEPTION 'INVALID_STATE: Transfer yang sudah ditolak tidak dapat dieksekusi.';
  END IF;

  v_total_cost := COALESCE(NULLIF(v_tr.total_cost, 0), v_tr.quantity * v_tr.unit_cost);

  -- A. Kurangi stok di proyek asal (jika site-to-site) dengan SELECT ... FOR UPDATE
  IF v_tr.source_project_id IS NOT NULL THEN
    SELECT * INTO v_src_inv
    FROM public.inventory_materials
    WHERE project_id = v_tr.source_project_id AND hsd_id = v_tr.hsd_id
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND OR COALESCE(v_src_inv.stok_on_hand, 0) < v_tr.quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: Stok proyek asal tidak mencukupi (tersedia %, diminta %).',
        COALESCE(v_src_inv.stok_on_hand, 0), v_tr.quantity;
    END IF;

    UPDATE public.inventory_materials
    SET stok_on_hand = stok_on_hand - v_tr.quantity,
        updated_at = NOW()
    WHERE id = v_src_inv.id;

    INSERT INTO public.inventory_transactions (
      inventory_id, type, quantity, reference, notes, transaction_date
    ) VALUES (
      v_src_inv.id, 'OUT', v_tr.quantity, v_tr.transfer_number,
      'Transfer Keluar (MTR) ke Proyek Tujuan: ' || COALESCE(v_tr.notes, '-'),
      CURRENT_DATE
    ) RETURNING id INTO v_src_trx_id;

    -- Kurangi beban biaya proyek asal (realokasi biaya negatif)
    IF v_total_cost > 0 THEN
      INSERT INTO public.actual_costs (
        project_id, task_id, resource_type, cost_amount, source_id, reference_type, recorded_at
      ) VALUES (
        v_tr.source_project_id, NULL, 'Material', -v_total_cost, v_src_trx_id, 'material_transfer_out', NOW()
      );
    END IF;
  END IF;

  -- B. Tambah stok di proyek tujuan
  SELECT * INTO v_tgt_inv
  FROM public.inventory_materials
  WHERE project_id = v_tr.target_project_id AND hsd_id = v_tr.hsd_id
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.inventory_materials (
      project_id, hsd_id, stok_on_hand, stok_minimum, lokasi_gudang, warehouse_id, warehouse_type
    ) VALUES (
      v_tr.target_project_id, v_tr.hsd_id, v_tr.quantity, 0, 'Gudang Site', v_tr.target_warehouse_id, 'SITE'
    ) RETURNING * INTO v_tgt_inv;
  ELSE
    UPDATE public.inventory_materials
    SET stok_on_hand = stok_on_hand + v_tr.quantity,
        updated_at = NOW()
    WHERE id = v_tgt_inv.id;
  END IF;

  INSERT INTO public.inventory_transactions (
    inventory_id, type, quantity, reference, notes, transaction_date
  ) VALUES (
    v_tgt_inv.id, 'IN', v_tr.quantity, v_tr.transfer_number,
    'Transfer Masuk (MTR): ' || COALESCE(v_tr.notes, '-'),
    CURRENT_DATE
  ) RETURNING id INTO v_tgt_trx_id;

  -- Bebankan biaya material ke proyek tujuan
  IF v_total_cost > 0 THEN
    INSERT INTO public.actual_costs (
      project_id, task_id, resource_type, cost_amount, source_id, reference_type, recorded_at
    ) VALUES (
      v_tr.target_project_id, NULL, 'Material', v_total_cost, v_tgt_trx_id, 'material_transfer_in', NOW()
    );
  END IF;

  -- C. Finalisasi status transfer
  UPDATE public.material_transfers
  SET
    status = 'Received',
    total_cost = v_total_cost,
    received_by = auth.uid(),
    received_at = NOW(),
    updated_at = NOW()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object(
    'transfer_id', p_transfer_id,
    'status', 'Received',
    'reallocated_cost', v_total_cost
  );
END;
$$;

-- 5. RPC Atomik Persetujuan Stock Opname (Penyesuaian Stok Fisik)
CREATE OR REPLACE FUNCTION public.rpc_approve_stock_opname(
  p_opname_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op public.stock_opnames%ROWTYPE;
  v_item RECORD;
  v_inv_id UUID;
  v_adj_count INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Sesi login diperlukan.';
  END IF;

  SELECT * INTO v_op
  FROM public.stock_opnames
  WHERE id = p_opname_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Dokumen Stock Opname tidak ditemukan.';
  END IF;

  IF NOT public.is_project_approver(v_op.project_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Hanya Approver / PM / Owner yang dapat menyetujui Stock Opname.';
  END IF;

  IF v_op.status = 'Approved' THEN
    RAISE EXCEPTION 'ALREADY_APPROVED: Stock Opname ini sudah disetujui.';
  END IF;

  FOR v_item IN
    SELECT * FROM public.stock_opname_items WHERE opname_id = p_opname_id
  LOOP
    IF COALESCE(v_item.variance_qty, 0) <> 0 THEN
      v_inv_id := v_item.inventory_id;

      IF v_inv_id IS NULL THEN
        SELECT id INTO v_inv_id
        FROM public.inventory_materials
        WHERE project_id = v_op.project_id AND hsd_id = v_item.hsd_id
        LIMIT 1
        FOR UPDATE;
      ELSE
        PERFORM 1 FROM public.inventory_materials WHERE id = v_inv_id FOR UPDATE;
      END IF;

      IF v_inv_id IS NULL THEN
        INSERT INTO public.inventory_materials (project_id, hsd_id, stok_on_hand, stok_minimum, warehouse_id)
        VALUES (v_op.project_id, v_item.hsd_id, v_item.physical_qty, 0, v_op.warehouse_id)
        RETURNING id INTO v_inv_id;
      ELSE
        UPDATE public.inventory_materials
        SET stok_on_hand = v_item.physical_qty,
            updated_at = NOW()
        WHERE id = v_inv_id;
      END IF;

      INSERT INTO public.inventory_transactions (
        inventory_id, type, quantity, reference, notes, transaction_date
      ) VALUES (
        v_inv_id,
        CASE WHEN v_item.variance_qty > 0 THEN 'IN' ELSE 'OUT' END,
        ABS(v_item.variance_qty),
        v_op.opname_number,
        'Penyesuaian Stock Opname (' || v_item.system_qty || ' -> ' || v_item.physical_qty || ')',
        v_op.opname_date
      );

      v_adj_count := v_adj_count + 1;
    END IF;
  END LOOP;

  UPDATE public.stock_opnames
  SET status = 'Approved',
      approved_by = auth.uid(),
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_opname_id;

  RETURN jsonb_build_object(
    'opname_id', p_opname_id,
    'status', 'Approved',
    'adjusted_items', v_adj_count
  );
END;
$$;

-- 6. RLS Policies untuk Multi-Warehouse, Material Transfer, & Stock Opname
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_c_wh_select ON public.warehouses;
CREATE POLICY wave_c_wh_select ON public.warehouses
  FOR SELECT TO authenticated
  USING (project_id IS NULL OR public.has_project_access(project_id));
DROP POLICY IF EXISTS wave_c_wh_write ON public.warehouses;
CREATE POLICY wave_c_wh_write ON public.warehouses
  FOR ALL TO authenticated
  USING ((project_id IS NULL AND public.is_corporate_admin()) OR (project_id IS NOT NULL AND public.has_project_write_access(project_id)))
  WITH CHECK ((project_id IS NULL AND public.is_corporate_admin()) OR (project_id IS NOT NULL AND public.has_project_write_access(project_id)));

ALTER TABLE public.material_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_c_mtr_select ON public.material_transfers;
CREATE POLICY wave_c_mtr_select ON public.material_transfers
  FOR SELECT TO authenticated
  USING (
    public.has_project_access(target_project_id)
    OR (source_project_id IS NOT NULL AND public.has_project_access(source_project_id))
  );
DROP POLICY IF EXISTS wave_c_mtr_write ON public.material_transfers;
CREATE POLICY wave_c_mtr_write ON public.material_transfers
  FOR ALL TO authenticated
  USING (
    public.has_project_write_access(target_project_id)
    OR (source_project_id IS NOT NULL AND public.has_project_write_access(source_project_id))
  )
  WITH CHECK (
    public.has_project_write_access(target_project_id)
    OR (source_project_id IS NOT NULL AND public.has_project_write_access(source_project_id))
  );

ALTER TABLE public.stock_opnames ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_c_opname_select ON public.stock_opnames;
CREATE POLICY wave_c_opname_select ON public.stock_opnames
  FOR SELECT TO authenticated USING (public.has_project_access(project_id));
DROP POLICY IF EXISTS wave_c_opname_write ON public.stock_opnames;
CREATE POLICY wave_c_opname_write ON public.stock_opnames
  FOR ALL TO authenticated
  USING (public.has_project_write_access(project_id))
  WITH CHECK (public.has_project_write_access(project_id));

ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_c_opitem_select ON public.stock_opname_items;
CREATE POLICY wave_c_opitem_select ON public.stock_opname_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stock_opnames o WHERE o.id = opname_id AND public.has_project_access(o.project_id)));
DROP POLICY IF EXISTS wave_c_opitem_write ON public.stock_opname_items;
CREATE POLICY wave_c_opitem_write ON public.stock_opname_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stock_opnames o WHERE o.id = opname_id AND public.has_project_write_access(o.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stock_opnames o WHERE o.id = opname_id AND public.has_project_write_access(o.project_id)));

GRANT EXECUTE ON FUNCTION public.rpc_execute_material_transfer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_approve_stock_opname(UUID) TO authenticated;

COMMIT;
