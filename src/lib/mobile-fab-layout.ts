/** Mobil lebegő gombok: AI jobb alsó, CallUs bal alsó; a kosár sáv felül sticky. */
export const MOBILE_FAB_Z = 45

export const mobileFabBottom = 'max(1rem, env(safe-area-inset-bottom, 1rem))'
export const mobileFabLeft = 'max(1rem, env(safe-area-inset-left, 1rem))'
export const mobileFabRight = 'max(1rem, env(safe-area-inset-right, 1rem))'

/** w-14 (3.5rem) gomb + oldalsó inset + ~1rem távolság a középtől */
export const mobileAiFabMaxWidth =
  'min(12rem, calc(100vw - 5.5rem - max(1rem, env(safe-area-inset-left, 1rem)) - max(1rem, env(safe-area-inset-right, 1rem))))'
