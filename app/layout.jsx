import './globals.css';
import ClientLayout from '../components/ClientLayout';

export const metadata = {
  title: 'InfraControl PRO',
  description: 'Enterprise Project Management System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
