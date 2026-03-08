import DealPopupSettings from '../settings/DealPopupSettings'

export default function AdminDealPopupPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">
        Akciós felugró ablak
      </h1>
      <p className="text-muted text-sm">
        Itt állíthatod be a főoldalon megjelenő akciós popupot: be/ki, címet, leírást, és melyik 3 akciós termék jelenjen meg (sorrend is állítható).
      </p>
      <DealPopupSettings />
    </div>
  )
}
