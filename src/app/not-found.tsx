import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#FAFAF9] text-[#0C0A09] p-4">
      <div className="max-w-md w-full bg-white border border-[#E8ECF0] rounded-3xl p-8 text-center shadow-sm">
        <h2 className="text-4xl font-black tracking-tight mb-2">404</h2>
        <h3 className="text-lg font-bold text-[#0C0A09] mb-3">Page Not Found</h3>
        <p className="text-sm text-[#57534E] mb-8 leading-relaxed">
          Could not find the requested resource. The page might have been moved or deleted.
        </p>
        <Link
          href="/"
          className="block w-full py-3 px-4 rounded-xl font-bold text-sm bg-[#0C0A09] text-white hover:bg-slate-800 transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
