// lib/cpmEngine.js

export const isWorkingDay = (date) => {
  if (!date || isNaN(date.getTime())) return false;
  const day = date.getDay();
  return day !== 0 && day !== 6;
};

export const addWorkingDays = (startDateStr, durationInDays) => {
  if (!startDateStr || durationInDays <= 0) return startDateStr || '';
  let date = new Date(startDateStr);
  if (isNaN(date.getTime())) return startDateStr;
  
  while (!isWorkingDay(date)) {
    date.setDate(date.getDate() + 1);
  }
  
  let addedDays = 1;
  while (addedDays < durationInDays) {
    date.setDate(date.getDate() + 1);
    if (isWorkingDay(date)) {
      addedDays++;
    }
  }
  return date.toISOString().split('T')[0];
};

export const parsePredecessors = (predStr) => {
  if (!predStr || typeof predStr !== 'string') return [];
  const regex = /([0-9.]+)\s*(FS|SS|FF|SF)?\s*([+-]\d+)?d?/gi;
  const matches = [...predStr.matchAll(regex)];
  return matches.map(m => ({
    wbs: m[1],
    type: (m[2] || 'FS').toUpperCase(),
    lag: m[3] ? parseInt(m[3]) : 0
  }));
};

export const calculateCPM = (tasks, projectStartDate) => {
  try {
    // 1. Clone dan bersihkan data
    let cpmTasks = tasks.map(t => ({ 
      ...t, 
      duration: Number(t.duration) || 0,
      isManual: t.task_mode === 'Manually Scheduled',
      wbs_code: t.wbs_code || '0' // Fallback jika wbs kosong
    }));

    // 2. Urutkan dengan aman
    cpmTasks.sort((a, b) => {
      return String(a.wbs_code).localeCompare(String(b.wbs_code), undefined, { numeric: true });
    });

    // --- FASE 1: FORWARD PASS ---
    const taskMap = {};
    cpmTasks.forEach(t => taskMap[t.wbs_code] = t);

    cpmTasks.forEach((task) => {
      if (task.summary === 'Yes') return; 

      if (task.isManual) {
        task.ES_date = task.start_date || projectStartDate;
        task.EF_date = task.end_date || task.start_date;
        return;
      }

      let esDate = new Date(projectStartDate);
      if (isNaN(esDate.getTime())) esDate = new Date(); // Fallback jika tanggal proyek invalid

      const preds = parsePredecessors(task.predecessors);
      if (preds.length > 0) {
        let maxES = new Date(esDate);
        
        preds.forEach(p => {
          const predTask = taskMap[p.wbs];
          if (predTask && predTask.EF_date) {
            let p_ef = new Date(predTask.EF_date);
            let p_es = new Date(predTask.ES_date || predTask.EF_date);
            
            if (p.type === 'FS') {
              let potentialES = new Date(p_ef);
              potentialES.setDate(potentialES.getDate() + 1 + p.lag);
              if (potentialES > maxES) maxES = potentialES;
            } else if (p.type === 'SS') {
              let potentialES = new Date(p_es);
              potentialES.setDate(potentialES.getDate() + p.lag);
              if (potentialES > maxES) maxES = potentialES;
            }
          }
        });
        esDate = maxES;
      }

      while (!isWorkingDay(esDate)) {
        esDate.setDate(esDate.getDate() + 1);
      }

      task.ES_date = esDate.toISOString().split('T')[0];
      task.EF_date = addWorkingDays(task.ES_date, task.duration);
    });

    // --- FASE 2: BACKWARD PASS ---
    let projectFinishDate = new Date(projectStartDate);
    if (isNaN(projectFinishDate.getTime())) projectFinishDate = new Date();

    cpmTasks.forEach(t => {
      if (t.EF_date) {
        let ef = new Date(t.EF_date);
        if (!isNaN(ef.getTime()) && ef > projectFinishDate) projectFinishDate = ef;
      }
    });

    for (let i = cpmTasks.length - 1; i >= 0; i--) {
      let task = cpmTasks[i];
      if (task.summary === 'Yes' || task.isManual) continue;

      let lfDate = new Date(projectFinishDate);
      let successors = cpmTasks.filter(t => parsePredecessors(t.predecessors).some(p => p.wbs === task.wbs_code));
      
      if (successors.length > 0) {
        let minLF = new Date('2100-01-01');
        successors.forEach(succ => {
          let rel = parsePredecessors(succ.predecessors).find(p => p.wbs === task.wbs_code);
          if (rel && succ.LS_date) {
            let s_ls = new Date(succ.LS_date);
            if (rel.type === 'FS') {
              let potentialLF = new Date(s_ls);
              potentialLF.setDate(potentialLF.getDate() - 1 - rel.lag);
              if (potentialLF < minLF) minLF = potentialLF;
            }
          }
        });
        lfDate = minLF;
      }

      task.LF_date = lfDate.toISOString().split('T')[0];
      
      let lsDate = new Date(lfDate);
      let dur = task.duration;
      let tempDur = 1;
      while (tempDur < dur) {
        lsDate.setDate(lsDate.getDate() - 1);
        if (isWorkingDay(lsDate)) tempDur++;
      }
      task.LS_date = lsDate.toISOString().split('T')[0];

      let es = new Date(task.ES_date);
      let ls = new Date(task.LS_date);
      let floatDays = Math.round((ls - es) / (1000 * 60 * 60 * 24));
      task.total_float = floatDays > 0 ? floatDays : 0;
      task.is_critical = task.total_float === 0;
    }

    return cpmTasks;
  } catch (err) {
    console.error("CPM Engine Error:", err);
    // Jika engine error, kembalikan data asli agar tabel tidak kosong
    return tasks; 
  }
};
