export default function DonorProfileLoading() {
  return (
    <div className="bg-white min-h-screen" aria-busy="true" aria-label="Loading donor profile">
      <section className="border-b border-slate-100 bg-slate-50 py-10">
        <div className="container">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-slate-200" />
            <div className="space-y-2">
              <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-100 py-8">
        <div className="container">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
            ))}
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="container">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 lg:col-span-1" />
            <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 lg:col-span-2" />
          </div>
        </div>
      </section>
    </div>
  );
}
