// lib/cpm-calculator.js

// 1. Parsing Predecessor (Format: "1.3FS+5")
export const parsePredecessors = (predString) => {
  if (!predString) return [];
  return predString.split(',').map(s => {
    const match = s.trim().match(/^([0-9.]+)(FS|SS|FF|SF)?([+-]\d+)?$/i);
    if (match) return { wbs: match[1], type: match[2] ? match[2].toUpperCase() : 'FS', lag: parseInt(match[3] || '0', 10) };
    return null;
  }).filter(Boolean);
};

// 2. Utility Fungsi Tanggal
const addDays = (date, days) => {
  let result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// 3. CPM Engine (Topological & Safe Iteration)
export const calculateScheduleEngine = (tasks) => {
  if (!tasks || tasks.length === 0) return [];
  
  // A. Topological Sort: Mengurutkan berdasarkan WBS agar dependensi terpenuhi lebih dulu
  const sortedTasks = [...tasks].sort((a, b) => 
    a.wbs_code.localeCompare(b.wbs_code, undefined, { numeric: true })
  );

  const taskMap = new Map();

  // B. FORWARD PASS (Menghitung ES & EF)
  // Menggunakan iterasi for...of untuk memastikan taskMap sudah terisi sebelum diakses
  for (const task of sortedTasks) {
    let es = new Date(task.start_date || task.start || Date.now());
    es.setHours(0, 0, 0, 0);
    
    const preds = parsePredecessors(task.predecessors);
    
    for (const pred of preds) {
      const predTask = taskMap.get(pred.wbs);
      if (predTask) {
        if (pred.type === 'FS') {
          // Finish-to-Start: Mulai setelah pendahulu selesai + lag
          const candidateES = addDays(new Date(predTask.early_finish), pred.lag + 1);
          if (candidateES > es) es = candidateES;
        } else if (pred.type === 'SS') {
          // Start-to-Start: Mulai bersamaan + lag
          const candidateES = addDays(new Date(predTask.early_start), pred.lag);
          if (candidateES > es) es = candidateES;
        }
      }
    }

    const duration = parseInt(task.duration) || 1;
    const ef = addDays(es, duration - 1); // Finish date

    // Simpan ke Map agar bisa diakses oleh task berikutnya
    taskMap.set(task.wbs_code, {
      ...task,
      early_start: es,
      early_finish: ef
    });
  }

  // C. BACKWARD PASS (Menghitung LS, LF, Total Float)
  // Iterasi terbalik (dari task paling akhir)
  const forwardTasksArray = Array.from(taskMap.values());
  const reverseTasks = [...forwardTasksArray].reverse();
  
  for (const task of reverseTasks) {
    let lf = new Date(task.early_finish); // Default untuk task terakhir
    
    // Cari Successor (Task yang menjadikan task ini sebagai pendahulu)
    const successors = forwardTasksArray.filter(t => t.predecessors && t.predecessors.includes(task.wbs_code));
    
    if (successors.length > 0) {
      // LF adalah nilai LS paling awal dari successor
      lf = new Date(Math.min(...successors.map(s => s.late_start ? s.late_start.getTime() : s.early_start.getTime())));
    }

    const duration = parseInt(task.duration) || 1;
    const ls = addDays(lf, -(duration - 1));
    
    // Total Float = Late Finish - Early Finish (dalam hari)
    const totalFloat = Math.round((lf.getTime() - task.early_finish.getTime()) / (1000 * 3600 * 24));

    // Update state di Map
    taskMap.set(task.wbs_code, {
      ...taskMap.get(task.wbs_code),
      late_start: ls,
      late_finish: lf,
      total_float: totalFloat,
      is_critical: totalFloat === 0 // Flag Critical Path
    });
  }

  // D. Kembalikan array sesuai urutan awal
  return sortedTasks.map(t => taskMap.get(t.wbs_code));
};