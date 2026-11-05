import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useProjectStore } from '../store/useProjectStore';

export function useRealtimeWBS(projectId) {
  const { updateTaskInStore, removeTaskFromStore, addTaskToStore } = useProjectStore();

  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`wbs-changes-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wbs_tasks', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') addTaskToStore(payload.new);
          if (payload.eventType === 'UPDATE') updateTaskInStore(payload.new);
          if (payload.eventType === 'DELETE') removeTaskFromStore(payload.old.id);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, updateTaskInStore, removeTaskFromStore, addTaskToStore]);
}