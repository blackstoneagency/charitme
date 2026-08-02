'use client';

import { useEffect } from 'react';
import { Btn, BtnLink, EmptyState } from '../components/ui';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container" style={{ maxWidth: 560, margin: '0 auto', padding: '80px 24px' }}>
      <EmptyState
        icon="⚠️"
        title="Something went wrong"
        body="We hit an unexpected error loading this page. Try again, or head back to the homepage."
        action={
          <div style={{ display: 'flex', minWidth: 0, gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Btn variant="primary" onClick={() => reset()}>Try again</Btn>
            <BtnLink href="/" variant="secondary">Back to home</BtnLink>
          </div>
        }
      />
    </div>
  );
}
