'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Login from '../components/Login';

export default function NewLoginPage() {
  const router = useRouter();
  const [header, setHeader] = useState({
    title: 'Welcome back',
    subtitle: 'enter your credentials to log into your dashboard!',
  });

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-[#f0f2f4] px-4 py-4 dark:bg-[#161B24] md:px-6 md:py-6 lg:py-4">
      <div className="w-full max-w-[26.25rem]">
        <div className="mb-10 flex justify-center lg:mb-2  -mt-16 max-w-[7.5rem] mx-auto md:max-w-auto">
          <img src="/logo_new.png" alt="Craftsmen" className="mb-8 h-auto w-auto object-contain lg:w-[6.25rem]" />
        </div>

        <div className="mb-3 text-center lg:mb-2 -mt-8">
          <h1 className="text-[1.625rem] font-medium leading-tight text-[#1E1E1E] dark:text-[#E4E9F0] md:text-[1.875rem] lg:text-[1.5rem]">{header.title}</h1>
          <p className="mt-1 text-[0.75rem] text-[#7B808A] dark:text-[#8A94A6] md:text-[0.8125rem] lg:text-[0.75rem]">{header.subtitle}</p>
        </div>

        <div className="my-4 border-b border-[#AEB3BC] dark:border-[#2E3A52] lg:my-3 mt-6 lg:mt-10">
          <div className="grid grid-cols-2">
            <button
              type="button"
              className="cursor-pointer rounded-t-xl border-b-2 border-[#3676E0] bg-[#E6EEFF] px-3 py-2 text-[1rem] font-medium text-[#3676E0] dark:bg-[#1A2F52] dark:text-[#5B9BFF] lg:text-[0.9375rem]"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => router.push('/signup')}
              className="cursor-pointer rounded-t-md px-3 py-2 text-[1rem] text-[#666D78] transition-colors hover:text-[#1E2530] dark:text-[#8A94A6] dark:hover:text-[#E4E9F0] lg:text-[0.9375rem]"
            >
              Sign up
            </button>
          </div>
        </div>

        <div className="w-full animate-fade-in mt-4 lg:mt-6">
          <Login onSwitchToSignup={() => router.push('/new-signup')} onHeaderChange={setHeader} />
        </div>
      </div>
    </div>
  );
}
