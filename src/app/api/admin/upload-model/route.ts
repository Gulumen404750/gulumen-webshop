/**
 * POST /api/admin/upload-model
 * Multipart form: file = .glb or .gltf 3D model file.
 * Saves to public/models/. Returns { success: true, url: '/models/...' }.
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const MODELS_DIR = 'public/models'
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB
const ALLOWED_EXT = /\.(glb|gltf)$/i
const MIME_GLB = 'model/gltf-binary'
const MIME_GLTF = 'model/gltf+json'

export async function POST(request: Request) {
  const ok = await requireAdmin()
  if (!ok) {
    return NextResponse.json(
      { error: 'Nincs admin jogosultság. Jelentkezz be az Admin belépés oldalon (API kulcs).' },
      { status: 401 }
    )
  }

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

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      {
        error: `A modell mérete legfeljebb ${Math.round(MAX_SIZE / 1024 / 1024)} MB lehet.`,
      },
      { status: 400 }
    )
  }

  const name = (file.name || '').trim()
  const mime = (file.type || '').toLowerCase()
  const extMatch = name.match(/\.(glb|gltf)$/i)
  const ext = extMatch ? extMatch[1].toLowerCase() : null
  const validMime = mime === MIME_GLB || mime === MIME_GLTF || mime === 'application/octet-stream' || !mime
  const validExt = ALLOWED_EXT.test(name)

  if (!ext || (!validMime && !validExt)) {
    return NextResponse.json(
      { error: 'Csak .glb vagy .gltf formátum tölthető fel.' },
      { status: 400 }
    )
  }

  const baseName = `model-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const filename = `${baseName}.${ext}`
  const dir = path.join(process.cwd(), MODELS_DIR)
  const filepath = path.join(dir, filename)

  try {
    await mkdir(dir, { recursive: true })
    const bytes = await file.arrayBuffer()
    await writeFile(filepath, Buffer.from(bytes))
  } catch (err) {
    console.error('Upload model error:', err)
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'A modell mentése sikertelen.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, url: `/models/${filename}` })
}
