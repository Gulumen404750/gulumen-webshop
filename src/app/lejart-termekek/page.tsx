import { redirect } from 'next/navigation'

/** Lejárt időkorlátos ajánlatok oldala kikapcsolva. */
export default function LejartTermekekPage() {
  redirect('/termekek')
}
