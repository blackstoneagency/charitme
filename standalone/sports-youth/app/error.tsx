'use client';

/** Route-level error boundary. A cause page must degrade to something a visitor
 *  can act on, not a blank screen. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="text-h2">Something went wrong</h1>
      <p className="mt-3 text-ink-3">We could not load this page. The campaigns are still there.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="cta-primary">Try again</button>
        <a href="/campaigns" className="btn-secondary">Browse campaigns</a>
      </div>
    </main>
  );
}
