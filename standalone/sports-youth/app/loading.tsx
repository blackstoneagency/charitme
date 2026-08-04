/** Skeleton sized like the real content, so the footer does not start at the top
 *  and jump down when data arrives (cumulative layout shift). */
export default function Loading() {
  return (
    <main className="mx-auto max-w-[1280px] animate-pulse px-5 py-10">
      <div className="h-[320px] rounded-xl2 bg-surface" />
      <div className="mt-6 h-[120px] rounded-card bg-surface" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-[300px] rounded-card bg-surface" />)}
      </div>
    </main>
  );
}
