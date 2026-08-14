export const ADMIN_COOKIE_NAME = 'admin_authorized'
export const ADMIN_2FA_PENDING_COOKIE = 'admin_2fa_pending'
export const JWT_ISSUER = 'gulumen-admin'
export const JWT_AUDIENCE = 'gulumen-admin'
export const JWT_AUDIENCE_2FA = 'gulumen-admin-2fa'
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 24
export const ADMIN_2FA_PENDING_MAX_AGE_SEC = 5 * 60
export const ADMIN_SESSION_VERSION_CLAIM = 'sv'
/** Teljes admin session csak 2FA után: a claim nélkül a régi 24 órás JWT elutasítva. */
export const ADMIN_TFA_CLAIM = 'tfa'
export const ADMIN_2FA_PENDING_ROLE = 'admin-2fa-pending'
export const ADMIN_RECORD_ID = 'admin'
