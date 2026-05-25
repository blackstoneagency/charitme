'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase-browser';

const NAV = [
  ['Features', '/features'],
  ['How it works', '/how-it-works'],
  ['Pricing', '/pricing'],
  ['Trust', '/trust-safety'],
  ['AI', '/ai-fundraising'],
  ['Campaigns', '/campaigns'],
] as const;

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = path === href || (href !== '/' && path.startsWith(href));
  return (
    <Link href={href} className={`text-sm font-bold transition ${active ? 'text-emerald-700' : 'text-slate-600 hover:text-slate-950'}`}>
      {children}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white">GR</div>
            <div>
              <div className="text-lg font-black leading-none text-slate-950">GiveRise</div>
              <div className="hidden text-[11px] font-bold text-slate-500 sm:block">Fundraising with built-in trust</div>
            </div>
          </Link>

          <nav className="hidden flex-1 items-center gap-5 lg:flex">
            {NAV.map(([label, href]) => <NavLink key={href} href={href}>{label}</NavLink>)}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {user ? (
              <>
                <Link href="/dashboard" className="text-sm font-bold text-slate-600">Dashboard</Link>
                <Link href="/create" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">Start free</Link>
                <button onClick={handleSignOut} className="text-sm font-bold text-slate-500">Logout</button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-bold text-slate-600">Login</Link>
                <Link href="/login?mode=signup" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">Start free</Link>
              </>
            )}
          </div>

          <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black lg:hidden" onClick={() => setMenuOpen((open) => !open)}>
            Menu
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-slate-200 bg-white px-5 py-4 lg:hidden">
            <div className="flex flex-col gap-4">
              {NAV.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="font-bold text-slate-700">{label}</Link>)}
              <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="font-bold text-slate-700">Dashboard</Link>
              <Link href="/create" onClick={() => setMenuOpen(false)} className="font-black text-emerald-700">Start free fundraiser</Link>
              {user ? <button onClick={handleSignOut} className="text-left font-bold text-slate-500">Logout</button> : <Link href="/login" className="font-bold text-slate-700">Login</Link>}
            </div>
          </div>
        )}
      </header>

      <main className="min-h-[calc(100vh-64px)]">{children}</main>

      <footer className="border-t border-slate-200 bg-slate-950 py-10 text-white">
        <div className="container grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="text-xl font-black">GiveRise</div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Free fundraising powered by AI, trust scores, transparent pricing, and fast verified payouts.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-300">
            <Link href="/faq">FAQ</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/for-nonprofits">Nonprofits</Link>
            <Link href="/for-donors">Donors</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
