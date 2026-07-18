'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import Carousel from './Carousel';

function AuthSplashScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#f0f2f4] dark:bg-[#161B24]">
      <div className="flex flex-col items-center gap-4">
        {/* <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#D8E3F5] border-t-[#3676E0]" /> */}
        {/* <p className="text-sm font-medium text-[#556070] dark:text-[#8A94A6]">
          Loading...
        </p> */}
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [showCarousel, setShowCarousel] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.dataset.authDesktop === '1' : false,
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setShowCarousel(mq.matches);

    update();
    mq.addEventListener('change', update);
    const raf = window.requestAnimationFrame(() => setIsReady(true));
    return () => {
      mq.removeEventListener('change', update);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  if (!isReady) {
    return <AuthSplashScreen />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-[#0F1117]">
      <Script id="auth-desktop-flag" strategy="beforeInteractive">
        {`(() => {
          try {
            document.documentElement.dataset.authDesktop = window.matchMedia('(min-width: 1024px)').matches ? '1' : '0';
          } catch (e) {}
        })();`}
      </Script>

      {showCarousel && (
        <div className="h-full shrink-0 lg:block lg:w-1/2">
          <Carousel />
        </div>
      )}

      <div className="h-full w-full overflow-y-auto bg-[#f0f2f4] dark:bg-[#161B24] lg:w-1/2">
        {children}
      </div>
    </div>
  );
}
