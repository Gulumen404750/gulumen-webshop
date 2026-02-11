'use client'

import Image from 'next/image'

export default function ContactPage() {
  return (
    <div className="relative min-h-[70vh] flex items-center">
      {/* Statikus háttérkép – nincs mozgó vagy interaktív elem */}
      <div className="absolute inset-0 min-h-[400px] overflow-hidden">
        <Image
          src="/img/kapcsolat-ai-robot.png"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent pointer-events-none" aria-hidden />
      </div>

      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-6 drop-shadow-lg">
          Kapcsolat
        </h1>
        <div className="text-gray-200 space-y-4 max-w-2xl drop-shadow">
          <p>
            Kérdésed vagy panaszod van? Használd az oldal jobb alsó sarkában lévő <strong className="text-white">„Kérdésed van? Segítek!”</strong> gombot – az AI ügyfélszolgálat magyarul, angolul és németül válaszol.
          </p>
          <p>
            Ha emberi ügyintézőt szeretnél (pl. panasz, jogi ügy), a chatben kérj ügy átadását – add meg a rendelés azonosítót és e-mail címedet.
          </p>
          <p>
            E-mail: <a href="mailto:info@gulumen.hu" className="text-accent hover:underline font-medium">info@gulumen.hu</a>
          </p>
        </div>
      </div>
    </div>
  )
}
