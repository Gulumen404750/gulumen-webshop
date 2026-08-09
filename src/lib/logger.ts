/**
 * Strukturált log (pino). console.log helyett logger.info / logger.error.
 * Dev-ben nincs pino-pretty transport – Next.js worker thread hibát okozna.
 */
import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
})
