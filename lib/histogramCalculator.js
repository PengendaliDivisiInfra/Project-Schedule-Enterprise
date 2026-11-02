// lib/histogramCalculator.js
const DEFAULT_CAPACITY = 8;
const PRODUCTIVITY_FACTOR = 0.85;

export function calculateResourceHistogram(tasks, taskAssignments, resources, workingDays = [1,2,3,4,5], exceptions = []) {
  const empty = { resources: [], overallocatedDates: {}, overallocatedCount: 0 };
  if (!Array.isArray(tasks) || !Array.isArray(taskAssignments) || !Array.isArray(resources)) return empty;

  const resourceMap = new Map();
  resources.forEach(r => {
    const cap = Number(r.daily_capacity) || DEFAULT_CAPACITY;
    const type = (r.category || r.type || '').toLowerCase();
    const isEquipment = type.includes('alat') || type.includes('equipment');
    
    resourceMap.set(r.id, {
      id: r.id, name: r.name ?? r.nama ?? 'Unnamed', unit: r.unit ?? r.satuan ?? '',
      category: r.category ?? r.kategori ?? 'other', capacity: cap, isEquipment,
      loadByDate: {}, maxLoad: 0, maxCrewSize: 0
    });
  });

  const taskById = new Map(tasks.map(t => [t.id, t]));
  const exceptionSet = new Set(exceptions.map(e => e.exception_date));
  const workingDaySet = new Set(workingDays.map(Number));

  taskAssignments.forEach(a => {
    const task = taskById.get(a.task_id);
    if (!task || !task.start_date || !task.end_date) return;

    const res = resourceMap.get(a.resource_id);
    if (!res) return;

    // 1. Dapatkan Volume Total & Progress
    const totalVolume = Math.abs(Number(task.volume) || 0);
    const progressPct = Number(task.progress_percent) || 0;
    
    // 2. Hitung Sisa Volume (Prioritaskan data dari EVM, jika tidak ada hitung manual)
    let sisaVolume = 0;
    if (task.sisa_vol !== undefined && task.sisa_vol !== null) {
        sisaVolume = Math.abs(Number(task.sisa_vol));
    } else {
        sisaVolume = totalVolume - (totalVolume * (progressPct / 100));
    }

    // 3. Hitung Sisa Hari (Prioritaskan dari EVM, jika tidak ada gunakan durasi total)
    let sisaHari = 1;
    if (task.sisa_hari_efektif !== undefined && task.sisa_hari_efektif !== null) {
        sisaHari = Math.max(1, Number(task.sisa_hari_efektif));
    } else {
        sisaHari = Math.max(1, Number(task.duration) || 1);
    }

    const koefisien = Math.abs(Number(a.koefisien) || 0);
    
    let dailyLoadInHours = 0;
    
    // LOGIKA BARU: Gunakan Sisa Volume dan Sisa Hari
    if (sisaVolume > 0 && koefisien > 0) {
       const totalResourceDays = sisaVolume * koefisien;
       const totalManHours = totalResourceDays * 8;
       
       if (res.isEquipment) {
           dailyLoadInHours = totalManHours / (sisaHari * PRODUCTIVITY_FACTOR);
       } else {
           dailyLoadInHours = totalManHours / sisaHari;
           
           let crewSize = dailyLoadInHours / (8 * PRODUCTIVITY_FACTOR);
           if (!isFinite(crewSize) || isNaN(crewSize) || crewSize < 0) crewSize = 0;
           
           if (crewSize > res.maxCrewSize) res.maxCrewSize = crewSize;
       }
    } else {
       // Jika sisa volume 0 (selesai), beban kerja 0
       dailyLoadInHours = 0;
    }

    // SAFETY GUARD
    if (!isFinite(dailyLoadInHours) || isNaN(dailyLoadInHours) || dailyLoadInHours < 0) {
        dailyLoadInHours = 0;
    }

    const effectiveDays = [];
    const cur = new Date(task.start_date);
    const end = new Date(task.end_date);
    while (cur <= end) {
      const dStr = toDateStr(cur);
      if (workingDaySet.has(cur.getDay()) && !exceptionSet.has(dStr)) {
        effectiveDays.push(dStr);
      }
      cur.setDate(cur.getDate() + 1);
    }
    if (effectiveDays.length === 0) return;

    effectiveDays.forEach(dStr => {
      res.loadByDate[dStr] = (res.loadByDate[dStr] || 0) + dailyLoadInHours;
    });
  });

  const overallocatedDates = {};
  let overallocatedCount = 0;
  resourceMap.forEach(r => {
    Object.entries(r.loadByDate).forEach(([dStr, load]) => {
      if (load > r.capacity) {
        if (!overallocatedDates[dStr]) overallocatedDates[dStr] = [];
        overallocatedDates[dStr].push(r.id);
        overallocatedCount++;
      }
      if (load > r.maxLoad) r.maxLoad = load;
    });
  });

  return { resources: Array.from(resourceMap.values()), overallocatedDates, overallocatedCount };
}

function toDateStr(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}