import ClientLayout from '../components/ClientLayout';
import './globals.css';

export const metadata = {
  title: 'Project Schedule App',
  description: 'Aplikasi Manajemen Proyek Konstruksi',
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
