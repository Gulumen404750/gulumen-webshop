/** Zöld / szürke badge – marketing / hírlevél hozzájárulás az adminban. */

export function MarketingBadge({ optedIn }: { optedIn: boolean }) {
  if (optedIn) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-emerald-600/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
        title="Elfogadta a marketing e-maileket / kupont"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
        Feliratkozott
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-zinc-500/15 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400"
      title="Nem fogadott el marketing megkeresést"
    >
      Nem kért marketinget
    </span>
  )
}
