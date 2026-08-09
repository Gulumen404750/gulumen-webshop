-- Termék AI tudásbázis / specifikációk (HU szöveg a chat kontextushoz)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "aiKnowledgeBase" TEXT;
