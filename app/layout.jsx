import './globals.css';
import { ProjectProvider } from '../context/ProjectContext';
import 'nprogress/nprogress.css';
import { ProjectProvider } from '../context/ProjectContext';
import ClientLayout from '../components/ClientLayout';

import { ProjectProvider } from '../context/ProjectContext';
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
      </body>
    </html>
  );
}
