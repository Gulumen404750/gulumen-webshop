/**
 * Gyártási / AI adatcsomag: SKU + darabszám + egyedi paraméterek.
 * A 3D nyomtató farm (Bambu Lab P1S) és az automatizálás ezt olvassa.
 */

export type OrderItemParameters = {
  colorName?: string
  colorHex?: string
  materialName?: string
  /** Gépileg olvasható gyártási recept (magyar kulcsok). */
  recept?: GyartasiRecept
}

export type GyartasiSpecifikaciok = {
  anyag: string
  szin: string
  darabszam: number
}

export type GyartasiTermek = {
  nev: string
  sku: string
  specifikaciok: GyartasiSpecifikaciok
}

/** Egy rendelési tétel gyártási receptje – a farm / AI ezt olvassa. */
export type GyartasiRecept = {
  rendeles_azonosito: string
  termek: GyartasiTermek
}

export type ProductionJobItem = {
  sku: string | null
  productId: string
  name: string | null
  qty: number
  parameters: OrderItemParameters | null
}

export type ProductionJobPayload = {
  type: 'production_job'
  rendeles_azonosito: string
  orderId: string
  orderGroupId: string | null
  status: string
  paidAt: string | null
  termekek: GyartasiTermek[]
  receptek: GyartasiRecept[]
  items: ProductionJobItem[]
}

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function cartOptionsToParameters(options?: {
  colorName?: string
  colorHex?: string
  materialName?: string
} | null): OrderItemParameters | undefined {
  if (!options) return undefined
  const parameters: OrderItemParameters = {}
  const colorName = options.colorName?.trim()
  const colorHex = options.colorHex?.trim()
  const materialName = options.materialName?.trim()
  if (colorName) parameters.colorName = colorName
  if (colorHex) parameters.colorHex = colorHex
  if (materialName) parameters.materialName = materialName
  return Object.keys(parameters).length > 0 ? parameters : undefined
}

function parseGyartasiRecept(raw: unknown): GyartasiRecept | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const rendelesAzonosito = trimText(o.rendeles_azonosito)
  const termekRaw = o.termek
  if (!rendelesAzonosito || !termekRaw || typeof termekRaw !== 'object' || Array.isArray(termekRaw)) {
    return undefined
  }
  const termek = termekRaw as Record<string, unknown>
  const specRaw = termek.specifikaciok
  const spec =
    specRaw && typeof specRaw === 'object' && !Array.isArray(specRaw)
      ? (specRaw as Record<string, unknown>)
      : {}
  const darabszamRaw = spec.darabszam
  const darabszam =
    typeof darabszamRaw === 'number' && Number.isFinite(darabszamRaw)
      ? Math.max(0, Math.floor(darabszamRaw))
      : Number.parseInt(String(darabszamRaw ?? ''), 10)
  return {
    rendeles_azonosito: rendelesAzonosito,
    termek: {
      nev: trimText(termek.nev),
      sku: trimText(termek.sku),
      specifikaciok: {
        anyag: trimText(spec.anyag),
        szin: trimText(spec.szin),
        darabszam: Number.isFinite(darabszam) ? darabszam : 0,
      },
    },
  }
}

export function parseOrderItemParameters(raw: unknown): OrderItemParameters | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const recept = parseGyartasiRecept(o.recept) ?? parseGyartasiRecept(o)
  const spec = recept?.termek.specifikaciok
  const parameters: OrderItemParameters = {}
  const colorName = trimText(o.colorName) || spec?.szin || ''
  const colorHex = trimText(o.colorHex)
  const materialName = trimText(o.materialName) || spec?.anyag || ''
  if (colorName) parameters.colorName = colorName
  if (colorHex) parameters.colorHex = colorHex
  if (materialName) parameters.materialName = materialName
  if (recept) parameters.recept = recept
  return Object.keys(parameters).length > 0 ? parameters : null
}

export function buildGyartasiRecept(input: {
  rendelesAzonosito: string
  nev?: string | null
  sku?: string | null
  qty: number
  parameters?: OrderItemParameters | null
}): GyartasiRecept {
  const parsed = input.parameters ?? null
  const anyag = parsed?.materialName?.trim() || parsed?.recept?.termek.specifikaciok.anyag || ''
  const szin = parsed?.colorName?.trim() || parsed?.recept?.termek.specifikaciok.szin || ''
  const darabszam = Number.isFinite(input.qty) ? Math.max(0, Math.floor(input.qty)) : 0
  return {
    rendeles_azonosito: input.rendelesAzonosito,
    termek: {
      nev: input.nev?.trim() || parsed?.recept?.termek.nev || '',
      sku: input.sku?.trim() || parsed?.recept?.termek.sku || '',
      specifikaciok: {
        anyag,
        szin,
        darabszam,
      },
    },
  }
}

export function withGyartasiRecept<T extends {
  name?: string | null
  sku?: string | null
  qty: number
  parameters?: OrderItemParameters | null
}>(orderId: string, item: T): Omit<T, 'parameters'> & { parameters: OrderItemParameters } {
  const recept = buildGyartasiRecept({
    rendelesAzonosito: orderId,
    nev: item.name,
    sku: item.sku,
    qty: item.qty,
    parameters: item.parameters ?? null,
  })
  return {
    ...item,
    parameters: {
      ...(item.parameters ?? {}),
      recept,
    },
  }
}

export function buildProductionJobPayload(input: {
  orderId: string
  orderGroupId?: string | null
  status: string
  paidAt?: string | null
  items: Array<{
    sku?: string | null
    productId: string
    name?: string | null
    qty: number
    parameters?: unknown
  }>
}): ProductionJobPayload {
  const rendelesAzonosito = input.orderId
  const items: ProductionJobItem[] = input.items.map((item) => {
    const parameters = parseOrderItemParameters(item.parameters)
    const withRecept = withGyartasiRecept(rendelesAzonosito, {
      name: item.name ?? null,
      sku: item.sku ?? null,
      qty: item.qty,
      parameters,
    })
    return {
      sku: item.sku?.trim() || null,
      productId: item.productId,
      name: item.name ?? null,
      qty: item.qty,
      parameters: withRecept.parameters ?? null,
    }
  })
  const receptek = items.map((item) =>
    buildGyartasiRecept({
      rendelesAzonosito,
      nev: item.name,
      sku: item.sku,
      qty: item.qty,
      parameters: item.parameters,
    })
  )
  return {
    type: 'production_job',
    rendeles_azonosito: rendelesAzonosito,
    orderId: input.orderId,
    orderGroupId: input.orderGroupId ?? null,
    status: input.status,
    paidAt: input.paidAt ?? null,
    termekek: receptek.map((r) => r.termek),
    receptek,
    items,
  }
}

export function orderItemSpecForAdmin(item: {
  name?: string | null
  sku?: string | null
  qty: number
  parameters?: unknown
}): {
  nev: string
  sku: string
  anyag: string
  szin: string
  darabszam: number
} {
  const parsed = parseOrderItemParameters(item.parameters)
  const recept = parsed?.recept
  return {
    nev: item.name?.trim() || recept?.termek.nev || '—',
    sku: item.sku?.trim() || recept?.termek.sku || '',
    anyag: parsed?.materialName || recept?.termek.specifikaciok.anyag || '',
    szin: parsed?.colorName || recept?.termek.specifikaciok.szin || '',
    darabszam: item.qty,
  }
}
