/**
 * Helyi fejlesztés auth fallback – ha nincs DATABASE_URL (mint a product-likes JSON fallback).
 * Productionben soha ne használd: register/login route csak !isDbConfigured() esetén hívja.
 */
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

const DATA_DIR = path.join(process.cwd(), 'data')
const DEV_USERS_FILE = path.join(DATA_DIR, 'dev-users.json')

export type DevUser = {
  id: string
  email: string
  passwordHash: string
  name: string | null
  createdAt: string
}

function loadUsers(): DevUser[] {
  try {
    if (!fs.existsSync(DEV_USERS_FILE)) return []
    const raw = fs.readFileSync(DEV_USERS_FILE, 'utf-8')
    const data = JSON.parse(raw)
    const arr = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : []
    return arr.filter(
      (u: unknown): u is DevUser =>
        typeof (u as DevUser)?.id === 'string' &&
        typeof (u as DevUser)?.email === 'string' &&
        typeof (u as DevUser)?.passwordHash === 'string'
    )
  } catch {
    return []
  }
}

function saveUsers(users: DevUser[]): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(DEV_USERS_FILE, JSON.stringify({ users }, null, 2), 'utf-8')
}

export function devFindUserByEmail(email: string): DevUser | null {
  const norm = email.trim().toLowerCase()
  return loadUsers().find((u) => u.email === norm) ?? null
}

export function devFindUserById(id: string): DevUser | null {
  return loadUsers().find((u) => u.id === id) ?? null
}

export async function devCreateUser(
  email: string,
  password: string,
  name?: string
): Promise<DevUser> {
  const norm = email.trim().toLowerCase()
  const users = loadUsers()
  if (users.some((u) => u.email === norm)) {
    throw new Error('EMAIL_EXISTS')
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const user: DevUser = {
    id: randomUUID(),
    email: norm,
    passwordHash,
    name: name?.trim() || null,
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  saveUsers(users)
  return user
}

export async function devVerifyUser(
  email: string,
  password: string
): Promise<DevUser | null> {
  const user = devFindUserByEmail(email)
  if (!user) return null
  const ok = await bcrypt.compare(password, user.passwordHash)
  return ok ? user : null
}
