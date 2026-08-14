/**
 * Admin valós idejű anomália-küszöbök.
 * A riasztás soha nem blokkolja az exportot / ármódosítást / törlést.
 *
 * Alapértékek (env-felülírás zárójelben):
 * - CSV-export: ≥ 100 sor  (ADMIN_ANOMALY_CSV_MIN)
 * - Tömeges ár: ≥ 10 termék  (ADMIN_ANOMALY_BULK_PRICE_MIN)
 * - Burst törlés: ≥ 5 sikeres product_delete / user_delete / coupon_delete
 *   10 perces ablakban  (ADMIN_ANOMALY_DELETE_MIN, ADMIN_ANOMALY_DELETE_WINDOW_MIN perc)
 */

export type AdminAnomalyKind = 'csv_export' | 'bulk_price' | 'bulk_delete'

export const ADMIN_BULK_DELETE_ACTIONS = [
  'product_delete',
  'user_delete',
  'coupon_delete',
] as const

export type AdminAnomalyThresholds = {
  csvExportMin: number
  bulkPriceMin: number
  bulkDeleteMin: number
  bulkDeleteWindowMs: number
}

/** Dokumentált alapküszöbök – a riasztás ezeknél vagy fölötte megy ki. */
export const DEFAULT_ADMIN_ANOMALY_THRESHOLDS: AdminAnomalyThresholds = {
  csvExportMin: 100,
  bulkPriceMin: 10,
  bulkDeleteMin: 5,
  bulkDeleteWindowMs: 10 * 60_000,
}

export function parseEnvPositiveInt(
  raw: string | undefined,
  fallback: number,
  min = 1
): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < min) return fallback
  return n
}

export function getAdminAnomalyThresholds(
  env: Record<string, string | undefined> = process.env
): AdminAnomalyThresholds {
  return {
    csvExportMin: parseEnvPositiveInt(
      env.ADMIN_ANOMALY_CSV_MIN,
      DEFAULT_ADMIN_ANOMALY_THRESHOLDS.csvExportMin
    ),
    bulkPriceMin: parseEnvPositiveInt(
      env.ADMIN_ANOMALY_BULK_PRICE_MIN,
      DEFAULT_ADMIN_ANOMALY_THRESHOLDS.bulkPriceMin
    ),
    bulkDeleteMin: parseEnvPositiveInt(
      env.ADMIN_ANOMALY_DELETE_MIN,
      DEFAULT_ADMIN_ANOMALY_THRESHOLDS.bulkDeleteMin
    ),
    bulkDeleteWindowMs:
      parseEnvPositiveInt(
        env.ADMIN_ANOMALY_DELETE_WINDOW_MIN,
        DEFAULT_ADMIN_ANOMALY_THRESHOLDS.bulkDeleteWindowMs / 60_000
      ) * 60_000,
  }
}

export function isCountAnomaly(count: number, min: number): boolean {
  return Number.isFinite(count) && count >= min
}

/** Ablakos törlés: csak a küszöb átlépésekor riaszt, ne minden további DELETE-re. */
export function justCrossedThreshold(count: number, min: number): boolean {
  return isCountAnomaly(count, min) && count - 1 < min
}

export function shouldAlertAdminAnomaly(
  kind: AdminAnomalyKind,
  count: number,
  thresholds: AdminAnomalyThresholds = DEFAULT_ADMIN_ANOMALY_THRESHOLDS
): boolean {
  if (kind === 'csv_export') return isCountAnomaly(count, thresholds.csvExportMin)
  if (kind === 'bulk_price') return isCountAnomaly(count, thresholds.bulkPriceMin)
  return justCrossedThreshold(count, thresholds.bulkDeleteMin)
}

const KIND_LABEL: Record<AdminAnomalyKind, string> = {
  csv_export: 'nagy CSV-export',
  bulk_price: 'tömeges árváltoztatás',
  bulk_delete: 'tömeges törlés',
}

export function buildAdminAnomalySubject(kind: AdminAnomalyKind, count: number): string {
  return `[Gulumen] Admin anomália: ${KIND_LABEL[kind]} (${count})`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildAdminAnomalyHtml(input: {
  kind: AdminAnomalyKind
  count: number
  thresholds: AdminAnomalyThresholds
  ip?: string
  userAgent?: string
  details?: Record<string, unknown>
  at?: Date
}): string {
  const when = (input.at ?? new Date()).toISOString()
  const extra = input.details
    ? Object.entries(input.details)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</li>`)
        .join('')
    : ''
  const windowMin = Math.round(input.thresholds.bulkDeleteWindowMs / 60_000)
  const thresholdHint =
    input.kind === 'csv_export'
      ? `küszöb: ${input.thresholds.csvExportMin} sor`
      : input.kind === 'bulk_price'
        ? `küszöb: ${input.thresholds.bulkPriceMin} termék`
        : `küszöb: ${input.thresholds.bulkDeleteMin} törlés / ${windowMin} perc`
  return `
    <p>Admin művelet átlépte a valós idejű anomália-küszöböt. A művelet lefutott (nem blokkoltuk).</p>
    <p><strong>Típus:</strong> ${escapeHtml(KIND_LABEL[input.kind])} (${thresholdHint})</p>
    <ul>
      <li><strong>Darabszám:</strong> ${input.count}</li>
      <li><strong>Idő (UTC):</strong> ${escapeHtml(when)}</li>
      <li><strong>IP:</strong> ${escapeHtml(input.ip || 'unknown')}</li>
      <li><strong>Eszköz:</strong> ${escapeHtml(input.userAgent || '(nincs User-Agent)')}</li>
      ${extra}
    </ul>
    <p>Ha nem te voltál, cseréld az <code>ADMIN_API_KEY</code> értéket, és nézd át az audit naplót.</p>
  `.trim()
}

export function buildAdminAnomalyText(input: {
  kind: AdminAnomalyKind
  count: number
  thresholds: AdminAnomalyThresholds
  ip?: string
  userAgent?: string
}): string {
  const windowMin = Math.round(input.thresholds.bulkDeleteWindowMs / 60_000)
  const thresholdHint =
    input.kind === 'csv_export'
      ? `${input.thresholds.csvExportMin} sor`
      : input.kind === 'bulk_price'
        ? `${input.thresholds.bulkPriceMin} termék`
        : `${input.thresholds.bulkDeleteMin} törlés / ${windowMin} perc`
  return [
    `Admin anomália: ${KIND_LABEL[input.kind]}`,
    `Darabszám: ${input.count} (küszöb: ${thresholdHint})`,
    `IP: ${input.ip || 'unknown'}`,
    `User-Agent: ${input.userAgent || '–'}`,
  ].join('\n')
}
