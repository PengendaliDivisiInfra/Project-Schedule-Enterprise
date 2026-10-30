// lib/cpmEngine.js

// 1. Fungsi Kalender Kerja (Skip Sabtu & Minggu)
export const isWorkingDay = (date) => {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 = Minggu, 6 = Sabtu
};

// Menambahkan hari kerja ke tanggal mulai
export const addWorkingDays = (startDateStr, durationInDays) => {
  if (!startDateStr || durationInDays <= 0) return startDateStr;
  let date = new Date(startDateStr);
  
  // Jika tanggal mulai jatuh di weekend, majukan ke Senin
  while (!isWorkingDay(date)) {
    date.setDate(date.getDate() + 1);
  }
  
  let addedDays = 1; // Hari pertama dihitung 1
  while (addedDays < durationInDays) {
    date.setDate(date.getDate() + 1);
    if (isWorkingDay(date)) {
      addedDays++;
    }
  }
  return date.toISOString().split('T')[0];
};

// Menghitung selisih hari kerja antara 2 tanggal
export const getWorkingDaysDiff = (startDateStr, endDateStr) => {
  if (!startDateStr || !endDateStr) return 0;
  let start = new Date(startDateStr);
  let end = new Date(endDateStr);
  if (start > end) return 0;
  
  let count = 0;
  let cur = new Date(start);
  while (cur <= end) {
    if (isWorkingDay(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

// 2. Parser Predecessor (Contoh: "1.1FS+2d, 1.2SS")
export const parsePredecessors = (predStr) => {
  if (!predStr) return [];
  const regex = /([0-9.]+)\s*(FS|SS|FF|SF)?\s*([+-]\d+)?d?/gi;
  const matches = [...predStr.matchAll(regex)];
  return matches.map(m => ({
    wbs: m[1],
    type: (m[2] || 'FS').toUpperCase(),
    lag: m[3] ? parseInt(m[3]) : 0
  }));
};

// 3. Algoritma Utama CPM (Forward & Backward Pass)
export const calculateCPM = (tasks, projectStartDate) => {
  // Clone tasks agar tidak memutasi state asli
  let cpmTasks = tasks.map(t => ({ 
    ...t, 
    duration: Number(t.duration) || 0,
    isManual: t.task_mode === 'Manually Scheduled'
  }));

  // Urutkan berdasarkan WBS
  cpmTasks.sort((a, b) => a.wbs_code.localeCompare(b.wbs_code, undefined, { numeric: true }));

  // --- FASE 1: FORWARD PASS (Hitung Maju) ---
  const taskMap = {};
  cpmTasks.forEach(t => taskMap[t.wbs_code] = t);

  cpmTasks.forEach((task, index) => {
    if (task.summary === 'Yes') return; // Summary dihitung di akhir

    if (task.isManual) {
      // Jika manual, pakai input user
      task.ES_date = task.start_date;
      task.EF_date = task.end_date;
      return;
    }

    let esDate = projectStartDate;

    // Cek Predecessor
    const preds = parsePredecessors(task.predecessors);
    if (preds.length > 0) {
      let maxES = new Date(projectStartDate);
      
      preds.forEach(p => {
        const predTask = taskMap[p.wbs];
        if (predTask) {
          let p_ef = new Date(predTask.EF_date || projectStartDate);
          let p_es = new Date(predTask.ES_date || projectStartDate);
          
          if (p.type === 'FS') {
            // FS: ES = Predecessor EF + 1 hari + Lag
            let potentialES = new Date(p_ef);
            potentialES.setDate(potentialES.getDate() + 1 + p.lag);
            if (potentialES > maxES) maxES = potentialES;
          } else if (p.type === 'SS') {
            // SS: ES = Predecessor ES + Lag
            let potentialES = new Date(p_es);
            potentialES.setDate(potentialES.getDate() + p.lag);
            if (potentialES > maxES) maxES = potentialES;
          }
        }
      });
      esDate = maxES;
    }

    // Pastikan ES jatuh di hari kerja
    while (!isWorkingDay(esDate)) {
      esDate.setDate(esDate.getDate() + 1);
    }

    task.ES_date = esDate.toISOString().split('T')[0];
    task.EF_date = addWorkingDays(task.ES_date, task.duration);
  });

  // --- FASE 2: SUMMARY TASKS (Induk mengambil Min ES & Max EF dari Anak) ---
  // Menggunakan pendekatan sederhana: Summary mengambil semua anak di bawahnya (berdasarkan indentasi/WBS)
  // Untuk versi ini, kita asumsikan summary task dihitung manual atau dibiarkan
  // (Di MS Project, Summary start = min(child.start), finish = max(child.finish))
  
  // --- FASE 3: BACKWARD PASS (Hitung Mundur untuk Float) ---
  // Cari tanggal selesai proyek paling akhir
  let projectFinishDate = new Date(projectStartDate);
  cpmTasks.forEach(t => {
    if (t.EF_date) {
      let ef = new Date(t.EF_date);
      if (ef > projectFinishDate) projectFinishDate = ef;
    }
  });

  // Iterasi mundur
  for (let i = cpmTasks.length - 1; i >= 0; i--) {
    let task = cpmTasks[i];
    if (task.summary === 'Yes' || task.isManual) continue;

    let lfDate = new Date(projectFinishDate);
    
    // Cari Successor
    let successors = cpmTasks.filter(t => parsePredecessors(t.predecessors).some(p => p.wbs === task.wbs_code));
    
    if (successors.length > 0) {
      let minLF = new Date('2100-01-01');
      successors.forEach(succ => {
        let rel = parsePredecessors(succ.predecessors).find(p => p.wbs === task.wbs_code);
        let s_ls = new Date(succ.LS_date || projectFinishDate);
        
        if (rel.type === 'FS') {
          let potentialLF = new Date(s_ls);
          potentialLF.setDate(potentialLF.getDate() - 1 - rel.lag);
          if (potentialLF < minLF) minLF = potentialLF;
        }
      });
      lfDate = minLF;
    }

    task.LF_date = lfDate.toISOString().split('T')[0];
    
    // LS = LF - Duration + 1
    let lsDate = new Date(lfDate);
    let dur = task.duration;
    let tempDur = 1;
    while (tempDur < dur) {
      lsDate.setDate(lsDate.getDate() - 1);
      if (isWorkingDay(lsDate)) tempDur++;
    }
    task.LS_date = lsDate.toISOString().split('T')[0];

    // Hitung Total Float (Hari)
    let es = new Date(task.ES_date);
    let ls = new Date(task.LS_date);
    let floatDays = Math.round((ls - es) / (1000 * 60 * 60 * 24));
    task.total_float = floatDays > 0 ? floatDays : 0;
    
    // Tentukan Critical Path
    task.is_critical = task.total_float === 0;
  }

  return cpmTasks;
};
