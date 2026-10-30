/* ============================================================================
 * ProManage Enterprise — Scheduling Engine
 * CPM, EVM, Baseline Variance, HSD Alat
 * Compliance: Permen PUPR No.1/2022 + SE DJBK No.68/2024
 * Migrated from: scheduler.gs, 70-scurve.gs, 50-baseline-slots.gs, 77-ahsp-compliance.gs
 * ============================================================================ */

'use strict';

// ───────────────────────────────────────────────────────────────────────────
// SECTION 1 — DATE UTILITIES
// ───────────────────────────────────────────────────────────────────────────

export function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function fmtDate(d) {
  if (!d) return '';
  const dt = toDateOnly(d);
  if (!dt) return '';
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const da = String(dt.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function nextWorkDay(date, workDays) {
  const wdSet = workDays instanceof Set ? workDays : new Set(workDays);
  const d = toDateOnly(date) || new Date();
  d.setHours(0, 0, 0, 0);
  let guard = 0;
  while (!wdSet.has(d.getDay()) && guard < 1000) {
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return d;
}

export function addWorkDays(start, n, workDays) {
  const wdSet = workDays instanceof Set ? workDays : new Set(workDays);
  const d = nextWorkDay(start, wdSet);
  let c = 0;
  while (c < n) {
    d.setDate(d.getDate() + 1);
    if (wdSet.has(d.getDay())) c++;
  }
  return d;
}

export function countWorkDays(from, to, workDays) {
  const wdSet = workDays instanceof Set ? workDays : new Set(workDays);
  const a = nextWorkDay(from, wdSet);
  const b = toDateOnly(to) || new Date();
  b.setHours(0, 0, 0, 0);
  if (b <= a) return 0;
  let c = 0;
  const cur = new Date(a);
  while (cur < b) {
    if (wdSet.has(cur.getDay())) c++;
    cur.setDate(cur.getDate() + 1);
  }
  return c;
}

// ───────────────────────────────────────────────────────────────────────────
// SECTION 2 — PREDECESSOR PARSING
// Format: "T1FS+2d,T2SS-1d,T3FF,T4SF+3d"
// ───────────────────────────────────────────────────────────────────────────

export function parsePredecessors(str) {
  if (!str) return [];
  return String(str)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^T?\s*(\d+)\s*(FS|SS|FF|SF)?\s*([+-]?\s*\d+)?\s*(d)?$/i);
      if (!m) return null;
      return {
        id: 'T' + Number(m[1]),
        type: (m[2] || 'FS').toUpperCase(),
        lag: m[3] ? Number(String(m[3]).replace(/\s+/g, '')) : 0,
      };
    })
    .filter(Boolean);
}

// ───────────────────────────────────────────────────────────────────────────
// SECTION 3 — CPM ENGINE
// Full forward/backward pass with all constraint types
// ───────────────────────────────────────────────────────────────────────────

export function computeCPM(rawTasks, options = {}) {
  const {
    projectStart = new Date(),
    workDays = [1, 2, 3, 4, 5],
    statusDate = new Date(),
    nearCriticalThreshold = 5,
  } = options;

  const wdSet = new Set(workDays);

  // Normalize task codes
  const taskMap = new Map();
  const orderedTasks = [];

  rawTasks.forEach((raw) => {
    const taskCode = raw.task_code || raw.id || `T${taskMap.size + 1}`;
    const summary = String(raw.summary || 'No') === 'Yes' ? 'Yes' : 'No';
    const duration = summary === 'Yes' ? 0 : Number(raw.duration) || 0;

    const task = {
      ...raw,
      task_code: taskCode,
      duration,
      summary,
      progress: Number(raw.progress) || 0,
      physical_progress: Number(raw.physical_progress) || 0,
      cost: Number(raw.cost) || 0,
      actual_cost: Number(raw.actual_cost) || 0,
      outline_level: Math.max(1, Number(raw.outline_level) || 1),
      predecessors_parsed: parsePredecessors(raw.predecessors),
      _es: 0,
      _ef: 0,
      _ls: 0,
      _lf: 0,
      _slack: 0,
      _freeSlack: 0,
    };
    taskMap.set(taskCode, task);
    orderedTasks.push(task);
  });

  const leafTasks = orderedTasks.filter((t) => t.summary !== 'Yes');
  const day0 = nextWorkDay(projectStart, wdSet);

  const dateToIdx = (d) => {
    const dt = toDateOnly(d);
    if (!dt) return 0;
    return countWorkDays(day0, dt, wdSet);
  };

  const idxToDate = (i) => addWorkDays(day0, i, wdSet);

  // ─── Topological sort ───
  const indeg = new Map();
  leafTasks.forEach((t) => {
    const validPreds = t.predecessors_parsed.filter(
      (p) => taskMap.has(p.id) && taskMap.get(p.id).summary !== 'Yes'
    );
    indeg.set(t.task_code, validPreds.length);
  });

  const queue = leafTasks
    .filter((t) => indeg.get(t.task_code) === 0)
    .map((t) => t.task_code);
  const topoOrder = [];

  while (queue.length > 0) {
    const id = queue.shift();
    topoOrder.push(id);
    leafTasks.forEach((t) => {
      t.predecessors_parsed.forEach((p) => {
        if (p.id === id) {
          const cur = indeg.get(t.task_code);
          indeg.set(t.task_code, cur - 1);
          if (indeg.get(t.task_code) === 0) queue.push(t.task_code);
        }
      });
    });
  }

  // Cycle fallback: append remaining
  leafTasks.forEach((t) => {
    if (!topoOrder.includes(t.task_code)) topoOrder.push(t.task_code);
  });

  // ─── FORWARD PASS ───
  topoOrder.forEach((id) => {
    const t = taskMap.get(id);
    if (!t) return;

    // Manual mode override
    if (String(t.schedule_mode || 'Auto').toLowerCase() === 'manual') {
      let es = 0;
      let ef = 0;
      const hasMS = !!t.manual_start;
      const hasMF = !!t.manual_finish;
      if (hasMS) es = dateToIdx(t.manual_start);
      if (hasMF) ef = dateToIdx(t.manual_finish) + 1;
      if (hasMS && hasMF) t.duration = Math.max(0, ef - es);
      else if (hasMS) ef = es + t.duration;
      else if (hasMF) es = ef - t.duration;
      else ef = es + t.duration;
      t._es = Math.max(0, es);
      t._ef = Math.max(t._es, ef);
      return;
    }

    // Compute ES from predecessors
    let es = 0;
    t.predecessors_parsed.forEach((p) => {
      const pt = taskMap.get(p.id);
      if (!pt) return;
      let cand = 0;
      if (p.type === 'FS') cand = (pt._ef || 0) + p.lag;
      else if (p.type === 'SS') cand = (pt._es || 0) + p.lag;
      else if (p.type === 'FF') cand = (pt._ef || 0) + p.lag - t.duration;
      else if (p.type === 'SF') cand = (pt._es || 0) + p.lag - t.duration;

      if ((p.type === 'FF' || p.type === 'SF') && cand < (pt._es || 0)) {
        cand = pt._es || 0;
      }
      if (cand > es) es = cand;
    });

    // Apply constraint
    const c = String(t.constraint_type || 'ASAP').toUpperCase();
    if (t.constraint_date) {
      const cd = dateToIdx(t.constraint_date);
      if (c === 'SNET') es = Math.max(es, cd);
      else if (c === 'MSO') es = cd;
      else if (c === 'FNET') es = Math.max(es, cd - t.duration);
      else if (c === 'MFO') es = cd - t.duration + 1;
    }

    if (es < 0) es = 0;
    t._es = es;
    t._ef = es + t.duration;
  });

  // ─── Summary rollup ───
  const rollupSummaries = () => {
    const sorted = [...orderedTasks].sort((a, b) => b.outline_level - a.outline_level);
    sorted.forEach((t) => {
      if (t.summary !== 'Yes') return;
      const myIdx = orderedTasks.indexOf(t);
      const children = [];
      for (let i = myIdx + 1; i < orderedTasks.length; i++) {
        if (orderedTasks[i].outline_level <= t.outline_level) break;
        if (orderedTasks[i].outline_level === t.outline_level + 1) {
          children.push(orderedTasks[i]);
        }
      }
      if (children.length === 0) {
        t._es = 0;
        t._ef = 0;
        t.duration = 0;
        return;
      }
      t._es = Math.min(...children.map((c) => c._es));
      t._ef = Math.max(...children.map((c) => c._ef));
      t.duration = t._ef - t._es;
    });
  };
  rollupSummaries();

  // ─── Successor map ───
  const succMap = new Map();
  orderedTasks.forEach((s) => {
    if (s.summary === 'Yes') return;
    s.predecessors_parsed.forEach((p) => {
      if (!taskMap.has(p.id)) return;
      if (!succMap.has(p.id)) succMap.set(p.id, []);
      succMap.get(p.id).push({ succ: s, link: p });
    });
  });

  // ─── Project finish ───
  let projFinish = 0;
  orderedTasks.forEach((t) => {
    if (t._ef > projFinish) projFinish = t._ef;
  });
  if (projFinish === 0) projFinish = 1;

  // ─── BACKWARD PASS ───
  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const t = taskMap.get(topoOrder[i]);
    if (!t) continue;

    const succs = succMap.get(t.task_code) || [];
    if (succs.length === 0) {
      t._lf = projFinish;
    } else {
      let lf = Infinity;
      succs.forEach(({ succ: s, link: p }) => {
        let cand = Infinity;
        if (p.type === 'FS') cand = s._ls - p.lag;
        else if (p.type === 'SS') cand = s._ls - p.lag + t.duration;
        else if (p.type === 'FF') cand = s._lf - p.lag;
        else if (p.type === 'SF') cand = s._lf - p.lag + t.duration;
        if (cand < lf) lf = cand;
      });
      t._lf = lf;
    }

    // Apply constraint on backward pass
    const c = String(t.constraint_type || 'ASAP').toUpperCase();
    if (t.constraint_date) {
      const cd = dateToIdx(t.constraint_date);
      if (c === 'MSO') { t._ls = cd; t._lf = cd + t.duration; }
      else if (c === 'MFO') { t._lf = cd + 1; t._ls = cd + 1 - t.duration; }
      else if (c === 'FNLT') { t._lf = Math.min(t._lf, cd); t._ls = t._lf - t.duration; }
      else if (c === 'FNET') { t._lf = Math.max(t._lf, cd); t._ls = t._lf - t.duration; }
      else t._ls = t._lf - t.duration;
    } else {
      t._ls = t._lf - t.duration;
    }
  }

  // ─── Summary slack rollup ───
  const sortedDesc = [...orderedTasks].sort((a, b) => b.outline_level - a.outline_level);
  sortedDesc.forEach((t) => {
    if (t.summary !== 'Yes') return;
    const myIdx = orderedTasks.indexOf(t);
    const children = [];
    for (let i = myIdx + 1; i < orderedTasks.length; i++) {
      if (orderedTasks[i].outline_level <= t.outline_level) break;
      if (orderedTasks[i].outline_level === t.outline_level + 1) children.push(orderedTasks[i]);
    }
    if (!children.length) {
      t._ls = t._es;
      t._lf = t._ef;
      return;
    }
    const slackVals = children.map((c) =>
      Math.min(c._ls - c._es, c._lf - c._ef)
    );
    const minSlack = Math.min(...slackVals);
    t._ls = t._es + minSlack;
    t._lf = t._ef + minSlack;
  });

  // ─── Free Slack ───
  const computeFreeSlack = (t) => {
    const succs = succMap.get(t.task_code) || [];
    if (succs.length === 0) return 0;
    let minGap = Infinity;
    succs.forEach(({ succ: s, link: p }) => {
      let gap = Infinity;
      if (p.type === 'FS') gap = s._es - t._ef - p.lag;
      else if (p.type === 'SS') gap = s._es - t._es - p.lag;
      else if (p.type === 'FF') gap = s._es - t._es - p.lag - s.duration + t.duration;
      else if (p.type === 'SF') gap = s._es - t._ef - p.lag - s.duration + t.duration;
      if (gap < minGap) minGap = gap;
    });
    return Math.max(0, minGap === Infinity ? 0 : minGap);
  };

  // ─── Build result ───
  const statusDateObj = toDateOnly(statusDate) || new Date();

  const result = orderedTasks.map((t) => {
    const isSummary = t.summary === 'Yes';
    let slack = 0;
    let critical = 'Summary';
    let freeSlack = 0;

    if (!isSummary) {
      slack = Math.min(t._ls - t._es, t._lf - t._ef);
      critical = slack <= 0 ? 'Yes' : 'No';
      freeSlack = computeFreeSlack(t);
    }

    const startDate = idxToDate(t._es);
    const finishDate = t.duration > 0 ? idxToDate(t._ef - 1) : startDate;

    // Alert
    let alert = '🟡 KUNING';
    if (isSummary) alert = 'SUMMARY';
    else if (t.progress >= 100) alert = '🟢 HIJAU';
    else if (finishDate < statusDateObj) alert = '🔴 MERAH';

    const nearCritical =
      !isSummary && slack > 0 && slack <= nearCriticalThreshold ? 'Yes' : 'No';

    return {
      ...t,
      es: t._es,
      ef: t._ef,
      ls: t._ls,
      lf: t._lf,
      slack,
      free_slack: freeSlack,
      critical,
      near_critical: nearCritical,
      start_date: fmtDate(startDate),
      finish_date: fmtDate(finishDate),
      alert,
    };
  });

  return {
    tasks: result,
    project_start: fmtDate(day0),
    project_finish: fmtDate(idxToDate(Math.max(projFinish - 1, 0))),
    status_date: fmtDate(statusDateObj),
    total_cost: result
      .filter((t) => t.summary !== 'Yes')
      .reduce((s, t) => s + t.cost, 0),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// SECTION 4 — BASELINE VARIANCE (File 1)
// ───────────────────────────────────────────────────────────────────────────

export function computeBaselineVariance(tasks, baselineSnapshot) {
  const bMap = new Map();
  (baselineSnapshot || []).forEach((b) => {
    bMap.set(b.task_code || b.id, b);
  });

  const rows = tasks.map((t) => {
    const bl = bMap.get(t.task_code) || {};
    const dayDiff = (a, b) => {
      if (!a || !b) return null;
      const A = toDateOnly(a);
      const B = toDateOnly(b);
      if (!A || !B) return null;
      return Math.round((A - B) / 86400000);
    };

    const startVar = dayDiff(t.start_date, bl.start);
    const finishVar = dayDiff(t.finish_date, bl.finish);
    const durVar = (Number(t.duration) || 0) - (Number(bl.duration) || 0);
    const costVar = (Number(t.cost) || 0) - (Number(bl.cost) || 0);

    return {
      task_code: t.task_code,
      name: t.name,
      wbs: t.wbs,
      outline_level: t.outline_level,
      summary: t.summary,
      start_a: t.start_date,
      finish_a: t.finish_date,
      start_b: bl.start || null,
      finish_b: bl.finish || null,
      duration_a: t.duration,
      duration_b: bl.duration || 0,
      cost_a: t.cost || 0,
      cost_b: bl.cost || 0,
      start_variance: startVar,
      finish_variance: finishVar,
      duration_variance: durVar,
      cost_variance: costVar,
      progress: t.progress || 0,
      critical: t.critical,
    };
  });

  const summary = {
    late_finish: 0,
    early_finish: 0,
    on_track: 0,
    late_start: 0,
    early_start: 0,
    cost_over: 0,
    cost_under: 0,
    total_cost_variance: 0,
    total_duration_variance: 0,
  };

  rows
    .filter((r) => r.summary !== 'Yes')
    .forEach((r) => {
      if (r.finish_variance !== null) {
        if (r.finish_variance > 0) summary.late_finish++;
        else if (r.finish_variance < 0) summary.early_finish++;
        else summary.on_track++;
      }
      if (r.start_variance !== null) {
        if (r.start_variance > 0) summary.late_start++;
        else if (r.start_variance < 0) summary.early_start++;
      }
      if (r.cost_variance > 0) summary.cost_over++;
      else if (r.cost_variance < 0) summary.cost_under++;
      summary.total_cost_variance += r.cost_variance;
      summary.total_duration_variance += r.duration_variance;
    });

  return { rows, summary };
}

// ───────────────────────────────────────────────────────────────────────────
// SECTION 5 — EVM ANALYTICS (File 3 / 70-scurve.gs)
// ───────────────────────────────────────────────────────────────────────────

export function computeEVM(tasks, options = {}) {
  const {
    statusDate = new Date(),
    workDays = [1, 2, 3, 4, 5],
    method = 'Duration', // 'Duration' | 'Physical'
    wbsFilter = null,
  } = options;

  const wdSet = new Set(workDays);
  const statusDateObj = toDateOnly(statusDate) || new Date();

  let filtered = tasks.filter((t) => t.summary !== 'Yes');
  if (wbsFilter) {
    filtered = filtered.filter((t) =>
      String(t.wbs || '').startsWith(wbsFilter)
    );
  }

  let totalBAC = 0;
  let totalPV = 0;
  let totalEV = 0;
  let totalAC = 0;

  const taskRows = filtered.map((t) => {
    const bac = Number(t.cost) || 0;
    const progress =
      method === 'Physical'
        ? Number(t.physical_progress) || Number(t.progress) || 0
        : Number(t.progress) || 0;

    const tStart = toDateOnly(t.start_date);
    const tFinish = toDateOnly(t.finish_date);

    let pvPct = 0;
    if (tStart && tFinish) {
      if (statusDateObj >= tFinish) pvPct = 1;
      else if (statusDateObj >= tStart) {
        const dur = Math.max(1, Number(t.duration) || 1);
        const elapsed = countWorkDays(tStart, statusDateObj, wdSet);
        pvPct = Math.min(1, elapsed / dur);
      }
    }

    const pv = bac * pvPct;
    const ev = bac * (progress / 100);
    const ac = Number(t.actual_cost) || 0;

    totalBAC += bac;
    totalPV += pv;
    totalEV += ev;
    totalAC += ac;

    return {
      task_code: t.task_code,
      name: t.name,
      wbs: t.wbs,
      duration: t.duration,
      progress,
      bac,
      pv,
      ev,
      ac,
      cv: ev - ac,
      sv: ev - pv,
    };
  });

  const cpi = totalAC > 0 ? totalEV / totalAC : 1;
  const spi = totalPV > 0 ? totalEV / totalPV : 1;
  const eac = cpi > 0 ? totalBAC / cpi : totalBAC;
  const vac = totalBAC - eac;

  return {
    tasks: taskRows,
    summary: {
      BAC: round2(totalBAC),
      PV: round2(totalPV),
      EV: round2(totalEV),
      AC: round2(totalAC),
      CV: round2(totalEV - totalAC),
      SV: round2(totalEV - totalPV),
      CPI: +cpi.toFixed(3),
      SPI: +spi.toFixed(3),
      EAC: round2(eac),
      VAC: round2(vac),
      costStatus: totalEV >= totalAC ? 'UNDER BUDGET' : 'OVER BUDGET',
      scheduleStatus: totalEV >= totalPV ? 'AHEAD' : 'BEHIND',
    },
    statusDate: fmtDate(statusDateObj),
    method,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// SECTION 6 — S-CURVE TIME-SERIES (File 3)
// ───────────────────────────────────────────────────────────────────────────

export function computeScurve(tasks, options = {}) {
  const {
    statusDate = new Date(),
    workDays = [1, 2, 3, 4, 5],
    timescale = 'week', // 'day' | 'week' | 'month'
    wbsFilter = null,
    method = 'Duration',
  } = options;

  const wdSet = new Set(workDays);
  const statusDateObj = toDateOnly(statusDate) || new Date();

  let leafTasks = tasks.filter((t) => t.summary !== 'Yes');
  if (wbsFilter) {
    leafTasks = leafTasks.filter((t) => String(t.wbs || '').startsWith(wbsFilter));
  }
  if (leafTasks.length === 0) {
    return { labels: [], planned: [], earned: [], actual: [], empty: true };
  }

  // Determine timeline
  let pStart = null;
  let pFinish = null;
  leafTasks.forEach((t) => {
    const s = toDateOnly(t.start_date);
    const f = toDateOnly(t.finish_date);
    if (s && (!pStart || s < pStart)) pStart = s;
    if (f && (!pFinish || f > pFinish)) pFinish = f;
  });
  if (!pStart) pStart = statusDateObj;
  if (!pFinish) pFinish = pStart;
  const lastDate = new Date(pFinish);
  lastDate.setDate(lastDate.getDate() + 7);

  const points = buildTimeline(pStart, lastDate, timescale);
  const planned = [];
  const earned = [];
  const actual = [];

  points.forEach(({ date }) => {
    let pvSum = 0;
    let evSum = 0;
    let acSum = 0;

    leafTasks.forEach((t) => {
      const bac = Number(t.cost) || 0;
      if (bac === 0) return;
      const tStart = toDateOnly(t.start_date);
      const tFinish = toDateOnly(t.finish_date);
      if (!tStart || !tFinish) return;

      const dur = Math.max(1, Number(t.duration) || 1);
      const durDays = countWorkDays(tStart, tFinish, wdSet) || 1;

      // PV
      let pvPct = 0;
      if (date >= tFinish) pvPct = 1;
      else if (date >= tStart) {
        const elapsed = countWorkDays(tStart, date, wdSet);
        pvPct = Math.min(1, elapsed / durDays);
      }
      pvSum += bac * pvPct;

      // EV (flat after status date)
      const prog =
        method === 'Physical'
          ? Number(t.physical_progress) || Number(t.progress) || 0
          : Number(t.progress) || 0;
      if (date >= statusDateObj) evSum += bac * (prog / 100);

      // AC (flat after status date)
      if (date >= statusDateObj) acSum += Number(t.actual_cost) || 0;
    });

    planned.push(Math.round(pvSum));
    earned.push(Math.round(evSum));
    actual.push(Math.round(acSum));
  });

  const evm = computeEVM(tasks, { statusDate, workDays, method, wbsFilter });

  return {
    labels: points.map((p) => p.label),
    planned,
    earned,
    actual,
    summary: {
      ...evm.summary,
      scheduleStatus: evm.summary.scheduleStatus,
      costStatus: evm.summary.costStatus,
    },
    empty: false,
  };
}

function buildTimeline(startDate, endDate, timescale) {
  const points = [];
  const cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const fmtLabel = (date, pattern) => {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const da = String(date.getDate()).padStart(2, '0');
    if (pattern === 'dd/MM') return `${da}/${mo}`;
    if (pattern === 'MMM yy') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${months[date.getMonth()]} ${String(y).slice(-2)}`;
    }
    if (pattern === 'dd MMM') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${da} ${months[date.getMonth()]}`;
    }
    return `${da}/${mo}`;
  };

  if (timescale === 'day') {
    while (cur <= end) {
      points.push({ date: new Date(cur), label: fmtLabel(cur, 'dd/MM') });
      cur.setDate(cur.getDate() + 1);
    }
  } else if (timescale === 'month') {
    cur.setDate(1);
    while (cur <= end) {
      points.push({ date: new Date(cur), label: fmtLabel(cur, 'MMM yy') });
      cur.setMonth(cur.getMonth() + 1);
    }
  } else {
    // week (Monday start)
    const dow = cur.getDay();
    const offset = dow === 0 ? 6 : dow - 1;
    cur.setDate(cur.getDate() - offset);
    while (cur <= end) {
      points.push({ date: new Date(cur), label: fmtLabel(cur, 'dd MMM') });
      cur.setDate(cur.getDate() + 7);
    }
  }
  return points;
}

// ───────────────────────────────────────────────────────────────────────────
// SECTION 7 — HSD ALAT (SE DJBK 68/2024 Pasal 9)
// ───────────────────────────────────────────────────────────────────────────

export function annuityFactor(interestPct, years) {
  const i = (Number(interestPct) || 12) / 100;
  const n = Math.max(1, Number(years) || 5);
  return (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
}

export function calculateAlatHsd(detail) {
  detail = detail || {};
  const hargaPokok = Number(detail.harga_pokok ?? detail.HargaPokok) || 0;
  const nilaiSisaPct = Number(detail.nilai_sisa_pct ?? detail.NilaiSisaPct) || 10;
  const umurEkonomis = Number(detail.umur_ekonomis ?? detail.UmurEkonomis) || 5;
  const jamPerTahun = Number(detail.jam_per_tahun ?? detail.JamPerTahun) || 2000;
  const faktorAngsuran =
    Number(detail.faktor_angsuran ?? detail.FaktorAngsuran) ||
    annuityFactor(12, umurEkonomis);
  const asuransiPct = Number(detail.asuransi_pct ?? detail.AsuransiPct) || 0.5;
  const pajakPct = Number(detail.pajak_pct ?? detail.PajakPct) || 0;
  const bbm = Number(detail.biaya_bbm ?? detail.BiayaBBM) || 0;
  const oli = Number(detail.biaya_oli ?? detail.BiayaOli) || 0;
  const maint = Number(detail.biaya_maintenance ?? detail.BiayaMaintenance) || 0;
  const upahOp = Number(detail.upah_operator ?? detail.UpahOperator) || 0;
  const upahPb = Number(detail.upah_pembantu ?? detail.UpahPembantu) || 0;
  const efisiensi = Math.max(
    0.3,
    Math.min(1, Number(detail.faktor_efisiensi ?? detail.FaktorEfisiensi) || 0.83)
  );

  const nilaiSisa = (hargaPokok * nilaiSisaPct) / 100;
  const biayaDepresiasi = (hargaPokok - nilaiSisa) * faktorAngsuran;
  const biayaAsuransi = (hargaPokok * asuransiPct) / 100;
  const biayaPajak = (hargaPokok * pajakPct) / 100;

  const biayaPasti = +(
    (biayaDepresiasi + biayaAsuransi + biayaPajak) /
    jamPerTahun
  ).toFixed(2);

  const biayaOperasi = +(bbm + oli + maint + upahOp + upahPb).toFixed(2);
  const hsdAkhir = +((biayaPasti + biayaOperasi) / efisiensi).toFixed(2);

  return {
    ok: true,
    biaya_pasti: biayaPasti,
    biaya_operasi: biayaOperasi,
    hsd_akhir: hsdAkhir,
    faktor_angsuran: +faktorAngsuran.toFixed(4),
    breakdown: {
      depresiasi: +biayaDepresiasi.toFixed(2),
      asuransi: +biayaAsuransi.toFixed(2),
      pajak: +biayaPajak.toFixed(2),
      nilai_sisa: +nilaiSisa.toFixed(2),
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// SECTION 8 — AHSP COMPLIANCE (SE DJBK 68/2024)
// ───────────────────────────────────────────────────────────────────────────

export const SDA_VOLUMES = [
  { id: 1, name: 'Komponen Dasar' },
  { id: 2, name: 'Bendung' },
  { id: 3, name: 'Irigasi' },
  { id: 4, name: 'Pengaman Sungai' },
  { id: 5, name: 'Bendungan' },
  { id: 6, name: 'Pantai' },
  { id: 7, name: 'Muara' },
  { id: 8, name: 'Rawa' },
  { id: 9, name: 'Air Tanah' },
  { id: 10, name: 'Pintu Air' },
];

export function validateKodeAhsp(kode) {
  const s = String(kode || '').trim();
  if (!s) return { ok: true, valid: true, msg: '' };
  const regex = /^[A-Z](\.[0-9]{1,4}){1,6}$/;
  if (regex.test(s)) return { ok: true, valid: true };
  if (s.length >= 3 && s.length <= 30) {
    return { ok: true, valid: true, warn: 'Format non-standar (bukan pola A.2.02.1)' };
  }
  return { ok: false, valid: false, msg: 'Format Kode AHSP tidak valid' };
}

export function computeCompliance(hspTotal, volume, biayaUmumPct) {
  const pct = Math.max(0, Math.min(15, Number(biayaUmumPct) || 10));
  const overhead = +(hspTotal * pct / 100).toFixed(2);
  const hspFinal = +(hspTotal + overhead).toFixed(2);
  const rabFinal = +(volume * hspFinal).toFixed(2);
  return { overhead, hspFinal, rabFinal, pct };
}

// ───────────────────────────────────────────────────────────────────────────
// UTILITIES
// ───────────────────────────────────────────────────────────────────────────
function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}