'use client';
import React, { useState } from 'react';
import { Btn } from '../../components/ui';

export default function ConnectButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <Btn onClick={handleConnect} loading={loading} variant="primary">
      Connect Stripe
    </Btn>
  );
}
