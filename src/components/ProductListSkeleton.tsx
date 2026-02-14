export function ProductListSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="h-8 w-48 bg-[var(--border)] rounded-lg animate-pulse mb-8" />
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-56 shrink-0 space-y-6">
          <div className="h-20 bg-[var(--border)] rounded-lg animate-pulse" />
          <div className="h-12 bg-[var(--border)] rounded-lg animate-pulse" />
          <div className="h-12 bg-[var(--border)] rounded-lg animate-pulse" />
        </aside>
        <div className="flex-1">
          <div className="flex justify-between mb-6">
            <div className="h-5 w-24 bg-[var(--border)] rounded animate-pulse" />
            <div className="h-10 w-32 bg-[var(--border)] rounded-lg animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="aspect-square bg-[var(--border)] animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-[var(--border)] rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-[var(--border)] rounded animate-pulse w-1/2" />
                  <div className="h-5 bg-[var(--border)] rounded animate-pulse w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
