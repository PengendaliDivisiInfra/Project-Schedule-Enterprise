'use client';

export default function SidebarToggle() {
  const toggleSidebar = () => {
    document.body.classList.toggle('sidebar-hidden');
  };

  return (
    <button 
      onClick={toggleSidebar} 
      className="fixed bottom-6 right-6 z-[9999] bg-slate-800 text-white p-3 rounded-full shadow-lg hover:bg-slate-700 transition-all print:hidden flex items-center justify-center"
      title="Tampilkan/Sembunyikan Sidebar"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
    </button>
  );
}
