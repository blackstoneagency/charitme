import React from 'react';

/**
 * Shown when a read failed and the figures beside it are unknown rather than zero.
 *
 * The reassurance is the point, not decoration: a dashboard that says "$0 raised,
 * 0 donors" because a query timed out is telling an organizer their money is gone.
 * Pair this with `—` values — never with a number that was not measured.
 */
export default function DegradedReadNotice({
  title = "We couldn't load these figures",
  children,
  style,
}: {
  title?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      role="alert"
      style={{
        marginBottom: 16,
        padding: '14px 16px',
        borderRadius: 12,
        background: 'var(--s2, #fffbeb)',
        border: '1px solid var(--b2, #fde68a)',
        color: 'var(--t1, #92400e)',
        ...style,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 4 }}>{title}</strong>
      <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
        {children ?? (
          <>
            This is a temporary problem on our side — your campaigns and funds are
            unaffected. Anything showing &ldquo;—&rdquo; is unknown, not zero. Reload
            the page to try again.
          </>
        )}
      </span>
    </div>
  );
}
