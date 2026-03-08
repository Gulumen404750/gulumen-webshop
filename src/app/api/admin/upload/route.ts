/**
 * POST /api/admin/upload
 * Multipart form: file = image file.
 * Accepts larger files (up to 25 MB), optimizes with sharp (resize + WebP), saves to public/uploads.
 * Returns { url: '/uploads/...' }. Railway: public overwritten on deploy – use external storage in production.
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

const UPLOAD_DIR = 'public/uploads'
const MAX_INPUT_SIZE = 25 * 1024 * 1024 // 25 MB – nagy képek is feltölthetők
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_WIDTH = 2000
const MAX_HEIGHT = 2000
const WEBP_QUALITY = 85

export async function POST(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Csak JPEG, PNG, WebP vagy GIF formátum tölthető fel.' },
      { status: 400 }
    )
  }

  const baseName = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const filename = `${baseName}.webp`
  const dir = path.join(process.cwd(), UPLOAD_DIR)
  const filepath = path.join(dir, filename)

  try {
    await mkdir(dir, { recursive: true })
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    await sharp(buffer)
      .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(filepath)
  } catch (err) {
    console.error('Upload/optimize error:', err)
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

  return NextResponse.json({ success: true, url: `/uploads/${filename}` })
}
