// app/gantt/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import GanttChart from '@/components/GanttChart';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function GanttPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [baselines, setBaselines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // 1. Ambil Tasks
      const { data: taskData, error } = await supabase
        .from('wbs_tasks')
        .select('*')
        .order('wbs_code', { ascending: true });

      if (error) {
        console.error("Gagal fetch tasks:", error);
        setLoading(false);
        return;
      }

      // 2. Mapping ke Format DHTMLX
      const formattedTasks = taskData.map((t) => ({
        id: t.id,
        text: t.name,
        start_date: new Date(t.start_date).toISOString().split('T')[0],
        duration: t.duration,
        progress: t.progress_percent / 100,
        parent: t.parent_id || 0,
        open: true
      }));

      // 3. Mapping Links (Dependensi)
      const formattedLinks: any[] = [];
      taskData.forEach((t) => {
        if (t.predecessors && Array.isArray(t.predecessors)) {
          t.predecessors.forEach((pred: any, index: number) => {
            formattedLinks.push({
              id: `link-${t.id}-${index}`,
              source: pred.task_id,
              target: t.id,
              type: "0", // "0" = Finish-to-Start
            });
          });
        }
      });

      // 4. Data Dummy Resource (Ganti dengan query Supabase nanti)
      const dummyResources = [
        { id: "r1", name: "Pekerja", type: "work" },
        { id: "r2", name: "Mandor", type: "work" },
      ];

      // 5. Data Dummy Baseline (Ganti dengan query tabel 'baselines' nanti)
      const dummyBaselines = [
        { id: "b1", task_id: taskData[0]?.id, start_date: new Date().toISOString(), duration: 5 },
      ];

      setTasks(formattedTasks);
      setLinks(formattedLinks);
      setResources(dummyResources);
      setBaselines(dummyBaselines);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin mr-2" /> Memuat...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
          <h1 className="text-xl font-bold">Enterprise Gantt Workspace</h1>
        </div>
        <span className="text-sm text-slate-500">{tasks.length} Tasks | {links.length} Links</span>
      </div>
      <div className="flex-1 p-4 overflow-hidden">
        <GanttChart tasks={tasks} links={links} resources={resources} baselines={baselines} />
      </div>
    </div>
  );
}