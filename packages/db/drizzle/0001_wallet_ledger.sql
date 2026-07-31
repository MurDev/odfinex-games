ALTER TABLE "game_client" ADD COLUMN "wallet_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "wallet_account" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"type" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"balance_after_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"reference_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entry_client_ref_unique" UNIQUE("client_id","reference_id")
);
--> statement-breakpoint
ALTER TABLE "wallet_account" ADD CONSTRAINT "wallet_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_account" ADD CONSTRAINT "wallet_account_balance_nonneg" CHECK ("balance_cents" >= 0);--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_amount_positive" CHECK ("amount_cents" > 0);
