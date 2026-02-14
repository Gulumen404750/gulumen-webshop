export function ProductPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="h-4 w-64 bg-[var(--border)] rounded animate-pulse mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-4">
          <div className="aspect-square rounded-xl bg-[var(--border)] animate-pulse" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-20 h-20 rounded-lg bg-[var(--border)] animate-pulse" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-9 w-3/4 bg-[var(--border)] rounded animate-pulse" />
          <div className="h-8 w-40 bg-[var(--border)] rounded animate-pulse" />
          <div className="h-4 w-full bg-[var(--border)] rounded animate-pulse" />
          <div className="h-12 w-32 bg-[var(--border)] rounded-lg animate-pulse mt-6" />
        </div>
      </div>
    </div>
  )
}
