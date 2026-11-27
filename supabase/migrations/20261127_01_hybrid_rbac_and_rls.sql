-- ============================================================================
-- WAVE A (MIGRATION 01): HYBRID RBAC (GLOBAL + PROJECT ROLE) & TABLE-WIDE RLS
-- Idempotent & Production-Safe untuk Project Schedule Enterprise (Supabase)
-- ============================================================================

BEGIN;

-- 1. Pastikan kolom global_role tersedia di public.profiles (sinkron dengan kolom role lama)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS global_role TEXT DEFAULT 'User';

UPDATE public.profiles
SET global_role = CASE
  WHEN LOWER(COALESCE(role, '')) = 'owner' THEN 'Owner'
  WHEN LOWER(COALESCE(role, '')) IN ('super admin', 'super_admin') THEN 'Super Admin'
  WHEN LOWER(COALESCE(role, '')) IN ('finance manager', 'finance_manager') THEN 'Finance Manager'
  WHEN LOWER(COALESCE(role, '')) IN ('central procurement', 'central_procurement') THEN 'Central Procurement'
  WHEN LOWER(COALESCE(role, '')) = 'auditor' THEN 'Auditor'
  ELSE COALESCE(NULLIF(TRIM(global_role), ''), 'User')
END
WHERE global_role IS NULL OR global_role = 'User';

CREATE INDEX IF NOT EXISTS idx_profiles_global_role ON public.profiles(global_role);
CREATE INDEX IF NOT EXISTS idx_project_members_user_project ON public.project_members(user_id, project_id);

-- 2. Helper Functions (SECURITY DEFINER agar bebas rekursi RLS)
CREATE OR REPLACE FUNCTION public.get_my_global_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LOWER(TRIM(COALESCE(
    NULLIF(global_role, ''),
    NULLIF(role, ''),
    'user'
  )))
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_corporate_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_my_global_role() IN ('owner', 'super admin', 'super_admin'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_corporate_global_reader()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.get_my_global_role() IN (
      'owner',
      'super admin', 'super_admin',
      'finance manager', 'finance_manager',
      'central procurement', 'central_procurement',
      'auditor'
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_auditor_readonly()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_my_global_role() = 'auditor', false);
$$;

CREATE OR REPLACE FUNCTION public.has_project_access(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR p_project_id IS NULL THEN false
    WHEN public.is_corporate_global_reader() THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = p_project_id AND p.owner_id = auth.uid()
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = p_project_id
        AND pm.user_id = auth.uid()
        AND LOWER(COALESCE(pm.role, '')) <> 'guest'
    ) THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_project_write_access(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR p_project_id IS NULL THEN false
    WHEN public.is_auditor_readonly() THEN false
    WHEN public.is_corporate_admin() THEN true
    WHEN public.get_my_global_role() IN ('finance manager', 'finance_manager', 'central procurement', 'central_procurement') THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = p_project_id AND p.owner_id = auth.uid()
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = p_project_id
        AND pm.user_id = auth.uid()
        AND LOWER(COALESCE(pm.role, '')) NOT IN ('guest', 'viewer')
    ) THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_project_approver(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR p_project_id IS NULL THEN false
    WHEN public.is_auditor_readonly() THEN false
    WHEN public.is_corporate_admin() THEN true
    WHEN public.get_my_global_role() IN ('finance manager', 'finance_manager') THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = p_project_id AND p.owner_id = auth.uid()
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = p_project_id
        AND pm.user_id = auth.uid()
        AND LOWER(COALESCE(pm.role, '')) IN ('owner', 'pm', 'project manager')
    ) THEN true
    ELSE false
  END;
$$;

-- 3. RLS pada Tabel Inti: profiles, projects, project_members
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_a_profiles_select ON public.profiles;
CREATE POLICY wave_a_profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS wave_a_profiles_update ON public.profiles;
CREATE POLICY wave_a_profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_corporate_admin())
  WITH CHECK (id = auth.uid() OR public.is_corporate_admin());

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_a_projects_select ON public.projects;
CREATE POLICY wave_a_projects_select ON public.projects
  FOR SELECT TO authenticated
  USING (public.has_project_access(id));

DROP POLICY IF EXISTS wave_a_projects_insert ON public.projects;
CREATE POLICY wave_a_projects_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_auditor_readonly());

DROP POLICY IF EXISTS wave_a_projects_update ON public.projects;
CREATE POLICY wave_a_projects_update ON public.projects
  FOR UPDATE TO authenticated
  USING (public.is_project_approver(id))
  WITH CHECK (public.is_project_approver(id));

DROP POLICY IF EXISTS wave_a_projects_delete ON public.projects;
CREATE POLICY wave_a_projects_delete ON public.projects
  FOR DELETE TO authenticated
  USING (public.is_corporate_admin() OR owner_id = auth.uid());

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave_a_pm_select ON public.project_members;
CREATE POLICY wave_a_pm_select ON public.project_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_project_access(project_id));

DROP POLICY IF EXISTS wave_a_pm_insert ON public.project_members;
CREATE POLICY wave_a_pm_insert ON public.project_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_approver(project_id));

DROP POLICY IF EXISTS wave_a_pm_update ON public.project_members;
CREATE POLICY wave_a_pm_update ON public.project_members
  FOR UPDATE TO authenticated
  USING (public.is_project_approver(project_id))
  WITH CHECK (public.is_project_approver(project_id));

DROP POLICY IF EXISTS wave_a_pm_delete ON public.project_members;
CREATE POLICY wave_a_pm_delete ON public.project_members
  FOR DELETE TO authenticated
  USING (public.is_project_approver(project_id));

-- 4. Terapkan RLS Otomatis ke SELURUH Tabel Transaksi yang Memiliki Kolom project_id
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'project_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('project_members', 'audit_logs')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.table_name);

    EXECUTE format('DROP POLICY IF EXISTS wave_a_select ON public.%I;', tbl.table_name);
    EXECUTE format(
      'CREATE POLICY wave_a_select ON public.%I FOR SELECT TO authenticated USING (project_id IS NULL OR public.has_project_access(project_id));',
      tbl.table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS wave_a_insert ON public.%I;', tbl.table_name);
    EXECUTE format(
      'CREATE POLICY wave_a_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (project_id IS NULL OR public.has_project_write_access(project_id));',
      tbl.table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS wave_a_update ON public.%I;', tbl.table_name);
    EXECUTE format(
      'CREATE POLICY wave_a_update ON public.%I FOR UPDATE TO authenticated USING (project_id IS NULL OR public.has_project_write_access(project_id)) WITH CHECK (project_id IS NULL OR public.has_project_write_access(project_id));',
      tbl.table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS wave_a_delete ON public.%I;', tbl.table_name);
    EXECUTE format(
      'CREATE POLICY wave_a_delete ON public.%I FOR DELETE TO authenticated USING (project_id IS NULL OR public.is_project_approver(project_id));',
      tbl.table_name
    );
  END LOOP;
END $$;

-- 5. RLS Tabel Anak (Child Tables) yang Merujuk ke Parent Ber-project_id
DO $$
BEGIN
  -- purchase_order_items -> purchase_orders
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='purchase_order_items') THEN
    ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS wave_a_child_select ON public.purchase_order_items;
    CREATE POLICY wave_a_child_select ON public.purchase_order_items FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND public.has_project_access(po.project_id)));
    DROP POLICY IF EXISTS wave_a_child_write ON public.purchase_order_items;
    CREATE POLICY wave_a_child_write ON public.purchase_order_items FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND public.has_project_write_access(po.project_id)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND public.has_project_write_access(po.project_id)));
  END IF;

  -- goods_receipts -> purchase_order_items -> purchase_orders
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='goods_receipts') THEN
    ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS wave_a_child_select ON public.goods_receipts;
    CREATE POLICY wave_a_child_select ON public.goods_receipts FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.purchase_order_items poi
        JOIN public.purchase_orders po ON po.id = poi.po_id
        WHERE poi.id = po_item_id AND public.has_project_access(po.project_id)
      ));
    DROP POLICY IF EXISTS wave_a_child_write ON public.goods_receipts;
    CREATE POLICY wave_a_child_write ON public.goods_receipts FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.purchase_order_items poi
        JOIN public.purchase_orders po ON po.id = poi.po_id
        WHERE poi.id = po_item_id AND public.has_project_write_access(po.project_id)
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.purchase_order_items poi
        JOIN public.purchase_orders po ON po.id = poi.po_id
        WHERE poi.id = po_item_id AND public.has_project_write_access(po.project_id)
      ));
  END IF;

  -- inventory_transactions -> inventory_materials
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inventory_transactions') THEN
    ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS wave_a_child_select ON public.inventory_transactions;
    CREATE POLICY wave_a_child_select ON public.inventory_transactions FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.inventory_materials im WHERE im.id = inventory_id AND public.has_project_access(im.project_id)));
    DROP POLICY IF EXISTS wave_a_child_write ON public.inventory_transactions;
    CREATE POLICY wave_a_child_write ON public.inventory_transactions FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.inventory_materials im WHERE im.id = inventory_id AND public.has_project_write_access(im.project_id)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.inventory_materials im WHERE im.id = inventory_id AND public.has_project_write_access(im.project_id)));
  END IF;

  -- payroll_items -> payrolls
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payroll_items') THEN
    ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS wave_a_child_select ON public.payroll_items;
    CREATE POLICY wave_a_child_select ON public.payroll_items FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.payrolls p WHERE p.id = payroll_id AND public.has_project_access(p.project_id)));
    DROP POLICY IF EXISTS wave_a_child_write ON public.payroll_items;
    CREATE POLICY wave_a_child_write ON public.payroll_items FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.payrolls p WHERE p.id = payroll_id AND public.has_project_write_access(p.project_id)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.payrolls p WHERE p.id = payroll_id AND public.has_project_write_access(p.project_id)));
  END IF;

  -- employee_attendances -> employees
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='employee_attendances') THEN
    ALTER TABLE public.employee_attendances ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS wave_a_child_select ON public.employee_attendances;
    CREATE POLICY wave_a_child_select ON public.employee_attendances FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.has_project_access(e.project_id)));
    DROP POLICY IF EXISTS wave_a_child_write ON public.employee_attendances;
    CREATE POLICY wave_a_child_write ON public.employee_attendances FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.has_project_write_access(e.project_id)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.has_project_write_access(e.project_id)));
  END IF;

  -- daily_progress -> wbs_tasks
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_progress') THEN
    ALTER TABLE public.daily_progress ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS wave_a_child_select ON public.daily_progress;
    CREATE POLICY wave_a_child_select ON public.daily_progress FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.wbs_tasks wt WHERE wt.id = task_id AND public.has_project_access(wt.project_id)));
    DROP POLICY IF EXISTS wave_a_child_write ON public.daily_progress;
    CREATE POLICY wave_a_child_write ON public.daily_progress FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.wbs_tasks wt WHERE wt.id = task_id AND public.has_project_write_access(wt.project_id)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.wbs_tasks wt WHERE wt.id = task_id AND public.has_project_write_access(wt.project_id)));
  END IF;

  -- subcontractor_spk_items & subcon_opnames -> subcontractor_contracts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subcontractor_spk_items') THEN
    ALTER TABLE public.subcontractor_spk_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS wave_a_child_select ON public.subcontractor_spk_items;
    CREATE POLICY wave_a_child_select ON public.subcontractor_spk_items FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.subcontractor_contracts sc WHERE sc.id = contract_id AND public.has_project_access(sc.project_id)));
    DROP POLICY IF EXISTS wave_a_child_write ON public.subcontractor_spk_items;
    CREATE POLICY wave_a_child_write ON public.subcontractor_spk_items FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.subcontractor_contracts sc WHERE sc.id = contract_id AND public.has_project_write_access(sc.project_id)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.subcontractor_contracts sc WHERE sc.id = contract_id AND public.has_project_write_access(sc.project_id)));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subcon_opnames') THEN
    ALTER TABLE public.subcon_opnames ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS wave_a_child_select ON public.subcon_opnames;
    CREATE POLICY wave_a_child_select ON public.subcon_opnames FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.subcontractor_contracts sc WHERE sc.id = contract_id AND public.has_project_access(sc.project_id)));
    DROP POLICY IF EXISTS wave_a_child_write ON public.subcon_opnames;
    CREATE POLICY wave_a_child_write ON public.subcon_opnames FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.subcontractor_contracts sc WHERE sc.id = contract_id AND public.has_project_write_access(sc.project_id)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.subcontractor_contracts sc WHERE sc.id = contract_id AND public.has_project_write_access(sc.project_id)));
  END IF;

  -- equipment_bar_items -> equipment_bars
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='equipment_bar_items') THEN
    ALTER TABLE public.equipment_bar_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS wave_a_child_select ON public.equipment_bar_items;
    CREATE POLICY wave_a_child_select ON public.equipment_bar_items FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.equipment_bars eb WHERE eb.id = bar_id AND public.has_project_access(eb.project_id)));
    DROP POLICY IF EXISTS wave_a_child_write ON public.equipment_bar_items;
    CREATE POLICY wave_a_child_write ON public.equipment_bar_items FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.equipment_bars eb WHERE eb.id = bar_id AND public.has_project_write_access(eb.project_id)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.equipment_bars eb WHERE eb.id = bar_id AND public.has_project_write_access(eb.project_id)));
  END IF;
END $$;

-- 6. Ubah Bucket Dokumen Sensitif Menjadi PRIVATE (Wajib Signed URL 10 Menit)
UPDATE storage.buckets
SET public = false
WHERE id IN ('project-vault', 'evidence', 'ktp_documents');

-- Pastikan user terautentikasi dapat membaca & mengunggah ke bucket privat (tidak terbuka publik)
DROP POLICY IF EXISTS wave_a_private_buckets_select ON storage.objects;
CREATE POLICY wave_a_private_buckets_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('project-vault', 'evidence', 'ktp_documents'));

DROP POLICY IF EXISTS wave_a_private_buckets_insert ON storage.objects;
CREATE POLICY wave_a_private_buckets_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('project-vault', 'evidence', 'ktp_documents')
    AND NOT public.is_auditor_readonly()
  );

COMMIT;
