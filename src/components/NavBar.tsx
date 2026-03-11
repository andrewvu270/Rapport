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
    <header className="sticky top-0 z-50 border-b border-ink/[0.06] bg-cream/90 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="text-base font-extrabold tracking-tight text-ink shrink-0">
          Rapport
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/dashboard"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/dashboard')
                ? 'bg-ink/[0.06] text-ink'
                : 'text-ink-muted hover:text-ink hover:bg-ink/[0.04]'
            }`}
          >
            Home
          </Link>
          <Link
            href="/history"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/history')
                ? 'bg-ink/[0.06] text-ink'
                : 'text-ink-muted hover:text-ink hover:bg-ink/[0.04]'
            }`}
          >
            Library
          </Link>

          <Link
            href="/prep"
            className="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-ink text-cream hover:bg-ink/80 transition-colors"
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden xs:inline">New Prep</span>
          </Link>

          <button
            onClick={handleLogout}
            aria-label="Log out"
            className="ml-1 px-3 py-1.5 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition-colors cursor-pointer"
          >
            <span className="hidden sm:inline">Log out</span>
            <svg className="w-4 h-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </nav>
      </div>
    </header>
  );
}
