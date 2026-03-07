# Voice – Anti-betyár / költségvédelem

A hívás bontás és figyelmeztetések a **voice agent** (Vapi/Retell stb.) oldalán kell megvalósulniuk. A backend csak fogadja az `end_reason` és egyéb mezőket a call-summary webhookban.

## Időzítők (agent konfiguráció)

| Esemény | Idő | Cselekvés |
|--------|-----|-----------|
| Csend / idle | 60 mp | Figyelmeztetés (bemondás) |
| Csend / idle | 90 mp | Utolsó figyelmeztetés (pl. email bemondás) |
| Csend / idle | 105 mp | **Bontás** (nem vár választ). Küldjön `end_reason: "silence_timeout"` |
| 2× sikertelen válasz | – | **Bontás**. Küldjön `end_reason: "non_responsive"` |
| Max híváshossz | 8 perc | **Bontás**, ha nincs outcome. Küldjön `end_reason: "max_duration_guard"` |

## Call-summary webhook mezők (bővített)

A `POST /api/call-summary` fogadja:

- `end_reason` (string, opcionális): `silence_timeout` | `non_responsive` | `max_duration_guard` | `normal` | egyéb
- `duration_sec` (number, opcionális): hívás hossza másodpercben
- `last_prompt_key` (string, opcionális): utolsó prompt azonosító

A dashboardon ezek alapján ikonok jelennek meg (🔇 csend timeout, ❌ nem válaszolt, ⏱️ max hossz, ✓ normál).
