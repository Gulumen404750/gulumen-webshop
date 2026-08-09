import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * Fizetés / pontlevonás után: profil és pontszám cache azonnali invalidálása.
 */
export function revalidateUserProfile() {
  try {
    revalidateTag('user-profile')
  } catch {
    // ignore (pl. non-Next context)
  }
  for (const p of ['/profil', '/fizetes', '/fizetes/siker']) {
    try {
      revalidatePath(p)
    } catch {
      // ignore
    }
  }
}
