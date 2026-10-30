/* ============================================================================
 * ProManage Enterprise — Bulk Sync API
 * POST /api/sync
 * - mode=CPM          : recompute critical path for all tasks
 * - mode=AHSP_BATCH   : bulk assign AHSP → tasks (Fire-and-Forget via batch)
 * - mode=FULL         : CPM + EVM + Timephased rebuild
 * ============================================================================ */

import { createClient } from '@supabase/supabase-js';
import { computeCPM, computeEVM, fmtDate, toDateOnly } from '@/lib/engines/schedulingEngine';

// ─── Service-role client (bypasses RLS — safe on server) ───
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials missing');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── Auth helper: user-scoped client for validation ───
function getUserClient(authHeader) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader || '' } },
    auth: { persistSession: false },
  });
  return client;
}

export default async function handler(req, res) {
  const T0 = Date.now();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    // ─── 1. Auth ───
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Missing bearer token' });
    }

    const userClient = getUserClient(authHeader);
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return res.status(401).json({ ok: false, error: 'Invalid token' });
    }
    const userId = userData.user.id;

    // ─── 2. Parse body ───
    const body = req.body || {};
    const projectId = body.project_id;
    const mode = String(body.mode || 'CPM').toUpperCase();
    const options = body.options || {};

    if (!projectId) {
      return res.status(400).json({ ok: false, error: 'project_id required' });
    }

    // ─── 3. Verify project ownership ───
    const supabase = getServiceClient();
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, project_start, status_date, work_days, hours_per_day, owner_id')
      .eq('id', projectId)
      .single();

    if (projErr || !project) {
      return res.status(404).json({ ok: false, error: 'Project not found' });
    }
    if (project.owner_id !== userId) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    // ─── 4. Dispatch by mode ───
    let result;
    switch (mode) {
      case 'CPM':
        result = await runCPMSync(supabase, project, options);
        break;
      case 'FULL':
        result = await runFullSync(supabase, project, options);
        break;
      case 'AHSP_BATCH':
        result = await runAhspBatchSync(supabase, project, body, options);
        break;
      default:
        return res.status(400).json({ ok: false, error: `Unknown mode: ${mode}` });
    }

    return res.status(200).json({
      ok: true,
      mode,
      elapsed_ms: Date.now() - T0,
      ...result,
    });
  } catch (err) {
    console.error('[api/sync] FATAL:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Internal Server Error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MODE: CPM — Critical Path recalculation
// ═══════════════════════════════════════════════════════════════════════════

async function runCPMSync(supabase, project, options) {
  const workDays = String(project.work_days || '1,2,3,4,5')
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => !isNaN(x));

  // ─── 1. FETCH all tasks ONCE (Batch read) ───
  const { data: tasks, error: tasksErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', project.id)
    .eq('active', true);

  if (tasksErr) throw new Error(`Fetch tasks: ${tasksErr.message}`);
  if (!tasks || tasks.length === 0) {
    return { tasks_updated: 0, message: 'No active tasks to sync' };
  }

  // ─── 2. Compute CPM in memory ───
  const cpm = computeCPM(tasks, {
    projectStart: toDateOnly(project.project_start),
    workDays,
    statusDate: toDateOnly(project.status_date),
    nearCriticalThreshold: options.nearCriticalThreshold || 5,
  });

  // ─── 3. Batch upsert CPM-computed fields ───
  const updates = cpm.tasks.map((t) => ({
    project_id: t.project_id,
    task_code: t.task_code,
    name: t.name,  
    id: t.id,
    es: t.es,
    ef: t.ef,
    ls: t.ls,
    lf: t.lf,
    slack: t.slack,
    free_slack: t.free_slack,
    critical: t.critical,
    near_critical: t.near_critical,
    start_date: t.start_date || null,
    finish_date: t.finish_date || null,
    alert: t.alert,
    duration: t.duration,
  }));

  // Upsert in one transaction (Supabase batching)
  const CHUNK = 500;
  let written = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('tasks')
      .upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`Batch upsert chunk ${i}: ${error.message}`);
    written += chunk.length;
  }

  return {
    tasks_updated: written,
    project_finish: cpm.project_finish,
    critical_count: cpm.tasks.filter((t) => t.critical === 'Yes').length,
    near_critical_count: cpm.tasks.filter((t) => t.near_critical === 'Yes').length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODE: FULL — CPM + EVM writeback
// ═══════════════════════════════════════════════════════════════════════════

async function runFullSync(supabase, project, options) {
  // First run CPM
  const cpmResult = await runCPMSync(supabase, project, options);

  // Refetch to compute EVM on updated CPM data
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', project.id)
    .eq('active', true);

  const workDays = String(project.work_days || '1,2,3,4,5')
    .split(',')
    .map((x) => Number(x.trim()));

  const evm = computeEVM(tasks, {
    statusDate: toDateOnly(project.status_date),
    workDays,
    method: options.evMethod || 'Duration',
  });

  // Update calculator_ahsp PV/EV/AC for synced rows
  const { data: calcRows } = await supabase
    .from('calculator_ahsp')
    .select('id, task_id')
    .eq('project_id', project.id)
    .not('task_id', 'is', null);

  if (calcRows && calcRows.length > 0) {
    const calcUpdates = [];
    for (const calc of calcRows) {
      const evmTask = evm.tasks.find((t) => t.task_code === tasks.find((x) => x.id === calc.task_id)?.task_code);
      if (!evmTask) continue;
      calcUpdates.push({
        id: calc.id,
        pv_bcws: Math.round(evmTask.pv),
        ev_bcwp: Math.round(evmTask.ev),
        ac_acwp: Math.round(evmTask.ac),
      });
    }
    if (calcUpdates.length > 0) {
      const { error } = await supabase
        .from('calculator_ahsp')
        .upsert(calcUpdates, { onConflict: 'id' });
      if (error) console.warn('[FULL] Calc update warn:', error.message);
    }
  }

  return {
    ...cpmResult,
    evm,
    calc_rows_updated: (calcRows || []).length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODE: AHSP_BATCH — Bulk assign AHSP components to existing tasks
// ═══════════════════════════════════════════════════════════════════════════

async function runAhspBatchSync(supabase, project, body, options) {
  const skipImported = body.skip_imported !== false;

  // ─── Step 1: BATCH READ everything ONCE ───
  const [{ data: tasks }, { data: calcRows }, { data: ahspRows }, { data: resources }] =
    await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', project.id).eq('active', true),
      supabase.from('calculator_ahsp').select('*').eq('project_id', project.id),
      supabase.from('master_ahsp').select('*').eq('project_id', project.id),
      supabase.from('resources').select('*').eq('project_id', project.id),
    ]);

  if (!tasks || !calcRows || !ahspRows) {
    return { processed: 0, skipped: 0, message: 'Insufficient data' };
  }

  // ─── Step 2: Build index maps in memory ───
  const calcByWbs = new Map();
  calcRows.forEach((c) => {
    const wbs = String(c.wbs || '').replace(/^'/, '').trim();
    if (!wbs) return;
    if (!calcByWbs.has(wbs)) calcByWbs.set(wbs, []);
    calcByWbs.get(wbs).push(c);
  });

  const ahspByWbs = new Map();
  ahspRows.forEach((a) => {
    const wbs = String(a.wbs || '').replace(/^'/, '').trim();
    if (!wbs) return;
    if (!ahspByWbs.has(wbs)) ahspByWbs.set(wbs, []);
    ahspByWbs.get(wbs).push(a);
  });

  const resByCode = new Map();
  (resources || []).forEach((r) => {
    if (r.code) resByCode.set(r.code, r);
  });

  let maxResN = 0;
  (resources || []).forEach((r) => {
    const m = String(r.resource_code || '').match(/^R(\d+)$/);
    if (m) maxResN = Math.max(maxResN, Number(m[1]));
  });

  // ─── Step 3: Compute plan in memory (no writes yet) ───
  const hpd = Number(project.hours_per_day) || 8;
  const newResources = [];
  const newAssignments = [];
  const taskUpdates = [];
  const calcUpdates = [];
  const resourceMap = new Map();
  const details = [];

  let processed = 0;
  let skipped = 0;

  for (const t of tasks) {
    if (t.summary === 'Yes') { skipped++; continue; }
    const wbs = String(t.wbs || '').trim();
    if (!wbs) { skipped++; continue; }

    const calcs = calcByWbs.get(wbs);
    if (!calcs || calcs.length === 0) { skipped++; continue; }
    const ahsps = ahspByWbs.get(wbs);
    if (!ahsps || ahsps.length === 0) { skipped++; continue; }

    const calc = calcs[0];
    if (skipImported && calc.imported === 'Yes') { skipped++; continue; }

    const volume = Number(calc.volume) || 0;
    const taskDuration = Math.max(1, Number(t.duration) || Number(calc.duration) || 1);

    const items = [];
    let totalCost = 0;

    for (const a of ahsps) {
      const kategori = String(a.kategori || '').trim();
      const komponen = String(a.komponen || '').trim();
      const koef = Number(a.koefisien) || 0;
      const harga = Number(a.harga_satuan) || 0;
      const type = resolveAhspType(kategori);
      const kuantitas = volume * koef;

      let units, work, cost;
      if (type === 'Material') {
        units = kuantitas;
        work = 0;
        cost = kuantitas * harga;
      } else if (type === 'Cost') {
        units = 1;
        work = 0;
        cost = kuantitas * harga;
      } else {
        units = Math.max(0.0001, kuantitas / taskDuration);
        work = taskDuration * units * hpd;
        cost = kuantitas * harga;
      }

      const code = buildResourceCode(wbs, kategori, komponen);
      const name = `${komponen} [${wbs}]`;

      items.push({
        code,
        name,
        type,
        kategori,
        units: +units.toFixed(4),
        work: +work.toFixed(2),
        cost: +cost.toFixed(2),
        harga,
        satuan: a.satuan || 'unit',
      });
      totalCost += cost;
    }

    for (const it of items) {
      if (resByCode.has(it.code)) {
        resourceMap.set(it.code, resByCode.get(it.code).id);
      } else {
        maxResN++;
        const newCode = `R${maxResN}`;
        const placeholderId = `__new__${newCode}`;
        resourceMap.set(it.code, placeholderId);

        newResources.push({
          resource_code: newCode,
          project_id: project.id,
          name: it.name,
          type: it.type,
          material: it.type === 'Material' ? it.satuan : '',
          group: it.kategori,
          max_units: it.type === 'Material' ? 100 : Math.max(100, Math.round(it.units * 100)),
          std_rate: it.harga,
          ovt_rate: Math.round(it.harga * 1.5),
          cost_per_use: 0,
          accrue_at: 'Prorated',
          base_calendar: 'Standard',
          code: it.code,
          unit: it.satuan,
          notes: `AHSP Batch v2 · WBS ${wbs}`,
        });

        resByCode.set(it.code, { id: placeholderId, resource_code: newCode });
      }
    }

    for (const it of items) {
      const resId = resourceMap.get(it.code);
      if (!resId) continue;
      newAssignments.push({
        project_id: project.id,
        task_id: t.id,
        resource_id: resId,
        units: it.units,
        work: it.work,
        effort_driven: it.type === 'Work' ? 'Yes' : 'No',
        overallocated: 'No',
      });
    }

    taskUpdates.push({
      id: t.id,
      project_id: t.project_id, // <--- TAMBAHKAN INI
      task_code: t.task_code,   // <--- TAMBAHKAN INI
      name: t.name,             // <--- TAMBAHKAN INI
      cost: totalCost,
      baseline_cost: totalCost,
      baseline_duration: taskDuration,
      baseline_work: +(taskDuration * hpd).toFixed(2),
      notes: `AHSP Batch · WBS ${wbs} · Vol ${volume} · RAB ${totalCost}`,
    });

    calcUpdates.push({
      id: calc.id,
      imported: 'Yes',
      task_id: t.id,
      resource_ids: items.map((it) => resourceMap.get(it.code)).join(','),
      cost: totalCost,
    });

    processed++;
    details.push({
      task_code: t.task_code,
      wbs,
      volume,
      items: items.length,
      cost: totalCost,
    });
  }

  // ─── Step 4: Insert new resources ───
  const placeholderToReal = new Map();
  let resourcesWritten = 0;

  if (newResources.length > 0) {
    const CHUNK_RES = 300;
    for (let i = 0; i < newResources.length; i += CHUNK_RES) {
      const chunk = newResources.slice(i, i + CHUNK_RES);
      const { data, error } = await supabase
        .from('resources')
        .insert(chunk)
        .select('id, resource_code');

      if (error) throw new Error(`Insert resources chunk ${i}: ${error.message}`);

      for (const r of data || []) {
        resourcesWritten++;
        placeholderToReal.set(`__new__${r.resource_code}`, r.id);
      }
    }

    // Resolve placeholders in resourceMap
    for (const [logicalCode, placeholder] of resourceMap.entries()) {
      if (String(placeholder).startsWith('__new__')) {
        const realId = placeholderToReal.get(placeholder);
        if (realId) resourceMap.set(logicalCode, realId);
      }
    }

    // Resolve placeholders in assignments
    for (const a of newAssignments) {
      if (placeholderToReal.has(a.resource_id)) {
        a.resource_id = placeholderToReal.get(a.resource_id);
      }
    }

    // Resolve placeholders in calcUpdates.resource_ids
    for (const cu of calcUpdates) {
      cu.resource_ids = String(cu.resource_ids || '')
        .split(',')
        .map((id) => placeholderToReal.get(id) || id)
        .join(',');
    }
  }

  // ─── Step 5: Insert assignments ───
  const validAssignments = newAssignments.filter(
    (a) => a.resource_id && !String(a.resource_id).startsWith('__new__')
  );

  let assignmentsWritten = 0;
  const CHUNK_ASSIGN = 500;

  for (let i = 0; i < validAssignments.length; i += CHUNK_ASSIGN) {
    const chunk = validAssignments.slice(i, i + CHUNK_ASSIGN);
    const { error } = await supabase
      .from('assignments')
      .upsert(chunk, { onConflict: 'task_id,resource_id' });

    if (error) throw new Error(`Upsert assignments chunk ${i}: ${error.message}`);
    assignmentsWritten += chunk.length;
  }

  // ─── Step 6: Update tasks ───
  let tasksWritten = 0;

  for (let i = 0; i < taskUpdates.length; i += 500) {
    const chunk = taskUpdates.slice(i, i + 500);
    const { error } = await supabase
      .from('tasks')
      .upsert(chunk, { onConflict: 'id' });

    if (error) throw new Error(`Update tasks chunk ${i}: ${error.message}`);
    tasksWritten += chunk.length;
  }

  // ─── Step 7: Update calculator_ahsp ───
  let calcWritten = 0;

  for (let i = 0; i < calcUpdates.length; i += 500) {
    const chunk = calcUpdates.slice(i, i + 500);
    const { error } = await supabase
      .from('calculator_ahsp')
      .upsert(chunk, { onConflict: 'id' });

    if (error) throw new Error(`Update calc chunk ${i}: ${error.message}`);
    calcWritten += chunk.length;
  }

  return {
    processed,
    skipped,
    resources_created: resourcesWritten,
    assignments_created: assignmentsWritten,
    tasks_updated: tasksWritten,
    calc_rows_updated: calcWritten,
    details,
  };
}

// ─── Helpers ───
function resolveAhspType(kategori) {
  const k = String(kategori || '').toLowerCase();
  if (k.includes('bahan') || k.includes('material')) return 'Material';
  if (k.includes('alat') || k.includes('equipment')) return 'Cost';
  return 'Work';
}

function slug(s) {
  return (
    String(s || '')
      .trim()
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'X'
  );
}

function buildResourceCode(wbs, kategori, komponen) {
  return `AHSP-${slug(wbs)}-${slug(kategori)}-${slug(komponen)}`.slice(0, 120);
}