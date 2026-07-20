'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn } from '../../../components/ui';

export default function ApplyButton({ grantSlug }: { grantSlug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/grants/${grantSlug}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.status === 401) {
        router.push(`/login?next=/grants/${grantSlug}`);
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not start application');
      router.push(`/dashboard/grants?application=${json.application?.id ?? ''}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Btn size="lg" loading={loading} onClick={start} style={{ width: '100%' }}>
        Start application
      </Btn>
      {error && <span style={{ fontSize: 12, color: 'var(--red-text)' }}>{error}</span>}
    </div>
  );
}
