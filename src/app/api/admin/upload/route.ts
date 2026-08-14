/**
 * POST /api/admin/upload
 * Multipart form: file = image file.
 * Ha Bunny Storage env be van állítva → oda tölt fel, CDN URL-t ad vissza.
 * Egyébként lokális public/uploads (dev / fallback).
 */
import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import {
  cleanCdnUrl,
  getCdnBaseUrl,
  isBunnyUploadConfigured,
} from '@/lib/cdn'
import { logAdminAction } from '@/lib/admin-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UPLOAD_DIR = 'public/uploads'
const MAX_INPUT_SIZE = 25 * 1024 * 1024
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
const MAX_WIDTH = 2000
const MAX_HEIGHT = 2000
const WEBP_QUALITY = 85

async function optimizeToWebp(buffer: Buffer): Promise<Buffer> {
  // rotate() alkalmazza az EXIF orientációt (iPhone fotók ne legyenek fektetve)
  return sharp(buffer)
    .rotate()
    .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()
}

function isAllowedImage(file: File): boolean {
  const mime = (file.type || '').toLowerCase()
  if (ALLOWED_TYPES.includes(mime) || mime.startsWith('image/')) return true
  if (!mime || mime === 'application/octet-stream') {
    return IMAGE_EXT_RE.test(file.name || '')
  }
  return false
}

async function uploadToBunny(filename: string, body: Buffer): Promise<string> {
  const zone = process.env.BUNNY_STORAGE_ZONE!.trim()
  const apiKey = process.env.BUNNY_STORAGE_API_KEY!.trim()
  const region = (process.env.BUNNY_STORAGE_REGION || '').trim()
  // pl. storage.bunnycdn.com vagy de.storage.bunnycdn.com
  const storageHost = region
    ? `${region.replace(/\.$/, '')}.storage.bunnycdn.com`
    : 'storage.bunnycdn.com'
  const folder = (process.env.BUNNY_STORAGE_PATH || 'products').replace(/^\/+|\/+$/g, '')
  const storagePath = `${folder}/${filename}`
  const putUrl = `https://${storageHost}/${zone}/${storagePath}`

  const res = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      AccessKey: apiKey,
      'Content-Type': 'image/webp',
    },
    body: new Uint8Array(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Bunny feltöltés sikertelen (${res.status}): ${text || res.statusText}`)
  }

  const cdnUrl = `${getCdnBaseUrl()}/${storagePath}`
  return cleanCdnUrl(cdnUrl)
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission('uploads:write')
  if (!auth.ok) return auth.response

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

  if (file.size > MAX_INPUT_SIZE) {
    return NextResponse.json(
      {
        error: `A kép mérete legfeljebb ${Math.round(MAX_INPUT_SIZE / 1024 / 1024)} MB lehet. Használj kisebb fájlt vagy tömörítsd a képet.`,
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
      optimized = await optimizeToWebp(buffer)
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

    if (isBunnyUploadConfigured()) {
      const url = await uploadToBunny(filename, optimized)
      await logAdminAction({
        action: 'file_upload',
        success: true,
        request,
        details: { filename, storage: 'bunny', originalName: file.name, size: file.size },
      })
      return NextResponse.json({ success: true, url, storage: 'bunny' })
    }

    // Lokális fallback (dev) – productionban állíts be Bunny env-eket
    const dir = path.join(process.cwd(), UPLOAD_DIR)
    const filepath = path.join(dir, filename)
    await mkdir(dir, { recursive: true })
    await writeFile(filepath, optimized)
    await logAdminAction({
      action: 'file_upload',
      success: true,
      request,
      details: { filename, storage: 'local', originalName: file.name, size: file.size },
    })
    return NextResponse.json({ success: true, url: cleanCdnUrl(`/uploads/${filename}`), storage: 'local' })
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
        error:
          err instanceof Error
            ? err.message
            : 'A kép feldolgozása sikertelen. Ellenőrizd a formátumot (JPEG, PNG, WebP, GIF).',
      },
      { status: 500 }
    )
  }
}
