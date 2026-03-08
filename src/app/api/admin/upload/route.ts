import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = 'public/uploads'
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * POST /api/admin/upload
 * Multipart form: file = image file.
 * Saves to public/uploads/<uuid>.<ext>, returns { url: '/uploads/...' }.
 * Railway: a public mappa deploy-kor felülíródik – élesben használj külső tárolót (pl. Cloudinary) és URL-t.
 */
export async function POST(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Max 5 MB' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP, GIF' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = ['jpeg', 'jpg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
  const filename = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`
  const dir = path.join(process.cwd(), UPLOAD_DIR)
  const filepath = path.join(dir, filename)

  try {
    await mkdir(dir, { recursive: true })
    const bytes = await file.arrayBuffer()
    await writeFile(filepath, Buffer.from(bytes))
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  return NextResponse.json({ url: `/uploads/${filename}` })
}
