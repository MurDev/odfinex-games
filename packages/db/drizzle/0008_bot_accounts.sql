ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_bot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "client_id" text;--> statement-breakpoint
