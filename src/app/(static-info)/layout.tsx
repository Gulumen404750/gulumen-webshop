/** Információs oldalak: build-time SSG, nincs szerver fetch. */
export const dynamic = 'force-static'

export default function StaticInfoLayout({ children }: { children: React.ReactNode }) {
  return children
}
