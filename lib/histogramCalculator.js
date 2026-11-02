// lib/histogramCalculator.js
const DEFAULT_CAPACITY = 8;
const PRODUCTIVITY_FACTOR = 0.85; // Mu / E (standar 0.85)

export function calculateResourceHistogram(tasks, taskAssignments, resources, workingDays = [1,2,3,4,5], exceptions = []) {
  const empty = { resources: [], overallocatedDates: {}, overallocatedCount: 0 };
  if (!Array.isArray(tasks) || !Array.isArray(taskAssignments) || !Array.isArray(resources)) {
    return empty;
  }

  const resourceMap = new Map();
  resources.forEach(r => {
    const cap = Number(r.daily_capacity) || DEFAULT_CAPACITY;
    const type = (r.category || r.type || '').toLowerCase();
    const isEquipment = type.includes('alat') || type.includes('equipment');
    
    resourceMap.set(r.id, {
      id: r.id, 
      name: r.name ?? r.nama ?? 'Unnamed', 
      unit: r.unit ?? r.satuan ?? '',
      category: r.category ?? r.kategori ?? 'other', 
      capacity: cap, 
      isEquipment,
      loadByDate: {}, 
      maxLoad: 0,
      maxCrewSize: 0 // Tambahan untuk menyimpan Crew Size maksimal
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

    const taskVolume = Number(task.volume) || 0;
    const koefisien = Number(a.koefisien) || 0;
    const duration = Math.max(1, Number(task.duration) || 1);
    
    let dailyLoadInHours = 0;
    
    if (taskVolume > 0 && koefisien > 0) {
       if (res.isEquipment) {
           // FORMULA D: Jika K dalam satuan Jam, Total = V*K. Jika Hari, V*K*8.
           // Asumsi standar AHSP alat adalah Jam. Jadi V*K langsung.
           const totalEquipHours = taskVolume * koefisien; 
           dailyLoadInHours = totalEquipHours / (duration * PRODUCTIVITY_FACTOR);
       } else {
           // FORMULA B: TR (Orang-Hari) = V * K. Total Man-Hours = TR * 8
           const totalResourceDays = taskVolume * koefisien;
           const totalManHours = totalResourceDays * 8;
           dailyLoadInHours = totalManHours / duration;
           
           // Hitung Crew Size (Jumlah Pekerja)
           const crewSize = dailyLoadInHours / (8 * PRODUCTIVITY_FACTOR);
           if (crewSize > res.maxCrewSize) res.maxCrewSize = crewSize;
       }
    } else {
       dailyLoadInHours = res.capacity;
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