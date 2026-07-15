import type { ReactNode } from 'react'

type EmptyStateLayoutProps = {
  illustration: ReactNode
  title?: string
  description?: string
  children?: ReactNode
  className?: string
}

export function EmptyStateLayout({
  illustration,
  title,
  description,
  children,
  className = '',
}: EmptyStateLayoutProps) {
  return (
    <div
      className={`flex flex-col items-center text-center py-10 px-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card-bg)]/50 ${className}`}
    >
      <div className="mb-5 text-accent" aria-hidden>
        {illustration}
      </div>
      {title && (
        <h2 className="font-heading text-lg font-semibold text-foreground mb-2">{title}</h2>
      )}
      {description && <p className="text-muted text-sm max-w-md mb-6">{description}</p>}
      {children}
    </div>
  )
}
