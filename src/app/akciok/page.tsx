import { redirect } from 'next/navigation'

/** Időkorlátos akciók kikapcsolva – átirányítás a terméklistára. */
export default function DealsPage() {
  redirect('/termekek')
}
