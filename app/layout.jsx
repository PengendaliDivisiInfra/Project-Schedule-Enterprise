import './globals.css';
import { ProjectProvider } from '../context/ProjectContext';
import ClientLayout from '../components/ClientLayout'; 
import ToastListener from '../components/ToastListener'; 
import BottomNav from '../components/BottomNav';

export const metadata = {
  title: 'InfraControl PRO',
  description: 'Enterprise Project Management System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="InfraControl" />
      </head>
      
      <body>
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