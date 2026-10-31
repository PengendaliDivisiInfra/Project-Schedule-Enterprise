import Sidebar from '../components/Sidebar';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'] });

export const metadata = {
  title: 'ProManage Enterprise',
  description: 'Sistem Manajemen Proyek Konstruksi',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${jakarta.className} flex bg-slate-50 h-screen overflow-hidden text-slate-800`}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
