import './globals.css';
import 'nprogress/nprogress.css';
import ClientLayout from '../components/ClientLayout';
import { ProjectProvider } from '../context/ProjectContext';
import ToastListener from '../components/ToastListener';

export const metadata = {
  title: 'InfraControl PRO',
  description: 'Enterprise Project Management System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ProjectProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </ProjectProvider>
        <ToastListener />
      </body>
    </html>
  );
}