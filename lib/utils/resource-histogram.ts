import { ResourceRequirement } from "@/types/resource-plan";

export interface HistogramDataPoint {
  date: string;
  fullDate: string;
  totalTeams: number;
  totalCost: number;
}

export function generateResourceHistogram(
  planData: (ResourceRequirement & { start_date?: string, end_date?: string })[]
): HistogramDataPoint[] {
  if (!planData || planData.length === 0) return [];

  let minDate = new Date();
  let maxDate = new Date();
  let hasValidDates = false;

  planData.forEach(task => {
    if (task.start_date && task.end_date) {
      const tStart = new Date(task.start_date);
      const tEnd = new Date(task.end_date);
      
      if (!hasValidDates) {
        minDate = tStart;
        maxDate = tEnd;
        hasValidDates = true;
      } else {
        if (tStart < minDate) minDate = tStart;
        if (tEnd > maxDate) maxDate = tEnd;
      }
    }
  });

  if (!hasValidDates) return [];

  // Buffer 3 hari di awal & akhir
  const start = new Date(minDate);
  start.setDate(start.getDate() - 3);
  const end = new Date(maxDate);
  end.setDate(end.getDate() + 3);

  const dailyMap = new Map<string, HistogramDataPoint>();
  
  // Inisialisasi kerangka tanggal
  let current = new Date(start);
  while (current <= end) {
    const dateKey = current.toISOString().split('T')[0];
    dailyMap.set(dateKey, {
      date: current.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
      fullDate: dateKey,
      totalTeams: 0,
      totalCost: 0
    });
    current.setDate(current.getDate() + 1);
  }

  planData.forEach((task) => {
    // FIX 1: ABAIKAN MATERIAL, HANYA HITUNG TENAGA KERJA & ALAT
    if (!task.start_date || !task.end_date || task.resource_type === 'Bahan') return;

    const taskStart = new Date(task.start_date);
    const taskEnd = new Date(task.end_date);

    // FIX 2: JANGAN BAGI DENGAN DURASI LAGI. 
    // task.jumlah_tim DARI PAGE.JSX SUDAH BERUPA ANGKA HARIAN.
    const teamsPerDay = task.jumlah_tim || 0;
    const costPerDay = (task.daily_cost || 0) * teamsPerDay;

    let iterDate = new Date(taskStart);
    while (iterDate <= taskEnd) {
      const dateKey = iterDate.toISOString().split('T')[0];
      const point = dailyMap.get(dateKey);
      
      if (point) {
        point.totalTeams += teamsPerDay;
        point.totalCost += costPerDay;
      }
      iterDate.setDate(iterDate.getDate() + 1);
    }
  });

  return Array.from(dailyMap.values()).sort((a, b) => a.fullDate.localeCompare(b.fullDate));
}