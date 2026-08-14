export const ADMIN_COOKIE_NAME = 'admin_authorized'
/** Másodlagos operátor session – soha nem írja felül az owner `admin_authorized` sütit. */
export const OPERATOR_COOKIE_NAME = 'operator_authorized'
export const ADMIN_2FA_PENDING_COOKIE = 'admin_2fa_pending'
export const JWT_ISSUER = 'gulumen-admin'
export const JWT_AUDIENCE = 'gulumen-admin'
export const JWT_AUDIENCE_2FA = 'gulumen-admin-2fa'
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 8
/** Inaktivitás után a JWT érvénytelen, akkor is, ha a max életkor még nem járt le. */
export const ADMIN_SESSION_IDLE_SEC = 30 * 60
export const ADMIN_2FA_PENDING_MAX_AGE_SEC = 5 * 60
export const ADMIN_SESSION_VERSION_CLAIM = 'sv'
export const ADMIN_SESSION_JTI_CLAIM = 'jti'
export const ADMIN_SESSION_ACTIVITY_CLAIM = 'act'
/** ADMIN_API_KEY ujjlenyomat a JWT-ben: kulcscsere után a régi sütik érvénytelenek (JWT_SECRET-től függetlenül). */
export const ADMIN_SESSION_API_KEY_CLAIM = 'ak'
/** Teljes admin session csak 2FA után: a claim nélkül a régi 24 órás JWT elutasítva. */
export const ADMIN_TFA_CLAIM = 'tfa'
/** Jelszócsere / reset után nő; a JWT `ep` claimnek egyeznie kell. */
export const ADMIN_SESSION_EPOCH_CLAIM = 'ep'
export const ADMIN_SESSION_EPOCH_REDIS_KEY = 'admin:session-epoch'
export const ADMIN_2FA_PENDING_ROLE = 'admin-2fa-pending'
export const ADMIN_RECORD_ID = 'admin'
/** Operátor felhasználónév a JWT-ben. */
export const ADMIN_USERNAME_CLAIM = 'un'
/** A pending 2FA tokenben az éles RBAC szerep (a `role` ott `admin-2fa-pending`). */
export const ADMIN_ACTOR_ROLE_CLAIM = 'ar'
/** Belépési scope: owner (API kulcs + 2FA) vs operator (username + jelszó). */
export const ADMIN_LOGIN_SCOPE_CLAIM = 'ls'
export type AdminLoginScope = 'owner' | 'operator'
/** Non-owner bulk törlés: ennyi felett PENDING_APPROVAL. */
export const BULK_DELETE_APPROVAL_THRESHOLD = 10
/** Owner jóváhagyási ablak (ms). Lejárat után auto-reject. */
export const BULK_DELETE_APPROVAL_TIMEOUT_MS = 5 * 60 * 1000
