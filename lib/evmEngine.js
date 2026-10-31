// lib/evmEngine.js
import { isWorkingDay, getWorkingDaysDiff } from './cpmEngine';

export const generateEVMData = (tasks, projectStartDate, statusDateStr, dailyRecords = []) => {
  const statusDate = new Date(statusDateStr);
  if (isNaN(statusDate.getTime())) return { chartData: [], summaryKPI: {} };

  let minDate = new Date(projectStartDate);
  let maxDate = new Date(projectStartDate);
  let totalBAC = 0;

  const leafTasks = tasks.filter(t => t.summary !== 'Yes');
  leafTasks.forEach(t => {
    const s = new Date(t.start_date); const f = new Date(t.end_date);
    if (s < minDate) minDate = s;
    if (f > maxDate) maxDate = f;
    totalBAC += Number(t.cost || 0);
  });

  if (leafTasks.length === 0) return { chartData: [], summaryKPI: { bac: 0, spi: 1, cpi: 1, eac: 0, etc: 0, vac: 0, tcpi: 1 } };

  const dateRange = [];
  let curDate = new Date(minDate);
  while (curDate <= maxDate) {
    dateRange.push(curDate.toISOString().split('T')[0]);
    curDate.setDate(curDate.getDate() + 1);
  }

  // Kelompokkan progress records berdasarkan task_id untuk pencarian cepat
  const recordsByTask = {};
  dailyRecords.forEach(r => {
    if (!recordsByTask[r.task_id]) recordsByTask[r.task_id] = [];
    recordsByTask[r.task_id].push(r);
  });

  const chartData = [];
  let cumulativePV = 0;
  let cumulativeAC = 0;

  dateRange.forEach(dateStr => {
    const currentDate = new Date(dateStr);
    let dailyPV = 0;

    // Kalkulasi PV Harian
    leafTasks.forEach(task => {
      const s = new Date(task.start_date); const f = new Date(task.end_date);
      const duration = Math.max(1, getWorkingDaysDiff(task.start_date, task.end_date));
      const cost = Number(task.cost || 0);

      if (isWorkingDay(currentDate)) {
        if (currentDate >= s && currentDate <= f) dailyPV += cost / duration;
      }
    });
    cumulativePV += dailyPV;
    
    // Kalkulasi AC & EV
    let currentEV = 0;
    if (currentDate <= statusDate) {
      // AC: Jumlahkan semua actual_cost pada tanggal ini
      const dayRecords = dailyRecords.filter(r => r.record_date === dateStr);
      const dailyAC = dayRecords.reduce((sum, r) => sum + Number(r.actual_cost), 0);
      cumulativeAC += dailyAC;

      // EV: Hitung progress kumulatif tiap task hingga tanggal ini
      leafTasks.forEach(task => {
        const taskRecords = recordsByTask[task.id] || [];
        // Ambil record terakhir untuk task ini sebelum atau sama dengan tanggal saat ini
        const validRecords = taskRecords.filter(r => new Date(r.record_date) <= currentDate);
        
        if (validRecords.length > 0) {
          // Urutkan berdasarkan tanggal untuk mengambil yang paling baru
          validRecords.sort((a, b) => new Date(b.record_date) - new Date(a.record_date));
          const latestRecord = validRecords[0];
          const progress = Number(latestRecord.progress_percent) || 0;
          currentEV += Number(task.cost || 0) * (progress / 100);
        }
      });
    }

    chartData.push({
      date: dateStr,
      name: currentDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
      PV: Math.round(cumulativePV),
      EV: currentDate <= statusDate ? Math.round(currentEV) : null,
      AC: currentDate <= statusDate ? Math.round(cumulativeAC) : null,
    });
  });

  // KPI tepat di Status Date
  const targetData = chartData.find(d => d.date === statusDateStr) || chartData[chartData.length - 1];
  const pvAtStatus = targetData.PV || 0;
  const evAtStatus = targetData.EV || 0;
  const acAtStatus = targetData.AC || 0;

  const spi = pvAtStatus > 0 ? (evAtStatus / pvAtStatus) : 1.0;
  const cpi = acAtStatus > 0 ? (evAtStatus / acAtStatus) : 1.0;
  
  const workRemaining = totalBAC - evAtStatus;
  let etc = 0;
  if (workRemaining > 0) etc = cpi > 0 ? (workRemaining / cpi) : workRemaining;
  const eac = acAtStatus + etc;
  const vac = totalBAC - eac;
  const tcpiBac = (totalBAC - acAtStatus) > 0 ? (workRemaining / (totalBAC - acAtStatus)) : 1.0;

  return {
    chartData,
    summaryKPI: { bac: totalBAC, spi: Number(spi.toFixed(3)), cpi: Number(cpi.toFixed(3)), etc: Math.round(etc), eac: Math.round(eac), vac: Math.round(vac), tcpi: Number(tcpiBac.toFixed(3)) || 1.000 }
  };
};
