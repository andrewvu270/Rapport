'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/src/lib/supabase';

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-[#09090b]/90 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/history"
          className="text-sm font-semibold text-zinc-100 tracking-tight hover:text-white transition-colors"
        >
          NetWork
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/history"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/history')
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
            }`}
          >
            History
          </Link>

          <Link
            href="/prep"
            className="ml-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-500 hover:bg-violet-600 text-white transition-colors active:scale-[0.98]"
          >
            + New Prep
          </Link>

          <button
            onClick={handleLogout}
            className="ml-1 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
