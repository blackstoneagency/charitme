'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KFIcon } from './KindFundApp';

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    try {
      // POST to server-side signout — revokes the refresh token and clears cookies
      await fetch('/api/auth/signout', { method: 'POST' });
    } finally {
      router.push('/login');
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-label="Sign out"
      className="kf-logout-btn"
    >
      <KFIcon name="logout" />
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
