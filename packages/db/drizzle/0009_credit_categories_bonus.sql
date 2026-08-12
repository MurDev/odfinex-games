ALTER TABLE "wallet_account" ADD COLUMN IF NOT EXISTS "bonus_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD COLUMN IF NOT EXISTS "category" text;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD COLUMN IF NOT EXISTS "bonus_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD COLUMN IF NOT EXISTS "actor_id" text;