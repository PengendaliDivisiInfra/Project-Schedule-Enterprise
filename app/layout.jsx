import './globals.css';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { ProjectProvider } from '../context/ProjectContext';
import ClientLayout from '../components/ClientLayout';
import ToastListener from '../components/ToastListener';
import BottomNav from '../components/BottomNav';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'InfraControl PRO — Enterprise Construction ERP',
  description: 'Enterprise Project Controls, Cost Engineering & Multi-PM Governance Platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <head>
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
