'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import NProgress from 'nprogress';

// Konfigurasi agar progress bar terlihat lebih halus
NProgress.configure({ showSpinner: false, trickleSpeed: 100, minimum: 0.1 });

export default function TopLoader() {
  const pathname = usePathname();

  useEffect(() => {
    // Tunda 400ms sebelum menyelesaikan loading, agar garis biru terlihat oleh user
    const timer = setTimeout(() => {
      NProgress.done();
    }, 400);

    return () => {
      clearTimeout(timer);
      NProgress.start();
    };
  }, [pathname]);

  return null;
}
