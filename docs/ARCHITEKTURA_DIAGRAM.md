# Architektúra diagram – Gulumen webshop

```mermaid
flowchart TB
    subgraph Client["Kliens (böngésző)"]
        UI[React / Next.js UI]
        Cart[Kosár / Wishlist state]
        ChatState[Chat üzenetek state]
        Countdown[Visszaszámláló setInterval]
    end

    subgraph Server["Next.js szerver (Node.js)"]
        API["API Routes\n/api/*"]
        Auth["Auth (JWT cookie)"]
        Middleware["Middleware\n(admin, security headers)"]
    end

    subgraph External["Külső szolgáltatások"]
        OpenAI[OpenAI API]
        Stripe[Stripe Checkout + Webhook]
        Cron["Cron (Vercel)\ndata-retention"]
    end

    subgraph Data["Adat"]
        DB[(PostgreSQL\nPrisma)]
        JSON[orders.json\nfallback]
    end

    UI -->|fetch, credentials| API
    Cart -->|checkout| API
    ChatState -->|POST /api/chat| API
    API --> Auth
    API --> Middleware
    API -->|OPENAI_API_KEY| OpenAI
    API -->|Stripe SDK| Stripe
    API -->|Prisma| DB
    API -.->|ha nincs DATABASE_URL| JSON
    Stripe -->|webhook POST| API
    Cron -->|GET + CRON_SECRET| API
    Countdown -->|serverNow + localStorage| UI
```

## Magyarázat

- **Kliens:** React state (kosár, chat, visszaszámláló), minden backend hívás `fetch` + cookie.
- **Next.js szerver:** API routes, session (JWT cookie), middleware (admin, CSP, stb.).
- **Külső:** OpenAI (chat), Stripe (fizetés + webhook), Vercel Cron (napi data-retention).
- **Adat:** PostgreSQL Prisma-val; ha nincs `DATABASE_URL`, rendelésekhez JSON fallback.
