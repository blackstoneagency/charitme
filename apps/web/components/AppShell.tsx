'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase-browser';

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = path === href || (href !== '/' && path.startsWith(href));
  return (
    <Link href={href} style={{
      fontSize: '14px',
      fontWeight: 600,
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

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

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
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'var(--green)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 800,
            }}>
              AI
            </div>
            <span style={{ fontWeight: 800, fontSize: '17px', color: 'var(--t1)' }}>
              RaiseMoney
            </span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }} className="desktop-nav">
            <NavLink href="/campaigns">Trusted campaigns</NavLink>
            {user && <NavLink href="/dashboard">AI dashboard</NavLink>}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} className="desktop-nav">
            {user ? (
              <>
                <Link href="/create" style={{
                  padding: '8px 18px',
                  background: 'var(--green)',
                  color: '#fff',
                  borderRadius: 'var(--r)',
                  fontWeight: 700,
                  fontSize: '14px',
                }}>
                  Start trusted campaign
                </Link>
                <button onClick={handleSignOut} style={{ fontSize: '14px', color: 'var(--t3)', fontWeight: 600 }}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t2)' }}>
                  Sign in
                </Link>
                <Link href="/login?mode=signup" style={{
                  padding: '8px 18px',
                  background: 'var(--green)',
                  color: '#fff',
                  borderRadius: 'var(--r)',
                  fontWeight: 700,
                  fontSize: '14px',
                }}>
                  Get started
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="mobile-menu-btn"
            aria-label="Open navigation"
            style={{ fontSize: '22px', color: 'var(--t1)', display: 'none' }}
          >
            {menuOpen ? 'x' : 'menu'}
          </button>
        </div>

        {menuOpen && (
          <div style={{
            borderTop: '1px solid var(--b1)',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: '#fff',
          }} className="mobile-drawer">
            <Link href="/campaigns" onClick={() => setMenuOpen(false)} style={{ fontWeight: 600, color: 'var(--t2)' }}>Trusted campaigns</Link>
            {user && <Link href="/dashboard" onClick={() => setMenuOpen(false)} style={{ fontWeight: 600, color: 'var(--t2)' }}>AI dashboard</Link>}
            {user ? (
              <>
                <Link href="/create" onClick={() => setMenuOpen(false)} style={{ fontWeight: 700, color: 'var(--green)' }}>Start trusted campaign</Link>
                <button onClick={handleSignOut} style={{ fontWeight: 600, color: 'var(--t3)', textAlign: 'left' }}>Sign out</button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)} style={{ fontWeight: 600 }}>Sign in</Link>
                <Link href="/login?mode=signup" onClick={() => setMenuOpen(false)} style={{ fontWeight: 700, color: 'var(--green)' }}>Get started</Link>
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
          <span style={{ fontWeight: 800, color: 'var(--t2)' }}>RaiseMoney</span>
          <span style={{ fontSize: '13px', color: 'var(--t4)' }}>Copyright {new Date().getFullYear()} RaiseMoney. Trust-first fundraising.</span>
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
