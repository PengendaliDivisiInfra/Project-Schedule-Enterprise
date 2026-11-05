// lib/utils/resource-leveling.ts
import { ResourceRequirement } from "@/types/resource-plan";

export interface LevelingSuggestion {
  task_id: string;
  task_name: string;
  wbs_code: string;
  current_start: string;
  current_end: string;
  new_start: string;
  new_end: string;
  shift_days: number;
  reason: string;
}

/**
 * Mencari rekomendasi pergeseran jadwal untuk menurunkan beban kerja
 */
export function generateLevelingSuggestion(
  peakDate: string,
  activeTasks: (ResourceRequirement & { start_date: string, end_date: string, jumlah_tim: number })[],
  currentLimit: number,
  maxShiftDays: number = 5
): LevelingSuggestion | null {
  if (!activeTasks || activeTasks.length === 0) return null;

  // 1. Urutkan tugas: Prioritaskan tugas yang baru saja dimulai (paling aman digeser)
  // dan bukan pekerjaan utama (misal: jangan geser pekerjaan persiapan/mobilisasi)
  const candidates = [...activeTasks]
    // FIX TYPESCRIPT: Gunakan (t.task_name || '') agar aman dari nilai undefined
    .filter(t => (t.task_name || '').toLowerCase() !== 'mobilisasi' && t.jumlah_tim > 0)
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

  if (candidates.length === 0) return null;

  const targetTask = candidates[0];
  
  // 2. Kalkulasi pergeseran yang dibutuhkan
  const taskStart = new Date(targetTask.start_date);
  const taskEnd = new Date(targetTask.end_date);

  for (let shift = 1; shift <= maxShiftDays; shift++) {
    const newStart = new Date(taskStart);
    newStart.setDate(newStart.getDate() + shift);
    
    const newEnd = new Date(taskEnd);
    newEnd.setDate(newEnd.getDate() + shift);

    const newStartStr = newStart.toISOString().split('T')[0];
    const newEndStr = newEnd.toISOString().split('T')[0];

    if (newStartStr > peakDate) {
      return {
        task_id: targetTask.id || targetTask.task_id || '',
        task_name: targetTask.task_name || 'Pekerjaan Tanpa Nama',
        wbs_code: targetTask.wbs_code || '-',
        current_start: targetTask.start_date,
        current_end: targetTask.end_date,
        new_start: newStartStr,
        new_end: newEndStr,
        shift_days: shift,
        reason: `Digeser ${shift} hari ke depan untuk menghindari puncak beban (${peakDate}).`
      };
    }
  }

  return null;
}