export const RECAPTCHA_ACTIONS = {
  login: 'login',
  adminLogin: 'admin_login',
} as const

export type RecaptchaAction = (typeof RECAPTCHA_ACTIONS)[keyof typeof RECAPTCHA_ACTIONS]
