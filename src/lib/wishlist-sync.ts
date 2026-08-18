/**
 * Kedvencek szinkron + explicit törlés (dismiss) szabályok.
 * A localStorage soha nem növelheti a listát stale ID-kkal, és a dismisselt
 * termék nem kerülhet vissza automatikusan.
 */

export function applyPendingFavoriteOverlay(
  serverIds: string[],
  pending: ReadonlyMap<string, boolean>
): string[] {
  let next = serverIds
  for (const [id, liked] of pending) {
    if (liked) {
      if (!next.includes(id)) next = [...next, id]
    } else if (next.includes(id)) {
      next = next.filter((x) => x !== id)
    }
  }
  return next
}

export function excludeDismissedIds(ids: string[], dismissedIds: Iterable<string>): string[] {
  const blocked = dismissedIds instanceof Set ? dismissedIds : new Set(dismissedIds)
  if (blocked.size === 0) return ids
  return ids.filter((id) => !blocked.has(id))
}

export function excludeDismissedItems<T extends { id: string }>(
  items: T[],
  dismissedIds: Iterable<string>
): T[] {
  const blocked = dismissedIds instanceof Set ? dismissedIds : new Set(dismissedIds)
  if (blocked.size === 0) return items
  return items.filter((item) => !blocked.has(item.id))
}

/** Stale localStorage soha nem adhat vissza már kitörölt kedvencet. */
export function mergeFavoriteIdsFromCache(prev: string[], stored: string[]): string[] {
  if (prev.length === 0) return stored
  return prev
}

export function nextFavoriteIdsAfterToggle(
  prev: string[],
  productId: string,
  liked: boolean
): string[] {
  if (liked) return prev.includes(productId) ? prev : [...prev, productId]
  return prev.filter((id) => id !== productId)
}

export function nextDismissedIdsAfterToggle(
  prev: string[],
  productId: string,
  liked: boolean
): string[] {
  if (liked) return prev.filter((id) => id !== productId)
  return prev.includes(productId) ? prev : [...prev, productId]
}

/** GET liked=true ne írja vissza a store-ba, ha a user már expliciten törölte. */
export function shouldAcceptExternalLike(
  liked: boolean,
  alreadyInWishlist: boolean,
  dismissed: boolean,
  ignoreExternal: boolean
): boolean {
  return liked && !alreadyInWishlist && !dismissed && !ignoreExternal
}
