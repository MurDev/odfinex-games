CREATE TABLE IF NOT EXISTS "deposit_order" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "order_id" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "reference_id" text NOT NULL,
  "redirect_url" text,
  "environment" "game_environment" DEFAULT 'live' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deposit_order_order_id_unique" ON "deposit_order" ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deposit_order_reference_id_unique" ON "deposit_order" ("reference_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deposit_order" ADD CONSTRAINT "deposit_order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "withdrawal_request" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "phone" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "reference_id" text NOT NULL,
  "provider_tx_id" text,
  "environment" "game_environment" DEFAULT 'live' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "withdrawal_request_reference_id_unique" ON "withdrawal_request" ("reference_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "withdrawal_request" ADD CONSTRAINT "withdrawal_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_event" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
