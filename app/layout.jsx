import './globals.css';
import { ProjectProvider } from '../context/ProjectContext';
import ClientLayout from '../components/ClientLayout';
import ToastListener from '../components/ToastListener';
import BottomNav from '../components/BottomNav';

export const metadata = {
  title: 'InfraControl PRO — Enterprise Construction ERP',
  description: 'Enterprise Project Controls, Cost Engineering & Multi-PM Governance Platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="font-sans">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="InfraControl" />
      </head>

      <body className="font-sans antialiased bg-slate-50 text-slate-900 selection:bg-indigo-600/15 selection:text-indigo-900">
        <ProjectProvider>
          <ClientLayout>
            <main className="pb-20 md:pb-0">
              {children}
            </main>
            <BottomNav />
          </ClientLayout>
        </ProjectProvider>
        <ToastListener />
      </body>
    </html>
  );
}
