'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase-browser';

const NAV = [
  ['How It Works', '/how-it-works'],
  ['AI Fundraising', '/ai-fundraising'],
  ['Success Stories', '/campaigns'],
  ['Pricing', '/pricing'],
  ['Resources', '/faq'],
] as const;

const FOOTER_LINKS = {
  Platform: [
    ['How It Works', '/how-it-works'],
    ['AI Fundraising', '/ai-fundraising'],
    ['Success Stories', '/campaigns'],
    ['Pricing', '/pricing'],
  ],
  Resources: [
    ['Blog', '/faq'],
    ['Guides', '/how-it-works'],
    ['Help Center', '/faq'],
    ['Webinars', '/contact'],
  ],
  Company: [
    ['About Us', '/contact'],
    ['Careers', '/contact'],
    ['Press', '/contact'],
    ['Contact', '/contact'],
  ],
  Legal: [
    ['Trust & Safety', '/trust-safety'],
    ['Privacy Policy', '/contact'],
    ['Terms of Service', '/contact'],
    ['Security', '/trust-safety'],
  ],
} as const;

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = path === href || (href !== '/' && path.startsWith(href));
  return (
    <Link
      href={href}
      className={`text-sm font-bold transition ${active ? 'text-violet-700' : 'text-slate-600 hover:text-slate-950'}`}
    >
      {children}
    </Link>
  );
}

const SHELL_BYPASS = ['/dashboard', '/admin', '/profile', '/create'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const bypass = SHELL_BYPASS.some((p) => path === p || path.startsWith(p + '/'));

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, [supabase]);

  if (bypass) return <>{children}</>;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <>
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-base font-black text-white"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              ♥
            </div>
            <div>
              <div className="text-lg font-black leading-none text-slate-950">GiveRise</div>
              <div className="hidden text-[10px] font-bold text-slate-400 sm:block">Intelligent fundraising.</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden flex-1 items-center gap-6 lg:flex">
            {NAV.map(([label, href]) => (
              <NavLink key={href} href={href}>{label}</NavLink>
            ))}
          </nav>

          {/* Desktop auth */}
          <div className="hidden items-center gap-3 lg:flex">
            {user ? (
              <>
                <Link href="/dashboard" className="text-sm font-bold text-slate-600 hover:text-slate-950">Dashboard</Link>
                <Link
                  href="/create"
                  className="rounded-xl px-4 py-2 text-sm font-black text-white transition hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                >
                  Start Fundraising
                </Link>
                <button onClick={handleSignOut} className="text-sm font-bold text-slate-400 hover:text-slate-600">Logout</button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-bold text-slate-600 hover:text-slate-950">Log in</Link>
                <Link
                  href="/login?mode=signup"
                  className="rounded-xl px-5 py-2 text-sm font-black text-white transition hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                >
                  Start Fundraising
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-700 lg:hidden"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="border-t border-slate-100 bg-white px-5 py-5 lg:hidden">
            <div className="flex flex-col gap-4">
              {NAV.map(([label, href]) => (
                <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="font-bold text-slate-700 hover:text-violet-700">
                  {label}
                </Link>
              ))}
              <hr className="border-slate-100" />
              {user ? (
                <>
                  <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="font-bold text-slate-700">Dashboard</Link>
                  <Link href="/create" onClick={() => setMenuOpen(false)} className="font-black text-violet-700">Start Fundraising</Link>
                  <button onClick={handleSignOut} className="text-left font-bold text-slate-400">Logout</button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMenuOpen(false)} className="font-bold text-slate-700">Log in</Link>
                  <Link href="/login?mode=signup" onClick={() => setMenuOpen(false)} className="font-black text-violet-700">Start Fundraising</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="min-h-[calc(100vh-64px)]">{children}</main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 bg-slate-950 pt-14 pb-8 text-white">
        <div className="container">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[220px_1fr_180px]">

            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                >
                  ♥
                </div>
                <span className="text-lg font-black">GiveRise</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Intelligent fundraising.<br />Real world impact.
              </p>
            </div>

            {/* Link columns */}
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {(Object.entries(FOOTER_LINKS) as [string, readonly (readonly [string, string])[]][]).map(([section, links]) => (
                <div key={section}>
                  <div className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">{section}</div>
                  <ul className="space-y-2">
                    {links.map(([label, href]) => (
                      <li key={label}>
                        <Link href={href} className="text-sm text-slate-400 transition hover:text-white">
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* App + Social */}
            <div>
              <div className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Get the app</div>
              <div className="flex flex-col gap-2">
                <Link href="/" className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-slate-500">
                  <span className="text-base">🍎</span> App Store
                </Link>
                <Link href="/" className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-slate-500">
                  <span className="text-base">▶</span> Google Play
                </Link>
              </div>
              <div className="mt-5 mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Follow us</div>
              <div className="flex gap-3">
                {['f', '𝕏', 'in', '📷', '♪'].map((icon) => (
                  <Link key={icon} href="/" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-xs text-slate-400 transition hover:border-slate-500 hover:text-white">
                    {icon}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-6 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} GiveRise. All rights reserved.</span>
            <div className="flex gap-4">
              <Link href="/contact" className="hover:text-slate-300">Privacy</Link>
              <Link href="/contact" className="hover:text-slate-300">Terms</Link>
              <Link href="/trust-safety" className="hover:text-slate-300">Security</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
