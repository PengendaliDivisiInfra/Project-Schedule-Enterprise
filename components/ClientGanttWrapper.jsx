'use client';

import dynamic from 'next/dynamic';
import LoadingSpinner from './LoadingSpinner';

// Matikan SSR untuk komponen Gantt agar tidak crash saat build/render di server
const AdvancedGantt = dynamic(() => import('./AdvancedGantt'), {
  ssr: false,
  loading: () => <LoadingSpinner text="Memuat Gantt Chart..." />
});

export default function ClientGanttWrapper(props) {
  return <AdvancedGantt {...props} />;
}
