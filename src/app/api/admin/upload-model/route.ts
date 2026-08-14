/**
 * POST /api/admin/upload-model
 * Multipart form: file = .glb or .gltf 3D model file.
 * Saves to public/models/. Returns { success: true, url: '/models/...' }.
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { logAdminAction } from '@/lib/admin-audit'

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

  if (!ext || !validExt || !validMime) {
    return NextResponse.json(
      { error: 'Csak .glb vagy .gltf formátum tölthető fel.' },
      { status: 400 }
    )
  }

  const bytes = await file.arrayBuffer()
  const buf = Buffer.from(bytes)
  if (ext === 'glb' && buf.subarray(0, 4).toString('ascii') !== 'glTF') {
    return NextResponse.json({ error: 'Érvénytelen GLB fájl.' }, { status: 400 })
  }

  const baseName = `model-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const filename = `${baseName}.${ext}`
  const dir = path.join(process.cwd(), MODELS_DIR)
  const filepath = path.join(dir, filename)

  try {
    await mkdir(dir, { recursive: true })
    await writeFile(filepath, buf)
  } catch (err) {
    console.error('Upload model error:', err)
    await logAdminAction({
      action: 'file_upload',
      success: false,
      request,
      details: { kind: 'model', reason: 'error', originalName: name },
    })
    return NextResponse.json(
      {
        error: 'A modell mentése sikertelen.',
      },
      { status: 500 }
    )
  }

  await logAdminAction({
    action: 'file_upload',
    success: true,
    request,
    details: { kind: 'model', filename, originalName: name, size: file.size },
  })
  return NextResponse.json({ success: true, url: `/models/${filename}` })
}
