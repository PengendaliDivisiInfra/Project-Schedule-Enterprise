import Sidebar from '../components/Sidebar';
import './globals.css';

export const metadata = {
  title: 'Project Schedule App',
  description: 'Aplikasi Manajemen Proyek Konstruksi',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex bg-gray-50 h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
