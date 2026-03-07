import type { CSSProperties, HTMLAttributes } from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': HTMLAttributes<HTMLElement> & {
        src?: string
        alt?: string
        'camera-controls'?: boolean
        'auto-rotate'?: boolean
        'shadow-intensity'?: string | number
        'environment-image'?: string
        style?: CSSProperties
      }
    }
  }
}
