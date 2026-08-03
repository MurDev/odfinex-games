ALTER TABLE "game_client" ADD COLUMN IF NOT EXISTS "notify_url" text;--> statement-breakpoint
ALTER TABLE "withdrawal_request" ADD COLUMN IF NOT EXISTS "method" text DEFAULT 'moncash' NOT NULL;--> statement-breakpoint
ALTER TABLE "withdrawal_request" ADD COLUMN IF NOT EXISTS "account" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "withdrawal_request" ADD COLUMN IF NOT EXISTS "account_name" text;--> statement-breakpoint
ALTER TABLE "withdrawal_request" ADD COLUMN IF NOT EXISTS "client_id" text;--> statement-breakpoint
ALTER TABLE "withdrawal_request" ADD COLUMN IF NOT EXISTS "admin_comment" text;--> statement-breakpoint
ALTER TABLE "withdrawal_request" ADD COLUMN IF NOT EXISTS "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "withdrawal_request" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;--> statement-breakpoint
UPDATE "withdrawal_request" SET "account" = "phone" WHERE ("account" IS NULL OR "account" = '') AND "phone" IS NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_rail_config" (
  "id" text PRIMARY KEY NOT NULL,
  "method" text NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "account_name" text DEFAULT '' NOT NULL,
  "account_number" text DEFAULT '' NOT NULL,
  "min_amount_cents" integer DEFAULT 1000 NOT NULL,
  "max_amount_cents" integer DEFAULT 7500000 NOT NULL,
  "instructions" text,
  "environment" "game_environment" DEFAULT 'live' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_rail_config_method_env_unique" ON "payment_rail_config" ("method","environment");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "manual_deposit_request" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "client_id" text,
  "amount_cents" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "payment_proof_url" text,
  "reference" text,
  "admin_comment" text,
  "reviewed_by" text,
  "reviewed_at" timestamp,
  "environment" "game_environment" DEFAULT 'live' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "manual_deposit_request" ADD CONSTRAINT "manual_deposit_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
INSERT INTO "payment_rail_config" ("id", "method", "enabled", "account_name", "account_number", "min_amount_cents", "max_amount_cents", "environment")
SELECT gen_random_uuid()::text, 'natcash', false, '', '', 1000, 7500000, 'live'
WHERE NOT EXISTS (
  SELECT 1 FROM "payment_rail_config" WHERE "method" = 'natcash' AND "environment" = 'live'
);--> statement-breakpoint
INSERT INTO "payment_rail_config" ("id", "method", "enabled", "account_name", "account_number", "min_amount_cents", "max_amount_cents", "environment")
SELECT gen_random_uuid()::text, 'natcash', false, '', '', 1000, 7500000, 'sandbox'
WHERE NOT EXISTS (
  SELECT 1 FROM "payment_rail_config" WHERE "method" = 'natcash' AND "environment" = 'sandbox'
);
