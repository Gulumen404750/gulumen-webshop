import { redirect } from 'next/navigation'

/** Limitált / időkorlátos beszerzéses ajánlatok kikapcsolva. */
export default function BeszerzesreRendelhetoPage() {
  redirect('/termekek')
}
