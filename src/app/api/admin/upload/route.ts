/**
 * POST /api/admin/upload
 * Multipart form: file = image file.
 * Ha Bunny Storage env be van állítva → oda tölt fel, CDN URL-t ad vissza.
 * Egyébként lokális public/uploads (dev / fallback).
 */
import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import {
  MAX_IMAGE_INPUT_SIZE,
  optimizeImageToWebp,
  persistOptimizedWebp,
} from '@/lib/image-optimize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i

function isAllowedImage(file: File): boolean {
  const mime = (file.type || '').toLowerCase()
  if (ALLOWED_TYPES.includes(mime)) return true
  if (!mime || mime === 'application/octet-stream') {
    return IMAGE_EXT_RE.test(file.name || '')
  }
  return false
}

export async function POST(request: Request) {
  const gate = await requireAdminPermission('uploads:write')
  if (!gate.ok) return gate.response

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Érvénytelen űrlap' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Nincs fájl' }, { status: 400 })
  }

  if (file.size > MAX_IMAGE_INPUT_SIZE) {
    return NextResponse.json(
      {
        error: `A kép mérete legfeljebb ${Math.round(MAX_IMAGE_INPUT_SIZE / 1024 / 1024)} MB lehet. Használj kisebb fájlt vagy tömörítsd a képet.`,
      },
      { status: 400 }
    )
  }
  if (!isAllowedImage(file)) {
    return NextResponse.json(
      {
        error:
          'Ez a fájl nem képként ismerhető fel. Próbálj JPG, PNG, WebP, GIF, AVIF vagy HEIC fájlt, vagy mentsd PNG-ként.',
      },
      { status: 400 }
    )
  }

  const baseName = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const filename = `${baseName}.webp`

  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    let optimized: Buffer
    try {
      optimized = await optimizeImageToWebp(buffer)
    } catch (decodeErr) {
      console.error('Image decode/optimize error:', decodeErr)
      await logAdminAction({
        action: 'file_upload',
        success: false,
        request,
        details: { reason: 'decode_error', originalName: file.name, size: file.size },
      })
      return NextResponse.json(
        {
          error:
            'A kép nem olvasható (HEIC/iPhone fotó a szerveren nem dekódolható, vagy a fájl sérült). Nyisd meg a Fotók appban, és mentsd JPG/PNG-ként, majd csatold újra.',
        },
        { status: 400 }
      )
    }

    const stored = await persistOptimizedWebp(filename, optimized, { allowLocalFallback: true })
    await logAdminAction({
      action: 'file_upload',
      success: true,
      request,
      details: { filename, storage: stored.storage, originalName: file.name, size: file.size },
    })
    return NextResponse.json({ success: true, url: stored.url, storage: stored.storage })
  } catch (err) {
    console.error('Upload/optimize error:', err)
    await logAdminAction({
      action: 'file_upload',
      success: false,
      request,
      details: { reason: 'error', originalName: file instanceof File ? file.name : undefined },
    })
    return NextResponse.json(
      {
        error: 'A kép feldolgozása sikertelen. Ellenőrizd a formátumot (JPEG, PNG, WebP, GIF).',
      },
      { status: 500 }
    )
  }
}
