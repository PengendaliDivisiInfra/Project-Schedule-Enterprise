import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Fungsi Debounce untuk mencegah spam query database
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => { clearTimeout(timeout); func(...args); };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const useProjectStore = create((set, get) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  
  // Optimistic UI Update
  updateTaskInStore: (updatedTask) => {
    set((state) => ({
      tasks: state.tasks.map((t) => t.id === updatedTask.id ? { ...t, ...updatedTask } : t)
    }));
  },

  addTaskToStore: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  
  removeTaskFromStore: (taskId) => set((state) => ({ 
    tasks: state.tasks.filter(t => t.id !== taskId) 
  })),

  // Sync ke Database dengan Debounce & Error Handling (Optimistic Locking)
  syncTaskToDB: debounce(async (taskId, changes, lastUpdatedAt) => {
    const { data, error } = await supabase
      .from('wbs_tasks')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('updated_at', lastUpdatedAt) // Cek versi terakhir (Optimistic Lock)
      .select();

    if (error) {
      console.error('Gagal sinkronisasi:', error);
    } else if (data && data.length === 0) {
      // Jika data kosong, berarti updated_at tidak cocok (diubah user lain)
      alert('Konflik Data: Jadwal ini baru saja diubah oleh pengguna lain. Silakan refresh halaman untuk melihat data terbaru.');
    }
  }, 800)
}));