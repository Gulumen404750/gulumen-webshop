export function isPaperBackground(r: number, g: number, b: number, a?: number): boolean

export function contentSquare(
  info: { width: number; height: number; channels: number },
  pixels: Buffer
): { left: number; top: number; width: number; height: number }

export function circleMaskSvg(size: number): Buffer

export function pngToIco(png: Buffer, width?: number, height?: number): Buffer

export function applyCircleMask(pngBuffer: Buffer, size: number): Promise<Buffer>

export function resolveSourcePath(cliPath?: string, root?: string): string

export function generateFavicons(options?: {
  sourcePath?: string
  publicDir?: string
  appDir?: string
  syncAppIcons?: boolean
}): Promise<{ source: string; written: string[] }>

export const ROOT: string
export const OUTPUTS: { name: string; size: number; format: string }[]
