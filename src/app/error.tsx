'use client'; // Error components must be Client Components

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#FAFAF9] text-[#0C0A09] p-4">
      <div className="max-w-md w-full bg-white border border-[#E8ECF0] rounded-3xl p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-black tracking-tight mb-2">Something went wrong!</h2>
        <p className="text-sm text-[#57534E] mb-8 leading-relaxed">
          We encountered an unexpected error. Don't worry, your data is safe.
        </p>
        <button
          onClick={() => reset()}
          className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-[#0C0A09] text-white hover:bg-slate-800 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
