-- Checkout fizetési mód a vásárlási pontjóváírás (Klarna = nincs pont) szabályhoz.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
