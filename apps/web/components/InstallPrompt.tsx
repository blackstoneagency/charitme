'use client';

import { useEffect, useState } from 'react';
import { Btn } from './ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'charitme-pwa-install-dismissed';

export default function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible || !promptEvent) return null;

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  const install = async () => {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setVisible(false);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 1000,
        maxWidth: 480,
        margin: '0 auto',
        display: 'flex', minWidth: 0,
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 'var(--rl, 16px)',
        background: 'var(--s1, #fff)',
        border: '1px solid var(--b1, #eef0f7)',
        boxShadow: 'var(--shadow-lg, 0 22px 70px rgba(55,42,130,.18))',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          flexShrink: 0,
          background: 'linear-gradient(135deg, #7c55ff, #6d35ff)',
        }}
        aria-hidden
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)' }}>Install CharitMe</div>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>Add to your home screen for quick, app-like access.</div>
      </div>
      <Btn variant="ghost" size="sm" onClick={dismiss}>
        Not now
      </Btn>
      {/* Darker green than the default primary so white label meets WCAG AA (4.5:1). */}
      <Btn variant="primary" size="sm" onClick={install} style={{ background: '#0a7a3d' }}>
        Install
      </Btn>
    </div>
  );
}
