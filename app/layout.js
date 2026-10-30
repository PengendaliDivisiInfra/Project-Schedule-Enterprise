import './globals.css';

export const metadata = {
  title: 'ProManage Enterprise',
  description: 'Project Management & EVM Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        <main className="max-w-7xl mx-auto p-4 md:p-6">{children}</main>
      </body>
    </html>
  );
}