import type React from 'react';

export function PublicIcon({ name, className = '' }: { name: string; className?: string }) {
  const props = { className: `pub-icon ${className}`, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<string, React.ReactNode> = {
    ai: <><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>,
    mail: <><path d="M4 4h16v16H4z" /><path d="m22 6-10 7L2 6" /></>,
    chart: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-7" /></>,
    bot: <><rect x="5" y="8" width="14" height="10" rx="3" /><path d="M12 8V4" /><path d="M8 13h.01M16 13h.01" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
    play: <path d="M9 7l8 5-8 5V7Z" />,
    dollar: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 10c0-1.4 1.3-2 3-2s3 .6 3 2-1.3 2-3 2-3 .6-3 2 1.3 2 3 2 3-.6 3-2" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    refresh: <><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8" /><path d="M21 3v5h-5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.8 15.4 6.2M8.6 13.2l6.8 4.6" /></>,
    calendar: <><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="2" /></>,
    search: <><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="M20 6 9 17l-5-5" />,
    tag: <><path d="M20.6 13.2 13.2 20.6a2 2 0 0 1-2.8 0L3 13.2V3h10.2l7.4 7.4a2 2 0 0 1 0 2.8Z" /><path d="M7.5 7.5h.01" /></>,
  };
  return <svg {...props}>{paths[name] ?? paths.ai}</svg>;
}
