// lib/scheduler.js
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function toDateStr(d) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWorkingDay(date, workingDays, exceptions) {
  const dStr = toDateStr(date);
  if (exceptions.some(e => e.exception_date === dStr)) return false;
  return workingDays.includes(date.getDay());
}

export function addWorkingDays(startStr, daysToAdd, workingDays = [1,2,3,4,5], exceptions = []) {
  if (!startStr) return null;
  
  // PENGAMAN 1: Jika workingDays kosong, paksa jadi Senin-Jumat
  if (!workingDays || workingDays.length === 0) workingDays = [1,2,3,4,5];

  let currentDate = new Date(startStr);
  if (isNaN(currentDate.getTime())) return null;
  currentDate.setHours(12, 0, 0, 0); 
  if (daysToAdd === 0) return toDateStr(currentDate);

  let added = 0;
  let direction = daysToAdd > 0 ? 1 : -1;
  let target = Math.abs(daysToAdd);
  let safetyCounter = 0; // PENGAMAN 2: Batas Iterasi

  while (added < target) {
    currentDate.setDate(currentDate.getDate() + direction);
    if (isWorkingDay(currentDate, workingDays, exceptions)) added++;
    safetyCounter++;
    if (safetyCounter > 3650) break; // Maksimal 10 tahun, hentikan paksa jika error
  }
  return toDateStr(currentDate);
}

export function countWorkingDays(startStr, endStr, workingDays = [1,2,3,4,5], exceptions = []) {
  if (!startStr || !endStr) return 1;
  if (!workingDays || workingDays.length === 0) workingDays = [1,2,3,4,5];

  let count = 0;
  let cur = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(cur.getTime()) || isNaN(end.getTime())) return 1;
  cur.setHours(12,0,0,0); end.setHours(12,0,0,0);

  if (cur > end) return 1;
  let safetyCounter = 0;

  while (cur <= end) {
    if (isWorkingDay(cur, workingDays, exceptions)) count++;
    cur.setDate(cur.getDate() + 1);
    safetyCounter++;
    if (safetyCounter > 3650) break;
  }
  return Math.max(1, count);
}

function snapToWorkingDay(dateStr, workingDays, exceptions, direction = 1) {
  if (!dateStr) return null;
  if (!workingDays || workingDays.length === 0) workingDays = [1,2,3,4,5];

  let d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(12,0,0,0);
  let safetyCounter = 0;
  
  if (direction > 0) {
    while (!isWorkingDay(d, workingDays, exceptions) && safetyCounter < 3650) {
      d.setDate(d.getDate() + 1); safetyCounter++;
    }
  } else {
    while (!isWorkingDay(d, workingDays, exceptions) && safetyCounter < 3650) {
      d.setDate(d.getDate() - 1); safetyCounter++;
    }
  }
  return toDateStr(d);
}

export function updateProjectScheduleSecure(originalTasks, workingDays = [1,2,3,4,5], exceptions = []) {
  try {
    let tasks = JSON.parse(JSON.stringify(originalTasks));
    const taskMap = new Map(tasks.map(t => [t.wbs_code, t]));
    tasks.sort((a, b) => a.wbs_code.localeCompare(b.wbs_code, undefined, { numeric: true }));

    // FASE 1: FORWARD PASS
    tasks.forEach(task => {
      if (task.summary === 'Yes') return;
      if (task.task_mode === 'Manually Scheduled') {
          task.early_start = task.start_date; task.early_finish = task.end_date; return;
      }
      let earliestStart = null;
      if (task.predecessors && task.predecessors.trim() !== '') {
        const predStrings = task.predecessors.split(',').map(s => s.trim());
        predStrings.forEach(predStr => {
          const match = predStr.match(/^([0-9.]+)(FS|SS|FF|SF)?([+-]\d+)?$/i);
          if (!match) return;
          const [, predCode, type = 'FS', lagStr = '0'] = match;
          const lag = parseInt(lagStr, 10);
          const predTask = taskMap.get(predCode);

          if (predTask && predTask.early_finish && predTask.early_start) {
            let candidateStart = null;
            const typeUpper = type.toUpperCase();
            
            if (typeUpper === 'FS') candidateStart = addWorkingDays(predTask.early_finish, lag + 1, workingDays, exceptions);
            else if (typeUpper === 'SS') candidateStart = addWorkingDays(predTask.early_start, lag, workingDays, exceptions);
            else if (typeUpper === 'FF') {
              let candidateFinish = addWorkingDays(predTask.early_finish, lag, workingDays, exceptions);
              candidateStart = addWorkingDays(candidateFinish, -(task.duration - 1), workingDays, exceptions);
            }
            else if (typeUpper === 'SF') {
              let candidateFinish = addWorkingDays(predTask.early_start, lag, workingDays, exceptions);
              candidateStart = addWorkingDays(candidateFinish, -(task.duration - 1), workingDays, exceptions);
            }

            if (candidateStart && (!earliestStart || new Date(candidateStart) > new Date(earliestStart))) {
              earliestStart = candidateStart;
            }
          }
        });
      }
      if (!earliestStart) earliestStart = task.start_date ? snapToWorkingDay(task.start_date, workingDays, exceptions) : null;
      if (earliestStart) {
        task.early_start = snapToWorkingDay(earliestStart, workingDays, exceptions);
        task.early_finish = addWorkingDays(task.early_start, task.duration - 1, workingDays, exceptions);
        task.start_date = task.early_start; task.end_date = task.early_finish;
      }
    });

    // FASE 2: BACKWARD PASS
    let projectFinish = null;
    tasks.forEach(t => {
        if (t.summary !== 'Yes' && t.early_finish) {
            if (!projectFinish || new Date(t.early_finish) > new Date(projectFinish)) projectFinish = t.early_finish;
        }
    });

    const reversedTasks = [...tasks].reverse();
    reversedTasks.forEach(task => {
      if (task.summary === 'Yes') return;
      let latestFinish = null;

      // PERBAIKAN: Cari successor berdasarkan WBS Code yang persis
      const successors = tasks.filter(s => {
          if (!s.predecessors) return false;
          const preds = s.predecessors.split(',').map(p => p.trim());
          return preds.some(p => {
              const match = p.match(/^([0-9.]+)/);
              return match && match[1] === task.wbs_code;
          });
      });

      if (successors.length === 0) {
        latestFinish = projectFinish || task.early_finish;
      } else {
        successors.forEach(succ => {
          const predStrings = succ.predecessors.split(',').map(s => s.trim());
          const rel = predStrings.find(p => p.startsWith(task.wbs_code));
          if (!rel) return;
          const match = rel.match(/^([0-9.]+)(FS|SS|FF|SF)?([+-]\d+)?$/i);
          const type = match[2] || 'FS';
          const lag = parseInt(match[3] || '0', 10);

          let candidateLF = null;
          if (type === 'FS' && succ.late_start) candidateLF = addWorkingDays(succ.late_start, -lag - 1, workingDays, exceptions);
          else if (type === 'SS' && succ.late_start) candidateLF = addWorkingDays(addWorkingDays(succ.late_start, task.duration - 1, workingDays, exceptions), -lag, workingDays, exceptions);
          else if (type === 'FF' && succ.late_finish) candidateLF = addWorkingDays(succ.late_finish, -lag, workingDays, exceptions);
          else if (type === 'SF' && succ.late_finish) candidateLF = addWorkingDays(addWorkingDays(succ.late_finish, -(task.duration - 1), workingDays, exceptions), -lag, workingDays, exceptions);

          if (candidateLF && (!latestFinish || new Date(candidateLF) < new Date(latestFinish))) latestFinish = candidateLF;
        });
      }

      task.late_finish = latestFinish || task.early_finish;
      task.late_start = addWorkingDays(task.late_finish, -(task.duration - 1), workingDays, exceptions);

      if (task.early_start && task.late_start) {
          const es = new Date(task.early_start); const ls = new Date(task.late_start);
          task.slack = Math.round((ls - es) / MS_PER_DAY);
          task.is_critical = task.slack <= 0;
      }
    });

    // FASE 3: ROLLUP
    const reversedRollup = [...tasks].reverse();
    reversedRollup.forEach(task => {
      if (task.summary !== 'Yes') return;
      // PERBAIKAN: Gunakan WBS Code prefix sebagai relasi hierarki, bukan parent_id
      const children = tasks.filter(t => t.summary !== 'Yes' && t.wbs_code.startsWith(task.wbs_code + '.'));
      if (children.length > 0) {
        const validStarts = children.map(c => c.start_date).filter(Boolean);
        const validEnds = children.map(c => c.end_date).filter(Boolean);
        if (validStarts.length > 0 && validEnds.length > 0) {
          task.start_date = validStarts.reduce((min, d) => new Date(d) < new Date(min) ? d : min);
          task.end_date = validEnds.reduce((max, d) => new Date(d) > new Date(max) ? d : max);
          // Perbaikan Durasi: Inklusif (+1) standar MS Project/P6
          const d1 = new Date(task.start_date);
          const d2 = new Date(task.end_date);
          task.duration = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
        }
      }
    });

    return { success: true, tasks: tasks };
  } catch (error) {
    console.error("CPM Engine Error:", error);
    return { success: false, errorMessage: error.message, tasks: originalTasks };
  }
}