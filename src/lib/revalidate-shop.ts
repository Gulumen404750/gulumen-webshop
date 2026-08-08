import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * Admin termék create/update/delete után: shop cache azonnali frissítése.
 */
export function revalidateShopProducts(slug?: string | null) {
  try {
    revalidateTag('products')
  } catch {
    // ignore (pl. non-Next context)
  }
  const paths = ['/termekek', '/admin', '/admin/dashboard/products', '/', '/ujdonsagok', '/akciok', '/beszerzesre-rendelheto']
  for (const p of paths) {
    try {
      revalidatePath(p)
    } catch {
      // ignore
    }
  }
  if (slug) {
    try {
      revalidatePath(`/termek/${slug}`)
    } catch {
      // ignore
    }
  }
}
