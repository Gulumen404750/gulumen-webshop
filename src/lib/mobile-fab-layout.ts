/** Egyetlen mobil/desktop lebegő gomb: AI chat a jobb alsó sarokban. */
export const MOBILE_FAB_Z = 45

export const mobileFabBottom = 'max(1rem, env(safe-area-inset-bottom, 1rem))'
export const mobileFabRight = 'max(1rem, env(safe-area-inset-right, 1rem))'

/** Jobb oldali inset + ~1rem biztonsági sáv */
export const mobileAiFabMaxWidth =
  'min(16rem, calc(100vw - max(1rem, env(safe-area-inset-left, 1rem)) - max(1rem, env(safe-area-inset-right, 1rem)) - 1rem))'
