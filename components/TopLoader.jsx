'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import NProgress from 'nprogress';

NProgress.configure({ showSpinner: false, trickleSpeed: 200 });

export default function TopLoader() {
  const pathname = usePathname();

  useEffect(() => {
    NProgress.done();
    return () => {
      NProgress.start();
    };
  }, [pathname]);

  return null;
}
