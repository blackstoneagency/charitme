'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = path === href || (href !== '/' && path.startsWith(href));
  return (
    <Link href={href} style={{
      fontSize: '14px',
      fontWeight: 500,
      color: active ? 'var(--green)' : 'var(--t2)',
      padding: '6px 4px',
      borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
      transition: 'color .15s',
    }}>
      {children}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--b1)',
        boxShadow: 'var(--shadow)',
      }}>
        <div className="container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
          gap: '32px',
        }}>
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{
              width: '32px', height: '32px',
              background: 'var(--green)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '18px',
            }}>
              ↑
            </div>
            <span style={{ fontWeight: 800, fontSize: '17px', color: 'var(--t1)', letterSpacing: '-0.3px' }}>
              RaiseMoney
            </span>
          </Link>

          {/* Desktop nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }} className="desktop-nav">
            <NavLink href="/campaigns">Browse</NavLink>
            {user && <NavLink href="/dashboard">Dashboard</NavLink>}
          </nav>

          {/* Desktop actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} className="desktop-nav">
            {user ? (
              <>
                <Link href="/create" style={{
                  padding: '8px 18px',
                  background: 'var(--green)',
                  color: '#fff',
                  borderRadius: 'var(--r)',
                  fontWeight: 600,
                  fontSize: '14px',
                }}>
                  Start a campaign
                </Link>
                <button onClick={handleSignOut} style={{
                  fontSize: '14px',
                  color: 'var(--t3)',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--t2)' }}>
                  Sign in
                </Link>
                <Link href="/login?mode=signup" style={{
                  padding: '8px 18px',
                  background: 'var(--green)',
                  color: '#fff',
                  borderRadius: 'var(--r)',
                  fontWeight: 600,
                  fontSize: '14px',
                }}>
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="mobile-menu-btn"
            style={{ fontSize: '22px', color: 'var(--t1)', display: 'none' }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div style={{
            borderTop: '1px solid var(--b1)',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: '#fff',
          }} className="mobile-drawer">
            <Link href="/campaigns" onClick={() => setMenuOpen(false)} style={{ fontWeight: 500, color: 'var(--t2)' }}>Browse campaigns</Link>
            {user && <Link href="/dashboard" onClick={() => setMenuOpen(false)} style={{ fontWeight: 500, color: 'var(--t2)' }}>Dashboard</Link>}
            {user ? (
              <>
                <Link href="/create" onClick={() => setMenuOpen(false)} style={{ fontWeight: 600, color: 'var(--green)' }}>Start a campaign</Link>
                <button onClick={handleSignOut} style={{ fontWeight: 500, color: 'var(--t3)', textAlign: 'left' }}>Sign out</button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)} style={{ fontWeight: 500 }}>Sign in</Link>
                <Link href="/login?mode=signup" onClick={() => setMenuOpen(false)} style={{ fontWeight: 600, color: 'var(--green)' }}>Get started</Link>
              </>
            )}
          </div>
        )}
      </header>

      <main style={{ minHeight: 'calc(100vh - 64px)' }}>{children}</main>

      <footer style={{
        borderTop: '1px solid var(--b1)',
        padding: '40px 0',
        marginTop: '80px',
        background: 'var(--s1)',
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <span style={{ fontWeight: 700, color: 'var(--t2)' }}>RaiseMoney</span>
          <span style={{ fontSize: '13px', color: 'var(--t4)' }}>© {new Date().getFullYear()} RaiseMoney. All rights reserved.</span>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}
