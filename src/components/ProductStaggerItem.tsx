import type { CSSProperties, ReactNode } from 'react'

type Props = {
  index: number
  children: ReactNode
  className?: string
}

/**
 * Wraps a product card so grids can play a staggered fade/slide-in.
 * Delay is capped in a 12-item wave so "load more" stays snappy.
 */
export function ProductStaggerItem({ index, children, className = '' }: Props) {
  const style = { ['--stagger-i' as string]: index % 12 } as CSSProperties
  return (
    <div className={`product-stagger-item min-w-0 w-full ${className}`.trim()} style={style}>
      {children}
    </div>
  )
}
